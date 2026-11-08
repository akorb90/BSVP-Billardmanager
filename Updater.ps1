[CmdletBinding()]
param(
    [ValidateSet('Auto', 'Source', 'Image')][string]$Mode = 'Auto',
    [string]$ProjectName
)

# Windows PowerShell 5.1 and PowerShell 7. Dot-sourcing only loads the functions.
$script:UpdaterLog = $null

function Invoke-UpdaterCommand {
    param([string]$Program, [string[]]$Arguments, [switch]$CaptureOnly)
    $description = $Program + ' ' + ($Arguments -join ' ')
    Write-Host "> $description"
    Add-Content -LiteralPath $script:UpdaterLog -Value "> $description" -Encoding UTF8
    $command = Get-Command $Program -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $previousPreference = $ErrorActionPreference
    try {
        # Native Docker progress on stderr is not a PowerShell exception in 5.1.
        $ErrorActionPreference = 'Continue'
        $output = @(& $command.Source @Arguments 2>&1)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    $text = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if (-not $CaptureOnly) { Add-Content -LiteralPath $script:UpdaterLog -Value $text -Encoding UTF8 }
    if ($code -ne 0) { throw "$Program fehlgeschlagen (Exitcode $code). Details: $script:UpdaterLog" }
    return $text
}

function Get-UpdaterMode {
    param([string]$Root, [string]$Requested)
    if ($Requested -ne 'Auto') { return $Requested }
    if (Test-Path -LiteralPath (Join-Path $Root '.git')) { return 'Source' }
    return 'Image'
}

function Assert-UpdaterServices {
    param([string]$Json)
    # Compose versions emit either a JSON array or one JSON object per line.
    if ($Json.TrimStart().StartsWith('[')) { $services = @($Json | ConvertFrom-Json) }
    else { $services = @($Json -split '\r?\n' | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json }) }
    foreach ($name in @('app', 'db', 'proxy')) {
        $service = @($services | Where-Object { $_.Service -eq $name })
        if ($service.Count -ne 1 -or $service[0].State -ne 'running' -or $service[0].Health -in @('unhealthy', 'starting')) {
            throw "Der bestehende Dienst '$name' ist nicht bereit. Projektzuordnung und Docker Desktop pruefen; gegebenenfalls -ProjectName verwenden."
        }
    }
}

