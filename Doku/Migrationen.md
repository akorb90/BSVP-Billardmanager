# Datenmigrationen und Kompatibilität

Stand: 2026-10-29. Aktuelles logisches Schema: **13**. Quellen sind `src/database.js`, `src/legacy-db.js`, die dort eingebundenen Fachmodule und `src/backup.js`. Die [Architekturübersicht](Entwicklung.md#aktuelle-architektur) beschreibt den heutigen Betrieb; diese Seite dokumentiert die Entwicklung des Datenmodells. Betriebsbefehle und Rückkehrverfahren stehen unter [Datensicherung](Datensicherung.md).

## Historische Schemastände

Die Nummer bezeichnet jeweils den Zielstand der Änderung. SQLite speichert ihn in `PRAGMA user_version`, PostgreSQL in `_schema`. Die ursprünglichen SQLite-Basistabellen werden auch bei einer unversionierten Datenbank angelegt; anschließend folgen die nötigen Versionsschritte.

| Schema | Änderung und Übernahmeverhalten |
| --- | --- |
| 1 / Basis | Veranstaltungen, Partien, eindeutige Belegung laufender Partien und Änderungsprotokoll; ursprünglich acht Tische und Spielziele bis 99 |
| 2 | Veranstaltungsstatus und Versionsnummer; bestehende Veranstaltungen erhalten `open`. `entity_ids` wird aus den vorhandenen IDs initialisiert, damit gelöschte IDs nicht erneut vergeben werden. |
| 3 | Partien-PIN-Hashes, Berechtigungsrevision und persistente PIN-Versuchslimits. Bestehende Partien erhalten keine automatische PIN. |
| 4 | Ausstoßgewinner, Einrichtungsstatus und Zeitfelder. Bereits begonnene/abgeschlossene Partien gelten als eingerichtet; laufende Partien erhalten beim Upgrade einen Zeitstart, keine rekonstruierte frühere Spieldauer. |
| 5 | Vermietungen und Grundpreis (`rentals`, `rental_settings`), initial 900 Cent pro Stunde |
| 6 | Dauerhafter Admin-Passwort-Hash in `admin_credentials`; einmalige Übernahme aus der Sicherheitskonfiguration. Spätere Konfigurationsänderungen überschreiben den gespeicherten Hash nicht. |
| 7 | Vereinsname, Logo, Farben und Versionsstand in `branding`, initial mit BSV-Vorgaben |
| 8 | Grenzen für Partien und Vermietungen auf 20 Tische erweitert; `table_settings` startet mit acht Tischen. Tabellenumbau erhält Zeilen und Belegungsindizes. |
| 9 | Spieler, Mannschaften, Kader, Spieltagsteilnehmer und Mannschaftsauswahl; Partien erhalten historische Spieler-/Mannschaftszuordnungen. Alte Namen werden nicht automatisch Stammdatenspielern zugeordnet. |
| 10 | nuLiga-Quellzuordnungen und Importzustand in `nuliga_entities` und `nuliga_sync` |
| 11 | Spieltagsplanung und Termin-Sync in `event_planning` und `nuliga_schedule_sync`. Bestehende Veranstaltungen werden als begonnen mit leeren Metadaten übernommen. |
| 12 | Zehn Liga-Aufstellungsplätze je Veranstaltung in `event_match_slots`, einschließlich Doppelbesetzung; Spielzielgrenze auf 999 erweitert |
| 13 | Optionale Spieltagsbindung von Gästen in `players.event_id`; bestehende Spieler bleiben ohne Bindung allgemeine Stammdaten. |

FR-006 ergänzt Turnierformat 1 innerhalb vorhandener Veranstaltungsmetadaten und regulärer Partien. Der Datenbankstand bleibt 13. Schemaversion und fachliche Formatversion sind deshalb getrennt zu betrachten: Eine ältere App mit Schema 13 muss nicht bereits Turnierdaten verstehen.

## Tatsächliche Upgradewege

- **Bestehendes PostgreSQL:** `openDatabase` aktualisiert die installierten Stände 8–12 in einer Transaktion auf 13. Je nach Ausgangsstand werden die fehlenden Fachschemas ergänzt; Stand 13 wird direkt geöffnet. Andere installierte Versionen werden abgewiesen. SQLite-Schritte 1–7 sind keine direkt unterstützten PostgreSQL-Upgrades.
- **Leeres PostgreSQL mit SQLite-Altbestand:** Die Quelldatei wird schreibgeschützt geöffnet und mit der SQLite-Backup-API in eine temporäre Kopie übertragen. Nur diese Kopie wird über die SQLite-Migrationsschritte aktualisiert. Tabellen und Daten werden nach PostgreSQL übertragen und zeilenweise verglichen; `_schema` wird auf 13 gesetzt. Fehler rollen die PostgreSQL-Transaktion zurück, die Quelldatei bleibt erhalten. Unbekannte vorhandene PostgreSQL-Tabellen verhindern die automatische Übernahme.
- **Neuinstallation ohne Altbestand:** Ein temporäres SQLite-Schema im Speicher liefert das aktuelle Ausgangsschema einschließlich Vorgaben; PostgreSQL wird daraus initialisiert. SQLite wird anschließend nicht als produktive Datenbank verwendet.

## Sicherungsimport

Das JSON-Format `bsvp-billardmanager` bleibt Version 1. Der Import unterstützt Schema 13 und ergänzt gültige Sicherungen aus Schema 6–12 vor der vollständigen Validierung. Schema 6 erhält Standardgestaltung, Schema 6/7 acht Tische. Fehlende spätere Stammdaten- und nuLiga-Bereiche werden ergänzt, alte Veranstaltungen erhalten Planungszustände und Aufstellungsplätze; alte Spieler erhalten keine Spieltagsbindung. Prüfsumme, Tabellen-/Spaltenvollständigkeit und fachliche Beziehungen werden anschließend geprüft. Sicherungen vor Schema 6 sind durch diesen JSON-Import nicht unterstützt.

Vor jedem produktiven Upgrade eine konsistente Anwendungssicherung und die zusätzliche Betriebssicherung erstellen. Eine Wiederherstellung übernimmt auch damalige Admin- und PIN-Hashes und meldet bestehende Sitzungen ab. Eine ältere App darf nicht gegen eine neuere Datenbank gestartet werden: Für Rückkehr passende App und Sicherung gemeinsam wiederherstellen. Details einschließlich PostgreSQL-Dump und SQLite-Rückfallstand stehen in der [Betriebsanleitung zur Datensicherung](Datensicherung.md).

## Prüfungen bei künftigen Änderungen

Versionsänderungen müssen PostgreSQL-Upgrade, SQLite-Übernahme sowie Export, Prüfung und Wiederherstellung berücksichtigen. `tests/backup.test.js` und `tests/postgres.integration.js` sowie der isolierte Docker-Test (`npm run test:docker`) prüfen diese Wege mit getrennten Daten. Neue Tabellen müssen automatisch exportiert und vollständig wiederhergestellt werden; neue Einstellungen dürfen nicht ausschließlich lokal liegen. Nach Schemaänderungen diese Historie und den aktuellen Stand in der Architekturübersicht gemeinsam aktualisieren.
