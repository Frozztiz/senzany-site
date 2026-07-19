(() => {
  'use strict';

  const PAGE_DATA = {
    nextWipeDate: '2026-07-21',
    eventDate: '2026-07-21T20:00:00'
  };

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  function renderInitialData() {
    const wipe = new Date(PAGE_DATA.nextWipeDate);
    setText('statPlayers', 'Bientôt disponible');
    setText('statVotes', '—');
    setText('statWipe', wipe.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  }

  async function refreshTopServeursStats() {
    try {
      if (!window.SenzanyAPI?.topServeurs) return;
      const data = await window.SenzanyAPI.topServeurs.getStats();
      if (Number.isFinite(data?.monthlyVotes)) setText('statVotes', data.monthlyVotes.toLocaleString('fr-FR'));
    } catch (error) {
      console.warn('Stats Top-Serveurs indisponibles.', error);
    }
  }

  async function refreshGameStats() {
    const playersElement = document.getElementById('statPlayers');
    if (!playersElement) return;

    try {
      if (!window.SenzanyAPI?.game) return;
      const data = await window.SenzanyAPI.game.getStats();
      const hasPlayerCount = data?.online && data.players !== null && data.players !== undefined && data.maxPlayers !== null && data.maxPlayers !== undefined;
      playersElement.textContent = hasPlayerCount ? `${data.players} / ${data.maxPlayers}` : (data?.online ? 'Bientôt disponible' : 'Hors ligne');
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
      countdown.innerHTML = '<div><strong>LIVE</strong><span>Saison ouverte</span></div>';
      return;
    }

    setText('cd-d', String(Math.floor(diff / 86400000)).padStart(2, '0'));
    setText('cd-h', String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'));
    setText('cd-m', String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'));
    setText('cd-s', String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'));
  }

  function createAshParticles() {
    const ash = document.getElementById('heroAsh');
    if (!ash || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (let index = 0; index < 24; index += 1) {
      const particle = document.createElement('span');
      const size = 1 + Math.random() * 2.5;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.animationDuration = `${10 + Math.random() * 12}s`;
      particle.style.animationDelay = `${Math.random() * 12}s`;
      ash.appendChild(particle);
    }
  }

  function initReveal() {
    const elements = document.querySelectorAll('.home-reveal');
    if (!elements.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -30px' });

    elements.forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index % 4, 3) * 80}ms`;
      observer.observe(element);
    });
  }

  renderInitialData();
  refreshTopServeursStats();
  refreshGameStats();
  updateCountdown();
  createAshParticles();
  initReveal();

  window.setInterval(refreshTopServeursStats, 300000);
  window.setInterval(refreshGameStats, 60000);
  window.setInterval(updateCountdown, 1000);
})();
