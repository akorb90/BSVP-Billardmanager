# Datenmigrationen und Kompatibilität

Stand: 2026-11-02. Aktuelles logisches Schema: **15**. Quellen sind `src/database.js`, die dort eingebundenen Fachmodule und `src/backup.js`. Die [Architekturübersicht](Entwicklung.md#aktuelle-architektur) beschreibt den heutigen Betrieb; diese Seite dokumentiert die Entwicklung des Datenmodells. Betriebsbefehle und Rückkehrverfahren stehen unter [Datensicherung](Datensicherung.md).

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
| 15 | Benannte Wareneingangsvorlagen und bestätigte Sammelbuchungen/Inventuren mit historischen Positionen und Bewegungsbezügen. Schema 14 wird ohne Änderung bestehender Lagerdaten erweitert. |
| 14 | Getränkestammdaten, Gebinde, historische Lagerbewegungen und eindeutige Vorgänge. Bestehende Vereinsdaten bleiben erhalten; das Lager startet leer. |
| 13 | Optionale Spieltagsbindung von Gästen in `players.event_id`; bestehende Spieler bleiben ohne Bindung allgemeine Stammdaten. |

FR-006 ergänzt Turnierformat 1 innerhalb vorhandener Veranstaltungsmetadaten und regulärer Partien. Diese Änderung benötigte selbst keine neue Schemaversion. Schemaversion und fachliche Formatversion sind deshalb getrennt zu betrachten: Eine ältere App mit Schema 13 muss nicht bereits Turnierdaten verstehen.

## Tatsächliche Upgradewege

- **Bestehendes PostgreSQL:** `openDatabase` aktualisiert die installierten Stände 8–14 in einer Transaktion auf 15. Je nach Ausgangsstand werden die fehlenden Fachschemas ergänzt; Stand 15 wird direkt geöffnet. Andere installierte Versionen werden abgewiesen. SQLite-Schritte 1–7 sind keine direkt unterstützten PostgreSQL-Upgrades.
- **Neuinstallation:** Das PostgreSQL-Schema aus `src/schema.sql`, `src/inventory-schema.js`, `src/inventory-batch-schema.js` und die Standardwerte werden in einer Transaktion angelegt. Unbekannte vorhandene Tabellen verhindern die Initialisierung; bei Fehlern bleibt kein halbfertiges Schema zurück.
- **Frühere SQLite-Installationen:** Die automatische Dateiübernahme und die SQLite-Laufzeit sind seit 2026-11-01 entfernt. Vor einem Update eine kompatible Zwischenversion für die Überführung nach PostgreSQL verwenden oder eine unterstützte JSON-Sicherung exportieren und in der aktuellen Installation wiederherstellen. Alte Datenbankdateien werden nicht mehr geöffnet.

## Sicherungsimport

Das JSON-Format `bsvp-billardmanager` bleibt Version 1. Der Import unterstützt Schema 15 und ergänzt gültige Sicherungen aus Schema 6–14 vor der vollständigen Validierung. Schema 6 erhält Standardgestaltung, Schema 6/7 acht Tische. Fehlende spätere Stammdaten- und nuLiga-Bereiche werden ergänzt, alte Veranstaltungen erhalten Planungszustände und Aufstellungsplätze; alte Spieler erhalten keine Spieltagsbindung. Prüfsumme, Tabellen-/Spaltenvollständigkeit und fachliche Beziehungen werden anschließend geprüft. Sicherungen vor Schema 6 sind durch diesen JSON-Import nicht unterstützt.

Vor jedem produktiven Upgrade eine konsistente Anwendungssicherung und die zusätzliche Betriebssicherung erstellen. Eine Wiederherstellung übernimmt auch damalige Admin- und PIN-Hashes und meldet bestehende Sitzungen ab. Eine ältere App darf nicht gegen eine neuere Datenbank gestartet werden: Für Rückkehr passende App und Sicherung gemeinsam wiederherstellen. Details einschließlich PostgreSQL-Dump und passendem Rückkehrstand stehen in der [Betriebsanleitung zur Datensicherung](Datensicherung.md).

## Prüfungen bei künftigen Änderungen

Versionsänderungen müssen PostgreSQL-Initialisierung, PostgreSQL-Upgrade sowie Export, Prüfung und Wiederherstellung berücksichtigen. `tests/backup.test.js` und `tests/postgres.integration.js` sowie der isolierte Docker-Test (`npm run test:docker`) prüfen diese Wege mit getrennten Daten. Neue Tabellen müssen automatisch exportiert und vollständig wiederhergestellt werden; neue Einstellungen dürfen nicht ausschließlich lokal liegen. Nach Schemaänderungen diese Historie und den aktuellen Stand in der Architekturübersicht gemeinsam aktualisieren.


Schema-6–13-JSON-Sicherungen werden um leere Lagertabellen erweitert, ohne fiktive Bestände oder Bewegungen zu erzeugen. Schema 14 sichert alle Lagertabellen automatisch einschließlich archivierter Artikel, historischer Gebinde-/Preiswerte und Vorgangskennungen. Die Importprüfung rekonstruiert Bestände in Bewegungsreihenfolge und prüft Mengen, Richtungen, Gegenbezüge sowie historische Werte; widersprüchliche Sicherungen werden atomar abgewiesen.


Schema 15 ergänzt inventory_templates und inventory_batches. Schema-14-Sicherungen behalten sämtliche Artikel, Gebinde, Bewegungen und Vorgangskennungen und erhalten leere Vorlagen-/Sammeltabellen. Ältere Sicherungen werden zuerst wie beschrieben auf das leere Lager migriert. Der Import prüft auch Vorlagenbezüge, Einheiten, EK-Lücken, gezählte Bestände, Differenzen, historische Werte, Bewegungsanker und die konsistenten Wiederholantworten abgeschlossener Sammelvorgänge.
