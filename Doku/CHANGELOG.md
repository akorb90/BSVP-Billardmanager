# Release Notes

Diese Historie dokumentiert umgesetzte Features und Änderungen. Noch offene Anforderungen stehen in den [Feature Requests](FEATURE_REQUESTS.md).

## FR-014.3–FR-014.5: Getränkemiete, geprüfter Abschluss und Reporting — 2026-11-08

- FR-014.3: Pflichtkommentar beim Mietstart (getrimmt, maximal 200 Zeichen), Kennzeichnung fehlender Altkommentare und protokollierte Bearbeitung. Namensaktion in der Buchungshistorie und eigener Tischkarten-Button öffnen ein Overlay mit getrennten Kommentar-, Buchungs- und Historienbereichen. Getränkepositionen und Lagerabgänge entstehen gemeinsam in einer Transaktion mit historischer Bezeichnung/VK. Tischmiete und Getränkesumme bleiben getrennt; Rabatte gelten nur für die Tischmiete. Eindeutige Vorgänge, gemeinsame Mietversion und PostgreSQL-Sperre verhindern Doppel- und Teilbuchungen. Stornos verlangen Grund und ausdrückliche Entscheidung zur tatsächlichen Lagerrückgabe; Tablet-Partiezugänge haben keinen Schreibzugriff.
- FR-014.4: Server signiert die Abschlussvorschau mit festem Endzeitpunkt, Mietdauer und getrennten Summen. Zunächst leere Einzelcheckboxen für Tischmiete und alle wirksamen Getränkepositionen; der Server prüft die genaue Bestätigungsmenge und Versionsstände. Änderungen entwerten Vorschauen, exakte Wiederholungen schließen nur einmal ab. Abgeschlossene Getränkemieten erfordern auch bei späteren Getränke-, Miet- oder Kommentaränderungen eine neu geprüfte Aufstellung. Originalnachweise und Stornos bleiben erhalten; Vermietungen mit Getränkebewegungen können nicht gelöscht werden. Bestätigung bedeutet Aufstellungsprüfung, keine Zahlung.
- FR-014.5: Monatsdashboard mit kombinierbaren Von-/Bis-Grenzen und gemeinsamem Reset. Verbrauch und Wareneingänge zählen nach Bewegungszeit; Abschlusswerte nach Mietende, offene Vermietungen separat. Europe/Berlin einschließlich Sommerzeit, aktuelle Bestände/Mindestbestände, tatsächliche bekannte Wareneingangs-EK und EK-Lücken; keine behauptete historische Marge. Nachträgliche Korrekturen kennzeichnen die Neuberechnung der ursprünglichen Abschlussperiode mit Protokollnummer und Zeitpunkt.
- Schema 16 ergänzt Mietkommentare, rental_drinks, rental_checks und rental_operations. Automatische vollständige Sicherung einschließlich historischer Preise, Lager-/Stornobezüge, Bestätigungen und Wiederholantworten; fachliche Importprüfung und Migration von Schema-6–15-Backups. Getrennte Testdatenbanken belegen vollständigen Restore sämtlicher Anwendungstabellen und den atomaren Ausschluss manipulierter Sicherungen. Separate Betriebssicherung bleibt erforderlich. Bedienung und Grenzen stehen in [Lagerverwaltung](Lagerverwaltung.md), Schemawege in [Migrationen](Migrationen.md).
- Prüfstand: finale Gesamtsuite **150/150**, keine Fehler oder Skips. Betroffene Miet-/UI-/Backup-Tests erfolgreich; finaler isolierter PostgreSQL-/HTTPS-/Docker-Test einschließlich neuer Getränkemiete, Wiederholschutz, Einzelbestätigungen, Reporting, Schema-Upgrades und Backup/Restore erfolgreich. Frühe Testläufe deckten Endzeitabgleich und anzupassende Legacy-/UI-Testannahmen auf; vor Abschluss korrigiert. npm ist nicht installiert; identische package.json-Skripte direkt mit Node ausgeführt. Vollständige Logs: data/fr014-20261108/; Docker-Testbericht: data/docker-test-zlP1G9/.
- Deployment: bestehendes Compose-Projekt billardmanager mit beiden Compose-Dateien gebaut und bereitgestellt. PostgreSQL-Dump vorab gesichert; sämtliche 26 bisherigen Anwendungstabellen nach Deployment per Prüfsumme unverändert, drei neue Tabellen leer. App/PostgreSQL gesund, Proxy aktiv; HTTPS mit CA-/Hostnamenprüfung, neue Frontend-Funktionen und Zugriffsschutz geprüft. .env, Secrets und Datenvolumes erhalten, keine Testdaten übernommen. Stack bleibt aktiv. Oberflächenabläufe automatisiert geprüft; eine manuelle Abnahme auf echten Tablets steht aus.

## FR-014.2: Schnellerfassung, Wareneingangsvorlagen und Inventur — 2026-11-02

