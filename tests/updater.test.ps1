$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
. (Join-Path $repository 'Updater.ps1')
$nativeCommand = (Get-Item Function:\Invoke-UpdaterCommand).ScriptBlock
$testDirectory = Join-Path $repository ('data/updater-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
$script:UpdaterLog = Join-Path $testDirectory 'native.log'
$hostProgram = (Get-Process -Id $PID).Path
$nativeFailed = $false
try { & $nativeCommand $hostProgram @('-NoProfile', '-Command', 'exit 7') | Out-Null }
catch { $nativeFailed = $_.Exception.Message -match 'Exitcode 7' }
if (-not $nativeFailed) { throw 'Native exit code was lost.' }
& $nativeCommand $hostProgram @('-NoProfile', '-Command', "[Console]::Error.WriteLine('progress'); exit 0") | Out-Null

function Assert-Test {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
function New-Fixture {
    param([bool]$Source = $true)
    $script:Fixture = Join-Path $testDirectory ([Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path (Join-Path $script:Fixture 'secrets') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $script:Fixture 'data') | Out-Null
    foreach ($name in @('compose.yaml', 'compose.override.yaml', 'Caddyfile', '.env', 'secrets/config.json')) { Set-Content -LiteralPath (Join-Path $script:Fixture $name) -Value 'preserve me' }
    if ($Source) { New-Item -ItemType Directory -Path (Join-Path $script:Fixture '.git') | Out-Null }
    $script:Calls = @()
    $script:Failure = ''
    $script:Dirty = $false
    $script:Branch = 'main'
    $script:MissingService = $false
}
function Invoke-UpdaterCommand {
    param([string]$Program, [string[]]$Arguments, [switch]$CaptureOnly)
    $call = $Program + ' ' + ($Arguments -join ' ')
    $script:Calls += $call
    if ($script:Failure -and $call.Contains($script:Failure)) { throw 'Simulated command failure' }
    if ($Program -eq 'git') {
        switch ($Arguments[0]) {
            'branch' { return $script:Branch }
            'status' { if ($script:Dirty) { return ' M public/app.js' }; return '' }
            'rev-parse' { if ($Arguments[1] -eq '--show-toplevel') { return $script:Fixture }; return 'before-sha' }
            default { return '' }
        }
    }
    if ($Arguments -contains 'config' -and $Arguments -notcontains '--quiet') { return '{"name":"existing-project","services":{"proxy":{"environment":{"BILLARD_HOST":"localhost"}}}}' }
    if ($Arguments -contains 'ps') {
        if ($script:MissingService) { return '[]' }
        return (@('app', 'db', 'proxy') | ForEach-Object { @{Service = $_; State = 'running'; Health = 'healthy'} } | ConvertTo-Json -Compress)
    }
    if ($Arguments -contains 'cp') {
        $destination = $Arguments[-1]
        [System.IO.File]::WriteAllBytes($destination, [System.Text.Encoding]::ASCII.GetBytes('PGDMP-fixture'))
    }
    return ''
}
function Run-Fixture { Invoke-StackUpdate -Root $script:Fixture -ProjectName 'existing-project' }
function Expect-Failure {
    $failed = $false
    try { Run-Fixture } catch { $failed = $true }
    Assert-Test $failed 'Expected the updater to stop.'
}

New-Fixture
Run-Fixture
$all = $script:Calls -join "`n"
Assert-Test ($all.Contains('-f compose.yaml -f compose.override.yaml --project-name existing-project')) 'Source mode must retain the project and override COMPOSE_FILE.'
Assert-Test ($all.IndexOf(' cp db:') -lt $all.IndexOf('git merge --ff-only FETCH_HEAD')) 'Backup must precede the fast-forward.'
Assert-Test ($all.IndexOf('git merge --ff-only FETCH_HEAD') -lt $all.IndexOf(' build --pull app')) 'Build must follow the fast-forward.'
Assert-Test ($all.Contains(' up -d --build --wait')) 'Source mode must build and wait.'
Assert-Test ($all.Contains('--cacert') -and $all.Contains('https://localhost/health') -and -not $all.Contains('--insecure')) 'HTTPS must verify the CA and host.'
Assert-Test (-not ($all -match '\b(reset|stash|down|prune|setup)\b')) 'No reset, stash, deletion or setup allowed.'
Assert-Test ((Get-Content -LiteralPath (Join-Path $script:Fixture '.env') -Raw).Trim() -eq 'preserve me') 'Environment changed.'
Assert-Test ((Get-Content -LiteralPath (Join-Path $script:Fixture 'secrets/config.json') -Raw).Trim() -eq 'preserve me') 'Secrets changed.'
Write-Host 'PASS: source update order, project, backup, HTTPS and preserved configuration'

New-Fixture -Source $false
Run-Fixture
$all = $script:Calls -join "`n"
Assert-Test (-not $all.Contains('git ') -and -not $all.Contains('compose.override.yaml')) 'Image installation must not use Git or the source override.'
Assert-Test ($all.Contains(' pull app db proxy') -and $all.Contains(' up -d --no-build --wait')) 'Image installation must pull and recreate.'
Write-Host 'PASS: image-only installation'

New-Fixture
$script:Dirty = $true
Expect-Failure
Assert-Test (-not (($script:Calls -join "`n") -match 'fetch|pg_dump| up ')) 'Dirty checkout was mutated.'
New-Fixture
$script:Branch = 'other'
Expect-Failure
Assert-Test ($script:Calls.Count -eq 1) 'Wrong branch must stop immediately.'
New-Fixture
$script:MissingService = $true
Expect-Failure
Assert-Test (-not (($script:Calls -join "`n") -match 'pg_dump| pull | up ')) 'Missing project must not create a stack.'
Write-Host 'PASS: dirty checkout, wrong branch and missing project are rejected'

foreach ($scenarioFailure in @('merge-base', 'pg_dump', ' cp db:', ' pull db proxy', ' up -d', '--cacert')) {
    New-Fixture
    $script:Failure = $scenarioFailure
    Expect-Failure
    $all = $script:Calls -join "`n"
    if ($scenarioFailure -in @('merge-base', 'pg_dump', ' cp db:')) { Assert-Test (-not $all.Contains('git merge --ff-only')) 'Failed precondition must prevent merge.' }
    if ($scenarioFailure -in @('merge-base', 'pg_dump', ' cp db:', ' pull db proxy')) { Assert-Test (-not $all.Contains(' up -d')) 'Failed backup/download must prevent deployment.' }
    Assert-Test (-not ($all -match '\b(down|prune|reset)\b')) 'Failure must not remove data or roll back automatically.'
}
Write-Host 'PASS: divergence, dump, copy, pull, deployment and TLS failures stop the updater'

New-Fixture
$held = [System.IO.File]::Open((Join-Path $script:Fixture 'data/updater.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
try { Expect-Failure; Assert-Test ($script:Calls.Count -eq 0) 'Parallel updater must not run commands.' }
finally { $held.Dispose() }
Assert-UpdaterServices '{"Service":"app","State":"running","Health":"healthy"}
{"Service":"db","State":"running","Health":"healthy"}
{"Service":"proxy","State":"running","Health":""}'
Write-Host 'PASS: parallel execution blocked and Compose JSON-lines supported'
Write-Host 'All updater checks passed (no skipped checks).'
