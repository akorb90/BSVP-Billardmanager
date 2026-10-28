# Datensicherung und Wiederherstellung

### Export und Import in der Anwendung (FR-005)

Unter **Einstellungen → Datensicherung → Sicherung herunterladen** erstellt die angemeldete Spielleitung eine konsistente JSON-Sicherung im laufenden Betrieb. Sie enthält sämtliche Anwendungsdaten und Einstellungen einschließlich Vereinsname, Logo und sämtlicher Farben: Veranstaltungen, Partien samt Spielständen, Tischzuweisung und Zeitmessung, Vermietungen, Grundpreis, ID-Zähler, PIN-Versuchslimits, Änderungsprotokoll sowie Admin-Passwort- und Partien-PIN-Hashes. Klartext-Passwörter und Sitzungstoken werden nicht exportiert. Die Datei ist nicht verschlüsselt: vertraulich auf einem anderen Gerät bzw. in einer geschützten externen Ablage aufbewahren.

Zur Wiederherstellung die JSON-Datei auswählen (maximal 50 MiB). Nach Format-, Schema-, Prüfsummen- und Datenprüfung zeigt die Vorschau Sicherungsdatum, Anzahl der Spieltage, Partien, Vermietungen und laufenden Vorgänge. **Vorher den aktuellen Stand separat herunterladen.** Die Eingabe **DATEN WIEDERHERSTELLEN** und der anschließende Klick ersetzen sämtliche Anwendungsdaten gemeinsam in einer Datenbanktransaktion. Ein fehlerhafter Import lässt den vorhandenen Datenbestand unverändert. Werden während der Vorschau Daten geändert, wird die Wiederherstellung abgelehnt; die Datei muss erneut geprüft werden. Eine Vorschau gilt zehn Minuten und ist an die angemeldete Sitzung und die konkrete Sicherung gebunden.

Nach erfolgreichem Import werden alle Admin- und Tablet-Sitzungen abgemeldet. Es gelten wieder das **Admin-Passwort und die Partien-PINs aus der Sicherung**; das damalige Admin-Passwort muss bekannt sein. Laufende Spiel- und Mietzeiten rechnen die seit ihrem gespeicherten Start verstrichene Zeit einschließlich Ausfallzeit mit. Wiederherstellungen erscheinen im Änderungsprotokoll. Schema-6-Sicherungen werden beim Import um die BSV-Standardgestaltung ergänzt. Schema-7-Sicherungen benötigen diese oder eine kompatible neuere App-Version; bei weiteren Versionswechseln die Kompatibilität vor dem Import prüfen. Die SHA-256-Prüfsumme erkennt Beschädigungen, bestätigt aber nicht die Herkunft: ausschließlich eigene, vertrauenswürdige Sicherungen importieren.

**Nach Laptop-Ausfall:** Anwendung gemäß Installationsanleitung einrichten, mit dem Zugang der neuen Installation anmelden und die externe JSON-Sicherung importieren. Danach mit dem Passwort aus der Sicherung anmelden, Datenstände prüfen und Tablets mit den gespeicherten PINs anmelden. Installationsbezogene Einstellungen (`.env`, `secrets/config.json`), Serveradresse, HTTPS-Zertifikate und Caddy-CA sind nicht Bestandteil der JSON-Anwendungsdaten. Diese zusätzlich verschlüsselt sichern. Auf einem neuen Laptop müssen Serveradresse/WLAN und Zertifikatsvertrauen eingerichtet oder die separat gesicherte CA wiederhergestellt werden. Die ungenutzten alten Tischschlüssel der Secrets-Datei gewähren keinen Zugriff und werden nicht importiert.

### Zusätzliche Sicherung der Installation und Datenvolumes

Für eine direkte Volume-Sicherung ein kurzes Wartungsfenster nutzen; die App muss während Kopieren und Wiederherstellen gestoppt bleiben. Die SQLite-Hauptdatei **und** vorhandene WAL-/SHM-Dateien zusammen sichern, am einfachsten das gesamte `/data`-Verzeichnis:

```powershell
docker compose stop app
New-Item -ItemType Directory -Force backups
docker compose cp app:/data ./backups/data
docker compose start app
```

Einen neuen, datierten Backup-Ordner pro Sicherung verwenden; `backups/` ist von Git ausgeschlossen. Zusätzlich `secrets/config.json`, `.env` und die Caddy-Volumes verschlüsselt sichern. Die Caddy-CA muss für weiterhin vertraute Tablet-Zertifikate erhalten bleiben.

Restore in eine frische Installation mit zuvor geprüfter Sicherung: Stack erstellen, App stoppen, Datenbankdateien aus dem gesicherten Datenverzeichnis in `/data` des App-Containers kopieren (`docker compose cp <Backup-Datei> app:/data/<Dateiname>`), Dateieigentümer bei Bedarf auf UID/GID 1000 korrigieren und App starten. Nicht mit alten WAL-Dateien einer anderen Sicherung mischen. Anschließend gespeicherte Ergebnisse und Kiosk-Zugriff prüfen. Diesen Restore-Ablauf vor dem ersten echten Spieltag testen.

`docker compose down` erhält Volumes. **`docker compose down -v` löscht Datenbank und CA dauerhaft.**
