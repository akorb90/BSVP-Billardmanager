# Feature Requests – BSVP Billardmanager

Dieses Dokument sammelt geplante Erweiterungen. Ein Eintrag beschreibt eine Anforderung und bedeutet noch keine Umsetzung.

## FR-001: Durchgängige Admin-Navigation und Tischübersicht als Home-Seite

**Status:** Offen
**Erfasst am:** 26.10.2026

### Anforderung

Bei bestehender Admin-Authentifizierung ist die Menüleiste in allen Ansichten sichtbar. Die Tischübersicht ist die Home-Seite der Verwaltung.

### Gewünschtes Verhalten

- Nach erfolgreicher Admin-Anmeldung öffnet sich standardmäßig die Tischübersicht.
- Der Aufruf der Verwaltungs-Startseite (`/` oder `/admin`) führt bei bestehender Anmeldung zur Tischübersicht.
- Die Admin-Menüleiste bleibt beim Wechsel zwischen Tischübersicht, Spieltagsverwaltung und Ergebnissen sichtbar.
- Auch beim Öffnen einer einzelnen Tischansicht durch einen angemeldeten Administrator bleibt die Menüleiste verfügbar.
- Ein Klick auf das Vereinslogo führt zur Tischübersicht.
- Der aktive Menüpunkt ist erkennbar. Einzelne Tischansichten gehören zur Tischübersicht.
- Eine reine Tablet-Anmeldung mit Partie-PIN zeigt weiterhin keine Admin-Menüleiste und verleiht keine Verwaltungsrechte.

### Akzeptanzkriterien

1. Ein angemeldeter Administrator kann aus jeder Ansicht über die Menüleiste direkt zur Tischübersicht, Spieltagsverwaltung und zu den Ergebnissen wechseln.
2. Beim Neuladen einer Admin- oder Tischansicht bleibt die Menüleiste sichtbar, solange die Admin-Sitzung gültig ist.
3. Nach der Anmeldung sowie beim Aufruf der Verwaltungs-Startseite ist die Tischübersicht die Standardansicht.
4. Das Vereinslogo öffnet aus jeder Admin-Ansicht die Tischübersicht.
5. Ohne gültige Admin-Sitzung sind Verwaltungsfunktionen weiterhin geschützt; eine Partie-PIN reicht dafür nicht aus.

### Abgrenzung

Die entfernte Punkteübersicht wird nicht wieder eingeführt. Dieser Feature Request verändert weder Tischzählung noch Spielvorbereitung oder Zeitmessung.

## FR-002: Vergangene Veranstaltungen und abgeschlossene Spiele mit Warnbestätigung bearbeiten oder löschen

**Status:** Offen
**Erfasst am:** 26.10.2026

### Anforderung

Administratoren können vergangene Veranstaltungen bearbeiten oder löschen, auch nach deren Gesamtabschluss. Abgeschlossene Spiele bleiben im Adminbereich jederzeit nach ausdrücklicher Bestätigung einer roten Warnmeldung bearbeitbar. Das Löschen von Spielen oder Veranstaltungen erfordert ebenfalls eine solche Warnbestätigung, unabhängig vom Status.

### Gewünschtes Verhalten

- Die bisherige endgültige Bearbeitungssperre nach Veranstaltungsabschluss wird für Administratoren durch eine bestätigungspflichtige Korrekturmöglichkeit ersetzt. Tablet-Berechtigungen werden nicht erweitert.
- Vor dem Speichern nachträglicher Änderungen an vergangenen beziehungsweise abgeschlossenen Veranstaltungen oder abgeschlossenen Spielen erscheint eine rote Warnmeldung. Sie benennt den betroffenen Eintrag und die vorgesehenen Änderungen.
- Vor jeder Löschung einer Partie oder Veranstaltung erscheint eine rote Warnmeldung. Bei Veranstaltungen nennt sie auch die Anzahl der mitgelöschten Partien und weist auf den Verlust ihrer Ergebnisse hin.
- Sämtliche Warnmeldungen verwenden zusätzlich zur Schaltfläche einen kurzen, aktionsbezogenen Text, den der Administrator vorher von Hand in ein Bestätigungsfeld eingeben muss.
- Der geforderte Text wird im Dialog angezeigt; das Eingabefeld ist zunächst leer. Die Ausführung bleibt bis zur vollständigen, exakten Eingabe deaktiviert.
- Einfügen über Tastenkombinationen oder Kontextmenü sowie Drag-and-drop in das Bestätigungsfeld werden blockiert. Der Bestätigungstext darf nicht automatisch übernommen werden.
- Die abschließende Schaltfläche bezeichnet die konkrete Aktion statt lediglich „OK“. Eine separate Schaltfläche „Abbrechen“ bleibt jederzeit verfügbar.
- Jede Bestätigung gilt ausschließlich für die angezeigte Aktion und den angezeigten Datenstand. Nach Abbruch, erneutem Öffnen oder zwischenzeitlicher Änderung muss der Text erneut eingegeben werden.

