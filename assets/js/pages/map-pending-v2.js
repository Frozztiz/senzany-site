(() => {
  'use strict';

  const WORLD = 15360;
  const POLL_MS = 5000;

  function ensureStyles() {
    if (document.getElementById('senzanyPendingMapStyles')) return;
    const style = document.createElement('style');
    style.id = 'senzanyPendingMapStyles';
    style.textContent = `
      .senzany-pending-zone,
      .senzany-approved-zone {
        position:absolute;
        transform:translate(-50%,-50%);
        border-radius:50%;
        pointer-events:none;
        z-index:30;
        box-sizing:border-box;
      }
      .senzany-pending-zone {
        border:2px solid #d7a447;
        background:rgba(215,164,71,.18);
        box-shadow:0 0 0 2px rgba(0,0,0,.28);
      }
      .senzany-pending-zone::after {
        content:'';
        position:absolute;
        left:50%; top:50%;
        width:8px; height:8px;
        border-radius:50%;
        background:#d7a447;
        transform:translate(-50%,-50%);
      }
      .senzany-approved-zone {
        border:2px solid #d83c3c;
        background:rgba(216,60,60,.14);
        box-shadow:0 0 0 2px rgba(0,0,0,.28);
      }
      .senzany-approved-zone::after {
        content:'';
        position:absolute;
        left:50%; top:50%;
        width:8px; height:8px;
        border-radius:50%;
        background:#d83c3c;
        transform:translate(-50%,-50%);
      }
    `;
    document.head.appendChild(style);
  }

  function getLayer() {
    return document.getElementById('markerLayer');
  }

  function clearServerMarkers(layer) {
    layer.querySelectorAll('[data-senzany-server-zone="1"]').forEach(el => el.remove());
  }

  function placeCircle(layer, x, z, radiusM, className, title) {
    x = Number(x);
    z = Number(z);
    radiusM = Math.max(1, Math.min(60, Number(radiusM) || 60));

    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (x < 0 || x > WORLD || z < 0 || z > WORLD) return;

    const el = document.createElement('div');
    el.className = className;
    el.dataset.senzanyServerZone = '1';
    el.title = title || '';

    // markerLayer est superposé à l'image complète de Chernarus.
    el.style.left = `${(x / WORLD) * 100}%`;
    el.style.top = `${(1 - (z / WORLD)) * 100}%`;

    // diamètre exact en proportion du monde, avec un minimum visible.
    const pct = (radiusM * 2 / WORLD) * 100;
    el.style.width = `max(${pct}%, 12px)`;
    el.style.height = `max(${pct}%, 12px)`;

    layer.appendChild(el);
  }

  async function refresh() {
    const layer = getLayer();
    if (!layer) return;

    try {
      const response = await fetch('/api/map', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;

      const data = await response.json();
      clearServerMarkers(layer);

      const requests = Array.isArray(data.requests) ? data.requests : [];
      requests
        .filter(r => String(r.status || 'pending') === 'pending')
        .forEach(r => placeCircle(
          layer,
          r.center_x,
          r.center_z,
          r.radius_m,
          'senzany-pending-zone',
          'Demande en attente'
        ));

      const zones = Array.isArray(data.zones) ? data.zones : [];
      zones
        .filter(z => String(z.public_status || '') === 'validated')
        .forEach(z => placeCircle(
          layer,
          z.center_x,
          z.center_z,
          z.radius_m,
          'senzany-approved-zone',
          'Zone occupée'
        ));
    } catch (error) {
      console.warn('[Senzany Map] Impossible de charger les zones publiques :', error);
    }
  }

  function boot() {
    ensureStyles();
    refresh();
    setInterval(refresh, POLL_MS);

    // Après l'envoi d'une nouvelle demande, la nouvelle zone remonte rapidement.
    document.addEventListener('click', (event) => {
      if (event.target && event.target.id === 'submitPlacementBtn') {
        setTimeout(refresh, 1200);
        setTimeout(refresh, 3000);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
