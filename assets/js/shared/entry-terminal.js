(() => {
  'use strict';

  const STORAGE_KEY = 'senzanyEntryTerminalSeen';
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const skipTerminal = params.has('intro') || params.has('resetintro') || params.has('skipterminal');
  const forceTerminal = params.has('terminal') || params.has('resetterminal');
  const alreadySeen = sessionStorage.getItem(STORAGE_KEY) === 'true';
  const shouldShow = !skipTerminal && (forceTerminal || !alreadySeen);

  if (!shouldShow) {
    root.classList.remove('senzany-terminal-pending');
    return;
  }

  const terminal = document.createElement('section');
  terminal.className = 'senzany-entry-terminal';
  terminal.setAttribute('aria-label', 'Initialisation du terminal militaire Senzany');
  terminal.innerHTML = `
    <div class="entry-terminal__room" role="dialog" aria-modal="true" aria-labelledby="entry-terminal-title">
      <img
        class="entry-terminal__background"
        src="assets/images/backgrounds/soviet-terminal.png"
        alt="Ancien poste de communication militaire soviétique dans un bunker"
        draggable="false"
      >

      <div class="entry-terminal__dust" aria-hidden="true"></div>
      <div class="entry-terminal__lamp-glow" aria-hidden="true"></div>
      <div class="entry-terminal__power-glow" aria-hidden="true"></div>
      <div class="entry-terminal__radio-pulse" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

      <div class="entry-terminal__screen-wrap">
        <div class="entry-terminal__screen-shade" aria-hidden="true"></div>
        <div class="entry-terminal__scanlines" aria-hidden="true"></div>
        <div class="entry-terminal__flicker" aria-hidden="true"></div>

        <div class="entry-terminal__screen-content">
          <header class="entry-terminal__screen-header">
            <span id="entry-terminal-title">TERMINAL SENZANY</span>
            <span>POSTE KM-8 / 42</span>
          </header>

          <p class="entry-terminal__designation">RÉSEAU SÉCURISÉ // LIGNE CHERNARUS</p>
          <div class="entry-terminal__log" aria-live="polite"></div>

          <div class="entry-terminal__ready" hidden>
            <p class="entry-terminal__ready-label">
              <span>SYSTÈME PRÊT</span>
              <i class="entry-terminal__cursor" aria-hidden="true"></i>
            </p>
            <button class="entry-terminal__button" type="button">
              <span class="entry-terminal__button-prefix">&gt;&gt;</span>
              <span>ACCÉDER AU TERMINAL</span>
              <i class="entry-terminal__cursor" aria-hidden="true"></i>
            </button>
            <p class="entry-terminal__hint">Connexion sécurisée au portail Senzany</p>
          </div>

          <footer class="entry-terminal__screen-footer">
            <span>RÉSEAU : CHERNARUS</span>
            <span class="entry-terminal__clock">--:--:--</span>
          </footer>
        </div>

        <div class="entry-terminal__grant" aria-hidden="true">
          <span>ACCÈS AUTORISÉ</span>
          <small>BIENVENUE SUR SENZANY</small>
        </div>
      </div>
    </div>`;

  document.body.prepend(terminal);
  root.classList.remove('senzany-terminal-pending');
  root.classList.add('senzany-terminal-active');

  const log = terminal.querySelector('.entry-terminal__log');
  const ready = terminal.querySelector('.entry-terminal__ready');
  const button = terminal.querySelector('.entry-terminal__button');
  const clock = terminal.querySelector('.entry-terminal__clock');

  const lines = [
    'MISE SOUS TENSION DU TERMINAL',
    'CONTRÔLE DES MODULES SYSTÈME',
    'ÉTABLISSEMENT DE LA LIAISON SÉCURISÉE',
    'CONNEXION AU RÉSEAU CHERNARUS',
    'VÉRIFICATION DE L’INTÉGRITÉ DU MONDE',
    'SYNCHRONISATION DES DONNÉES SENZANY'
  ];

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  const updateClock = () => {
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const typeText = async (element, text, speed = 18) => {
    for (const character of text) {
      element.textContent += character;
      const naturalPause = character === ' ' ? 8 : Math.floor(Math.random() * 10);
      await wait(speed + naturalPause);
    }
  };

  const addLine = async (textValue) => {
    const line = document.createElement('div');
    line.className = 'entry-terminal__line';
    line.innerHTML = `
      <div class="entry-terminal__line-main">
        <span class="entry-terminal__prompt">&gt;</span>
        <span class="entry-terminal__typed"></span>
        <span class="entry-terminal__working">...</span>
        <strong class="entry-terminal__ok">OK</strong>
      </div>`;

    log.appendChild(line);

    const typed = line.querySelector('.entry-terminal__typed');
    const working = line.querySelector('.entry-terminal__working');
    const ok = line.querySelector('.entry-terminal__ok');

    await typeText(typed, textValue, 18);
    working.classList.add('is-active');
    await wait(240 + Math.floor(Math.random() * 150));
    working.classList.remove('is-active');
    working.hidden = true;
    ok.classList.add('is-visible');
    await wait(210);
  };

  const run = async () => {
    await wait(780);

    for (const line of lines) {
      await addLine(line);
    }

    await wait(420);
    ready.hidden = false;
    window.setTimeout(() => button.focus({ preventScroll: true }), 320);
  };

  const access = () => {
    if (!button || button.disabled) return;
    button.disabled = true;
    sessionStorage.setItem(STORAGE_KEY, 'true');
    terminal.classList.add('is-granted');

    window.setTimeout(() => {
      window.__senzanyTerminalRequestedIntro = true;
      window.dispatchEvent(new CustomEvent('senzany:terminal-access'));
      terminal.classList.add('is-leaving');
      root.classList.remove('senzany-terminal-active');
    }, 1150);

    window.setTimeout(() => terminal.remove(), 1900);
  };

  button?.addEventListener('pointerdown', (event) => event.stopPropagation());
  button?.addEventListener('click', access);

  updateClock();
  window.setInterval(updateClock, 1000);
  run();
})();
