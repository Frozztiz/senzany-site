const state={snapshots:[],selectedSteamId:"",selected:new Set(),itemFilter:"",playerFilter:""};

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function snapshot(){return state.snapshots.find(x=>x.steamId===state.selectedSteamId)||null}
function formatDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"medium"}).format(d)}
function ageText(v){const s=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/1000));if(s<60)return `${s}s`;if(s<3600)return `${Math.floor(s/60)} min`;return `${Math.floor(s/3600)} h`}
function keyFor(item,index){return `${index}:${item.className}`}
function showFeedback(message,type){const el=$("inventoryFeedback");el.hidden=false;el.className=`inv-feedback ${type==="ok"?"is-ok":"is-error"}`;el.textContent=message}

function renderPlayers(){
 const box=$("inventoryPlayers"); const q=state.playerFilter.toLowerCase();
 const rows=state.snapshots.filter(x=>`${x.playerName} ${x.steamId}`.toLowerCase().includes(q));
 $("inventoryPlayerCount").textContent=`${rows.length} joueur${rows.length>1?"s":""}`;
 if(!rows.length){box.innerHTML='<div class="inv-empty">Aucun snapshot disponible.</div>';return}
 box.innerHTML=rows.map(x=>`<button class="inv-player ${x.steamId===state.selectedSteamId?"is-active":""}" data-steam="${esc(x.steamId)}"><strong>${esc(x.playerName||"Joueur")}</strong><small>${esc(x.steamId)}</small><small class="inv-player__fresh">MAJ ${esc(ageText(x.capturedAt))}</small></button>`).join("");
 box.querySelectorAll("[data-steam]").forEach(b=>b.addEventListener("click",()=>selectPlayer(b.dataset.steam)));
}

function renderItems(){
 const s=snapshot(); if(!s)return;
 const q=state.itemFilter.toLowerCase();
 const items=(s.items||[]).map((item,index)=>({item,index})).filter(({item})=>`${item.className} ${item.displayName||""}`.toLowerCase().includes(q));
 const box=$("inventoryItems");
 if(!items.length){box.innerHTML='<div class="inv-empty">Aucun objet trouvé.</div>'}
 else box.innerHTML=items.map(({item,index})=>{
   const key=keyFor(item,index); const qty=Math.max(1,Number(item.quantity)||1);
   const health=Number(item.healthPercent);
   return `<label class="inv-item"><input type="checkbox" data-key="${esc(key)}" ${state.selected.has(key)?"checked":""}><span><strong>${esc(item.className)}</strong><small>${esc(item.displayName||item.className)}</small></span><span>× ${qty}</span><span class="inv-health">${Number.isFinite(health)?`${Math.round(health)} %`:"—"}</span></label>`
 }).join("");
 box.querySelectorAll("input[data-key]").forEach(cb=>cb.addEventListener("change",()=>{cb.checked?state.selected.add(cb.dataset.key):state.selected.delete(cb.dataset.key);updateSelection()}));
 updateSelection();
}

function updateSelection(){
 $("inventorySelectionCount").textContent=`${state.selected.size} objet${state.selected.size>1?"s":""} sélectionné${state.selected.size>1?"s":""}`;
 $("createInventoryDelivery").disabled=state.selected.size===0;
}

function selectPlayer(steamId){
 state.selectedSteamId=steamId; state.selected.clear(); state.itemFilter="";
 $("inventoryItemSearch").value="";
 const s=snapshot(); if(!s)return;
 $("inventoryEmptyState").hidden=true; $("inventoryDetail").hidden=false;
 $("inventoryPlayerName").textContent=s.playerName||"Joueur";
 $("inventorySteamId").textContent=s.steamId;
 $("inventoryCapturedAt").textContent=formatDate(s.capturedAt);
 $("inventoryFreshness").textContent=`Il y a ${ageText(s.capturedAt)} · ${(s.items||[]).length} entrée(s)`;
 renderPlayers(); renderItems();
}

async function load(){
 try{
  const r=await fetch("/api/admin/inventories",{credentials:"same-origin",cache:"no-store"});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  state.snapshots=Array.isArray(data.snapshots)?data.snapshots:[];
  renderPlayers();
  if(state.selectedSteamId && snapshot())selectPlayer(state.selectedSteamId);
 }catch(e){
  $("inventoryPlayers").innerHTML=`<div class="inv-empty">${esc(e.message||"Impossible de charger les inventaires.")}</div>`;
 }
}

async function createDelivery(){
 const s=snapshot(); if(!s)return;
 const selected=[];
 (s.items||[]).forEach((item,index)=>{if(state.selected.has(keyFor(item,index)))selected.push({className:item.className,name:item.displayName||item.className,quantity:Math.max(1,Number(item.quantity)||1),metadata:{source:"inventory-copy",healthPercent:item.healthPercent}})});
 if(!selected.length)return;
 const title=$("inventoryDeliveryTitle").value.trim(); if(!title){showFeedback("Le titre est obligatoire.","error");return}
 const btn=$("createInventoryDelivery"); btn.disabled=true;
 try{
  const r=await fetch("/api/admin/deliveries",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({steamId:s.steamId,playerName:s.playerName,title,message:$("inventoryDeliveryMessage").value.trim(),items:selected})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
  showFeedback(`Livraison créée avec ${selected.length} ligne(s) d’objet(s).`,"ok");
  state.selected.clear(); renderItems();
 }catch(e){showFeedback(e.message||"Impossible de créer la livraison.","error")}
 finally{btn.disabled=state.selected.size===0}
}

$("refreshInventories").addEventListener("click",load);
$("inventoryPlayerSearch").addEventListener("input",e=>{state.playerFilter=e.target.value;renderPlayers()});
$("inventoryItemSearch").addEventListener("input",e=>{state.itemFilter=e.target.value;renderItems()});
$("selectAllInventory").addEventListener("click",()=>{const s=snapshot();if(!s)return;(s.items||[]).forEach((item,index)=>state.selected.add(keyFor(item,index)));renderItems()});
$("clearInventorySelection").addEventListener("click",()=>{state.selected.clear();renderItems()});
$("createInventoryDelivery").addEventListener("click",createDelivery);
load();
setInterval(load,20000);
