const express = require('express');
const eventService = require('../services/eventService');
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const events = await eventService.listPublic({ from: req.query.from, to: req.query.to });
    res.json({ events, now: new Date().toISOString() });
  } catch (error) {
    console.error('[ÉVÉNEMENTS PUBLICS]', error?.data || error);
    res.status(error?.status || 500).json({ error: error?.message || 'Impossible de charger les événements.' });
  }
});
module.exports = router;
