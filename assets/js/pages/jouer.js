(() => {
  const SERVER_ADDRESS = '208.115.196.109:2302';
  const slots = document.getElementById('slotsInfo');
  const map = document.getElementById('serverMap');
  const fill = document.getElementById('capacityFill');
  const dot = document.getElementById('serverStatusDot');
  const label = document.getElementById('serverStatusLabel');

  function copyAddress(button) {
    const done = () => {
      const original = button.dataset.original || button.textContent;
      button.dataset.original = original;
      button.textContent = 'ADRESSE COPIÉE ✓';
      button.classList.add('is-copied');
      setTimeout(() => { button.textContent = original; button.classList.remove('is-copied'); }, 1800);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(SERVER_ADDRESS).then(done).catch(() => { button.textContent = SERVER_ADDRESS; });
    else { button.textContent = SERVER_ADDRESS; }
  }

  ['copyIpBtn', 'copyIpSecondary'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => copyAddress(button));
  });

  function mapName(value) {
    if (!value) return 'Chernarus+';
    return String(value).toLowerCase().includes('chernarus') ? 'Chernarus+' : String(value).replace(/_/g, ' ');
  }

  function animatePlayers(target, max) {
    if (!slots) return;
    const start = Number(slots.dataset.players || 0);
    const started = performance.now();
    const duration = 750;
    const frame = (now) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      slots.textContent = `${current} / ${max}`;
      if (progress < 1) requestAnimationFrame(frame);
      else slots.dataset.players = String(target);
    };
    requestAnimationFrame(frame);
  }

  function offline() {
    if (slots) slots.textContent = 'HORS LIGNE';
    if (fill) fill.style.width = '0%';
    dot?.classList.add('is-offline');
    if (label) label.textContent = 'OFFLINE';
  }

  async function refresh() {
    try {
      const data = await window.SenzanyAPI.game.getStats();
      if (!data?.online || !Number.isFinite(Number(data.players))) return offline();
      const players = Number(data.players);
      const max = Number(data.maxPlayers) || 50;
      animatePlayers(players, max);
      if (fill) fill.style.width = `${Math.min((players / max) * 100, 100)}%`;
      if (map) map.textContent = mapName(data.map);
      dot?.classList.remove('is-offline');
      if (label) label.textContent = 'LIVE';
    } catch (error) {
      offline();
      console.warn('Stats DayZ indisponibles.', error);
    }
  }

  refresh();
  setInterval(refresh, 30000);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    observer.observe(element);
  });

  const preview = document.getElementById('featurePreview');
  const previewBox = document.querySelector('.systems-showcase__media');
  const previewKicker = document.getElementById('featureKicker');
  const previewTitle = document.getElementById('featureTitle');
  const previewCurrent = document.getElementById('featureCurrent');
  document.querySelectorAll('.feature-switch').forEach((button, index) => {
    const activate = () => {
      document.querySelectorAll('.feature-switch').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      previewBox?.classList.add('is-changing');
      setTimeout(() => {
        if (preview) preview.src = button.dataset.image;
        if (previewKicker) previewKicker.textContent = button.dataset.kicker;
        if (previewTitle) previewTitle.textContent = button.dataset.title;
        if (previewCurrent) previewCurrent.textContent = String(index + 1).padStart(2, '0');
        previewBox?.classList.remove('is-changing');
      }, 180);
    };
    button.addEventListener('mouseenter', activate);
    button.addEventListener('focus', activate);
    button.addEventListener('click', activate);
  });

  const filmModal = document.getElementById('filmModal');
  const filmFrame = document.getElementById('filmFrame');
  const openFilm = document.getElementById('openFilm');
  const closeFilm = () => {
    filmModal?.classList.remove('is-open');
    filmModal?.setAttribute('aria-hidden', 'true');
    if (filmFrame) filmFrame.innerHTML = '';
    document.body.style.overflow = '';
  };
  openFilm?.addEventListener('click', () => {
    if (filmFrame) filmFrame.innerHTML = '<iframe src="https://www.youtube.com/embed/3Uf5WygzmrI?autoplay=1&rel=0" title="Film Senzany" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    filmModal?.classList.add('is-open');
    filmModal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  });
  document.getElementById('closeFilm')?.addEventListener('click', closeFilm);
  filmModal?.querySelector('[data-close-film]')?.addEventListener('click', closeFilm);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeFilm(); });
})();
