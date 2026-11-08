# Deployment

## Fertige Images auf GitHub

Die GitHub Container Registry (GHCR) ist für dieses Repository geeignet. Der Workflow `.github/workflows/test.yml` prüft Änderungen einschließlich eines isolierten Docker-HTTPS-Tests. Erst danach veröffentlicht er bei Push auf `main` das Image `ghcr.io/akorb90/bsvp-billardmanager:latest` und zusätzlich `sha-<vollständige-Commit-SHA>`. Tags mit Präfix `v` veröffentlichen ihren eigenen Tag, ohne `latest` zu ändern. Ein manueller Lauf auf `main` ist ebenfalls möglich. Der freigegebene Testbranch `codex/fr-010-deployment-doku` veröffentlicht ausschließlich `latest-TEST` und `sha-<vollständige-Commit-SHA>-TEST`. Auf anderen Arbeitsbranches und bei Pull Requests werden keine Images veröffentlicht. Eine zusätzliche Prüfung lädt das veröffentlichte Image auf einem frischen Runner ohne Registry-Anmeldung und führt den vollständigen HTTPS-Integrationstest damit aus.

Images werden für Linux amd64 (übliche PCs) und arm64 gebaut. Der Workflow nutzt das automatisch bereitgestellte `GITHUB_TOKEN` mit `packages: write`; zusätzliche Registry-Secrets auf dem Betriebsrechner sind für ein öffentliches Paket nicht erforderlich. OCI-Metadaten verknüpfen Image, Quellrepository und Commit. Das Installationspaket im Actions-Lauf enthält ausschließlich `compose.yaml`, `Caddyfile`, `.env.example`, README, Updater.ps1, Updater.cmd und Doku. Quellcode, lokale Konfiguration, Zugangsdaten und Volumes sind nicht enthalten.

**Einmalige Freigabe durch den Repository-Betreiber:** Nach Übernahme nach `main` den erfolgreichen Workflow prüfen. Unter GitHub → Packages → bsvp-billardmanager → Package settings die Sichtbarkeit prüfen und für anonyme Downloads auf **Public** setzen. Ein vorhandenes privates Paket muss zusätzlich dem Repository Actions-Zugriff erlauben. Anschließend von einem Rechner ohne Registry-Anmeldung `docker pull ghcr.io/akorb90/bsvp-billardmanager:latest` testen. Die lokale Implementierungsprüfung ersetzt diesen ersten echten Registry-Test nicht.