- Wareneingang und Inventur als tabellarische Eingabelisten mit serverseitiger Vorschau und expliziter gemeinsamer Bestätigung. Bis zu 100 unterschiedliche Getränke je Vorgang; Fehler oder veraltete Artikel-/Bestandsversionen verhindern die gesamte Buchung. Transaktionale Kindbewegungen und dauerhaft gespeicherte Vorgangskennungen verhindern Teil- und Doppelbuchungen. Wiederholerkennung verarbeitet jetzt auch eine andere JSON-Feldreihenfolge; bisherige Vorgangskennungen bleiben kompatibel.
- Letzte 20 Wareneingänge als neue editierbare Eingabe übernehmen. Benannte Vorlagen mit Mengen, Gebinden und bekanntem oder unbekanntem EK dauerhaft speichern und im Overlay bearbeiten, einschließlich Entfernen und Ergänzen von Getränken. Vorlagen verändern keinen Bestand. Archivierte Artikel müssen vor Buchung korrigiert werden; geänderte Gebindegrößen werden angezeigt. Filterbare Vorlagentabelle und Nachbestellliste mit Fehlmengen ergänzt.
- Inventur zeigt Soll-/Istbestand und Differenz; jede tatsächliche Abweichung benötigt einen Grund. Leere Ist-Felder bleiben unberücksichtigt, ausdrücklich null bedeutet leer. Bestätigte Übereinstimmungen werden als Inventurnachweis gespeichert und erzeugen keine Nullbewegung. Noch unbestätigte Vorschauen müssen nach einem App-Neustart neu geprüft werden.
- Schema 15 speichert sämtliche Vorlagen und Sammel-/Inventurnachweise einschließlich historischer Werte, Bewegungsanker und Wiederholantworten im automatisch vollständigen Anwendungsbackup. Import prüft Mengen, Referenzen, Bestandsrekonstruktion und Wiederholkonsistenz. Schema 14 behält alle Lagerdaten und erhält leere neue Tabellen; Schema-6–13-Backups werden weiter unterstützt. Die zusätzliche Betriebssicherung bleibt erforderlich.
- Prüfstand: 94 betroffene Tests und abschließend 53 Navigationstests erfolgreich; finale Gesamtsuite **145/145**, keine Skips. Finaler isolierter PostgreSQL-/Backup-/HTTPS-/Docker-Test erfolgreich, einschließlich Sammelwareneingang, gespeicherter Vorlage, Wiederholschutz und Inventur. Getrennte Export-/Restore-Daten prüfen auch manipulierte Sicherungen, Schema-14-Migration und einen absichtlich erzwungenen Fehler nach der ersten Teilbuchung mit vollständigem Rollback. Ein erster Backendlauf erkannte die JSON-Feldreihenfolge beim Wiederholen als Konflikt; nach Korrektur vollständig erfolgreich. npm fehlt; identische Skripte direkt mit Node ausgeführt. Logs: data/fr014-2-2026-11-02/.
- Browser-Abnahme mit eigenem kurzlebigem PostgreSQL und echtem Testserver: Vorlage ohne Bestandsänderung gespeichert, 43 und 6 Flaschen gemeinsam eingebucht, begründete Inventurdifferenz auf 41 Flaschen bestätigt sowie Vorlagenposition entfernt/ergänzt und Nachbestellliste geprüft. Testinstanz anschließend vollständig entfernt; keine Testdaten in den laufenden Vereinsbestand übernommen.
- Lokal im bestehenden Compose-Projekt mit beiden Compose-Dateien gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy aktiv; HTTPS mit CA-/Hostnamenprüfung und neue Frontend-Funktionen/Zugriffsschutz geprüft. Vollständiger Vergleich aller bisherigen Anwendungstabellen vor/nach Deployment identisch, neue Tabellen leer. Sicherungen: backups/fr014-2-2026-11-02/. Stack bleibt aktiv; kein Commit oder Push. Offen bleiben FR-014.3 bis FR-014.5.

## Gebinde als Tabelle und verbindlicher Oberflächenstandard — 2026-11-02

- Im Getränke-Overlay zeigt der Bereich Gebinde eine zentrale Tabelle mit Namen und Flaschenanzahl. Namens- und Größenfilter sind kombinierbar und gemeinsam zurücksetzbar. Klick auf Namen oder Zeile öffnet die Bearbeitung des gewählten Gebindes; „Zur Gebindeübersicht“ kehrt ohne Speichern zur Tabelle zurück. Neue Gebinde werden über einen eigenen Button angelegt. Die ursprünglich angezeigten Daten und deren Version bleiben beim Öffnen der Bearbeitung erhalten, damit zwischenzeitliche Änderungen nicht unbemerkt überschrieben werden.
- Der Tabellenstandard für künftige Verwaltungsansichten ist auf Benutzerwunsch in `AGENTS.md` festgehalten: zentrale Tabellen, Namensklick zur Overlay-Bearbeitung, eigene Neuanlage, passende Spaltenfilter und Untermenüs für umfangreiche Nebenansichten.
- Prüfstand: 48 betroffene Navigationstests und Gesamtsuite **138/138** erfolgreich, ohne Skips; Syntaxprüfung und git diff --check erfolgreich. Mehrere Gebinde, sichere Namensausgabe, gezielte Bearbeitung, Neuanlage, Filterkombination, Rückkehr sowie ursprüngliche Versionsbindung gezielt geprüft. npm fehlt; identische Skripte direkt mit Node ausgeführt. Keine Server-, Datenbank- oder Backupänderung. Logs: `data/fr014-packages-table-2026-11-02/`.
- Lokal im bestehenden Compose-Projekt gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy aktiv; HTTPS mit CA-/Hostnamenprüfung und neue Frontend-Auslieferung geprüft. Stack bleibt aktiv; kein Commit oder Push.

## Kombinierter Lagerstatusfilter — 2026-11-02

- Der Statusfilter bietet zusätzlich **Leer + Nachbestellen** und zeigt beide Gruppen gemeinsam. Auch leere aktive Getränke mit Mindestbestand null werden erfasst; ausreichende und archivierte Artikel bleiben ausgeschlossen.
- Prüfstand: 46 betroffene Navigationstests und Gesamtsuite **136/136** erfolgreich, ohne Skips. Kombinierte Auswahl und Erhalt nach Aktualisierung gezielt geprüft; Syntaxprüfung und git diff --check erfolgreich. npm fehlt; identische Skripte direkt mit Node ausgeführt. Keine Server-, Schema- oder Backupänderung. Logs: `data/fr014-status-combined-2026-11-02/`.
- Lokal im bestehenden Compose-Projekt gebaut und bereitgestellt. HTTPS mit CA-/Hostnamenprüfung und neuer Filter geprüft; App/PostgreSQL gesund, Proxy aktiv. Stack bleibt aktiv; kein Commit oder Push.

## Lagerstatus mit Ampelfarben und Leerzustand — 2026-11-02

