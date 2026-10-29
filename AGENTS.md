# Arbeitsweise für diesen Checkout

## Kontext und Ausgabe begrenzen

- Zuerst `git status --short`, aktuellen Branch und die angefragte FR in `Doku/FEATURE_REQUESTS.md` prüfen. Vorhandene fremde Änderungen erhalten.
- Mit `rg -n` nach betroffenen Symbolen suchen und nur passende Dateiausschnitte lesen. Keine vollständigen Quellcode-, Dokumentations- oder Logsammlungen laden; bereits gelesene unveränderte Inhalte nicht erneut lesen.
- Einstiegspunkte: `src/server.js` (HTTP/Auth), `src/domain.js` (Spielablauf), gleichnamige Fachmodule in `src/`, `public/app.js` (UI), `public/style.css`, `src/database.js` (PostgreSQL), `src/legacy-db.js` (SQLite/Migration), `src/backup.js` (Export/Import). Passende Tests liegen unter `tests/`; PostgreSQL-/HTTPS-Gesamttest: `scripts/docker-smoke.js`.
- Anforderungen: `Doku/FEATURE_REQUESTS.md`; Architektur/Testablauf: `Doku/Entwicklung.md`; Betrieb/Backup: `Doku/Betrieb.md`, `Doku/Datensicherung.md`; Veröffentlichung: `Doku/Deployment.md`. Nur aufgabenrelevante Abschnitte lesen. Implementierung und Tests bei veralteten Architekturangaben gegenprüfen.
- Test- und Buildausgaben vollständig in einem eigenen Unterordner von `data/` protokollieren (Git ignoriert ihn). Zunächst nur Exitcode, Testzusammenfassung und Logpfad ausgeben; bei Fehlern gezielt Fehlerstelle samt Kontext lesen. Keine Fehler oder übersprungenen Tests verschweigen. Exitcode unmittelbar nach dem Prozess sichern; Weiterleitungen dürfen einen Fehler nicht als Erfolg ausweisen. Secrets nicht ausgeben.
- Für JavaScript-Änderungen zunächst betroffene Tests (`node --test tests/<name>.test.js`), anschließend einmal die Gesamtsuite (`npm test`) ausführen. PostgreSQL, Schema, Sicherung/Wiederherstellung, Authentifizierung oder Deployment erfordern zusätzlich `npm run test:docker` im isolierten Testprojekt. Reine Dokumentationsänderungen auf Inhalt, Verweise und `git diff --check` prüfen. Weitere Prüfungen nach Risiko ergänzen; erfolgreiche unveränderte Prüfungen nur bei neuem Anlass wiederholen.
- Kurze Fortschrittsmeldungen mit neuen Erkenntnissen; Abschluss mit Änderung, Prüfstand, Deploymentzustand und verbleibenden Einschränkungen. Keine vollständigen Logs oder wiederholten Pläne in die Antwort übernehmen.
- Erledigte FR mit Datum und tatsächlichem Prüfstand nach `Doku/CHANGELOG.md` übertragen und aus der offenen Liste entfernen. Weiterführende Optionen gehören in die Fachdokumentation, nicht dauerhaft in diese Datei.

## Änderungen und Bereitstellung

- Commit und Push bleiben standardmäßig beim Entwickler; nur auf ausdrücklichen Auftrag ausführen. Das lokale Deployment bleibt Aufgabe des Agenten gemäß den folgenden Regeln.
-  Arbeit erfolgt  auf `main` branch; wenn die Anlage eines neuen Branches sinnvoll erscheint, beim User nachfragen und Entscheidungsgrundlage liefern
- Vor jedem Commit die Änderungen dem Benutzer beschreiben.
- Nach Änderungen relevante Prüfungen ausführen und die neue Variante mit `docker compose up -d --build --wait` in den bestehenden lokalen Stack deployen.
- Falls `.env` mit `COMPOSE_FILE=compose.yaml` den lokalen Build ausschließt, `docker compose -f compose.yaml -f compose.override.yaml up -d --build --wait` verwenden; bestehende Projektzuordnung erhalten. `.env` dafür nicht ändern.
- Den Stack danach aktiv lassen: Der Benutzer möchte Änderungen unmittelbar live prüfen.
- Bestehende `.env`, Secrets und Datenvolumes erhalten. Keine neuen Zugangsdaten erzeugen, wenn die Sicherheitskonfiguration schon vorhanden ist.
- Produktivdaten niemals durch Testdaten ersetzen. Integrationstests verwenden separate Compose-Projekte und Volumes.
- Kein `docker compose down -v` gegen den dauerhaft laufenden Stack. Nur explizit erzeugte, isolierte Testprojekte dürfen ihre Testvolumes entfernen.
- Nach Deployment HTTPS-Erreichbarkeit und Containerzustand prüfen. Einschränkungen oder fehlgeschlagene Deployments klar berichten.

## Vollständigkeit von Datensicherungen

- Alle dauerhaft gespeicherten Anwendungsdaten und sämtliche Anwendungseinstellungen müssen immer im Backup enthalten sein, einschließlich Vereinsname, Logo, Farbschema, Preise, Zugangsdaten-Hashes und Änderungsprotokoll.
- Bei jeder neuen oder geänderten Datenart bzw. Einstellung Export, Prüfung, Wiederherstellung und nötige Migrationen mit berücksichtigen. Keine Einstellung darf nur lokal gespeichert werden und dadurch bei einer Wiederherstellung verloren gehen.
- Die vollständige Übernahme durch Export und Wiederherstellung mit getrennten Testdaten prüfen. Neue Datenbanktabellen müssen automatisch in die Sicherung aufgenommen werden; Sicherungen dürfen keine Daten stillschweigend auslassen.
- Installationsdateien, externe Sicherheitskonfiguration und HTTPS-Schlüssel sind zusätzlich nach der dokumentierten Betriebsanleitung zu sichern. Diese separate Betriebssicherung muss ausdrücklich dokumentiert bleiben und ersetzt nicht das vollständige Backup der Anwendungsdaten und -einstellungen.
