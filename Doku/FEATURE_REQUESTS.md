# Feature Requests – BSVP Billardmanager

Dieses Dokument enthält ausschließlich offene oder in Umsetzung befindliche Feature Requests. Erfolgreich umgesetzte Anforderungen werden mit ihrer FR-Nummer, dem Umsetzungsdatum und dem Prüfstand in die [Release Notes](CHANGELOG.md) übernommen und hier entfernt. Bestehende FR-Nummern bleiben erhalten und werden nicht erneut vergeben.

Turnierverwaltung (FR-006), Spieler- und Mannschaftsverwaltung (FR-007) sowie Datensicherung (FR-005) sind umgesetzt, siehe [Release Notes](CHANGELOG.md). Offen sind das Regelwerk (FR-008) und die Lagerverwaltung mit Getränketracking (FR-014).

## FR-008: Aktuelles BBV-Verbandsregelwerk als Nachschlagewerk

Das jeweils aktuelle, offiziell veröffentlichte Regelwerk des Bayerischen Billardverbands (BBV) soll innerhalb der Anwendung leicht auffindbar sein und bei Regelfragen als Nachschlagewerk dienen.

Anforderungen und Abnahmekriterien:

- Einen eigenen Bereich „Regelwerk“ mit den für Poolbillard und den Liga-/Turnierbetrieb relevanten offiziellen BBV-Dokumenten bereitstellen. Welche Dokumente maßgeblich sind, bei der Umsetzung anhand der offiziellen BBV-Veröffentlichungen prüfen.
- Dokumenttitel, Herausgeber, Versions- bzw. Gültigkeitsstand, offiziellen Quellenlink und Datum der letzten Quellenprüfung anzeigen. Fehlende Versionsangaben ausdrücklich kennzeichnen.
- Offizielle Dokumente direkt öffnen und, soweit technisch und rechtlich möglich, in der Anwendung durchsuchbar anzeigen. Falls eine eingebettete Anzeige nicht möglich ist, einen klaren Link zum Original anbieten.
- Einen nachvollziehbaren Aktualisierungsweg vorsehen, damit neue offizielle Fassungen übernommen und veraltete Verweise erkannt werden. Bei nicht erreichbarer Quelle oder nicht bestätigter Aktualität einen entsprechenden Hinweis anzeigen.
- Aus Turnier- und Liga-Spieltagen direkt zum Nachschlagewerk gelangen. Verbandsregeln als Referenz bereitstellen; Spielstände, Turnierregeln und laufende Veranstaltungen werden durch Dokumentaktualisierungen nicht automatisch geändert.

## FR-014: Lagerverwaltung und Getränketracking

**Status 2026-11-02:** FR-014.1 ist umgesetzt, geprüft und lokal bereitgestellt, siehe [Release Notes](CHANGELOG.md). Fachkonzept und Bedienhinweise stehen in [Lagerverwaltung und Getränketracking](Lagerverwaltung.md). Die verbleibenden Untertasks werden einzeln umgesetzt und abgenommen. FR-014 bleibt bis zur Umsetzung des Pflichtumfangs offen.

Ziel: Getränke in Einzelflaschen und unterschiedlichen Gebinden verwalten, Verbrauch einer laufenden Tischvermietung zuordnen und Tischmiete sowie Getränkekosten nachvollziehbar abschließen. Keine Zahlungsabwicklung, Kassenführung oder steuerlichen Belege vorsehen; aus dieser Funktionsabgrenzung folgt keine Aussage über rechtliche Pflichten im Vereinsbetrieb.

### FR-014.2: Schnellerfassung und Inventur

- Mehrere Getränke mit Kästen und Einzelflaschen in einer Vorschau erfassen und gemeinsam bestätigen. Letzte Wareneingänge als neue Eingabe übernehmen oder dauerhaft gespeicherte, benannte Vorlagen nutzen. Vorlagen verändern keinen Bestand; übernommene Mengen und EK bleiben vor der Buchung editierbar.
- Inventur mit Soll-/Istbestand, Differenz und Begründung anbieten; Mindestbestände mit einer einfachen Nachbestellliste anzeigen.
- Abnahme: Ungültige Position oder zwischenzeitlich veränderter Bestand verhindert die gesamte Sammelbuchung. Wiederholtes Absenden derselben Buchung legt keine zweite Bewegung an. Veraltete Vorlagen mit archivierten Artikeln verlangen eine Korrektur.

### FR-014.3: Mietkommentar und Getränkebuchungen

