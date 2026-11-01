// Club Swiss format: ceil(log2(N)) rounds, no repeat opponents or repeat byes.
// Bounding the round count guarantees a perfect matching in the remaining graph.
export const swissRoundCount = count => Math.ceil(Math.log2(count));

export function swissStandings(t, matches) {
  const rows=t.players.map(p=>({id:p.id,played:0,wins:0,for:0,against:0,difference:0,buchholz:0,byes:0}));
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const game of t.rounds.flat()) {
    const a=byId.get(game.a);
    if(!game.b){a.wins++;a.byes++;continue;}
    const m=matches.find(m=>m.id===game.match);if(m?.status!=='finished')continue;
    const b=byId.get(game.b);a.played++;b.played++;
    a.for+=m.a;a.against+=m.b;b.for+=m.b;b.against+=m.a;
    (m.a>m.b?a:b).wins++;
  }
  for(const game of t.rounds.flat()) {
    if(!game.b||matches.find(m=>m.id===game.match)?.status!=='finished')continue;
    byId.get(game.a).buchholz+=byId.get(game.b).wins;
    byId.get(game.b).buchholz+=byId.get(game.a).wins;
  }
  rows.forEach(r=>r.difference=r.for-r.against);
  const compare=(a,b)=>b.wins-a.wins||b.buchholz-a.buchholz||(t.rules==='difference'?(b.difference-a.difference||b.for-a.for):0);
  rows.sort(compare);
  const tied=rows.some((r,i)=>i&&compare(rows[i-1],r)===0);
  const order=t.resolutions[0]?.order;
  if(order)rows.sort((a,b)=>compare(a,b)||order.indexOf(a.id)-order.indexOf(b.id));
  return {rows,tied:tied&&!order,complete:t.rounds.length===swissRoundCount(rows.length)&&t.rounds.flat().every(g=>!g.b||matches.find(m=>m.id===g.match)?.status==='finished')};
}

// Edmonds' augmenting-path algorithm, including odd-cycle contraction. Each
// adjacency list prefers nearby scores/ranks; augmenting paths avoid dead ends.
function perfectMatching(edges) {
  const n=edges.length,match=Array(n).fill(-1);
  for(let root=0;root<n;root++) {
    if(match[root]!==-1)continue;
    const parent=Array(n).fill(-1),base=Array.from({length:n},(_,i)=>i),used=Array(n).fill(false),queue=[root];
    used[root]=true;
    const ancestor=(a,b)=>{
      const seen=Array(n).fill(false);
      while(true){a=base[a];seen[a]=true;if(match[a]===-1)break;a=parent[match[a]];}
      while(true){b=base[b];if(seen[b])return b;b=parent[match[b]];}
    };
    const mark=(v,b,child,blossom)=>{
      while(base[v]!==b){blossom[base[v]]=blossom[base[match[v]]]=true;parent[v]=child;child=match[v];v=parent[match[v]];}
    };
    let end=-1;
    for(let head=0;head<queue.length&&end===-1;head++) {
      const v=queue[head];
      for(const u of edges[v]) {
        if(base[v]===base[u]||match[v]===u)continue;
        if(u===root||(match[u]!==-1&&parent[match[u]]!==-1)) {
          const b=ancestor(v,u),blossom=Array(n).fill(false);
          mark(v,b,u,blossom);mark(u,b,v,blossom);
          for(let i=0;i<n;i++)if(blossom[base[i]]){base[i]=b;if(!used[i]){used[i]=true;queue.push(i);}}
        }else if(parent[u]===-1) {
          parent[u]=v;
          if(match[u]===-1){end=u;break;}
          used[match[u]]=true;queue.push(match[u]);
        }
      }
    }
    if(end===-1)return null;
    while(end!==-1){const p=parent[end],next=p===-1?-1:match[p];match[end]=p;if(p!==-1)match[p]=end;end=next;}
  }
  return match;
}

export function swissPairings(t,matches) {
  const rows=swissStandings(t,matches).rows;
  const ids=rows.map(r=>r.id);if(ids.length%2)ids.push(null);
  const previous=new Set(t.rounds.flat().map(g=>JSON.stringify([g.a,g.b].sort())));
  const bye=ids.indexOf(null);
  const edges=ids.map((id,i)=>ids.map((_,j)=>j).filter(j=>i!==j&&!previous.has(JSON.stringify([id,ids[j]].sort()))).sort((a,b)=>{
    if(i===bye)return b-a; // Prefer a lower-ranked participant for the bye.
    if(a===bye)return 1;if(b===bye)return -1;
    return Math.abs(rows[i].wins-rows[a].wins)-Math.abs(rows[i].wins-rows[b].wins)||Math.abs(i-a)-Math.abs(i-b)||a-b;
  }));
  // Start with the bye vertex, so its lowest-ranked eligible player is tried first.
  if(bye!==-1) {
    const order=[bye,...ids.map((_,i)=>i).filter(i=>i!==bye)],reverse=new Map(order.map((v,i)=>[v,i]));
    const pairs=perfectMatching(order.map(i=>edges[i].map(j=>reverse.get(j))));
    if(!pairs)throw new Error('Keine gültige Schweizer Paarung gefunden.');
    return order.flatMap((v,i)=>i<pairs[i]?[{a:ids[v]===null?ids[order[pairs[i]]]:ids[v],b:ids[v]===null?null:ids[order[pairs[i]]],match:null}]:[]);
  }
  const pairs=perfectMatching(edges);
  if(!pairs)throw new Error('Keine gültige Schweizer Paarung gefunden.');
  return ids.flatMap((id,i)=>i<pairs[i]?[{a:id,b:ids[pairs[i]],match:null}]:[]);
}
