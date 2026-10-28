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
- Begegnungen einem der eingestellten Tische zuweisen; Doppelbelegung wird verhindert.
- Feste Kiosk-Endpunkte `/tisch/1` bis `/tisch/8`, Punkte +/−, Wechselbreak und automatische Aktualisierung alle drei Sekunden.
- Ergebnisse nach Erreichen des Spielziels zentral oder direkt am zugeordneten Tablet bestätigen. Danach wird der Tisch frei; das Ergebnis bleibt erhalten.
- Obere Adminnavigation: Tischübersicht, Spieltagsverwaltung, Ergebnisse, Tischvermietung und Einstellungen. Die Tischübersicht zeigt laufende Partien; abgeschlossene Partien erscheinen im Ergebnisarchiv.
- Veranstaltungen, Begegnungen, Ergebnisse und Buchungshistorie bieten Zurück/Weiter und 10, 20, 50 oder 100 Einträge pro Seite (Standard: 20). Jede Liste behält ihre Auswahl beim Menüwechsel und bei automatischen Aktualisierungen; eine andere Seitengröße beginnt auf Seite 1. Die Übersicht aller eingestellten Tische bleibt vollständig sichtbar.
- PostgreSQL speichert Veranstaltungen, Begegnungen, Ergebnisse und ein Änderungsprotokoll. Gleichzeitige Eingaben werden mit Versionsprüfung und Transaktionen geschützt.
- Einstellungen bündeln Vereinsgestaltung (FR-009), Grundpreis, Admin-Passwortwechsel und [Datensicherung mit Export und Import (FR-005)](Datensicherung.md). Eine geprüfte Sicherungsdatei kann den vollständigen Anwendungsstand auf einer neuen Installation wiederherstellen.

## Spieler & Mannschaften (FR-007)

Im eigenen Menü **Spieler & Mannschaften** Spieler mit Vorname, optionalem zweitem Namen und Nachname anlegen. Weitere personenbezogene Angaben werden nicht erfasst. Suche nach Name oder interner ID sowie 10/20/50/100 Einträge pro Seite stehen bereit. Gleichnamige Personen behalten unterschiedliche IDs; mögliche Doppeleinträge werden vor dem Speichern angezeigt. Eine zweite Person mit gleichem Namen ausdrücklich bestätigen.

BSV-Mannschaften mit Namen und Spielerzuordnung anlegen oder bearbeiten. Die Mehrfachauswahl erfolgt mit Strg/Cmd; **Archiviert** entfernt einen Spieler oder eine Mannschaft aus der künftigen Vorauswahl und erhält alle historischen Daten. Gegner können ohne BSV-Mannschaft in den Stammdaten stehen; freie Namen ohne Stammdaten bleiben ebenfalls möglich.

Unter **Spieltagsübersicht → Teilnehmer & Mannschaften** für Liga-Spieltage die beiden Mannschaften und ihre getrennt angezeigten Kader bestätigen. Gemeldete Spieler sind vorausgewählt; abwesende Spieler per Checkbox abwählen. Pro Mannschaft kann ein zusätzlicher Name nur für diesen Spieltag eingegeben werden. Für Turniere einzelne Teilnehmer per Checkbox auswählen. Danach Spieler und Tische in den Partien zuweisen. Dieselbe interne Spieler-ID darf nicht auf beiden Seiten stehen.

Bestehende Partien über **Partie bearbeiten** ausdrücklich einem Teilnehmer zuordnen. Gleiche Namen lösen keine automatische Zuordnung aus. Leere Zuordnung erhält freie Namen. Bei der erstmaligen Zuordnung werden der aktuelle vollständige Name und die für diesen Spieltag gewählte Mannschaft gespeichert. Spätere Stammdatenänderungen, Mannschaftswechsel oder Archivierungen ändern diese Momentaufnahme nicht. Die erneute Auswahl derselben Person erhält ihre historische Mannschaft; eine Korrektur der Zuordnung erfolgt bewusst durch Entfernen und erneutes Zuordnen. Ergebnisse lassen sich wie bisher mit den bestehenden Bestätigungen korrigieren.

