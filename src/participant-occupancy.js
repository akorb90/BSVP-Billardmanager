// Call inside the same transaction as the start or edit. Linked doubles partners
// belong to their match even though only the first player is stored in matches.
export function participantOccupancy({db,fail}) {
  return async (ids,matchId=0)=>{
    const participants=new Set(ids.filter(Boolean));
    if(matchId) {
      const slot=await db.prepare('SELECT player_a2_id,player_b2_id FROM event_match_slots WHERE match_id=?').get(matchId);
      for(const id of [slot?.player_a2_id,slot?.player_b2_id])if(id)participants.add(id);
    }
    if(!participants.size)return;
    const live=await db.prepare("SELECT m.player_a_id,m.player_b_id,s.player_a2_id,s.player_b2_id FROM matches m LEFT JOIN event_match_slots s ON s.match_id=m.id WHERE m.status='live' AND m.id<>?").all(matchId);
    if(live.some(m=>[m.player_a_id,m.player_b_id,m.player_a2_id,m.player_b2_id].some(id=>participants.has(id))))throw fail(409,'Ein ausgewählter Spieler ist bereits an einer laufenden Partie beteiligt.');
  };
}
