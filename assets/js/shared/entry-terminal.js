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
  terminal.setAttribute('aria-label', 'Initialisation du terminal sécurisé Senzany');
  terminal.innerHTML = `
    <div class="entry-terminal__machine">
      <div class="entry-terminal__screen">
        <div class="entry-terminal__scanlines" aria-hidden="true"></div>
        <div class="entry-terminal__flicker" aria-hidden="true"></div>

        <header class="entry-terminal__header">
          <span class="entry-terminal__status">
            <i class="entry-terminal__status-dot" aria-hidden="true"></i>
            SENZANY SECURE TERMINAL
          </span>
          <span class="entry-terminal__version">SYS // 2.5</span>
        </header>

        <div class="entry-terminal__content">
          <h1 class="entry-terminal__title">SYSTEM INITIALIZATION</h1>
          <div class="entry-terminal__log" aria-live="polite"></div>

          <div class="entry-terminal__ready" hidden>
            <p class="entry-terminal__ready-label">SYSTEM READY <i class="entry-terminal__cursor" aria-hidden="true"></i></p>
            <button class="entry-terminal__button" type="button">
              <span>&gt;</span>
              <span>ACCÉDER AU TERMINAL</span>
              <i class="entry-terminal__cursor" aria-hidden="true"></i>
            </button>
            <p class="entry-terminal__hint">Connexion au portail Senzany</p>
          </div>
        </div>

        <footer class="entry-terminal__footer">
          <span>CHERNARUS NETWORK</span>
          <span class="entry-terminal__clock">--:--:--</span>
        </footer>

        <div class="entry-terminal__grant" aria-hidden="true">ACCESS GRANTED</div>
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
    'INITIALIZING BIOS',
    'LOADING SECURE MODULES',
    'CONNECTING TO CHERNARUS',
    'VERIFYING WORLD INTEGRITY',
    'ESTABLISHING SECURE CONNECTION'
  ];

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  const updateClock = () => {
    clock.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const addLine = (label) => {
    const line = document.createElement('div');
    line.className = 'entry-terminal__line';
    line.innerHTML = `
      <span class="entry-terminal__prompt">&gt;</span>
      <span>${label}</span>
      <span class="entry-terminal__dots">........................................</span>
      <strong class="entry-terminal__ok">OK</strong>`;
    log.appendChild(line);
  };

  const run = async () => {
    await wait(520);
    for (const label of lines) {
      addLine(label);
      await wait(300);
    }
    await wait(180);
    ready.hidden = false;
    window.setTimeout(() => button.focus({ preventScroll: true }), 120);
  };

  const access = () => {
    if (button.disabled) return;
    button.disabled = true;
    sessionStorage.setItem(STORAGE_KEY, 'true');
    terminal.classList.add('is-granted');

    window.setTimeout(() => {
      window.__senzanyTerminalRequestedIntro = true;
      window.dispatchEvent(new CustomEvent('senzany:terminal-access'));
      terminal.classList.add('is-leaving');
      root.classList.remove('senzany-terminal-active');
    }, 650);

    window.setTimeout(() => terminal.remove(), 1180);
  };

  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', access);

  updateClock();
  window.setInterval(updateClock, 1000);
  run();
})();
