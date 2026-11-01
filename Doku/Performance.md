# Admin-Polling: Messung und Umsetzung

Stand: 01.11.2026, Audit AP6 / TECH-002. Nach der Ausgangsmessung hat der Benutzer auch den API-/Pollingumbau und das Zielbudget ausdrücklich freigegeben. Messung und Implementierung sind abgeschlossen.

## Ausgangsmessung vor dem Umbau

Die sichtbare Seitengröße begrenzt den Umfang von `/api/admin` nicht. Bei 10.000 archivierten Partien werden rund **6,24 MiB pro Antwort** übertragen. Zehn Clients mit einem Drei-Sekunden-Intervall entsprechen rechnerisch rund **1.247 MiB JSON pro Minute**. Jede Antwort benötigt im untersuchten Datenmodell **16 SQL-Abfragen**, darunter **zwei vollständige Lesevorgänge des Partienbestands**.

Die gemessene p95-Antwortzeit lag selbst beim größten Szenario unter dem Pollingintervall von drei Sekunden. Daraus folgt keine Freigabe für reales WLAN oder Tablets: Gemessen wurde HTTP innerhalb eines Containers, ohne Browserdarstellung, TLS und WLAN. Der belegte Verbesserungsbedarf liegt vor allem im mitwachsenden Datenumfang und der wiederholten Verarbeitung des gesamten Archivs.

## Aufbau und Grenzen

- Zufälliges, isoliertes Compose-Projekt mit eigener PostgreSQL-Datenbank. Keine Produktivdaten oder Änderungen am dauerhaft laufenden Stack. Datenbank, Testcontainer und Testvolumes nach dem Lauf entfernt.
- Node.js v24.22.1, PostgreSQL 17, vorhandene Compose-Konfiguration ohne besondere CPU-/Speicherlimits. Ausführung auf diesem lokalen Docker-Desktop-System; konkurrierende Hostlast ist nicht kontrolliert.
- Drei synthetische Archive: 100, 1.000 und 10.000 abgeschlossene 9-Ball-Partien, jeweils 20 Partien pro abgeschlossenem Ligaevent; 100 Spieler, zehn Stammmannschaften, zwei Mannschaften je Event, zugehörige Teilnehmer und zehn Ligaplätze je Event. Keine Turniermetadaten, laufenden Spiele oder großen Import-/Auditbestände.
- Je Archivgröße 1, 5 und 10 gleichzeitig anfragende Clients. Ein Aufwärmzyklus, danach drei Messzyklen im Abstand von drei Sekunden. Der nächste Zyklus beginnt erst nach Abschluss aller Antworten des vorherigen Zyklus; kein künstlich unbegrenzter Rückstau.
- Authentifizierte Anfragen an den echten `createApp`-Server mit PostgreSQL. Messclient in einem separaten Worker-Thread desselben Containers. Zeit vom Requestbeginn bis zum vollständig eingelesenen Antwortkörper; keine JSON-Auswertung oder DOM-Renderzeit im Client.
- Abfragezähler nur im Messprozess instrumentiert. Er erfasst die während der Messzyklen ausgeführten PostgreSQL-Clientabfragen; die produktive Anwendung erhält keine Instrumentierung.
- Bei einem Client gibt es drei, bei fünf Clients 15 und bei zehn Clients 30 Zeitproben. p95 bei drei Proben entspricht dem Maximum. Dies ist eine reproduzierbare Diagnosemessung, keine statistisch belastbare SLA- oder Dauertestfreigabe.
- Übertragungsvolumen ist die unkomprimierte JSON-Nutzlast ohne HTTP-/TLS-Overhead. MiB/Minute ist eine Hochrechnung aus Antwortgröße, Clientzahl und 20 Polls pro Minute, keine gemessene WLAN-Übertragungsrate.
- Heapwerte in den Rohdaten sind Momentaufnahmen nach einem Szenario, keine Spitzenwerte oder Leakprüfung. Der höchste dokumentierte Snapshot lag bei etwa 114 MiB; Garbage Collection und Client-/Serveraktivität beeinflussen ihn.

Die Messung erfolgte vor der abschließenden, rein clientseitigen H1-Fokuskorrektur; der gemessene HTTP-/Datenbankpfad blieb unverändert. Rohdaten mit Image-ID und SHA-256 des tatsächlich untersuchten Quellcodes: [admin-polling-2026-11-01.json](Messdaten/admin-polling-2026-11-01.json). Vollständige Laufprotokolle lokal unter `data/ap5-ap6-2026-11-01/`; ursprünglicher Dockerbericht unter `data/docker-test-0UVizY/`.

