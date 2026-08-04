(() => {
  const state = { month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), events: [], timer: null };
  const $ = (id) => document.getElementById(id);
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const typeLabels = { major: 'Grand événement', community: 'Événement communautaire', vote: 'Événement de votes', seasonal: 'Événement saisonnier' };
  function rangeForMonth(date) { const from = new Date(date.getFullYear(), date.getMonth(), 1); const to = new Date(date.getFullYear(), date.getMonth() + 1, 7); return { from: from.toISOString(), to: to.toISOString() }; }
  async function load() {
    const { from, to } = rangeForMonth(state.month);
    $('eventsStatus').textContent = 'Synchronisation du calendrier…';
    try {
      const response = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      state.events = Array.isArray(data.events) ? data.events : [];
      $('eventsStatus').textContent = state.events.length ? `${state.events.length} événement(s) programmé(s)` : 'Aucun événement publié pour ce mois.';
      render(); updateHero();
    } catch (error) {
      state.events = [];
      $('eventsStatus').textContent = `Calendrier indisponible : ${error.message}`;
      render(); updateHero();
    }
  }
  function render() {
    $('calendarMonthLabel').textContent = fmtMonth.format(state.month).replace(/^./, (c) => c.toUpperCase());
    const year = state.month.getFullYear(), month = state.month.getMonth();
    const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const todayKey = new Date().toISOString().slice(0,10);
    const html = [];
    for (let i=0;i<42;i++) {
      const day = new Date(start); day.setDate(start.getDate()+i);
      const key = day.toISOString().slice(0,10);
      const daily = state.events.filter((event) => event.startsAt?.slice(0,10) === key);
      html.push(`<article class="calendar-day${day.getMonth()!==month?' is-outside':''}${key===todayKey?' is-today':''}"><header><span>${day.getDate()}</span>${key===todayKey?'<b>Aujourd’hui</b>':''}</header><div>${daily.map(eventChip).join('')}</div></article>`);
    }
    $('eventsCalendar').innerHTML = html.join('');
    document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => openDialog(button.dataset.eventId)));
  }
  function eventChip(event) {
    const mystery = event.mystery && !event.revealed;
    const time = new Date(event.startsAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    return `<button class="calendar-event calendar-event--${escapeHtml(event.eventType)}${mystery?' is-mystery':''}" data-event-id="${escapeHtml(event.id)}" type="button"><span>${mystery?'🔒':'◆'} ${escapeHtml(event.title)}</span><small>${time}${event.voteMilestone?` · ${event.voteMilestone} votes`:''}</small></button>`;
  }
  function countdown(target) {
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return 'Révélation imminente';
    const d=Math.floor(diff/86400000), h=Math.floor(diff%86400000/3600000), m=Math.floor(diff%3600000/60000), s=Math.floor(diff%60000/1000);
    return `<span><b>${d}</b>J</span><span><b>${String(h).padStart(2,'0')}</b>H</span><span><b>${String(m).padStart(2,'0')}</b>M</span><span><b>${String(s).padStart(2,'0')}</b>S</span>`;
  }
  function openDialog(id) {
    const event = state.events.find((item) => item.id === id); if (!event) return;
    const hidden = event.mystery && !event.revealed;
    $('eventDialogType').textContent = typeLabels[event.eventType] || 'Événement';
    $('eventDialogTitle').textContent = event.title;
    $('eventDialogDate').textContent = fmtDate.format(new Date(event.startsAt));
    $('eventDialogDescription').textContent = hidden ? "Le contenu de cet événement sera révélé automatiquement une semaine avant son lancement." : (event.description || 'Les informations seront complétées prochainement.');
    $('eventDialogVisual').style.backgroundImage = !hidden && event.imageUrl ? `linear-gradient(180deg,transparent,rgba(7,6,5,.92)),url("${event.imageUrl.replace(/"/g,'')}")` : '';
    $('eventDialogVisual').classList.toggle('is-mystery', hidden);
    $('eventDialogCountdown').innerHTML = hidden && event.revealAt ? countdown(event.revealAt) : countdown(event.startsAt);
    const details=[];
    if (!hidden && event.location) details.push(`<div><dt>Lieu</dt><dd>${escapeHtml(event.location)}</dd></div>`);
    if (!hidden && event.rewards) details.push(`<div><dt>Récompenses</dt><dd>${escapeHtml(event.rewards).replace(/\n/g,'<br>')}</dd></div>`);
    if (event.voteMilestone) details.push(`<div><dt>Palier</dt><dd>${event.voteMilestone.toLocaleString('fr-FR')} votes</dd></div>`);
    $('eventDialogDetails').innerHTML=details.join('');
    $('eventDialog').showModal();
    clearInterval(state.timer); state.timer=setInterval(() => { $('eventDialogCountdown').innerHTML = hidden && event.revealAt ? countdown(event.revealAt) : countdown(event.startsAt); },1000);
  }
  function updateHero() {
    const future = state.events.filter(e => new Date(e.startsAt)>new Date()).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
    $('heroEventCount').textContent = state.events.length;
    const next=future[0]; if (!next) { $('heroNextDate').textContent='À PROGRAMMER'; return; }
    $('heroNextDate').textContent = new Date(next.startsAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}).toUpperCase();
    const card=$('nextEventCard'); card.classList.remove('is-empty'); card.classList.toggle('is-mystery',next.mystery&&!next.revealed);
    card.querySelector('h2').textContent=next.title; card.querySelector('p').textContent=next.mystery&&!next.revealed?'Son identité sera dévoilée automatiquement une semaine avant le rendez-vous.':(next.description||'Plus de détails prochainement.');
    const cd=$('nextEventCountdown'); cd.hidden=false; cd.innerHTML=countdown(next.mystery&&!next.revealed&&next.revealAt?next.revealAt:next.startsAt);
    if (next.imageUrl && next.revealed) card.querySelector('.next-event-card__visual').style.backgroundImage=`linear-gradient(90deg,transparent,rgba(8,7,6,.8)),url("${next.imageUrl.replace(/"/g,'')}")`;
  }
  $('calendarPrev').addEventListener('click',()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);load();});
  $('calendarNext').addEventListener('click',()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);load();});
  $('calendarToday').addEventListener('click',()=>{const n=new Date();state.month=new Date(n.getFullYear(),n.getMonth(),1);load();});
  $('eventDialogClose').addEventListener('click',()=>{$('eventDialog').close();clearInterval(state.timer);});
  $('eventDialog').addEventListener('click',(e)=>{if(e.target===$('eventDialog'))$('eventDialogClose').click();});
  load(); setInterval(updateHero,1000);
})();
