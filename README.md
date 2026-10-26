# BSVP Billardmanager · Draft 0.1

Lokale Webanwendung für einen Billardverein in Bayern. Node.js 24 LTS, SQLite und Caddy; keine externen JavaScript-Pakete, CDNs oder Cloud-Dienste. Die Oberfläche ist deutsch und für Tablets ausgelegt.

## Funktionsumfang

- Liga-Spieltage und Turniere mit Name und Datum anlegen.
- Begegnungen manuell planen: zwei Spieler, 8-/9-/10-Ball, Gewinnspiele und erstes Break.
- Begegnungen einem von acht freien Tischen zuweisen; Doppelbelegung wird verhindert.
- Feste Kiosk-Endpunkte `/tisch/1` bis `/tisch/8`, Punkte +/−, Wechselbreak und automatische Aktualisierung alle drei Sekunden.
- Ergebnisse nach Erreichen des Spielziels zentral oder direkt am zugeordneten Tablet bestätigen. Danach wird der Tisch frei; das Ergebnis bleibt erhalten.
- Obere Adminnavigation: Tischübersicht, Spieltagsverwaltung, Punkteübersicht und Ergebnisse. Die Punkteübersicht zeigt laufende Partien; abgeschlossene Partien erscheinen im Ergebnisarchiv.
- SQLite speichert Veranstaltungen, Begegnungen, Ergebnisse und ein Änderungsprotokoll. Gleichzeitige Eingaben werden mit Versionsprüfung und Transaktionen geschützt.

**Bewusste Draft-Grenzen:** keine automatische Turnierauslosung, Gruppen-/KO-Bäume, Liga-Mannschaftswertung, Spieler-Stammdaten oder Verbandsregelwerke. Jedes gewonnene Rack zählt einen Punkt. Kein 14/1 oder Karambol. Kein Offline-Schreiben: bei Verbindungsverlust bleiben Änderungen gesperrt. Ergebnisse bleiben für Administratoren bis zum Gesamtabschluss der Veranstaltung korrigierbar; danach sind sie gesperrt. Tischgebühren kommen als Feature 1 später hinzu. Es gibt zunächst ein gemeinsames Administratorkonto; personenbezogene Admin-Auditierung benötigt später individuelle Konten.

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

### Spiel abschließen

In der zentralen Tisch-/Punkteübersicht sowie direkt am Tablet ist die Schaltfläche **Spiel abschließen** sichtbar. Sie wird aktiv, sobald ein Spieler das konfigurierte Spielziel erreicht. Im Dialog den Endstand prüfen und **Ergebnis speichern** wählen; **Zurück zur Partie** lässt den Stand unverändert und ermöglicht weitere Korrekturen. Der Partienabschluss wird im Auditprotokoll dem Administrator oder der Tisch-ID zugeordnet und gibt den Tisch für die nächste Begegnung frei. Die Verwaltung kann die Partie bis zum Gesamtabschluss der Veranstaltung weiter bearbeiten oder löschen. Das Tablet wechselt automatisch zur Warteanzeige. Gleichzeitige Abschlüsse oder zwischenzeitliche Punktänderungen werden durch Versionsprüfung abgefangen. Ein vorzeitiger Abbruch unterhalb des Spielziels ist weiterhin nicht vorgesehen.

Die Spieltagsverwaltung ist direkt über `/#spieltage`, die Punkteübersicht über `/#punkte` und das Archiv über `/#ergebnisse` erreichbar. Formulareingaben bleiben beim Menüwechsel innerhalb der Seite erhalten; sie werden erst beim erfolgreichen Speichern zurückgesetzt und nicht über einen Browser-Neustart gespeichert.

### Veranstaltungen bearbeiten, löschen und endgültig abschließen

Unter **Spieltagsverwaltung** gibt es pro offener Veranstaltung **Veranstaltung bearbeiten**, **Veranstaltung löschen** und **Veranstaltung abschließen**. Bei sämtlichen Partien erscheinen bis zum Gesamtabschluss **Partie bearbeiten** und **Partie löschen**, auch bei bereits beendeten Partien im Ergebnisarchiv.

