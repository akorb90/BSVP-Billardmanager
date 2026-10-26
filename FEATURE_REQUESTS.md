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
