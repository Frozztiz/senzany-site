// Interroge l'API Steam (liste des serveurs de jeu) pour récupérer le
// nombre réel de joueurs connectés sur le serveur Senzany, en direct.

const SERVER_ADDR = "208.115.196.109:2302";

exports.handler = async function () {
  const apiKey = process.env.STEAM_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "STEAM_API_KEY manquant sur Netlify." }),
    };
  }

  try {
    const filter = encodeURIComponent(`\\gameaddr\\${SERVER_ADDR}`);
    const res = await fetch(
      `https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${apiKey}&filter=${filter}&limit=1`
    );

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Steam a refusé la requête." }),
      };
    }

    const data = await res.json();
    const servers = data.response && data.response.servers;

    if (!servers || servers.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online: false }),
      };
    }

    const server = servers[0];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: JSON.stringify({
        online: true,
        players: server.players,
        maxPlayers: server.max_players,
        map: server.map,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Impossible de contacter Steam." }),
    };
  }
};