## Messwerte

Alle Szenarien: 16 SQL-Abfragen und zwei vollständige Partienlesevorgänge je Antwort.

| Partien | Events | Clients | MiB/Antwort | Median ms | p95 ms | Maximum ms | JSON MiB/Minute |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 5 | 1 | 0,080 | 8,3 | 8,9 | 8,9 | 1,6 |
| 100 | 5 | 5 | 0,080 | 17,2 | 22,6 | 22,6 | 8,0 |
| 100 | 5 | 10 | 0,080 | 26,4 | 33,7 | 34,7 | 16,0 |
| 1.000 | 50 | 1 | 0,636 | 15,9 | 16,2 | 16,2 | 12,7 |
| 1.000 | 50 | 5 | 0,636 | 45,7 | 66,2 | 66,2 | 63,6 |
| 1.000 | 50 | 10 | 0,636 | 86,8 | 130,5 | 137,1 | 127,2 |
| 10.000 | 500 | 1 | 6,237 | 107,6 | 107,8 | 107,8 | 124,7 |
| 10.000 | 500 | 5 | 6,237 | 381,1 | 512,1 | 512,1 | 623,7 |
| 10.000 | 500 | 10 | 6,237 | 735,2 | 961,9 | 964,8 | 1.247,4 |

## Reproduktion

Im Checkout mit Docker ausführen. Das vorhandene Smokeverfahren erzeugt ein eigenes Projekt und führt zunächst die Integrationsprüfungen aus. Der optionale Messschritt erstellt darin eine weitere ausschließlich temporäre Datenbank. Ohne `ADMIN_BENCHMARK=1` läuft der normale Test unverändert weiter.

```powershell
$ap6Run = Join-Path 'data' ('admin-benchmark-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $ap6Run | Out-Null
$ap6Previous = $env:ADMIN_BENCHMARK
try {
    $env:ADMIN_BENCHMARK = '1'
    node scripts/docker-smoke.js *> (Join-Path $ap6Run 'run.log')
    $ap6Exit = $LASTEXITCODE
    Write-Output "Exitcode: $ap6Exit; Log: $ap6Run/run.log"
    if ($ap6Exit -ne 0) { throw 'Docker-/Messlauf fehlgeschlagen; Fehlerstelle im Log prüfen.' }
} finally {
    $env:ADMIN_BENCHMARK = $ap6Previous
}
```

Der vom Lauf ausgegebene Ordner `data/docker-test-…/` enthält `admin-benchmark.json` und `result.json`. Der Messschritt wird als Quelltext an den Testcontainer übergeben; er muss nicht im ausgelieferten Anwendungsimage installiert sein. Der Messworker startet ohne geerbte `--input-type`-Optionen. Der erste Entwicklungslauf scheiterte an dieser Vererbung; nach Korrektur bestand der vollständige Messlauf. Beide Logs bleiben erhalten.

## Umgesetzter API-/Pollingumbau

- Der Browser fragt alle drei Sekunden den getrennten, authentifizierten Endpunkt `GET /api/admin/live` ab: laufende Partien mit Eventnamen, Versionen ihrer Veranstaltungen, aktive Vermietungen und Tisch-/Preisparameter. Historische Partien, Teilnehmerlisten und Turniermetadaten sind nicht Bestandteil der Liveantwort.
- `GET /api/admin/view?view=…` lädt nur die benötigte Ansicht. Ergebnisarchiv, Spieltagslisten, globale Partienlisten, Vermietungshistorie und zugeordnete Statistikpartien werden in SQL gezählt und mit LIMIT/OFFSET auf 10/20/50/100 Einträge begrenzt. Seiten werden nach Löschungen auf die letzte gültige Seite geklemmt. Der Browser verwendet die Gesamtzahlen des Servers.
- Gewählte Spieltage laden ihre eigenen vollständigen Aufstellungen/Partien und gegebenenfalls Turniertabellen. Nur diese Detailansicht berechnet Turnierstände; Archive anderer Spieltage werden dafür nicht gelesen. Korrekturdialoge laden benötigte historische Zuordnungen und offene Zielveranstaltungen gezielt nach.
- Spieler-/Mannschaftsstatistiken werden serverseitig über sämtliche gefilterten historischen Spielerseiten aggregiert. Paginierung begrenzt nur die angezeigte Partienliste. Doppelpartner, archivierte Identitäten, Datums-/Disziplinfilter und 14/1-Abrundung je Partie bleiben berücksichtigt.
- Überholte Antworten und Fehler dürfen neuere Navigation nicht ersetzen. Fokus-/Dialogschutz aus AP5 bleibt aktiv. Historische Ansichten aktualisieren ihre begrenzte Seite ebenfalls im bisherigen Drei-Sekunden-Takt; keine neuen Caches oder persistierten Revisionen.
- Der bisherige vollständige Endpunkt `GET /api/admin` bleibt für bestehende Integrationen kompatibel, verwendet den Partienbestand jedoch nur noch einmal pro Request. Der Browser ruft ihn nicht mehr auf. Eine bewusste Integrationsabfrage dieses Endpunkts bleibt umfangreich.
- Keine neue dauerhafte Datenart, Einstellung oder Schemaänderung. Export/Restore umfasst weiterhin den vollständigen Datenbestand; die neuen Lesefilter verändern Sicherungen nicht.

