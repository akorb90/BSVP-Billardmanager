# Betrieb und Sicherheit

### Docker-Startfehler: EISDIR / config.json ist ein Ordner

Wird Compose vor `docker compose -f compose.yaml run --rm setup` gestartet, kann Docker Desktop den fehlenden Dateipfad `secrets/config.json` als leeren Ordner anlegen. Die App kann diesen Ordner nicht als JSON lesen (`EISDIR`). Die Konfiguration wird jetzt schreibgeschützt mit `create_host_path: false` eingebunden; fehlende Host-Dateien sollen damit bereits beim Containerstart auffallen.

Im Repository `docker compose -f compose.yaml run --rm setup` ausführen. Ein leerer `config.json`-Ordner wird unter einem freien Namen `config.json.directory-backup[-N]` erhalten und eine neue Konfigurationsdatei angelegt. Nicht leere Ordner und vorhandene Dateien bleiben unverändert; deren Inhalt zuerst prüfen und gegebenenfalls die vorhandene Sicherheitskonfiguration wiederherstellen. Niemals bestehende Zugangsdaten ersetzen oder Datenvolumes löschen, um diesen Fehler zu beheben.

Danach `docker compose -f compose.yaml up -d --wait` ausführen. Ein bloßer Neustart des alten Containers übernimmt die korrigierte Einbindung nicht. Falls Windows das Umbenennen des leeren Ordners wegen der laufenden Einbindung verweigert, zuerst `docker compose stop app` ausführen und Setup wiederholen. Das neue Admin-Passwort sicher aufbewahren.

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
5. Die Kiosk-Startadresse pro Gerät eintragen, beispielsweise `https://192.168.178.50/tisch/1`. Es ist kein Schlüssel im Link erforderlich.
6. Beim Anlegen jeder Partie im Adminbereich eine **sechsstellige numerische Tablet-PIN** vergeben und den Spielern mitteilen. Führende Nullen sind erlaubt. Sobald die Partie am Tisch gestartet wurde, die PIN dort eingeben.

Ohne Anmeldung zeigt ein belegter Tisch ausschließlich das PIN-Formular, keine Spielernamen oder Spielstände. Ein freier Tisch zeigt die Warteansicht. Die PIN schaltet nur diese Partie an diesem Tisch frei; Adminrechte werden dadurch nicht vergeben. Bestehende Tischschlüssel allein gewähren keinen Zugriff mehr. Vorhandene Konfigurationsdateien und Schlüssel bleiben aus Kompatibilitätsgründen erhalten.

PINs werden ausschließlich als scrypt-Hash mit zufälligem Salt gespeichert, nicht in API-Antworten oder Auditdaten ausgegeben. Vergessene PINs können unter **Partie bearbeiten** ersetzt werden; leer lassen behält die vorhandene PIN. Bestands-Partien ohne PIN bleiben für Tablets gesperrt, bis die Spielleitung eine PIN nachträgt. Der Admin kann weiterhin zentral Punkte bearbeiten.

Die Tablet-Anmeldung verwendet ein zufälliges Sitzungstoken im tabgebundenen sessionStorage und einen Authorization-Header. Sie läuft nach acht Stunden oder App-Neustart ab. Partienabschluss, Löschung und administrative Änderungen an der Partie entziehen den Zugriff; auch eine wiederaufgenommene Partie benötigt eine neue Anmeldung. Die nächste Partie verlangt ihre eigene PIN. Pro Tisch sind höchstens 16 gleichzeitige Sitzungen möglich, danach wird die älteste ersetzt.

Nach fünf erfolglosen PIN-Versuchen innerhalb von 15 Minuten ist die Anmeldung an diesem Tisch bis zum Ende des Zeitfensters gesperrt. Dieses Limit überlebt App-Neustarts; andere Tische und bestehende Sitzungen bleiben nutzbar. Unterschiedliche PINs für Partien wählen und vertraulich behandeln. Ein angemeldeter Administrator kann Tischseiten ohne PIN öffnen. Am gemeinsam genutzten Tablet daher keine Admin-Sitzung offen lassen.

## Sicherheit und Betrieb

### Dauerhaft aktive lokale Prüfinstanz

Für den Image-Betrieb die Befehle mit `-f compose.yaml` ausführen; beim lokalen Quellcode-Build gelten die Befehle unter [Entwicklung](Entwicklung.md).

Der Stack wird mit `docker compose -f compose.yaml up -d --wait` gestartet und bleibt anschließend aktiv. Nach Änderungen denselben Befehl im Checkout ausführen: Compose ersetzt die betroffenen Container und erhält die Datenvolumes. Docker Desktop muss laufen; `restart: unless-stopped` startet die Dienste nach einem Neustart der Engine erneut, sofern sie nicht ausdrücklich gestoppt wurden. Während einer Aktualisierung kann die Anwendung kurz nicht erreichbar sein; Admin-Sitzungen werden beim App-Neustart ungültig.