- Ausreichend erhält einen grünen, Nachbestellen einen orangenen und Leer einen roten Hintergrund. Aktive Getränke mit null Flaschen sind unabhängig vom Mindestbestand leer; positive Bestände unter Mindestbestand sind nachzubestellen. Archivierte Artikel behalten ihren Archivstatus. Der Statusfilter unterscheidet alle Zustände; der Bestandsfilter „Unter Mindestbestand“ umfasst weiterhin sämtliche tatsächlichen Mindestbestandsunterschreitungen.
- Prüfstand: 46 betroffene Navigationstests und Gesamtsuite **136/136** erfolgreich, ohne Skips; Syntaxprüfung und git diff --check erfolgreich. Statuspriorität bei Mindestbestand null und Übereinstimmung von Anzeige und Filtern gezielt geprüft. npm fehlt; identische Testskripte direkt mit Node ausgeführt. Keine Server-, Datenbank- oder Backupänderung. Logs: `data/fr014-status-2026-11-02/`.
- Lokal im bestehenden Compose-Projekt gebaut und bereitgestellt; App/PostgreSQL gesund, Proxy aktiv. HTTPS mit CA-/Hostnamenprüfung und ausgelieferte Statuslogik/Farben geprüft. Stack bleibt aktiv; kein Commit oder Push.

## Lagerverwaltung: zentrale Tabelle, Spaltenfilter und Bearbeitungs-Overlay — 2026-11-02

- Die Bestandstabelle ist die zentrale Arbeitsansicht. Klick auf Getränkename oder Tabellenzeile öffnet ein Overlay mit Bestand buchen, Stammdaten und Gebinden; Neuanlage erfolgt ebenfalls im Overlay. Übersichtliche Formulare mit zwei Spalten am Desktop, einer Spalte auf kleinen Bildschirmen und dauerhaft erreichbarem Schließen-Knopf. Fehlgeschlagenes Speichern erhält Eingaben und Vorgangskennung; Erfolg schließt das Overlay und aktualisiert die Übersicht.
- Alle acht Spalten sind filterbar: Getränkename mit Vorschlägen, vorhandene Flaschengrößen, VK-/EK-Vorgaben einschließlich unbekanntem EK, Mengenbereiche, leere Bestände, Fehlmengen und Aktiv-/Archiv-/Nachbestellstatus. Filter wirken gemeinsam und bleiben bei Aktualisierungen und Untermenüwechseln erhalten. Trefferzahl und gemeinsames Zurücksetzen ergänzt. Filter sind temporärer Ansichtsstand, keine neue dauerhaft gespeicherte Einstellung.
- Bewegungshistorie und Gegenbuchung in das Untermenü Lagerbewegungen verlegt; die Hauptansicht enthält ausschließlich Tabelle und zugehörige Bedienelemente. Optionaler EK und die bei Wareneingang optionale Begründung sind nun auch im Browser tatsächlich optional; bei Bruch, Eigenverbrauch und Inventurdifferenz bleibt der Grund Pflicht. Serverseitige Prüfungen und Bestandsführung unverändert.
- Prüfstand: 47 betroffene Navigations-/Warnungsdialogtests und abschließende Gesamtsuite **135/135** erfolgreich, keine Skips. Browserprüfung in getrennter Vorschau mit Testdaten: Filter, alle Overlay-Bereiche, Untermenü, optionale EK-Felder, Pflichtgrund nach Bewegungsart und Umrechnung von zwei 20er-Kästen plus drei Flaschen geprüft. Erster gezielter Lauf benötigte eine Ergänzung des Browser-Testmodells; die erste Gesamtsuite scheiterte an der bisherigen Ausschnittserkennung eines Warnungsdialogtests. Nach Korrektur vollständig erfolgreich. Syntax, Dokumentationsverweise und git diff --check geprüft. npm fehlt; identische Testskripte direkt mit Node ausgeführt. Keine Server-, Schema- oder Backupänderung. Logs und Vorschauaufnahmen: `data/fr014-table-overlay-2026-11-02/`.
- Lokal im bestehenden Compose-Projekt mit beiden Compose-Dateien gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy aktiv; HTTPS mit CA-/Hostnamenprüfung sowie neue Assets und Zugriffsschutz geprüft. Vollständige Anwendungsdatenprüfsumme vor/nach Deployment identisch, einschließlich der zuvor angelegten Testgetränke und Bestände. Stack bleibt aktiv; kein Commit oder Push.

## Lagerbestand als zentrale Übersicht — 2026-11-02

- Die Lagerverwaltung zeigt oberhalb der Getränkekarten eine Tabelle „Lagerbestand“ mit aktuellem Flaschenbestand, Mindestbestand, Fehlmenge und Nachbestellstatus. Eine Zusammenfassung zählt aktive Getränke, deren Flaschen und Mindestbestandsunterschreitungen; archivierte Artikel bleiben gekennzeichnet sichtbar. Bei leerem Lager erklärt die Ansicht die Anlage und Erfassung des Anfangsbestands.
- Prüfstand: 41 betroffene Navigationstests und Gesamtsuite 131/131 erfolgreich, keine Skips; Syntaxprüfung und git diff --check erfolgreich. Der erste Testaufruf hatte keinen Docker-Zugriff aus der Sandbox; der isolierte Testlauf außerhalb der Sandbox bestand. npm fehlt auf dem Host; identische Testskripte direkt mit Node ausgeführt. Keine Server-, Schema- oder Backupänderung. Logs: `data/fr014-stock-2026-11-02/`.
- Im bestehenden lokalen Compose-Projekt gebaut und bereitgestellt; HTTPS mit CA-/Hostnamenprüfung sowie aktualisierte Frontend-Auslieferung geprüft. App und PostgreSQL gesund, Proxy aktiv. Stack bleibt aktiv; kein Commit oder Push.

## FR-014.1: Getränke und Lagerbewegungen — 2026-11-02