## Nachmessung und akzeptiertes Budget

Der Benutzer hat höchstens **256 KiB pro Liveantwort** und **p95 höchstens 500 ms bei zehn Clients und 10.000 Archivpartien** als Ziel bestätigt. Diese Prüfgrenzen bestehen in der Nachmessung. Sie sind keine Begrenzung historischer Daten und keine Laufzeitabschaltung.

Die Nachmessung verwendet dieselben drei Archivgrößen und Clientzahlen, zusätzlich acht gleichzeitig laufende Partien. Die übrige Methodik und die oben beschriebenen Grenzen bleiben gleich. Vor jeder Messreihe prüft der echte PostgreSQL-Server außerdem Archivseiten, Gesamtzahlen, vollständige Statistik und Spieltagsdetails.

| Archivpartien | Clients | Liveantwort (Bytes) | Median (ms) | p95 (ms) |
|---:|---:|---:|---:|---:|
| 100 | 1 | 4012 | 3.8 | 4.7 |
| 100 | 5 | 4012 | 4.8 | 5.8 |
| 100 | 10 | 4012 | 8.0 | 9.4 |
| 1000 | 1 | 4029 | 2.8 | 3.8 |
| 1000 | 5 | 4029 | 4.8 | 6.1 |
| 1000 | 10 | 4029 | 6.4 | 7.4 |
| 10000 | 1 | 4046 | 3.0 | 3.8 |
| 10000 | 5 | 4046 | 4.2 | 4.8 |
| 10000 | 10 | 4046 | 5.7 | 6.9 |

Bei 10.000 Archivpartien beträgt die Liveantwort **4.046 Bytes (3,95 KiB)**; mit zehn Clients p95 **6,95 ms**, rechnerisch **0,77 MiB/Minute**. Pro Liveantwort fallen fünf SQL-Abfragen an, darunter zwei auf laufende Partien beschränkte Leseabfragen (Livepartien und EXISTS für deren Events). Kein vollständiger Partienbestand wird für den Livepoll gelesen. Die Ausgangsmessung übertrug rund 6,24 MiB je Antwort bei p95 rund 962 ms. Die Nachmessung enthält zusätzlich acht Livepartien und ist daher kein bitgenau identischer Datensatz.

[Optimierte Rohdaten mit Quellhashes und Image-ID](Messdaten/admin-polling-optimized-2026-11-01.json), vollständiger Docker-/Messlauf: `data/ap6-implementation-2026-11-01/docker-benchmark.log`, isolierter Bericht: `data/docker-test-1TlI1b/`. Die oben gezeigte Reproduktion führt mit dem aktuellen Skript die optimierte Messung aus; die ursprünglichen Messwerte bleiben als historische Basis separat erhalten. Nach der Messung ergänzte Clientkorrekturen am Gesamtzähler und Schutz vor überholten Antworten ändern den gemessenen HTTP-/Datenbankpfad nicht.

36 gezielte Tests und 116 Tests der Gesamtsuite ohne übersprungene Tests bestätigen die Umsetzung. Browserprüfung mit getrennten synthetischen Daten bestätigt Archivseiten, vollständige 14/1-Statistik auf Folgeseiten, Live-/Archivkorrekturdialoge mit erhaltenen Identitäten und Spieltagsdetails. Der isolierte Docker-/PostgreSQL-/HTTPS-Test einschließlich vollständiger Sicherungs-/Wiederherstellungsprüfung besteht.

Das Budget ist für diese kurze lokale Container-Messreihe erfüllt. Langzeitbetrieb, Turnierlast, reale Geräte, TLS-/WLAN-Latenz und Browserrenderzeit wurden damit nicht als Lasttest freigegeben; diese Grenzen bleiben bestehen.
