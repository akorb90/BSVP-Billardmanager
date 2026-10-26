# BSVP Billardmanager · Draft 0.1

Lokale Webanwendung für einen Billardverein in Bayern. Node.js 24 LTS, SQLite und Caddy; keine externen JavaScript-Pakete, CDNs oder Cloud-Dienste. Die Oberfläche ist deutsch und für Tablets ausgelegt.

## Funktionsumfang

- Liga-Spieltage und Turniere mit Name und Datum anlegen.
- Begegnungen manuell planen: zwei Spieler, 8-/9-/10-Ball, Gewinnspiele und erstes Break.
- Begegnungen einem von acht freien Tischen zuweisen; Doppelbelegung wird verhindert.
- Feste Kiosk-Endpunkte `/tisch/1` bis `/tisch/8`, Punkte +/−, Wechselbreak und automatische Aktualisierung alle drei Sekunden.
- Ergebnisse nach Erreichen des Spielziels durch die Verwaltung bestätigen. Danach wird der Tisch frei; das Ergebnis bleibt erhalten.
- SQLite speichert Veranstaltungen, Begegnungen, Ergebnisse und ein Änderungsprotokoll. Gleichzeitige Eingaben werden mit Versionsprüfung und Transaktionen geschützt.

**Bewusste Draft-Grenzen:** keine automatische Turnierauslosung, Gruppen-/KO-Bäume, Liga-Mannschaftswertung, Spieler-Stammdaten oder Verbandsregelwerke. Jedes gewonnene Rack zählt einen Punkt. Kein 14/1 oder Karambol. Kein Offline-Schreiben: bei Verbindungsverlust bleiben Änderungen gesperrt. Abgeschlossene Ergebnisse sind unveränderlich. Tischgebühren kommen als Feature 1 später hinzu. Es gibt zunächst ein gemeinsames Administratorkonto; personenbezogene Admin-Auditierung benötigt später individuelle Konten.

## Schnellstart auf dem Windows-Laptop

Voraussetzung: Node.js 24 LTS und Docker Desktop mit **Linux-Containern** (WSL 2). PowerShell im Repository öffnen:

```powershell
npm run setup
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

`setup` erzeugt ein zufälliges Admin-Passwort und acht Tischschlüssel. Das Passwort wird einmal ausgegeben: im Passwortmanager speichern. `secrets/config.json` wird niemals überschrieben. Diese Datei und `.env` sind von Git und Docker-Build-Kontext ausgeschlossen. Unter Windows den Zugriff auf `secrets` über NTFS-Berechtigungen auf die betreuenden Administratoren begrenzen; `mode: 0600` allein setzt dort keine verlässlichen ACLs.

Standardmäßig ist ausschließlich `https://localhost` erreichbar. Caddy erstellt eine interne Zertifizierungsstelle. Deren Stammzertifikat muss vor Browsernutzung als vertrauenswürdig installiert werden:

```powershell
docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./secrets/billard-root.crt
```

Nur das öffentliche `root.crt` verteilen, niemals den CA-Privatschlüssel oder das gesamte Caddy-Volume. Die Zertifikatswarnung nicht dauerhaft umgehen.

### Tablets im Vereins-WLAN

1. Dem Laptop eine feste IP / DHCP-Reservierung geben, beispielsweise `192.168.178.50`.
2. In `.env` `BILLARD_HOST=192.168.178.50` und `BIND_IP=0.0.0.0` setzen; anschließend `docker compose up -d` ausführen. Der Origin ist dann exakt `https://192.168.178.50`.
3. Windows-Firewall: TCP 443 ausschließlich im privaten Vereinsnetz freigeben. Keine Router-Portweiterleitung. Den Laptop im Spielbetrieb am Strom lassen und Energiesparen deaktivieren.
4. Das öffentliche CA-Stammzertifikat auf Laptop und Tablets installieren und im jeweiligen Betriebssystem für TLS aktiv vertrauen. Das ist eine einmalige Sicherheitsvorbereitung; die eigentliche Tischzuordnung erfolgt allein über die Kiosk-Adresse.
5. Die Kiosk-Startadresse pro Gerät eintragen: `https://192.168.178.50/tisch/1#key=TISCHSCHLUESSEL`. Für Tisch 1 ist das der erste Eintrag in `tables` in `secrets/config.json`, für Tisch 8 der achte.

Der Schlüssel steht im URL-Fragment, wird vom Browser **nicht** an Webserver/Access-Logs geschickt und nach dem Laden aus der sichtbaren URL entfernt. Er wird im tabgebundenen `sessionStorage` gespeichert und als Authorization-Header übertragen. Der Kiosk-Launcher muss beim Neustart wieder die vollständige Startadresse mit Fragment aufrufen. Wer einen Tischschlüssel kennt, kann ausschließlich diesen Tisch lesen und dessen laufende Partie zählen. Verwaltungsrechte erhält er nicht. Startadressen vertraulich behandeln. Die Eingabe der Kiosk-Adresse ist die Tischvorbereitung; eine zusätzliche Tischwahl oder Anmeldung am Tablet entfällt.

Ohne Schlüssel kann ein angemeldeter Administrator dieselben Tischseiten öffnen. Der Adminzugang ist `/` bzw. `/admin`. Alle benötigten Assets werden lokal ausgeliefert.

## Entwicklung und Tests

```powershell
npm run setup # nur einmal, falls secrets/config.json noch fehlt
npm test
npm start
```

