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
      <img class="entry-terminal__background" src="assets/images/backgrounds/soviet-terminal.png" alt="Ancien terminal militaire dans un bunker" draggable="false">

      <div class="entry-terminal__dust" aria-hidden="true"></div>
      <div class="entry-terminal__lamp-glow" aria-hidden="true"></div>
      <div class="entry-terminal__power-glow" aria-hidden="true"></div>
      <div class="entry-terminal__left-leds" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="entry-terminal__radio-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="entry-terminal__camera-noise" aria-hidden="true"></div>

      <div class="entry-terminal__screen-wrap">
        <div class="entry-terminal__screen-shade" aria-hidden="true"></div>
        <div class="entry-terminal__scanlines" aria-hidden="true"></div>
        <div class="entry-terminal__screen-roll" aria-hidden="true"></div>
        <div class="entry-terminal__flicker" aria-hidden="true"></div>

        <div class="entry-terminal__screen-content">
          <header class="entry-terminal__screen-header">
            <span id="entry-terminal-title">TERMINAL SENZANY</span>
            <span>V1.2</span>
          </header>

          <p class="entry-terminal__designation">INITIALISATION DU SYSTÈME</p>

          <div class="entry-terminal__main-grid">
            <div class="entry-terminal__left-column">
              <div class="entry-terminal__log" aria-live="polite"></div>

              <div class="entry-terminal__connection" hidden>
                <div class="entry-terminal__connection-head">
                  <span>CONNEXION AU PORTAIL SENZANY</span>
                  <strong class="entry-terminal__percent">0%</strong>
                </div>
                <div class="entry-terminal__progress"><i></i></div>
              </div>
            </div>

            <aside class="entry-terminal__telemetry" aria-hidden="true">
              <div class="entry-terminal__radar">
                <i class="entry-terminal__radar-sweep"></i>
                <b class="entry-terminal__radar-dot dot-1"></b>
                <b class="entry-terminal__radar-dot dot-2"></b>
                <b class="entry-terminal__radar-dot dot-3"></b>
              </div>
              <div class="entry-terminal__signal-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
              <div class="entry-terminal__telemetry-text">
                <span>SIGNAL <b>STABLE</b></span>
                <span>CRYPTAGE <b>ACTIF</b></span>
              </div>
            </aside>
          </div>

          <div class="entry-terminal__ready" hidden>
            <div class="entry-terminal__access-state">
              <span>✓ ACCÈS AUTORISÉ</span>
              <small>PRÊT POUR L’ACCÈS</small>
            </div>
            <button class="entry-terminal__button" type="button">
              <span class="entry-terminal__button-prefix">&gt;</span>
              <span>ACCÉDER AU TERMINAL</span>
              <span class="entry-terminal__button-chevron">&lt;&lt;</span>
            </button>
          </div>

          <footer class="entry-terminal__screen-footer">
            <span>RÉSEAU CHERNARUS // PROTOCOLE SÉCURISÉ</span>
            <span class="entry-terminal__clock">--:--:--</span>
          </footer>
        </div>

        <div class="entry-terminal__grant" aria-hidden="true">
          <span>ACCÈS AUTORISÉ</span>
          <small>OUVERTURE DU PORTAIL SENZANY</small>
        </div>
      </div>
    </div>`;

  document.body.prepend(terminal);
  root.classList.remove('senzany-terminal-pending');
  root.classList.add('senzany-terminal-active');

  const log = terminal.querySelector('.entry-terminal__log');
  const ready = terminal.querySelector('.entry-terminal__ready');
  const connection = terminal.querySelector('.entry-terminal__connection');
  const progressFill = terminal.querySelector('.entry-terminal__progress i');
  const percent = terminal.querySelector('.entry-terminal__percent');
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

  const typeText = async (element, text) => {
    for (const character of text) {
      element.textContent += character;
      // Rapide mais encore lisible : 7 à 12 ms par caractère.
      await wait(character === ' ' ? 5 : 7 + Math.floor(Math.random() * 6));
    }
  };

  const addLine = async (textValue) => {
    const line = document.createElement('div');
    line.className = 'entry-terminal__line';
    line.innerHTML = `
      <span class="entry-terminal__prompt">&gt;</span>
      <span class="entry-terminal__typed"></span>
      <span class="entry-terminal__dots">............</span>
      <strong class="entry-terminal__ok">[ OK ]</strong>`;
    log.appendChild(line);

    const typed = line.querySelector('.entry-terminal__typed');
    const ok = line.querySelector('.entry-terminal__ok');

    await typeText(typed, textValue);
    await wait(65 + Math.floor(Math.random() * 65));
    ok.classList.add('is-visible');
    terminal.classList.add('has-signal-pulse');
    window.setTimeout(() => terminal.classList.remove('has-signal-pulse'), 120);
    await wait(95);
  };

  const animateProgress = async () => {
    connection.hidden = false;
    const duration = 720;
    const start = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        const ratio = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - ratio, 3);
        const value = Math.round(eased * 100);
        progressFill.style.width = `${value}%`;
        percent.textContent = `${value}%`;
        if (ratio < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  };

  const run = async () => {
    await wait(520);
    for (const line of lines) await addLine(line);
    await animateProgress();
    await wait(180);
    ready.hidden = false;
    window.setTimeout(() => button?.focus({ preventScroll: true }), 240);
  };

  const access = () => {
    if (!button || button.disabled) return;
    button.disabled = true;
    sessionStorage.setItem(STORAGE_KEY, 'true');
    terminal.classList.add('is-granted');

    // Le terminal reste affiché tant que la cinématique n'est pas réellement
    // prête à recouvrir l'écran. Cela empêche toute apparition de l'accueil.
    const revealIntro = () => {
      window.removeEventListener('senzany:intro-ready', revealIntro);
      terminal.classList.add('is-leaving');
      root.classList.remove('senzany-terminal-active');
      window.setTimeout(() => terminal.remove(), 700);
    };

    window.addEventListener('senzany:intro-ready', revealIntro, { once: true });

    window.setTimeout(() => {
      window.__senzanyTerminalRequestedIntro = true;
      window.dispatchEvent(new CustomEvent('senzany:terminal-access'));
    }, 900);
  };

  button?.addEventListener('pointerdown', (event) => event.stopPropagation());
  button?.addEventListener('click', access);

  updateClock();
  window.setInterval(updateClock, 1000);
  run();
})();
