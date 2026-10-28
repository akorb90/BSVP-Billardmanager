# Feature Requests – BSVP Billardmanager

Dieses Dokument enthält ausschließlich offene oder in Umsetzung befindliche Feature Requests. Erfolgreich umgesetzte Anforderungen werden mit ihrer FR-Nummer, dem Umsetzungsdatum und dem Prüfstand in die [Release Notes](CHANGELOG.md) übernommen und hier entfernt. Bestehende FR-Nummern bleiben erhalten und werden nicht erneut vergeben.

Empfohlene Reihenfolge: Datensicherung (FR-005) → Spieler- und Mannschafts-Stammdaten mit Teilnehmerauswahl (FR-007) → Turnierverwaltung mit Tischzuweisung (FR-006) → statistische Auswertungen aus FR-007. Das Regelwerk (FR-008) kann unabhängig davon umgesetzt werden. Zuschaueranzeige, Vorlagen und weiterführender Mannschaftsbetrieb bleiben Erweiterungsideen und benötigen eigene Feature Requests.

## FR-005: Datensicherung mit Export und Import

Eine Export-/Importfunktion für alle Daten und Einstellungen bereitstellen, damit die Anwendung beispielsweise nach einem Laptop-Ausfall aus einer Sicherung wiederhergestellt werden kann.

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

## FR-007: Spieler- und Mannschaftsverwaltung mit Teilnehmerauswahl und Statistiken

Spieler und Mannschaften zentral verwalten und bei Turnieren sowie Liga-Spieltagen wiederverwenden, damit Namen nicht für jede Begegnung neu eingegeben werden müssen. Zugeordnete Partien bilden die Grundlage für Spieler- und Mannschaftsstatistiken.

Anforderungen und Abnahmekriterien:

- Ausschließlich Vorname, zweiter Name und Nachname als personenbezogene Stammdaten erfassen. Vorname und Nachname sind Pflichtfelder; der zweite Name ist optional. Keine zusätzlichen Angaben wie Geburtsdatum, Kontakt- oder Verbandsdaten verlangen.
- Mannschaften des BSV Pfaffenhofen mit Mannschaftsname und Spielerzuordnung anlegen und bearbeiten. Mannschaften für Liga-Spieltage auswählen; bei der Begegnungsplanung die zugeordneten Spieler zur Auswahl anbieten. Die Erfassung gegnerischer Spieler bleibt auch ohne Zuordnung zu einer BSV-Mannschaft möglich.
- Alle ausdrücklich zugeordneten Partien in Spieler- und Mannschaftsübersichten erfassen. Abgeschlossene Partien nach Zeitraum und Disziplin auswerten; Anzahl, Siege, Niederlagen und gewonnene/verlorene Racks anzeigen. Geplante und laufende Partien nicht als abgeschlossene Ergebnisse zählen. Eine Mannschaftsgesamtwertung aus mehreren Einzelpartien ist ein eigener späterer Ausbau.
- Spieler anlegen, bearbeiten und in einer durchsuchbaren Liste mit der bestehenden Seitennavigation verwalten. Eine interne stabile ID unterscheidet auch Personen mit identischen Namen; mögliche Doppeleinträge vor dem Anlegen anzeigen.
- Teilnehmer für einen Turnier- oder Liga-Spieltag aus den Stammdaten auswählen. Bei der Begegnungsplanung Spieler A und B aus dieser Teilnehmerliste vorauswählen; dieselbe Person darf nicht gegen sich selbst antreten.
- Vorhandene Partien ohne Stammdatenzuordnung bleiben lesbar und bearbeitbar. Eine nachträgliche Zuordnung muss ausdrücklich erfolgen und darf Personen nicht allein anhand gleicher Namen automatisch zusammenführen.
- Namensänderungen, Mannschaftswechsel und das Entfernen eines Spielers oder einer Mannschaft aus der künftigen Vorauswahl dürfen gespeicherte historische Namen, Partien und Ergebnisse nicht verändern oder löschen. Für Mannschaftsauswertungen gilt die bei der jeweiligen Partie gespeicherte Mannschaftszuordnung; ein späterer Wechsel darf frühere Ergebnisse nicht einer anderen Mannschaft zuschlagen.
- Spieler, Mannschaften und Teilnehmerzuordnungen dauerhaft speichern und beim Export/Import gemäß FR-005 berücksichtigen.
- Einen eigenen Menüpunkt „Spieler & Mannschaften“ für Stammdaten, Zuordnungen und statistische Übersichten bereitstellen.

## FR-008: Aktuelles BBV-Verbandsregelwerk als Nachschlagewerk

Das jeweils aktuelle, offiziell veröffentlichte Regelwerk des Bayerischen Billardverbands (BBV) soll innerhalb der Anwendung leicht auffindbar sein und bei Regelfragen als Nachschlagewerk dienen.

Anforderungen und Abnahmekriterien:

- Einen eigenen Bereich „Regelwerk“ mit den für Poolbillard und den Liga-/Turnierbetrieb relevanten offiziellen BBV-Dokumenten bereitstellen. Welche Dokumente maßgeblich sind, bei der Umsetzung anhand der offiziellen BBV-Veröffentlichungen prüfen.
- Dokumenttitel, Herausgeber, Versions- bzw. Gültigkeitsstand, offiziellen Quellenlink und Datum der letzten Quellenprüfung anzeigen. Fehlende Versionsangaben ausdrücklich kennzeichnen.
- Offizielle Dokumente direkt öffnen und, soweit technisch und rechtlich möglich, in der Anwendung durchsuchbar anzeigen. Falls eine eingebettete Anzeige nicht möglich ist, einen klaren Link zum Original anbieten.
- Einen nachvollziehbaren Aktualisierungsweg vorsehen, damit neue offizielle Fassungen übernommen und veraltete Verweise erkannt werden. Bei nicht erreichbarer Quelle oder nicht bestätigter Aktualität einen entsprechenden Hinweis anzeigen.
- Aus Turnier- und Liga-Spieltagen direkt zum Nachschlagewerk gelangen. Verbandsregeln als Referenz bereitstellen; Spielstände, Turnierregeln und laufende Veranstaltungen werden durch Dokumentaktualisierungen nicht automatisch geändert.

## FR-009: UI Generalisieren

Einstellungsmenü erweitern um Logo Upload, eigenen Vereinsnamen und Farbschema Editierung.
So soll der Manager auch für andere Vereine nutzbar werden.


## FR-010 Dokumentation und Deployment überarbeiten

Die Readme Datei muss auf das wesentliche reduziert werden um eine Instanz der Anwendung frisch bereitzustellen oder mit der aktuellen Version von Github zu aktualiseren.
Im gleichen Zuge soll auch das gesamte Deployment vereinfacht werden.
Prüfung ob image auf repository geladen werden kann, sodass am ausführenden client nur noch ein docker pull notwendig ist um die Version zu aktualisieren.

Restliche Dokumentation in Doku Ordner abgelegt und sinnvoll strukturiert werden.
