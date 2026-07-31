const rconService = require("../services/rconService");

async function testRcon(req, res) {
  if (String(process.env.RCON_TEST_ENABLED || "false").toLowerCase() !== "true") {
    return res.status(404).json({
      ok: false,
      error: "Le test RCON est désactivé."
    });
  }

  try {
    const result = await rconService.testPlayersCommand();

    return res.json({
      ok: true,
      environment: process.env.DAYZ_RCON_ENVIRONMENT || "test",
      ...result
    });
  } catch (error) {
    console.error("Échec du test RCON :", error.message);

    return res.status(502).json({
      ok: false,
      environment: process.env.DAYZ_RCON_ENVIRONMENT || "test",
      error: error.message
    });
  }
}

module.exports = {
  testRcon
};