- Abschließende Prüfung vor Commit/Push: Gesamtsuite 136/136 ohne Skips und isolierter PostgreSQL-/Backup-/HTTPS-/Docker-Test erfolgreich. Der HTTPS-Lagerfall ist ausdrücklich im Smoke-Skript enthalten und prüft 43 → 41 Flaschen, Wiederholschutz und Zugriffsschutz. Protokolle: `data/fr014-push-2026-11-02/`.
- Neuer Bereich **Lagerverwaltung** für die angemeldete Spielleitung: Getränke mit Flaschengröße, verpflichtendem VK, optionalem EK, Mindestbestand und Archivierung; mehrere benannte, bearbeitbare Gebinde je Getränk. Bestand in Einzelflaschen, Umrechnungsvorschau und Mindestbestandshinweise.
- Anfangsbestand, Wareneingang, Verbrauch, Bruch, Eigenverbrauch und begründete Inventurdifferenzen sowie einmalige Gegenbuchungen mit Pflichtgrund. Historische Artikel-, Gebinde- und Preisstände bleiben erhalten. Transaktionen, Versionsprüfung und dauerhaft gespeicherte Vorgangskennungen schützen vor Parallelkonflikten, negativen Beständen und Doppelbuchungen; Gegenbuchungen bleiben bei archivierten Artikeln möglich. Tablet-Partiezugänge erhalten keinen Lagerzugriff.
- Schema 14 ergänzt sämtliche Lagertabellen im automatischen Anwendungsbackup. Die Importprüfung rekonstruiert Bestände und prüft Mengen, historische Werte und Gegenbezüge. Schema-6–13-Sicherungen und bestehende PostgreSQL-Stände werden ohne fiktive Bestände übernommen. Vollständiger Export/Restore einschließlich Vorgangskennungen mit getrennten Testdaten geprüft; separate Betriebssicherung bleibt erforderlich.
- Prüfstand: 83 betroffene Tests und 7 gezielte Altbackup-Nachprüfungen erfolgreich; abschließende Gesamtsuite **131/131**, keine Skips. Isolierter PostgreSQL-/Backup-/HTTPS-/Docker-Test erfolgreich, einschließlich 43 → 41 Flaschen, Wiederholschutz und Zugriffsschutz. npm fehlt auf dem Host; identische Skripte direkt mit Node ausgeführt. Erste Läufe scheiterten an Docker-Startproblemen, danach an drei veralteten Altbackup-Testdateien und einer falschen Login-Reihenfolge im neuen Smoke-Test; nach Korrektur vollständig grün. Logs und Prüfhistorie: `data/fr014-1-2026-11-02/`.
- Im bestehenden lokalen Compose-Projekt mit beiden Compose-Dateien gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy aktiv; HTTPS mit CA-/Hostnamenprüfung und neue Lagernavigation erfolgreich geprüft. Sämtliche bisherigen Anwendungstabellen vor/nach Deployment identisch; neues Lager leer. Lokale Sicherungen vor/nach Deployment: `backups/fr014-1-2026-11-02/`. Stack bleibt aktiv; kein Commit oder Push.
- FR-014 bleibt für Sammelerfassung/Inventur, Vermietungskommentar und Getränkebuchungen, geprüften Abschluss und Reporting offen. Die Bewegungsliste zeigt die letzten 200 Einträge; vollständige Historie bleibt in Datenbank und Sicherung, ältere Bewegungsnummern sind weiterhin korrigierbar.

## Erfolgsmeldung und Rückkehr nach Veranstaltungslöschung — 2026-11-01

- Nach erfolgreichem Löschen eines Turniers oder Liga-Spieltags vor der nächsten Aktualisierung zur Veranstaltungsübersicht wechseln. Dadurch wird die gelöschte Detailadresse nicht erneut angefordert; „Veranstaltung nicht gefunden“ und eine leere Detailseite entfallen. Die Erfolgsmeldung nennt Art und Namen der gelöschten Veranstaltung. Zugehörige Turnierentwürfe und Ansichtsstände werden entfernt. Fehlgeschlagene Löschungen lassen die Detailadresse unverändert und zeigen weiterhin den Fehler im Bestätigungsdialog.
- Prüfstand: 38 gezielte Navigationstests und Gesamtsuite 123/123 erfolgreich, ohne Skips. Regressionstests prüfen Rückkehr, Erfolgsmeldung, erneute Aktualisierung sowie erhaltene Detailansicht bei Löschfehlern. Keine Server-, Schema- oder Backupänderung. npm fehlt auf dem Host; identische Testskripte direkt mit Node ausgeführt. Logs: data/event-delete-redirect-2026-11-01/.

- Lokal mit beiden Compose-Dateien im bestehenden Projekt bereitgestellt. App/PostgreSQL gesund, Proxy läuft; HTTPS /health liefert 200 mit CA-/Hostnamenprüfung. Stack aktiv, bestehende Daten/Secrets/Volumes erhalten; kein Commit oder Push.

## Zentrale Veranstaltungsverwaltung und Turnierpartien — 2026-11-01

- Planung und Verwaltung im Menü **Veranstaltungen** zusammengeführt. Die **Veranstaltungsübersicht** enthält oben ein aufklappbares Anlageformular und darunter standardmäßig laufende sowie geplante Veranstaltungen, laufende zuerst und geplante nach Datum. Filter für laufende, geplante, abgeschlossene und alle Veranstaltungen; Seitennavigation und vorhandene Veranstaltungslinks bleiben erhalten. Der frühere Planungslink öffnet dieselbe Oberfläche. Keine veranstaltungsübergreifende Partienliste auf der Übersicht.
- Veranstaltungsnamen öffnen die eigene Verwaltung. Liga-Spieltage behalten Teilnehmerbestätigung, Aufstellung und Partien. Turniere haben die Bereiche **Partien & Tische**, **Rangliste** und **Teilnehmer & Regeln**; nach Bestätigung der Auslosung öffnet sich direkt die eigene Partienverwaltung mit freien Tischen und Tabletlinks. Der gewählte Turnierbereich und geöffnete Anlageformulare bleiben bei Aktualisierungen erhalten. Teilnehmer und Regeln bleiben nach Beginn lesbar.
- Schweizer Rangliste in der tatsächlich verwendeten Detail-API korrigiert; sie enthielt zuvor nur Gruppentabellen und lieferte für Schweizer Turniere keine Gesamtrangliste. Bestehende Datenformate und Sicherungen unverändert.
- Prüfstand: 42 gezielte Tests erfolgreich; Gesamtsuite 121/121 ohne Skips. Geprüft sind Veranstaltungsfilter/-reihenfolge, getrennte Partien, Tischzuweisung innerhalb des Turniers, Bereichserhalt und Schweizer Rangliste aus der Detail-API. Isolierter Docker-/PostgreSQL-/HTTPS-Test erfolgreich. npm fehlt auf dem Host; identische Skripte direkt mit Node ausgeführt. Der erste gezielte Lauf scheiterte an einer alten Testannahme zur inzwischen entfernten globalen Partienliste; der Tischanzahltest prüft jetzt die Veranstaltungsdetailansicht. Logs: data/event-management-2026-11-01/.

