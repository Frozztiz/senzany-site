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

  // Film Senzany — ouverture de la vidéo YouTube dans la fenêtre prévue.
  const filmButton = document.getElementById('openFilm');
  const filmModal = document.getElementById('filmModal');
  const filmFrame = document.getElementById('filmFrame');
  const filmClose = document.getElementById('closeFilm');
  const YOUTUBE_VIDEO_ID = '3Uf5WygzmrI';

  function openFilm() {
    if (!filmModal || !filmFrame) {
      window.open(`https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`, '_blank', 'noopener,noreferrer');
      return;
    }

    filmFrame.innerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0"
        title="Film Senzany"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>`;

    filmModal.classList.add('is-open');
    filmModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    filmClose?.focus();
  }

  function closeFilm() {
    if (!filmModal || !filmFrame) return;
    filmModal.classList.remove('is-open');
    filmModal.setAttribute('aria-hidden', 'true');
    filmFrame.innerHTML = '';
    document.body.style.overflow = '';
    filmButton?.focus();
  }

  filmButton?.addEventListener('click', openFilm);
  filmClose?.addEventListener('click', closeFilm);
  filmModal?.querySelectorAll('[data-close-film]').forEach((element) => {
    element.addEventListener('click', closeFilm);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filmModal?.classList.contains('is-open')) closeFilm();
  });

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
})();