### Vorgesehene Bestätigungstexte

| Aktion | Von Hand einzugebender Text | Abschließende Schaltfläche |
| --- | --- | --- |
| Vergangene Veranstaltung bearbeiten | EVENT ÄNDERN | Änderungen speichern |
| Abgeschlossenes Spiel bearbeiten | SPIEL ÄNDERN | Änderungen speichern |
| Spiel löschen | SPIEL LÖSCHEN | Spiel löschen |
| Veranstaltung löschen | EVENT LÖSCHEN | Veranstaltung löschen |
| Veranstaltung endgültig abschließen | EVENT ABSCHLIESSEN | Veranstaltung abschließen |

Das gleiche Muster gilt für weitere Warnmeldungen: Jede erhält einen eigenen kurzen Text passend zur Aktion.

### Akzeptanzkriterien

1. Ein Administrator kann eine vergangene oder bereits insgesamt abgeschlossene Veranstaltung nach Warnbestätigung ändern oder löschen.
2. Ein Administrator kann ein abgeschlossenes Spiel auch nach Gesamtabschluss seiner Veranstaltung nach Warnbestätigung bearbeiten.
3. Jede Löschung eines Spiels oder einer Veranstaltung verlangt unabhängig vom Status die rote Warnmeldung und die manuelle Texteingabe.
4. Eine leere, unvollständige oder abweichende Eingabe erlaubt keine Ausführung. Einfügeversuche über Tastenkombination, Kontextmenü und Drag-and-drop bleiben ohne Wirkung.
5. Ohne anschließenden Klick auf die konkret benannte Aktionsschaltfläche wird nichts geändert oder gelöscht. Abbrechen und Schließen des Dialogs lassen die Daten unverändert.
6. Bei zwischenzeitlich geänderten Daten wird die Aktion abgewiesen; der Administrator muss den aktualisierten Stand prüfen und erneut bestätigen.
7. Der Server prüft Admin-Berechtigung, Bestätigungstext, Aktion und Datenversion. Änderungen und Löschungen werden mit dem vorherigen Datenstand im Auditprotokoll erfasst.
8. Bestehende Warnmeldungen werden auf dasselbe Bestätigungsmuster umgestellt; eine reine „OK“-Bestätigung reicht nicht mehr aus.

### Hinweise zur Umsetzung

Das Blockieren von Copy-and-paste ist eine Bedienhürde im Browser, kein Nachweis physischer Tastatureingabe und kein Ersatz für serverseitige Berechtigungs- und Bestätigungsprüfungen. Die Warnung muss auch durch Überschrift und Text verständlich sein, nicht allein durch die rote Farbe.

Dieser Request ersetzt für Administratoren bewusst die bisherige Regel „nach Gesamtabschluss unveränderbar“. Der Abschlussstatus wird durch eine reine Korrektur nicht automatisch aufgehoben; eine Wiederaufnahme des Spielbetriebs ist davon getrennt zu behandeln.

## FR-003: Tischvermietung mit minutengenauer Abrechnung und bearbeitbarer Historie

**Status:** Offen
**Erfasst am:** 27.10.2026

### Anforderung

Der Manager erhält einen zusätzlichen Menüpunkt „Tischvermietung“. Administratoren können dort Tische vermieten, die Mietdauer über einen laufenden Timer verfolgen und die Buchung minutengenau anhand eines anpassbaren Stundenpreises abrechnen. Alle Tischbuchungen werden in einer Historie gespeichert und können nachträglich gemäß dem Warnbestätigungsmuster aus FR-002 bearbeitet werden.

### Gewünschtes Verhalten

