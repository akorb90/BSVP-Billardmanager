# Feature Requests – BSVP Billardmanager

Dieses Dokument enthält ausschließlich offene oder in Umsetzung befindliche Feature Requests. Erfolgreich umgesetzte Anforderungen werden mit ihrer FR-Nummer, dem Umsetzungsdatum und dem Prüfstand in die [Release Notes](CHANGELOG.md) übernommen und hier entfernt. Bestehende FR-Nummern bleiben erhalten und werden nicht erneut vergeben.

Turnierverwaltung (FR-006), Spieler- und Mannschaftsverwaltung (FR-007) sowie Datensicherung (FR-005) sind umgesetzt, siehe [Release Notes](CHANGELOG.md). Offen bleibt das Regelwerk (FR-008).

## FR-008: Aktuelles BBV-Verbandsregelwerk als Nachschlagewerk

Das jeweils aktuelle, offiziell veröffentlichte Regelwerk des Bayerischen Billardverbands (BBV) soll innerhalb der Anwendung leicht auffindbar sein und bei Regelfragen als Nachschlagewerk dienen.

Anforderungen und Abnahmekriterien:

- Einen eigenen Bereich „Regelwerk“ mit den für Poolbillard und den Liga-/Turnierbetrieb relevanten offiziellen BBV-Dokumenten bereitstellen. Welche Dokumente maßgeblich sind, bei der Umsetzung anhand der offiziellen BBV-Veröffentlichungen prüfen.
- Dokumenttitel, Herausgeber, Versions- bzw. Gültigkeitsstand, offiziellen Quellenlink und Datum der letzten Quellenprüfung anzeigen. Fehlende Versionsangaben ausdrücklich kennzeichnen.
- Offizielle Dokumente direkt öffnen und, soweit technisch und rechtlich möglich, in der Anwendung durchsuchbar anzeigen. Falls eine eingebettete Anzeige nicht möglich ist, einen klaren Link zum Original anbieten.
- Einen nachvollziehbaren Aktualisierungsweg vorsehen, damit neue offizielle Fassungen übernommen und veraltete Verweise erkannt werden. Bei nicht erreichbarer Quelle oder nicht bestätigter Aktualität einen entsprechenden Hinweis anzeigen.
- Aus Turnier- und Liga-Spieltagen direkt zum Nachschlagewerk gelangen. Verbandsregeln als Referenz bereitstellen; Spielstände, Turnierregeln und laufende Veranstaltungen werden durch Dokumentaktualisierungen nicht automatisch geändert.

## FR-015: Lagerverwaltung, Getränketracking
Dieser Feature Request muss nicht auf einmal umgesetzt werden, er kann in sinnvoll gruppierte Untertasks gespliittet werden!
Analysiere den FR im ersten Schritt und formulieren in weiter aus, erweitere ihn um sinnvolle Funktionen. 

Es wird eine Lagerverwaltung für Getränke benötigt. Hier müssen sowohl Einzelflaschen als auch ganze Kästen unterschiedlicher Formate schnell und einfach erfasst werden.
Denkbar wäre auch ein Barcode Scanner mit Anbindung an eine Produktdatenbank, wenn dies sinnvoll umsetzbar ist.
Bulk Eingabe auf Basis der letzten Wareneingangsbuchungen oder manuell angelegter Vorlage.

Jedes Getränke braucht einen VK Preis, EK kann optional für Auswertungen angegeben werden. Reporting Dashboard für z.B. monatliche Auswertungen integrieren.

Ein vermieteter Tisch braucht ein Kommentarfeld das bei der Buchung verpflichtend befüllt werden muss. Darüber wird z.B. der Name der ausleihenden Person erfasst. Dieser muss auch in der Tischübersicht angezeigt werden.
Auf einen vermieteten Tisch werden Getränke verbucht. Die Tischkarte zeigt auch die aktuellen Getränkekosten an. Bei Abschluss der Tischbuchung erfolgt Auflistung aller Getränke und der Tischmiete. Die Elemente müssen jeweils mit einer Checkbox bestätigt werden vor finalem Abschluss der Tischbuchung.
Keine Kassenfunktion, da TSE Vorgaben den Rahmen sprengen.