- Lokal im bestehenden Compose-Projekt mit beiden Compose-Dateien gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy läuft. HTTPS-Healthcheck und Auslieferung der neuen Navigation/Turnieransicht mit CA-/Hostnamenprüfung erfolgreich. Datenprüfsumme vor/nach Deployment identisch. Stack bleibt aktiv; kein Commit oder Push.

## FR-006: Teilnehmerauswahl und Schweizer System — 2026-11-01

- Layout-Nachbesserung: Teilnehmerliste mit fester Höhe von 24 rem, oben ausgerichteten Zeilen und reserviertem Scrollbalkenplatz. Suchtrefferzahlen einschließlich leerer Trefferliste ändern die Größe des Auswahlbereichs nicht. CSS-Eigenschaften und git diff --check geprüft; keine JavaScript-Änderung. Protokolle: data/tournament-fixed-size-2026-11-01/.

- Manuelle Spieleranlage direkt in der Teilnehmerauswahl als aufklappbarer Bereich. Neue externe Spieler werden gespeichert und ausgewählt; Suchfeld und Mitgliederfilter werden zurückgesetzt, bestehende Auswahlen und Regeln bleiben erhalten. Freitextsuche nach Namen aktualisiert bei jeder Zeichenänderung und wirkt zusammen mit dem BSV-/Externenfilter. Ausgeblendete Auswahlen bleiben erhalten. Scrollposition der Teilnehmerliste und geöffnete Spieleranlage bleiben bei automatischen Aktualisierungen bestehen.
- Spielziel heißt dynamisch **Punkte** bei 14/1 und **Gewinnspiele** bei 8-/9-/10-Ball. Turniere zeigen **Turnier löschen**, einschließlich Löschdialog.
- Neuer Modus **Schweizer System** für 2–64 Teilnehmer: feste Rundenzahl (aufgerundeter Zweierlogarithmus der Teilnehmerzahl), zufällige erste Runde, weitere Paarungen nach vollständiger Ergebnisbestätigung mit bevorzugt ähnlichen Siegzahlen und ohne wiederholte Gegner/Freilose. Freilos zählt als Sieg ohne Rack-/Punktewertung. Gesamtrangliste nach Siegen, Buchholz, optional Differenz/erzielten Racks oder Punkten sowie begründeter Schlussentscheidung bei Restgleichständen. Ergebniskorrekturen sind nach Erzeugung einer Folgerunde und nach endgültigem Gesamtabschluss gesperrt. Vereinsvariante und Wertung in [Bedienung](Bedienung.md) dokumentiert.
- Schweizer Runden, Freilose, Rangfolgeentscheidungen und Regeln werden vollständig über die bestehende Veranstaltungsmetadaten-Sicherung exportiert, geprüft und wiederhergestellt; keine Schemaänderung. Backupprüfung rekonstruiert alle Paarungen und prüft Rundenfortschritt, Partiebezüge und Abschluss.
- Prüfstand: 39 gezielte Tests und Gesamtsuite 119/119 erfolgreich, keine Skips. Schweizer Paarungen für jede Teilnehmerzahl von 2–64 mit mehreren Ergebnisverläufen geprüft; API-Ablauf, Korrektursperren, beschädigte Sicherungen und vollständiger Restore in eine getrennte PostgreSQL-Datenbank erfolgreich. Isolierter Docker-/PostgreSQL-/HTTPS-Gesamttest erfolgreich. Da npm auf dem Host fehlt, die identischen Skripte direkt mit Node ausgeführt. Vorherige gezielte Läufe scheiterten an anschließend korrigierten Testsyntax-/Fixturefehlern sowie einer fehlenden Backup-Vorschau im neuen Restoretest. Protokolle: data/tournament-selection-2026-11-01/.

- Lokal im bestehenden Projekt billardmanager mit beiden Compose-Dateien gebaut und bereitgestellt. App/PostgreSQL gesund, Proxy läuft; HTTPS /health liefert 200 mit vollständiger CA-/Hostnamenprüfung. Prüfsumme aller Anwendungsdaten vor und nach dem Deployment identisch. Stack bleibt aktiv; kein Commit oder Push.

## Veraltete SQLite-Komponenten entfernt — 2026-11-01

- SQLite-Adapter, automatische Dateiübernahme, SQLite-Schemamigrationen und alternative Backup-Prüfung entfernt. Neue Datenbanken entstehen direkt aus dem vollständigen PostgreSQL-Schema `src/schema.sql`; bestehende PostgreSQL-Upgrades und JSON-Sicherungen der Stände 6–13 bleiben unterstützt. Betrieb, Entwicklung und Umstiegsanleitung aktualisiert. Vorhandene Daten, Secrets, archivierte Dateien und Volumes bleiben erhalten; `/data` wird weiterhin für JSON-Sicherungen vor nuLiga-Abgleichen benötigt.
- Funktionstests vollständig auf isoliertes PostgreSQL 17 umgestellt. `npm test` startet einen eigenen kurzlebigen Container und führt bis zu vier Testdateien parallel mit getrennten Datenbanken aus; CI verwendet denselben Einstieg. Der überholte SQLite-Version-1-Migrationstest entfällt. Die PostgreSQL-Tests deckten außerdem als Text gelieferte Statistiksummen auf; diese werden jetzt als Ganzzahlen ausgegeben.
- Prüfstand: 34 gezielte Datenbank-/Backup-Tests und ein gezielter Statistiktest erfolgreich; abschließende Gesamtsuite 115/115 ohne Skips. Vollständiger isolierter Docker-/PostgreSQL-/HTTPS-Test erfolgreich, einschließlich Initialisierung, Upgrades, getrenntem vollständigem Restore, neuer Tabellen, ungültiger Importe und Rollback. Da auf dem Host `npm` fehlt, die identischen Skripte direkt mit Node ausgeführt. Vorherige Läufe scheiterten am PostgreSQL-Verbindungslimit bzw. am anschließend behobenen Statistikfehler. Aktiver Code und Tests enthalten keine SQLite-Verweise mehr; `git diff --check` erfolgreich. Protokolle: `data/component-cleanup/`.
- Lokal im bestehenden Projekt `billardmanager` mit beiden Compose-Dateien gebaut und bereitgestellt. App und PostgreSQL gesund, Proxy läuft; HTTPS `/health` liefert 200 mit vollständiger CA-/Hostnamenprüfung. Prüfsumme sämtlicher Anwendungsdaten vor und nach dem Deployment identisch. Stack bleibt aktiv. Kein Commit oder Push.

