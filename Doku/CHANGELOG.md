# Release Notes

Diese Historie dokumentiert umgesetzte Features und Änderungen. Noch offene Anforderungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

## FR-013: Projektcleanup und sparsame Arbeitsweise — 2026-10-29

- Folgeänderung: Architekturübersicht anhand des Codes auf Schema 13 aktualisiert; Schemastände 1–13 und unterstützte Upgrade-/Importwege nach [Migrationen](Migrationen.md) ausgelagert. Lokalen Ausgabeordner `/output/` gezielt ignoriert; Dateien bleiben erhalten und veröffentlichte Bildpfade werden nicht ausgeschlossen. Lokale Dokumentationsverweise, Ignore-Regeln und Diff geprüft; lokales Deployment und HTTPS-Zertifikatsprüfung erneut erfolgreich.
- `AGENTS.md` ergänzt um gezielte Kontextsuche, Projekteinstiegspunkte, lokale vollständige Logs mit kompakter Ergebnisanzeige und risikobasierte Prüfungen. Commit und Push bleiben standardmäßig beim Entwickler; lokale Bereitstellung und alle Datensicherheitsregeln bleiben erhalten.
- [Analyse und Entscheidungsvorlage](Projektcleanup.md) dokumentiert Befunde sowie weitere Optionen mit Nutzen, Aufwand und Nachteilen. Keine gemessene Tokenreduktion behauptet; Anwendung und Datenmodell unverändert.
- Prüfung: Dokumentationsinhalt, lokale Markdown-Verweise und `git diff --check`. Keine Anwendungstests erforderlich für diese reinen Dokumentationsänderungen.
- Deployment: bestehender lokaler Stack mit beiden Compose-Dateien und `up -d --build --wait` erfolgreich gebaut und gestartet. App und PostgreSQL gesund, Proxy läuft. HTTPS `/health` mit bestehender Caddy-CA und aktiver Zertifikatsprüfung über Node geprüft (Windows-curl konnte den lokalen Zertifikatssperrstatus nicht prüfen). Stack bleibt aktiv; bestehende Konfiguration und Volumes erhalten.

## FR-006: Turnierverwaltung mit Auslosung, Gruppen und KO — 2026-10-29

