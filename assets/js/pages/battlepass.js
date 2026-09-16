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
    BurlapSack:{name:"Sac en toile de jute",image:"BurlapSack.png",description:"Objet de récompense du Battle Pass, livré en jeu."},
    Netting:{name:"Filet",image:"Netting.png",description:"Matériau de survie obtenu via la piste FREE."},
    SewingKit:{name:"Kit de couture",image:"SewingKit.png",description:"Matériel de réparation et de fabrication récupérable en jeu."},
    TannedLeather:{name:"Cuir tanné",image:"TannedLeather.png",description:"Matériau de fabrication obtenu comme récompense de palier."},
    Fabric:{name:"Tissu",image:"Fabric.png",description:"Matériau de fabrication obtenu comme récompense de palier."},
    CJ_Materials_bolts:{name:"Boulons",image:"CJ_Materials_bolts.png",description:"Composant CJ Materials livré directement sur le serveur."},
    CJ_Materials_Fuse:{name:"Fusible",image:"CJ_Materials_Fuse.png",description:"Composant CJ Materials livré directement sur le serveur."},
    CJ_Materials_CalibrationTools:{name:"Outils de calibration",image:"CJ_Materials_CalibrationTools.png",description:"Outils CJ Materials obtenus via la progression du Battle Pass."},
    CJ_Materials_Copper:{name:"Cuivre",image:"CJ_Materials_Copper.png",description:"Matériau CJ Materials obtenu comme récompense de palier."},
    BP_Weapon_NecroArcane:{name:"Arme NecroArcane",image:"BP_Weapon_NecroArcane.png",description:"Arme exclusive NecroArcane de la piste Premium."},
    FKM_Case_Nova_Locked:{name:"Caisse de couteau Nova",image:"FKM_Case_Nova_Locked.png",description:"Caisse de couteau verrouillée. Livrée avec un dispositif de déchiffrement."},
    FKM_Decryption_Device:{name:"Clé de déchiffrement",image:"FKM_Decryption_Device.png",description:"Dispositif de déchiffrement livré avec chaque caisse de couteau."},
    BP_Barrel_NecroArcane:{name:"Baril NecroArcane",image:"BP_Barrel_NecroArcane.png",description:"Baril exclusif NecroArcane de la piste Premium."},
    BP_NecroArcane:{name:"Tenue NecroArcane",image:"BP_NecroArcane.png",description:"Tenue exclusive NecroArcane de la piste Premium."},
    BP_SeaChest_NecroArcane:{name:"Sea Chest NecroArcane",image:"BP_SeaChest_NecroArcane.png",description:"Sea Chest exclusif NecroArcane de la piste Premium."},
    BP_Crate_NecroArcane:{name:"Wooden Crate NecroArcane",image:"BP_Crate_NecroArcane.png",description:"Caisse en bois exclusive NecroArcane de la piste Premium."},
    Storm2:{name:"NBC Storm2",image:"Storm2.png",description:"Tenue NBC Storm2 exclusive du niveau 50 Premium."},
    TWXToken_Couteau:{name:"Token Couteau",image:"TWXToken_Couteau.png",description:"Token Premium échangeable selon le système de récompenses Senzany."},
    TWXToken_Baril:{name:"Token Baril",image:"TWXToken_Baril.png",description:"Token Premium échangeable selon le système de récompenses Senzany."},
    TWXToken_Crate:{name:"Token Caisse",image:"TWXToken_Crate.png",description:"Token Premium échangeable selon le système de récompenses Senzany."},
    TWXToken_SeaChest:{name:"Token SeaChest",image:"TWXToken_SeaChest.png",description:"Token Premium échangeable selon le système de récompenses Senzany."},
    TWXToken_Gold:{name:"Token Gold",image:"TWXToken_Gold.png",description:"Token Premium rare obtenu sur certains paliers de saison."},
    TWXToken_Arme:{name:"Token Arme",image:"TWXToken_Arme.png",description:"Token Premium permettant d'obtenir une récompense arme."},
    TWXToken_Vetement:{name:"Token Vêtement",image:"TWXToken_Vetement.png",description:"Token Premium permettant d'obtenir une récompense vêtement."},
    CJ_Materials_Conden:{name:"Condensateurs",image:"CJ_Materials_Conden.png",description:"Composants CJ Materials obtenus via le Battle Pass."},
    CJ_Materials_nuts:{name:"Écrous",image:"CJ_Materials_nuts.png",description:"Composants CJ Materials obtenus via le Battle Pass."},
    CJ_Materials_threads:{name:"Fil",image:"CJ_Materials_threads.png",description:"Composant textile CJ Materials obtenu via le Battle Pass."},
    CJ_Materials_Fabric_Green:{name:"Tissu vert",image:"CJ_Materials_Fabric_Green.png",description:"Matériau textile CJ Materials obtenu via le Battle Pass."},
    CJ_Materials_Fabric_Reinforced:{name:"Tissu renforcé",image:"CJ_Materials_Fabric_Reinforced.png",description:"Matériau textile renforcé obtenu via le Battle Pass."},
    CJ_Materials_Fabric_Black:{name:"Tissu noir",image:"CJ_Materials_Fabric_Black.png",description:"Matériau textile obtenu via le Battle Pass."},
    CJ_Materials_Fabric_Simple:{name:"Tissu simple",image:"CJ_Materials_Fabric_Simple.png",description:"Matériau textile obtenu via le Battle Pass."},
    CJ_Materials_Fabric_Camouflage:{name:"Tissu camouflage",image:"CJ_Materials_Fabric_Camouflage.png",description:"Matériau textile camouflage obtenu via le Battle Pass."},
    CJ_Materials_Scrap:{name:"Ferraille",image:"CJ_Materials_Scrap.png",description:"Matériau de récupération CJ Materials obtenu via le Battle Pass."},
    CJ_Materials_magnet:{name:"Aimant",image:"CJ_Materials_magnet.png",description:"Composant CJ Materials obtenu via le Battle Pass."},
    CJ_Materials_plastic:{name:"Plastique",image:"CJ_Materials_plastic.png",description:"Matériau CJ Materials obtenu via le Battle Pass."},
    CJ_Materials_winch:{name:"Treuil",image:"CJ_Materials_winch.png",description:"Composant CJ Materials obtenu via le Battle Pass."}
  };

  function itemInfo(classname) {
    if (ITEM_CATALOG[classname]) return ITEM_CATALOG[classname];
    const plate = String(classname).match(/^CJ_Materials_plate(\d+)?$/i);
    if (plate) {
      const suffix = plate[1] || "";
      return {name:`Plaque ${suffix || "métallique"}`.trim(),image:suffix && ["2","3","4","5","6","8"].includes(suffix)?`CJ_Materials_plate${suffix}.png`:"CJ_Materials_plate_generic.png",description:"Plaque CJ Materials obtenue via le Battle Pass."};
    }
    if (/^CJ_Materials_Fabric/i.test(classname)) return {name:classname.replace(/^CJ_Materials_/i,"").replace(/_/g," "),image:"Fabric.png",description:"Matériau textile CJ Materials obtenu via le Battle Pass."};
    if (/^CJ_Materials_threads/i.test(classname)) return {name:"Fil",image:"CJ_Materials_threads.png",description:"Composant textile obtenu via le Battle Pass."};
    if (/^CJ_Materials_Scrap/i.test(classname)) return {name:"Ferraille",image:"CJ_Materials_Scrap.png",description:"Matériau de récupération obtenu via le Battle Pass."};
    if (/^CJ_Materials_magnet/i.test(classname)) return {name:"Aimant",image:"CJ_Materials_magnet.png",description:"Composant CJ Materials obtenu via le Battle Pass."};
    if (/^CJ_Materials_plastic/i.test(classname)) return {name:"Plastique",image:"CJ_Materials_plastic.png",description:"Matériau CJ Materials obtenu via le Battle Pass."};
    if (/^CJ_Materials_winch/i.test(classname)) return {name:"Treuil",image:"CJ_Materials_winch.png",description:"Composant CJ Materials obtenu via le Battle Pass."};
    return {name:classname.replace(/_/g," "),image:"SenzanyReward.png",description:"Récompense Battle Pass récupérable en jeu."};
  }

  function rewardRows(rewards) {
    const payload = rewards && typeof rewards === "object" ? rewards : {};
    const rows = [];
    (Array.isArray(payload.items) ? payload.items : []).forEach(item => {
      const classname = String(item?.classname || "").trim(); if (!classname) return;
      const info = itemInfo(classname);
      rows.push({classname,label:info.name,image:info.image,description:info.description,value:`×${Math.max(1,Number(item?.quantity)||1)}`});
    });
    if (Number(payload.roubles)>0) rows.push({classname:"roubles",label:"Roubles",image:null,description:"Crédit de monnaie en jeu associé à ce palier.",value:number(payload.roubles)});
    if (Number(payload.bitcoin)>0) rows.push({classname:"bitcoin",label:"Bitcoin",image:null,description:"Récompense monétaire associée à ce palier.",value:number(payload.bitcoin)});
    return rows;
  }

  function rewardCell(rewards, locked, type, level) {
    const rows = rewardRows(rewards);
    if (!rows.length) return `<div class="bp-reward-cell bp-reward-cell--${type} is-empty${locked?" is-locked":""}" data-level="${level}"><span>—</span></div>`;
    return `<div class="bp-reward-cell bp-reward-cell--${type}${locked?" is-locked":""}" data-level="${level}">
      <div class="bp-reward-icons">${rows.slice(0,4).map((row,index) => `<button class="bp-item" type="button"
        data-track="${type}" data-level="${level}" data-label="${escapeHtml(row.label)}" data-classname="${escapeHtml(row.classname)}"
        data-description="${escapeHtml(row.description)}" data-qty="${escapeHtml(row.value)}" data-image="${escapeHtml(row.image||"")}" aria-label="${escapeHtml(row.label)} ${escapeHtml(row.value)}">
        ${row.image?`<img src="assets/images/battlepass/items/${escapeHtml(row.image)}?v=3" alt="${escapeHtml(row.label)}" loading="lazy">`:`<img src="assets/images/battlepass/items/SenzanyReward.png" alt="${escapeHtml(row.label)}" loading="lazy">`}
        <span class="bp-item__name">${escapeHtml(row.label)}</span>
        <b>${escapeHtml(row.value)}</b>
        <i class="bp-item__shine" aria-hidden="true"></i>
      </button>`).join("")}</div>
      ${locked?'<span class="bp-lock">LOCK</span>':''}
    </div>`;
  }

  function selectItem(item) {
    if (!item) return;
    const track=(item.dataset.track||"free").toUpperCase();
    text("bpInspectTrack", track);
    text("bpInspectLevel", `NIVEAU ${String(item.dataset.level||"—").padStart(2,"0")}`);
    text("bpInspectName", item.dataset.label||"Récompense");
    text("bpInspectDescription", item.dataset.description||"Récompense Battle Pass récupérable en jeu.");
    text("bpInspectClassname", `Classname : ${item.dataset.classname||"—"}`);
    text("bpInspectQty", item.dataset.qty||"—");
    const visual=$("bpInspectVisual");
    if (visual) {
      const image=item.dataset.image;
      visual.classList.toggle("is-premium", item.dataset.track==="premium");
      visual.innerHTML=`<img src="assets/images/battlepass/items/${escapeHtml(image||"SenzanyReward.png")}?v=3" alt="">`;
    }
    document.querySelectorAll(".bp-item.is-selected").forEach(el=>el.classList.remove("is-selected"));
    item.classList.add("is-selected");
  }

  function bindItemInspector() {
    const items=[...document.querySelectorAll(".bp-item")];
    items.forEach(item=>{
      item.addEventListener("mouseenter",()=>selectItem(item));
      item.addEventListener("focus",()=>selectItem(item));
      item.addEventListener("click",()=>selectItem(item));
    });
    const currentLevel=Number($("bpCurrentLevel")?.textContent||1);
    const preferred=document.querySelector(`.bp-reward-cell[data-level="${currentLevel}"] .bp-item`) || items[0];
    if (preferred) selectItem(preferred);
  }

  function renderLevels(data) {
    const grid = $("bpLevelsGrid"); if (!grid) return;
    const progress = data.progress || {}, season = data.season || {};
    const current = Math.max(1, Number(progress.level)||1), isPremium = progress.is_premium===true;
    const levels = (Array.isArray(data.levels)?data.levels:[]).filter(l => Number(l.level)<=50);

    const headers = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current, currentClass=n===current?" is-current":"", unlockedClass=unlocked?" is-unlocked":" is-locked";
      return `<div class="bp-level-node${currentClass}${unlockedClass}" data-level="${n}"><strong>${String(n).padStart(2,"0")}</strong><small>${number(level.xp_required)} XP</small><i aria-hidden="true"></i></div>`;
    }).join("");

    const premium = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current, locked=!season.premium_enabled || !isPremium || !unlocked;
      return rewardCell(level.premium_rewards, locked, "premium", n);
    }).join("");

    const free = levels.map(level => {
      const n=Number(level.level)||1, unlocked=n<=current;
      return rewardCell(level.free_rewards, !unlocked, "free", n);
    }).join("");

    grid.innerHTML = `<div class="bp-level-row">${headers}</div><div class="bp-reward-row bp-reward-row--premium">${premium}</div><div class="bp-xp-rail" aria-hidden="true"><i></i></div><div class="bp-reward-row bp-reward-row--free">${free}</div>`;

    requestAnimationFrame(() => {
      const scroll=$("bpTrackScroll"), node=grid.querySelector('.bp-level-node.is-current');
      if (scroll && node) scroll.scrollLeft=Math.max(0,node.offsetLeft-scroll.clientWidth/2+node.clientWidth/2);
      bindItemInspector();
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
    const premiumButton=$("bpPremiumButton");
    if (premiumButton) {
      premiumButton.hidden = false;
      premiumButton.innerHTML = premium
        ? 'VOIR / GÉRER MON ABONNEMENT <span>↗</span>'
        : "S'ABONNER AU PASS PREMIUM <span>↗</span>";
    }

    const sidebarPremiumButton=$("bpSidebarPremiumButton");
    if (sidebarPremiumButton) {
      sidebarPremiumButton.hidden = false;
      sidebarPremiumButton.innerHTML = premium
        ? 'GÉRER LE PREMIUM <span>↗</span>'
        : 'PASS PREMIUM <span>↗</span>';
    }

    const cta=$("bpPremiumCta");
    if (cta&&premium){
      cta.classList.add("is-owned");
      const h=cta.querySelector("h2"),p=cta.querySelector("p");
      if(h)h.textContent="PASS PREMIUM ACTIF";
      if(p)p.textContent="Ton accès Premium est synchronisé. Tu peux consulter ou gérer ton abonnement depuis la boutique.";
    }
    renderLevels(data); show("content");
  }

  function setupTrackControls(){
    const scroll=$("bpTrackScroll"); if(!scroll)return;
    $("bpPrev")?.addEventListener("click",()=>scroll.scrollBy({left:-650,behavior:"smooth"}));
    $("bpNext")?.addEventListener("click",()=>scroll.scrollBy({left:650,behavior:"smooth"}));
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
