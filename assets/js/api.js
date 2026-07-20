(() => {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options
    });

    if (!response.ok) {
      throw new Error(`API ${path} indisponible (${response.status})`);
    }

    return response.json();
  }

  window.SenzanyAPI = Object.freeze({
    discord: Object.freeze({
      getStats: () => request('/api/discord/stats'),
      unlink: () => request('/api/discord/unlink', { method: 'POST' })
    }),
    topServeurs: Object.freeze({
      getStats: () => request('/api/topserveurs/stats'),
      getMyVotes: () => request('/api/topserveurs/my-votes')
    }),
    game: Object.freeze({
      getStats: () => request('/api/game/stats')
    }),
    steam: Object.freeze({
      getMe: () => request('/api/steam/me')
    })
  });
})();
