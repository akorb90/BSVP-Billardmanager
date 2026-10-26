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
