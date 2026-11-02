# Datensicherung und Wiederherstellung

### Export und Import in der Anwendung (FR-005)

FR-006 speichert Turniere in den bestehenden Veranstaltungsmetadaten (`event_planning.metadata`, Turnierformat Version 1) und erzeugt reguläre `matches`. Schema 13 bleibt erhalten; vorhandene Veranstaltungen benötigen keine Datenmigration. Export und Wiederherstellung enthalten auch unbestätigte Auslosungsvorschauen, Teilnehmer-/Namensstände, Modus, Disziplin, Spielziel, Rangfolgeregeln, begründete Gleichstandsentscheidungen, KO-Zuordnungen, Sieger und alle Partien samt PIN-Hashes und Änderungsprotokoll. Die Importprüfung kontrolliert Teilnehmerverweise, vollständige Gruppenpaarungen, Ergebnisbezüge, Qualifikation, Freilose und Siegerfortschritt. Zum Wiederherstellen einer Sicherung mit Turnierdaten diese oder eine neuere FR-006-fähige Anwendung verwenden. Die separate Betriebssicherung von Installation, Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt zusätzlich erforderlich.

Schema 13 enthält auch Spieltagsgäste mit ihrer festen Spieltagsbindung in `players.event_id`, Teilnehmer, Mannschaftszuordnungen und Aufstellungen. Vorschau und Wiederherstellung weisen Verknüpfungen zu fremden Spieltagen zurück. Sicherungen aus Schema 6–12 werden beim Import ergänzt; bisherige Spieler bleiben allgemeine Stammdaten. Installationsdateien, externe Sicherheitskonfiguration und HTTPS-Schlüssel müssen weiterhin zusätzlich gemäß der folgenden Betriebsanleitung gesichert werden.

Unter **Einstellungen → Datensicherung → Sicherung herunterladen** erstellt die angemeldete Spielleitung eine konsistente JSON-Sicherung im laufenden Betrieb. Sie enthält sämtliche Anwendungsdaten und Einstellungen einschließlich Tischanzahl, Vereinsname, Logo und sämtlicher Farben: Veranstaltungen, Partien samt Spielständen, Tischzuweisung und Zeitmessung, Vermietungen, Grundpreis, ID-Zähler, PIN-Versuchslimits, Änderungsprotokoll sowie Admin-Passwort- und Partien-PIN-Hashes. Klartext-Passwörter und Sitzungstoken werden nicht exportiert. Die Datei ist nicht verschlüsselt: vertraulich auf einem anderen Gerät bzw. in einer geschützten externen Ablage aufbewahren.

Zur Wiederherstellung die JSON-Datei auswählen (maximal 50 MiB). Nach Format-, Schema-, Prüfsummen- und Datenprüfung zeigt die Vorschau Sicherungsdatum, Anzahl der Spieltage, Partien, Vermietungen und laufenden Vorgänge. **Vorher den aktuellen Stand separat herunterladen.** Die Eingabe **DATEN WIEDERHERSTELLEN** und der anschließende Klick ersetzen sämtliche Anwendungsdaten gemeinsam in einer Datenbanktransaktion. Ein fehlerhafter Import lässt den vorhandenen Datenbestand unverändert. Werden während der Vorschau Daten geändert, wird die Wiederherstellung abgelehnt; die Datei muss erneut geprüft werden. Eine Vorschau gilt zehn Minuten und ist an die angemeldete Sitzung und die konkrete Sicherung gebunden.

Die Datenprüfung kontrolliert bei Vermietungen auch die fachliche Konsistenz: Laufende Buchungen dürfen noch keinen Endzeitpunkt und keine gespeicherten Abschlusswerte enthalten. Bei abgeschlossenen Buchungen müssen Dauer, aufgerundete Minuten und Gesamtbetrag genau zur gespeicherten Zeitspanne und zum vereinbarten Stundenpreis passen. Grund-/Stundenpreis und eine gespeicherte prozentuale Anpassung werden auf gültige Grenzen und Übereinstimmung geprüft. Admin- und Partien-PIN-Hashes müssen das unterstützte Salt-/Hashformat besitzen; `null` bleibt für Altpartien ohne PIN zulässig. Ein solcher Altbestand benötigt vor der Tabletfreigabe eine neue Partie-PIN.

Auch eine korrekt gechecksumte Datei wird bei solchen Widersprüchen abgelehnt. Der Import repariert oder berechnet Abrechnungen nicht stillschweigend neu; Vorschau und fehlgeschlagene Wiederherstellung lassen alle vorhandenen Tabellen unverändert. Falls eine ältere Sicherung bereits inkonsistente Daten enthält, das Original erhalten und den Bestand in einer getrennten, passenden Installation gezielt prüfen und bewusst korrigieren. Das Anwendungsschema bleibt dabei unverändert; gültige Altbackups werden weiterhin über die vorhandenen Migrationen übernommen.