## FR-014: Initialanalyse und Anforderungsausarbeitung — 2026-11-01

- Vorhandene Vermietungs-, Versions- und Backupmechanismen geprüft. Anforderungen für Artikel/Gebinde, Bewegungen, Sammelerfassung, Inventur, Mietkommentar, Getränkepositionen, Abschlussprüfung und Monatsauswertung in fünf einzeln abnehmbare Untertasks aufgeteilt.
- [Fachkonzept](Lagerverwaltung.md) mit Bestands-/Preisregeln, Korrekturen, Altbestandsbehandlung, vollständiger Sicherung und optionaler Barcode-/Produktdatenbankprüfung ergänzt. FR-014 bleibt offen; keine Anwendungsfunktion oder Datenbank geändert.
- Prüfstand: Dokumentationsinhalt, lokale Verweise und `git diff --check` geprüft; keine JavaScript-Tests erforderlich. Bestehendes Projekt `billardmanager` mit beiden Compose-Dateien gebaut und bereitgestellt; App/PostgreSQL gesund, Proxy läuft. HTTPS `/health` liefert 200 mit vorhandener CA und geprüfter Zertifikatskette/Hostname; Windows-Sperrprüfung auf Best effort, da die lokale CA keinen abrufbaren Sperrstatus lieferte. Erste Versuche scheiterten an nicht gestarteter Docker-Engine bzw. Sandboxzugriff. Logs unter `data/fr-014-initial-2026-11-01/`. Stack bleibt aktiv; Secrets und Datenvolumes erhalten.

## Audit abgeschlossen — 2026-11-01

AP1 bis AP6 sind umgesetzt und geprüft; alle neun Findings sind bearbeitet. Der [Auditbericht](../AUDIT_REPORT.md) enthält den dauerhaften Abschlussstatus und die fortsetzbare Liste abgeschlossener Tests. Letzter Gesamtstand: 116/116 Tests ohne Skips, erfolgreiche Browser-/Docker-/PostgreSQL-/HTTPS-Prüfungen und erfülltes Performancebudget. Lokaler Stack aktiv; FR-008 sowie reale Geräte-/WLAN-/Langzeitlast bleiben außerhalb des Auditumfangs.

## Audit AP6: Livezustand, Archivseiten und vollständige Statistik — 2026-11-01

- TECH-002 im Browser behoben: getrennter Live-Endpunkt; serverseitig paginierte Ergebnis-/Spieltags-/Partien-/Vermietungslisten, historische Gesamtzahlen und vollständige SQL-Statistiken einschließlich Doppelpartnern und 14/1. Details und historische Korrekturzuordnungen werden bei Bedarf geladen. Überholte Antworten und Fehler ersetzen keine neuere Ansicht. Der bisherige vollständige Admin-Endpunkt bleibt für Integrationen kompatibel und liest den Partienbestand nur einmal.
- Optionaler isolierter PostgreSQL-Benchmark und [Messbericht](Performance.md) einschließlich ursprünglicher und optimierter Rohdaten ergänzt. Bestätigtes Zielbudget erfüllt: bei 10.000 Archivpartien plus acht Livepartien und zehn Clients 4.046 Bytes Liveantwort und p95 6,95 ms (Ziel höchstens 256 KiB / 500 ms); fünf SQL-Abfragen. Container-HTTP-Messung ohne Geräte-/WLAN-/Browserlastfreigabe.
- Prüfung: 36 gezielte Tests, Gesamtsuite 116/116 ohne Skips; Browserprüfung und isolierter Docker-/PostgreSQL-/HTTPS-Test samt Budgetmessung erfolgreich. Erstläufe dokumentieren Sandbox-Netzwerksperren und anschließend korrigierte asynchrone UI-Testabläufe. Vollständige Logs und Fortsetzungsstand: `data/ap6-implementation-2026-11-01/PROGRESS.md`. Keine neue Datenart oder Schemaänderung; Sicherung/Wiederherstellung weiterhin vollständig. npm-Skripte wegen fehlendem npm direkt mit Node ausgeführt.
- Deployment: Bestehendes Projekt billardmanager mit beiden Compose-Dateien gebaut und aktiv. App und PostgreSQL gesund, Proxy läuft. HTTPS /health 200 mit vorhandener CA und aktiver Zertifikatsprüfung; ausgeliefertes app.js und die drei geänderten Backendmodule stimmen mit dem geprüften Quellcode überein. Bestehende Secrets und Datenvolumes erhalten.

## Audit AP5: Tastaturbedienung und Texte — 2026-11-01

