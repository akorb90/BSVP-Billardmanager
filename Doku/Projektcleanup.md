# FR-013: Analyse und weitere Entscheidungen

Stand: 2026-10-29. Ziel ist weniger Kontext- und Ausgabetext bei gleicher Prüfqualität. Eine belastbare Tokenmessung früherer Umsetzungen liegt nicht vor; die folgenden Einsparungen sind qualitativ, keine gemessenen Prozentwerte.

## Befund und umgesetzte Maßnahmen

- `public/app.js` umfasst rund 90 KB, `src/server.js` rund 36 KB. Vollständiges Lesen dieser Dateien kostet bei jeder Aufgabe unnötigen Kontext. `AGENTS.md` verlangt deshalb Symbolsuche und relevante Ausschnitte und enthält eine kurze Zuordnung von Dateien zu Aufgaben.
- `npm test` nutzt den Node-Testläufer; `scripts/docker-smoke.js` gibt zusätzlich den Compose-Build und Containerablauf aus. Die vollständige Ausgabe bleibt künftig lokal gespeichert; im Arbeitskontext erscheinen zunächst Exitcode und Zusammenfassung. Fehler werden anhand der gespeicherten Details untersucht. Der Docker-Test schreibt bei Erfolg bereits `data/docker-test-*/result.json`; auch Prozessende und Bereinigung müssen erfolgreich sein.
- Die CI prüft bereits Unit-Tests, Compose, isoliertes HTTPS und den Betrieb fertiger Images. Lokal bleiben risikobasierte Prüfungen und das vorgeschriebene Deployment erhalten. Die Testauswahl ist nun ausdrücklich beschrieben; reine Dokumentation benötigt keinen vollständigen Datenbank-Integrationstest.
- Commit und Push erfolgen standardmäßig durch den Entwickler. Der Agent liefert überprüfbare Änderungen und Prüfresultate. Lokales Deployment und Zustandskontrolle bleiben verbindlich.
- Die zunächst veraltete Architekturübersicht wurde mit dem Code auf Schema 13 abgeglichen. Historische Änderungen und unterstützte Upgradewege stehen jetzt separat unter [Migrationen](Migrationen.md).
- `/output/` ist gezielt von Git ausgeschlossen. Dort liegen lokale Screenshots, nuLiga-Rechercheausgaben und Hintergrundbildvarianten; bestehende Dateien bleiben erhalten. Versionierte Dokumentations- und Anwendungsbilder werden weiterhin erfasst.

## Kompakte Prüfausgabe

Beispiel in PowerShell (einen eigenen Laufordner verwenden):

```powershell
$runDir = Join-Path 'data' ('checks-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$testLog = Join-Path $runDir 'tests.log'
npm test *> $testLog
$testExit = $LASTEXITCODE
Get-Content -LiteralPath $testLog -Tail 12
Write-Output "Tests: Exitcode $testExit; Log: $testLog"
if ($testExit -ne 0) { throw "Tests fehlgeschlagen; Fehlerdetails in $testLog untersuchen." }
```

Dies ändert weder Testumfang noch Assertions. Bei Fehlern gezielt nach fehlgeschlagenen Tests suchen und deren Kontext lesen. Build und Docker-Test entsprechend protokollieren; deren Exitcode jeweils sofort sichern. Vollständige Logs lokal behalten, nicht ungeprüft veröffentlichen.

## Weitere Optionen zur Entscheidung

Die folgenden Maßnahmen sind Vorschläge und noch nicht umgesetzt:

| Maßnahme | Vorteil | Nachteil / Aufwand | Empfehlung |
| --- | --- | --- | --- |
| Gemeinsames Prüfskript mit Logdatei, Exitcode und maschinenlesbarer Zusammenfassung | Weniger wiederholte Shellbefehle; einheitliche Fehlerberichte auch in CI | Zusätzliches Skript muss Prozessfehler, Abbruch und Bereinigung zuverlässig behandeln | Als kleine Folgeaufgabe sinnvoll, sobald der manuelle Ablauf erprobt ist |
| Frontend nach Fachbereichen und HTTP-Routen in Module aufteilen | Kleinere relevante Dateien; Änderungen und Reviews leichter einzugrenzen | Größerer Refactoringaufwand, Risiko bei UI-Zustand, Auth und Routen; umfassende Regressionstests nötig | Schrittweise bei fachlichen Änderungen, kein pauschaler Umbau nur zum Tokensparen |
| Lokales Deployment durch Entwickler übernehmen | Agent muss Buildlauf und Zustandskontrolle nicht begleiten | Sofortige Live-Prüfung entfällt; Fehler können erst nach Übergabe auffallen | Nur nach ausdrücklicher Änderung der bisherigen Deploymentregel; Übergabe mit exaktem Befehl und HTTPS-/Containerprüfung |
| Umfangreiche Integration ausschließlich durch CI ausführen | Weniger lokale Laufzeit und doppelte Ausgaben | Rückmeldung später; uncommittete Änderungen bleiben lokal ungeprüft; CI benötigt Push | Für Daten-, Backup- und Sicherheitsänderungen vorerst nicht übernehmen |

Keine Anwendungseinstellungen oder persistenten Datenarten wurden verändert. Die vollständige Anwendungssicherung und separate Betriebssicherung bleiben unverändert verpflichtend.
