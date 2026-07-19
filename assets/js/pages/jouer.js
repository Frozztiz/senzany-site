(() => {
  const SERVER_ADDRESS = '208.115.196.109:2302';
  const slotsElement = document.getElementById('slotsInfo');
  const mapElement = document.getElementById('serverMap');
  const capacityFill = document.getElementById('capacityFill');
  const statusDot = document.getElementById('serverStatusDot');
  const statusLabel = document.getElementById('serverStatusLabel');

  function copyServerAddress(button) {
    navigator.clipboard.writeText(SERVER_ADDRESS).then(() => {
      const initialText = button.textContent;
      button.textContent = 'Adresse copiée ✓';
      button.classList.add('is-copied');
      setTimeout(() => {
        button.textContent = initialText;
        button.classList.remove('is-copied');
      }, 2200);
    }).catch(() => {
      button.textContent = SERVER_ADDRESS;
    });
  }

  ['copyIpBtn', 'copyIpSecondary'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', () => copyServerAddress(button));
  });

  function formatMapName(value) {
    if (!value) return 'Chernarus+';
    const normalized = String(value).toLowerCase();
    if (normalized.includes('chernarus')) return 'Chernarus+';
    return String(value).replace(/_/g, ' ');
  }

  function animateCounter(target, max) {
    if (!slotsElement) return;
    const start = Number(slotsElement.dataset.players || 0);
    const duration = 700;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      slotsElement.textContent = `${current} / ${max}`;
      if (progress < 1) requestAnimationFrame(tick);
      else slotsElement.dataset.players = String(target);
    };

    requestAnimationFrame(tick);
  }

  function renderOffline() {
    if (slotsElement) slotsElement.textContent = 'Hors ligne';
    if (capacityFill) capacityFill.style.width = '0%';
    if (statusDot) statusDot.classList.add('is-offline');
    if (statusLabel) statusLabel.textContent = 'OFFLINE';
  }

  async function refreshServerStats() {
    try {
      const data = await window.SenzanyAPI.game.getStats();
      const valid = data.online && Number.isFinite(Number(data.players)) && Number.isFinite(Number(data.maxPlayers));
      if (!valid) return renderOffline();

      const players = Number(data.players);
      const maxPlayers = Number(data.maxPlayers) || 50;
      animateCounter(players, maxPlayers);

      if (capacityFill) {
        const percentage = Math.min((players / maxPlayers) * 100, 100);
        capacityFill.style.width = `${percentage}%`;
      }
      if (mapElement) mapElement.textContent = formatMapName(data.map);
      if (statusDot) statusDot.classList.remove('is-offline');
      if (statusLabel) statusLabel.textContent = 'LIVE';
    } catch (error) {
      renderOffline();
      console.warn('Stats DayZ indisponibles.', error);
    }
  }

  refreshServerStats();
  setInterval(refreshServerStats, 30000);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.16 });

  document.querySelectorAll('.access-step, .experience-list article, .video-grid').forEach((element) => observer.observe(element));
})();