Bearbeitbar sind Veranstaltungsname, Format und Datum sowie bei Partien Spieler, Veranstaltungszuordnung, Disziplin, Ziel, erstes Break, Punktestand, Status und Tisch. Eine beendete Partie kann durch Status **Am Tisch** und Zuweisung eines freien Tisches wieder aufgenommen werden. Geplante Partien benötigen 0:0 und keinen Tisch; beendete Partien genau einen Spieler am Spielziel. Doppelbelegung und ungültige Ergebnisse werden serverseitig abgewiesen.

Der Gesamtabschluss ist nur möglich, wenn alle verbliebenen Partien beendet sind (auch eine leere Veranstaltung darf abgeschlossen werden). Danach sind neue Partien, Korrekturen, Löschen und Wiederaufnahme für diese Veranstaltung gesperrt; es gibt keine Wiederöffnung. Eine Löschung entfernt bei Veranstaltungen auch deren sämtliche Partien und gibt belegte Tische frei. Beide Aktionen benötigen einen ausdrücklichen Bestätigungsdialog. Löschungen sind in der Oberfläche nicht rückgängig zu machen; das interne Auditprotokoll enthält weiterhin die vorherigen Datenstände und dient nicht als Löschfunktion für personenbezogene Daten.

Jede Partienänderung erhöht auch die Veranstaltungsversion. Ein Gesamtabschluss oder Löschen mit inzwischen veralteten Daten wird abgewiesen. Tablets dürfen weiterhin nur Punkte zählen und ihre eigene laufende Partie abschließen; administrative Korrekturen und Löschungen sind ausschließlich über die Admin-Sitzung möglich.

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

Der Test baut das Image und startet ein zufällig benanntes Compose-Projekt (`bsvp-smoke-…`) mit eigenen Secrets und Volumes auf `https://localhost:18443`. Port 18443 muss frei sein; alternativ `$env:DOCKER_TEST_PORT = '19443'` setzen. Compose muss `!override` unterstützen (Version 2.24.4 oder neuer).

Geprüft werden die echte TLS-Zertifikatskette über die temporäre Caddy-CA, Frontend-Assets, Secure-/HttpOnly-Cookies, CSRF-/Origin-Schutz, Tischrechte, Punkte, Wechselbreak, Versionskonflikte, Ergebnisabschluss sowie Datenpersistenz bei Neustart **und Ersetzen** des App-Containers. Zusätzlich prüft der Test UID 1000, Read-only-Rootfs, entfernte Capabilities, `no-new-privileges` und fehlende veröffentlichte App-Ports. Es werden keine Zertifikate in den Windows-Zertifikatsspeicher importiert und keine TLS-Prüfungen deaktiviert.

Nach dem Lauf werden ausschließlich die Container und Volumes dieses Testprojekts entfernt. Das gebaute Testimage bleibt als Build-Cache erhalten. Der lokale Bericht `data/docker-test-*/result.json`, temporäre Test-Secrets und das öffentliche CA-Zertifikat bleiben im von Git ausgeschlossenen Testordner; diese Zugangsdaten gelten nur für den bereits entfernten Teststack. Bei hartem Prozessabbruch kann dessen Compose-Projekt bestehen bleiben: dann das konkret ausgegebene Projekt gezielt über Docker Desktop aufräumen, niemals pauschal Produktionsvolumes löschen.

**Verifiziert am 26.10.2026:** vollständiger Docker-Test auf Docker Desktop / Engine 29.7.2 erfolgreich. Echte Tablets im Vereins-WLAN, Zertifikatsinstallation auf den Geräten und Backup-Restore sind noch separat zu prüfen.

## Sicherheit und Betrieb

### Dauerhaft aktive lokale Prüfinstanz

