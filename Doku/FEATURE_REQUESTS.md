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


## FR-006 Anpassungen
- Turnier Teilnehmer Auswahl mit Filteroptionen für BSV Mitglieder und externe Mitglieder. Darüber ein Feld mit der Möglichkeit manuell Spieler für das Turnier anzulegen.
- Teilnehmer Liste Alphabetisch sortiert als einspaltige Liste
- Manuelle Gruppenzuweisung als Auswahloption
- Nach Tischzuweisung darf der Tisch für weitere Zuweisungen nicht im Auswahlmenü erscheinen bis zum Abschluss der Partie
- Partie Reihenfolge sinnvoll sortieren so dass jeder Spieler der Reihe nach drankommt wenn matches von oben nach unten in der Liste gestartet werden
- Link zu Tisch bei gestartet Partie in Partieübersicht hinzufügen
