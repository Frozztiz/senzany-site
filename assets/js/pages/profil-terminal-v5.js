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
  function renderDayz(dayz){const hours=document.getElementById("dayzHours"),summary=document.getElementById("dayzHoursSummary"),explanation=document.getElementById("dayzExplanation"),state=document.getElementById("dayzState"),bar=document.getElementById("dayzMetricBar");state.classList.remove("panel-state--online","panel-state--pending");if(dayz&&dayz.available){const formatted=formatHours(dayz.hours);animateNumber(hours,dayz.hours);summary.textContent=formatted+" h";document.getElementById("quickHours").textContent=formatted+" H";explanation.textContent="Temps de jeu total enregistré par Steam pour DayZ.";state.textContent="Donnée publique";state.classList.add("panel-state--online");requestAnimationFrame(()=>{bar.style.width=Math.min(100,Math.max(12,(Number(dayz.hours)||0)/20))+"%"});return}hours.textContent="Privé";summary.textContent="Indisponible";state.textContent="Indisponible";state.classList.add("panel-state--pending");explanation.textContent=dayz&&dayz.reason==="not_found"?"DayZ n’apparaît pas dans les jeux visibles de ce compte.":"Cette donnée Steam est privée ou indisponible."}
  function updateDiscordService(linked){const row=document.getElementById("discordServiceRow"),dot=row.querySelector(".system-dot"),text=document.getElementById("discordServiceText"),state=document.getElementById("discordServiceState"),header=document.getElementById("discordHeaderState");if(linked){dot.classList.add("system-dot--online");text.textContent="Compte et rôles synchronisés";state.textContent="ONLINE";header.textContent="DISCORD ASSOCIÉ";header.classList.add("chip--ok");document.getElementById("quickDiscord").textContent="ONLINE"}else{dot.classList.remove("system-dot--online");text.textContent="Association en attente";state.textContent="EN ATTENTE";header.textContent="DISCORD EN ATTENTE";header.classList.remove("chip--ok");document.getElementById("quickDiscord").textContent="EN ATTENTE"}}
  function renderDiscord(discord){const state=document.getElementById("discordState"),unlinked=document.getElementById("discordUnlinked"),linked=document.getElementById("discordLinked"),linkButton=document.getElementById("discordLinkButton"),unlinkButtons=document.querySelectorAll(".js-discord-unlink"),rolesBox=document.getElementById("discordRoles");state.classList.remove("panel-state--online","panel-state--pending");if(discord&&discord.linked){state.textContent="Associé";state.classList.add("panel-state--online");unlinked.hidden=true;linked.hidden=false;linkButton.hidden=true;unlinkButtons.forEach(button=>button.hidden=false);document.getElementById("discordUsername").textContent=discord.username||"Compte Discord";document.getElementById("discordId").textContent=discord.id||"—";const avatar=document.getElementById("discordAvatar");if(discord.avatar){avatar.src=discord.avatar;avatar.hidden=false}else avatar.hidden=true;const list=document.getElementById("discordRolesList"),empty=document.getElementById("discordRolesEmpty");list.innerHTML="";if(discord.rolesAvailable){rolesBox.hidden=false;const roles=Array.isArray(discord.roles)?discord.roles:[];empty.hidden=roles.length>0;roles.slice(0,6).forEach(role=>{const badge=document.createElement("span");badge.className="discord-role-badge";badge.textContent=role.name;list.appendChild(badge)});if(roles.length>6){const more=document.createElement("span");more.className="discord-role-badge";more.textContent="+ "+(roles.length-6);list.appendChild(more)}}else rolesBox.hidden=true;updateDiscordService(true);return}state.textContent="Non associé";state.classList.add("panel-state--pending");unlinked.hidden=false;linked.hidden=true;rolesBox.hidden=true;linkButton.hidden=false;unlinkButtons.forEach(button=>button.hidden=true);updateDiscordService(false)}
  function showDiscordFeedback(){const code=new URLSearchParams(location.search).get("discord");if(!code)return;const messages={linked:"Compte Discord associé avec succès.",cancelled:"Association Discord annulée.",already_linked:"Ce compte Discord est déjà lié à un autre compte Steam.",steam_required:"Reconnecte-toi à Steam avant d’associer Discord.",invalid_state:"La demande a expiré. Recommence.",invalid_callback:"Réponse Discord invalide.",token_error:"Discord n’a pas finalisé l’autorisation.",user_error:"Impossible de lire le profil Discord.",server_error:"Impossible d’enregistrer l’association."};const feedback=document.getElementById("discordFeedback");feedback.textContent=messages[code]||"État Discord mis à jour.";feedback.hidden=false;feedback.classList.toggle("discord-feedback--error",code!=="linked");history.replaceState({},document.title,location.pathname)}
  function updateTerminalTime(){const now=new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short"}).format(new Date());document.getElementById("terminalUpdatedAt").textContent="MISE À JOUR — "+now}

  async function loadPersonalVotes(discord){
    const value=document.getElementById("personalVotesValue"),state=document.getElementById("votesModuleState"),text=document.getElementById("personalVotesText"),foot=document.getElementById("personalVotesFoot");
    if(!value||!state||!text||!foot)return;
    if(!discord||!discord.linked){value.textContent="—";state.textContent="DISCORD REQUIS";text.textContent="Associe ton compte Discord pour retrouver tes votes.";foot.innerHTML="SOURCE // TOP-SERVEURS <b>EN ATTENTE</b>";return}
    value.textContent="…";state.textContent="SYNCHRONISATION";
    try{
      const result=await window.SenzanyAPI.topServeurs.getMyVotes();
      if(!result.linked){value.textContent="—";state.textContent="DISCORD REQUIS";return}
      value.textContent=Number(result.votes||0).toLocaleString("fr-FR");
      state.textContent=result.found?"SYNCHRONISÉ":"NON TROUVÉ";
      text.textContent=result.found?"Votes personnels enregistrés ce mois-ci.":"Aucun vote trouvé avec ton pseudo Discord actuel.";
      foot.innerHTML=result.found?`SOURCE // TOP-SERVEURS <b>${result.position?"CLASSEMENT #"+result.position:"À JOUR"}</b>`:"SOURCE // TOP-SERVEURS <b>VÉRIFIER LE PSEUDO</b>";
    }catch(error){value.textContent="—";state.textContent="INDISPONIBLE";text.textContent="Impossible de récupérer les votes pour le moment.";foot.innerHTML="SOURCE // TOP-SERVEURS <b>ERREUR API</b>";console.warn("Votes personnels indisponibles",error)}
  }

  document.querySelectorAll(".js-discord-unlink").forEach(button=>button.addEventListener("click",function(){if(!confirm("Dissocier ton compte Discord de ton compte Steam Senzany ?"))return;const buttons=document.querySelectorAll(".js-discord-unlink");buttons.forEach(item=>{item.disabled=true;item.textContent="Dissociation…"});window.SenzanyAPI.discord.unlink().then(()=>{renderDiscord({linked:false});const feedback=document.getElementById("discordFeedback");feedback.textContent="Compte Discord dissocié avec succès.";feedback.hidden=false;feedback.classList.remove("discord-feedback--error")}).catch(()=>{const feedback=document.getElementById("discordFeedback");feedback.textContent="Impossible de dissocier Discord pour le moment.";feedback.hidden=false;feedback.classList.add("discord-feedback--error")}).finally(()=>{buttons.forEach(item=>{item.disabled=false;item.textContent="Dissocier Discord"})})}));
  window.SenzanyAPI.steam.getMe().then(data=>{if(!data.loggedIn){reveal("out");return}document.getElementById("profileTag").textContent="ACCÈS PERSONNEL // IDENTITÉ SYNCHRONISÉE";document.getElementById("steamAvatar").src=data.avatar||"";document.getElementById("steamName").textContent=data.name||"Survivant";document.getElementById("identityName").textContent=data.name||"—";document.getElementById("steamIdValue").textContent=data.steamId||"—";document.getElementById("steamStatusValue").textContent=personaStates[data.personaState]||"Statut inconnu";document.getElementById("lastLogoffValue").textContent=formatLastActivity(data.lastLogoff);document.getElementById("steamProfileLink").href=data.profileUrl||("https://steamcommunity.com/profiles/"+data.steamId);renderDayz(data.dayz);renderDiscord(data.discord);loadPersonalVotes(data.discord);updateTerminalTime();appendLog("Steam synchronisé",120);appendLog(data.discord&&data.discord.linked?"Discord synchronisé":"Discord en attente",430);appendLog("API OVH opérationnelle",740);appendLog("Battle Pass en attente de données serveur",1050);reveal("in");showDiscordFeedback()}).catch(()=>reveal("out"));


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