- Der Menüpunkt „Tischvermietung“ ist über die Admin-Navigation erreichbar und zeigt verfügbare sowie aktuell vermietete Tische.
- Beim Start einer Vermietung werden Tisch, Startzeit und vereinbarter Stundenpreis gespeichert. Der Tisch wird als belegt markiert; eine weitere gleichzeitige Buchung desselben Tisches ist ausgeschlossen.
- Für jede laufende Vermietung werden Timer, Stundenpreis und aktueller Preis angezeigt. Ein Neuladen oder Verlassen der Ansicht setzt den Timer nicht zurück.
- Der Grundpreis beträgt standardmäßig 9,00 €/h. Der Stundenpreis kann direkt als Eurobetrag oder über eine prozentuale Anpassung des Grundpreises festgelegt werden. Die Prozentangabe bezeichnet einen Zu- oder Abschlag, beispielsweise −20 % für 7,20 €/h oder +10 % für 9,90 €/h. Der resultierende Stundenpreis wird vor Buchungsbeginn angezeigt und mit der Buchung gespeichert.
- Angefangene Minuten werden immer auf die nächste volle Minute aufgerundet: `abgerechnete Minuten = ceil(Mietdauer in Sekunden / 60)`. Die Abrechnung erfolgt nach der Formel `abgerechnete Minuten × vereinbarter Stundenpreis / 60`. Der Endbetrag wird auf zwei Nachkommastellen gerundet. Änderungen des Grundpreises verändern bestehende Buchungen nicht rückwirkend.
- Über „Vermietung abschließen“ im Manager wird der Timer gestoppt, die Endzeit gespeichert und der finale Preis zusammen mit Mietdauer und Stundenpreis angezeigt. Anschließend ist der Tisch wieder frei.
- Alle Tischbuchungen werden dauerhaft in einer Historie erfasst. Je Buchung sind mindestens Tisch, Startzeit, Endzeit, Mietdauer, verwendeter Stundenpreis, gegebenenfalls prozentuale Anpassung, Gesamtpreis und Status nachvollziehbar.
- Administratoren können abgeschlossene Buchungen in der Historie nachträglich korrigieren, insbesondere Zeitangaben und Stundenpreis. Daraus werden Mietdauer und Gesamtpreis neu berechnet; eine Korrektur öffnet die Vermietung nicht erneut und belegt den Tisch nicht wieder.
- Vor dem Speichern einer Korrektur erscheint die rote Warnmeldung gemäß FR-002 mit dem betroffenen Eintrag und den vorgesehenen Änderungen einschließlich des neu berechneten Preises. Der Text `BUCHUNG ÄNDERN` muss von Hand eingegeben werden; die abschließende Schaltfläche lautet „Änderungen speichern“.
- Sämtliche Schutzregeln aus FR-002 gelten auch hier: keine automatische Übernahme oder Einfügemöglichkeit des Bestätigungstextes, jederzeitiger Abbruch, Bestätigung nur für den angezeigten Datenstand, serverseitige Prüfung und Auditprotokoll mit vorherigem Datenstand. Tablet-Anmeldungen erhalten keine Vermietungs- oder Korrekturrechte.

### Akzeptanzkriterien

1. Ein Administrator kann über „Tischvermietung“ einen freien Tisch vermieten und dessen laufenden Timer sowie aktuellen Preis einsehen. Derselbe Tisch kann nicht gleichzeitig mehrfach vermietet werden.
2. Nach Neuladen der Ansicht läuft die Zeitmessung anhand der gespeicherten Startzeit korrekt weiter.
3. Ohne Anpassung gilt 9,00 €/h. Sowohl ein direkt eingegebener Stundenpreis als auch eine prozentuale Anpassung werden korrekt übernommen und nachvollziehbar angezeigt.
4. Bei 9,00 €/h kosten 60 abgerechnete Minuten 9,00 € und exakt 30 Minuten 4,50 €. Eine Mietdauer von 30 Minuten und 1 Sekunde wird als 31 Minuten abgerechnet und kostet 4,65 €. Bei −20 % auf den Grundpreis kosten 30 Minuten 3,60 €.
5. Das Abschließen speichert Endzeit, Mietdauer und finalen Preis, beendet den Timer und gibt den Tisch unmittelbar für eine neue Buchung frei. Mehrfaches Auslösen erzeugt keine doppelten Abschlüsse oder Historieneinträge.
6. Jede Buchung bleibt in der Historie nachvollziehbar, auch nach einer späteren Änderung des Grundpreises.
7. Eine nachträgliche Korrektur wird ausschließlich nach gültiger roter Warnbestätigung mit `BUCHUNG ÄNDERN` gespeichert und protokolliert. Abbruch, falscher Bestätigungstext oder zwischenzeitlich geänderte Daten verhindern das Speichern.
8. Eine bestätigte Korrektur aktualisiert Mietdauer und Preis konsistent, ohne den Tisch erneut zu belegen.

### Hinweise zur Umsetzung

Die Aufrundung angefangener Minuten muss in laufender Preisanzeige, Abschluss und nachträglicher Korrektur einheitlich angewendet werden. Exakt volle Minuten werden nicht um eine weitere Minute erhöht.