- Turniere mit 2–64 aktiven Stammdatenspielern als Gruppenphase, Einfach-KO oder Gruppen + KO vorbereiten. Modus, Disziplin, Spielziel, Gruppenanzahl, Qualifikanten und Rangfolgeregel werden vor Beginn geprüft und angezeigt. Zufällige, gespeicherte Vorschau mit ausdrücklicher Übernahme; eine neue Auslosung verändert bestehende Partien erst bei Bestätigung und ist nach der ersten Tischzuweisung gesperrt.
- Vollständige Jeder-gegen-jeden-Gruppen mit Ergebnissen, Tabellen und Qualifikationsstatus. Siege, optional Differenz und erzielte Racks/Punkte, danach ausdrückliche Spielleitungsentscheidung mit Begründung. Ungeklärte Gleichstände verhindern die KO-Zuordnung.
- KO-Baum mit allen Runden, Paarungen, ausdrücklichen Freilosen, automatischem Siegerfortschritt und Turniersieger. Begegnungen nutzen die bestehende Tischzuweisung, Tablet-PIN, Ergebniserfassung und Historie. Gleichzeitige Turnierpartien derselben Person werden verhindert.
- Generierte Partien sind gegen Einzel-Löschung, Verschieben und Regel-/Teilnehmeränderungen geschützt. Bestätigte Ergebniskorrekturen sind vor Erzeugung abhängiger KO-Partien möglich; danach werden sie ausdrücklich gesperrt, auch bei noch nicht gestarteten Folgepartien. Endgültig abgeschlossene Gruppenturniere sperren Ergebniskorrekturen wegen möglicher neuer Gleichstände.
- Persistenz in bestehenden Veranstaltungsmetadaten (Turnierformat Version 1) und regulären Partien; Schema 13 benötigt keine Datenmigration. Vollständige Sicherung und Importprüfung umfassen Vorschau, Regeln, Namensstände, Entscheidungen, KO-Verweise, Ergebnisse, PIN-Hashes und Audit. Die separate Betriebssicherung bleibt erforderlich.
- Prüfung: 46 automatisierte Tests erfolgreich, darunter Gruppenpaarungen und Freilose für 2–64 Teilnehmer, alle drei Modi, Gleichstände, Tablet-Erfassung, Korrektursperren, Neustart, beschädigte Sicherungen und vollständige Wiederherstellung in eine getrennte Datenbank. Isolierter Docker-Test mit PostgreSQL und HTTPS einschließlich Turnierfortschritt, Backup-Restore und Datenbankneustart erfolgreich. Auslosungsvorschau und Neuladen zusätzlich im Browser mit isolierten Testdaten geprüft; Formulare behalten Mehrfachauswahl und Entscheidungsreihenfolge bei Aktualisierungen. Veranstaltungs-Deep-Links korrigiert.
- Deployment: bestehenden Stack mit expliziter Compose-Override-Datei gebaut und gestartet. Vorherige Anwendungssicherung und PostgreSQL-Dump unter `backups/fr006-20261029-1793253929545/`. Alle 20 Bestandstabellen vollständig verglichen; unveränderte `.env`, Sicherheitskonfiguration und Caddy-CA bestätigt. App und Datenbank gesund, Proxy aktiv; HTTPS-Zertifikatskette und neue Oberfläche über localhost sowie 127.0.0.1 geprüft. Stack bleibt aktiv.

## Spielabschluss mit verzögertem OK — 2026-10-28

- Beim Abschließen einer Partie entfällt die Texteingabe. Der Dialog zeigt den Endstand und einen OK-Button mit fünf Sekunden Wartezeit; danach ist eine ausdrückliche Bestätigung möglich. Gilt in der Tischübersicht und am Tablet.
- Abbrechen oder Escape verwirft den Countdown; erneutes Öffnen startet die Wartezeit neu. Zwischenzeitlich geänderte Spielstände sperren den Abschluss weiterhin. Andere Bestätigungsdialoge behalten ihr bisheriges Verhalten.
- Prüfung: 43 Tests erfolgreich, einschließlich Sperre bis 4.999 ms, Freigabe nach 5.000 ms, Abbruch, erneutem Öffnen und veralteten Daten.

## FR-007-Fix: Kaderauswahl und geordnete Einstellungen — 2026-10-28

- Liga-Spieltagsstart öffnet zuerst die zwei Mannschaften und darunter getrennte Kader mit Checkboxen. Importierte Mannschaften und gemeldete Spieler sind vorausgewählt; fremde Kader erscheinen nicht. Bestätigung speichert Teilnehmer und startet den Spieltag atomar. Anschließend Spieler und Tisch je Partie der ersten Runde zuweisen.
- Pro Mannschaft kann ein zusätzlicher Name nur für diesen Spieltag erfasst werden. Weitere Gäste können bei erneutem Öffnen hinzugefügt werden. Gäste bleiben aus den Stammdatenlisten und anderen Spieltagen ausgeschlossen; gespeicherte Partien und historische Zuordnungen bleiben erhalten.
- Einstellungen in einer Spalte: Vereinsgestaltung, Tische, Grundpreis, beide nuLiga-Abgleiche, Admin-Passwort und Datensicherung. Die Planung verlinkt zum gemeinsamen nuLiga-Bereich.
- Schema 13 ergänzt die Spieltagsbindung der Gäste. Automatische Migration aus Schema 12, vollständiger Export, Prüfung und Wiederherstellung einschließlich Gäste und Aufstellungen; kompatibler Import älterer Sicherungen aus Schema 6–12. Separate Betriebssicherung bleibt erforderlich.
- Prüfung: 43 Tests erfolgreich; isolierter Docker-HTTPS-Test mit PostgreSQL-Migration aus Schema 8 und 12, Gastspieler-Übernahme und vollständiger Wiederherstellung in getrennte Datenbanken erfolgreich. Browserprüfung von Kaderauswahl, zusätzlichem Gast, Bestätigung, Aufstellung/Tischwahl und Einstellungsreihenfolge mit isolierten Testdaten durchgeführt.
- Deployment: Bestehenden lokalen Stack mit expliziter Compose-Override-Datei gebaut und gestartet (die vorhandene `.env` legt nur `compose.yaml` fest). Vorherige Datenbanksicherung unter `data/fr007-pre-deploy/database.dump`; Schema 13 und gesunde Container geprüft. HTTPS über localhost und 127.0.0.1 mit Node.js und expliziter lokaler Caddy-CA erfolgreich verifiziert; Windows curl verlangt eine bei der lokalen CA nicht vorhandene Sperrstatusauskunft.

