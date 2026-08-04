const express = require('express');
const eventService = require('../services/eventService');
const router = express.Router();
function fail(res, error) {
  console.error('[ÉVÉNEMENTS ADMIN]', error?.data || error);
  res.status(error?.status || 500).json({ error: error?.message || "Erreur dans le module Événements." });
}
router.get('/', async (_req, res) => { try { res.json({ events: await eventService.listAdmin() }); } catch (e) { fail(res, e); } });
router.post('/', async (req, res) => { try { res.status(201).json({ event: await eventService.create(req.body, req.commandSteamId) }); } catch (e) { fail(res, e); } });
router.put('/:id', async (req, res) => { try { res.json({ event: await eventService.update(req.params.id, req.body, req.commandSteamId) }); } catch (e) { fail(res, e); } });
router.post('/:id/reveal', async (req, res) => { try { res.json({ event: await eventService.revealNow(req.params.id, req.commandSteamId) }); } catch (e) { fail(res, e); } });
router.delete('/:id', async (req, res) => { try { await eventService.remove(req.params.id); res.status(204).end(); } catch (e) { fail(res, e); } });
module.exports = router;