- AP5 / UX-001 bis UX-003 behoben: Tastaturfokus bleibt beim automatischen Neuaufbau auf derselben Aktion; bei verschwundener oder deaktivierter Aktion dient die Seitenüberschrift als Ausweichziel. Offene Dialoge erhalten ihre Auslöser im Hintergrund. Dynamische Verwaltungsdialoge sind über ihre Überschrift zugänglich benannt. Mengenangaben verwenden korrekte Singularformen für Partien, Minuten, Ergebnisse, Siege und Niederlagen.
- Browserprüfung bestätigt Fokus über mehr als vier Pollzyklen, Enter-Auslösung, Fokuszurückkehr nach Registry-/Partiedialogen und Ausweichfokus nach Vermietungsabschluss. „1 Partie“ und „1 Minute“ praktisch geprüft.
- Prüfung: 31 gezielte Tests und Gesamtsuite mit 111 erfolgreichen Tests, keine übersprungenen Tests. Ein ursprünglicher Test erwartete noch den falschen Löschtext und wurde aktualisiert. Der abschließende isolierte Docker-/PostgreSQL-/HTTPS-Test bestand. Logs und Fortsetzungsstand unter `data/ap5-ap6-2026-11-01/`. npm-Skripte wegen fehlendem npm im PATH direkt mit Node ausgeführt.
- Deployment: Bestehender lokaler Stack mit beiden Compose-Dateien gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS und ausgeliefertes app.js mit bestehender CA geprüft. Stack bleibt aktiv; Secrets und Datenvolumes erhalten.

## Audit AP4: 14/1-Rackstatistik und Disziplinfilter — 2026-11-01

- FUNC-004 behoben: 14/1 als Statistikfilter ergänzt. Je Partie und Spielerseite zählen zehn volle Kugelpunkte als ein Rack; erst danach werden die Rackwerte summiert. 114:69 ergibt 11:6, zweimal 19 Punkte ergeben zwei Racks. Gemischte Disziplinen verwenden gemeinsame Rackzahlen.
- Statistische Partienlisten zeigen die Rackwertung und ergänzend die ursprünglichen 14/1-Punkte. Gespeicherte Ergebnisse und normale Spiel-/Ergebnisansichten bleiben unverändert. Sieg/Niederlage richtet sich weiterhin nach den Originalständen; auch Doppelpartner und Mannschaftsseiten verwenden dieselbe Umrechnung.
- Statistikformular und Wechsel zwischen Spieler-/Mannschaftsbezug erkennen die echte Formular-ID trotz eines Felds namens `id`.
- Prüfung: 27 gezielte Tests und Gesamtsuite mit 107 erfolgreichen Tests, keine übersprungenen Tests. Browserprüfung mit synthetischen Ergebnissen bestätigt 114:69 → 11:6, einzelne und gemischte Disziplinen, Datumsfilter, Mannschaftswerte und unveränderte Punkte im Ergebnisarchiv. npm-Skripte wegen fehlendem npm im PATH direkt mit Node ausgeführt; Logs und Fortsetzungsstand unter `data/ap4-2026-11-01/`.
- Deployment: Isolierter Docker-/PostgreSQL-/HTTPS-Test erfolgreich. Bestehendes lokales Projekt `billardmanager` mit beiden Compose-Dateien gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS `/health` 200 mit vorhandener CA und aktiver Zertifikatsprüfung; ausgeliefertes `app.js` entspricht dem geprüften AP4-Quellcode. Stack bleibt aktiv, bestehende Secrets und Datenvolumes erhalten.

## Audit AP3: Semantische Backupprüfung vervollständigen — 2026-11-01

- TECH-001 behoben: Gemeinsamer Buchungsvalidator für laufende Vermietung und Backupimport prüft Status-/Zeitrelationen, Preis-/Prozentgrenzen, vereinbarten Stundenpreis und exakt passende Dauer, aufgerundete Minuten und Gesamtbeträge. Laufende Buchungen dürfen keine Abschlusswerte enthalten. Widersprüche werden abgewiesen, nicht still neu berechnet.
- Gemeinsame Formatprüfung für Admin- und Partien-PIN-Hashes; gültige Hashes und Legacy-PIN-`null` bleiben importierbar. Schema und vollständiger Sicherungsumfang bleiben unverändert. Umgang mit bereits inkonsistenten Altbackups dokumentiert; separate Betriebssicherung weiterhin erforderlich.
- Prüfung: 36 gezielte Tests und Gesamtsuite mit 105 erfolgreichen Tests, keine übersprungenen Tests. Jede geprüfte fehlerhafte Vorschau und Wiederherstellung lässt sämtliche Zieldaten unverändert. Gültige Direkt-/Prozentpreise, kostenlose Nullzeitbuchung und Schema-6-Import mit null-PIN geprüft. Erweiterter isolierter Docker-/PostgreSQL-/HTTPS-Test bestätigt Ablehnung und vollständige Wiederherstellung zwischen getrennten Datenbanken einschließlich gültiger/null-PIN-Hashes. npm-Skripte wegen fehlendem npm im PATH direkt mit Node ausgeführt. Logs und Fortsetzungsstand unter `data/ap3-2026-11-01/`.
- Deployment: Bestehendes lokales Projekt `billardmanager` mit beiden Compose-Dateien gebaut und gestartet. App und PostgreSQL gesund, Proxy aktiv; HTTPS `/health` 200 mit bestehender CA und aktiver Zertifikatsprüfung. Hashvergleich bestätigt den geprüften Quellcode der drei geänderten Backendmodule im Container. Stack bleibt aktiv; vorhandene Secrets und Datenvolumes erhalten.

## Audit AP2: Spielerbelegung und 14/1-Korrekturen — 2026-11-01