**Partien & Statistik** bei Spielern oder Mannschaften zeigt alle zugeordneten Partien einschließlich geplanter und laufender Spiele. Die Ergebniszahlen berücksichtigen ausschließlich abgeschlossene Partien: Anzahl, Siege, Niederlagen sowie gewonnene und verlorene Racks. Filter gelten für das Spieltagsdatum (Von/Bis einschließlich) und die Disziplin. Mannschaftswerte zählen zugeordnete Spielerseiten der Einzelpartien; bei zwei Spielern derselben Mannschaft zählen beide Seiten. Eine Mannschaftsgesamtwertung über einen Liga-Spieltag ist nicht enthalten. Die Daten sind Bestandteil der vollständigen Sicherung.

## Vereinsgestaltung (FR-009)

Unter **Einstellungen → Tischanzahl** lässt sich die Anzahl von **1 bis 20** einstellen (Standard: 8). Übersicht, Tischzuweisung und Vermietung übernehmen die Änderung automatisch. Die Tische sind fortlaufend ab 1 nummeriert; Tablet-Adressen lauten beispielsweise `/tisch/20`. Eine Verringerung wird abgelehnt, solange ein entfallender Tisch eine laufende Partie oder Vermietung hat. Abgeschlossene Partien und Buchungen bleiben mit ihrer historischen Tischnummer erhalten und können weiterhin korrigiert werden. Bei parallelen Änderungen neu laden bzw. **Änderungen verwerfen / Neu laden** wählen. Die Einstellung ist Bestandteil der Datensicherung.

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

In der zentralen Tischübersicht sowie direkt am Tablet ist die Schaltfläche **Spiel abschließen** sichtbar. Sie wird aktiv, sobald ein Spieler das konfigurierte Spielziel erreicht. Im roten Warndialog den Endstand prüfen. Der **OK**-Button zeigt einen Countdown und ist erst nach fünf Sekunden anklickbar; eine Texteingabe ist nicht erforderlich. Erst der Klick auf **OK** schließt die Partie ab; **Abbrechen** lässt den Stand unverändert. Der Partienabschluss wird im Auditprotokoll dem Administrator oder der Tisch-ID zugeordnet und gibt den Tisch für die nächste Begegnung frei. Die Verwaltung kann die Partie auch nach Gesamtabschluss mit Warnbestätigung bearbeiten oder löschen. Das Tablet wechselt automatisch zur Warteanzeige. Gleichzeitige Abschlüsse oder zwischenzeitliche Punktänderungen werden durch Versionsprüfung abgefangen. Ein vorzeitiger Abbruch unterhalb des Spielziels ist weiterhin nicht vorgesehen.

Die Spieltagsverwaltung ist direkt über `/#spieltage`, die Tischübersicht über `/#uebersicht` und das Archiv über `/#ergebnisse` erreichbar. Formulareingaben bleiben beim Menüwechsel innerhalb der Seite erhalten; sie werden erst beim erfolgreichen Speichern zurückgesetzt und nicht über einen Browser-Neustart gespeichert.

### Veranstaltungen bearbeiten, löschen und endgültig abschließen

Unter **Spieltagsverwaltung** gibt es für jede Veranstaltung **Veranstaltung bearbeiten** und **Veranstaltung löschen**, bei offenen Veranstaltungen zusätzlich **Veranstaltung abschließen**. Sämtliche Partien bieten **Partie bearbeiten** und **Partie löschen**, auch nach Gesamtabschluss und im Ergebnisarchiv.

Bearbeitbar sind Veranstaltungsname, Format und Datum sowie bei Partien Spieler, Veranstaltungszuordnung, Disziplin, Ziel, erstes Break, Punktestand, Status und Tisch. Eine beendete Partie kann durch Status **Am Tisch** und Zuweisung eines freien Tisches wieder aufgenommen werden. Geplante Partien benötigen 0:0 und keinen Tisch; beendete Partien genau einen Spieler am Spielziel. Doppelbelegung und ungültige Ergebnisse werden serverseitig abgewiesen.

