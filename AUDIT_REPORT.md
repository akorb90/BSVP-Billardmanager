# Audit des BSVP Billardmanagers

## Auditabschluss — 01.11.2026

AP1 bis AP6 einschließlich des zusätzlich freigegebenen API-/Pollingumbaus sind abgeschlossen. Alle neun ursprünglichen Findings sind behoben beziehungsweise im Fall TECH-002 für den Browser umgesetzt und nachgemessen. Die folgenden älteren Nachträge dokumentieren den jeweiligen Zwischenstand; maßgeblich ist dieser Abschluss. AP6 und die Abschlussdokumentation werden gemeinsam mit diesem Stand versioniert.

| Arbeitspaket | Gezielte Tests | Gesamtsuite am jeweiligen Abschluss | Zusätzlicher Nachweis | Lokale vollständige Protokolle |
|---|---:|---:|---|---|
| AP1 — parallele Ligaänderungen | 21/21 | 53/53 | Browser mit getrennten Sitzungen; isolierter Docker-/HTTPS-Test | `data/ap1-2026-11-01/` |
| AP2 — Teilnehmerbelegung und Korrekturgrenzen | 48/48 | 74/74 | Browserkorrektur 14/1; PostgreSQL-/HTTPS-Test | `data/ap2-2026-11-01/` |
| AP3 — semantische Backupprüfung | 36/36 | 105/105 | Getrennte PostgreSQL-Datenbanken, negative und vollständige gültige/Legacy-Restores | `data/ap3-2026-11-01/` |
| AP4 — 14/1-Rackstatistik | 27/27 | 107/107 | Browser mit Disziplin-/Datumsfiltern; Docker-/HTTPS-Test | `data/ap4-2026-11-01/` |
| AP5 — Fokus, Dialognamen, Singularformen | 31/31 | 111/111 | Echte Tastatur-/Browserprüfung; Docker-/HTTPS-Test | `data/ap5-ap6-2026-11-01/` |
| AP6 — Livezustand, Archivseiten, vollständige Statistik | 36/36 | 116/116 | Browser, zwei isolierte PostgreSQL-/HTTPS-Läufe, Budgetmessung | `data/ap6-implementation-2026-11-01/` |

Die Suitezahlen sind kumulative Stände, keine zu addierenden Einzelmengen; alle genannten Abschlussläufe ohne übersprungene Tests. Frühere Fehlversuche und deren Korrekturen bleiben in den jeweiligen Nachträgen und vollständigen lokalen Logs dokumentiert. Aktuell maßgeblich: `targeted-complete-fixed.log` (36/36), `full-suite-complete.log` (116/116), `docker-benchmark.log`, `docker-final.log`, `https.log` und `final-verification.log` im AP6-Protokollordner. Die Logs unter `data/` bleiben lokal; diese Prüfliste und die [Messrohdaten](Doku/Performance.md) sind versioniert.

Das vereinbarte Performancebudget ist im isolierten Container-Test erfüllt: 4.046 Bytes Liveantwort und p95 6,95 ms bei 10.000 Archivpartien, acht Livepartien und zehn Clients. Das lokale Deployment ist aktiv; App/PostgreSQL gesund, Proxy läuft. HTTPS mit bestehender CA sowie ausgelieferter Client und Backendmodule wurden geprüft. Secrets und dauerhafte Datenvolumes wurden erhalten.

Außerhalb dieses Audits bleiben FR-008 (Verbandsregelwerk) sowie reale WLAN-/Geräte-/Turnier-/Langzeitlasttests. Der vollständige Legacy-Admin-Endpunkt bleibt für Integrationen verfügbar; der Browser nutzt ausschließlich die neuen getrennten Lesezugriffe. Diese Grenzen verhindern den Abschluss der beauftragten Auditpakete nicht.


**Stand:** 01.11.2026 · **Basis:** `main`, Commit `0a7fc5899ead3cf5f701fb332f1ae1c39dfe56ed`.

Der Checkout war zu Beginn sauber. Der Auditauftrag wurde ausschließlich analytisch bearbeitet. Anwendungscode, Konfiguration, Sicherheitsdateien und Produktionsdaten wurden nicht geändert. Es gab keinen Commit, Push oder Deployment. Temporäre Prüfprogramme und vollständige Testlogs liegen im ignorierten Ordner `data/audit-2026-11-01/`.

**Nachtrag nach Freigabe vom 01.11.2026:** AP1 (FUNC-001) wurde anschließend ausdrücklich freigegeben und umgesetzt. Bearbeitete Ligaentwürfe behalten ihre Ausgangsversion, unbearbeitete Formulare übernehmen neue Serverwerte; bei Konflikten kann der Entwurf bewusst verworfen und der Serverstand geladen werden. Gezielte Navigationstests: 21/21; Gesamtsuite: 53/53, keine übersprungenen Tests. Zwei getrennte synthetische Adminsitzungen, mehrere Pollzyklen, Zurücknavigation, Konfliktablehnung und anschließendes Speichern wurden im Browser geprüft. Prüf- und Bereitstellungsstand wird unter `data/ap1-2026-11-01/PROGRESS.md` fortgeschrieben. Die folgenden Auditbefunde beschreiben den ursprünglichen Stand; FUNC-001 ist durch diesen Nachtrag als behoben gekennzeichnet. FUNC-004 wurde auf die gewünschte 14/1-Wertung mit zehn vollen Kugelpunkten je Rack angepasst; AP4 ist weiterhin offen.

## A. Gesamteinschätzung

**Aktueller Nachtrag AP5/AP6 vom 01.11.2026:** AP5 ist als `ae03efa` committed und lokal HTTPS-geprüft. Nach der Ausgangsmessung wurde der API-/Pollingumbau einschließlich Budget ausdrücklich freigegeben und umgesetzt. Der Browser verwendet getrennten Livezustand, serverseitig begrenzte Archivseiten und vollständige Statistikaggregate. 36 gezielte Tests, Gesamtsuite 116/116 ohne Skips, Browserprüfung und isolierter PostgreSQL-/HTTPS-Lauf samt Benchmark bestanden. Bei 10.000 Archivpartien plus acht laufenden Partien und zehn Clients: 4.046 Bytes Liveantwort, p95 6,95 ms; das vereinbarte Budget von 256 KiB/500 ms ist in dieser Messreihe erfüllt. Alle neun ursprünglichen Findings sind damit bearbeitet; TECH-002 ist für den Browser behoben. Der vollständige Admin-Endpunkt bleibt für Integrationen verfügbar. AP6 ist Teil des Abschlussstands. [Messbericht, Basis-/Nachmessung und Grenzen](Doku/Performance.md). Fortsetzungsstand: `data/ap6-implementation-2026-11-01/PROGRESS.md`.

