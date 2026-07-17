// Utilise le token du bot Discord (gardé secret côté serveur) pour récupérer
// les vraies statistiques du serveur : nombre total de membres et de
// membres en ligne. Le token n'est jamais exposé au navigateur.

const DISCORD_GUILD_ID = "1371834363213385819";

exports.handler = async function () {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!botToken) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "DISCORD_BOT_TOKEN manquant sur Netlify." }),
    };
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}?with_counts=true`,
      {
        headers: { Authorization: `Bot ${botToken}` },
      }
    );

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Discord a refusé la requête (bot pas sur le serveur ?)." }),
      };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
      },
      body: JSON.stringify({
        memberCount: data.approximate_member_count,
        onlineCount: data.approximate_presence_count,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Impossible de contacter Discord." }),
    };
  }
};
