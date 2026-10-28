# Release Notes

Diese Historie dokumentiert umgesetzte Features und Änderungen. Noch offene Anforderungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

## FR-010: Dokumentation und Image-Deployment — 2026-10-28

- README auf Ersteinrichtung und Updates reduziert. Bedienung, Betrieb/Sicherheit, vollständige Anwendungs- und Betriebssicherung, Entwicklung, Logoherkunft, Release Notes und offene Anforderungen unter `Doku/` strukturiert. Veraltete Angaben zu Schema und Backup-Kompatibilität berichtigt.
- `compose.yaml` betreibt ein fertiges GHCR-Image; der Quellcode-Checkout ergänzt automatisch `compose.override.yaml` für lokale Builds. Einmaliger Setup-Container ermöglicht die Ersteinrichtung ohne Node.js auf dem Host, schützt bestehende Zugangsdaten und setzt unter Linux den Dateieigentümer für die App. Dienstnamen, Sicherheitsvorgaben und Datenvolumes bleiben erhalten.
- GitHub Actions prüft Änderungen und veröffentlicht anschließend auf `main` bzw. `v…`-Tags Images für amd64/arm64 und ein Installationspaket ohne Secrets. Tags für `latest`, Commit und Version, Versionsbindung, Umstieg, Rückkehr sowie die einmalige GHCR-Freigabe sind dokumentiert. Der Build-Kontext enthält ausschließlich Anwendungs- und Setup-Dateien.
- Prüfung: 30 automatisierte Tests; zwei isolierte Docker-HTTPS-Durchläufe mit Quellcode-Build bzw. ausschließlich fertigem lokalem Image, Container-Ersteinrichtung, unveränderten Zugangsdaten bei Setup-Wiederholung, Neustart/Containerersatz und vollständigem Backup-Export/Import erfolgreich. Beide Compose-Varianten validiert.
- Deployment: bestehender lokaler Stack mit `docker compose up -d --build --wait` aktualisiert und aktiv belassen. App gesund, Proxy aktiv; HTTPS über localhost und 127.0.0.1 mit validierter Zertifikatskette geprüft. Hashvergleich bestätigt unveränderte `.env`, Sicherheitskonfiguration und CA; das bisherige Datenvolume wird weiterverwendet.
- Noch extern zu prüfen: erster erfolgreicher GitHub-Publish-Lauf nach Übernahme nach `main`, GHCR-Paketsichtbarkeit und anonymer Registry-Pull. Lokale Tests bestätigen den Image-Betrieb, nicht die noch ausstehende Veröffentlichung oder den arm64-Lauf.

## Farbcodes und verbindliche Backup-Vollständigkeit — 2026-10-28

- Unter jedem Farbwähler steht ein direkt editierbarer Hex-Farbcode. Gültige Codes und Farbwähler synchronisieren sich in beide Richtungen; unvollständige oder ungültige Codes verhindern das Speichern.
- Vereinsname, sämtliche Farben und Logo sind bereits im vollständigen Export/Import enthalten. Die Arbeitsanweisungen verlangen nun ausdrücklich die Sicherung aller dauerhaften Anwendungsdaten und Einstellungen sowie die Prüfung ihrer Wiederherstellung bei Erweiterungen.

## FR-009: Vereinsgestaltung — 2026-10-28

- Einstellungen um Vereinsname, Logo-Upload (PNG/JPEG bis 1 MiB), Standardlogo-Rückkehr sowie editierbare Akzent-, Hintergrund-, Flächen- und Textfarben erweitert. Name und Gestaltung gelten für Kopf- und Fußzeile, Anmeldung, Browser-Titel und Tischseiten. Offene Seiten übernehmen gespeicherte Änderungen automatisch.
- Server prüft Adminrechte, Origin/CSRF, Texte, Farbwerte, Textkontrast und Bilddaten; eine Versionsprüfung verhindert das Überschreiben paralleler Änderungen. Entwürfe und Logo-Auswahl bleiben bei automatischen Aktualisierungen erhalten, mit eigener Schaltfläche zum Verwerfen. Logo-Bilddaten werden nicht ins Änderungsprotokoll geschrieben.
- Schema 7 speichert die Gestaltung einschließlich Logo im vorhandenen Datenvolume und im vollständigen Export/Import. Bestandsdaten und Sicherheitskonfiguration bleiben erhalten. Sicherungen aus Schema 6 werden beim Import um die bisherige BSV-Standardgestaltung ergänzt.
- Prüfung: 29 automatisierte Tests, Browserprüfung an einer getrennten Testinstanz (helles Farbschema, Name, Logo-Upload, erneutes Speichern) sowie isolierte Docker-Integrationstests einschließlich HTTPS. Bereitstellung und abschließende HTTPS-/Containerprüfung im bestehenden lokalen Stack.