GitHub dokumentiert den [Publish-Workflow](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) sowie [Sichtbarkeit und anonymen Download](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Ein privates Paket verlangt stattdessen eine Anmeldung mit Leserecht auf Packages; Tokens gehören niemals in Compose-Dateien oder Git.

## Neuinstallation und Image-Updates

Die Befehle stehen in der [Kurzanleitung](../README.md). Bei Verwendung des Quellcode-ZIPs immer `-f compose.yaml` angeben: Ohne diese Angabe ergänzt Docker automatisch `compose.override.yaml` für lokale Builds. Im Installationspaket fehlt diese Entwicklungsdatei absichtlich. Das entspricht den [Compose-Regeln für Overrides](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).

Der Setup-Dienst läuft nur bei explizitem Aufruf. Er erstellt die Sicherheitskonfiguration im eingebundenen `secrets`-Verzeichnis und übergibt sie unter Linux mit Dateimodus 0600 an UID/GID 1000 der App. Der kurzlebige Setup-Container hat kein Netzwerk; die App selbst läuft weiterhin ohne Root und liest die Datei schreibgeschützt. Vorhandene Konfigurationsdateien werden abgewiesen und niemals überschrieben. Unter Windows den Zugriff auf `secrets` zusätzlich über NTFS-Berechtigungen auf die betreuenden Administratoren begrenzen.

Bei `denied` oder `manifest unknown` zunächst die erfolgreiche Veröffentlichung, die öffentliche Sichtbarkeit und die Einstellung `BILLARD_IMAGE` prüfen. Ohne veröffentlichtes Image ist die [Bereitstellung aus Quellcode](Entwicklung.md#lokalen-stack-aus-quellcode-bauen) möglich.

## PostgreSQL-Umstellung (FR-012)

Die aktualisierte `compose.yaml` ist zwingend erforderlich: Sie ergänzt PostgreSQL 17 als Dienst `db`, ein internes Datenbanknetz, Healthcheck und das Volume `postgres_data`. Es wird kein Datenbankport veröffentlicht. App und Datenbank verwenden den SHA-256 der unveränderten vorhandenen `secrets/config.json` als internen Datenbankzugang; keine neuen Zugangsdaten erzeugen und die Datei nicht neu formatieren. Der Benutzerzugang bleibt unverändert. Leere Datenbanken werden direkt aus `src/schema.sql` initialisiert; bestehende PostgreSQL-Datenbanken werden transaktional aktualisiert. Eine automatische Übernahme alter Datenbankdateien findet nicht mehr statt. Vorher die [vollständige Sicherung einschließlich Rückkehrstand](Datensicherung.md) erstellen. Bestehende `.env`, Projektzuordnung, Sicherheitsdatei und Daten-/Caddy-Volumes erhalten.

## Bestehende Installation umstellen

1. Vollständige [Anwendungssicherung und zusätzliche Betriebssicherung](Datensicherung.md) erstellen. Den bisherigen Compose-Projektnamen mit `docker compose ls` bzw. `docker compose ps` feststellen.
2. Im **gleichen Installationsordner** bleiben. `compose.yaml` und `Caddyfile` aus dem freigegebenen Paket prüfen und übernehmen; `.env`, `secrets` und vorhandene Volumes beibehalten. Keine Setup-Ausführung und kein Kopieren von `.env.example` über `.env`.
3. Mit `docker compose -f compose.yaml pull` und `docker compose -f compose.yaml up -d --wait` auf das Image wechseln. Bestehende Dienst-, Netzwerk- und Volumennamen bleiben erhalten; PostgreSQL ergänzt einen Dienst, ein Netzwerk und ein Volume.
4. `docker compose -f compose.yaml ps`, HTTPS `/health`, Anmeldung und vorhandene Daten prüfen. Der Stack bleibt aktiv.

Ein anderer Ordner oder Compose-Projektname kann neue, leere Volumes erzeugen. Falls der ursprüngliche Betrieb mit `-p` oder `COMPOSE_PROJECT_NAME` erfolgte, diesen Namen weiterhin verwenden. Bestehende lokale `COMPOSE_FILE`-/Image-Anpassungen vor dem Wechsel prüfen. Ein leeres System nach dem Umstieg ist ein Grund, die Projektzuordnung zu prüfen und die bisherigen Volumes wieder einzubinden.

## Feste Version und Rückkehr

In `.env` lässt sich die Version festlegen:

```dotenv
BILLARD_IMAGE=ghcr.io/akorb90/bsvp-billardmanager:sha-<vollständige-Commit-SHA>
```

Alternativ ist ein veröffentlichtes `v…`-Tag oder `ghcr.io/akorb90/bsvp-billardmanager@sha256:<Digest>` möglich. `latest` folgt erfolgreichen Veröffentlichungen von `main`. Vor einem Update die bisherige Image-ID bzw. den Digest mit `docker compose -f compose.yaml images` und `docker image inspect <Image-ID>` dokumentieren.

Für eine Rückkehr `BILLARD_IMAGE` auf die bekannte Version setzen und wieder `pull` sowie `up -d --wait` ausführen. Hat die neue App das Datenbankschema migriert, darf eine ältere App nicht gegen diese Datenbank starten: passende vorherige Datenbanksicherung gemäß [Betriebsanleitung](Datensicherung.md) zusammen mit der alten App wiederherstellen. Keine Volumes löschen und keine Testdaten einspielen.

## Installationsdateien und Proxy aktualisieren

Image-Updates ändern weder `.env` noch den lokal eingebundenen `Caddyfile`. Wenn die Release Notes eine Änderung der Installationsdateien verlangen, diese gezielt vergleichen und eigene Host-/Firewall-Einstellungen erhalten. Bei geändertem `Caddyfile` nach `up` zusätzlich ausführen:

```powershell
docker compose -f compose.yaml exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Die zusätzliche Sicherung von Installationsdateien, externer Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt erforderlich und ersetzt nie den vollständigen Anwendungs-Export.

## Testveröffentlichung vor main

Ein Push auf `codex/fr-010-deployment-doku` durchläuft dieselben Tests und denselben Multiarch-Build wie `main`, veröffentlicht jedoch die Tags mit Suffix `-TEST`. Das produktive `latest` wird dabei nicht verändert. Für einen getrennten Testbetrieb `BILLARD_IMAGE=ghcr.io/akorb90/bsvp-billardmanager:latest-TEST` setzen oder den Integrationstest mit `DOCKER_TEST_IMAGE` aufrufen. Die Testversion nicht gegen Produktionsdaten starten.


## Automatischer Updater

Im bestehenden Projekt-/Installationsordner unter Windows Updater.cmd doppelklicken oder `.\Updater.ps1` in PowerShell ausführen. Der Launcher verwendet Windows PowerShell 5.1 und setzt die Ausführungsrichtlinie ausschließlich für diesen Prozess; systemweite Einstellungen werden nicht geändert. PowerShell 7 kann das Skript ebenfalls ausführen. Docker Desktop muss laufen; im Quellcodebetrieb muss Git vorhanden sein. curl wird für die Prüfung mit eigener CA benötigt (auf aktuellen Windows-Systemen als curl.exe vorhanden).

Auto-Modus: Ist .git vorhanden, verlangt das Skript main und einen sauberen Arbeitsstand einschließlich unversionierter Dateien. Es lädt origin/main, verweigert lokale Zusatzcommits oder auseinander gelaufene Historien und übernimmt ausschließlich per Fast-forward. Anschließend zieht es Datenbank-/Proxy-Images und baut app mit aktualisiertem Basisimage. compose.yaml und compose.override.yaml werden ausdrücklich angegeben, auch bei COMPOSE_FILE=compose.yaml in .env. Ohne .git zieht es app, db und proxy aus compose.yaml und startet ohne lokalen Build. BILLARD_IMAGE wird respektiert: latest erhält die neueste veröffentlichte Fassung; feste Tags/Digests bleiben fest. `-Mode Image` erzwingt Imagebetrieb auch im Checkout; `-Mode Source` verlangt einen geeigneten Git-Checkout.

Der vorhandene Compose-Projektname wird aus der wirksamen Konfiguration übernommen. Falls der Stack ursprünglich mit einem eigenen -p gestartet wurde, `.\Updater.ps1 -ProjectName meinprojekt` verwenden. Vor jeder Änderung müssen app, db und proxy im gewählten Projekt bereits laufen; bei falscher Zuordnung wird kein leerer Ersatzstack erstellt. Parallele Updater sind gesperrt. .env, secrets/config.json und vorhandene Volumes werden weder erzeugt noch ersetzt; Setup, reset, stash, down und Volume-Löschung gehören nicht zum Ablauf.

Vor Übernahme und Deployment erstellt das Skript einen vollständigen PostgreSQL-Custom-Dump unter backups/updater-<Zeitpunkt>-<ID>/billard.dump. Dort liegen auch vorherige Compose-/Caddy-Dateien, Projektname und bisherige Container-/Image-IDs. Fehlgeschlagene oder leere Sicherungen verhindern das Update. Alle Befehle und Fehler werden unter data/updater-<Zeitpunkt>-<ID>/update.log protokolliert; aufgelöste Compose-Konfigurationen mit möglichen Umgebungswerten werden nicht ausgeschrieben. Die lokale Sicherung enthält vertrauliche Anwendungsdaten und ist entsprechend zu schützen. Die zusätzliche externe, verschlüsselte Betriebssicherung von .env, Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt gemäß [Datensicherung](Datensicherung.md) erforderlich; der Dump ersetzt diese nicht.

Nach dem Start mit --wait wird Caddy neu geladen. Der Updater prüft Container und https://<BILLARD_HOST>/health über Loopback mit der bestehenden Caddy-CA, inklusive Hostnamenprüfung. Unterstützt werden der dokumentierte HTTPS-Port 443 und DNS-/IPv4-Hosts. Bei einem Fehler endet das Skript mit Exitcode 1 und Logpfad; der Launcher hält das Fenster offen. Bereits ausgeführte Schritte bleiben erhalten. Es erfolgt kein automatisches Schema-/Image-Rollback: dazu den zuvor gesicherten Stand gemäß der Rückkehranleitung verwenden. Bei Erfolg bleibt der Stack aktiv. Nach einem App-Neustart erneut anmelden und fachlich prüfen.

Im Imagebetrieb aktualisiert der Updater die Images. Neue Installationsdateien müssen weiterhin aus dem freigegebenen Paket übernommen werden, wenn die Release Notes dies verlangen. Im Git-Betrieb kommen diese Dateien mit dem Fast-forward; das Skript lädt Caddy anschließend ausdrücklich neu.
