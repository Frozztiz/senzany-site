(() => {
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error || `API ${path} indisponible (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  window.SenzanyAPI = Object.freeze({
    discord: Object.freeze({
      getStats: () => request('/api/discord/stats'),
      unlink: () => request('/api/discord/unlink', { method: 'POST' })
    }),
    topServeurs: Object.freeze({
      getStats: () => request('/api/topserveurs/stats'),
      getMyVotes: () => request('/api/topserveurs/my-votes'),
      getVoteAliases: () => request('/api/topserveurs/aliases'),
      addVoteAlias: (alias) => request('/api/topserveurs/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias })
      }),
      deleteVoteAlias: (aliasId) => request(`/api/topserveurs/aliases/${encodeURIComponent(aliasId)}`, { method: 'DELETE' })
    }),
    game: Object.freeze({
      getStats: () => request('/api/game/stats')
    }),
    steam: Object.freeze({
      getMe: () => request('/api/steam/me')
    })
  });
})();
