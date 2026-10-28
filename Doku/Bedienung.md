# Bedienung

## Screenshots
Loginpage:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/05ce9930-2847-4ada-a03e-c4f1990eda57" />

Startseite:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/d4dfeb23-cfc6-4751-a2cd-384809b9bdf7" />

Spieltagsverwaltung:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/170c2ade-41b2-4024-b55a-0b6929144b49" />

Ergebnisse:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/13fbaf10-7870-451c-b1d8-6708bd219f32" />

Tischvermietung:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/cd9c6b31-e85f-45ef-8653-d29903dcf9bd" />

Einstellungen:
<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/1a883849-8dd4-4ea1-a5c5-6a2cd9469d5d" />

## Funktionsumfang

- Liga-Spieltage und Turniere mit Name und Datum anlegen.
- Begegnungen manuell planen: zwei Spieler, 8-/9-/10-Ball, Gewinnspiele und Tablet-PIN. Ausstoßen und erstes Break werden vor Ort abgefragt.
- Begegnungen einem von acht freien Tischen zuweisen; Doppelbelegung wird verhindert.
- Feste Kiosk-Endpunkte `/tisch/1` bis `/tisch/8`, Punkte +/−, Wechselbreak und automatische Aktualisierung alle drei Sekunden.
- Ergebnisse nach Erreichen des Spielziels zentral oder direkt am zugeordneten Tablet bestätigen. Danach wird der Tisch frei; das Ergebnis bleibt erhalten.
- Obere Adminnavigation: Tischübersicht, Spieltagsverwaltung, Ergebnisse, Tischvermietung und Einstellungen. Die Tischübersicht zeigt laufende Partien; abgeschlossene Partien erscheinen im Ergebnisarchiv.
- Veranstaltungen, Begegnungen, Ergebnisse und Buchungshistorie bieten Zurück/Weiter und 10, 20, 50 oder 100 Einträge pro Seite (Standard: 20). Jede Liste behält ihre Auswahl beim Menüwechsel und bei automatischen Aktualisierungen; eine andere Seitengröße beginnt auf Seite 1. Die feste Übersicht der acht Tische bleibt vollständig sichtbar.
- SQLite speichert Veranstaltungen, Begegnungen, Ergebnisse und ein Änderungsprotokoll. Gleichzeitige Eingaben werden mit Versionsprüfung und Transaktionen geschützt.
- Einstellungen bündeln Vereinsgestaltung (FR-009), Grundpreis, Admin-Passwortwechsel und [Datensicherung mit Export und Import (FR-005)](Datensicherung.md). Eine geprüfte Sicherungsdatei kann den vollständigen Anwendungsstand auf einer neuen Installation wiederherstellen.

## Vereinsgestaltung (FR-009)

Unter **Einstellungen → Vereinsgestaltung** können Administratoren den Vereinsnamen (1–80 Zeichen), ein eigenes Logo und die Farben für Akzente, Hintergrund, Flächen und Text speichern. Die Gestaltung gilt auch für Anmeldung, Browser-Titel und Tisch-Tablets; offene Seiten übernehmen sie automatisch beim nächsten Aktualisieren. PNG- und JPEG-Logos bis 1 MiB sind erlaubt. Ohne neue Dateiauswahl bleibt das vorhandene Logo erhalten; **Standardlogo verwenden** stellt beim Speichern das BSV-Logo wieder her. Andere Vereine sollten ihr eigenes Logo hochladen.

