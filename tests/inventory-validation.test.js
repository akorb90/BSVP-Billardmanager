import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInventoryBackup} from '../src/inventory.js';

const fixture=()=>{
  const snapshot=JSON.stringify({name:'Wasser',size_ml:500,sale_cents:250,purchase_cents:null,package_name:'20er-Kasten',bottles:20,packages:2,singles:3});
  const movement={id:1,drink_id:'water',operation_id:'operation-00000001',kind:'initial',quantity:43,created_at:'2026-11-02T10:00:00Z',reason:'',snapshot,reverses:null};
  return {inventory_drinks:[{id:'water'}],inventory_packages:[],inventory_operations:[1,2,3].map(n=>({id:'operation-0000000'+n,request:'a'.repeat(64),result:'{}'})),inventory_movements:[movement,{...movement,id:2,operation_id:'operation-00000002',kind:'consumption',quantity:-2,snapshot:JSON.stringify({...JSON.parse(snapshot),bottles:1,packages:0,singles:2})}]};
};
test('Lagerimport: 43 Flaschen, Verbrauch und begründete Rückbuchung sind rekonstruierbar',()=>{
  const data=fixture();assert.doesNotThrow(()=>validateInventoryBackup(data));
  const m=data.inventory_movements[1];
  data.inventory_movements.push({...m,id:3,operation_id:'operation-00000003',kind:'reversal',quantity:2,reason:'Nie ausgegeben',reverses:2});
  assert.doesNotThrow(()=>validateInventoryBackup(data));
  assert.doesNotThrow(()=>validateInventoryBackup({inventory_drinks:[],inventory_packages:[],inventory_operations:[],inventory_movements:[]}));
});
test('Lagerimport: negative Zwischenbestände, widersprüchliche Mengen, EK-Lücken und Referenzen prüfen',()=>{
  for(const change of [
    d=>d.inventory_movements[0].quantity=-43,
    d=>d.inventory_movements[1].quantity=-44,
    d=>d.inventory_movements[0].quantity=42,
    d=>d.inventory_movements[0].snapshot='{}',
    d=>d.inventory_movements[0].snapshot=JSON.stringify({...JSON.parse(d.inventory_movements[0].snapshot),purchase_cents:-1}),
    d=>d.inventory_movements[0].snapshot=JSON.stringify({...JSON.parse(d.inventory_movements[0].snapshot),purchase_cents:''}),
    d=>d.inventory_movements[0].drink_id='unknown',
    d=>d.inventory_movements[0].operation_id='unknown',
    d=>d.inventory_movements[1].kind='initial',
    d=>d.inventory_movements[1].kind='breakage',
    d=>d.inventory_movements[0].created_at='invalid',
    d=>d.inventory_movements[0].reverses=2
  ]){const data=fixture();change(data);assert.throws(()=>validateInventoryBackup(data));}
});
test('Lagerimport: Gegenbuchungen verlangen passenden Bezug, historische Werte und Pflichtgrund',()=>{
  for(const change of [m=>m.reverses=99,m=>m.quantity=3,m=>m.reason=' ',m=>m.snapshot=JSON.stringify({...JSON.parse(m.snapshot),sale_cents:300}),m=>m.reverses=3]){
    const data=fixture(),original=data.inventory_movements[1];
    const reversal={...original,id:3,operation_id:'operation-00000003',kind:'reversal',quantity:2,reason:'Fehler',reverses:2};
    data.inventory_movements.push(reversal);change(reversal);assert.throws(()=>validateInventoryBackup(data));
  }
});
