# Änderungen

## FR-001: Durchgängige Admin-Navigation — 2026-10-27

- Die Admin-Menüleiste und Abmeldung bleiben auch an freien Tischen, während der Spielvorbereitung und beim Zählen sichtbar. Die Sitzungsprüfung aktualisiert die Navigation auch bei unverändertem Spielstand.
- Menülinks führen aus jeder Tischansicht zur Verwaltung; einzelne Tische markieren die Tischübersicht als aktiv. Das Vereinslogo und die Verwaltungs-Startseiten öffnen die Tischübersicht. Eine neue Admin-Anmeldung setzt auch einen zuvor geöffneten Ergebnis- oder Spieltagslink auf die Tischübersicht zurück.
- Reine PIN-Sitzungen erhalten weiterhin keine Admin-Navigation oder Verwaltungsrechte. Frontend-Regressionstests decken Startseiten, Ansichten, Tischzustände, Sitzungswechsel und Anmeldung ab; API-Tests prüfen zusätzlich die Abweisung von Verwaltungszugriffen mit Partie-PIN.

## Gesamtabschluss und Korrekturen — 2026-10-26

- Veranstaltungen erhalten einen Gesamtabschluss. Bis dahin kann die Verwaltung Veranstaltungsdaten sowie alle Partien einschließlich bereits beendeter Ergebnisse bearbeiten und löschen.
- Bearbeiten unterstützt Spieler, Veranstaltungszuordnung, Disziplin, Ziel, Break, Punkte, Tisch und Status einschließlich Wiederaufnahme. Löschen und Gesamtabschluss benötigen eine Bestätigung.
- Gesamtabschluss verlangt ausschließlich beendete Partien und sperrt anschließend sämtliche Änderungen serverseitig. Tablet-Berechtigungen bleiben auf den eigenen Tisch begrenzt.
- Transaktionale Schema-Migration von Version 1 auf 2 erhält Bestandsdaten und initialisiert Veranstaltungen als offen. Nicht wiederverwendete IDs und Veranstaltungsversionen verhindern veraltete Änderungen; Auditprotokolle erhalten vorherige Datenstände.
- Sechs Testsuiten einschließlich Migration, Berechtigungen, Korrekturen, Löschkaskade, Tischfreigabe und Schlusssperre erfolgreich. Browserprüfung und erweiterter HTTPS-Docker-Test erfolgreich.

## Spielabschluss und Adminnavigation — 2026-10-26

- Gut sichtbarer Spielabschluss in der zentralen Tisch-/Punkteübersicht und auf dem Tablet, aktiv nach Erreichen des Spielziels. Ein Bestätigungsdialog zeigt den Endstand vor dem verbindlichen Speichern.
- Tablets dürfen ausschließlich die Partie ihres eigenen Tisches abschließen. Versionsprüfung, CSRF-/Origin-Schutz und Auditprotokoll bleiben erhalten; Tischfreigabe und Warteanzeige folgen automatisch.
- Obere Navigation mit Tischübersicht, Spieltagsverwaltung, Punkteübersicht und Ergebnisarchiv; Formulareingaben werden beim Menüwechsel erhalten.
- API-Tests für zentralen und Tablet-Abschluss, fremde Tischschlüssel, doppelte Abschlüsse und Korrekturen nach Abschluss erweitert. Docker-HTTPS-Test und Browserdurchlauf mit Dialogabbruch, beiden Abschlusswegen und Ergebnisarchiv erfolgreich.

## Vereinsdesign und Loopback-Zugriff — 2026-10-26

- Original-Löwenlogo des BSV Pfaffenhofen lokal eingebunden; Oberfläche auf Schwarz, Blau und helle Schrift umgestellt. Login, Verwaltung und Tischanzeigen folgen der Gestaltung der Vereinswebsite.
- HTTPS-Zugang über 127.0.0.1 ergänzt, einschließlich Caddy-Zertifikat und expliziter Origin-Freigabe. CORS-Preflights unterstützen ausschließlich erlaubte Origins, Methoden und Header; CSRF-Schutz bleibt aktiv.
- Tests für erlaubte/verbotene Origins, CSRF unter dem IP-Origin, Logo-Auslieferung und HTTPS-Anmeldung per IP ergänzt. Dokumentation zu getrennten Host-Sitzungen und Proxy-Reload aktualisiert.

## Docker-Validierung — 2026-10-26

- Reproduzierbarer Windows-/Docker-Desktop-Test als `node scripts/docker-smoke.js` bzw. `npm run test:docker` ergänzt; eigene Test-Secrets, zufälliger Compose-Projektname, isolierte Volumes und automatisches Aufräumen.
- Image-Build und vollständiger HTTPS-API-Spielablauf erfolgreich auf Docker Engine 29.7.2 geprüft, einschließlich Zertifikatsvalidierung ohne TLS-Bypass, Secure-Cookies, CSRF-/Origin-Schutz, Tischrechten und Versionskonflikten.
- Container-Härtung zur Laufzeit geprüft; Spielstand über App-Neustart und Container-Ersetzung erhalten, alte Admin-Sitzung nach Neustart ungültig.
- Ergebnisabschluss und Freigabe des Tisches erfolgreich geprüft. README um Testaufruf und Verifikationsstand ergänzt. Keine Änderungen am Anwendungscode oder Produktiv-Stack notwendig.
- Tablet-/WLAN-Abnahme und Backup-Restore-Probe bleiben offen.

## 0.1.0 — 2026-10-26

Erster Draft für Liga-Spieltage und Turniere, noch ohne Tischgebühren.

- Deutsche Verwaltungsoberfläche mit acht Tischkarten, Veranstaltungen, manueller Begegnungsplanung und Ergebnisarchiv.
- Feste Tablet-Endpunkte, große Rack-Punkteanzeige, Punktekorrektur und Wechselbreak aus Startspieler/Rackzahl.
- Node.js-HTTP-Backend mit persistenter SQLite-Datenbank, Tischbelegungsschutz, Versionskonflikten und Auditprotokoll.
- Passwort-Hashing, begrenzte Login-Versuche, zeitlich begrenzte Admin-Sitzungen, CSRF-/Origin-Prüfung, individuelle Tischschlüssel, CSP und Eingabevalidierung.
- Docker-Compose-Stack mit Caddy-HTTPS, nicht privilegierter App, Datenvolumes und dateibasierten Secrets.
- Windows-/Tablet-Einrichtung, Sicherheitsannahmen, Sicherung/Wiederherstellung und fachliche Draft-Grenzen dokumentiert.
- Automatisierte Domain-/API-Tests und GitHub-Actions-Prüfungen.

Validierung vor dem ersten Commit: lokale Node-Tests erfolgreich, JavaScript-Syntaxprüfung und Compose-Konfigurationsprüfung erfolgreich. Browserdurchlauf mit flüchtigen Testdaten: Anmeldung, Veranstaltung, Begegnung, Tischstart, Punkt und Breakwechsel erfolgreich; Tischansicht bei 1280×720 visuell geprüft. Docker-Image-Build und HTTPS-/Volume-Betrieb noch nicht ausgeführt, da Docker Desktop Engine auf dem Entwicklungsgerät nicht läuft. Tests auf echten Tablets und Restore-Probe stehen vor produktivem Einsatz aus.