Nach erfolgreichem Import werden alle Admin- und Tablet-Sitzungen abgemeldet. Es gelten wieder das **Admin-Passwort und die Partien-PINs aus der Sicherung**; das damalige Admin-Passwort muss bekannt sein. Laufende Spiel- und Mietzeiten rechnen die seit ihrem gespeicherten Start verstrichene Zeit einschließlich Ausfallzeit mit. Wiederherstellungen erscheinen im Änderungsprotokoll. Schema-6-Sicherungen werden beim Import um die BSV-Standardgestaltung ergänzt. Sicherungen aus Schema 6 und 7 erhalten die bisherige Tischanzahl 8; Schema 8 enthält die gespeicherte Tischanzahl. Schema-8-Sicherungen benötigen diese oder eine kompatible neuere App-Version; bei weiteren Versionswechseln die Kompatibilität vor dem Import prüfen. Die SHA-256-Prüfsumme erkennt Beschädigungen, bestätigt aber nicht die Herkunft: ausschließlich eigene, vertrauenswürdige Sicherungen importieren.

**Nach Laptop-Ausfall:** Anwendung gemäß Installationsanleitung einrichten, mit dem Zugang der neuen Installation anmelden und die externe JSON-Sicherung importieren. Danach mit dem Passwort aus der Sicherung anmelden, Datenstände prüfen und Tablets mit den gespeicherten PINs anmelden. Installationsbezogene Einstellungen (`.env`, `secrets/config.json`), Serveradresse, HTTPS-Zertifikate und Caddy-CA sind nicht Bestandteil der JSON-Anwendungsdaten. Diese zusätzlich verschlüsselt sichern. Auf einem neuen Laptop müssen Serveradresse/WLAN und Zertifikatsvertrauen eingerichtet oder die separat gesicherte CA wiederhergestellt werden. Die ungenutzten alten Tischschlüssel der Secrets-Datei gewähren keinen Zugriff und werden nicht importiert.

### Zusätzliche Sicherung der Installation und Datenvolumes

PostgreSQL speichert die laufenden Daten im Volume `postgres_data`. Eine konsistente zusätzliche Datenbanksicherung lässt sich mit `pg_dump` erstellen. Einen neuen, datierten Backup-Ordner verwenden; `backups/` ist von Git ausgeschlossen. Das Dump wird zuerst im Container erzeugt, damit PowerShell keine Binärdaten umkodiert:

```powershell
New-Item -ItemType Directory -Force backups/2026-10-28
docker compose exec -T db pg_dump -U billard -d billard -Fc -f /tmp/billard.dump
docker compose cp db:/tmp/billard.dump ./backups/2026-10-28/billard.dump
docker compose exec -T db rm /tmp/billard.dump
```

Für die Wiederherstellung zuerst das aktuelle System separat sichern und die App stoppen. Das Dump ersetzt den Datenbestand der Zieldatenbank. Nur eine geprüfte Sicherung verwenden und den Vorgang vor dem ersten echten Spieltag in einer getrennten Installation testen:

```powershell
docker compose stop app
docker compose cp ./backups/2026-10-28/billard.dump db:/tmp/billard.dump
docker compose exec -T db pg_restore -U billard -d billard --clean --if-exists --single-transaction /tmp/billard.dump
docker compose exec -T db rm /tmp/billard.dump
docker compose start app
docker compose ps
```

Bei einem Fehler die App gestoppt lassen, Ursache beheben und mit der zuvor erstellten Sicherung wiederherstellen. Anschließend HTTPS, Anmeldung, gespeicherte Ergebnisse und Tablet-Zugriff prüfen. Ein laufendes PostgreSQL-Datenvolume nicht als gewöhnlichen Dateiordner kopieren; dafür den gesamten Datenbankdienst sauber stoppen oder PostgreSQL-Backupwerkzeuge verwenden.

Zusätzlich **unverändert** `secrets/config.json`, `.env`, Installationsdateien und beide Caddy-Volumes verschlüsselt sichern. Der interne Datenbankzugang wird deterministisch aus dem SHA-256 der bestehenden Secrets-Datei abgeleitet; sie ist daher auch nach dem Umstieg erforderlich und darf nicht neu formatiert oder ersetzt werden. Beim Neuaufbau eines Datenbankvolumes muss dieselbe Datei verfügbar sein. Passwortänderungen in der Anwendung verändern diese Datei nicht. Externe Sicherheitskonfiguration und HTTPS-Schlüssel bleiben eine separate Betriebssicherung; diese ersetzt niemals den vollständigen Anwendungs-Export.

### Frühere Installationen und Rückkehrstände

Die automatische Übernahme von SQLite-Dateien ist seit 2026-11-01 entfernt. Noch nicht umgestellte Installationen vor dem Update mit einer kompatiblen Zwischenversion nach PostgreSQL überführen oder dort eine unterstützte JSON-Sicherung erzeugen. Die aktuelle App öffnet alte Datenbankdateien nicht mehr. Der JSON-Import unterstützt Schema 6–13, ergänzt ältere gültige Sicherungen und prüft sämtliche Anwendungstabellen und Einstellungen vor der vollständigen Wiederherstellung.

