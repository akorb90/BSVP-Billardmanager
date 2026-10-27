# Feature Requests – BSVP Billardmanager

Dieses Dokument enthält ausschließlich offene oder in Umsetzung befindliche Feature Requests. Erfolgreich umgesetzte Anforderungen werden mit ihrer FR-Nummer, dem Umsetzungsdatum und dem Prüfstand in die [Release Notes](CHANGELOG.md) übernommen und hier entfernt. Bestehende FR-Nummern bleiben erhalten und werden nicht erneut vergeben.

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
