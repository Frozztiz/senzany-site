(() => {
  const $ = (id) => document.getElementById(id);
  const state = { loading: $("bpLoading"), loggedOut: $("bpLoggedOut"), content: $("bpContent"), error: $("bpError") };

  function show(name) { Object.entries(state).forEach(([key, el]) => { if (el) el.hidden = key !== name; }); }
  function text(id, value) { const el = $(id); if (el) el.textContent = value; }
  function number(value) { return new Intl.NumberFormat("fr-FR").format(Number(value) || 0); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c]); }
  function formatDate(value) {
    if (!value) return "NON DÉFINIE";
    const date = new Date(value); if (Number.isNaN(date.getTime())) return "NON DÉFINIE";
    return new Intl.DateTimeFormat("fr-FR", { day:"2-digit", month:"short", year:"numeric" }).format(date).replace(".", "").toUpperCase();
  }
  function seasonStatus(value) { return ({active:"ACTIVE",draft:"PRÉPARATION",ended:"TERMINÉE"})[value] || String(value || "—").toUpperCase(); }

  const ITEM_CATALOG = {
    BurlapSack:{name:"Sac en toile de jute",image:"BurlapSack.png"}, Netting:{name:"Filet",image:"Netting.png"},
    SewingKit:{name:"Kit de couture",image:"SewingKit.png"}, TannedLeather:{name:"Cuir tanné",image:"TannedLeather.png"},
    Fabric:{name:"Tissu",image:"Fabric.png"}, CJ_Materials_bolts:{name:"Boulons",image:"CJ_Materials_bolts.png"},
    CJ_Materials_Fuse:{name:"Fusible",image:"CJ_Materials_Fuse.png"}, CJ_Materials_CalibrationTools:{name:"Outils de calibration",image:"CJ_Materials_CalibrationTools.png"},
    CJ_Materials_Copper:{name:"Cuivre",image:"CJ_Materials_Copper.png"}, TWXToken_Couteau:{name:"Token Couteau",image:"TWXToken_Couteau.png"},
    TWXToken_Baril:{name:"Token Baril",image:"TWXToken_Baril.png"}, TWXToken_Crate:{name:"Token Caisse",image:"TWXToken_Crate.png"},
    TWXToken_SeaChest:{name:"Token SeaChest",image:"TWXToken_SeaChest.png"}, TWXToken_Gold:{name:"Token Gold",image:"TWXToken_Gold.png"}
  };

  function itemInfo(classname) {
    if (ITEM_CATALOG[classname]) return ITEM_CATALOG[classname];
    if (/^CJ_Materials_plate/i.test(classname)) return {name:classname.replace(/^CJ_Materials_/,"").replace(/_/g," "),image:"CJ_Materials_plate_generic.png"};
    if (/^CJ_Materials_Fabric/i.test(classname)) return {name:classname.replace(/^CJ_Materials_/,"").replace(/_/g," "),image:"Fabric.png"};
    if (/^CJ_Materials_threads/i.test(classname)) return {name:"Fil",image:"SewingKit.png"};
    if (/^CJ_Materials_Scrap/i.test(classname)) return {name:"Ferraille",image:"CJ_Materials_bolts.png"};
    if (/^CJ_Materials_magnet/i.test(classname)) return {name:"Aimant",image:"CJ_Materials_plate_generic.png"};
    if (/^CJ_Materials_plastic/i.test(classname)) return {name:"Plastique",image:"CJ_Materials_plate_generic.png"};
    return {name:classname.replace(/_/g," "),image:null};
  }

  function rewardRows(rewards) {
    const payload = rewards && typeof rewards === "object" ? rewards : {};
    const rows = [];
    (Array.isArray(payload.items) ? payload.items : []).forEach(item => {
      const classname = String(item?.classname || "").trim(); if (!classname) return;
      const info = itemInfo(classname);
      rows.push({classname,label:info.name,image:info.image,value:`×${Math.max(1,Number(item?.quantity)||1)}`});
    });
    if (Number(payload.roubles)>0) rows.push({classname:"roubles",label:"Roubles",image:null,value:number(payload.roubles)});
    if (Number(payload.bitcoin)>0) rows.push({classname:"bitcoin",label:"Bitcoin",image:null,value:number(payload.bitcoin)});
    return rows;
  }

  function rewardCell(rewards, locked, type, level) {
    const rows = rewardRows(rewards);
    if (!rows.length) return `<div class="bp-reward-cell bp-reward-cell--${type} is-empty${locked?" is-locked":""}" data-level="${level}"><span>—</span></div>`;
    return `<div class="bp-reward-cell bp-reward-cell--${type}${locked?" is-locked":""}" data-level="${level}">
      <div class="bp-reward-icons">${rows.slice(0,4).map(row => `<div class="bp-item" title="${escapeHtml(row.label)} — ${escapeHtml(row.classname)}">
        ${row.image?`<img src="assets/images/battlepass/items/${escapeHtml(row.image)}" alt="${escapeHtml(row.label)}" loading="lazy">`:`<span class="bp-item__fallback">?</span>`}
        <b>${escapeHtml(row.value)}</b>
      </div>`).join("")}</div>
      ${locked?'<span class="bp-lock">LOCK</span>':''}
    </div>`;
  }

  function renderLevels(data) {
    const grid = $("bpLevelsGrid"); if (!grid) return;
    const progress = data.progress || {}, season = data.season || {};
    const current = Math.max(1, Number(progress.level)||1), isPremium = progress.is_premium===true;
    const levels = (Array.isArray(data.levels)?data.levels:[]).filter(l => Number(l.level)<=50);

    const headers = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current, currentClass=n===current?" is-current":"", unlockedClass=unlocked?" is-unlocked":" is-locked";
      return `<div class="bp-level-node${currentClass}${unlockedClass}" data-level="${n}"><strong>${String(n).padStart(2,"0")}</strong><small>${number(level.xp_required)} XP</small></div>`;
    }).join("");

    const premium = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current, locked=!season.premium_enabled || !isPremium || !unlocked;
      return rewardCell(level.premium_rewards, locked, "premium", n);
    }).join("");

    const free = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current;
      return rewardCell(level.free_rewards, !unlocked, "free", n);
    }).join("");

    grid.innerHTML = `<div class="bp-level-row">${headers}</div><div class="bp-reward-row bp-reward-row--premium">${premium}</div><div class="bp-reward-row bp-reward-row--free">${free}</div>`;

    requestAnimationFrame(() => {
      const scroll=$("bpTrackScroll"), node=grid.querySelector('.bp-level-node.is-current');
      if (scroll && node) scroll.scrollLeft=Math.max(0,node.offsetLeft-scroll.clientWidth/2+node.clientWidth/2);
    });
  }

  function render(data, steam) {
    if (!data?.season) throw new Error("Aucune saison Battle Pass n’est actuellement configurée.");
    const season=data.season, progress=data.progress||{xp:0,level:1,is_premium:false,xp_in_level:0,xp_to_next:season.xp_per_level};
    const level=Math.max(1,Number(progress.level)||1), maxLevel=Math.max(1,Number(season.max_level)||50), xpPerLevel=Math.max(1,Number(season.xp_per_level)||1000), xpInLevel=Math.max(0,Number(progress.xp_in_level)||0), isMax=level>=maxLevel, premium=progress.is_premium===true;
    const percent=isMax?100:Math.max(0,Math.min(100,Math.round((xpInLevel/xpPerLevel)*100)));

    text("bpSeasonCode",season.code||"SAISON"); text("bpSeasonName",season.name||"Battle Pass Senzany");
    text("bpSeasonStart",formatDate(season.starts_at)); text("bpSeasonEnd",formatDate(season.ends_at)); text("bpSeasonStatus",seasonStatus(season.status));
    const avatar=$("bpAvatar"); if (avatar&&steam?.avatar) avatar.src=steam.avatar;
    text("bpPlayerName",steam?.name||progress.player_name||"Survivant"); text("bpSteamId",`SteamID64 // ${steam?.steamId||progress.steam_id||"—"}`);
    text("bpCurrentLevel",level); text("bpMaxLevel",`/ ${maxLevel}`); text("bpTotalXp",`XP TOTAL // ${number(progress.xp)}`);
    text("bpXpText",isMax?"NIVEAU MAXIMUM":`${number(xpInLevel)} / ${number(xpPerLevel)} XP`); text("bpXpPercent",`${percent}%`);
    const bar=$("bpProgressBar"); if (bar) bar.style.width=`${percent}%`;
    text("bpNextLevel",isMax?"NIVEAU MAXIMUM":`NIVEAU ${Math.min(maxLevel,level+1)}`); text("bpNextXp",isMax?"Progression de saison complétée":`${number(Math.max(0,xpPerLevel-xpInLevel))} XP restantes`);
    const badge=$("bpPremiumBadge"); if (badge){badge.textContent=premium?"PREMIUM":"FREE";badge.classList.toggle("is-premium",premium);}
    const premiumButton=$("bpPremiumButton"); if (premiumButton) premiumButton.hidden=premium;
    const cta=$("bpPremiumCta"); if (cta&&premium){cta.classList.add("is-owned"); const h=cta.querySelector("h2"),p=cta.querySelector("p"); if(h)h.textContent="PASS PREMIUM ACTIF"; if(p)p.textContent="Ton accès Premium est synchronisé. Les paliers Premium atteints sont accessibles depuis le Battle Pass en jeu.";}
    renderLevels(data); show("content");
  }

  function setupTrackControls(){
    const scroll=$("bpTrackScroll"); if(!scroll)return;
    $("bpPrev")?.addEventListener("click",()=>scroll.scrollBy({left:-520,behavior:"smooth"}));
    $("bpNext")?.addEventListener("click",()=>scroll.scrollBy({left:520,behavior:"smooth"}));
    scroll.addEventListener("wheel",e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();scroll.scrollLeft+=e.deltaY;}},{passive:false});
  }

  async function load(){
    show("loading");
    try{
      const steam=await window.SenzanyAPI.steam.getMe(); if(!steam?.loggedIn){show("loggedOut");return;}
      const battlePass=await window.SenzanyAPI.battlePass.getMe(); render(battlePass,steam);
    }catch(error){ if(error?.status===401){show("loggedOut");return;} text("bpErrorText",error?.message||"Impossible de récupérer les données pour le moment.");show("error");console.error("[BATTLE PASS PAGE]",error); }
  }

  $("bpRetry")?.addEventListener("click",load); setupTrackControls(); load();
})();
