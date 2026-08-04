(() => {
  const state = { month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), events: [], timer: null };
  const $ = (id) => document.getElementById(id);
  const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const typeLabels = { major: 'Grand événement', community: 'Événement communautaire', vote: 'Événement de votes', seasonal: 'Événement saisonnier' };

  const VOTE_STEP = 1000;

  function formatNumber(value) {
    return new Intl.NumberFormat('fr-FR').format(Number(value || 0));
  }

  function renderVoteProgress(monthlyVotes) {
    const votes = Math.max(0, Number(monthlyVotes || 0));
    const completedSteps = Math.floor(votes / VOTE_STEP);
    const nextTarget = (completedSteps + 1) * VOTE_STEP;
    const progressInStep = votes % VOTE_STEP;
    const remaining = nextTarget - votes;
    const percent = Math.min(100, Math.max(0, progressInStep / VOTE_STEP * 100));

    $('heroVoteProgress').textContent = `${formatNumber(votes)} / ${formatNumber(nextTarget)} VOTES`;
    $('voteEventTarget').textContent = `${formatNumber(nextTarget)} VOTES`;
    $('voteEventCurrent').textContent = `${formatNumber(votes)} votes ce mois`;
    $('voteEventRemaining').textContent = `${formatNumber(remaining)} vote${remaining > 1 ? 's' : ''} avant le prochain événement`;
    $('voteEventProgress').style.width = `${percent}%`;
    $('voteEventStatus').textContent = completedSteps
      ? `${completedSteps} palier${completedSteps > 1 ? 's' : ''} de 1 000 votes atteint${completedSteps > 1 ? 's' : ''} ce mois.`
      : 'Le prochain palier débloquera un événement communautaire.';
  }

  async function loadVoteProgress() {
    try {
      const response = await fetch('/api/topserveurs/stats', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      renderVoteProgress(data.monthlyVotes);
    } catch (error) {
      $('heroVoteProgress').textContent = 'COMPTEUR INDISPONIBLE';
      $('voteEventCurrent').textContent = '-- votes ce mois';
      $('voteEventRemaining').textContent = 'Prochain palier : 1 000 votes';
      $('voteEventProgress').style.width = '0%';
      $('voteEventStatus').textContent = `Compteur temporairement indisponible : ${error.message}`;
    }
  }

  function rangeForMonth(date) {
    const from = new Date(date.getFullYear(), date.getMonth() - 2, 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 3, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  async function load() {
    const { from, to } = rangeForMonth(state.month);
    $('eventsStatus').textContent = 'Synchronisation du calendrier…';
    try {
      const response = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      state.events = Array.isArray(data.events) ? data.events : [];
      const currentMonthEvents = eventsForDisplayedMonth();
      $('eventsStatus').textContent = currentMonthEvents.length ? `${currentMonthEvents.length} événement(s) programmé(s)` : 'Aucun événement publié pour ce mois.';
      renderAll();
    } catch (error) {
      state.events = [];
      $('eventsStatus').textContent = `Calendrier indisponible : ${error.message}`;
      renderAll();
    }
  }

  function eventsForDisplayedMonth() {
    const y = state.month.getFullYear();
    const m = state.month.getMonth();
    return state.events.filter((event) => {
      const d = new Date(event.startsAt);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }

  function renderAll() {
    renderCalendar();
    updateHero();
    renderWeek();
    renderMysteryReveal();
    renderRecentEvents();
  }

  function renderCalendar() {
    $('calendarMonthLabel').textContent = fmtMonth.format(state.month).replace(/^./, (c) => c.toUpperCase());
    const year = state.month.getFullYear(), month = state.month.getMonth();
    const first = new Date(year, month, 1); const offset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const todayKey = new Date().toISOString().slice(0, 10);
    const html = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(start); day.setDate(start.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const daily = state.events.filter((event) => event.startsAt?.slice(0, 10) === key);
      html.push(`<article class="calendar-day${day.getMonth() !== month ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}"><header><span>${day.getDate()}</span>${key === todayKey ? '<b>Aujourd’hui</b>' : ''}</header><div>${daily.map(eventChip).join('')}</div></article>`);
    }
    $('eventsCalendar').innerHTML = html.join('');
    bindEventButtons();
  }

  function eventChip(event) {
    const mystery = event.mystery && !event.revealed;
    const time = new Date(event.startsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `<button class="calendar-event calendar-event--${escapeHtml(event.eventType)}${mystery ? ' is-mystery' : ''}" data-event-id="${escapeHtml(event.id)}" type="button"><span>${mystery ? '🔒' : '◆'} ${escapeHtml(event.title)}</span><small>${time}${event.voteMilestone ? ` · ${event.voteMilestone} votes` : ''}</small></button>`;
  }

  function countdown(target) {
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return '<span><b>00</b>J</span><span><b>00</b>H</span><span><b>00</b>M</span><span><b>00</b>S</span>';
    const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
    return `<span><b>${d}</b>J</span><span><b>${String(h).padStart(2, '0')}</b>H</span><span><b>${String(m).padStart(2, '0')}</b>M</span><span><b>${String(s).padStart(2, '0')}</b>S</span>`;
  }

  function openDialog(id) {
    const event = state.events.find((item) => item.id === id); if (!event) return;
    const hidden = event.mystery && !event.revealed;
    $('eventDialogType').textContent = typeLabels[event.eventType] || 'Événement';
    $('eventDialogTitle').textContent = event.title;
    $('eventDialogDate').textContent = fmtDate.format(new Date(event.startsAt));
    $('eventDialogDescription').textContent = hidden ? "Le contenu de cet événement sera révélé automatiquement une semaine avant son lancement." : (event.description || 'Les informations seront complétées prochainement.');
    $('eventDialogVisual').style.backgroundImage = !hidden && event.imageUrl ? `linear-gradient(180deg,transparent,rgba(7,6,5,.92)),url("${event.imageUrl.replace(/"/g, '')}")` : '';
    $('eventDialogVisual').classList.toggle('is-mystery', hidden);
    $('eventDialogCountdown').innerHTML = hidden && event.revealAt ? countdown(event.revealAt) : countdown(event.startsAt);
    const details = [];
    if (!hidden && event.location) details.push(`<div><dt>Lieu</dt><dd>${escapeHtml(event.location)}</dd></div>`);
    if (!hidden && event.rewards) details.push(`<div><dt>Récompenses</dt><dd>${escapeHtml(event.rewards).replace(/\n/g, '<br>')}</dd></div>`);
    if (event.voteMilestone) details.push(`<div><dt>Palier communautaire</dt><dd>${escapeHtml(event.voteMilestone)} votes</dd></div>`);
    $('eventDialogDetails').innerHTML = details.join('');
    $('eventDialog').showModal();
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      $('eventDialogCountdown').innerHTML = hidden && event.revealAt ? countdown(event.revealAt) : countdown(event.startsAt);
      updateLiveCountdowns();
    }, 1000);
  }

  function bindEventButtons() {
    document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => openDialog(button.dataset.eventId)));
  }

  function updateHero() {
    const now = Date.now();
    const upcoming = state.events.filter((e) => new Date(e.startsAt).getTime() >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    $('heroEventCount').textContent = String(state.events.length);
    const next = upcoming[0];
    $('heroNextDate').textContent = next ? new Date(next.startsAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).toUpperCase() : 'À PROGRAMMER';
    const card = $('nextEventCard');
    const title = card.querySelector('h2');
    const text = card.querySelector('p');
    const visual = card.querySelector('.next-event-card__visual');
    visual.style.backgroundImage = '';
    if (!next) {
      card.classList.add('is-empty'); title.textContent = 'Le calendrier se prépare'; text.textContent = "Les prochains rendez-vous seront publiés ici par l'équipe Senzany."; $('nextEventCountdown').hidden = true; return;
    }
    card.classList.remove('is-empty');
    title.textContent = next.title;
    text.textContent = next.mystery && !next.revealed ? 'Le contenu de ce rendez-vous reste classifié jusqu’à sa révélation.' : (next.description || 'Plus de détails prochainement.');
    const cd = $('nextEventCountdown'); cd.hidden = false; cd.innerHTML = countdown(next.mystery && !next.revealed && next.revealAt ? next.revealAt : next.startsAt);
    if (next.imageUrl && next.revealed) visual.style.backgroundImage = `linear-gradient(90deg,transparent,rgba(8,7,6,.8)),url("${next.imageUrl.replace(/"/g, '')}")`;
  }

  function renderWeek() {
    const now = new Date();
    const end = new Date(now); end.setDate(now.getDate() + 7);
    $('weekRangeLabel').textContent = `${fmtShort.format(now)} — ${fmtShort.format(end)}`;
    const rows = state.events.filter((event) => {
      const d = new Date(event.startsAt);
      return d >= now && d <= end;
    }).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    $('weekEventsList').innerHTML = rows.length ? rows.map((event) => {
      const hidden = event.mystery && !event.revealed;
      return `<button type="button" class="week-event-row" data-event-id="${escapeHtml(event.id)}"><time>${new Date(event.startsAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}<b>${new Date(event.startsAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b></time><div><strong>${hidden ? '🔒 ' : ''}${escapeHtml(event.title)}</strong><small>${escapeHtml(typeLabels[event.eventType] || 'Événement')}</small></div><span>Voir</span></button>`;
    }).join('') : '<div class="event-empty">Aucun événement annoncé cette semaine.</div>';
    bindEventButtons();
  }

  function renderMysteryReveal() {
    const now = Date.now();
    const mysteries = state.events.filter((event) => event.mystery && !event.revealed && event.revealAt && new Date(event.revealAt).getTime() > now).sort((a, b) => new Date(a.revealAt) - new Date(b.revealAt));
    const next = mysteries[0];
    const cd = $('mysteryRevealCountdown');
    if (!next) {
      $('mysteryRevealTitle').textContent = 'Aucun événement mystère';
      $('mysteryRevealText').textContent = 'Les futurs événements secrets apparaîtront ici.';
      cd.hidden = true;
      return;
    }
    $('mysteryRevealTitle').textContent = next.title;
    $('mysteryRevealText').textContent = `Révélation programmée le ${fmtDate.format(new Date(next.revealAt))}.`;
    cd.hidden = false;
    cd.dataset.target = next.revealAt;
    cd.innerHTML = countdown(next.revealAt);
  }

  function renderRecentEvents() {
    const now = Date.now();
    const recent = state.events.filter((event) => new Date(event.startsAt).getTime() < now).sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt)).slice(0, 4);
    $('recentEventsGrid').innerHTML = recent.length ? recent.map((event) => `<button type="button" class="recent-event-card" data-event-id="${escapeHtml(event.id)}"><div class="recent-event-card__visual"${event.imageUrl ? ` style="background-image:linear-gradient(180deg,transparent,rgba(7,6,5,.94)),url('${event.imageUrl.replace(/'/g, '')}')"` : ''}></div><div><span>${escapeHtml(typeLabels[event.eventType] || 'Événement')}</span><h3>${escapeHtml(event.title)}</h3><time>${fmtDate.format(new Date(event.startsAt))}</time></div></button>`).join('') : '<div class="event-empty">Aucun événement passé pour le moment.</div>';
    bindEventButtons();
  }

  function updateLiveCountdowns() {
    updateHero();
    const mysteryCd = $('mysteryRevealCountdown');
    if (mysteryCd && !mysteryCd.hidden && mysteryCd.dataset.target) mysteryCd.innerHTML = countdown(mysteryCd.dataset.target);
  }

  $('calendarPrev').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); load(); });
  $('calendarNext').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); load(); });
  $('calendarToday').addEventListener('click', () => { const n = new Date(); state.month = new Date(n.getFullYear(), n.getMonth(), 1); load(); });
  $('eventDialogClose').addEventListener('click', () => { $('eventDialog').close(); clearInterval(state.timer); });
  $('eventDialog').addEventListener('click', (e) => { if (e.target === $('eventDialog')) $('eventDialogClose').click(); });

  load();
  loadVoteProgress();
  setInterval(updateLiveCountdowns, 1000);
  setInterval(loadVoteProgress, 300000);
})();
