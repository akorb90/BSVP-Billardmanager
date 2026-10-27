// Shared by the browser and server: money is stored as integer cents.
export function rentalPrice(start, end, hourlyCents) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start ||
      !Number.isSafeInteger(hourlyCents) || hourlyCents < 0 || hourlyCents > 1000000) {
    throw new Error('Ungültige Zeitangaben oder Stundenpreis.');
  }
  const duration_ms = end - start, billed_minutes = Math.ceil(duration_ms / 60000);
  const total_cents = Math.round(billed_minutes * hourlyCents / 60);
  if (!Number.isSafeInteger(total_cents)) throw new Error('Betrag zu groß.');
  return { duration_ms, billed_minutes, total_cents };
}

export function hourlyRate(base, mode, value) {
  if (!Number.isSafeInteger(base) || base < 0 || base > 1000000 ||
      typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Ungültiger Preis.');
  if (mode === 'percent' && (value < -100 || value > 1000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7)) throw new Error('Anpassung muss zwischen −100 und +1000 % liegen (maximal zwei Nachkommastellen).');
  if (!['direct', 'percent'].includes(mode)) throw new Error('Ungültige Preisart.');
  if (mode === 'direct' && (value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7)) throw new Error('Eurobetrag mit maximal zwei Nachkommastellen eingeben.');
  const cents = Math.round(mode === 'percent' ? base * (100 + value) / 100 : value * 100);
  if (cents < 0 || cents > 1000000) throw new Error('Stundenpreis muss zwischen 0 und 10.000 € liegen.');
  return cents;
}
