import { apiRequest } from "./api.js";

const byId = (id) => document.getElementById(id);
const isLocalDevHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
let state = { season: null, levels: [], players: [], stats: {}, selectedLevel: null, selectedPlayer: null, pickerTrack: null, pickerTimer: null };

function hidden(el, value) { if (el) el.hidden = value; }
function feedback(el, message = "", status = "") { if (!el) return; el.hidden = !message; el.textContent = message; el.dataset.state = status; }
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function number(value) { return new Intl.NumberFormat("fr-FR").format(Number(value) || 0); }
function localDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle:"medium", timeStyle:"short" }).format(d); }
function datetimeLocal(value) { if (!value) return ""; const d=new Date(value); if(Number.isNaN(d.getTime())) return ""; const pad=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function statusLabel(value) { return ({draft:"BROUILLON",active:"ACTIVE",ended:"TERMINÉE"})[value] || String(value||"—").toUpperCase(); }
function rewardSummary(reward = {}) { const parts=[]; const items=Array.isArray(reward.items)?reward.items:[]; if(items.length) parts.push(`${items.length} objet${items.length>1?"s":""}`); if(Number(reward.roubles)>0) parts.push(`${number(reward.roubles)} ₽`); if(Number(reward.bitcoin)>0) parts.push(`${number(reward.bitcoin)} BTC`); return parts.join(" + ") || "Aucune récompense"; }
function isConfigured(level) { return rewardSummary(level.free_rewards) !== "Aucune récompense" || rewardSummary(level.premium_rewards) !== "Aucune récompense"; }

async function checkAccess() {
  hidden(byId("bpAccessLoading"), false); hidden(byId("bpAccessDenied"), true); hidden(byId("bpAccessError"), true); hidden(byId("bpWorkspace"), true);
  if (isLocalDevHost) {
    hidden(byId("bpAccessLoading"), true);
    hidden(byId("bpWorkspace"), false);
    await loadDashboard();
    return;
  }
  try {
    const response = await fetch("/api/commandement/access", { credentials:"same-origin", cache:"no-store", headers:{Accept:"application/json"} });
    const data = await response.json().catch(()=>({}));
    if (response.status===401 || response.status===403 || data.authorized!==true) { hidden(byId("bpAccessLoading"), true); hidden(byId("bpAccessDenied"), false); return; }
    if(!response.ok) throw new Error(data.error || `Erreur ${response.status}`);
    hidden(byId("bpAccessLoading"), true); hidden(byId("bpWorkspace"), false); await loadDashboard();
  } catch(error) { hidden(byId("bpAccessLoading"), true); hidden(byId("bpAccessError"), false); byId("bpAccessErrorMessage").textContent=error.message; }
}

async function loadDashboard() {
  const data = await apiRequest("/api/admin/battle-pass");
  state.season = data.season || null; state.levels = data.levels || []; state.players = data.players || []; state.stats = data.stats || {};
  renderAll();
}

function renderAll() { renderHeader(); renderLevels(); renderPlayers(); fillSeasonForm(); }
function renderHeader() {
  const s=state.season;
  byId("bpSeasonCode").textContent = s ? `${s.code} // ${statusLabel(s.status)}` : "S01 // PRÉPARATION";
  byId("bpSeasonName").textContent = s?.name || "SAISON 01";
  byId("bpSeasonDescription").textContent = s?.description || "Configure la première saison et ses récompenses.";
  byId("bpSeasonStatus").textContent = statusLabel(s?.status || "draft");
  byId("bpSeasonDates").textContent = s ? `${localDate(s.starts_at)} → ${localDate(s.ends_at)}` : "Dates à définir";
  byId("bpPlayersCount").textContent=number(state.stats.players);
  byId("bpPremiumCount").textContent=number(state.stats.premiumPlayers);
  byId("bpAverageLevel").textContent=Number(state.stats.averageLevel||0).toFixed(1).replace(".0","");
  byId("bpLevelsCount").textContent=number(state.levels.length);
  byId("bpLevelsConfigured").textContent=`${number(state.levels.filter(isConfigured).length)} configuré${state.levels.filter(isConfigured).length>1?"s":""}`;
}
function renderLevels() {
  const box=byId("bpLevelsList"); const q=byId("bpLevelSearch").value.trim(); const f=byId("bpLevelFilter").value;
  let rows=state.levels.filter(l=>!q || String(l.level).includes(q));
  if(f==="configured") rows=rows.filter(isConfigured); if(f==="empty") rows=rows.filter(l=>!isConfigured(l));
  if(!rows.length){ box.innerHTML='<div class="admin-list-message">Aucun palier correspondant.</div>'; return; }
  box.innerHTML=rows.map(l=>`<article class="bp-level-card ${isConfigured(l)?"is-configured":""}"><div class="bp-level-card__number"><small>NIVEAU</small>${l.level}</div><div class="bp-level-card__track"><span>GRATUIT</span><strong>${esc(rewardSummary(l.free_rewards))}</strong></div><div class="bp-level-card__track bp-level-card__track--premium"><span>PREMIUM</span><strong>${esc(rewardSummary(l.premium_rewards))}</strong></div><button class="admin-button admin-button--small" type="button" data-edit-level="${l.id}">Modifier</button></article>`).join("");
}
function renderPlayers() {
  const box=byId("bpPlayersList"); const q=byId("bpPlayerSearch").value.trim().toLowerCase();
  const rows=state.players.filter(p=>!q || String(p.steam_id).includes(q) || String(p.player_name||"").toLowerCase().includes(q));
  if(!rows.length){box.innerHTML='<div class="admin-list-message">Aucun joueur correspondant.</div>';return;}
  box.innerHTML=rows.map(p=>`<article class="bp-player-row"><div><strong>${esc(p.player_name||"Joueur sans pseudo")}</strong><small>${esc(p.steam_id)}</small></div><strong>${number(p.level)}</strong><span>${number(p.xp)} XP</span><span>${p.is_premium?'<i class="bp-premium-badge">PREMIUM</i>':'<i class="bp-free-badge">GRATUIT</i>'}</span><small>${esc(localDate(p.updated_at))}</small><button class="admin-button admin-button--small" type="button" data-edit-player="${p.id}">Gérer</button></article>`).join("");
}
function fillSeasonForm() {
  const s=state.season; if(!s) return;
  byId("bpSeasonFormCode").value=s.code||""; byId("bpSeasonFormName").value=s.name||""; byId("bpSeasonFormStatus").value=s.status||"draft"; byId("bpSeasonFormMaxLevel").value=s.max_level||50; byId("bpSeasonFormXp").value=s.xp_per_level||1000; byId("bpSeasonFormStart").value=datetimeLocal(s.starts_at); byId("bpSeasonFormEnd").value=datetimeLocal(s.ends_at); byId("bpSeasonFormPremium").checked=s.premium_enabled!==false; byId("bpSeasonFormDescription").value=s.description||"";
}
function switchTab(tab){ document.querySelectorAll("[data-bp-tab]").forEach(b=>b.classList.toggle("is-active",b.dataset.bpTab===tab)); document.querySelectorAll("[data-bp-panel]").forEach(p=>p.hidden=p.dataset.bpPanel!==tab); }

async function saveSeason(event){ event.preventDefault(); const el=byId("bpSeasonFeedback"); feedback(el,"Enregistrement…","loading"); try { const body={code:byId("bpSeasonFormCode").value,name:byId("bpSeasonFormName").value,status:byId("bpSeasonFormStatus").value,maxLevel:Number(byId("bpSeasonFormMaxLevel").value),xpPerLevel:Number(byId("bpSeasonFormXp").value),startsAt:byId("bpSeasonFormStart").value||null,endsAt:byId("bpSeasonFormEnd").value||null,premiumEnabled:byId("bpSeasonFormPremium").checked,description:byId("bpSeasonFormDescription").value}; const data=await apiRequest("/api/admin/battle-pass/season",{method:"PUT",body}); state.season=data.season; state.levels=data.levels||state.levels; feedback(el,"Saison enregistrée.","success"); await loadDashboard(); } catch(e){feedback(el,e.message,"error");} }

function rewardRows(track, reward={}) { const items=Array.isArray(reward.items)?reward.items:[]; const target=track==="free"?byId("bpFreeRewards"):byId("bpPremiumRewards"); target.innerHTML=items.map((i,index)=>`<div class="bp-reward-row" data-reward-row="${index}"><input class="bp-reward-class" value="${esc(i.classname)}" readonly><input class="bp-reward-qty" type="number" min="1" max="1000" value="${Number(i.quantity)||1}"><button type="button" data-remove-reward="${index}">×</button></div>`).join("") || '<div class="admin-list-message">Aucun objet.</div>'; }
function openLevel(id){ const l=state.levels.find(x=>x.id===id); if(!l)return; state.selectedLevel=l; byId("bpLevelNumber").textContent=l.level; rewardRows("free",l.free_rewards); rewardRows("premium",l.premium_rewards); byId("bpFreeRoubles").value=Number(l.free_rewards?.roubles)||0; byId("bpFreeBitcoin").value=Number(l.free_rewards?.bitcoin)||0; byId("bpPremiumRoubles").value=Number(l.premium_rewards?.roubles)||0; byId("bpPremiumBitcoin").value=Number(l.premium_rewards?.bitcoin)||0; feedback(byId("bpLevelFeedback")); byId("bpLevelDialog").showModal(); }
function collectReward(track){ const target=track==="free"?byId("bpFreeRewards"):byId("bpPremiumRewards"); const items=[...target.querySelectorAll(".bp-reward-row")].map(r=>({classname:r.querySelector(".bp-reward-class").value,quantity:Number(r.querySelector(".bp-reward-qty").value)||1})); return {items,roubles:Number(track==="free"?byId("bpFreeRoubles").value:byId("bpPremiumRoubles").value)||0,bitcoin:Number(track==="free"?byId("bpFreeBitcoin").value:byId("bpPremiumBitcoin").value)||0}; }
async function saveLevel(event){event.preventDefault(); if(!state.selectedLevel)return; const el=byId("bpLevelFeedback");feedback(el,"Enregistrement…","loading");try{await apiRequest(`/api/admin/battle-pass/levels/${state.selectedLevel.id}`,{method:"PUT",body:{freeRewards:collectReward("free"),premiumRewards:collectReward("premium")}});byId("bpLevelDialog").close();await loadDashboard();}catch(e){feedback(el,e.message,"error");}}

function openPicker(track){
  state.pickerTrack=track;
  const levelDialog=byId("bpLevelDialog");
  state.reopenLevelDialogAsModal=Boolean(levelDialog?.open);

  // Un <dialog>.showModal() est placé dans la top layer du navigateur.
  // Le picker est un overlay classique : même avec un énorme z-index il resterait dessous.
  // On sort temporairement le palier de la top layer avant d'afficher le picker.
  if(state.reopenLevelDialogAsModal){
    levelDialog.close();
    levelDialog.setAttribute("open","");
  }

  byId("bpItemPicker").hidden=false;
  byId("bpItemSearch").value="";
  byId("bpItemResults").innerHTML='<div class="admin-list-message">Commence à taper un classname.</div>';
  setTimeout(()=>byId("bpItemSearch").focus(),0);
}
function closePicker(){
  byId("bpItemPicker").hidden=true;
  state.pickerTrack=null;

  const levelDialog=byId("bpLevelDialog");
  if(state.reopenLevelDialogAsModal && levelDialog){
    levelDialog.removeAttribute("open");
    levelDialog.showModal();
  }
  state.reopenLevelDialogAsModal=false;
}
async function searchItems(){const q=byId("bpItemSearch").value.trim();if(q.length<2){byId("bpItemResults").innerHTML='<div class="admin-list-message">Tape au moins 2 caractères.</div>';return;}try{const data=await apiRequest(`/api/admin/items?q=${encodeURIComponent(q)}&limit=20`);const rows=Array.isArray(data.items)?data.items:[];byId("bpItemResults").innerHTML=rows.length?`<div class="bp-item-results">${rows.map(i=>`<button type="button" class="bp-item-result" data-pick-item="${esc(i.className)}"><span><strong>${esc(i.className)}</strong><small>${esc(i.displayName||i.className)} · ${esc(i.modName||"Source inconnue")}</small></span><em>AJOUTER</em></button>`).join("")}</div>`:'<div class="admin-list-message">Aucun objet trouvé.</div>';}catch(e){byId("bpItemResults").innerHTML=`<div class="admin-list-message">${esc(e.message)}</div>`;}}
function addPickedItem(classname){const target=state.pickerTrack==="free"?byId("bpFreeRewards"):byId("bpPremiumRewards");const empty=target.querySelector(".admin-list-message");if(empty)empty.remove();const row=document.createElement("div");row.className="bp-reward-row";row.innerHTML=`<input class="bp-reward-class" value="${esc(classname)}" readonly><input class="bp-reward-qty" type="number" min="1" max="1000" value="1"><button type="button" data-remove-reward>×</button>`;target.appendChild(row);closePicker();}

function openPlayer(player=null){state.selectedPlayer=player;byId("bpPlayerDialogTitle").textContent=player?"Gérer le joueur":"Ajouter un joueur";byId("bpPlayerSteamId").value=player?.steam_id||"";byId("bpPlayerSteamId").readOnly=Boolean(player);byId("bpPlayerName").value=player?.player_name||"";byId("bpPlayerXp").value=Number(player?.xp)||0;byId("bpPlayerPremium").checked=player?.is_premium===true;feedback(byId("bpPlayerFeedback"));byId("bpPlayerDialog").showModal();}
async function savePlayer(event){event.preventDefault();const el=byId("bpPlayerFeedback");feedback(el,"Enregistrement…","loading");try{const body={steamId:byId("bpPlayerSteamId").value,playerName:byId("bpPlayerName").value,xp:Number(byId("bpPlayerXp").value)||0,isPremium:byId("bpPlayerPremium").checked};if(state.selectedPlayer)await apiRequest(`/api/admin/battle-pass/players/${state.selectedPlayer.id}`,{method:"PUT",body});else await apiRequest("/api/admin/battle-pass/players",{method:"POST",body});byId("bpPlayerDialog").close();await loadDashboard();}catch(e){feedback(el,e.message,"error");}}

function bind(){
  byId("bpRetryAccess").addEventListener("click",checkAccess); byId("bpRefresh").addEventListener("click",loadDashboard); byId("bpSeasonForm").addEventListener("submit",saveSeason); byId("bpLevelSearch").addEventListener("input",renderLevels); byId("bpLevelFilter").addEventListener("change",renderLevels); byId("bpPlayerSearch").addEventListener("input",renderPlayers); byId("bpAddPlayer").addEventListener("click",()=>openPlayer()); byId("bpLevelForm").addEventListener("submit",saveLevel); byId("bpPlayerForm").addEventListener("submit",savePlayer);
  document.querySelectorAll("[data-bp-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.bpTab))); document.querySelectorAll("[data-add-reward]").forEach(b=>b.addEventListener("click",()=>openPicker(b.dataset.addReward))); document.querySelectorAll("[data-close-picker]").forEach(b=>b.addEventListener("click",closePicker)); byId("bpCloseLevel").addEventListener("click",()=>byId("bpLevelDialog").close()); byId("bpCancelLevel").addEventListener("click",()=>byId("bpLevelDialog").close()); byId("bpClosePlayer").addEventListener("click",()=>byId("bpPlayerDialog").close()); byId("bpCancelPlayer").addEventListener("click",()=>byId("bpPlayerDialog").close());
  byId("bpItemSearch").addEventListener("input",()=>{clearTimeout(state.pickerTimer);state.pickerTimer=setTimeout(searchItems,220)});
  document.addEventListener("click",e=>{const level=e.target.closest("[data-edit-level]");if(level)openLevel(level.dataset.editLevel);const player=e.target.closest("[data-edit-player]");if(player)openPlayer(state.players.find(p=>p.id===player.dataset.editPlayer));const picked=e.target.closest("[data-pick-item]");if(picked)addPickedItem(picked.dataset.pickItem);const remove=e.target.closest("[data-remove-reward]");if(remove)remove.closest(".bp-reward-row")?.remove();});
}
bind();checkAccess();
