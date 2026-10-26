# Änderungen

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
