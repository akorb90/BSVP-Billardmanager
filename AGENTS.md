# Arbeitsweise für diesen Checkout

- Weitere Arbeit erfolgt ausschließlich auf `main`; keine neuen Arbeitsbranches anlegen.
- Vor jedem Commit die Änderungen dem Benutzer beschreiben.
- Nach Änderungen relevante Prüfungen ausführen und die neue Variante mit `docker compose up -d --build --wait` in den bestehenden lokalen Stack deployen.
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
