(() => {
  const PAGE_DATA = {
    nextWipeDate: '2026-07-21',
    eventDate: '2026-07-21T20:00:00'
  };

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function renderInitialData() {
    const wipe = new Date(PAGE_DATA.nextWipeDate);
    setText('statPlayers', 'Bientôt disponible');
    setText('statVotes', '—');
    setText('statWipe', wipe.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }));
  }

  async function refreshTopServeursStats() {
    try {
      const data = await window.SenzanyAPI.topServeurs.getStats();
      setText('statVotes', data.monthlyVotes.toLocaleString('fr-FR'));
    } catch (error) {
      console.warn('Stats Top-Serveurs indisponibles.', error);
    }
  }

  async function refreshGameStats() {
    const playersElement = document.getElementById('statPlayers');
    if (!playersElement) return;

    try {
      const data = await window.SenzanyAPI.game.getStats();
      const hasPlayerCount = data.online &&
        data.players !== null && data.players !== undefined &&
        data.maxPlayers !== null && data.maxPlayers !== undefined;

      playersElement.textContent = hasPlayerCount
        ? `${data.players} / ${data.maxPlayers}`
        : (data.online ? 'Bientôt disponible' : 'Hors ligne');
    } catch (error) {
      playersElement.textContent = 'Bientôt disponible';
      console.warn('Stats DayZ indisponibles.', error);
    }
  }

  function updateCountdown() {
    const countdown = document.getElementById('countdown');
    if (!countdown) return;

    const diff = new Date(PAGE_DATA.eventDate).getTime() - Date.now();
    if (diff <= 0) {
      countdown.innerHTML = '<div class="cd-block"><div class="cd-num">—</div><div class="cd-lab">Terminé</div></div>';
      return;
    }

    setText('cd-d', String(Math.floor(diff / 86400000)).padStart(2, '0'));
    setText('cd-h', String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'));
    setText('cd-m', String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'));
    setText('cd-s', String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'));
  }

  function createAshParticles() {
    const ash = document.getElementById('heroAsh');
    if (!ash) return;

    for (let index = 0; index < 22; index += 1) {
      const particle = document.createElement('span');
      const size = 2 + Math.random() * 2;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.bottom = `${Math.random() * 40}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.animationDuration = `${8 + Math.random() * 10}s`;
      particle.style.animationDelay = `${Math.random() * 10}s`;
      ash.appendChild(particle);
    }
  }

  renderInitialData();
  refreshTopServeursStats();
  refreshGameStats();
  updateCountdown();
  createAshParticles();

  setInterval(refreshTopServeursStats, 300000);
  setInterval(refreshGameStats, 60000);
  setInterval(updateCountdown, 1000);
})();