## FR-007: Spieler- und Mannschaftsverwaltung — 2026-10-28

- Eigener Menüpunkt **Spieler & Mannschaften** mit durchsuchbarer Spielerliste, stabilen IDs, Doppelhinweisen, BSV-Mannschaften, Spielerzuordnung und Archivierung für die künftige Vorauswahl. Ausschließlich Vorname, optionaler zweiter Name und Nachname als personenbezogene Stammdaten.
- Spieltagsteilnehmer für Liga und Turnier auswählen; Liga-Mannschaften mit Mitgliedervorauswahl. Begegnungen verwenden diese Teilnehmer und verhindern Selbstbegegnungen. Freie Namen bleiben möglich. Nachträgliche Stammdatenzuordnung erfolgt ausdrücklich über die Partiebearbeitung.
- Namen und Mannschaftszuordnung werden pro Partie gespeichert. Umbenennung, Mannschaftswechsel und Archivierung verändern frühere Partien nicht. Spieler- und Mannschaftsansichten zeigen alle zugeordneten Partien sowie abgeschlossene Ergebnisse mit Anzahl, Siegen, Niederlagen und Racks; Zeitraum nach Spieltagsdatum und Disziplin filterbar. Mannschaftswerte zählen die zugeordneten Spielerseiten der Einzelpartien, keine Gesamtwertung eines Liga-Spieltags.
- Schema 9 erweitert vorhandene Datenbanken transaktional; vollständige Sicherung, Vorschau und Wiederherstellung erfassen alle neuen Tabellen und historischen Zuordnungen. Ältere Sicherungen aus Schema 6/7/8 werden ohne automatische Personenverknüpfung übernommen. Separate Betriebssicherung bleibt erforderlich.
- Prüfung: 34 automatisierte Tests erfolgreich, darunter Statistikfilter, Rechte, Pflichtfelder, Doppelhinweise, Selbstbegegnungsschutz, Historienerhalt, Archivierung, Neustart und vollständige Wiederherstellung in eine getrennte Datenbank. Erweiterter isolierter Docker-HTTPS-Test mit PostgreSQL-Stammdaten, Bestandsmigration von Schema 8, vollständiger SQLite-Übernahme und Wiederherstellung sämtlicher neuer Daten in eine getrennte PostgreSQL-Datenbank erfolgreich.
- Deployment: vollständige Sicherung vor und nach Migration unter `backups/fr007-20261028/`. Lokalen Stack mit `docker compose -f compose.yaml -f compose.override.yaml up -d --build --wait` aktualisiert. Alle bisherigen Tabellen vollständig mit dem vorherigen Stand verglichen; neue Bereiche leer. Prüfsummen bestätigen unveränderte `.env` und Sicherheitskonfiguration. App, Datenbank und Proxy gesund; HTTPS über localhost und 127.0.0.1 mit geprüfter Zertifikatskette erreichbar. Stack bleibt aktiv.