**AP6-Bereitstellung:** Bestehender lokaler Stack erfolgreich gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS /health 200 mit bestehender CA und aktiver Zertifikatsprüfung. Ausgeliefertes app.js und geänderte Backendmodule per SHA-256 bestätigt. Secrets und dauerhafte Datenvolumes erhalten; Stack bleibt aktiv. Der Push ist mit dem Auditabschluss beauftragt.

**Nachtrag AP4 vom 01.11.2026:** AP3 wurde als `e420ec4` auf `main` committed. Das anschließend freigegebene AP4 behebt FUNC-004: 14/1-Filter ergänzt, Rackwertung vor der Summierung je Partie/Seite mit `Math.floor(punkte / 10)` (114:69 → 11:6). Statistische Partienlisten zeigen Racks und die zugehörigen Originalpunkte. Datums-/Disziplinfilter, Spieler, Doppelpartner und Mannschaftsseiten nutzen dieselbe Regel; Sieg/Niederlage bleibt am tatsächlichen Punktestand orientiert. Die Statistikformularerkennung wurde wegen des Feldnamens `id` korrigiert. Prüfung: 27 gezielte Tests, Gesamtsuite 107/107 ohne übersprungene Tests sowie erfolgreiche Browserprüfung. Der erste Gesamtlauf scheiterte an einer fehlenden Hilfsfunktion im isolierten Statistik-Testaufbau; der Aufbau wurde um den echten Quellcode und einen 14/1-Fall ergänzt, danach bestanden alle Tests. Aktueller Prüf-/Bereitstellungsstand: `data/ap4-2026-11-01/PROGRESS.md`. Fünf von neun ursprünglichen Findings sind behoben; vier bleiben offen. AP4 ist noch nicht committed.

**AP4-Bereitstellung:** Isolierter Docker-/PostgreSQL-/HTTPS-Test erfolgreich. Bestehendes Projekt `billardmanager` mit beiden Compose-Dateien gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS `/health` 200 mit vorhandener CA und aktiver Zertifikatsprüfung; ausgeliefertes `app.js` entspricht dem geprüften AP4-Quellcode. Stack bleibt aktiv; Secrets und dauerhafte Datenvolumes erhalten. Keine neue Datenart oder Datenmigration; gespeicherte Kugelpunkte bleiben die unveränderte Grundlage der Sicherung.

**Nachtrag AP3 vom 01.11.2026:** AP2 ist als `0f6d4fe` auf `main` committed. Das anschließend freigegebene AP3 behebt TECH-001: Backupprüfung und laufende Vermietung verwenden denselben Fachvalidator für Status, Preis-/Prozentgrenzen und exakt passende Abrechnungswerte. Admin- und PIN-Hashes werden mit gemeinsamem Formatvalidator geprüft; Legacy-PIN-`null` bleibt zulässig. Es findet keine stille Reparatur statt. Prüfung: 36 gezielte Tests, Gesamtsuite 105/105 ohne übersprungene Tests sowie erfolgreicher isolierter PostgreSQL-/HTTPS-Test mit getrennten Datenbanken, negativen Importfällen und vollständigen gültigen/Legacy-Restores. Aktueller Prüf-/Bereitstellungsstand: `data/ap3-2026-11-01/PROGRESS.md`. Vier der ursprünglich neun Findings sind behoben; fünf bleiben offen. AP3 ist noch nicht committed.

**AP3-Bereitstellung:** Bestehendes Projekt `billardmanager` erfolgreich mit beiden Compose-Dateien gebaut und gestartet. App und PostgreSQL gesund, Proxy aktiv; HTTPS `/health` 200 mit vorhandener CA und aktiver Zertifikatsprüfung. Die drei geänderten Backendmodule im laufenden Container stimmen per SHA-256 mit dem geprüften Quellcode überein. Keine produktiven Restoretests, keine Änderung der Sicherheitskonfiguration und kein Push; der Stack bleibt aktiv.

**Nachtrag AP2 vom 01.11.2026:** Audit/AP1 sind als `3554534` auf `main` committed. Anschließend wurde AP2 ausdrücklich freigegeben: FUNC-002 ist durch eine gemeinsame transaktionale Teilnehmerprüfung einschließlich Doppelpartnern für Starts, Live-Änderungen und Wiederaufnahme behoben; FUNC-003 durch dynamische Formulargrenzen für 14/1-Ergebniskorrekturen. Prüfung: 48 gezielte Tests, Gesamtsuite 74/74 ohne übersprungene Tests, erfolgreicher isolierter PostgreSQL-/HTTPS-Test mit zusätzlichem Belegungsregressionstest sowie echte Browserkorrektur 125:80 → 125:79 und reine Namensänderung. AP2 ist im bestehenden lokalen Stack bereitgestellt: App und PostgreSQL gesund, Proxy aktiv, HTTPS `/health` 200 mit vorhandener CA und aktiver Zertifikatsprüfung; ausgeliefertes `app.js` stimmt mit dem geprüften Quellcode überein. Vollständiger Prüfstand: `data/ap2-2026-11-01/PROGRESS.md`. Von den ursprünglich neun Findings sind FUNC-001 bis FUNC-003 behoben; sechs Findings bleiben offen. AP2 ist noch nicht committed.

**AP1-Bereitstellung nach Freigabe:** Isolierter Docker-/PostgreSQL-/HTTPS-Test erfolgreich. Bestehender lokaler Stack am 01.11.2026 mit beiden Compose-Dateien neu gebaut und gestartet; App und PostgreSQL gesund, Proxy aktiv. HTTPS `/health` liefert 200 mit vorhandener CA und aktiver Zertifikatsprüfung. Das ausgelieferte `app.js` entspricht dem geprüften Quellcode. Der Stack bleibt aktiv; Commit und Push wurden nicht ausgeführt.

Das Projekt besitzt für seinen Umfang eine solide Grundlage: klar abgegrenzte Fachmodule, serverseitige Rechteprüfung, versionierte Änderungen, atomare Transaktionen und einen ungewöhnlich umfangreichen PostgreSQL-/HTTPS-Integrationstest. Die Anwendungssicherung erfasst Tabellen dynamisch; die zusätzliche Betriebssicherung ist ausdrücklich dokumentiert. Die Gesamtsuite besteht mit **49/49 Tests ohne übersprungene Tests**, der isolierte Dockerintegrationstest ebenfalls.

Der größte bestätigte Fehler liegt im Zusammenspiel von automatischer Aktualisierung und Formularentwürfen: **Eine offene Liga-Aufstellung kann Änderungen einer anderen Spielleitung ohne Konflikt überschreiben.** Der Backend-Versionsschutz ist vorhanden, die Oberfläche ersetzt jedoch die Ausgangsversion durch eine neuere Version und behält die alten Eingaben bei.

Weitere relevante Fehler betreffen den uneinheitlichen Schutz vor gleichzeitiger Spielerbelegung, die Korrektur von 14/1-Ergebnissen über 99 Punkte, die Einheiten der Statistik und den Tastaturfokus. Die Backupprüfung weist semantische Lücken auf; diese wurden mit absichtlich veränderten und neu gechecksumten Sicherungen nachgewiesen. Ein Fehler normal erzeugter Sicherungen oder eine Authentifizierungsumgehung wurde dadurch nicht belegt.