## FR-005: Datensicherung mit Export und Import — 2026-10-28

- „Einstellungen → Datensicherung“ exportiert alle Anwendungsdaten und Einstellungen als konsistente, versionierte JSON-Datei mit SHA-256-Prüfsumme. Enthalten sind auch Zeitmessung, Vermietungen, ID-Zähler, Änderungsprotokoll sowie die gespeicherten Admin-Passwort- und Partien-PIN-Hashes. Dateilimit: 50 MiB. Sicherungen vertraulich außerhalb des Rechners aufbewahren.
- Import prüft Format, Schemaversion, Prüfsumme, Datentypen, Datenbankbedingungen, Beziehungen und grundlegende Zustandskonsistenz in einer getrennten temporären Datenbank. Die Vorschau zeigt Sicherungsdatum und Datenumfang. Erst „DATEN WIEDERHERSTELLEN“ und ein weiterer Klick ersetzen alle Daten atomar. Ungültige Dateien sowie geänderte Daten oder eine abgelaufene Vorschau verhindern den Import ohne Datenverlust.
- Eine erfolgreiche Wiederherstellung protokolliert den Vorgang, widerruft sämtliche Admin- und Tablet-Sitzungen und stellt das Passwort und die PINs aus der Sicherung wieder her. Laufende Zeiten zählen seit ihrem gespeicherten Start einschließlich Ausfallzeit weiter. README erläutert die Wiederherstellung auf einem neuen Laptop und die zusätzliche Sicherung von Installationsdateien und HTTPS-Zertifikaten; bestehende Secrets und Volumes bleiben erhalten.
- Prüfung: 28 automatisierte Tests erfolgreich, einschließlich Import in eine frische Datenbank, beschädigter Dateien, Berechtigungen, CSRF/Origin, Datenkonflikten, Vorschau/Abbruch/Bestätigung, Passwort- und PIN-Übernahme, Sitzungssperre sowie Neustartpersistenz. Isolierter Docker-Integrationstest einschließlich Export/Import über HTTPS erfolgreich. Mit `docker compose up -d --build --wait` im bestehenden lokalen Stack bereitgestellt; App und Proxy gesund, HTTPS über localhost und 127.0.0.1 mit validierter Zertifikatskette geprüft.

## FR-004: Seitennavigation für Listen — 2026-10-28

- Veranstaltungen, alle Begegnungen, laufende Partien, Ergebnisse und Buchungshistorie erhalten eine eigene Seitennavigation mit 10, 20, 50 oder 100 Einträgen; Standard sind 20. Zurück/Weiter, Eintragsbereich, Gesamtzahl und Seitenzahl zeigen die Position; an den Grenzen sind die Schaltflächen deaktiviert.
- Seitenauswahl und Größe bleiben pro Liste während der Sitzung bei Menüwechseln und automatischen Aktualisierungen erhalten. Größenwechsel beginnt auf Seite 1; nach Löschungen wird eine entfallene letzte Seite auf die letzte verfügbare Seite begrenzt. Formularentwürfe bleiben erhalten. Die feste Übersicht der acht Tische und Formularauswahlen bleiben vollständig.
- Prüfung: 22 automatisierte Tests erfolgreich, einschließlich Seitengrößen, Blättern, leerer Listen, Löschungen, unabhängiger Listen und Aktualisierungen. Browserprüfung mit 105 separaten Beispieleinträgen. Im bestehenden lokalen Stack mit `docker compose up -d --build --wait` bereitgestellt; App gesund, Proxy aktiv und HTTPS über localhost sowie 127.0.0.1 mit validierter Zertifikatskette geprüft.

## Rabattfeld und Einstellungen — 2026-10-27

- Preisauswahl-Dropdown entfernt; neue Vermietungen erhalten ein eigenes Rabattfeld (0–100 %) und eine sofortige Stundenpreisvorschau. Buchungskorrekturen bieten Stundenpreis und optionalen Rabatt als getrennte Felder, ohne Dropdown.
- Neuer Menüpunkt „Einstellungen“ bündelt den Grundpreis mit bestehender Warnbestätigung und den Admin-Passwortwechsel. Passwortwechsel verlangt das aktuelle Passwort und zwei übereinstimmende neue Eingaben (12–128 Zeichen), ist gegen CSRF und wiederholtes Raten geschützt und meldet alle Admin-Sitzungen ab.
- Schema 6 übernimmt den vorhandenen scrypt-Hash, speichert spätere Passwortwechsel dauerhaft im Datenvolume und protokolliert nur den Wechsel, keine Passwörter oder Hashes. Bestehende Secrets bleiben unverändert. Passwortfelder werden nicht als Formularentwürfe gespeichert.
- Prüfung: 20 automatisierte Tests erfolgreich, einschließlich Rabattvalidierung, Navigation, Passwortprüfung, Sitzungsausschluss, Neustartpersistenz und Audit ohne Zugangsdaten. Rabattvorschau und Einstellungen im Browser mit separater Testdatenbank geprüft. Isolierter Docker-Integrationstest erfolgreich; im bestehenden lokalen Stack mit `docker compose up -d --build --wait` deployt. App gesund, Proxy aktiv und HTTPS über localhost sowie 127.0.0.1 mit validierter Zertifikatskette geprüft.