- Beim Start einer Vermietung ein verpflichtendes, nach Entfernen äußerer Leerzeichen nicht leeres Kommentarfeld anbieten (beispielsweise Name der ausleihenden Person, höchstens 200 Zeichen). In Vermietungsansicht und Tischübersicht anzeigen; Änderungen nachvollziehbar protokollieren. Bestehende Vermietungen bleiben erhalten; fehlende Altkommentare ausdrücklich kennzeichnen und vor einer weiteren Getränkebuchung oder dem Abschluss ergänzen lassen.
- Getränke mit schneller Mengeneingabe auf aktive Vermietungen buchen. Jede Position speichert Getränkebezeichnung und VK zum Buchungszeitpunkt; spätere Preisänderungen ändern bestehende Positionen nicht. Bestandsabgang und Getränkeposition gemeinsam in einer Transaktion schreiben.
- Tischkarten zeigen Kommentar, laufende Tischmiete und aktuelle Getränkesumme getrennt. Bestehende Mietrabatte gelten weiterhin nur für die Tischmiete. Nur angemeldete Spielleitung darf Lager und Getränkebuchungen ändern; Tablet-Partiezugänge erhalten diese Berechtigung nicht.
- Abnahme: Zwei Flaschen zu je 2,50 EUR ergeben 5,00 EUR Getränkekosten und zwei Flaschen Lagerabgang. Parallelzugriff, Wiederholung und veraltete Ansichten erzeugen keine Doppelbuchungen. Storno verlangt einen Grund und eine ausdrückliche Entscheidung über eine tatsächliche Rückgabe ins Lager.

### FR-014.4: Geprüfter Vermietungsabschluss

- Abschlussvorschau mit festem Endzeitpunkt, Mietdauer, Tischmiete, allen wirksamen Getränkepositionen, Getränkesumme und Gesamtsumme anzeigen. Je angezeigter Getränkeposition und für die Tischmiete eine zunächst leere Checkbox verlangen. Bestätigung bedeutet Prüfung der Aufstellung, keine Zahlungsbestätigung.
- Finalen Abschluss nur bei vollständig bestätigter, serverseitig geprüfter Vorschau zulassen. Änderungen an Miete oder Getränken machen Vorschau und Bestätigungen ungültig. Vorschauzeitpunkt und Abschluss müssen dieselbe Mietsumme ergeben.
- Abgeschlossene Positionen erhalten ihren Preis-/Namensstand. Nachträgliche Korrekturen müssen Abschlusswerte, Lagerbewegungen und Änderungsprotokoll konsistent halten. Vermietungen mit Getränkebewegungen dürfen nicht mitsamt diesen Bezügen spurlos gelöscht werden.
- Abnahme: Fehlende Checkbox oder zwischenzeitliche Getränkebuchung verhindert den Abschluss. Wiederholtes Absenden desselben gültigen Abschlusses führt zu genau einem Abschluss. Altvermietungen ohne Getränke bleiben prüf- und korrigierbar.

### FR-014.5: Reporting und vollständige Datensicherung

- Monatsdashboard mit frei wählbarem Zeitraum: Verbrauch je Getränk, Wareneingänge, aktuelle Bestände/Mindestbestände, Getränkewerte aus abgeschlossenen Vermietungen sowie Tischmiete getrennt darstellen. Offene Vermietungen separat ausweisen. Bekannte EK und fehlende EK transparent anzeigen; keine vollständige Marge bei unvollständiger Kostenbasis behaupten. Zeit- und Korrekturzuordnung gemäß Fachkonzept verwenden.
- Sämtliche Artikel, Gebinde, Preisstände, Bewegungen, Mietkommentare, Getränkepositionen, Abschlussbestätigungen, Vorlagen und Einstellungen in Anwendungsbackup und Wiederherstellung aufnehmen. Dies ist ab dem jeweiligen Untertask verpflichtend, nicht erst im letzten Umsetzungsschritt. Neue Tabellen automatisch einschließen und fachliche Importprüfung sowie Altbackup-Migration ergänzen; separate Betriebssicherung bleibt erforderlich.
- Abnahme: Getrennte Testdaten vollständig exportieren und wiederherstellen, fachlich ungültige Sicherungen ohne Datenänderung ablehnen, Altbackups auf leere Getränkebestände migrieren. Monatsgrenzen, Stornos und fehlende EK gezielt testen.

Weitere Reihenfolge: FR-014.2 → FR-014.3 → FR-014.4 → FR-014.5; Kommentar aus FR-014.3 kann vorgezogen werden. Barcode- und Produktdatenbankanbindung sind optionale spätere Ausbaustufen nach einer Machbarkeitsprüfung, siehe Fachkonzept. Pro Untertask betroffene Tests, einmal Gesamtsuite und bei Datenbank-/Backupänderungen zusätzlich isolierte PostgreSQL-/HTTPS-/Docker-Prüfung ausführen; anschließend lokal bereitstellen. Keine Testdaten in den laufenden Vereinsbestand übernehmen.
