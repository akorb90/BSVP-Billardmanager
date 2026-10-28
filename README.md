# BSVP Billardmanager

Webanwendung für Spieltage, Ergebnisse und Tischvermietung an 1 bis 20 einstellbaren Billardtischen.

## Neu installieren

Voraussetzung: Docker mit Compose ab 2.24.4; unter Windows Docker Desktop mit Linux-Containern. Node.js und Git werden auf dem Betriebsrechner nicht benötigt.

Das Paket **billardmanager-installation** aus einem erfolgreichen [GitHub-Actions-Lauf auf main](https://github.com/akorb90/BSVP-Billardmanager/actions/workflows/test.yml) herunterladen und in einen festen Ordner entpacken. Alternativ den [Quellcode als ZIP](https://github.com/akorb90/BSVP-Billardmanager/archive/refs/heads/main.zip) entpacken. PowerShell in diesem Ordner öffnen:

```powershell
Copy-Item .env.example .env
docker compose -f compose.yaml --profile setup pull
docker compose -f compose.yaml run --rm setup
docker compose -f compose.yaml up -d --wait
```

Das einmal angezeigte Admin-Passwort im Passwortmanager speichern. Setup nur bei einer **frischen Installation** ausführen; vorhandene `.env` und `secrets/config.json` erhalten. Die Images müssen zuvor veröffentlicht worden sein; bei fehlendem Zugriff siehe [Deployment](Doku/Deployment.md).

HTTPS-Zertifikat exportieren und auf dem Rechner als vertrauenswürdig installieren (unter Windows: „Vertrauenswürdige Stammzertifizierungsstellen“):

```powershell
docker compose -f compose.yaml cp proxy:/data/caddy/pki/authorities/local/root.crt ./secrets/billard-root.crt
```

Danach [https://localhost](https://localhost) öffnen und anmelden. Für Tablets im Vereinsnetz: [WLAN und Zertifikate einrichten](Doku/Betrieb.md#tablets-im-vereins-wlan).

## Aktualisieren

Zuerst unter **Einstellungen → Datensicherung** eine Sicherung herunterladen. Im **bisherigen Installationsordner**:

```powershell
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d --wait
docker compose -f compose.yaml ps
```

`pull` lädt die aktuelle Version; `up` übernimmt sie in den laufenden Stack. Daten, Zugangsdaten und HTTPS-Zertifikate bleiben in den bisherigen Volumes und Dateien erhalten. Nach dem Update erneut anmelden und [https://localhost/health](https://localhost/health) aufrufen. Kein `down -v` verwenden.

Für Updates sind weder ein Git-Download noch ein lokaler Image-Build erforderlich. Änderungen an Installationsdateien werden in den [Release Notes](Doku/CHANGELOG.md) genannt. Für den Wechsel einer bisherigen Quellcode-Installation und feste Versionen siehe [Deployment](Doku/Deployment.md).

Die weitere Dokumentation steht im [Doku-Ordner](Doku/README.md).
