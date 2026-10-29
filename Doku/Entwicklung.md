# Entwicklung und Architektur

## Lokalen Stack aus Quellcode bauen

Im Quellcode-Checkout ergänzt Compose automatisch `compose.override.yaml`: App und Setup verwenden das lokal gebaute Image `bsvp-billardmanager:local`. Bestehende Installationen benötigen weder neue Secrets noch eine neue `.env`. Wenn `.env` ausdrücklich `COMPOSE_FILE=compose.yaml` vorgibt, für den lokalen Build beide Dateien mit `-f compose.yaml -f compose.override.yaml` angeben.

```powershell
docker compose up -d --build --wait
docker compose ps
```

Nur für eine **frische** Quellcode-Installation vor dem Start:

```powershell
Copy-Item .env.example .env
docker compose --profile setup build
docker compose run --rm setup
```

Damit ist auch die Quellcode-Bereitstellung ohne lokal installiertes Node.js möglich. Für Entwicklung und Tests auf dem Host wird Node.js 24 benötigt. Bei einem Update aus Git im bisherigen Checkout zuerst die Datensicherung erstellen, dann `git pull --ff-only`, die Tests ausführen und den Stack wie oben neu bauen. Einen abweichenden Compose-Projektnamen beibehalten.

## Entwicklung und Tests

```powershell
npm ci
npm run setup # nur einmal, falls secrets/config.json noch fehlt
npm test
npm start
```

Die Anwendung benötigt PostgreSQL. Der lokale Compose-Stack stellt diesen Dienst ohne öffentlichen Datenbankport bereit. Für einen externen Entwicklungsserver `DATABASE_URL` mit Zugangsdaten setzen; im Compose-Stack liest `DATABASE_PASSWORD_CONFIG` die bestehende Sicherheitsdatei und leitet daraus das interne Passwort ab. `APP_ORIGIN`, `PORT`, `DATA_DIR` (nur Altbestand) und `CONFIG_FILE` bleiben konfigurierbar. Der PostgreSQL-Treiber `pg` wird mit `npm ci` aus der Lockdatei installiert. SQLite ist nur noch für Altbestandsübernahme und isolierte Kompatibilitätstests enthalten. Der Server startet ohne PostgreSQL-Konfiguration nicht versehentlich mit einer lokalen SQLite-Datei.

Die Tests prüfen Breakwechsel einschließlich Korrekturen, ungültige Punkte, vollständigen Spielablauf, Authentifizierung, CSRF/Origin, Tischisolation, doppelte Tischbelegung, konkurrierende Punkteingaben, Ergebnisabschluss, Persistenz nach Neustart und Login-Limit.

### Docker-Integrationstest auf Windows

Bei laufender Docker Desktop Engine kann der vollständige Stack separat geprüft werden:

```powershell
node scripts/docker-smoke.js
# Alternativ mit npm: npm run test:docker
```

Der Test baut das Image, prüft Ersteinrichtung und Wiederholschutz im Setup-Container und startet ein zufällig benanntes Compose-Projekt (`bsvp-smoke-…`) mit eigenen Secrets und Volumes auf `https://localhost:18443`. Port 18443 muss frei sein; alternativ `$env:DOCKER_TEST_PORT = '19443'` setzen. Compose muss `!override` unterstützen (Version 2.24.4 oder neuer).

Geprüft werden die echte TLS-Zertifikatskette über die temporäre Caddy-CA, Frontend-Assets, Secure-/HttpOnly-Cookies, CSRF-/Origin-Schutz, Tischrechte, Punkte, Wechselbreak, Versionskonflikte, Ergebnisabschluss sowie Datenpersistenz bei Neustart **und Ersetzen** des App-Containers. Zusätzlich prüft der Test UID 1000, Read-only-Rootfs, entfernte Capabilities, `no-new-privileges` und fehlende veröffentlichte App-Ports. Es werden keine Zertifikate in den Windows-Zertifikatsspeicher importiert und keine TLS-Prüfungen deaktiviert.

Nach dem Lauf werden ausschließlich die Container und Volumes dieses Testprojekts entfernt. Das gebaute Testimage bleibt als Build-Cache erhalten. Der lokale Bericht `data/docker-test-*/result.json`, temporäre Test-Secrets und das öffentliche CA-Zertifikat bleiben im von Git ausgeschlossenen Testordner; diese Zugangsdaten gelten nur für den bereits entfernten Teststack. Bei hartem Prozessabbruch kann dessen Compose-Projekt bestehen bleiben: dann das konkret ausgegebene Projekt gezielt über Docker Desktop aufräumen, niemals pauschal Produktionsvolumes löschen.

Der vollständige Docker-Test prüft auch Backup-Export/Import sowie eine vollständige SQLite-Übernahme und Wiederherstellung zwischen getrennten PostgreSQL-Datenbanken: Einstellungen, Logo, Farben, Hashes, Zeiten, Preise, Historie, neue Tabellen, fehlgeschlagene Migrationen und fehlerhafte Importe. Echte Tablets im Vereins-WLAN und die Zertifikatsinstallation auf den Geräten sind separat zu prüfen.

## Aktuelle Architektur

```text
Tablets / Adminbrowser ── HTTPS :443 ── Caddy ── App :3000 ── PostgreSQL :5432 ── postgres_data
```