Unter jedem Farbwähler kann der Hex-Farbcode direkt eingegeben werden (z. B. #147eb7). Farbwähler und Codefeld aktualisieren sich gegenseitig.

Text muss zu Hintergrund und Flächen mindestens 4,5:1 Kontrast haben; die Beschriftung farbiger Hauptbuttons wird automatisch hell oder dunkel gewählt. **Änderungen verwerfen / Neu laden** lädt die gespeicherten Werte. Parallel geänderte Einstellungen erfordern erneutes Laden, damit kein fremder Stand überschrieben wird.

Die Gestaltung einschließlich Logo liegt dauerhaft in der Datenbank und ist in Export/Import enthalten. Schema 7 ergänzt bestehende Installationen um die BSV-Vorgaben und erhält Spielstände, Zugangsdaten und Volumes. Sicherungen aus Schema 6 lassen sich weiterhin importieren und erhalten dabei die BSV-Standardgestaltung; Sicherungen aus Schema 7 benötigen diese oder eine kompatible neuere App-Version.

## Tischvermietung

Unter **Tischvermietung** lassen sich freie Tische zu einem vereinbarten Stundenpreis vermieten. Angefangene Minuten werden aufgerundet; Start, Preis und Abrechnung bleiben in der Buchungshistorie gespeichert.

**Vermietung abschließen** zeigt einen festen Endzeitpunkt und den daraus berechneten Betrag. Ein zusätzlicher Klick bestätigt den Abschluss **ohne Texteingabe**. Während der Dialog offen ist, bleibt der Tisch belegt; Abbrechen lässt die Vermietung weiterlaufen. Bei Bestätigung gilt der angezeigte Endzeitpunkt.

Abgeschlossene Buchungen können mit **BUCHUNG ÄNDERN** korrigiert werden. **Buchung löschen** verlangt bei jedem Status **BUCHUNG LÖSCHEN** und weist auf den Verlust der Abrechnungsdaten hin. Aktive Buchungen geben beim Löschen ihren Tisch frei. **Grundpreis speichern** zeigt den alten und neuen Betrag und verlangt **GRUNDPREIS ÄNDERN**; bereits vereinbarte Buchungspreise bleiben erhalten. Diese Texte müssen exakt von Hand eingegeben werden. Einfügen und Drag-and-drop sind gesperrt, Abbrechen und Escape verwerfen die Bestätigung.

Zwischenzeitliche Änderungen erfordern erneutes Prüfen. Der Server kontrolliert Adminrechte, Aktion und Datenversion und protokolliert den vorherigen Datenstand. Gelöschte Buchungsnummern werden nicht wiederverwendet; das Auditprotokoll bleibt erhalten.

### Spielvorbereitung und Zeitmessung

Nach **Tisch zuweisen** ist der Tisch reserviert. Nach der PIN-Anmeldung fragt die Tischseite zuerst **Wer hat das Ausstoßen (Lag) gewonnen?**, danach **Wer hat das erste Break?** Beide Spieler können unabhängig gewählt werden. Mit der zweiten Bestätigung beginnt die Partie; vorher sind Punkte gesperrt. Administratoren können diese Schritte ebenfalls über die Tischseite durchführen. Die Auswahl wird gespeichert und bleibt auch nach Veranstaltungsabschluss mit Warnbestätigung administrativ korrigierbar.

Tablet und Tischübersicht zeigen **Partie** (Gesamtspielzeit) und **Runde** (aktuelle Rackdauer) sekundengenau. Jede Punkteänderung, auch eine Korrektur, startet die aktuelle Rundenzeit neu; beim Erreichen des Spielziels entfällt die nächste Rundenzeit. Die Gesamtzeit endet bei „Spiel abschließen“. Eine Wiederaufnahme setzt die Gesamtzeit fort, ohne die zwischenzeitliche Unterbrechung mitzuzählen; Zurücksetzen auf „Geplant“ löscht die Zeitmessung und verlangt die Vorbereitung erneut. Neuladen und App-Neustarts setzen laufende Zeiten nicht zurück; währenddessen verstrichene Zeit zählt mit.

Die Schema-4-Migration erhält bestehende Ergebnisse und Break-Reihenfolgen. Bereits laufende Bestands-Partien werden ab dem Update zeitlich erfasst; frühere Spielzeit ist nicht rekonstruierbar. Für bereits abgeschlossene Bestands-Partien wird keine Dauer erfunden. Neue Partien beginnen immer mit der zweistufigen Vorbereitung.

### Spiel abschließen

In der zentralen Tischübersicht sowie direkt am Tablet ist die Schaltfläche **Spiel abschließen** sichtbar. Sie wird aktiv, sobald ein Spieler das konfigurierte Spielziel erreicht. Im roten Warndialog den Endstand prüfen, **SPIEL ABSCHLIESSEN** von Hand eingeben und **Spiel abschließen** wählen; **Abbrechen** lässt den Stand unverändert. Der Partienabschluss wird im Auditprotokoll dem Administrator oder der Tisch-ID zugeordnet und gibt den Tisch für die nächste Begegnung frei. Die Verwaltung kann die Partie auch nach Gesamtabschluss mit Warnbestätigung bearbeiten oder löschen. Das Tablet wechselt automatisch zur Warteanzeige. Gleichzeitige Abschlüsse oder zwischenzeitliche Punktänderungen werden durch Versionsprüfung abgefangen. Ein vorzeitiger Abbruch unterhalb des Spielziels ist weiterhin nicht vorgesehen.

Die Spieltagsverwaltung ist direkt über `/#spieltage`, die Tischübersicht über `/#uebersicht` und das Archiv über `/#ergebnisse` erreichbar. Formulareingaben bleiben beim Menüwechsel innerhalb der Seite erhalten; sie werden erst beim erfolgreichen Speichern zurückgesetzt und nicht über einen Browser-Neustart gespeichert.

### Veranstaltungen bearbeiten, löschen und endgültig abschließen

Unter **Spieltagsverwaltung** gibt es für jede Veranstaltung **Veranstaltung bearbeiten** und **Veranstaltung löschen**, bei offenen Veranstaltungen zusätzlich **Veranstaltung abschließen**. Sämtliche Partien bieten **Partie bearbeiten** und **Partie löschen**, auch nach Gesamtabschluss und im Ergebnisarchiv.

Bearbeitbar sind Veranstaltungsname, Format und Datum sowie bei Partien Spieler, Veranstaltungszuordnung, Disziplin, Ziel, erstes Break, Punktestand, Status und Tisch. Eine beendete Partie kann durch Status **Am Tisch** und Zuweisung eines freien Tisches wieder aufgenommen werden. Geplante Partien benötigen 0:0 und keinen Tisch; beendete Partien genau einen Spieler am Spielziel. Doppelbelegung und ungültige Ergebnisse werden serverseitig abgewiesen.

Der Gesamtabschluss ist nur möglich, wenn alle verbliebenen Partien beendet sind (auch eine leere Veranstaltung darf abgeschlossen werden). Danach bleiben neue Partien und die Wiederaufnahme gesperrt. Administrative Korrekturen und Löschungen sind weiterhin möglich. Korrigierte Partien bleiben abgeschlossen und ihrer abgeschlossenen Veranstaltung zugeordnet. Eine Löschung entfernt bei Veranstaltungen auch deren sämtliche Partien und gibt belegte Tische frei. Löschen, Gesamtabschluss und nachträgliche Korrekturen benötigen einen roten Warndialog mit Eintrag und Änderungen. Vergangen bedeutet: Veranstaltungsdatum vor dem heutigen Datum in Europe/Berlin. Die exakten Texte sind **EVENT ÄNDERN**, **SPIEL ÄNDERN**, **SPIEL LÖSCHEN**, **EVENT LÖSCHEN** und **EVENT ABSCHLIESSEN**. Einfügen und Drag-and-drop sind gesperrt. Erst der zusätzliche Klick auf die Aktionsschaltfläche führt die Aktion aus; Abbrechen oder Escape verwirft die Bestätigung. Löschungen sind in der Oberfläche nicht rückgängig zu machen; das interne Auditprotokoll enthält weiterhin die vorherigen Datenstände und dient nicht als Löschfunktion für personenbezogene Daten.

Jede Partienänderung erhöht auch die Veranstaltungsversion. Änderungen, Gesamtabschluss und Löschen mit inzwischen veralteten Daten werden abgewiesen. Partienkorrekturen und -löschungen prüfen zusätzlich die Version ihrer Veranstaltung, beim Verschieben auch die Zielversion. Nach einem Konflikt muss der aktualisierte Eintrag erneut geöffnet und bestätigt werden. Tablets dürfen weiterhin nur Punkte zählen und ihre eigene laufende Partie abschließen; administrative Korrekturen und Löschungen sind ausschließlich über die Admin-Sitzung möglich.
