(function () {
  const boot=document.getElementById("terminalBoot"),bootLine=document.getElementById("bootLine");
  const bootSteps=["VÉRIFICATION DU RÉSEAU...","CHARGEMENT DE L’IDENTITÉ...","SYNCHRONISATION DES MODULES...","ACCÈS AUTORISÉ"];
  let bootIndex=0;
  const bootTimer=setInterval(()=>{bootIndex++;if(bootLine&&bootSteps[bootIndex])bootLine.textContent=bootSteps[bootIndex];if(bootIndex>=bootSteps.length-1){clearInterval(bootTimer);setTimeout(()=>boot&&boot.classList.add("is-hidden"),280)}},260);
  setTimeout(()=>boot&&boot.classList.add("is-hidden"),1550);
  function appendLog(text,delay=0){const log=document.getElementById("liveLog");if(!log)return;setTimeout(()=>{const item=document.createElement("span");const now=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());item.innerHTML=`<time>[${now}]</time>${text}`;log.appendChild(item)},delay)}
  function animateNumber(el,target){const value=Number(target);if(!el||!Number.isFinite(value))return;const start=performance.now(),duration=900;function frame(now){const p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3);el.textContent=formatHours(value*e);if(p<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)}
  const personaStates = {0:"Hors ligne",1:"En ligne",2:"Occupé",3:"Absent",4:"En pause",5:"Recherche une partie",6:"Recherche un échange"};
  const loading=document.getElementById("profileLoading"),loggedOut=document.getElementById("loggedOutView"),loggedIn=document.getElementById("loggedInView");
  function reveal(view){loading.hidden=true;loggedOut.hidden=view!=="out";loggedIn.hidden=view!=="in"}
  function formatLastActivity(ts){if(!ts)return"Non communiquée";return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(ts*1000))}
  function formatHours(v){return new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(v)}
  function renderDayz(dayz){const hours=document.getElementById("dayzHours"),summary=document.getElementById("dayzHoursSummary"),explanation=document.getElementById("dayzExplanation"),state=document.getElementById("dayzState"),bar=document.getElementById("dayzMetricBar");state.classList.remove("panel-state--online","panel-state--pending");if(dayz&&dayz.available){const formatted=formatHours(dayz.hours);animateNumber(hours,dayz.hours);summary.textContent=formatted+" h";const quickHours=document.getElementById("quickHours");if(quickHours)quickHours.textContent=formatted+" H";explanation.textContent="Temps de jeu total enregistré par Steam pour DayZ.";state.textContent="Donnée publique";state.classList.add("panel-state--online");requestAnimationFrame(()=>{bar.style.width=Math.min(100,Math.max(12,(Number(dayz.hours)||0)/20))+"%"});return}hours.textContent="Privé";summary.textContent="Indisponible";state.textContent="Indisponible";state.classList.add("panel-state--pending");explanation.textContent=dayz&&dayz.reason==="not_found"?"DayZ n’apparaît pas dans les jeux visibles de ce compte.":"Cette donnée Steam est privée ou indisponible."}
  function updateDiscordService(linked){
    const row=document.getElementById("discordServiceRow"),dot=row?.querySelector(".system-dot"),text=document.getElementById("discordServiceText"),state=document.getElementById("discordServiceState"),header=document.getElementById("discordHeaderState"),quick=document.getElementById("quickDiscord");
    if(linked){
      dot?.classList.add("system-dot--online");
      if(text)text.textContent="Compte et rôles synchronisés";
      if(state)state.textContent="ONLINE";
      if(header){header.textContent="● DISCORD ASSOCIÉ";header.classList.add("chip--ok")}
      if(quick)quick.textContent="ONLINE";
    }else{
      dot?.classList.remove("system-dot--online");
      if(text)text.textContent="Association en attente";
      if(state)state.textContent="EN ATTENTE";
      if(header){header.textContent="● DISCORD EN ATTENTE";header.classList.remove("chip--ok")}
      if(quick)quick.textContent="EN ATTENTE";
    }
  }
  function renderDiscord(discord){const state=document.getElementById("discordState"),unlinked=document.getElementById("discordUnlinked"),linked=document.getElementById("discordLinked"),linkButton=document.getElementById("discordLinkButton"),unlinkButtons=document.querySelectorAll(".js-discord-unlink"),rolesBox=document.getElementById("discordRoles");state.classList.remove("panel-state--online","panel-state--pending");if(discord&&discord.linked){state.textContent="Associé";state.classList.add("panel-state--online");unlinked.hidden=true;linked.hidden=false;linkButton.hidden=true;unlinkButtons.forEach(button=>button.hidden=false);document.getElementById("discordUsername").textContent=discord.username||"Compte Discord";document.getElementById("discordId").textContent=discord.id||"—";const avatar=document.getElementById("discordAvatar");if(discord.avatar){avatar.src=discord.avatar;avatar.hidden=false}else avatar.hidden=true;const list=document.getElementById("discordRolesList"),empty=document.getElementById("discordRolesEmpty");list.innerHTML="";if(discord.rolesAvailable){rolesBox.hidden=false;const roles=Array.isArray(discord.roles)?discord.roles:[];empty.hidden=roles.length>0;roles.slice(0,6).forEach(role=>{const badge=document.createElement("span");badge.className="discord-role-badge";badge.textContent=role.name;list.appendChild(badge)});if(roles.length>6){const more=document.createElement("span");more.className="discord-role-badge";more.textContent="+ "+(roles.length-6);list.appendChild(more)}}else rolesBox.hidden=true;updateDiscordService(true);return}state.textContent="Non associé";state.classList.add("panel-state--pending");unlinked.hidden=false;linked.hidden=true;rolesBox.hidden=true;linkButton.hidden=false;unlinkButtons.forEach(button=>button.hidden=true);updateDiscordService(false)}
  function showDiscordFeedback(){const code=new URLSearchParams(location.search).get("discord");if(!code)return;const messages={linked:"Compte Discord associé avec succès.",cancelled:"Association Discord annulée.",already_linked:"Ce compte Discord est déjà lié à un autre compte Steam.",steam_required:"Reconnecte-toi à Steam avant d’associer Discord.",invalid_state:"La demande a expiré. Recommence.",invalid_callback:"Réponse Discord invalide.",token_error:"Discord n’a pas finalisé l’autorisation.",user_error:"Impossible de lire le profil Discord.",server_error:"Impossible d’enregistrer l’association."};const feedback=document.getElementById("discordFeedback");feedback.textContent=messages[code]||"État Discord mis à jour.";feedback.hidden=false;feedback.classList.toggle("discord-feedback--error",code!=="linked");history.replaceState({},document.title,location.pathname)}
  function updateTerminalTime(){const target=document.getElementById("terminalUpdatedAt");if(!target)return;const now=new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(new Date());target.textContent="MISE À JOUR — "+now}

  let voteAliasesLimit=20;
  let voteAliasDetails=new Map();
  let previousVoteTotal=null;
  let previousAliasVotes=new Map();

  function setVoteSyncState(type,label){
    const state=document.getElementById("voteAliasesSyncState");
    if(!state)return;
    state.className=`vote-alias-sync-state vote-alias-sync-state--${type}`;
    state.textContent=label;
  }

  function setVoteLastSync(date=new Date()){
    const target=document.getElementById("voteAliasesLastSync");
    if(!target)return;
    const formatted=new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);
    target.textContent=`DERNIÈRE SYNCHRONISATION ${formatted}`;
  }


  function showVoteAliasFeedback(message,isError=false){
    const feedback=document.getElementById("voteAliasFeedback");
    if(!feedback)return;
    feedback.textContent=message;
    feedback.hidden=false;
    feedback.classList.toggle("vote-alias-feedback--error",isError);
  }

  function renderVoteAliases(aliases){
    const list=document.getElementById("voteAliasesList"),counter=document.getElementById("voteAliasesCounter"),input=document.getElementById("voteAliasInput"),button=document.getElementById("voteAliasAddButton");
    if(!list||!counter)return;
    const safeAliases=Array.isArray(aliases)?[...aliases]:[];
    safeAliases.sort((a,b)=>{
      const detailA=voteAliasDetails.get(String(a.alias||"").toLowerCase())||{};
      const detailB=voteAliasDetails.get(String(b.alias||"").toLowerCase())||{};
      if(Boolean(detailA.found)!==Boolean(detailB.found))return detailA.found?-1:1;
      const voteDifference=Number(detailB.votes||0)-Number(detailA.votes||0);
      if(voteDifference!==0)return voteDifference;
      return String(a.alias||"").localeCompare(String(b.alias||""),"fr",{sensitivity:"base"});
    });
    counter.textContent=`${safeAliases.length} / ${voteAliasesLimit}`;
    list.innerHTML="";
    if(input)input.disabled=safeAliases.length>=voteAliasesLimit;
    if(button)button.disabled=safeAliases.length>=voteAliasesLimit;
    if(safeAliases.length===0){
      const empty=document.createElement("p");
      empty.className="vote-alias-empty";
      empty.textContent="Aucun pseudo enregistré. Ajoute tous les noms avec lesquels tu votes sur Top-Serveurs.";
      list.appendChild(empty);
      return;
    }
    safeAliases.forEach(entry=>{
      const detail=voteAliasDetails.get(String(entry.alias||"").toLowerCase())||null;
      const row=document.createElement("div");
      row.className=`vote-alias-item ${detail?.found?"vote-alias-item--found":"vote-alias-item--missing"}`;

      const identity=document.createElement("div");
      identity.className="vote-alias-item__identity";
      const name=document.createElement("strong");
      name.textContent=entry.alias;
      const meta=document.createElement("small");
      const metaParts=[];
      if(detail?.found&&detail.matchedName){
        metaParts.push(`RETROUVÉ COMME ${detail.matchedName}`);
        if(detail.position)metaParts.push(`CLASSEMENT #${detail.position}`);
      }else if(detail){
        metaParts.push("PSEUDO NON RETROUVÉ DANS LE CLASSEMENT ACTUEL");
      }else{
        metaParts.push("VÉRIFICATION EN COURS…");
      }
      meta.textContent=metaParts.join(" // ");
      identity.append(name,meta);

      const stats=document.createElement("div");
      stats.className="vote-alias-item__stats";
      const votes=document.createElement("strong");
      const currentVotes=detail?Number(detail.votes||0):0;
      votes.textContent=detail?currentVotes.toLocaleString("fr-FR"):"—";
      const previousVotes=previousAliasVotes.get(String(entry.alias||"").toLowerCase());
      if(previousVotes!==undefined&&currentVotes>previousVotes)votes.classList.add("vote-alias-pulse");
      votes.setAttribute("aria-label",`${Number(detail?.votes||0)} vote${Number(detail?.votes||0)>1?"s":""}`);
      const votesLabel=document.createElement("small");
      votesLabel.className="vote-alias-item__votes-label";
      votesLabel.textContent=`VOTE${Number(detail?.votes||0)>1?"S":""}`;
      const voteBlock=document.createElement("div");
      voteBlock.className="vote-alias-item__vote-block";
      voteBlock.append(votes,votesLabel);
      const status=document.createElement("span");
      status.className=`vote-alias-status ${detail?.found?"vote-alias-status--found":"vote-alias-status--missing"}`;
      status.textContent=detail?detail.found?"Trouvé":"Non trouvé":"Vérification…";
      stats.append(voteBlock,status);

      const remove=document.createElement("button");
      remove.className="vote-alias-remove";
      remove.type="button";
      remove.textContent="Supprimer";
      remove.addEventListener("click",async()=>{
        if(!confirm(`Supprimer le pseudo « ${entry.alias} » ?`))return;
        remove.disabled=true;
        remove.textContent="Suppression…";
        try{
          await window.SenzanyAPI.topServeurs.deleteVoteAlias(entry.id);
          showVoteAliasFeedback(`Le pseudo « ${entry.alias} » a été supprimé.`);
          await refreshVoteAliasesAndTotal();
        }catch(error){
          showVoteAliasFeedback(error.message||"Impossible de supprimer ce pseudo.",true);
          remove.disabled=false;
          remove.textContent="Supprimer";
        }
      });
      const details=document.createElement("div");
      details.className="vote-alias-item__details";
      const detailValues=[
        ["PSEUDO ENREGISTRÉ",entry.alias||"—"],
        ["PSEUDO RETROUVÉ",detail?.matchedName||"Non retrouvé"],
        ["VOTES DU MOIS",detail?String(Number(detail.votes||0)):"—"],
        ["CLASSEMENT",detail?.position?`#${detail.position}`:"—"]
      ];
      detailValues.forEach(([label,value])=>{
        const block=document.createElement("div");block.className="vote-alias-detail";
        const caption=document.createElement("span");caption.textContent=label;
        const content=document.createElement("strong");content.textContent=value;
        block.append(caption,content);details.appendChild(block);
      });
      row.addEventListener("click",event=>{
        if(event.target.closest("button"))return;
        row.classList.toggle("is-open");
      });
      row.append(identity,stats,remove,details);
      list.appendChild(row);
      previousAliasVotes.set(String(entry.alias||"").toLowerCase(),currentVotes);
    });
  }


  function formatMoney(value){return new Intl.NumberFormat("fr-FR").format(Math.max(0,Number(value)||0))+" $"}
  function renderVoteWallet(wallet){
    if(!wallet)return;
    const balance=document.getElementById("voteWalletBalance"),rate=document.getElementById("voteWalletRate"),next=document.getElementById("voteWalletNext"),bar=document.getElementById("voteWalletProgressBar"),text=document.getElementById("voteWalletProgressText"),milestones=document.getElementById("voteMilestones"),claim=document.getElementById("voteWalletClaim");
    if(balance)balance.textContent=formatMoney(wallet.balance);
    const heroWallet=document.getElementById("heroWalletValue");if(heroWallet)heroWallet.textContent=formatMoney(wallet.balance);
    if(rate)rate.textContent=formatMoney(wallet.amountPerVote);
    const votes=Math.max(0,Number(wallet.monthlyVotes)||0),nextValue=Math.max(1,Number(wallet.nextMilestone)||50);
    const previous=Math.max(0,nextValue-50),range=Math.max(1,nextValue-previous),progress=Math.max(0,Math.min(100,((votes-previous)/range)*100));
    if(next)next.textContent=`${nextValue} votes`; if(bar)bar.style.width=progress+"%"; if(text)text.textContent=`${votes} votes ce mois // ${Math.max(0,Number(wallet.votesToNext)||0)} avant le prochain palier`;
    if(milestones){milestones.innerHTML="";(Array.isArray(wallet.milestones)?wallet.milestones:[]).forEach(tier=>{const el=document.createElement("div");el.className=`vote-milestone ${tier.unlocked?"vote-milestone--unlocked":""}`;el.innerHTML=`<strong>${tier.value}</strong><small>${tier.unlocked?"DÉBLOQUÉ":"PALIER"}</small>`;milestones.appendChild(el)})}
    if(claim){claim.disabled=(Number(wallet.balance)||0)<=0||!wallet.claimConfigured;claim.title=!wallet.claimConfigured?"Conversion de la monnaie DayZ à configurer sur le serveur":"";claim.textContent=(Number(wallet.balance)||0)>0?`CLAIM ${formatMoney(wallet.balance)}`:"CAGNOTTE VIDE"}
  }
  function showWalletFeedback(message,isError=false){const el=document.getElementById("voteWalletFeedback");if(!el)return;el.hidden=false;el.textContent=message;el.classList.toggle("vote-wallet-feedback--error",isError)}
  async function loadVoteWallet(){try{const wallet=await window.SenzanyAPI.voteWallet.get();renderVoteWallet(wallet);return wallet}catch(error){showWalletFeedback(error.message||"Cagnotte indisponible.",true);return null}}

  async function loadPersonalVotes(){
    const value=document.getElementById("personalVotesValue"),state=document.getElementById("votesModuleState"),text=document.getElementById("personalVotesText"),foot=document.getElementById("personalVotesFoot"),total=document.getElementById("voteAliasesTotal"),matchCount=document.getElementById("voteAliasesMatchCount");
    if(!value||!state||!text||!foot)return;
    value.textContent="…";state.textContent="SYNCHRONISATION";
    setVoteSyncState("loading","Synchronisation…");
    if(total)total.textContent="…";
    if(matchCount)matchCount.textContent="LECTURE TOP-SERVEURS…";
    try{
      const result=await window.SenzanyAPI.topServeurs.getMyVotes();
      voteAliasDetails=new Map((Array.isArray(result.aliasDetails)?result.aliasDetails:[]).map(entry=>[String(entry.alias||"").toLowerCase(),entry]));
      const votes=Number(result.votes||0);
      value.textContent=votes.toLocaleString("fr-FR");
      const heroVotes=document.getElementById("heroVotesValue");if(heroVotes)heroVotes.textContent=votes.toLocaleString("fr-FR");
      if(total){
        total.textContent=votes.toLocaleString("fr-FR");
        if(previousVoteTotal!==null&&votes>previousVoteTotal){
          const box=total.closest(".vote-alias-total");
          box?.classList.remove("is-updated");
          requestAnimationFrame(()=>box?.classList.add("is-updated"));
          setTimeout(()=>box?.classList.remove("is-updated"),1000);
        }
      }
      previousVoteTotal=votes;
      if(result.wallet)renderVoteWallet(result.wallet);
      setVoteLastSync(new Date());
      if(!result.configured){
        state.textContent="PSEUDOS REQUIS";
        text.textContent="Ajoute les pseudos avec lesquels tu votes pour calculer ton total.";
        foot.innerHTML="SOURCE // TOP-SERVEURS <b>CONFIGURATION REQUISE</b>";
        if(matchCount)matchCount.textContent="AUCUN PSEUDO CONFIGURÉ";
        setVoteSyncState("waiting","Configuration requise");
        return result;
      }
      state.textContent=result.found?"SYNCHRONISÉ":"NON RETROUVÉ";
      setVoteSyncState(result.found?"ok":"waiting",result.found?"Synchronisé":"En attente Top-Serveurs");
      text.textContent=result.found?"Total cumulé de tous tes pseudos de vote ce mois-ci.":"Aucun de tes pseudos n’apparaît dans le classement actuel.";
      foot.innerHTML=result.found?`SOURCE // TOP-SERVEURS <b>${result.position?"MEILLEURE POSITION #"+result.position:"À JOUR"}</b>`:"SOURCE // TOP-SERVEURS <b>PSEUDOS NON RETROUVÉS</b>";
      if(matchCount){
        const count=Array.isArray(result.aliasDetails)?result.aliasDetails.filter(entry=>entry.found).length:Array.isArray(result.matchedNames)?result.matchedNames.length:0;
        const configured=Array.isArray(result.aliases)?result.aliases.length:0;
        const rank=result.position?` // MEILLEUR RANG #${result.position}`:"";
        matchCount.textContent=`${count} / ${configured} PSEUDO${configured>1?"S":""} RETROUVÉ${configured>1?"S":""}${rank}`;
      }
      if(Array.isArray(result.aliases))renderVoteAliases(result.aliases);
      return result;
    }catch(error){
      value.textContent="—";const heroVotes=document.getElementById("heroVotesValue");if(heroVotes)heroVotes.textContent="—";state.textContent="INDISPONIBLE";text.textContent="Impossible de récupérer les votes pour le moment.";foot.innerHTML="SOURCE // TOP-SERVEURS <b>ERREUR API</b>";
      if(total)total.textContent="—";
      if(matchCount)matchCount.textContent="API INDISPONIBLE";
      setVoteSyncState("error","API indisponible");
      console.warn("Votes personnels indisponibles",error);
      return null;
    }
  }

  async function loadVoteAliases(){
    try{
      const result=await window.SenzanyAPI.topServeurs.getVoteAliases();
      voteAliasesLimit=Number(result.limit)||20;
      renderVoteAliases(result.aliases);
      return result.aliases||[];
    }catch(error){
      const list=document.getElementById("voteAliasesList");
      if(list)list.innerHTML='<p class="vote-alias-empty">Impossible de charger les pseudos enregistrés.</p>';
      showVoteAliasFeedback(error.message||"Impossible de charger les pseudos.",true);
      return [];
    }
  }

  async function refreshVoteAliasesAndTotal(){
    await Promise.all([loadVoteAliases(),loadPersonalVotes(),loadVoteWallet()]);
  }

  const voteAliasForm=document.getElementById("voteAliasForm");
  if(voteAliasForm)voteAliasForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const input=document.getElementById("voteAliasInput"),button=document.getElementById("voteAliasAddButton");
    const alias=input?.value?.trim();
    if(!alias)return;
    button.disabled=true;
    button.textContent="Ajout…";
    try{
      await window.SenzanyAPI.topServeurs.addVoteAlias(alias);
      input.value="";
      showVoteAliasFeedback(`Le pseudo « ${alias} » a été ajouté. Les votes sont recalculés automatiquement.`);
      appendLog(`Pseudo de vote ajouté : ${alias}`,0);
      await refreshVoteAliasesAndTotal();
    }catch(error){
      showVoteAliasFeedback(error.message||"Impossible d’ajouter ce pseudo.",true);
    }finally{
      button.disabled=Boolean(input?.disabled);
      button.textContent="Ajouter le pseudo";
    }
  });

  const voteAliasesRefreshButton=document.getElementById("voteAliasesRefreshButton");
  if(voteAliasesRefreshButton)voteAliasesRefreshButton.addEventListener("click",async()=>{
    voteAliasesRefreshButton.disabled=true;
    voteAliasesRefreshButton.textContent="Actualisation…";
    showVoteAliasFeedback("Actualisation du classement Top-Serveurs en cours…");
    try{
      await loadPersonalVotes();
      showVoteAliasFeedback("Les votes ont été actualisés avec le classement Top-Serveurs.");
      appendLog("Votes Top-Serveurs actualisés",0);
    }catch(error){
      showVoteAliasFeedback(error.message||"Impossible d’actualiser les votes.",true);
    }finally{
      voteAliasesRefreshButton.disabled=false;
      voteAliasesRefreshButton.textContent="Actualiser les votes";
    }
  });


  const voteWalletClaim=document.getElementById("voteWalletClaim");
  if(voteWalletClaim)voteWalletClaim.addEventListener("click",async()=>{
    if(voteWalletClaim.disabled)return;
    if(!confirm("Créer maintenant une livraison en jeu avec toute ta cagnotte disponible ?"))return;
    voteWalletClaim.disabled=true;voteWalletClaim.textContent="CRÉATION DE LA LIVRAISON…";
    try{const result=await window.SenzanyAPI.voteWallet.claim();renderVoteWallet(result.summary);showWalletFeedback(`${formatMoney(result.amount)} ont été transformés en livraison. Tu peux maintenant la récupérer en jeu.`);appendLog(`Cagnotte réclamée : ${formatMoney(result.amount)}`,0)}
    catch(error){showWalletFeedback(error.message||"Impossible de créer la livraison.",true);await loadVoteWallet()}
  });


  document.querySelectorAll(".js-discord-unlink").forEach(button=>button.addEventListener("click",function(){if(!confirm("Dissocier ton compte Discord de ton compte Steam Senzany ?"))return;const buttons=document.querySelectorAll(".js-discord-unlink");buttons.forEach(item=>{item.disabled=true;item.textContent="Dissociation…"});window.SenzanyAPI.discord.unlink().then(()=>{renderDiscord({linked:false});const feedback=document.getElementById("discordFeedback");feedback.textContent="Compte Discord dissocié avec succès.";feedback.hidden=false;feedback.classList.remove("discord-feedback--error")}).catch(()=>{const feedback=document.getElementById("discordFeedback");feedback.textContent="Impossible de dissocier Discord pour le moment.";feedback.hidden=false;feedback.classList.add("discord-feedback--error")}).finally(()=>{buttons.forEach(item=>{item.disabled=false;item.textContent="Dissocier Discord"})})}));
  window.SenzanyAPI.steam.getMe().then(data=>{if(!data.loggedIn){reveal("out");return}document.getElementById("profileTag").textContent="ACCÈS PERSONNEL // IDENTITÉ SYNCHRONISÉE";document.getElementById("steamAvatar").src=data.avatar||"";document.getElementById("steamName").textContent=data.name||"Survivant";document.getElementById("identityName").textContent=data.name||"—";document.getElementById("steamIdValue").textContent=data.steamId||"—";document.getElementById("steamStatusValue").textContent=personaStates[data.personaState]||"Statut inconnu";document.getElementById("lastLogoffValue").textContent=formatLastActivity(data.lastLogoff);document.getElementById("steamProfileLink").href=data.profileUrl||("https://steamcommunity.com/profiles/"+data.steamId);renderDayz(data.dayz);renderDiscord(data.discord);refreshVoteAliasesAndTotal();updateTerminalTime();appendLog("Steam synchronisé",120);appendLog(data.discord&&data.discord.linked?"Discord synchronisé":"Discord en attente",430);appendLog("API OVH opérationnelle",740);appendLog("Battle Pass en attente de données serveur",1050);reveal("in");showDiscordFeedback()}).catch(()=>reveal("out"));


  const moduleToast=document.getElementById("moduleToast");
  let toastTimer;
  function showModuleToast(name){
    if(!moduleToast)return;
    moduleToast.textContent=`${name} // MODULE PRÉPARÉ — CONNEXION AUX DONNÉES À VENIR`;
    moduleToast.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{moduleToast.hidden=true},2600);
    appendLog(`${name} : accès en attente de données serveur`,0);
  }
  document.querySelectorAll(".module-launcher").forEach(card=>{
    const open=()=>showModuleToast(card.dataset.moduleName||"Module");
    card.addEventListener("click",open);
    card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open()}});
  });

  const terminalSequence=[
    "Lecture du nœud Steam... OK",
    "Vérification Discord... OK",
    "Lecture Supabase... OK",
    "Chargement des votes... EN ATTENTE",
    "Chargement de l’expérience... EN ATTENTE",
    "Battle Pass... DONNÉES SERVEUR REQUISES"
  ];
  let sequenceIndex=0;
  setInterval(()=>{
    if(document.hidden||!document.getElementById("loggedInView")||document.getElementById("loggedInView").hidden)return;
    appendLog(terminalSequence[sequenceIndex%terminalSequence.length],0);
    sequenceIndex++;
    const log=document.getElementById("liveLog");
    if(log&&log.children.length>8)log.firstElementChild.remove();
  },4200);

})();