Der Gesamtabschluss ist nur möglich, wenn alle verbliebenen Partien beendet sind (auch eine leere Veranstaltung darf abgeschlossen werden). Danach bleiben neue Partien und die Wiederaufnahme gesperrt. Administrative Korrekturen und Löschungen sind weiterhin möglich. Korrigierte Partien bleiben abgeschlossen und ihrer abgeschlossenen Veranstaltung zugeordnet. Eine Löschung entfernt bei Veranstaltungen auch deren sämtliche Partien und gibt belegte Tische frei. Löschen, Gesamtabschluss und nachträgliche Korrekturen benötigen einen roten Warndialog mit Eintrag und Änderungen. Vergangen bedeutet: Veranstaltungsdatum vor dem heutigen Datum in Europe/Berlin. Die exakten Texte sind **EVENT ÄNDERN**, **SPIEL ÄNDERN**, **SPIEL LÖSCHEN**, **EVENT LÖSCHEN** und **EVENT ABSCHLIESSEN**. Einfügen und Drag-and-drop sind gesperrt. Erst der zusätzliche Klick auf die Aktionsschaltfläche führt die Aktion aus; Abbrechen oder Escape verwirft die Bestätigung. Löschungen sind in der Oberfläche nicht rückgängig zu machen; das interne Auditprotokoll enthält weiterhin die vorherigen Datenstände und dient nicht als Löschfunktion für personenbezogene Daten.

Jede Partienänderung erhöht auch die Veranstaltungsversion. Änderungen, Gesamtabschluss und Löschen mit inzwischen veralteten Daten werden abgewiesen. Partienkorrekturen und -löschungen prüfen zusätzlich die Version ihrer Veranstaltung, beim Verschieben auch die Zielversion. Nach einem Konflikt muss der aktualisierte Eintrag erneut geöffnet und bestätigt werden. Tablets dürfen weiterhin nur Punkte zählen und ihre eigene laufende Partie abschließen; administrative Korrekturen und Löschungen sind ausschließlich über die Admin-Sitzung möglich.

## nuLiga-Import und Gegnerauswahl

Unter **Einstellungen → nuLiga synchronisieren → Jetzt synchronisieren** werden die aktuellen Ligen aller BSV-Pfaffenhofen-Mannschaften ermittelt. Der Abgleich übernimmt alle Mannschaften dieser Ligen und deren Spieler aus der aktuellen Namensmeldung (Meldereihenfolge der jeweiligen Mannschaft). Namen und Kader werden anhand stabiler nuLiga-Kennungen aktualisiert. Nur die öffentlich gemeldeten Kader werden übernommen; Einsatzberechtigungen als Ersatzspieler werden nicht automatisch abgeleitet.

Standardmäßig bleiben lokal geänderte Namen, Archivierungen und Kader erhalten. Mit **Importierte Namen und Kader mit nuLiga überschreiben** werden diese Daten erneut aus der Quelle übernommen. Manuell angelegte Einträge bleiben erhalten; vorhandene gleichnamige Personen werden zur Vermeidung falscher Verknüpfungen nicht automatisch zusammengeführt. Nicht mehr gelieferte Mannschaften oder Spieler werden nicht gelöscht. Ein fehlgeschlagener oder unvollständiger Abruf ändert keine Daten. Der letzte erfolgreiche Abgleich mit Ligen und Anzahl steht in den Einstellungen.

Beim Liga-Spieltag **Teilnehmer & Mannschaften** öffnen. Mannschaft 1 und 2 stehen über ihren getrennten Kaderlisten. Gemeldete Spieler sind vorausgewählt; abwesende Spieler über die Checkbox abwählen. Pro Mannschaft kann ein zusätzlicher Name nur für diesen Spieltag eingegeben werden. Diese Gäste erscheinen nicht in den Stammdaten oder anderen Spieltagen. **Teilnehmer bestätigen · Weiter zur Aufstellung** speichert die Auswahl. Anschließend in der ersten Runde die Spieler und den Tisch je Partie wählen und **Aufstellung speichern**. **Partie starten** benötigt zusätzlich Spielziel und Tablet-PIN.

### Getrennte Stammdatenlisten und Spielerprofile

