router.get("/my-votes", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      return res.status(500).json({
        error: "SESSION_SECRET manquant.",
      });
    }

    const steamId = verifySteamId(
      req.cookies?.senzany_session,
      secret
    );

    if (!steamId) {
      return res.status(401).json({
        error: "Connexion Steam requise.",
      });
    }

    const discordLink =
      await supabaseService.getLinkBySteamId(steamId);

    if (!discordLink?.discord_id) {
      return res.json({
        linked: false,
        found: false,
        votes: null,
        position: null,
      });
    }

    console.log("==== MY VOTES ====");
    console.log({
      discordId: discordLink.discord_id,
      discordUsername: discordLink.discord_username,
    });

    const result =
      await topServeursService.getPlayerVotes({
        discordId: discordLink.discord_id,
        discordUsername: discordLink.discord_username,
      });

    return res.json(result);
  } catch (err) {
    console.error("Top-Serveurs my-votes:", err);

    return res.status(502).json({
      error: "Classement Top-Serveurs indisponible.",
    });
  }
});