## FR-012: PostgreSQL im eigenen Container — 2026-10-28

- SQLite als laufende Datenbank durch PostgreSQL 17 im eigenen Compose-Dienst ersetzt. Eigenes persistentes Volume, internes Datenbanknetz, Healthcheck und Startabhängigkeit; kein veröffentlichter Datenbankport. Der interne Datenbankzugang wird aus der vorhandenen Sicherheitskonfiguration abgeleitet, ohne diese oder die Benutzerzugänge zu verändern. Der Treiber wird mit einer Lockdatei reproduzierbar installiert.
- Asynchrone, parametrisierte Datenbankzugriffe und transaktionale Sperren erhalten Versionsprüfungen und verhindern doppelte Tischbelegung. Die erste Initialisierung übernimmt sämtliche SQLite-Tabellen aus einer konsistenten Kopie, migriert bei Bedarf die Kopie, vergleicht alle Zeilen und bestätigt den Abschluss atomar. Die Originaldatei bleibt unverändert erhalten und wird bei späteren Starts nicht erneut importiert.
- Vollständiger JSON-Export, Datenprüfung und atomare Wiederherstellung für PostgreSQL; bisherige Sicherungen aus Schema 6/7/8 bleiben kompatibel. Tabellen und Spalten werden aus dem installierten Schema ermittelt. Einstellungen, Logo, Farben, Zugangsdaten-Hashes und Protokoll bleiben vollständig enthalten; fehlende Daten werden abgewiesen. Audit-IDs werden nach Wiederherstellung korrekt und transaktional fortgesetzt. PostgreSQL-Dump, zusätzliche Betriebssicherung und Rückkehr zum SQLite-Rückfallstand sind dokumentiert.
- Prüfung: 32 automatisierte Tests erfolgreich. Isolierter Docker-HTTPS-Test mit Quellcode-Build sowie Betrieb ausschließlich mit fertigem Image erfolgreich. Zusätzliche Prüfungen für vollständige SQLite-Übernahme, unveränderten Altbestand, Neustart ohne erneute Übernahme, Restore in eine getrennte PostgreSQL-Datenbank, neue Tabellen, ungültige Importe, fehlgeschlagene Migration mit Rollback, konkurrierende Buchungen und Datenbankneustart mit automatischer Wiederverbindung.
- Deployment: bisherige Daten unter `backups/fr012-20261028/` gesichert; bestehenden Stack mit lokalem Build und unveränderter Projektzuordnung aktualisiert. Alle zehn Anwendungstabellen mit der vorherigen Sicherung vollständig verglichen. App, PostgreSQL und Proxy gesund; HTTPS über localhost und 127.0.0.1 mit geprüfter Zertifikatskette erreichbar. Prüfsummen bestätigen unveränderte `.env`, Sicherheitskonfiguration, alte SQLite-Datei und Caddy-CA. Stack bleibt aktiv. Eine Veröffentlichung auf GitHub/GHCR ist damit nicht verbunden.

## FR-011: Einstellbare Tischanzahl — 2026-10-28