Der Stack wird mit `docker compose up -d --build --wait` gestartet und bleibt anschließend aktiv. Nach Änderungen denselben Befehl im Checkout ausführen: Compose ersetzt die betroffenen Container und erhält die Datenvolumes. Docker Desktop muss laufen; `restart: unless-stopped` startet die Dienste nach einem Neustart der Engine erneut, sofern sie nicht ausdrücklich gestoppt wurden. Während einer Aktualisierung kann die Anwendung kurz nicht erreichbar sein; Admin-Sitzungen werden beim App-Neustart ungültig.

Die lokale Standardeinstellung ist `https://localhost` (nur auf dem Laptop erreichbar). Die einmalig erzeugten Zugangsdaten liegen bei der betreuten Ersteinrichtung in der ignorierten Datei `secrets/admin-zugang.txt`; diese Datei vertraulich behandeln und das Passwort in einen Passwortmanager übernehmen. Die Datei gehört nicht in Git oder Backups ohne Verschlüsselung.

Alternativ ist `https://127.0.0.1` erreichbar; Caddy stellt dafür ebenfalls ein lokales Zertifikat aus. Die API erlaubt den konfigurierten `APP_ORIGIN` sowie `localhost` und `127.0.0.1` mit demselben Protokoll und Port. CORS-Preflights erlauben ausschließlich GET/POST und die Header Content-Type, Authorization und X-CSRF-Token; fremde Origins erhalten keine Freigabe. Der CSRF-Schutz bleibt aktiv. Cookies und Kiosk-Schlüssel sind browserseitig an den jeweiligen Host gebunden: beim Wechsel zwischen den Adressen separat anmelden beziehungsweise die vollständige Kiosk-Adresse öffnen. Es gibt keine Freigabe beliebiger Ports oder fremder Websites.

Bei Änderungen am eingebundenen `Caddyfile` zusätzlich `docker compose exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` ausführen. Ein Image-Neubau allein lädt eine geänderte Proxy-Konfiguration nicht neu.

Die blau-schwarze Oberfläche orientiert sich an der [Vereinswebsite](https://www.billard-pfaffenhofen.de/). Das Original-Vereinslogo wird lokal ausgeliefert; die Herkunft ist unter `public/assets/README.md` dokumentiert.

- Admin-Passwort nur als scrypt-Hash mit zufälligem Salt. Zufällige Sitzungstoken, HttpOnly-/SameSite=Strict-Cookies und unter HTTPS Secure-Cookies; Sitzungen laufen nach acht Stunden ab und verschwinden bei Neustart.
- Origin-Prüfung für alle Schreibzugriffe und zusätzlicher CSRF-Token für Admin-Sitzungen. CORS ausschließlich für die explizit erlaubten Origins. Parametrisierte SQL-Anweisungen, Eingabevalidierung, Request-Größenlimit, CSP und HTML-Escaping.
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

Das Schema verwendet Version 2 (`PRAGMA user_version`). Eine transaktionale Migration übernimmt bestehende Version-1-Daten: Veranstaltungen erhalten den Status `open` und eine Versionsnummer, Spieler und Ergebnisse bleiben unverändert. ID-Zähler verhindern, dass nach dem Löschen alte IDs wiederverwendet werden. Vor Migrationen eine konsistente Sicherung erstellen. Ältere App-Versionen dürfen nicht gegen das migrierte Schema gestartet werden; für einen Rollback passende App-Version und Datenbank-Backup zusammen wiederherstellen. SQLite passt zu acht Tischen und einem App-Prozess; bei Mehrprozess-/Mehrstandortbetrieb auf PostgreSQL migrieren. Die Tisch-ID ist bereits auf 1–8 begrenzt und kann später mit gebührenpflichtigen Tischbelegungen verknüpft werden.

Nächste fachliche Entscheidungen: konkrete bayerische Liga-/Mannschaftsregeln, Turniermodus (Gruppen/Einfach-/Doppel-KO), Spielerregister sowie Berechtigungen für Schiedsrichter und Vereinsverwaltung.

Referenzen: [Docker Desktop unter Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Compose-Secrets](https://docs.docker.com/compose/how-tos/use-secrets/).