**Priorisierung:** 9 Findings: 1 hoch, 5 mittel, 3 niedrig. Kein kritischer Befund bestätigt. Das bedeutet keine Garantie der Fehlerfreiheit oder eine vollständige Sicherheitszertifizierung.

| ID | Priorität | Verifikation | Thema |
|---|---|---|---|
| FUNC-001 | Hoch | Nach Freigabe durch AP1 behoben; Browser/Tests bestätigt | Parallele Ligaänderungen gehen verloren |
| FUNC-002 | Mittel | Durch AP2 behoben; API/PostgreSQL bestätigt | Manuelle Partie startet bereits belegte Spieler |
| FUNC-003 | Mittel | Durch AP2 behoben; Browser/Tests bestätigt | 14/1-Ergebniskorrektur durch Maximum 99 blockiert |
| FUNC-004 | Mittel | Durch AP4 behoben; Browser/Tests bestätigt | Statistik vermischt Punkte und Racks |
| TECH-001 | Mittel | Durch AP3 behoben; API/PostgreSQL bestätigt | Backupimport akzeptiert widersprüchliche Abrechnung und ungültigen PIN-Hash |
| UX-001 | Mittel | Durch AP5 behoben; Browser/Tests bestätigt | Polling entfernt Tastaturfokus |
| UX-002 | Niedrig | Durch AP5 umgesetzt; benannter Dialog im Browser bestätigt | Verwaltungsdialog ohne zugänglichen Namen |
| UX-003 | Niedrig | Durch AP5 behoben; Browser/Tests bestätigt | Singularformen bei Partien und Minuten |
| TECH-002 | Niedrig | Durch AP6 im Browser behoben; Budgetmessung bestätigt | Vollständiger Adminbestand bei jedem Polling |

## B. Prüfungsumfang und Verfahren

### Tatsächlicher Projektumfang

Geprüft wurden `AGENTS.md`, die offene Anforderung FR-008, aufgabenbezogene Abschnitte aus Entwicklungs-, Bedienungs-, Betriebs-, Backup-, Migrations- und Deploymentdokumentation sowie die zugehörigen Implementierungen und Tests. Drei parallel arbeitende Prüfagenten bearbeiteten Sicherheit, Fachlogik/Daten und statische UI. Befunde wurden zusammengeführt und durch konkrete Quellstellen beziehungsweise isolierte Reproduktionen abgeglichen.

**Stack und Architektur:** Node.js 24 mit eigenem HTTP-Server, ES-Module ohne Frontendframework, PostgreSQL 17 über `pg` 8.16.3, Caddy für HTTPS. Logisches Datenbankschema 13. Nachtrag 2026-11-01: Die SQLite-Komponente ist entfernt; Initialisierung, Betrieb und Funktionstests verwenden PostgreSQL. Frühere Auditmessungen beschreiben den damaligen Stand. Compose und GitHub Actions bauen und prüfen Images. Es gibt keine gesonderten TypeScript-, Lint- oder Frontendbuild-Skripte in `package.json`; deren Fehlen ist hier kein festgestellter Buildfehler.

**Datenmodell:** Veranstaltungen und Partien mit Spielständen, Status, Zeiten und PIN-Hashes; Spieler, Mannschaften, Kader und historische Zuordnungen; Liga-Spielslots einschließlich Doppel; nuLiga-Entitäten und Synchronisationsstände; Planungsmetadaten und Turnierfortschritt; Vermietungen, Preisvereinbarungen und Einstellungen; Vereinsgestaltung, Admin-Hash und Änderungsprotokoll. Turnierregeln und Auslosung werden in Planungsmetadaten gespeichert, Ergebnisse in regulären Partien.

**Schnittstellen und Rechte:** Adminbrowser verwenden eine Sitzung mit Cookie und CSRF-Token. Tablets erhalten nach Partie-PIN einen begrenzten Token für die zugeordnete Partie beziehungsweise den Tisch. Zustandsänderungen liegen hinter serverseitiger Autorisierung und Transaktionen. nuLiga ist eine externe Importquelle; Backups werden als JSON exportiert, geprüft und bestätigt wiederhergestellt. Ein Serverneustart beendet prozessinterne Sitzungen; dies ist dokumentiertes Verhalten.

### Rekonstruierte Nutzerabläufe und Abdeckung

| Ablauf | Geprüfte Verarbeitung und Nachweis |
|---|---|
| Anmeldung und Tabletfreigabe | Cookieattribute, CSRF/Origin, Admin-/Tischrechte, PIN-Limits, Sessionwiderruf; automatisierte Tests und Browserlogin |
| Spieler und Mannschaften | Anlage, Archivierung, Teilnehmerauswahl, Selbstbegegnungsschutz, historische Namens-/Mannschaftssnapshots; Tests, Code und Verwaltungsdialog im Browser |
| Ligaspieltag | Anlegen/starten, Teilnehmer, zehn Slots, Einzel/Doppel/14/1, Aufstellungen und Tischwünsche, Start; Tests und echte Paralleländerungsreproduktion |
| Partie am Tisch | Ausstoßen/erstes Break, Punkte und Korrekturen, Wechselbreak, Zielgrenzen, Abschluss, Tischfreigabe, konkurrierende Versionen; automatisierte HTTP-/Dockerprüfungen |
| Veranstaltung und Ergebnisse | Abschluss, bestätigte Korrektur/Löschung und Abhängigkeiten; Tests und 14/1-Korrektur im Browser |
| Turnier | Vorschau und Bestätigung, Gruppen/KO/Freilose, Gleichstände, Fortschritt und Korrektursperren; Tests und Fachmodulprüfung |
| Vermietung | Start, Rabatt/Stundenpreis, Minutenrundung, Abschlussbestätigung, Historie und Belegung; Tests sowie kompletter Start-/Abschlussablauf im Browser |
| Einstellungen und Backup | Vereinsname/Logo/Farben, Preise, Zugangsdaten-Hashes, vollständige Sicherung, Migration/Rollback und getrennte Wiederherstellung; PostgreSQLintegration und gezielte negative Importfälle |
| Browserbedienung | Navigation, Leerzustände, Dialoge, Formularvalidierung, Fokus, Statistikfilter; Desktop sowie Vermietungsstichproben bei 1024×768 und 390×844 |

### Ausgeführte Befehle und Ergebnisse

Alle nachstehenden Logpfade beziehen sich auf `data/audit-2026-11-01/`, sofern kein anderer Pfad genannt ist. Erwartete Ablehnungen beschädigter Backups erscheinen in erfolgreichen Testlogs als Validierungsfehler; sie sind negative Testfälle und wurden nicht ausgeblendet.

