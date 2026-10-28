# Entwicklung und Architektur

## Lokalen Stack aus Quellcode bauen

Im Quellcode-Checkout ergänzt Compose automatisch `compose.override.yaml`: App und Setup verwenden das lokal gebaute Image `bsvp-billardmanager:local`. Bestehende Installationen benötigen weder neue Secrets noch eine neue `.env`.

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
npm run setup # nur einmal, falls secrets/config.json noch fehlt
npm test
npm start
```

Danach `http://localhost:3000` öffnen. Dieser HTTP-Modus dient nur der Entwicklung auf dem Laptop. Produktiv stets den HTTPS-Stack nutzen. `APP_ORIGIN`, `PORT`, `DATA_DIR` und `CONFIG_FILE` sind konfigurierbar. Node 24 kann für das eingebaute SQLite-Modul einen Experimental-Hinweis ausgeben. Der Server setzt keine Pakete aus npm voraus.

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

Der vollständige Docker-Test prüft auch Backup-Export/Import. Echte Tablets im Vereins-WLAN und die Zertifikatsinstallation auf den Geräten sind separat zu prüfen.

## Architektur und nächste Schritte

```text
Tablets / Adminbrowser ── HTTPS :443 ── Caddy ── App :3000 ── SQLite-Volume
```

Das Schema verwendet Version 8 (`PRAGMA user_version`). Version 8 erweitert die Tischgrenzen für Partien und Vermietungen auf 20 und ergänzt die versionierte Tischanzahl (Standard 8). Die transaktionale Migration übernimmt sämtliche Zeilen und Belegungsindizes. Exporte enthalten automatisch alle Anwendungstabellen einschließlich `table_settings`; Importe prüfen auch, dass laufende Vorgänge innerhalb der eingestellten Tischanzahl liegen. Sicherungen aus Schema 6/7 werden beim Import ergänzt. Version 7 ergänzt Vereinsname, Logo und Farben. Version 5 ergänzt Tischvermietungen und Grundpreis. Version 6 übernimmt den vorhandenen Admin-Hash einmalig aus der Konfiguration in die Datenbank; spätere Konfigurationsänderungen überschreiben das Passwort nicht. Eine Wiederherstellung der Datenbank stellt auch den damaligen Passwortstand wieder her. Die Migration von Version 2 ergänzt PIN-Hashes, eine Berechtigungsrevision und persistente PIN-Versuchslimits. Bestehende Partien erhalten keine automatische PIN; diese wird bei Bedarf im Adminbereich nachgetragen. Eine transaktionale Migration übernimmt bestehende Version-1-Daten: Veranstaltungen erhalten den Status `open` und eine Versionsnummer, Spieler und Ergebnisse bleiben unverändert. ID-Zähler verhindern, dass nach dem Löschen alte IDs wiederverwendet werden. Vor Migrationen eine konsistente Sicherung erstellen. Ältere App-Versionen dürfen nicht gegen das migrierte Schema gestartet werden; für einen Rollback passende App-Version und Datenbank-Backup zusammen wiederherstellen. SQLite passt zu bis zu 20 Tischen und einem App-Prozess; bei Mehrprozess-/Mehrstandortbetrieb auf PostgreSQL migrieren. Die Tisch-ID ist auf 1–20 begrenzt. Neue Belegungen sind nur bis zur eingestellten Tischanzahl zulässig; historische Zuordnungen bleiben bei einer Verringerung erhalten. Vermietungen rechnen mit dem Grundpreis abzüglich eines Rabatts von 0 bis 100 %; der Grundpreis wird unter „Einstellungen“ verwaltet.

Geplante Erweiterungen und ihre Anforderungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

Referenzen: [Docker Desktop unter Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Compose-Secrets](https://docs.docker.com/compose/how-tos/use-secrets/).

## Image-Betrieb ohne Build prüfen

Nach einem lokalen Build kann derselbe HTTPS-Integrationstest ausschließlich mit dem fertigen Image laufen:

```powershell
$env:DOCKER_TEST_IMAGE = 'bsvp-billardmanager:local'
npm run test:docker
Remove-Item Env:DOCKER_TEST_IMAGE
```

Dabei wird die Entwicklungsdatei nicht eingebunden und kein Image gebaut. Alternativ einen freigegebenen Registry-Tag setzen. Alle Testdaten, Setup-Dateien und Volumes bleiben im zufällig benannten Testprojekt.
