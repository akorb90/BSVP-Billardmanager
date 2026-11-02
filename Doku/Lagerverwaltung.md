# Lagerverwaltung und Getränketracking

Stand: 2026-11-02, FR-014. FR-014.1 (Getränke, Gebinde und einzelne Lagerbewegungen) und FR-014.2 (Schnellerfassung, Vorlagen und Inventur) sind implementiert; die folgenden Etappen bleiben geplant. Verbindliche Umsetzungsetappen und Abnahmekriterien stehen in [FEATURE_REQUESTS.md](FEATURE_REQUESTS.md#fr-014-lagerverwaltung-und-getränketracking).

## Bestandsanalyse und Einbindung

Die Vermietung ist bereits in `src/rentals.js` mit Start, zeitabhängigem Preis, Abschluss, Korrektur und Löschung vorhanden. `public/rental-pricing.js` berechnet die auf Minuten aufgerundete Miete. `public/app.js` zeigt Vermietungen und belegte Tische; `src/server.js` schützt schreibende Vermietungsaktionen mit Admin-Anmeldung. Versionsprüfungen und Datenbanktransaktionen sichern Änderungen gegen veraltete Eingaben ab. Diese Mechanismen sind um den gemeinsamen Versionsstand von Vermietung und Getränkepositionen zu erweitern.

Getränkestammdaten und Bestandsbewegungen liegen in `src/inventory.js` mit Schema in `src/inventory-schema.js` vor. Mietkommentare und die Zuordnung von Getränken zu Vermietungen folgen in FR-014.3. Der bestehende Mietgesamtbetrag umfasst ausschließlich die Tischmiete. Diese Bedeutung bei der Erweiterung erhalten: Getränkesumme und gemeinsame Gesamtsumme ausdrücklich getrennt führen, damit Altbestände, Preisanzeige und Importprüfung nicht umgedeutet werden. Bestehende Mietpreisberechnung einschließlich Rabatten bleibt Grundlage der Tischmiete.

`src/backup.js` entdeckt Anwendungstabellen automatisch, prüft jedoch zusätzlich Format, Schema und fachliche Beziehungen. Neue Tabellen allein reichen deshalb nicht: Schemaversion, Altbackup-Migration und semantische Prüfungen müssen gemeinsam erweitert werden. Bisherige Sicherungen müssen weiterhin ohne erfundene Getränkebewegungen importierbar bleiben. Prüfungen finden insbesondere in `tests/rentals.test.js`, `tests/navigation.test.js`, `tests/backup.test.js`, `tests/backup-validation.test.js` und dem isolierten PostgreSQL-/HTTPS-Test statt.

## Bedienablauf

1. Getränk anlegen, zum Beispiel „Mineralwasser 0,5 l“, VK 2,50 EUR, optional EK und Mindestbestand. Gebinde „20er-Kasten“ und „24er-Kasten“ können demselben Artikel zugeordnet sein; andere Flaschengrößen sind eigene Artikel.
2. Wareneingang in einer gemeinsamen Liste erfassen: Kästen, Einzelflaschen und optional tatsächlichen EK eingeben. Vorschau zeigt Umrechnung und neue Bestände. Eine zuletzt verwendete Lieferung oder Vorlage spart wiederholte Artikelauswahl, erfordert aber eine neue Bestätigung.
3. Tisch mit Pflichtkommentar vermieten. Kommentar in beiden Tischansichten anzeigen und als Klartext sicher ausgeben. Als Planungswert höchstens 200 Zeichen serverseitig zulassen; keine unnötigen Kontaktdaten verlangen.
4. Getränke zur aktiven Vermietung hinzufügen. Artikelwahl, Menge und aktuelle Summe unmittelbar anzeigen. Bestand wird bei der Ausgabe reduziert, nicht nochmals beim Mietabschluss. Ausreichender Bestand und aktive Vermietung müssen beim Schreiben noch gelten.
5. Abschlussvorschau öffnen, jede Position und die Tischmiete einzeln prüfen und bestätigen. Mietendzeit für diese Vorschau festhalten. Erst nach finaler Bestätigung wird der Tisch freigegeben; eine abgebrochene Vorschau beendet die Vermietung nicht. Eine neue Vorschau verwendet einen neuen Endzeitpunkt.

Beispiel: Zwei 20er-Kästen plus drei Einzelflaschen ergeben 43 Flaschen. Zwei ausgegebene Flaschen hinterlassen 41 Flaschen und eine Getränkeposition über 5,00 EUR. Bei 30 Minuten zu 9,00 EUR/h zeigt der Abschluss 4,50 EUR Tischmiete, 5,00 EUR Getränke und 9,50 EUR zusammen. Eine spätere VK-Änderung auf 3,00 EUR verändert diese Position nicht; neue Ausgaben erhalten den neuen Preis und eine eigene Position.

## Bestands- und Korrekturregeln

- Flaschen sind die kleinste buchbare Einheit; Mengen und Gebindegrößen sind positive ganze Zahlen. Leere Eingaben, Bruchteile, Überläufe und Bestandsunterschreitungen werden abgewiesen. Ein optionaler VK von 0 Cent muss ausdrücklich gesetzt werden; ein fehlender Preis ist ungültig.
- Bewegungen speichern Artikel, Menge mit Richtung, Art, Zeitpunkt, Bezug und bei Korrekturen einen Grund. Gebindegröße, Artikelname und Preis werden dort historisch festgehalten, wo sie zur Rekonstruktion nötig sind. Bestände ergeben sich aus Bewegungen; ein zusätzlich gespeicherter Summenbestand muss transaktional konsistent bleiben.
- Anfangsbestand ist eine Bewegung. Eine Inventur erzeugt nur die begründete Soll-/Ist-Differenz; zwischenzeitliche Ausgaben erzwingen eine erneute Prüfung. Bruch und Eigenverbrauch sind eigene Bewegungsarten und keine Getränkeposition einer fremden Vermietung.
- Fehlerhafte Erfassung und echte Rückgabe unterscheiden: Eine irrtümlich gebuchte, nie ausgegebene Flasche kann mit Gegenbewegung korrigiert werden. Eine bloße Preisgutschrift erzeugt keinen Lagerzugang. Rücknahme nur bei tatsächlicher Rückgabe verkaufsfähiger Ware; Grund und Rückgabemenge dokumentieren.
- Bereits verbrauchte oder verknüpfte Artikel archivieren statt löschen. Auch nach Archivierung bleiben Historie, Storno und Wiederherstellung möglich. Eine frühere Wareneingangsbuchung lässt sich nur so gegenbuchen, dass kein negativer Bestand entsteht.
- Für jede schreibende Aktion einen eindeutigen Vorgangsbezug zur Erkennung wiederholter Übermittlung vorsehen. Transaktionen, serverseitige Mengen-/Preisprüfung und Versionskontrolle gelten auch bei zwei gleichzeitig bedienenden Geräten. Fehlgeschlagene Aktionen hinterlassen keine Teilbuchungen.
- Getränkekorrekturen nach Mietabschluss erfolgen als protokollierte Gegen-/Neubuchungen mit erneut geprüfter Aufstellung. Ursprünglicher Abschluss und Korrekturbezug bleiben nachvollziehbar. Bestehende Mietkorrekturen müssen die getrennten Summen konsistent neu berechnen; das bisherige Löschen darf keine Getränkebewegungen verwaisen lassen.

## Abschluss und Zugriff

Eine Getränkeposition entspricht einem Artikel mit identischem historischem Preisstand; unterschiedliche Preise niemals unbemerkt zusammenfassen. Die Vorschau nennt Menge, Einzelpreis und Zeilensumme. Stornierte Positionen bleiben in der Historie sichtbar, gehen jedoch nicht erneut in den zu bestätigenden Betrag ein. Ohne Getränke ist nur die Mietposition zu bestätigen.

Der Server prüft die genaue Menge bestätigter Positionskennungen und den Versionsstand einschließlich der Miete. Neue Positionen, Stornos oder Kommentar-/Mietänderungen entwerten die Vorschau. Die Bestätigung aller Checkboxen allein im Browser genügt nicht. Abschlusszeitpunkt, geprüfte Positionen und zugehörige Versionsstände gehören zum gespeicherten Abschluss und ins Backup.

Lager, Preise und Verbrauchsbuchungen sind zunächst Funktionen der bestehenden angemeldeten Spielleitung. Keine neue Benutzerverwaltung für diesen Schritt einführen. Partietablets dürfen daraus keinen Lagerzugriff ableiten. Kommentare nur innerhalb der berechtigten Verwaltungsansichten anzeigen. Kommentaränderungen sind nachvollziehbar; Altvermietungen erhalten keinen erfundenen Personennamen.

Die Aufstellung dokumentiert Miete und Verbrauch. Zahlungsarten, Kassensaldo, Wechselgeld, Zahlungsstatus, Rechnungen, Fiskalisierung oder TSE-Anbindung gehören nicht zum geplanten Umfang. Diese Produktentscheidung ersetzt keine Prüfung des tatsächlichen Betriebsablaufs.

## Auswertungen

Zeiträume als lokale Kalenderzeiträume in Europe/Berlin mit inklusivem Beginn und exklusivem Ende auswerten; Sommerzeit berücksichtigen. Verbrauch und Lagerbewegungen zählen nach Buchungszeitpunkt. Bestandskarten zeigen den aktuellen Stand; eine Auswertung zum Periodenende rekonstruiert den damaligen Stand aus den Bewegungen.

Getränkewerte abgeschlossener Vermietungen und Tischmiete zählen nach Mietendzeitpunkt, offene Vermietungen separat. Der Begriff „Getränkewert“ bezeichnet hier keine bestätigte Zahlung. Nachträgliche Korrekturen einer abgeschlossenen Vermietung ändern deren ursprüngliche Abschlussperiode; das Dashboard kennzeichnet die Neuberechnung und verlinkt den Korrekturzeitpunkt im Protokoll. Lagergegenbewegungen zählen hingegen zu ihrem tatsächlichen Buchungszeitpunkt. Daher Verbrauch und abgeschlossene Getränkewerte nicht als identische Kennzahl behandeln.

Für die erste Auswertung tatsächliche bekannte EK der Wareneingänge und den Anteil ohne EK anzeigen. Keine Marge aus dem aktuellen Artikel-EK auf historische Getränke berechnen. Vor einer späteren Margenberechnung eine Bewertung verbrauchter Bestände, etwa mit gleitendem Durchschnitt, gesondert spezifizieren und testen. Ein CSV-Export der gefilterten Auswertung kann später ergänzt werden.

## Datenmodell und vollständige Sicherung

Vorgeschlagene fachliche Bereiche sind Artikel, Gebinde, Lagerbewegungen, Vorlagen mit Positionen, Getränkepositionen je Vermietung und versionierte Abschlussnachweise. Konkrete Tabellen-/Spaltennamen bei der Umsetzung festlegen. Alle dauerhaft benötigten Daten liegen serverseitig in PostgreSQL; Vorlagen, Preise oder Einstellungen dürfen nicht allein im Browserspeicher liegen. Fremdschlüssel, Wertebereiche, eindeutige Vorgangskennungen und Auditbezüge gehören zum jeweiligen Umsetzungsschritt.

Jede Etappe erweitert bei Bedarf Export, Importprüfung und Migration. Sicherungen enthalten auch archivierte Artikel, historische Preise, EK-Lücken, Korrekturen, Kommentare, Bestätigungen, Vorlagen und Einstellungen. Import prüft insbesondere Artikel-/Mietbezüge, Mengenkonsistenz, nichtnegative rekonstruierte Bestände, Positionssummen sowie Abschluss-/Korrekturstände. Ungültige Sicherungen werden vollständig abgewiesen; keine stillen Reparaturen oder Teilimporte. Getrennte Testdaten müssen den vollständigen Export-/Restore-Zyklus einschließlich alter Sicherungen belegen. Die [separate Betriebssicherung](Datensicherung.md) von Installation, externer Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt zusätzlich erforderlich.

## Spätere Optionen und vorab zu prüfende Fragen

- **Barcode zunächst lokal:** Optionales EAN/GTIN-Feld mit eindeutiger Artikel-/Gebindezuordnung und manueller Eingabe. Einen Scanner, der Tastatureingaben liefert, an realer Hardware prüfen. Ein Flaschenbarcode darf nicht automatisch als ganzer Kasten gebucht werden. Unbekannte Codes öffnen eine geprüfte Zuordnung, keine automatische Bestandsbewegung.
- **Externe Produktdatenbank:** Erst nach Prüfung von Anbieter, Abdeckung für Vereinsgetränke, Nutzungsrechten, Kosten, Verfügbarkeit und Datenschutz entscheiden. Importierte Bezeichnung/Flaschengröße nur als Vorschlag übernehmen; interne VK, EK und Gebinde bestätigt die Spielleitung. Der Betrieb muss ohne externen Dienst möglich bleiben. In dieser Initialanalyse wurde kein Anbieter ausgewählt oder technisch verifiziert.
- **Kamerascan:** Als eigene Komfortfunktion nach Prüfung der vorhandenen Tablets, Browserberechtigungen und HTTPS-Bedingungen untersuchen.
- **Pfand/Leergut:** Vor einer Erweiterung klären, ob nur Getränke oder zusätzlich Flaschen-, Kasten- und Lieferantenpfand verwaltet werden sollen. Im ersten Pflichtumfang keine automatisch berechneten Pfandbeträge oder Leergutbestände.
- **Weiterer Verbrauch:** Getränkebuchungen ohne Tisch, Umbuchungen zwischen Vermietungen, mehrere Lagerorte, Lieferantenverwaltung und automatische Bestellvorschläge sind spätere Optionen. Eigenverbrauch/Bruch im Pflichtumfang deckt zunächst nur Bestandsabgänge ohne zugeordneten Getränkewert ab.

## Umsetzung und Prüfplan

Die Untertasks und ihre Reihenfolge stehen in FR-014. Zuerst Datenmodell und fachliche Regeln einschließlich Migration/Backup absichern, dann die jeweiligen Verwaltungsansichten anbinden. Das Pflichtkommentarfeld kann unabhängig vorgezogen werden; dabei Altbestand und sichere Textausgabe berücksichtigen.

Pro JavaScript-Änderung betroffene Tests und anschließend einmal die Gesamtsuite ausführen. Bei PostgreSQL-, Schema-, Backup- oder Authänderungen zusätzlich den isolierten Docker-/PostgreSQL-/HTTPS-Test verwenden. Parallelzugriffe, doppelte Übermittlung, veraltete Abschlussvorschauen, Preisänderung, Storno mit/ohne Rückgabe, Monatsgrenzen, Altvermietungen und vollständige Wiederherstellung sind die zentralen Prüffälle. UI zusätzlich für schnelle Tastaturbedienung und Tabletbreite prüfen. Testdaten bleiben in getrennten Datenbanken/Compose-Projekten. Nach erfolgreicher Etappe lokalen Stack bauen, HTTPS und Containerzustand kontrollieren und den Stack aktiv lassen.


## Umgesetzte Schnellerfassung und Inventur (FR-014.2)

Wareneingang und Inventur besitzen tabellarische Eingabelisten sowie eine serverseitig signierte Vorschau. Eine Sammelbuchung umfasst bis zu 100 unterschiedliche Getränke. Jede Version, Gebindeumrechnung, Menge und EK-Angabe wird bei der Bestätigung erneut geprüft; ein Konflikt verwirft die gesamte Transaktion. Eindeutige, dauerhaft gespeicherte Vorgänge verhindern Doppelbuchungen, auch nach einer Wiederherstellung. Ein App-Neustart entwertet noch unbestätigte Vorschauen.

Vorlagen speichern Artikel-/Gebindebezüge, Mengen, historische Gebindegröße und EK unabhängig vom Bestand. Übernahme und Bearbeitung verwenden aktuelle Artikelversionen. Archivierte Artikel erfordern Entfernung oder Reaktivierung; geänderte Gebindegrößen werden zur erneuten Mengenprüfung gekennzeichnet. Die letzten 20 Wareneingänge bleiben als neue, editierbare Eingabe auswählbar, unabhängig von zwischenzeitlichen Inventuren.

Inventurpositionen mit leerem Ist-Feld bleiben unberücksichtigt. Null ist ein bewusst gezählter Nullbestand. Von null verschiedene Differenzen erzeugen begründete Gegen-/Zugangsmengen als Inventurdifferenz. Eine bestätigte Übereinstimmung bleibt als gezählte Position im Sammelnachweis erhalten und erzeugt keine künstliche Nullbewegung. Nachbestellliste und alle Stammdaten bleiben serverseitig berechnet; sämtliche Vorlagen und Sammelnachweise sind im Schema-15-Backup enthalten.