| Prüfung | Ergebnis | Protokoll |
|---|---|---|
| `git status --short`, `git branch --show-current`, Commit und FR-Liste | Ausgang sauber, `main`, FR-008 offen | Prüfliste/Toolausgabe |
| `node --version` | Host v24.22.1 | Prüfliste |
| `npm test` | Nicht ausführbar: npm fehlt im PATH; keine erfolgreiche Ausführung behauptet | Prüfliste |
| `node --test`, erster Sandboxlauf | Exit 1: 31 bestanden, 18 fehlgeschlagen, 0 übersprungen; lokale HTTP-Verbindungen mit EACCES blockiert | `node-test.log` |
| `node --test`, mit erlaubtem lokalem Netzwerkzugriff | **Exit 0: 49 bestanden, 0 fehlgeschlagen, 0 übersprungen**; entspricht dem hinterlegten npm-test-Skript | `node-test-unrestricted.log` |
| Gezielte Auth-/PIN-/Passwort-/Backuptests des Sicherheitsagenten | Exit 0: 7 bestanden, keine Fehler/Skips; initialer EACCES-Lauf separat erhalten | `security/auth-tests-verified.log`, `security/auth-tests.log` |
| `node scripts/docker-smoke.js` | **Exit 0: alle Smokechecks bestanden**, einschließlich Dockerbuild | `docker-smoke.log` |
| Ergebnisbericht Docker | `passed:true`; eigenes Testprojekt `bsvp-smoke-2cec0268d148` entfernt | `data/docker-test-RxZJfQ/result.json` |
| `node --check` für alle 40 JS-Dateien in src/public/scripts/tests | Exit 0 | `syntax.log` |
| `docker compose --env-file .env.example config --quiet` | Exit 0 | `compose-config.log` |
| `docker compose --env-file .env.example -f compose.yaml config --quiet` | Exit 0 | `compose-image-config.log` |
| `node data/audit-2026-11-01/domain/repro.mjs` mit erlaubtem Loopbackzugriff | Exit 0; Teilnehmerbelegung und Vermietungsimport reproduziert | `domain/repro-elevated.log`; initial EACCES in `domain/repro.log` |
| `node data/audit-2026-11-01/security/backup-pin-repro.mjs` | Exit 0; ungültiger PIN-Hash importiert, anschließender Tabletlogin 500 | `security/backup-pin-repro.log` |
| `node …/concurrency-client.mjs --change`, danach Browser-Speichern und CLI-Lesekontrolle | Je Exit 0; fremde Änderung nachweislich überschrieben | `concurrency-before.log`, `concurrency-after.log` |
| Direkte Abfrage des offiziellen npm-Bulk-Sicherheitsendpunkts mit den Lockfileversionen | Exit 0; 14 Paketnamen, **keine Advisories zurückgegeben** | `dependency-audit.log`, `dependency-audit-response.json` |
| `git diff --check` und lokale Prüfung der neuen Berichtsdatei | Exit 0; 30 lokale Links/Zeilenanker vorhanden, keine nachgestellten Leerzeichen | `diff-check.log`, `report-check.log` |

Der Dockerlauf prüft echte Zertifikatsvalidierung, HTTPS, abgesicherte Cookies, CSRF/Origin, Containerrechte und nicht veröffentlichte App-/Datenbankports; ferner PostgreSQLpersistenz nach Neustart und Containerersatz, DB-Reconnect, konkurrierende Buchungen, vollständige SQLiteübernahme, Wiederherstellung zwischen getrennten Datenbanken und Rollback bei ungültigem Import beziehungsweise Migration. Er verwendet eigene Secrets, Compose-Projekte und Volumes. Der dauerhaft laufende lokale Stack wurde nicht angefasst.

Die beiden zusätzlichen In-Memory-Browsertestserver wurden zum Abschluss gezielt beendet. Eine anfänglich versuchte Python-Hilfsprüfung des Berichts war in dieser Umgebung nicht ausführbar; die entsprechende Prüfung wurde erfolgreich mit Node durchgeführt. `git diff --no-index --check` gegen die neue Datei lieferte Exit 1 mit einem LF/CRLF-Hinweis; die separate Inhalts-/Whitespaceprüfung ergab keine Fehler.

### Abhängigkeiten und externe Angaben

