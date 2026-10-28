# BSVP Billardmanager · Draft 0.1

Lokale Webanwendung für einen Billardverein in Bayern. Node.js 24 LTS, SQLite und Caddy; keine externen JavaScript-Pakete, CDNs oder Cloud-Dienste. Die Oberfläche ist deutsch und für Tablets ausgelegt.

## Screenshots
Loginpage:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/05ce9930-2847-4ada-a03e-c4f1990eda57" />

Startseite:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/d4dfeb23-cfc6-4751-a2cd-384809b9bdf7" />

Spieltagsverwaltung:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/170c2ade-41b2-4024-b55a-0b6929144b49" />

Ergebnisse:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/13fbaf10-7870-451c-b1d8-6708bd219f32" />

Tischvermietung:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/cd9c6b31-e85f-45ef-8653-d29903dcf9bd" />

Einstellungen:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/1a883849-8dd4-4ea1-a5c5-6a2cd9469d5d" />

## Funktionsumfang

- Liga-Spieltage und Turniere mit Name und Datum anlegen.
- Begegnungen manuell planen: zwei Spieler, 8-/9-/10-Ball, Gewinnspiele und Tablet-PIN. Ausstoßen und erstes Break werden vor Ort abgefragt.
- Begegnungen einem von acht freien Tischen zuweisen; Doppelbelegung wird verhindert.
- Feste Kiosk-Endpunkte `/tisch/1` bis `/tisch/8`, Punkte +/−, Wechselbreak und automatische Aktualisierung alle drei Sekunden.
- Ergebnisse nach Erreichen des Spielziels zentral oder direkt am zugeordneten Tablet bestätigen. Danach wird der Tisch frei; das Ergebnis bleibt erhalten.
- Obere Adminnavigation: Tischübersicht, Spieltagsverwaltung, Ergebnisse, Tischvermietung und Einstellungen. Die Tischübersicht zeigt laufende Partien; abgeschlossene Partien erscheinen im Ergebnisarchiv.
- Veranstaltungen, Begegnungen, Ergebnisse und Buchungshistorie bieten Zurück/Weiter und 10, 20, 50 oder 100 Einträge pro Seite (Standard: 20). Jede Liste behält ihre Auswahl beim Menüwechsel und bei automatischen Aktualisierungen; eine andere Seitengröße beginnt auf Seite 1. Die feste Übersicht der acht Tische bleibt vollständig sichtbar.
- SQLite speichert Veranstaltungen, Begegnungen, Ergebnisse und ein Änderungsprotokoll. Gleichzeitige Eingaben werden mit Versionsprüfung und Transaktionen geschützt.
- Einstellungen bündeln Vereinsgestaltung (FR-009), Grundpreis, Admin-Passwortwechsel und [Datensicherung mit Export und Import (FR-005)](#sicherung-und-wiederherstellung). Eine geprüfte Sicherungsdatei kann den vollständigen Anwendungsstand auf einer neuen Installation wiederherstellen.

## Vereinsgestaltung (FR-009)

Unter **Einstellungen → Vereinsgestaltung** können Administratoren den Vereinsnamen (1–80 Zeichen), ein eigenes Logo und die Farben für Akzente, Hintergrund, Flächen und Text speichern. Die Gestaltung gilt auch für Anmeldung, Browser-Titel und Tisch-Tablets; offene Seiten übernehmen sie automatisch beim nächsten Aktualisieren. PNG- und JPEG-Logos bis 1 MiB sind erlaubt. Ohne neue Dateiauswahl bleibt das vorhandene Logo erhalten; **Standardlogo verwenden** stellt beim Speichern das BSV-Logo wieder her. Andere Vereine sollten ihr eigenes Logo hochladen.

Unter jedem Farbwähler kann der Hex-Farbcode direkt eingegeben werden (z. B. #147eb7). Farbwähler und Codefeld aktualisieren sich gegenseitig.

Text muss zu Hintergrund und Flächen mindestens 4,5:1 Kontrast haben; die Beschriftung farbiger Hauptbuttons wird automatisch hell oder dunkel gewählt. **Änderungen verwerfen / Neu laden** lädt die gespeicherten Werte. Parallel geänderte Einstellungen erfordern erneutes Laden, damit kein fremder Stand überschrieben wird.

Die Gestaltung einschließlich Logo liegt dauerhaft in der Datenbank und ist in Export/Import enthalten. Schema 7 ergänzt bestehende Installationen um die BSV-Vorgaben und erhält Spielstände, Zugangsdaten und Volumes. Sicherungen aus Schema 6 lassen sich weiterhin importieren und erhalten dabei die BSV-Standardgestaltung; Sicherungen aus Schema 7 benötigen diese oder eine kompatible neuere App-Version.

## Tischvermietung

Unter **Tischvermietung** lassen sich freie Tische zu einem vereinbarten Stundenpreis vermieten. Angefangene Minuten werden aufgerundet; Start, Preis und Abrechnung bleiben in der Buchungshistorie gespeichert.

**Vermietung abschließen** zeigt einen festen Endzeitpunkt und den daraus berechneten Betrag. Ein zusätzlicher Klick bestätigt den Abschluss **ohne Texteingabe**. Während der Dialog offen ist, bleibt der Tisch belegt; Abbrechen lässt die Vermietung weiterlaufen. Bei Bestätigung gilt der angezeigte Endzeitpunkt.

Abgeschlossene Buchungen können mit **BUCHUNG ÄNDERN** korrigiert werden. **Buchung löschen** verlangt bei jedem Status **BUCHUNG LÖSCHEN** und weist auf den Verlust der Abrechnungsdaten hin. Aktive Buchungen geben beim Löschen ihren Tisch frei. **Grundpreis speichern** zeigt den alten und neuen Betrag und verlangt **GRUNDPREIS ÄNDERN**; bereits vereinbarte Buchungspreise bleiben erhalten. Diese Texte müssen exakt von Hand eingegeben werden. Einfügen und Drag-and-drop sind gesperrt, Abbrechen und Escape verwerfen die Bestätigung.

Zwischenzeitliche Änderungen erfordern erneutes Prüfen. Der Server kontrolliert Adminrechte, Aktion und Datenversion und protokolliert den vorherigen Datenstand. Gelöschte Buchungsnummern werden nicht wiederverwendet; das Auditprotokoll bleibt erhalten.

## Schnellstart auf dem Windows-Laptop

Voraussetzung: Node.js 24 LTS und Docker Desktop mit **Linux-Containern** (WSL 2). PowerShell im Repository öffnen:

```powershell
npm run setup
Copy-Item .env.example .env
docker compose up -d --build --wait
docker compose ps
```

`setup` erzeugt ein zufälliges Admin-Passwort und acht Tischschlüssel. Das Passwort wird einmal ausgegeben: im Passwortmanager speichern. `secrets/config.json` wird niemals überschrieben. Diese Datei und `.env` sind von Git und Docker-Build-Kontext ausgeschlossen. Unter Windows den Zugriff auf `secrets` über NTFS-Berechtigungen auf die betreuenden Administratoren begrenzen; `mode: 0600` allein setzt dort keine verlässlichen ACLs.

### Docker-Startfehler: EISDIR / config.json ist ein Ordner

Wird Compose vor `npm run setup` gestartet, kann Docker Desktop den fehlenden Dateipfad `secrets/config.json` als leeren Ordner anlegen. Die App kann diesen Ordner nicht als JSON lesen (`EISDIR`). Die Konfiguration wird jetzt schreibgeschützt mit `create_host_path: false` eingebunden; fehlende Host-Dateien sollen damit bereits beim Containerstart auffallen.

Im Repository `npm run setup` ausführen. Ein leerer `config.json`-Ordner wird unter einem freien Namen `config.json.directory-backup[-N]` erhalten und eine neue Konfigurationsdatei angelegt. Nicht leere Ordner und vorhandene Dateien bleiben unverändert; deren Inhalt zuerst prüfen und gegebenenfalls die vorhandene Sicherheitskonfiguration wiederherstellen. Niemals bestehende Zugangsdaten ersetzen oder Datenvolumes löschen, um diesen Fehler zu beheben.

Danach `docker compose up -d --build --wait` ausführen. Ein bloßer Neustart des alten Containers übernimmt die korrigierte Einbindung nicht. Falls Windows das Umbenennen des leeren Ordners wegen der laufenden Einbindung verweigert, zuerst `docker compose stop app` ausführen und Setup wiederholen. Das neue Admin-Passwort sicher aufbewahren.

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

### Spielvorbereitung und Zeitmessung

Nach **Tisch zuweisen** ist der Tisch reserviert. Nach der PIN-Anmeldung fragt die Tischseite zuerst **Wer hat das Ausstoßen (Lag) gewonnen?**, danach **Wer hat das erste Break?** Beide Spieler können unabhängig gewählt werden. Mit der zweiten Bestätigung beginnt die Partie; vorher sind Punkte gesperrt. Administratoren können diese Schritte ebenfalls über die Tischseite durchführen. Die Auswahl wird gespeichert und bleibt auch nach Veranstaltungsabschluss mit Warnbestätigung administrativ korrigierbar.

Tablet und Tischübersicht zeigen **Partie** (Gesamtspielzeit) und **Runde** (aktuelle Rackdauer) sekundengenau. Jede Punkteänderung, auch eine Korrektur, startet die aktuelle Rundenzeit neu; beim Erreichen des Spielziels entfällt die nächste Rundenzeit. Die Gesamtzeit endet bei „Spiel abschließen“. Eine Wiederaufnahme setzt die Gesamtzeit fort, ohne die zwischenzeitliche Unterbrechung mitzuzählen; Zurücksetzen auf „Geplant“ löscht die Zeitmessung und verlangt die Vorbereitung erneut. Neuladen und App-Neustarts setzen laufende Zeiten nicht zurück; währenddessen verstrichene Zeit zählt mit.

Die Schema-4-Migration erhält bestehende Ergebnisse und Break-Reihenfolgen. Bereits laufende Bestands-Partien werden ab dem Update zeitlich erfasst; frühere Spielzeit ist nicht rekonstruierbar. Für bereits abgeschlossene Bestands-Partien wird keine Dauer erfunden. Neue Partien beginnen immer mit der zweistufigen Vorbereitung.

### Spiel abschließen

In der zentralen Tischübersicht sowie direkt am Tablet ist die Schaltfläche **Spiel abschließen** sichtbar. Sie wird aktiv, sobald ein Spieler das konfigurierte Spielziel erreicht. Im roten Warndialog den Endstand prüfen, **SPIEL ABSCHLIESSEN** von Hand eingeben und **Spiel abschließen** wählen; **Abbrechen** lässt den Stand unverändert. Der Partienabschluss wird im Auditprotokoll dem Administrator oder der Tisch-ID zugeordnet und gibt den Tisch für die nächste Begegnung frei. Die Verwaltung kann die Partie auch nach Gesamtabschluss mit Warnbestätigung bearbeiten oder löschen. Das Tablet wechselt automatisch zur Warteanzeige. Gleichzeitige Abschlüsse oder zwischenzeitliche Punktänderungen werden durch Versionsprüfung abgefangen. Ein vorzeitiger Abbruch unterhalb des Spielziels ist weiterhin nicht vorgesehen.

Die Spieltagsverwaltung ist direkt über `/#spieltage`, die Tischübersicht über `/#uebersicht` und das Archiv über `/#ergebnisse` erreichbar. Formulareingaben bleiben beim Menüwechsel innerhalb der Seite erhalten; sie werden erst beim erfolgreichen Speichern zurückgesetzt und nicht über einen Browser-Neustart gespeichert.

### Veranstaltungen bearbeiten, löschen und endgültig abschließen

Unter **Spieltagsverwaltung** gibt es für jede Veranstaltung **Veranstaltung bearbeiten** und **Veranstaltung löschen**, bei offenen Veranstaltungen zusätzlich **Veranstaltung abschließen**. Sämtliche Partien bieten **Partie bearbeiten** und **Partie löschen**, auch nach Gesamtabschluss und im Ergebnisarchiv.

Bearbeitbar sind Veranstaltungsname, Format und Datum sowie bei Partien Spieler, Veranstaltungszuordnung, Disziplin, Ziel, erstes Break, Punktestand, Status und Tisch. Eine beendete Partie kann durch Status **Am Tisch** und Zuweisung eines freien Tisches wieder aufgenommen werden. Geplante Partien benötigen 0:0 und keinen Tisch; beendete Partien genau einen Spieler am Spielziel. Doppelbelegung und ungültige Ergebnisse werden serverseitig abgewiesen.

Der Gesamtabschluss ist nur möglich, wenn alle verbliebenen Partien beendet sind (auch eine leere Veranstaltung darf abgeschlossen werden). Danach bleiben neue Partien und die Wiederaufnahme gesperrt. Administrative Korrekturen und Löschungen sind weiterhin möglich. Korrigierte Partien bleiben abgeschlossen und ihrer abgeschlossenen Veranstaltung zugeordnet. Eine Löschung entfernt bei Veranstaltungen auch deren sämtliche Partien und gibt belegte Tische frei. Löschen, Gesamtabschluss und nachträgliche Korrekturen benötigen einen roten Warndialog mit Eintrag und Änderungen. Vergangen bedeutet: Veranstaltungsdatum vor dem heutigen Datum in Europe/Berlin. Die exakten Texte sind **EVENT ÄNDERN**, **SPIEL ÄNDERN**, **SPIEL LÖSCHEN**, **EVENT LÖSCHEN** und **EVENT ABSCHLIESSEN**. Einfügen und Drag-and-drop sind gesperrt. Erst der zusätzliche Klick auf die Aktionsschaltfläche führt die Aktion aus; Abbrechen oder Escape verwirft die Bestätigung. Löschungen sind in der Oberfläche nicht rückgängig zu machen; das interne Auditprotokoll enthält weiterhin die vorherigen Datenstände und dient nicht als Löschfunktion für personenbezogene Daten.

Jede Partienänderung erhöht auch die Veranstaltungsversion. Änderungen, Gesamtabschluss und Löschen mit inzwischen veralteten Daten werden abgewiesen. Partienkorrekturen und -löschungen prüfen zusätzlich die Version ihrer Veranstaltung, beim Verschieben auch die Zielversion. Nach einem Konflikt muss der aktualisierte Eintrag erneut geöffnet und bestätigt werden. Tablets dürfen weiterhin nur Punkte zählen und ihre eigene laufende Partie abschließen; administrative Korrekturen und Löschungen sind ausschließlich über die Admin-Sitzung möglich.

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

Alternativ ist `https://127.0.0.1` erreichbar; Caddy stellt dafür ebenfalls ein lokales Zertifikat aus. Die API erlaubt den konfigurierten `APP_ORIGIN` sowie `localhost` und `127.0.0.1` mit demselben Protokoll und Port. CORS-Preflights erlauben ausschließlich GET/POST und die Header Content-Type, Authorization und X-CSRF-Token; fremde Origins erhalten keine Freigabe. Der CSRF-Schutz bleibt aktiv. Cookies und Tablet-Sitzungen sind browserseitig an den jeweiligen Host gebunden: beim Wechsel zwischen den Adressen separat anmelden beziehungsweise die Partie-PIN eingeben. Es gibt keine Freigabe beliebiger Ports oder fremder Websites.

Bei Änderungen am eingebundenen `Caddyfile` zusätzlich `docker compose exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` ausführen. Ein Image-Neubau allein lädt eine geänderte Proxy-Konfiguration nicht neu.

Die blau-schwarze Oberfläche orientiert sich an der [Vereinswebsite](https://www.billard-pfaffenhofen.de/). Das Original-Vereinslogo wird lokal ausgeliefert; die Herkunft ist unter `public/assets/README.md` dokumentiert.

- Admin-Passwort nur als scrypt-Hash mit zufälligem Salt. Zufällige Sitzungstoken, HttpOnly-/SameSite=Strict-Cookies und unter HTTPS Secure-Cookies; Sitzungen laufen nach acht Stunden ab und verschwinden bei Neustart.
- Origin-Prüfung für alle Schreibzugriffe und zusätzlicher CSRF-Token für Admin-Sitzungen. CORS ausschließlich für die explizit erlaubten Origins. Parametrisierte SQL-Anweisungen, Eingabevalidierung, Request-Größenlimit, CSP und HTML-Escaping.
- Nach zehn Anmeldeversuchen pro Quelladresse für 15 Minuten gesperrt. Hinter Caddy wird absichtlich dessen Adresse verwendet: damit gilt ein gemeinsames Login-Limit für das ganze Vereinsnetz. Ein Angreifer im Netz kann dadurch vorübergehend Admin-Anmeldungen blockieren. Tischbetrieb bleibt unabhängig davon. Nur ein App-Prozess; Sitzungen und Limits sind im Speicher.
- App läuft ohne Root, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities und ohne veröffentlichten App-/DB-Port. SQLite befindet sich ausschließlich im Datenvolume.
- Compose-Secrets werden dateibasiert eingebunden. Sie sind kein verschlüsselter Tresor. Windows-Gerät/Backups mit BitLocker schützen und Zugriffsrechte pflegen.
- Images sind auf Hauptversionen begrenzt. Vor produktiver Freigabe aktuelle Patchstände prüfen, Image-Digests pinnen und regelmäßig Updates/Scans durchführen. `docker compose build --pull` und `docker compose pull proxy` aktualisieren Images; anschließend neu starten und testen.
- PIN-Wechsel über „Partie bearbeiten“; bereits angemeldete Tablets müssen sich danach erneut anmelden. Admin-Passwortwechsel unter „Einstellungen“ mit aktuellem Passwort und zweifacher Eingabe des neuen Passworts (12–128 Zeichen). Alle Admin-Sitzungen werden danach abgemeldet; Tablet-Sitzungen bleiben bestehen. Der neue scrypt-Hash wird im Datenvolume gespeichert. Die Secrets-Datei und die ursprüngliche Zugangsinformation werden nicht überschrieben; das neue Passwort im eigenen Passwortmanager sichern.
- SQLite-Daten, Auditprotokoll und Sicherungsdateien enthalten Spielernamen. Aufbewahrungs-/Löschfristen des Vereins festlegen. Export und Wiederherstellung stehen unter „Einstellungen → Datensicherung“ bereit.

## Sicherung und Wiederherstellung

### Export und Import in der Anwendung (FR-005)

Unter **Einstellungen → Datensicherung → Sicherung herunterladen** erstellt die angemeldete Spielleitung eine konsistente JSON-Sicherung im laufenden Betrieb. Sie enthält sämtliche Anwendungsdaten: Veranstaltungen, Partien samt Spielständen, Tischzuweisung und Zeitmessung, Vermietungen, Grundpreis, ID-Zähler, PIN-Versuchslimits, Änderungsprotokoll sowie Admin-Passwort- und Partien-PIN-Hashes. Klartext-Passwörter und Sitzungstoken werden nicht exportiert. Die Datei ist nicht verschlüsselt: vertraulich auf einem anderen Gerät bzw. in einer geschützten externen Ablage aufbewahren.

Zur Wiederherstellung die JSON-Datei auswählen (maximal 50 MiB). Nach Format-, Schema-, Prüfsummen- und Datenprüfung zeigt die Vorschau Sicherungsdatum, Anzahl der Spieltage, Partien, Vermietungen und laufenden Vorgänge. **Vorher den aktuellen Stand separat herunterladen.** Die Eingabe **DATEN WIEDERHERSTELLEN** und der anschließende Klick ersetzen sämtliche Anwendungsdaten gemeinsam in einer Datenbanktransaktion. Ein fehlerhafter Import lässt den vorhandenen Datenbestand unverändert. Werden während der Vorschau Daten geändert, wird die Wiederherstellung abgelehnt; die Datei muss erneut geprüft werden. Eine Vorschau gilt zehn Minuten und ist an die angemeldete Sitzung und die konkrete Sicherung gebunden.

Nach erfolgreichem Import werden alle Admin- und Tablet-Sitzungen abgemeldet. Es gelten wieder das **Admin-Passwort und die Partien-PINs aus der Sicherung**; das damalige Admin-Passwort muss bekannt sein. Laufende Spiel- und Mietzeiten rechnen die seit ihrem gespeicherten Start verstrichene Zeit einschließlich Ausfallzeit mit. Wiederherstellungen erscheinen im Änderungsprotokoll. Sicherungen benötigen dieselbe Datenbankschema-Version; bei einem Versionswechsel die passende App-Version verwenden. Die SHA-256-Prüfsumme erkennt Beschädigungen, bestätigt aber nicht die Herkunft: ausschließlich eigene, vertrauenswürdige Sicherungen importieren.

**Nach Laptop-Ausfall:** Anwendung gemäß Installationsanleitung einrichten, mit dem Zugang der neuen Installation anmelden und die externe JSON-Sicherung importieren. Danach mit dem Passwort aus der Sicherung anmelden, Datenstände prüfen und Tablets mit den gespeicherten PINs anmelden. Installationsbezogene Einstellungen (`.env`, `secrets/config.json`), Serveradresse, HTTPS-Zertifikate und Caddy-CA sind nicht Bestandteil der JSON-Anwendungsdaten. Diese zusätzlich verschlüsselt sichern. Auf einem neuen Laptop müssen Serveradresse/WLAN und Zertifikatsvertrauen eingerichtet oder die separat gesicherte CA wiederhergestellt werden. Die ungenutzten alten Tischschlüssel der Secrets-Datei gewähren keinen Zugriff und werden nicht importiert.

### Zusätzliche Sicherung der Installation und Datenvolumes

Für eine direkte Volume-Sicherung ein kurzes Wartungsfenster nutzen; die App muss während Kopieren und Wiederherstellen gestoppt bleiben. Die SQLite-Hauptdatei **und** vorhandene WAL-/SHM-Dateien zusammen sichern, am einfachsten das gesamte `/data`-Verzeichnis:

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

Das Schema verwendet Version 6 (`PRAGMA user_version`). Version 5 ergänzt Tischvermietungen und Grundpreis. Version 6 übernimmt den vorhandenen Admin-Hash einmalig aus der Konfiguration in die Datenbank; spätere Konfigurationsänderungen überschreiben das Passwort nicht. Eine Wiederherstellung der Datenbank stellt auch den damaligen Passwortstand wieder her. Die Migration von Version 2 ergänzt PIN-Hashes, eine Berechtigungsrevision und persistente PIN-Versuchslimits. Bestehende Partien erhalten keine automatische PIN; diese wird bei Bedarf im Adminbereich nachgetragen. Eine transaktionale Migration übernimmt bestehende Version-1-Daten: Veranstaltungen erhalten den Status `open` und eine Versionsnummer, Spieler und Ergebnisse bleiben unverändert. ID-Zähler verhindern, dass nach dem Löschen alte IDs wiederverwendet werden. Vor Migrationen eine konsistente Sicherung erstellen. Ältere App-Versionen dürfen nicht gegen das migrierte Schema gestartet werden; für einen Rollback passende App-Version und Datenbank-Backup zusammen wiederherstellen. SQLite passt zu acht Tischen und einem App-Prozess; bei Mehrprozess-/Mehrstandortbetrieb auf PostgreSQL migrieren. Die Tisch-ID ist auf 1–8 begrenzt. Vermietungen rechnen mit dem Grundpreis abzüglich eines Rabatts von 0 bis 100 %; der Grundpreis wird unter „Einstellungen“ verwaltet.

Geplante Erweiterungen und ihre Anforderungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

Referenzen: [Docker Desktop unter Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Compose-Secrets](https://docs.docker.com/compose/how-tos/use-secrets/).