- Unter **Einstellungen → Tischanzahl** lassen sich 1 bis 20 Tische speichern (Standard 8). Übersicht, Belegungszähler, Tischzuweisung, Vermietung und Tablet-Adressen übernehmen die Einstellung; auch zweistellige Tischnummern sind nutzbar.
- Eine Verringerung ist erst möglich, wenn alle entfallenden Tische frei sind. Abgeschlossene Partien und Buchungen behalten ihre historischen Tischnummern und bleiben korrigierbar. Adminrechte, Origin/CSRF und eine Versionsprüfung schützen Änderungen; Formularentwürfe enthalten ihre ursprüngliche Version und können verworfen werden. Änderungen erscheinen im Auditprotokoll.
- Schema 8 übernimmt alle vorhandenen Daten transaktional, erweitert die Tischgrenzen und speichert die Tischanzahl im bestehenden Datenvolume. Vollständige Sicherungen enthalten die neue Einstellung automatisch; Importprüfung und Wiederherstellung berücksichtigen sie einschließlich Belegungskonsistenz. Sicherungen aus Schema 6/7 werden auf acht Tische ergänzt, Schema 6 erhält zusätzlich die Standardgestaltung. Die separat dokumentierte Betriebssicherung bleibt erforderlich.
- Prüfung: 32 automatisierte Tests einschließlich Bestandsmigration, Grenzwerten, Berechtigungen, Belegungsschutz, Tablet-Zugang, Historie, Neustart und vollständigem Restore in eine getrennte Datenbank. Isolierter Docker-HTTPS-Test einschließlich Tisch 20, Verringerungsschutz und Export/Import erfolgreich.
- Deployment: konsistente Datenbanksicherung vor Migration unter `backups/fr011-20261028/billard-before.sqlite`. Bestehenden Stack mit expliziter lokaler Build-Ergänzung aktualisiert (`docker compose -f compose.yaml -f compose.override.yaml up -d --build --wait`), da die Standardauswahl das veröffentlichte Image verwendete. App gesund, Proxy aktiv, HTTPS-Zertifikatskette über localhost und 127.0.0.1 geprüft. Prüfsummen bestätigen unveränderte Bestandsdaten, `.env` und Sicherheitskonfiguration; vorhandene Datenvolumes und CA weiterverwendet. Stack bleibt aktiv.

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

## 2026-10-28 – nuLiga-Synchronisierung

- Aktuelle BSV-Ligen, sämtliche Mannschaften und gemeldete Spieler importieren; erneuter Abgleich ohne Duplikate.
- Einstellungen mit Sync-Status und Auswahl zum Erhalten oder Überschreiben lokaler Änderungen.
- Eigene Mannschaft und Gegner im Spieltag auswählen; Spieler mit Mannschaftsbezeichnung in der Partie auswählen.
- Datenbankschema 10 mit Migration und vollständiger Sicherung der Importzuordnungen.

- Spieler und Mannschaften in getrennten Listen; Mannschaften neben Spielernamen anzeigen.
- nuLiga-Profillinks für importierte Spieler; lokale Statistikbuttons in der Spielerliste für BSV-Spieler.

- Mannschaftsstatistikbuttons und lokale Statistikansicht im Mannschaftsbereich durch direkte nuLiga-Mannschaftslinks ersetzt.

## 2026-10-28 – Geplante Spieltage und zweiter nuLiga-Sync

- Eigenes Menü für manuelles Anlegen und Import aller kommenden BSV-Spieltage.
- Expliziter Spieltagsstart öffnet die passende Übersicht für Teilnehmer, Einzelpartien und Tischzuweisung.
- Importierte Spieltage belegen keine Tische und erzeugen keine Einzelpartien; gestartete Termine bleiben beim Sync unverändert.
- Schema 11 sichert Planungszustände und Importinformationen vollständig; ältere Veranstaltungen bleiben nutzbar.

## 2026-10-28 – Feste Spieltagsübersicht

- Zehn definierte Partien in drei Runden, mit Spieler- und Tischauswahl je Partie.
- Doppel mit zwei Spielern je Mannschaft; Aufstellungen speichern und Partien starten getrennt.
- Spielziele vor jedem Start manuell festlegen, einschließlich 14/1 als Punktewertung bis 999.
- Schutz vor Tisch- und Spielerkonflikten; vollständige Sicherung der Aufstellungen in Schema 12.

- Spieltags-Sync auf BSV-Heimspiele begrenzt; alte Auswärtsimporte ohne Einzelpartien werden entfernt und protokolliert. Heimmannschaft steht stets links.
