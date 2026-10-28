# Feature Requests – BSVP Billardmanager

Dieses Dokument enthält ausschließlich offene oder in Umsetzung befindliche Feature Requests. Erfolgreich umgesetzte Anforderungen werden mit ihrer FR-Nummer, dem Umsetzungsdatum und dem Prüfstand in die [Release Notes](CHANGELOG.md) übernommen und hier entfernt. Bestehende FR-Nummern bleiben erhalten und werden nicht erneut vergeben.

Als nächster Ausbau folgt die Turnierverwaltung (FR-006) auf Basis der umgesetzten Spieler- und Mannschaftsverwaltung (FR-007). Datensicherung (FR-005) ist ebenfalls umgesetzt, siehe [Release Notes](CHANGELOG.md). Das Regelwerk (FR-008) kann unabhängig davon umgesetzt werden.

## FR-006: Turnierverwaltung mit Auslosung, Gruppenphase und KO-Baum

Turniere sollen aus einer Teilnehmerliste automatisch ausgelost und als Gruppenphase, KO-Turnier oder Gruppenphase mit anschließender KO-Runde organisiert werden können. Auslosung, Spielplan und Ergebnisfortschritt bilden einen gemeinsamen Ablauf.

Anforderungen und Abnahmekriterien:

- Teilnehmer aus den Spieler-Stammdaten (FR-007) auswählen; doppelte Teilnahme derselben Person verhindern.
- Vor der Auslosung Modus, Disziplin, Gewinnspiele sowie bei Gruppenphasen Gruppenanzahl und Anzahl der Qualifikanten je Gruppe festlegen. Unzulässige Kombinationen verständlich erklären.
- Zufällige Auslosung als Vorschau anzeigen und erst nach Bestätigung übernehmen. Vor Turnierbeginn kann neu ausgelost werden; nach Beginn darf eine neue Auslosung bestehende Partien oder Ergebnisse nicht überschreiben.
- In Gruppen spielt jeder gegen jeden. Begegnungen, Ergebnisse, Tabellen und Qualifikation nachvollziehbar anzeigen. Die Rangfolge- und Gleichstandsregeln vor Turnierbeginn festlegen und anzeigen; ungeklärte Gleichstände müssen vor der KO-Zuordnung aufgelöst werden.
- Einen Einfach-KO-Baum mit Runden, Paarungen und Siegerfortschritt darstellen. Freilose bei unpassender Teilnehmerzahl ausdrücklich anzeigen und korrekt weiterführen.
- Bestätigte Ergebnisse aktualisieren Gruppentabelle bzw. KO-Baum und erzeugen die nachfolgenden Begegnungen. Korrekturen mit Auswirkungen auf bereits gestartete Folgepartien dürfen nicht unbemerkt den Turnierverlauf verändern.
- Generierte Begegnungen in die bestehende Tischzuweisung, Tablet-Erfassung und Spielhistorie integrieren. Turnierstand und Auslosung bleiben nach Neuladen und Neustart erhalten.

Abhängigkeit: FR-007 liefert die Teilnehmerauswahl. FR-008 dient als Nachschlagewerk; daraus folgt keine automatische Umsetzung sämtlicher Verbandsregeln.

## FR-008: Aktuelles BBV-Verbandsregelwerk als Nachschlagewerk

Das jeweils aktuelle, offiziell veröffentlichte Regelwerk des Bayerischen Billardverbands (BBV) soll innerhalb der Anwendung leicht auffindbar sein und bei Regelfragen als Nachschlagewerk dienen.

Anforderungen und Abnahmekriterien:

- Einen eigenen Bereich „Regelwerk“ mit den für Poolbillard und den Liga-/Turnierbetrieb relevanten offiziellen BBV-Dokumenten bereitstellen. Welche Dokumente maßgeblich sind, bei der Umsetzung anhand der offiziellen BBV-Veröffentlichungen prüfen.
- Dokumenttitel, Herausgeber, Versions- bzw. Gültigkeitsstand, offiziellen Quellenlink und Datum der letzten Quellenprüfung anzeigen. Fehlende Versionsangaben ausdrücklich kennzeichnen.
- Offizielle Dokumente direkt öffnen und, soweit technisch und rechtlich möglich, in der Anwendung durchsuchbar anzeigen. Falls eine eingebettete Anzeige nicht möglich ist, einen klaren Link zum Original anbieten.
- Einen nachvollziehbaren Aktualisierungsweg vorsehen, damit neue offizielle Fassungen übernommen und veraltete Verweise erkannt werden. Bei nicht erreichbarer Quelle oder nicht bestätigter Aktualität einen entsprechenden Hinweis anzeigen.
- Aus Turnier- und Liga-Spieltagen direkt zum Nachschlagewerk gelangen. Verbandsregeln als Referenz bereitstellen; Spielstände, Turnierregeln und laufende Veranstaltungen werden durch Dokumentaktualisierungen nicht automatisch geändert.
