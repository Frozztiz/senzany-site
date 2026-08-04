const supabaseService = require('./supabaseService');

const TABLE = 'events';
const ALLOWED_TYPES = new Set(['major', 'community', 'vote', 'seasonal']);
const ALLOWED_STATUS = new Set(['draft', 'published', 'cancelled', 'completed']);
const IMAGE_BUCKET = 'event-images';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);
function storageConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { const e = new Error('Configuration Supabase manquante.'); e.status = 500; throw e; }
  return { url, key };
}
function safeFilename(value='image') {
  const cleaned = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
  return cleaned || 'image';
}
async function uploadImage(buffer, contentType, originalName, actor) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) { const e = new Error('Aucune image reçue.'); e.status = 400; throw e; }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) { const e = new Error('Format d’image refusé.'); e.status = 415; throw e; }
  if (buffer.length > 5 * 1024 * 1024) { const e = new Error('L’image dépasse 5 Mo.'); e.status = 413; throw e; }
  const { url, key } = storageConfig();
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const base = safeFilename(String(originalName || 'event').replace(/\.[^.]+$/, ''));
  const folder = actor ? safeFilename(actor) : 'commandement';
  const path = `${folder}/${Date.now()}-${base}.${ext}`;
  const response = await fetch(`${url}/storage/v1/object/${IMAGE_BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'false' },
    body: buffer,
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) { const e = new Error(data.message || data.error || `Supabase Storage HTTP ${response.status}`); e.status = response.status; e.data = data; throw e; }
  return { path, url: `${url}/storage/v1/object/public/${IMAGE_BUCKET}/${encodeURI(path)}` };
}


function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}
function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}
function iso(value, field, required = false) {
  if (!value && !required) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} est invalide.`);
    error.status = 400;
    throw error;
  }
  return date.toISOString();
}
function parseInteger(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validatePayload(input = {}) {
  const title = cleanText(input.title, 120);
  if (title.length < 2) {
    const error = new Error("Le nom de l'événement doit contenir au moins 2 caractères.");
    error.status = 400;
    throw error;
  }
  const eventType = cleanText(input.eventType ?? input.event_type, 30) || 'community';
  if (!ALLOWED_TYPES.has(eventType)) {
    const error = new Error("Type d'événement invalide.");
    error.status = 400;
    throw error;
  }
  const status = cleanText(input.status, 20) || 'draft';
  if (!ALLOWED_STATUS.has(status)) {
    const error = new Error("Statut d'événement invalide.");
    error.status = 400;
    throw error;
  }
  const startsAt = iso(input.startsAt ?? input.starts_at, 'La date de début', true);
  const endsAt = iso(input.endsAt ?? input.ends_at, 'La date de fin');
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    const error = new Error('La date de fin doit être postérieure au début.');
    error.status = 400;
    throw error;
  }
  const isMystery = bool(input.isMystery ?? input.is_mystery, false);
  let revealAt = iso(input.revealAt ?? input.reveal_at, 'La date de révélation');
  if (isMystery && !revealAt) {
    revealAt = new Date(new Date(startsAt).getTime() - 7 * 86400000).toISOString();
  }
  if (revealAt && new Date(revealAt) >= new Date(startsAt)) {
    const error = new Error("La révélation doit avoir lieu avant le début de l'événement.");
    error.status = 400;
    throw error;
  }
  const voteMilestone = parseInteger(input.voteMilestone ?? input.vote_milestone, null);
  return {
    title,
    mystery_title: cleanText(input.mysteryTitle ?? input.mystery_title, 120) || 'Événement mystère',
    event_type: eventType,
    status,
    starts_at: startsAt,
    ends_at: endsAt,
    reveal_at: revealAt,
    is_mystery: isMystery,
    description: cleanText(input.description, 2500),
    location: cleanText(input.location, 180),
    rewards: cleanText(input.rewards, 1200),
    image_url: cleanText(input.imageUrl ?? input.image_url, 600),
    vote_milestone: eventType === 'vote' ? Math.max(1000, voteMilestone || 1000) : null,
    is_featured: bool(input.isFeatured ?? input.is_featured, false),
    updated_at: new Date().toISOString(),
  };
}

function isRevealed(row, now = new Date()) {
  if (!row.is_mystery) return true;
  if (!row.reveal_at) return false;
  return new Date(row.reveal_at) <= now;
}
function toPublic(row) {
  const revealed = isRevealed(row);
  return {
    id: row.id,
    title: revealed ? row.title : (row.mystery_title || 'Événement mystère'),
    eventType: row.event_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revealAt: row.reveal_at,
    mystery: Boolean(row.is_mystery),
    revealed,
    description: revealed ? row.description : '',
    location: revealed ? row.location : '',
    rewards: revealed ? row.rewards : '',
    imageUrl: revealed ? row.image_url : '',
    voteMilestone: row.vote_milestone,
    featured: Boolean(row.is_featured),
  };
}

async function listAdmin() {
  const rows = await supabaseService.request(`${TABLE}?select=*&order=starts_at.asc`, { method: 'GET' });
  return Array.isArray(rows) ? rows : [];
}
async function listPublic({ from, to } = {}) {
  const filters = ['status=eq.published'];
  if (from) filters.push(`starts_at=gte.${encodeURIComponent(iso(from, 'Date de début'))}`);
  if (to) filters.push(`starts_at=lte.${encodeURIComponent(iso(to, 'Date de fin'))}`);
  const rows = await supabaseService.request(`${TABLE}?select=*&${filters.join('&')}&order=starts_at.asc`, { method: 'GET' });
  return (Array.isArray(rows) ? rows : []).map(toPublic);
}
async function create(input, actor) {
  const payload = { ...validatePayload(input), created_by: actor || null };
  const rows = await supabaseService.request(TABLE, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  return rows?.[0] || rows;
}
async function update(id, input, actor) {
  const payload = { ...validatePayload(input), updated_by: actor || null };
  const rows = await supabaseService.request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
  if (!rows?.length) { const error = new Error('Événement introuvable.'); error.status = 404; throw error; }
  return rows[0];
}
async function revealNow(id, actor) {
  const rows = await supabaseService.request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ reveal_at: new Date().toISOString(), updated_by: actor || null, updated_at: new Date().toISOString() }) });
  if (!rows?.length) { const error = new Error('Événement introuvable.'); error.status = 404; throw error; }
  return rows[0];
}
async function remove(id) {
  await supabaseService.request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}
module.exports = { listAdmin, listPublic, create, update, revealNow, remove, validatePayload, uploadImage };
