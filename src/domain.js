export function changeScore(match, side, delta) {
  if (!['a', 'b'].includes(side) || ![-1, 1].includes(delta)) throw new Error('Ungültige Punkteänderung.');
  if (match.status !== 'live') throw new Error('Diese Begegnung läuft nicht.');
  const next = { ...match, [side]: match[side] + delta };
  if (next[side] < 0 || next[side] > match.target || (delta === 1 && Math.max(match.a, match.b) >= match.target)) throw new Error('Punktestand außerhalb des Spielziels.');
  return next;
}
export function breaker(match) {
  if(match.discipline==='14/1')return null;
  return (match.a + match.b) % 2 === 0 ? match.first : (match.first === 'a' ? 'b' : 'a');
}