## Tischvermietung: Warnbestätigungen und Buchungslöschung — 2026-10-27

- Mietabschluss zeigt Buchung, Tisch, festen Endzeitpunkt, Dauer und Abrechnungsbetrag. Wie gewünscht genügt „Vermietung abschließen“ ohne manuelle Texteingabe. Abbrechen lässt die Vermietung weiterlaufen. Gespeichert wird genau der angezeigte Endzeitpunkt.
- Aktive und abgeschlossene Buchungen können mit „BUCHUNG LÖSCHEN“ gelöscht werden. Der Dialog benennt den Verlust der Abrechnungsdaten und bei aktiven Buchungen die Tischfreigabe. Grundpreisänderungen zeigen alten und neuen Preis und verlangen „GRUNDPREIS ÄNDERN“. Bestehende Korrekturen verwenden weiterhin „BUCHUNG ÄNDERN“.
- Admin-, Aktions- und Versionsprüfungen sowie Auditdaten sichern die Aktionen ab. Gelöschte Buchungsnummern werden nicht erneut vergeben. Nur die identische Abschlusswiederholung bleibt ohne zusätzlichen Schreibvorgang möglich; nach Korrekturen werden alte Abschlussanfragen abgewiesen.
- Prüfung: 18 automatisierte Tests bestanden, einschließlich Frontend-Dialogabläufen, Abschluss ohne Texteingabe, Abbruch, Konflikten, Löschungen und Auditdaten. Isolierter Docker-HTTPS-Test und anschließende lokale Bereitstellung mit Zertifikats- und Containerprüfung.

## FR-002: Warnbestätigte Korrekturen und Löschungen auch nach Gesamtabschluss — 2026-10-27

- Administratoren können vergangene und abgeschlossene Veranstaltungen sowie abgeschlossene Partien korrigieren und löschen. Der Gesamtabschluss bleibt erhalten; Wiederaufnahme und Verschieben aus abgeschlossenen Veranstaltungen sind gesperrt. Tablet-Berechtigungen bleiben unverändert.
- Rote Warnungen nennen Eintrag und Änderungen; Veranstaltungslöschungen nennen zusätzlich die Anzahl der Partien und den Ergebnisverlust. Exakte, aktionsbezogene Texte müssen von Hand eingegeben werden. Einfügen, Kontextmenü und Drag-and-drop werden blockiert. Ausführung erfordert einen zusätzlichen Klick; Abbrechen und Escape verwerfen die Bestätigung.
- Auch Spielabschluss und Gesamtabschluss verwenden dieses Muster. Buchungskorrekturen nutzen denselben Eingabeschutz. Zwischenzeitliche Änderungen entwerten offene Warnungen; nach Fehlern ist erneutes Öffnen und Prüfen erforderlich.
- Serverseitige Aktions-, Text-, Admin- und Versionsprüfung innerhalb der Schreibtransaktion. Partienkorrekturen und -löschungen berücksichtigen auch die Veranstaltungsversion. Auditprotokolle erhalten die vorherigen Datenstände ohne PINs.
- Prüfstand: 17 automatisierte Tests einschließlich echter Frontend-Handler mit DOM/API-Fixture, Einfügeschutz, Abbruch, exakter Texteingabe, Versionskonflikten und Auditdaten. Isolierter Docker-HTTPS-Test mit Neustart, Containerersatz, Korrektur und kaskadierender Löschung nach Gesamtabschluss erfolgreich.
- Deployment: Bestehender lokaler Stack mit `docker compose up -d --build --wait`; HTTPS-Zertifikatskette und Containerzustand geprüft. Bestehende Secrets und Datenvolumes erhalten.

## FR-003: Tischvermietung mit minutengenauer Abrechnung und bearbeitbarer Historie — 2026-10-27

