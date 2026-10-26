# Arbeitsweise für diesen Checkout

- Vor jedem Commit die Änderungen dem Benutzer beschreiben.
- Nach Änderungen relevante Prüfungen ausführen und die neue Variante mit `docker compose up -d --build --wait` in den bestehenden lokalen Stack deployen.
- Den Stack danach aktiv lassen: Der Benutzer möchte Änderungen unmittelbar live prüfen.
- Bestehende `.env`, Secrets und Datenvolumes erhalten. Keine neuen Zugangsdaten erzeugen, wenn die Sicherheitskonfiguration schon vorhanden ist.
- Produktivdaten niemals durch Testdaten ersetzen. Integrationstests verwenden separate Compose-Projekte und Volumes.
- Kein `docker compose down -v` gegen den dauerhaft laufenden Stack. Nur explizit erzeugte, isolierte Testprojekte dürfen ihre Testvolumes entfernen.
- Nach Deployment HTTPS-Erreichbarkeit und Containerzustand prüfen. Einschränkungen oder fehlgeschlagene Deployments klar berichten.
