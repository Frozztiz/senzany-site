(() => {
  const copyButton = document.getElementById('copyIpBtn');
  if (copyButton) {
    copyButton.addEventListener('click', function copyIp() {
      navigator.clipboard.writeText('208.115.196.109:2302').then(() => {
        this.textContent = 'IP copiée ✓';
        setTimeout(() => { this.textContent = "Copier l'IP"; }, 2000);
      });
    });
  }

  async function refreshSlots() {
    const slotsElement = document.getElementById('slotsInfo');
    if (!slotsElement) return;

    try {
      const data = await window.SenzanyAPI.game.getStats();
      const hasPlayerCount = data.online &&
        data.players !== null && data.players !== undefined &&
        data.maxPlayers !== null && data.maxPlayers !== undefined;

      slotsElement.textContent = hasPlayerCount
        ? `${data.players} / ${data.maxPlayers}`
        : (data.online ? 'Bientôt disponible' : 'Hors ligne');
    } catch (error) {
      slotsElement.textContent = 'Bientôt disponible';
      console.warn('Stats DayZ indisponibles.', error);
    }
  }

  refreshSlots();
  setInterval(refreshSlots, 60000);
})();