- FUNC-002 behoben: Gemeinsame transaktionale Teilnehmerprüfung für manuelle Starts, Liga-Einzel/-Doppel, Turnierstarts und Änderungen auf beziehungsweise innerhalb von „live“. Auch Doppelpartner werden veranstaltungsübergreifend berücksichtigt. Eigene Partien werden nicht als Konflikt gewertet; Korrekturen abgeschlossener Ergebnisse bleiben möglich.
- FUNC-003 behoben: Punktefelder im Bearbeitungsdialog folgen dem Spielziel. 14/1-Ergebnisse über 99 Punkte lassen sich korrigieren; Ziel- und Disziplinänderungen aktualisieren die Grenzen, ohne Punkte automatisch zu ändern.
- Prüfung: 48 gezielte Tests und Gesamtsuite mit 74 erfolgreichen Tests, keine übersprungenen Tests. Darunter alle 16 Startkombinationen manuell/Liga-Einzel/Liga-Doppel/Turnier, Live-Änderungen, Wiederaufnahme und konkurrierende Starts. Browserprüfung bestätigt 125:80 → 125:79 sowie reine Namenskorrektur und dynamische Grenzen. Erweiterter isolierter Docker-Test mit PostgreSQL und HTTPS erfolgreich. npm-Skripte wegen fehlendem npm im PATH direkt mit Node ausgeführt; Logs und Fortsetzungsstand unter `data/ap2-2026-11-01/`.
- Deployment: Bestehendes Projekt `billardmanager` mit beiden Compose-Dateien gebaut und gestartet. App und PostgreSQL gesund, Proxy aktiv. HTTPS `/health` liefert 200 mit vorhandener CA und aktiver Zertifikatsprüfung; ausgeliefertes `app.js` entspricht dem geprüften AP2-Quellcode. Stack bleibt aktiv; bestehende Secrets und Datenvolumes erhalten.

## Audit AP1: Parallele Ligaänderungen absichern — 2026-11-01

- FUNC-001 behoben: Nur bearbeitete Liga-Aufstellungen werden als lokale Entwürfe erhalten. Ihre ursprüngliche Slotversion bleibt bei automatischer Aktualisierung und Menüwechsel bestehen; veraltete Entwürfe können fremde Änderungen nicht mehr still überschreiben.
- Konflikthinweis mit **Entwurf verwerfen / Serverstand laden** ergänzt. Unbearbeitete Formulare übernehmen den aktuellen Serverstand; erfolgreiche Speicherung entfernt den lokalen Entwurf. Beim Wechsel aus Formularen mit einem Feld namens `id` wird die tatsächliche Formular-ID verwendet.
- Prüfung: 21 Navigationstests und Gesamtsuite mit 53 erfolgreichen Tests, keine übersprungenen Tests. Echte Browserprüfung mit zwei getrennten synthetischen Adminsitzungen bestätigt Konfliktablehnung ohne Überschreiben, Erhalt bei Zurücknavigation, bewusstes Neuladen und anschließendes Speichern. Isolierter Docker-Test mit PostgreSQL und HTTPS erfolgreich. npm-Skripte wegen fehlendem npm im PATH direkt mit Node ausgeführt. Prüfprotokolle unter `data/ap1-2026-11-01/`.
- FUNC-004 im Auditbericht präzisiert: Bei 14/1 werden je volle zehn Kugelpunkte pro Partie und Seite als ein Rack gewertet, z. B. 114:69 → 11:6. Dies ist die Vorgabe für das weiterhin offene AP4; die Statistik wurde mit AP1 nicht geändert.
- Deployment: Bestehendes lokales Compose-Projekt mit beiden Compose-Dateien gebaut und gestartet. App und PostgreSQL gesund, Proxy aktiv; HTTPS `/health` mit vorhandener CA und aktiver Zertifikatsprüfung erfolgreich. Ausgeliefertes `app.js` stimmt mit dem geprüften Quellcode überein. Stack bleibt aktiv; bestehende Sicherheitskonfiguration und Datenvolumes erhalten.

## FR-006: Anpassungen der Turnierverwaltung — 2026-10-29

- Auswahlkorrektur: „Gruppe:“ mit Zahlenfeld steht direkt hinter dem Namen und erscheint bei Gruppenmodi unabhängig vom Zuweisungsmodus für angehakte Teilnehmer; beim Abwählen wird es ausgeblendet und deaktiviert. Änderungen der Gruppennummer schalten automatisch auf manuelle Zuweisung um. 17 Navigationstests und Gesamtsuite mit 49 Tests erfolgreich, keine übersprungenen Tests. Logs der erneuten Prüfung unter data/tournament-group-visibility/.

- Layout-Nachbesserung: übersichtliche Teilnehmerzeilen mit moderaten Abständen statt großer Leerbereiche; manuelle Gruppennummer rechts neben dem Namen mit Beschriftung „Gruppe:“ und echtem Zahlenfeld. 16 Navigationstests und Gesamtsuite mit 48 Tests erfolgreich, keine übersprungenen Tests. Lokales Deployment und HTTPS-Prüfung erfolgreich; Logs unter data/tournament-compact/.

- Alphabetische, einspaltige Teilnehmerauswahl mit Filtern für BSV-Mitglieder und externe Spieler. Direkte Spieleranlage oberhalb der Auswahl speichert einen externen Stammdatenspieler und wählt ihn aus.
- Manuelle Gruppenzuweisung mit serverseitiger Prüfung von Gruppennummern, Mindestbesetzung und Qualifikation. Gruppen und neue Spieler werden über die bestehenden vollständigen Backups gesichert; keine Schemaänderung nötig.
- Neue Gruppenpläne verwenden vollständige Jeder-gegen-jeden-Runden mit wechselnden Pausen bei ungerader Besetzung. Gruppen werden bei der Partieerzeugung abwechselnd berücksichtigt; die Partienliste zeigt die Erzeugungsreihenfolge. Bestehende Auslosungen bleiben erhalten.
- Belegte und vermietete Tische fehlen in der Partiezuweisung; ohne freien Tisch ist der Start deaktiviert. Tischlinks ergänzen Gruppen- und KO-Partien.
- Prüfung: 19 gezielte Tests und Gesamtsuite mit 48 erfolgreichen Tests, keine übersprungenen Tests. Manuelle Gruppen einschließlich Export und Wiederherstellung in getrennter Datenbank geprüft. Isolierter Docker-Test mit PostgreSQL und HTTPS erfolgreich. Die npm-Skripte wurden wegen fehlendem npm im PATH direkt mit Node ausgeführt. Logs unter data/fr006-adjustments/.
- Deployment: bestehender lokaler Stack mit beiden Compose-Dateien gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS /health liefert 200 mit geprüfter bestehender CA. Stack bleibt aktiv; Konfiguration und Datenvolumes erhalten.

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