function Invoke-StackUpdate {
    param([string]$Root, [string]$Mode = 'Auto', [string]$ProjectName)
    $ErrorActionPreference = 'Stop'
    $Root = (Resolve-Path -LiteralPath $Root).Path
    $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $logDirectory = Join-Path $Root "data/updater-$stamp"
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $script:UpdaterLog = Join-Path $logDirectory 'update.log'
    $lock = $null
    Push-Location -LiteralPath $Root
    try {
        $lock = [System.IO.File]::Open((Join-Path $Root 'data/updater.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
        foreach ($file in @('compose.yaml', 'Caddyfile', '.env', 'secrets/config.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $Root $file) -PathType Leaf)) { throw "Bestehende Installationsdatei fehlt: $file. Kein Setup ausgefuehrt." }
        }
        $selectedMode = Get-UpdaterMode -Root $Root -Requested $Mode
        $compose = @('compose', '-f', 'compose.yaml')
        if ($selectedMode -eq 'Source') {
            if (-not (Test-Path -LiteralPath (Join-Path $Root 'compose.override.yaml') -PathType Leaf)) { throw 'Lokale Build-Datei compose.override.yaml fehlt.' }
            $compose += @('-f', 'compose.override.yaml')
            $branch = (Invoke-UpdaterCommand git @('branch', '--show-current')).Trim()
            if ($branch -ne 'main') { throw 'Quellcode-Updates sind nur auf main erlaubt.' }
            $changes = Invoke-UpdaterCommand git @('status', '--porcelain', '--untracked-files=normal')
            if ($changes.Trim()) { throw 'Lokale Aenderungen vorhanden. Bitte zuerst selbst sichern/committen; der Updater verwirft oder stasht nichts.' }
        }
        Invoke-UpdaterCommand docker @('info', '--format', '{{.ServerVersion}}') | Out-Null
        $config = Invoke-UpdaterCommand docker ($compose + @('config', '--format', 'json')) -CaptureOnly | ConvertFrom-Json
        if (-not $ProjectName) { $ProjectName = $config.name }
        if (-not $ProjectName -or $ProjectName -notmatch '^[a-z0-9][a-z0-9_-]*$') { throw 'Ungueltiger Compose-Projektname.' }
        $compose += @('--project-name', $ProjectName)
        $before = Invoke-UpdaterCommand docker ($compose + @('ps', '--format', 'json'))
        Assert-UpdaterServices $before
        # Containers may still run an image whose local tag/storage was removed.
        # Inspect their image IDs directly; do not require the old image to exist.
        $containerIds = @((Invoke-UpdaterCommand docker ($compose + @('ps', '--quiet'))) -split '\r?\n' | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() })
        if (-not $containerIds.Count -or @($containerIds | Where-Object { $_ -notmatch '^[a-f0-9]{12,64}$' }).Count) { throw 'Container-IDs konnten nicht sicher ermittelt werden.' }
        $images = Invoke-UpdaterCommand docker (@('inspect', '--format', '{{.Id}} {{.Name}} {{.Image}}') + $containerIds)
        if ($selectedMode -eq 'Source') {
            $gitRoot = (Invoke-UpdaterCommand git @('rev-parse', '--show-toplevel')).Trim()
            if ((Resolve-Path -LiteralPath $gitRoot).Path -ne $Root) { throw 'Updater muss im Wurzelordner dieses Repositorys liegen.' }
            Invoke-UpdaterCommand git @('rev-parse', 'HEAD') | Out-Null
            Invoke-UpdaterCommand git @('fetch', 'origin', 'main') | Out-Null
            # Refuse local-only commits and divergence instead of resetting them.
            Invoke-UpdaterCommand git @('merge-base', '--is-ancestor', 'HEAD', 'FETCH_HEAD') | Out-Null
        }

        $backup = Join-Path $Root "backups/updater-$stamp"
        New-Item -ItemType Directory -Path $backup | Out-Null
        $dump = '/tmp/billard-updater-' + [Guid]::NewGuid().ToString('N') + '.dump'
        try {
            Invoke-UpdaterCommand docker ($compose + @('exec', '-T', 'db', 'pg_dump', '-U', 'billard', '-d', 'billard', '-Fc', '-f', $dump)) | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('cp', "db:$dump", (Join-Path $backup 'billard.dump'))) | Out-Null
            if (-not (Test-Path -LiteralPath (Join-Path $backup 'billard.dump') -PathType Leaf) -or (Get-Item -LiteralPath (Join-Path $backup 'billard.dump')).Length -eq 0) { throw 'Datenbanksicherung fehlt oder ist leer.' }
        } finally {
            try { Invoke-UpdaterCommand docker ($compose + @('exec', '-T', 'db', 'rm', '-f', $dump)) | Out-Null }
            catch { Write-Warning "Temporaerer Dump bleibt im DB-Container: $dump" }
        }
        foreach ($file in @('compose.yaml', 'compose.override.yaml', 'Caddyfile')) {
            if (Test-Path -LiteralPath (Join-Path $Root $file) -PathType Leaf) { Copy-Item -LiteralPath (Join-Path $Root $file) -Destination $backup }
        }
        Set-Content -LiteralPath (Join-Path $backup 'project.txt') -Value $ProjectName -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $backup 'containers-before.json') -Value $before -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $backup 'images-before.txt') -Value $images -Encoding UTF8
        Write-Host "Datenbanksicherung: $backup"

        if ($selectedMode -eq 'Source') {
            Invoke-UpdaterCommand git @('merge', '--ff-only', 'FETCH_HEAD') | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('config', '--quiet')) | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('pull', 'db', 'proxy')) | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('build', '--pull', 'app')) | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('up', '-d', '--build', '--wait')) | Out-Null
        } else {
            Invoke-UpdaterCommand docker ($compose + @('pull', 'app', 'db', 'proxy')) | Out-Null
            Invoke-UpdaterCommand docker ($compose + @('up', '-d', '--no-build', '--wait')) | Out-Null
        }
        Invoke-UpdaterCommand docker ($compose + @('exec', '-T', 'proxy', 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')) | Out-Null
        Assert-UpdaterServices (Invoke-UpdaterCommand docker ($compose + @('ps', '--format', 'json')))
        $config = Invoke-UpdaterCommand docker ($compose + @('config', '--format', 'json')) -CaptureOnly | ConvertFrom-Json
        $hostName = $config.services.proxy.environment.BILLARD_HOST
        if (-not $hostName -or $hostName -notmatch '^[a-zA-Z0-9.-]+$') { throw 'HTTPS-Host nicht unterstuetzt. HTTPS bitte manuell pruefen.' }
        $ca = Join-Path $logDirectory 'root.crt'
        Invoke-UpdaterCommand docker ($compose + @('cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', $ca)) | Out-Null
        $curl = if (Get-Command curl.exe -CommandType Application -ErrorAction SilentlyContinue) { 'curl.exe' } else { 'curl' }
        $tlsOptions = @()
        if ((Invoke-UpdaterCommand $curl @('--version')) -match 'Schannel') {
            # Caddy's private CA has no public revocation distribution point.
            # Keep CA/hostname validation; tolerate only unavailable CRL checks.
            $tlsOptions += '--ssl-revoke-best-effort'
        }
        Invoke-UpdaterCommand $curl ($tlsOptions + @('--fail', '--silent', '--show-error', '--noproxy', '*', '--connect-timeout', '10', '--max-time', '30', '--cacert', $ca, '--resolve', "${hostName}:443:127.0.0.1", "https://${hostName}/health")) | Out-Null
        Write-Host "Update erfolgreich ($selectedMode, Projekt $ProjectName). HTTPS geprueft; Stack bleibt aktiv."
        Write-Host "Protokoll: $script:UpdaterLog"
    } catch {
        Add-Content -LiteralPath $script:UpdaterLog -Value $_.Exception.Message -Encoding UTF8
        throw
    } finally {
        if ($lock) { $lock.Dispose() }
        Pop-Location
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-StackUpdate -Root $PSScriptRoot -Mode $Mode -ProjectName $ProjectName }
    catch { Write-Error -Message ("Update fehlgeschlagen: " + $_.Exception.Message) -ErrorAction Continue; exit 1 }
}