Vor dem Update Image-Digest, Compose-Dateien, JSON-Export und konsistenten PostgreSQL-Dump extern sichern. Für eine Rückkehr passende App und dazugehörigen Datenbankstand gemeinsam wiederherstellen. Bereits vorhandene archivierte Datenbankdateien und Volumes nicht ungeprüft löschen; sie werden von dieser Bereinigung nicht verändert. Das `/data`-Volume bleibt für JSON-Sicherungen vor nuLiga-Abgleichen erhalten. Die separate Betriebssicherung von Installation, externer Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt zusätzlich verpflichtend.

## Spieler und Mannschaften (Schema 9)

Die Sicherung enthält automatisch Spieler, Mannschaften, aktuelle Spielerzuordnungen, Spieltagsteilnehmer, ausgewählte Mannschaften und die je Partie gespeicherten historischen Spieler-/Mannschaftszuordnungen einschließlich Namen. Archivierte Einträge und Änderungsprotokoll bleiben enthalten. Import und Vorschau prüfen IDs und Beziehungen; fehlende Tabellen oder widersprüchliche Zuordnungen werden abgewiesen. Sicherungen aus Schema 6/7/8 werden beim Import auf Schema 9 ergänzt: neue Stammdatenbereiche sind leer, alte Partien behalten ihre Namen ohne automatische Personenverknüpfung. Schema-9-Sicherungen benötigen diese oder eine kompatible neuere App-Version.

Beim Update wird eine vorhandene PostgreSQL-Datenbank aus Schema 8 transaktional erweitert. Vorher die vollständige Anwendungssicherung herunterladen. Für eine Rückkehr zur älteren App die vor dem Update erstellte Datenbanksicherung in einer passenden Installation wiederherstellen; eine ältere App kann Schema 9 nicht öffnen. Installationsdateien, externe Sicherheitskonfiguration und HTTPS-Schlüssel weiterhin zusätzlich nach der oben dokumentierten Betriebssicherung aufbewahren.

### nuLiga-Daten (Schema 10)

Die Anwendungssicherung umfasst alle Spieler, Mannschaften, Kader, Spieltagsteilnehmer sowie nuLiga-Kennungen, Quellstände zur Erkennung lokaler Änderungen, Zeitpunkt und Ergebnis des letzten Abgleichs. Diese Tabellen werden automatisch exportiert und beim Import auf gültige Zuordnungen geprüft. Nach Wiederherstellung erkennt die Synchronisierung bereits importierte Einträge wieder. Sicherungen der Schemata 6–9 werden automatisch ergänzt; ältere Sicherungen enthalten noch keine nuLiga-Zuordnungen. Die separate Betriebssicherung von Installation, externer Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt zusätzlich erforderlich.

### Spieltagsplanung und Termin-Sync (Schema 11)

Die Sicherung enthält zusätzlich den Planungs-/Startzustand jedes Spieltags, die stabilen Quellkennungen, importierte Heim- und Gastmannschaften, Uhrzeiten und Ligadaten sowie Zeitpunkt und Ergebnis des Spieltagsabgleichs. Export, Prüfung und Wiederherstellung übernehmen diese Tabellen vollständig. Ältere Sicherungen der Schemata 6–10 ergänzen vorhandene Veranstaltungen als bereits gestartet, damit bestehende Partien und Spielstände unverändert weitergeführt werden können. Die separate Betriebssicherung bleibt zusätzlich erforderlich.

### Feste Spieltagspartien und Doppel (Schema 12)

Alle zehn Partienplätze, gespeicherte Einzel- und Doppelaufstellungen, Tischwünsche, Spielziele, Versionsstände und Verknüpfungen zu gestarteten Partien gehören zur vollständigen Anwendungssicherung. Bei der Prüfung werden Spieler, Spieltage und Partieverknüpfungen auf Konsistenz kontrolliert. Schemata 6–11 erhalten leere Partienplätze, ohne bestehende Partien oder Ergebnisse umzuschreiben. Die separate Betriebssicherung bleibt erforderlich.


### Lagerdaten ab Schema 14

Die Anwendungssicherung enthält sämtliche Getränke einschließlich archivierter Artikel, Gebinde, Lagerbewegungen mit historischen Namen, Größen, VK/EK (einschließlich unbekanntem EK), Begründungen und Gegenbezügen sowie die Vorgangskennungen zur Verhinderung von Doppelbuchungen. Änderungen der Stammdaten werden zusätzlich im enthaltenen Änderungsprotokoll dokumentiert. Der Import rekonstruiert Bestände und weist widersprüchliche Mengen, Bezüge oder negative Zwischenbestände ohne Datenänderung ab. Sicherungen aus Schema 6–13 starten nach Migration mit leerem Lager. Die separate Betriebssicherung von Installation, externer Sicherheitskonfiguration und HTTPS-Schlüsseln bleibt erforderlich.