Danach `http://localhost:3000` öffnen. Dieser HTTP-Modus dient nur der Entwicklung auf dem Laptop. Produktiv stets den HTTPS-Stack nutzen. `APP_ORIGIN`, `PORT`, `DATA_DIR` und `CONFIG_FILE` sind konfigurierbar. Node 24 kann für das eingebaute SQLite-Modul einen Experimental-Hinweis ausgeben. Der Server setzt keine Pakete aus npm voraus.

Die Tests prüfen Breakwechsel einschließlich Korrekturen, ungültige Punkte, vollständigen Spielablauf, Authentifizierung, CSRF/Origin, Tischisolation, doppelte Tischbelegung, konkurrierende Punkteingaben, Ergebnisabschluss, Persistenz nach Neustart und Login-Limit.

## Sicherheit und Betrieb

- Admin-Passwort nur als scrypt-Hash mit zufälligem Salt. Zufällige Sitzungstoken, HttpOnly-/SameSite=Strict-Cookies und unter HTTPS Secure-Cookies; Sitzungen laufen nach acht Stunden ab und verschwinden bei Neustart.
- Origin-Prüfung für alle Schreibzugriffe und zusätzlicher CSRF-Token für Admin-Sitzungen. Kein CORS. Parametrisierte SQL-Anweisungen, Eingabevalidierung, Request-Größenlimit, CSP und HTML-Escaping.
- Nach zehn Anmeldeversuchen pro Quelladresse für 15 Minuten gesperrt. Hinter Caddy wird absichtlich dessen Adresse verwendet: damit gilt ein gemeinsames Login-Limit für das ganze Vereinsnetz. Ein Angreifer im Netz kann dadurch vorübergehend Admin-Anmeldungen blockieren. Tischbetrieb bleibt unabhängig davon. Nur ein App-Prozess; Sitzungen und Limits sind im Speicher.
- App läuft ohne Root, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities und ohne veröffentlichten App-/DB-Port. SQLite befindet sich ausschließlich im Datenvolume.
- Compose-Secrets werden dateibasiert eingebunden. Sie sind kein verschlüsselter Tresor. Windows-Gerät/Backups mit BitLocker schützen und Zugriffsrechte pflegen.
- Images sind auf Hauptversionen begrenzt. Vor produktiver Freigabe aktuelle Patchstände prüfen, Image-Digests pinnen und regelmäßig Updates/Scans durchführen. `docker compose build --pull` und `docker compose pull proxy` aktualisieren Images; anschließend neu starten und testen.
- Schlüsselwechsel: betreffenden `tables`-Wert in `secrets/config.json` durch mindestens 32 kryptographisch zufällige Zeichen ersetzen, `docker compose restart app`, nur die betroffene Kiosk-Adresse aktualisieren. Admin-Passwortwechsel über neues Salt/scrypt-Hash in derselben Konfiguration; niemals Klartext als `adminHash` eintragen.
- SQLite-Daten und Auditprotokoll enthalten Spielernamen. Aufbewahrungs-/Löschfristen des Vereins festlegen. Es gibt noch keine UI für Export oder Löschung.

## Sicherung und Wiederherstellung

Für den Draft ein kurzes Wartungsfenster nutzen; die App muss während Kopieren und Wiederherstellen gestoppt bleiben. Die SQLite-Hauptdatei **und** vorhandene WAL-/SHM-Dateien zusammen sichern, am einfachsten das gesamte `/data`-Verzeichnis:

```powershell
docker compose stop app
New-Item -ItemType Directory -Force backups
docker compose cp app:/data ./backups/data
docker compose start app
```

Einen neuen, datierten Backup-Ordner pro Sicherung verwenden; `backups/` ist von Git ausgeschlossen. Zusätzlich `secrets/config.json`, `.env` und die Caddy-Volumes verschlüsselt sichern. Die Caddy-CA muss für weiterhin vertraute Tablet-Zertifikate erhalten bleiben.

Restore in eine frische Installation mit zuvor geprüfter Sicherung: Stack erstellen, App stoppen, Datenbankdateien aus dem gesicherten Datenverzeichnis in `/data` des App-Containers kopieren (`docker compose cp <Backup-Datei> app:/data/<Dateiname>`), Dateieigentümer bei Bedarf auf UID/GID 1000 korrigieren und App starten. Nicht mit alten WAL-Dateien einer anderen Sicherung mischen. Anschließend gespeicherte Ergebnisse und Kiosk-Zugriff prüfen. Diesen Restore-Ablauf vor dem ersten echten Spieltag testen.

`docker compose down` erhält Volumes. **`docker compose down -v` löscht Datenbank und CA dauerhaft.**

## Architektur und nächste Schritte

```text
Tablets / Adminbrowser ── HTTPS :443 ── Caddy ── App :3000 ── SQLite-Volume
```

Der Draft startet ein Schema der Version 1 (`PRAGMA user_version`). Für spätere Schemaänderungen sind explizite Migrationen vor Rollout vorzusehen. SQLite passt zu acht Tischen und einem App-Prozess; bei Mehrprozess-/Mehrstandortbetrieb auf PostgreSQL migrieren. Die Tisch-ID ist bereits auf 1–8 begrenzt und kann später mit gebührenpflichtigen Tischbelegungen verknüpft werden.

Nächste fachliche Entscheidungen: konkrete bayerische Liga-/Mannschaftsregeln, Turniermodus (Gruppen/Einfach-/Doppel-KO), Spielerregister sowie Berechtigungen für Schiedsrichter und Vereinsverwaltung.

Referenzen: [Docker Desktop unter Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Compose-Secrets](https://docs.docker.com/compose/how-tos/use-secrets/).
