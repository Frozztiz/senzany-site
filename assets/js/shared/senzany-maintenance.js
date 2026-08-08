
(() => {
  const PARAM = 'senzany-preview';
  const KEY = 'senzany_private_preview';

  const params = new URLSearchParams(location.search);
  if (params.get(PARAM) === '1') {
    sessionStorage.setItem(KEY, '1');
    params.delete(PARAM);
    const clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', clean);
  }
  if (params.get(PARAM) === 'off') {
    sessionStorage.removeItem(KEY);
    params.delete(PARAM);
    const clean = location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash;
    history.replaceState(null, '', clean);
  }

  if (sessionStorage.getItem(KEY) === '1') return;

  document.documentElement.classList.add('senzany-maintenance-active');

  const mount = () => {
    if (document.getElementById('senzany-maintenance')) return;
    const gate = document.createElement('div');
    gate.id = 'senzany-maintenance';
    gate.setAttribute('role','dialog');
    gate.setAttribute('aria-modal','true');
    gate.innerHTML = `
      <div class="sz-maintenance__frame">
        <div class="sz-maintenance__eyebrow">TRANSMISSION // SENZANY NETWORK</div>
        <h1 class="sz-maintenance__brand">SENZANY</h1>
        <div class="sz-maintenance__rule"></div>
        <h2 class="sz-maintenance__title">TRANSMISSION INTERROMPUE</h2>
        <p class="sz-maintenance__copy">
          Le monde évolue. Nous aussi.<br>
          Une nouvelle expérience Senzany est actuellement en cours de déploiement.
        </p>
        <div class="sz-maintenance__status">
          <span class="sz-maintenance__dot"></span>
          <span>RECONSTRUCTION EN COURS</span>
          <span class="sz-maintenance__code">RECONNEXION PROCHAINE</span>
        </div>
      </div>`;
    document.body.appendChild(gate);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
