const discordService = require("../services/discordService");

exports.status = async (req, res) => {
  try {
    const result = await discordService.getStatus();
    res.json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Erreur Discord",
    });
  }
};

exports.stats = async (req, res) => {
  res.json({
    online: true,
    members: null,
    message: "Discord stats route prête",
  });
};