Die lokale Standardeinstellung ist `https://localhost` (nur auf dem Laptop erreichbar). Setup zeigt das initiale Admin-Passwort einmal an; es wird nicht automatisch als Klartextdatei gespeichert. Den Zugang im Passwortmanager sichern. Falls aus einer früheren betreuten Ersteinrichtung eine Datei `secrets/admin-zugang.txt` vorhanden ist, diese vertraulich behandeln und nicht in Git oder unverschlüsselte Backups übernehmen.

Alternativ ist `https://127.0.0.1` erreichbar; Caddy stellt dafür ebenfalls ein lokales Zertifikat aus. Die API erlaubt den konfigurierten `APP_ORIGIN` sowie `localhost` und `127.0.0.1` mit demselben Protokoll und Port. CORS-Preflights erlauben ausschließlich GET/POST und die Header Content-Type, Authorization und X-CSRF-Token; fremde Origins erhalten keine Freigabe. Der CSRF-Schutz bleibt aktiv. Cookies und Tablet-Sitzungen sind browserseitig an den jeweiligen Host gebunden: beim Wechsel zwischen den Adressen separat anmelden beziehungsweise die Partie-PIN eingeben. Es gibt keine Freigabe beliebiger Ports oder fremder Websites.

Bei Änderungen am eingebundenen `Caddyfile` zusätzlich `docker compose exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` ausführen. Ein Image-Neubau allein lädt eine geänderte Proxy-Konfiguration nicht neu.

Die blau-schwarze Oberfläche orientiert sich an der [Vereinswebsite](https://www.billard-pfaffenhofen.de/). Das Original-Vereinslogo wird lokal ausgeliefert; die Herkunft ist unter [Logo und Herkunft](Logo.md) dokumentiert.

- Admin-Passwort nur als scrypt-Hash mit zufälligem Salt. Zufällige Sitzungstoken, HttpOnly-/SameSite=Strict-Cookies und unter HTTPS Secure-Cookies; Sitzungen laufen nach acht Stunden ab und verschwinden bei Neustart.
- Origin-Prüfung für alle Schreibzugriffe und zusätzlicher CSRF-Token für Admin-Sitzungen. CORS ausschließlich für die explizit erlaubten Origins. Parametrisierte SQL-Anweisungen, Eingabevalidierung, Request-Größenlimit, CSP und HTML-Escaping.
- Nach zehn Anmeldeversuchen pro Quelladresse für 15 Minuten gesperrt. Hinter Caddy wird absichtlich dessen Adresse verwendet: damit gilt ein gemeinsames Login-Limit für das ganze Vereinsnetz. Ein Angreifer im Netz kann dadurch vorübergehend Admin-Anmeldungen blockieren. Tischbetrieb bleibt unabhängig davon. Nur ein App-Prozess; Sitzungen und Limits sind im Speicher.
- App läuft ohne Root, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities und ohne veröffentlichten App-/DB-Port. PostgreSQL läuft als eigener Dienst im internen Datenbanknetz und speichert in `postgres_data`. Der SQLite-Altbestand bleibt als Rückfallstand im bisherigen Volume.
- Compose-Secrets werden dateibasiert eingebunden. Sie sind kein verschlüsselter Tresor. Windows-Gerät/Backups mit BitLocker schützen und Zugriffsrechte pflegen.
- Images sind auf Hauptversionen begrenzt. Vor produktiver Freigabe aktuelle Patchstände prüfen, Image-Digests pinnen und regelmäßig Updates/Scans durchführen. `docker compose build --pull` und `docker compose pull proxy` aktualisieren Images; anschließend neu starten und testen.
- PIN-Wechsel über „Partie bearbeiten“; bereits angemeldete Tablets müssen sich danach erneut anmelden. Admin-Passwortwechsel unter „Einstellungen“ mit aktuellem Passwort und zweifacher Eingabe des neuen Passworts (12–128 Zeichen). Alle Admin-Sitzungen werden danach abgemeldet; Tablet-Sitzungen bleiben bestehen. Der neue scrypt-Hash wird im Datenvolume gespeichert. Die Secrets-Datei und die ursprüngliche Zugangsinformation werden nicht überschrieben; das neue Passwort im eigenen Passwortmanager sichern.
- Datenbank, Auditprotokoll und Sicherungsdateien enthalten Spielernamen. Aufbewahrungs-/Löschfristen des Vereins festlegen. Export und Wiederherstellung stehen unter „Einstellungen → Datensicherung“ bereit.