Die Menüpunkte **Spieler** und **Mannschaften** öffnen jeweils eine eigene Liste. In der Spielerliste stehen rechts neben dem Namen alle zugeordneten Mannschaften; die Suche berücksichtigt auch Mannschaftsnamen. Importierte Spieler haben einen Link zu ihrem nuLiga-Profil. Bei BSV-Pfaffenhofen-Spielern steht zusätzlich **Partien & Statistik** bereit, bei gegnerischen Spielern ersetzt der Profillink diesen Button. Manuell angelegte Spieler ohne Importzuordnung werden ohne Profillink angezeigt.

Im Mannschaftsbereich öffnen **nuLiga-Mannschaft**-Links die jeweiligen Mannschaftsprofile. Die lokale Statistikansicht entfällt dort. Manuell angelegte Mannschaften ohne Importzuordnung zeigen einen entsprechenden Hinweis.

## Spieltage planen, synchronisieren und starten

Unter **Spieltage planen** werden Spieltage manuell angelegt. Beide nuLiga-Abgleiche stehen gemeinsam unter **Einstellungen**: zuerst Spieler und Mannschaften, anschließend kommende Heimspieltage synchronisieren. Gegner und gemeldete Spieler sind beim Import bereits zugeordnet. Es werden noch keine Einzelpartien gestartet oder Tische belegt.

Mit **Spieltag starten** öffnet sich bei Liga-Spieltagen zuerst die Mannschafts- und Kaderauswahl. Erst die Bestätigung gibt den Spieltag frei und öffnet die **Spieltagsübersicht** mit der ersten Runde. Dort lassen sich unter **Teilnehmer & Mannschaften** Zuordnungen anpassen, konkrete Einzelpartien anlegen, Spieler auswählen und anschließend Tische zuweisen. Der Spieltagsstart startet noch keine Einzelpartie und keine Zeitmessung. Bereits gestartete oder abgeschlossene Spieltage bleiben beim erneuten Sync unverändert. Terminänderungen werden bei noch geplanten Importen übernommen; lokal geänderte Namen und Daten bleiben erhalten. Nicht mehr gelieferte Termine werden zur Sicherheit nicht automatisch gelöscht. Bereits vor dieser Erweiterung vorhandene Veranstaltungen gelten weiterhin als gestartet.

## Fester Spielplan mit zehn Partien

Nach dem Spieltagsstart zeigt die Übersicht drei Blöcke: vier Einzel (8-Ball, 9-Ball, 10-Ball, 14/1), zwei Doppel (9-Ball und 10-Ball) und erneut die gleichen vier Einzel. Jede Partie hat Spieler-Dropdowns pro Mannschaft, eine Tischauswahl und ein frei einzutragendes Spielziel. Bei den beiden Doppelpartien werden je zwei Spieler jeder Mannschaft ausgewählt. Die Spielziele haben keine Vorgaben; 14/1 verwendet Punkte (bis 999), die übrigen Disziplinen Gewinnspiele.

**Aufstellung speichern** erhält auch unvollständige Planungen und Tischwünsche, ohne einen Tisch zu belegen. **Partie starten** verlangt die vollständige Aufstellung, Tisch, Spielziel und eine sechsstellige Tablet-PIN. Tisch- und Spielerkonflikte werden geprüft. Am Tablet werden anschließend Ausstoßen und erster Anstoß bestätigt; erst dann beginnt die Zeitmessung. Gestartete Aufstellungen sind gesperrt; Ergebnisse lassen sich weiter über die vorhandene bestätigte Korrektur bearbeiten. Bestehende freie Partien bleiben unter Weitere Partien erhalten. Doppelteilnahmen werden für beide Spieler in der Statistik berücksichtigt.

### Synchronisierung nur für Heimspiele

Der Spieltags-Sync übernimmt ausschließlich kommende Heimspiele des BSV Pfaffenhofen. Bereits importierte Auswärtsspieltage ohne angelegte Einzelpartien werden entfernt, auch wenn die Spieltagsübersicht schon geöffnet wurde. Manuelle Spieltage und historische Ergebnisse bleiben erhalten. In der Spieltagsübersicht steht die nuLiga-Heimmannschaft immer links (Heim), der Gegner rechts (Gast).
