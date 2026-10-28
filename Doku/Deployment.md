# Deployment

## Fertige Images auf GitHub

Die GitHub Container Registry (GHCR) ist für dieses Repository geeignet. Der Workflow `.github/workflows/test.yml` prüft Änderungen einschließlich eines isolierten Docker-HTTPS-Tests. Erst danach veröffentlicht er bei Push auf `main` das Image `ghcr.io/akorb90/bsvp-billardmanager:latest` und zusätzlich `sha-<vollständige-Commit-SHA>`. Tags mit Präfix `v` veröffentlichen ihren eigenen Tag, ohne `latest` zu ändern. Ein manueller Lauf auf `main` ist ebenfalls möglich. Auf Arbeitsbranches und bei Pull Requests werden keine Images veröffentlicht.

Images werden für Linux amd64 (übliche PCs) und arm64 gebaut. Der Workflow nutzt das automatisch bereitgestellte `GITHUB_TOKEN` mit `packages: write`; zusätzliche Registry-Secrets auf dem Betriebsrechner sind für ein öffentliches Paket nicht erforderlich. OCI-Metadaten verknüpfen Image, Quellrepository und Commit. Das Installationspaket im Actions-Lauf enthält ausschließlich `compose.yaml`, `Caddyfile`, `.env.example`, README und Doku. Quellcode, lokale Konfiguration, Zugangsdaten und Volumes sind nicht enthalten.

**Einmalige Freigabe durch den Repository-Betreiber:** Nach Übernahme nach `main` den erfolgreichen Workflow prüfen. Unter GitHub → Packages → bsvp-billardmanager → Package settings die Sichtbarkeit prüfen und für anonyme Downloads auf **Public** setzen. Ein vorhandenes privates Paket muss zusätzlich dem Repository Actions-Zugriff erlauben. Anschließend von einem Rechner ohne Registry-Anmeldung `docker pull ghcr.io/akorb90/bsvp-billardmanager:latest` testen. Die lokale Implementierungsprüfung ersetzt diesen ersten echten Registry-Test nicht.

GitHub dokumentiert den [Publish-Workflow](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images) sowie [Sichtbarkeit und anonymen Download](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Ein privates Paket verlangt stattdessen eine Anmeldung mit Leserecht auf Packages; Tokens gehören niemals in Compose-Dateien oder Git.

## Neuinstallation und Image-Updates

Die Befehle stehen in der [Kurzanleitung](../README.md). Bei Verwendung des Quellcode-ZIPs immer `-f compose.yaml` angeben: Ohne diese Angabe ergänzt Docker automatisch `compose.override.yaml` für lokale Builds. Im Installationspaket fehlt diese Entwicklungsdatei absichtlich. Das entspricht den [Compose-Regeln für Overrides](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).

Der Setup-Dienst läuft nur bei explizitem Aufruf. Er erstellt die Sicherheitskonfiguration im eingebundenen `secrets`-Verzeichnis und übergibt sie unter Linux mit Dateimodus 0600 an UID/GID 1000 der App. Der kurzlebige Setup-Container hat kein Netzwerk; die App selbst läuft weiterhin ohne Root und liest die Datei schreibgeschützt. Vorhandene Konfigurationsdateien werden abgewiesen und niemals überschrieben. Unter Windows den Zugriff auf `secrets` zusätzlich über NTFS-Berechtigungen auf die betreuenden Administratoren begrenzen.

Bei `denied` oder `manifest unknown` zunächst die erfolgreiche Veröffentlichung, die öffentliche Sichtbarkeit und die Einstellung `BILLARD_IMAGE` prüfen. Ohne veröffentlichtes Image ist die [Bereitstellung aus Quellcode](Entwicklung.md#lokalen-stack-aus-quellcode-bauen) möglich.

## Bestehende Installation umstellen

1. Vollständige [Anwendungssicherung und zusätzliche Betriebssicherung](Datensicherung.md) erstellen. Den bisherigen Compose-Projektnamen mit `docker compose ls` bzw. `docker compose ps` feststellen.
2. Im **gleichen Installationsordner** bleiben. `compose.yaml` und `Caddyfile` aus dem freigegebenen Paket prüfen und übernehmen; `.env`, `secrets` und vorhandene Volumes beibehalten. Keine Setup-Ausführung und kein Kopieren von `.env.example` über `.env`.
3. Mit `docker compose -f compose.yaml pull` und `docker compose -f compose.yaml up -d --wait` auf das Image wechseln. Die bisherigen Dienst-, Netzwerk- und Volumennamen bleiben unverändert.
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