- Neuer Admin-Menüpunkt „Tischvermietung“ mit acht Tischkarten, laufenden Timern, aktuellen Preisen, Abschluss und dauerhafter Buchungshistorie. Vermietungen und laufende Partien schließen sich auf demselben Tisch aus; Transaktionen und ein eindeutiger Index verhindern parallele Vermietungen.
- Grundpreis standardmäßig 9,00 €/h, änderbar für neue Buchungen. Direktpreise und prozentuale Zu-/Abschläge werden vor dem Start angezeigt und mitsamt dem damaligen Grundpreis gespeichert. Eine gemeinsame Berechnung für Browser und Server rundet angefangene Minuten auf und rechnet in Cent ab.
- Abgeschlossene Buchungen können mit Zeit- und Preiskorrekturen bearbeitet werden. Der rote Dialog zeigt vorherige und neue Werte einschließlich Gesamtpreis und verlangt die manuelle Eingabe „BUCHUNG ÄNDERN“. Einfügen, Kontextmenü und Drag-and-drop sind gesperrt; Abbruch verwirft die Bestätigung. Admin-, Aktions- und Versionsprüfung sowie Auditprotokoll sichern die Änderung serverseitig ab. Die Buchung bleibt abgeschlossen.
- Datenbankschema 5 erweitert vorhandene Daten ohne Ersatz von Bestandsdaten. Wiederholte Abschlüsse erzeugen keine zusätzlichen Buchungen oder Auditabschlüsse. Tablet-PINs erhalten keine Vermietungsrechte.
- Prüfstand: 14 automatisierte Tests bestanden, einschließlich Rundungsgrenzen, Preisänderungen, Doppelbelegung, Tablet-Abweisung, Migration, Neustartpersistenz, veralteten Korrekturen und Auditdaten. Browserdurchlauf für Prozentpreis, Neuladen, Abschluss, Einfügeschutz, Abbruch und bestätigte Korrektur erfolgreich. Isolierter Docker-HTTPS-Test einschließlich Containerersatz und Vermietung erfolgreich.
- Deployment: Mit `docker compose up -d --build --wait` im bestehenden lokalen Stack bereitgestellt. App gesund, Proxy aktiv; HTTPS über localhost und 127.0.0.1 mit validierter Zertifikatskette erfolgreich. Bestehende Secrets und Datenvolumes erhalten.
- FR-002 bleibt als eigenständige Anforderung für Veranstaltungen und Partien offen; dessen Schutzmuster ist hier für Buchungskorrekturen umgesetzt.

## FR-001: Durchgängige Admin-Navigation und Tischübersicht als Home-Seite — 2026-10-27

Erfasst am 26.10.2026 · umgesetzt am 27.10.2026 · Implementierungscommit: `3753fd0`.

- Die Admin-Menüleiste und Abmeldung bleiben auch an freien Tischen, während der Spielvorbereitung und beim Zählen sichtbar. Die Sitzungsprüfung aktualisiert die Navigation auch bei unverändertem Spielstand.
- Menülinks führen aus jeder Tischansicht zur Verwaltung; einzelne Tische markieren die Tischübersicht als aktiv. Das Vereinslogo und die Verwaltungs-Startseiten öffnen die Tischübersicht. Eine neue Admin-Anmeldung setzt auch einen zuvor geöffneten Ergebnis- oder Spieltagslink auf die Tischübersicht zurück.
- Reine PIN-Sitzungen erhalten weiterhin keine Admin-Navigation oder Verwaltungsrechte. Frontend-Regressionstests decken Startseiten, Ansichten, Tischzustände, Sitzungswechsel und Anmeldung ab; API-Tests prüfen zusätzlich die Abweisung von Verwaltungszugriffen mit Partie-PIN.

- Prüfung: Alle zwölf automatisierten Tests bestanden. Lokal mit `docker compose up -d --build --wait` deployt; HTTPS mit validierter Zertifikatskette und Containerzustand erfolgreich geprüft. Bestehende Secrets und Datenvolumes erhalten.
- Umfang: Tischzählung, Spielvorbereitung und Zeitmessung bleiben unverändert; die entfernte Punkteübersicht wird nicht wieder eingeführt.

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
# Docker Desktop: fehlende Sicherheitskonfiguration

- Leere, von Docker angelegte `secrets/config.json`-Ordner werden beim Setup unter einem freien Sicherungsnamen erhalten; vorhandene Dateien und nicht leere Ordner werden nicht überschrieben.
- Die Konfigurationsdatei wird schreibgeschützt ohne automatische Host-Pfaderstellung eingebunden. Startfehler nennen Setup und erneutes Compose-Deployment als Abhilfe.
- Regressionstests prüfen Erstinstallation, Wiederholung, Ordner-Reparatur und Konfigurationsdiagnosen; der isolierte Docker-Smoke-Test nutzt dieselbe Einbindung.
