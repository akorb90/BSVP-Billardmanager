import { readFileSync, statSync } from 'node:fs';

export function loadConfig(path) {
  try {
    if (!statSync(path).isFile()) throw new Error('keine reguläre Datei');
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const reason = error instanceof SyntaxError ? 'ungültiges JSON' : error.code || 'keine lesbare reguläre Datei';
    throw new Error(`Sicherheitskonfiguration ${path} kann nicht geladen werden (${reason}). Bei frischer Image-Installation docker compose -f compose.yaml run --rm setup ausführen (im Quellcode-Checkout alternativ npm run setup); bei einem config.json-Ordner zuerst dessen Inhalt prüfen. Vorhandene Zugangsdaten erhalten. Danach docker compose -f compose.yaml up -d --wait ausführen; für lokale Quellcode-Builds docker compose up -d --build --wait.`);
  }
}