Stand: 2026-10-29, logisches Datenschema **13** (`SCHEMA_VERSION` in `src/database.js`). PostgreSQL speichert den installierten Stand in `_schema`. Der Compose-Stack betreibt einen Node.js-24-App-Prozess und PostgreSQL 17; App und Datenbank haben keine öffentlich veröffentlichten Ports. Caddy stellt HTTPS bereit. Admin- und Tablet-Sitzungen liegen im App-Prozess und gehen bei einem Neustart verloren.

| Bereich | Einstiegspunkte und Verantwortung |
| --- | --- |
| Browser | `public/index.html`, `public/app.js`, `public/style.css`; `public/rental-pricing.js` für die Preisberechnung |
| HTTP und Sicherheit | `src/server.js`: Routen, Anmeldung, Sitzungen, CSRF/Origin und Rechte; `src/config.js`: Sicherheitskonfiguration |
| Spielbetrieb | `src/domain.js`, `src/tables.js`, `src/rentals.js`: Regeln, Tischbelegung und Vermietung |
| Veranstaltungen und Stammdaten | `src/players.js`, `src/schedule.js`, `src/league.js`, `src/tournaments.js`: Spieler/Mannschaften, Planung, Liga-Aufstellungen, Gruppen und KO |
| nuLiga | `src/nuliga.js` und `scripts/nuliga-sync.js`: externe Vereinsdaten und Synchronisierung |
| Persistenz | `src/database.js`: asynchroner PostgreSQL-Adapter, Initialisierung und Upgrades; `src/legacy-db.js`: SQLite-Altbestände und isolierte Kompatibilitätstests |
| Einstellungen und Sicherung | `src/branding.js`, `src/backup.js`: Vereinsgestaltung, vollständiger Export, Prüfung und Wiederherstellung |

SQL-Werte werden parametrisiert übergeben. Transaktionen nutzen eine feste Pool-Verbindung und eine gemeinsame transaktionale Advisory-Sperre für atomare Prüfungen und Änderungen, insbesondere bei Versionen und Tischbelegung. Das SQLite-Verfahren ist kein produktiver Ersatzbetrieb: Der Server benötigt PostgreSQL.

Das aktuelle Datenmodell umfasst Veranstaltungen und Partien mit Zeiten, Ergebnissen und PIN-Hashes, Änderungsprotokoll und ID-Zähler, Vermietungen und Preise, Admin-Hash, Vereinsgestaltung, Tischanzahl, Spieler/Mannschaften und historische Zuordnungen, nuLiga-Zuordnungen und Sync-Stände, Spieltagsplanung, Liga-Aufstellungen und Spieltagsgäste. Turniere speichern ihre Regeln, Auslosungen und Fortschritte in `event_planning.metadata` (Turnierformat 1) und verwenden reguläre `matches`; sie erfordern keine zusätzliche Schemaversion.

Exporte ermitteln alle Anwendungstabellen und Spalten aus dem installierten Schema; `_schema` ist technische Versionsverwaltung und nicht Teil der Nutzdaten. Das JSON-Sicherungsformat hat Version 1 und enthält die Schemaversion separat. PostgreSQL-Sicherungsprüfungen setzen Daten innerhalb eines Savepoints ein, prüfen Constraints und Fachregeln und verwerfen den Prüfzustand wieder. Die eigentliche Wiederherstellung erfolgt atomar einschließlich Audit-ID-Fortschreibung. Alle dauerhaften Einstellungen bleiben Bestandteil der Anwendungssicherung; Installation, externe Sicherheitskonfiguration und HTTPS-Schlüssel benötigen zusätzlich die [Betriebssicherung](Datensicherung.md).

Die Tischanzahl ist zwischen 1 und 20 einstellbar. Neue Belegungen müssen innerhalb dieser Grenze liegen; historische Tischzuordnungen bleiben bei einer Verringerung erhalten. Vermietungen verwenden den gespeicherten Grundpreis und einen Rabatt von 0 bis 100 Prozent.

Die [Migrationshistorie und Kompatibilität](Migrationen.md) beschreibt Schema 1–13, PostgreSQL-Upgrades, SQLite-Übernahme und ältere Sicherungen. Geplante Erweiterungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

## Lokale Ausgaben

`/output/` ist für lokale Screenshots, Rechercheausgaben und Bildvarianten reserviert und wird von Git ignoriert. Bestehende Dateien bleiben erhalten. Für veröffentlichte Dokumentationsbilder einen versionierten Ordner unter `Doku/` verwenden; Anwendungsbilder gehören nach `public/assets/`. Keine globalen Regeln wie `*.png` oder `*.json` hinzufügen. Test- und Buildlogs liegen weiterhin in einem eigenen Laufordner unter dem bereits ignorierten `data/`.

Referenzen: [Docker Desktop unter Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Compose-Secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

## Image-Betrieb ohne Build prüfen

Nach einem lokalen Build kann derselbe HTTPS-Integrationstest ausschließlich mit dem fertigen Image laufen:

```powershell
$env:DOCKER_TEST_IMAGE = 'bsvp-billardmanager:local'
npm run test:docker
Remove-Item Env:DOCKER_TEST_IMAGE
```

Dabei wird die Entwicklungsdatei nicht eingebunden und kein Image gebaut. Alternativ einen freigegebenen Registry-Tag setzen. Alle Testdaten, Setup-Dateien und Volumes bleiben im zufällig benannten Testprojekt.