Der aktuelle Abgleich erfolgte am 01.11.2026 direkt gegen den [offiziellen npm-Sicherheitsendpunkt](https://registry.npmjs.org/-/npm/v1/security/advisories/bulk). Zusätzlich zeigte die [Advisoryseite des pg-Projekts](https://github.com/brianc/node-postgres/security/advisories) keine veröffentlichten Advisories. Diese Ergebnisse bedeuten keine allgemeine CVE-Freiheit, insbesondere nicht für Betriebssystem- oder Containerpakete.

Die [offizielle Node.js-Releasepage für 24.22.2](https://nodejs.org/en/blog/release/v24.22.2) wurde geprüft. Der Host hat 24.22.1; aus diesem Versionsunterschied allein wird kein Produktfehler abgeleitet. Die tatsächlich laufenden Produktionsimages und ihre Systempakete wurden nicht inventarisiert. Die beweglichen Basistags `node:24-alpine`, `postgres:17-alpine` und `caddy:2-alpine` ersetzen keinen regelmäßigen Wartungs- und Imageprüfprozess. Eine konkrete Ausnutzbarkeit wurde nicht nachgewiesen.

### Grenzen und verbleibende Unsicherheit

- Browserprüfungen liefen gegen flüchtige In-Memory-Datenbanken über HTTP; PostgreSQL und HTTPS wurden separat automatisiert geprüft. Keine produktiven Daten wurden zur Prüfung kopiert.
- Keine vollständige Browserprüfung aller Turnierformate, Löschabläufe und Tabellenkonstellationen. Automatisierte Tests und Codeprüfung decken davon mehr ab als die Browserstichprobe.
- Keine physischen Tablets/Smartphones, kein realer Screenreader und keine vollständige Kontrastmessung sämtlicher konfigurierbarer Farbschemata. Bei 390 Pixeln wurde in der Vermietungsansicht kein horizontaler Seitenoverflow nachgewiesen; das ist keine allgemeine Gerätefreigabe.
- Kein produktiver nuLiga-Abgleich und keine Bestätigung aktueller externer Liga-/Verbandsregeln. Parser-, Import- und Planungsprüfungen stützen sich auf Implementierung und Testdaten. FR-008 ist ausdrücklich offen; sein Fehlen wird nicht als Regression gewertet.
- Kein Last-/Dauertest mit großem Archiv, keine Browser-Netzausfallsimulation und kein umfassendes Fuzzing. Aussagen zu Offlineverhalten und Skalierung bleiben entsprechend begrenzt.
- Navigations-Unit-Tests verwenden Fokus-/Intervallstubs (`tests/navigation.test.js:19–21,38`). Sie prüfen nicht die echte Browservalidierung oder Fokusführung über Pollzyklen. Die gefundenen Browserfehler können trotz bestandener Suite bestehen.
- Initiale Sandboxfehler waren Umgebungsbeschränkungen und wurden mit autorisierten isolierten Läufen aufgeklärt. Ein anfänglicher UI-Testdatenaufbau scheiterte an fehlender `event_version`; ausschließlich der temporäre Testaufbau wurde korrigiert.

Fortsetzungsfähiger Prüfstand: [AUDIT_PROGRESS.md](data/audit-2026-11-01/AUDIT_PROGRESS.md). Browserbeobachtungen: [BROWSER_CHECKS.md](data/audit-2026-11-01/BROWSER_CHECKS.md). Diese lokalen Nachweise sind Git-ignoriert und werden durch einen Commit des Berichts nicht automatisch mitgeliefert. Screenshots wurden im Chat angezeigt; es wurden keine Bilddateien archiviert.

## C. Priorisierte Findings

Aufwände sind **vorläufige Schätzungen** einschließlich gezielter Absicherung, keine Zusagen. Ein Personentag (PT) entspricht ungefähr einem Arbeitstag. Die konkrete Umsetzung bleibt freigabepflichtig.

### FUNC-001 – Offene Ligaformulare überschreiben parallele Änderungen

**Kategorie:** Fachfunktion/Zustandsverwaltung · **Status:** bestätigter Fehler, Browser und API · **Priorität:** hoch, weil Änderungen anderer Spielleitungen still verloren gehen.

**Ort (nach AP1 aktualisierte Verweise):** [Entwurfsverwaltung](public/app.js#L83), [Pollingrender](public/app.js#L202), [Liga-Submit](public/app.js#L236), [Slotformular](public/app.js#L319); [Versionsprüfung und Speicherung](src/league.js#L28).

**Reproduktion/Beleg:** Browser A öffnet Slot 1 mit Anna, Ziel 3, Version 1. Eine zweite Adminsitzung speichert Ada, Ziel 5: Serverversion 2 (`concurrency-before.log`). Nach normalem Polling zeigt A weiterhin Anna/Ziel 3, sein Formular hat aber bereits `data-version="2"`. A klickt „Aufstellung speichern“: erfolgreich. Die abschließende API-Lesekontrolle ergibt Anna/Ziel 3/Version 3 (`concurrency-after.log`). Selbst eine bewusste lokale Änderung in A ist dafür nicht erforderlich.

**Soll/Ist und Auswirkung:** Entweder muss A den neuen Serverstand sehen oder ein tatsächlich beibehaltener älterer Entwurf beim Speichern einen Konflikt melden. Tatsächlich legitimiert die neue Versionsnummer alte Eingaben. Spielerwahl und Spielziel können unbemerkt auf einen überholten Stand zurückfallen.

**Ursache:** `saveDrafts()` bewahrt alle Formularwerte, aber nicht die in `dataset` abgelegte Ausgangsversion. Das Rendern baut das Formular aus neuem Zustand, `restoreDrafts()` überschreibt dessen Werte mit dem alten Entwurf. Der Backendvergleich kann den dadurch formal aktuellen Schreibversuch nicht als veraltet erkennen.

**Vorschlag:** Entwürfe mit ihrer Ausgangsversion speichern und nur tatsächlich geänderte Formulare konservieren. Bei fremder Änderung einen sichtbaren Konflikt mit „Serverstand laden“ anbieten. Unbearbeitete Formulare sollen den Serverstand übernehmen. Eine umfassende neue Zustandsbibliothek ist dafür nicht zwingend erforderlich.

**Aufwand/Abhängigkeiten/Risiko:** 0,5–1,5 PT; gemeinsame Entwurfsverwaltung betrifft weitere Formulartypen. Mittleres Änderungsrisiko, vorhandene Draft- und Versionskonventionen beachten; sinnvoll vor dem Fokuspaket bearbeiten.

**Akzeptanz:** Zwei unabhängige Sitzungen ändern denselben Slot. Die zweite Speicherung darf die erste nie still überschreiben. Unbearbeitete Formulare zeigen fremde Änderungen; bearbeitete Entwürfe behalten ihre Ausgangsversion und melden einen Konflikt. Prüfung mindestens über zwei Pollzyklen und mit Navigation zurück zum Formular.

### FUNC-002 – Manuelle Starts umgehen den Teilnehmer-Belegungsschutz

**Kategorie:** Fachfunktion/Integrität · **Status:** bestätigter Fehler, isolierte API-Reproduktion · **Priorität:** mittel; widersprüchlicher Spielplan und doppelte Livezuordnung, kein belegter Verlust gespeicherter Ergebnisse.

**Ort (nach AP2):** [Gemeinsame Teilnehmerprüfung](src/participant-occupancy.js#L3), [Manueller und Turnierstart](src/server.js#L332), [Edit auf live](src/server.js#L318), [Liga-/Doppelstart](src/league.js#L48). Die folgende Reproduktion beschreibt den ursprünglichen, inzwischen behobenen Fehler.

**Reproduktion/Beleg:** Eine Turnierpartie mit verknüpften Stammdatenspielern läuft auf Tisch 1. Eine andere Turnierpartie mit überschneidender Person wird korrekt mit 409 abgewiesen. Eine manuell angelegte Ligapartie mit denselben Spieler-IDs lässt sich dagegen auf Tisch 2 mit 200 starten. Beide Partien sind anschließend live. Siehe `domain/repro-elevated.log`.

**Soll/Ist und Auswirkung:** Der bereits für Liga-/Turnierstarts implementierte Belegungsschutz soll über alle Startwege gelten. Tatsächlich schützt der manuelle Weg nur den Tisch. Dieselbe Person erscheint gleichzeitig an zwei Tischen; Planungs- und Bedienanzeigen widersprechen der realen Spielbarkeit. Freie, unverknüpfte Namen lassen sich ohne zusätzliche Produktentscheidung nicht zuverlässig als dieselbe Person erkennen.

**Ursache/Vorschlag:** Teilnehmerprüfung ist auf einzelne Fachpfade verteilt. Einen zentralen Guard für verknüpfte Teilnehmer einschließlich Doppelpartnern innerhalb der bestehenden Transaktion verwenden: manuelle Starts, Liga-/Turnierstarts, Reaktivierung auf `live` und Teilnehmeränderungen einer laufenden Partie.

**Aufwand/Abhängigkeiten/Risiko:** 0,5–1,5 PT; server-/fachmodulübergreifend. Historische Korrekturen abgeschlossener Partien dürfen nicht unnötig blockiert werden. Keine neue Namensgleichheitsregel ohne Produktentscheidung einführen.

**Akzeptanz:** Kreuztests manuell/Liga/Turnier/Doppel in beiden Startreihenfolgen; belegte IDs ergeben 409, freie Teilnehmer lassen sich starten. Gleichzeitige Starts derselben Person auf verschiedenen Tischen dürfen höchstens einen Erfolg liefern. Edit/Reaktivierung unterliegt demselben Schutz.

### FUNC-003 – Gültige 14/1-Ergebnisse über 99 Punkte sind nicht korrigierbar

**Kategorie:** Fachfunktion/Formularvalidierung · **Status:** bestätigter Fehler im Browser · **Priorität:** mittel; reguläre Ergebniskorrektur blockiert.

**Ort (nach AP2):** [Punktefelder des Bearbeitungsdialogs](public/app.js#L370), [Dynamische Grenzen](public/app.js#L342). Backend und Liga unterstützen 14/1-Ziele bis 999; bestehender Testfall mit Ziel 125: `tests/league.test.js:41`. Die folgende Reproduktion beschreibt den ursprünglichen, inzwischen behobenen Fehler.

**Reproduktion/Beleg:** Abgeschlossene 14/1-Partie 125:80 im Ergebnisarchiv öffnen. Punkte B auf 79 ändern und speichern. Der Browser bleibt im Dialog und meldet bei Punkte A: „Wert muss kleiner als oder gleich 99 sein.“ Read-only-DOM-Nachweis: Wert 125, Maximum 99, `rangeOverflow=true`.

**Soll/Ist und Auswirkung:** Ein gültiger Stand 125:79 oder eine reine Namenskorrektur muss speicherbar sein. Tatsächlich verhindert schon das unveränderte Feld 125 den Submit. Eine Änderung des Spielziels als Umgehung wäre fachlich falsch.

**Ursache/Vorschlag:** Festes `max="99"` für beide Punktefelder, unabhängig von Disziplin und Ziel. Grenzen aus dem zulässigen Spielziel ableiten und bei Ziel-/Disziplinänderung konsistent aktualisieren; serverseitige Prüfung beibehalten.

**Aufwand/Abhängigkeiten/Risiko:** 1–3 Stunden; unabhängig, geringes Risiko. Eine echte Browservalidierungsprüfung ergänzt die vorhandenen API-Tests sinnvoll.

**Akzeptanz:** 125:80 → 125:79 und reine Namenskorrektur sind möglich. Punkte oberhalb des aktuellen Spielziels, negative Punkte und zwei Gewinner am Ziel werden weiter abgewiesen. 8-/9-/10-Ball verhalten sich unverändert gemäß ihren Grenzen.

### FUNC-004 – Statistik zählt 14/1-Punkte als Racks und bietet keinen passenden Filter

**Kategorie:** Fachfunktion/Auswertung/Text · **Status:** bestätigter Fehler aus Berechnung und Markup; fehlender Filter zusätzlich im Browser bestätigt · **Priorität:** mittel; fachlich irreführende Kennzahl.

**Ort (nach AP4):** [Rackumrechnung und statistische Ergebnisanzeige](public/app.js#L157), [Aggregation](public/app.js#L633), [Filter und Beschriftung](public/app.js#L643). Die folgende Reproduktion beschreibt den ursprünglichen, inzwischen behobenen Fehler.

**Reproduktion/Beleg:** Statistik eines Spielers mit abgeschlossener 14/1- und 9-Ball-Partie öffnen. „Disziplin“ enthält nur Alle/8-/9-/10-Ball. Die Aggregation addiert `m.a`/`m.b` aller Disziplinen und beschriftet die Summe stets als „Racks“. Ein Stand von 125 Punkten plus 5 Racks ergibt rechnerisch die Anzeige „Racks 130“. Der gemischte Bestand wurde nicht zusätzlich im Browser angelegt; diese Summe folgt direkt aus dem geprüften Code.

**Soll/Ist und Auswirkung:** 14/1 muss gezielt filterbar sein. Nach der Produktfestlegung des Benutzers vom 01.11.2026 zählen bei 14/1 je volle zehn gelochte Kugeln als ein Rack. Die Umrechnung erfolgt je Partie und Spielerseite mit `Math.floor(punkte / 10)`: **114:69 Punkte ergeben 11:6 Racks**. Erst die umgerechneten Rackwerte werden über mehrere Partien summiert; Restpunkte verschiedener Partien werden nicht zusammengelegt. Tatsächlich summiert die aktuelle Implementierung die Kugelpunkte unverändert als Racks. Die festgestellte Ursache betrifft die Einheit; die Sieg-/Niederlagenzählung bleibt am tatsächlichen Punktestand der Partie orientiert, auch wenn die Umrechnung dieselbe Rackzahl für beide Seiten ergibt.

**Vorschlag:** 14/1 als Filter ergänzen und dessen Ergebnisse vor der Statistikaggregation in Racks umrechnen. Gemeinsame Rackstatistiken dürfen diese umgerechneten Werte mit den Racks aus 8-/9-/10-Ball summieren. Als Erklärung anzeigen: **„14/1: Je 10 gelochte Kugeln zählen als 1 Rack; Restpunkte werden je Partie abgerundet.“** Die erfassten Kugelpunkte bleiben die Grundlage für Spielziel, Punktekorrektur und die Entscheidung über den tatsächlichen Gewinner.

**Aufwand/Abhängigkeiten/Risiko:** ungefähr 0,5 PT; geringes Risiko, keine Datenmigration erforderlich. Dieselbe Aggregation bei Spieler- und Mannschaftsbezug berücksichtigen.

**Akzeptanz:** 14/1 ist auswählbar; 114:69 wird als 11:6 Racks gewertet, 125 Punkte plus 5 Racks ergeben 17 Racks. Zwei 14/1-Partien mit jeweils 19 Punkten ergeben insgesamt 2 Racks, nicht 3. Sieg/Niederlage richtet sich weiter nach dem tatsächlichen Partiegewinner. Zeitraum und Disziplinfilter wirken konsistent auf Kennzahlen und Partienliste. Gemischte Einzel-/Doppeltests erhalten die dokumentierte Zählweise.

### TECH-001 – Semantisch ungültige Sicherungen bestehen Vorschau und Wiederherstellung

**Kategorie:** Datenintegrität/Wiederherstellung · **Status:** bestätigter Fehler, zwei isolierte API-Reproduktionen · **Priorität:** mittel; inkonsistente Abrechnungsdaten können dauerhaft importiert werden. Der PIN-Teilfall allein wäre niedrig.

**Ort (nach AP3):** [Hashprüfung](src/backup.js#L85), [Admin-Hashprüfung](src/backup.js#L119), [Vermietungsprüfung im Import](src/backup.js#L127), [gemeinsamer Buchungsvalidator](src/rentals.js#L3), [gemeinsames Hashformat](src/config.js#L3). Die folgende Reproduktion beschreibt den ursprünglichen, inzwischen behobenen Fehler.

**Reproduktion/Beleg:** Einen gültigen Testexport verändern und die Datenprüfsumme korrekt neu berechnen:

1. Eine abgeschlossene Vermietung erhält `ended_at:null`, `duration_ms:-100`, `billed_minutes:-10`, `total_cents:-999999`. Vorschau und Restore liefern jeweils 200; die Werte sind anschließend gespeichert (`domain/repro-elevated.log`).
2. Eine laufende Partie erhält `pin_hash:'invalid'`. Vorschau und Restore liefern 200; der folgende PIN-Login endet mit 500 statt einer kontrollierten Antwort (`security/backup-pin-repro.log`).

**Soll/Ist und Auswirkung:** Eine Vorschau soll semantisch widersprüchliche Daten ablehnen; ein fehlgeschlagener Restore darf den Zielbestand nicht ändern. Tatsächlich werden negative Abrechnungen beziehungsweise ein unbrauchbarer PIN-Hash übernommen. Der Tabletzugang ist bis zur administrativen PIN-Neuvergabe gestört.

**Einordnung:** Das ist keine nachgewiesene Authumgehung. Normale aktuelle Exporte erzeugen gültige Hashes; einfache Dateikorruption erkennt die Prüfsumme. Die Reproduktionen betreffen extern erzeugte oder bewusst bearbeitete, neu gechecksumte Sicherungen. Eine Prüfsumme ersetzt erwartungsgemäß keine semantische Konsistenzprüfung.

**Ursache/Vorschlag:** Bestehende Prüfungen erfassen manche Preis-/Zeitgrenzen und den Admin-Hash, jedoch nicht alle Statusrelationen, Abrechnungsableitungen und PIN-Hashformate. Aktive/beendete Vermietungen mit gemeinsamem Fachvalidator prüfen, gespeicherte Ableitungen gegen `rentalPrice` abgleichen und bei Abweichung ablehnen. PIN-Hashes zentral validieren; dokumentiertes Legacy-`null` erhalten. Werte nicht unbemerkt beim Import neu berechnen.

**Aufwand/Abhängigkeiten/Risiko:** 1–1,5 PT für beide Teilfälle zusammen; gemeinsame Preis-/Hashvalidierung. Altbackups mit bereits inkonsistenten Daten benötigen eine nachvollziehbare Ablehnungs- oder Migrationsentscheidung. Keine stillschweigende Reparatur von Abrechnungen.

**Akzeptanz:** Jede einzelne ungültige Status-/Zeit-/Betrags-/Hashkombination wird bei Vorschau und Restore mit 400 abgewiesen. Zielbestand bleibt identisch. Gültige vollständige Backups einschließlich Hashes, Einstellungen und Legacyfällen bleiben zwischen getrennten PostgreSQLdatenbanken wiederherstellbar.

### UX-001 – Automatische Aktualisierung entfernt den Tastaturfokus

**Kategorie:** Bedienung/Barrierefreiheit · **Status:** bestätigter Fehler im Browser · **Priorität:** mittel; wiederkehrende Unterbrechung der Tastaturbedienung.

**Ort:** [Refresh](public/app.js#L202) und [Dreisekundenintervall](public/app.js#L777). Die [Seitennavigation](public/app.js#L55) zeigt bereits eine gezielte Fokusbehandlung.

**Reproduktion/Beleg:** In der Spieleransicht „Spieler anlegen“ fokussieren. Vor dem Polling ist `document.activeElement` die Schaltfläche; nach einem normalen Pollzyklus ist es `BODY`. Es gab keine andere Fokusaktion dazwischen.

**Soll/Ist und Auswirkung:** Die gewählte Aktion muss über Hintergrundaktualisierungen hinweg bedienbar bleiben. Tatsächlich wird ihr DOM-Knoten entfernt. Enter kann die zuvor gewählte Aktion nicht mehr auslösen; Tab setzt an einer anderen Stelle fort. Dies erschwert insbesondere langsamere Tastaturbedienung.

**Ursache/Vorschlag:** Vollständiger Neuaufbau des Inhalts auch bei fokussiertem Button ohne Fokuswiederherstellung. Fokus mit stabiler Identität erhalten oder gezielt nur veränderte Inhalte aktualisieren. Bei verschwundenem Eintrag ein nachvollziehbares Ersatzziel wählen; Dialogrückkehr einbeziehen.

**Aufwand/Abhängigkeiten/Risiko:** 0,5–1 PT; mit FUNC-001 koordinieren, damit Entwurfs- und Fokusänderungen im selben Refreshpfad zusammenpassen. Mittleres Risiko durch unterschiedliche Ansichten.

**Akzeptanz:** Schaltflächenfokus bleibt über mindestens zwei Pollzyklen erhalten; Enter löst genau diese Aktion aus. Nach Dialogabbruch kehrt der Fokus zum Auslöser zurück. Prüfung mit echter Tastatur-/Browserinteraktion, nicht nur Fokusstub.

### UX-002 – Dynamischer Verwaltungsdialog braucht einen zugänglichen Namen

**Kategorie:** Barrierefreiheit · **Status:** Verbesserungsvorschlag; fehlende Benennung im DOM und AX bestätigt · **Priorität:** niedrig; sichtbare Überschrift vorhanden, aber programmatische Zuordnung fehlt.

**Ort:** [Registrydialog](public/app.js#L647).

**Beleg/Soll-Ist:** „Spieler anlegen“ öffnet einen Dialog mit sichtbarer Überschrift „Spieler verwalten“. Der Dialog besitzt weder `aria-label` noch `aria-labelledby`; im Accessibility Tree erscheint nur der unbenannte Container. Andere statische Dialoge verweisen bereits auf ihre Titel. Ein realer Screenreader wurde nicht eingesetzt; sein konkreter Ansagetext wird daher nicht behauptet.

**Nutzen/Ursache/Vorschlag:** Nutzer assistiver Technik sollen beim Öffnen den Zweck erkennen. Die Überschrift mit stabiler ID versehen und den Dialog über `aria-labelledby` darauf verweisen; Gleiches für Teilnehmer-/Mannschaftsvarianten prüfen.

**Aufwand/Abhängigkeiten/Risiko:** unter einer Stunde; mit UX-001 bündeln, geringes Risiko.

**Akzeptanz:** Der Accessibility Tree weist den Dialognamen entsprechend seiner sichtbaren Überschrift aus; bestehende Fokus- und Schließfunktionen bleiben erhalten.

### UX-003 – Mengenangaben verwenden falsche Singularformen

**Kategorie:** Textqualität · **Status:** bestätigter Textfehler im Browser · **Priorität:** niedrig; Verständlichkeit bleibt gegeben, sprachliche Qualität leidet.

**Ort:** [Partienzähler](public/app.js#L155), [Veranstaltungskarte](public/app.js#L331), [Historie](public/app.js#L514), [Abschlussdialog](public/app.js#L553).

**Reproduktion/Beleg:** Ein Ergebnis im Archiv zeigt „1 Partien“. Eine kurze Vermietung zeigt in Bestätigung und Historie „1 Minuten“.

**Soll/Ist, Ursache und Vorschlag:** Zahlenabhängige Singular-/Pluralform statt fest angehängtem Plural. Konkrete Ersatztexte: **„1 Partie“**, **„1 Minute“**, bei anderen Werten „0 Partien“, „2 Partien“, „2 Minuten“. Wiederkehrende Zähler über eine kleine gemeinsame Formatierung konsistent halten.

**Aufwand/Abhängigkeiten/Risiko:** 1–2 Stunden; unabhängig, geringes Risiko, keine Datenänderung.

**Akzeptanz:** Betroffene Zähler zeigen bei 0/1/2 die korrekte Form; Bestätigung und Historie stimmen sprachlich überein.

### TECH-002 – Clientpagination begrenzt den Pollingumfang nicht

**Kategorie:** Performance/Wartbarkeit · **Status:** Durch freigegebenen AP6-Umbau im Browser behoben; kein nachgewiesener ursprünglicher Produktionsengpass · **Priorität:** niedrig, solange Archivgröße und Nutzerzahl klein bleiben.

**Ort:** [Adminantwort](src/server.js#L193), [Eventzustand](src/server.js#L63), [Stammdatenzustand](src/players.js#L19), [Clientpagination](public/app.js#L44), [Polling](public/app.js#L777).

**Ursprünglicher Beleg/Soll-Ist und Auswirkung:** Jede Adminaktualisierung lädt den gesamten Partienbestand sowie weitere Stammdaten-/Planungslisten. `eventState()` liest Partien erneut und berechnet Turniertabellen. Die Auswahl „20 Einträge“ begrenzt nur die nachträgliche Browserdarstellung. Die AP6-Messung mit 100/1.000/10.000 archivierten Ligapartien und 1/5/10 Clients belegt konstant 16 SQL-Abfragen und zwei vollständige Partienlesevorgänge pro Antwort. Bei 10.000 Partien sind es rund 6,24 MiB JSON; zehn Clients ergeben rechnerisch etwa 1.247 MiB/Minute. p95 lag im größten Szenario bei rund 962 ms über HTTP-Loopback. Dies ist keine WLAN-/Tablet-/Turnierlastfreigabe und belegt keinen aktuellen Produktionsengpass. Details: [Performance.md](Doku/Performance.md).

**Umsetzung/Nutzen:** Nach ausdrücklicher Freigabe wurden Livezustand und historische Listen getrennt. Serverpagination und vollständige Statistikaggregate begrenzen die angezeigten Archivseiten; ausgewählte Spieltagsdetails und Korrekturzuordnungen werden gezielt geladen. Der alte vollständige Endpunkt verwendet Matchdaten wieder und bleibt für Integrationen kompatibel. Der Browser nutzt ihn nicht mehr. Die neue Liveantwort hält das bestätigte Budget von 256 KiB und 500 ms p95 bei zehn Clients/10.000 Archivpartien im isolierten Test ein. Keine Laufzeitgrenze, kein Cache und keine persistierte Revision wurden eingeführt.

**Aufwand/Abhängigkeiten/Risiko:** 0,5–1 PT Messung, bei belegtem Bedarf weitere 2–4 PT Umsetzung. Größeres Risiko wegen Statistik, Pagination und Aktualisierung; erst nach Korrektur des bestehenden Draft-/Fokusverhaltens priorisieren.

**Ursprüngliche Akzeptanz des Messauftrags (durch anschließende Umsetzung ergänzt):** AP6-Messauftrag erfüllt: Datengröße, Clientzahl, Methodik, Rohdaten und Grenzen sind dokumentiert, der Lauf ist reproduzierbar und isoliert. Ein späterer Umbau benötigt eine eigene Entscheidung einschließlich Zielbudget; dann müssen historische Seiten nur den angeforderten Ausschnitt übertragen, Statistiken vollständig und Navigation korrekt bleiben. Der Umbau wurde anschließend ausdrücklich freigegeben und mit den im aktuellen Nachtrag genannten Nachweisen umgesetzt.

## D. Empfohlene Umsetzung und Freigabeauswahl

**AP1 bis AP5 sind nach ausdrücklicher Freigabe umgesetzt; AP6 ist als vereinbarter Messauftrag abgeschlossen.** Ein API-/Pollingumbau bleibt eine separate Entscheidung.

| Paket | Enthaltene IDs | Umfang und Reihenfolge | Vorläufiger Aufwand |
|---|---|---|---|
| **AP1 – Parallele Spielleitung absichern (umgesetzt)** | FUNC-001 | Ausgangsversion und bearbeitete Entwürfe erhalten, Konflikte sichtbar machen; nach Freigabe behoben | ursprüngliche Schätzung 0,5–1,5 PT |
| **AP2 – Fachliche Start-/Korrekturfehler beheben (umgesetzt)** | FUNC-002, FUNC-003 | Gemeinsamer Teilnehmer-Belegungsschutz und dynamische 14/1-Formulargrenzen nach Freigabe behoben | ursprüngliche Schätzung ca. 0,75–2 PT |
| **AP3 – Backupprüfung vervollständigen (umgesetzt)** | TECH-001 | Gemeinsame Abrechnungs-/Hashvalidierung; atomare Ablehnung und vollständige Wiederherstellung mit getrennten PG-Datenbanken geprüft | ursprüngliche Schätzung 1–1,5 PT |
| **AP4 – Statistik fachlich berichtigen (umgesetzt)** | FUNC-004 | Disziplinfilter und Rackumrechnung je Partie/Seite (114:69 → 11:6), Originalpunkte und tatsächliche Sieger bleiben erhalten | ursprüngliche Schätzung ca. 0,5 PT |
| **AP5 – Tastaturbedienung und Texte verbessern (umgesetzt)** | UX-001, UX-002, UX-003 | Fokus, Dialognamen und Singularformen korrigiert, echte Tastatur-/Browserprüfung erfolgreich | ursprüngliche Schätzung ca. 0,75–1,5 PT |
| **AP6 – Archivwachstum messen und Polling umbauen (umgesetzt)** | TECH-002 | Basis-/Nachmessung, getrennte Live-/Archivabfragen und vollständige Statistik; vereinbartes Budget im Test erfüllt | ursprüngliche Schätzung 0,5–1 PT Messung |

Für spätere JS-Änderungen gelten die Checkoutvorgaben: zunächst passende Tests, dann einmal Gesamtsuite; bei Auth-/Backup-/DB-Eingriffen zusätzlich isolierter Dockerintegrationstest. Die gefundenen Formular- und Fokusfehler benötigen echte Browsernachweise. Nach einer freigegebenen Implementierung ist das lokale Deployment gemäß Checkoutregeln erneut zu betrachten; der vorliegende Analyseauftrag autorisiert kein Deployment.

**Aktueller Abschluss:** AP1 bis AP6 einschließlich nachträglich freigegebenem API-/Pollingumbau sind umgesetzt. Alle neun Findings sind bearbeitet. Reale Geräte-/WLAN-/Langzeitlast bleibt außerhalb der durchgeführten Messreihe; [Messbericht](Doku/Performance.md).
