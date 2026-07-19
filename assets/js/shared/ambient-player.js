(() => {
  'use strict';

  if (window.__senzanyAmbientPlayerLoaded) return;
  window.__senzanyAmbientPlayerLoaded = true;

  const STORAGE = {
    enabled: 'senzanyAmbientEnabled',
    muted: 'senzanyAmbientMuted',
    volume: 'senzanyAmbientVolume',
    position: 'senzanyAmbientPosition',
    introSeen: 'senzanyAmbientIntroSeenV3'
  };

  const DEFAULT_VOLUME = 0.22;
  const FADE_DURATION = 700;
  const AUDIO_URL = 'assets/audio/senzany-wasteland-ambient.mp3';

  const icons = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm12.5 3a3.5 3.5 0 0 0-2-3.16v6.32A3.5 3.5 0 0 0 15.5 12zm-2-8.77v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.7-2.7-1.42-1.42-2.7 2.7-2.7-2.7-1.42 1.42 2.7 2.7-2.7 2.7 1.42 1.42 2.7-2.7 2.7 2.7 1.42-1.42z"/></svg>'
  };

  const readBoolean = (key, fallback) => {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  };

  const readNumber = (key, fallback) => {
    const value = Number.parseFloat(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  };

  const player = document.createElement('aside');
  player.className = 'senzany-ambient-player';
  player.setAttribute('aria-label', 'Lecteur de musique d’ambiance');
  player.innerHTML = `
    <button class="ambient-main-button" type="button" aria-label="Activer la musique" title="Lecture / pause">
      ${icons.play}
    </button>
    <div class="ambient-content">
      <div class="ambient-eyebrow">
        <span class="ambient-equalizer" aria-hidden="true"><span></span><span></span><span></span></span>
        Ambiance Senzany
      </div>
      <div class="ambient-title">Wasteland Ambient</div>
      <div class="ambient-controls-row">
        <input class="ambient-volume" type="range" min="0" max="100" step="1" aria-label="Volume de la musique">
        <span class="ambient-status">Désactivée</span>
      </div>
    </div>
    <button class="ambient-mute-button" type="button" aria-label="Couper le son" title="Couper / rétablir le son">
      ${icons.volume}
    </button>
  `;
  document.body.appendChild(player);

  const intro = document.createElement('div');
  intro.className = 'senzany-audio-intro';
  intro.setAttribute('aria-hidden', 'true');
  intro.innerHTML = `
    <div class="senzany-audio-intro__fog senzany-audio-intro__fog--back" aria-hidden="true"></div>
    <div class="senzany-audio-intro__fog senzany-audio-intro__fog--front" aria-hidden="true"></div>
    <div class="senzany-audio-intro__content">
      <div class="senzany-audio-intro__brand">SENZANY</div>
      <div class="senzany-audio-intro__line"></div>
      <div class="senzany-audio-intro__tagline">VOICI LE RÉCIT DE VOTRE MORT</div>
    </div>
  `;
  document.body.appendChild(intro);

  const playButton = player.querySelector('.ambient-main-button');
  const muteButton = player.querySelector('.ambient-mute-button');
  const volumeInput = player.querySelector('.ambient-volume');
  const status = player.querySelector('.ambient-status');

  const audio = new Audio(AUDIO_URL);
  audio.loop = true;
  audio.preload = 'metadata';
  audio.playsInline = true;

  const storedEnabled = localStorage.getItem(STORAGE.enabled);
  let enabled = storedEnabled === null ? true : storedEnabled === 'true';
  let introPending = localStorage.getItem(STORAGE.introSeen) !== 'true';
  let muted = readBoolean(STORAGE.muted, false);
  let preferredVolume = Math.min(1, Math.max(0, readNumber(STORAGE.volume, DEFAULT_VOLUME)));
  let fadeFrame = null;
  let waitingForInteraction = enabled;

  audio.muted = muted;
  audio.volume = enabled ? preferredVolume : 0;
  volumeInput.value = String(Math.round(preferredVolume * 100));

  const savePosition = () => {
    if (Number.isFinite(audio.currentTime)) {
      localStorage.setItem(STORAGE.position, String(audio.currentTime));
    }
  };

  const setPositionWhenReady = () => {
    const savedPosition = Math.max(0, readNumber(STORAGE.position, 0));
    if (audio.duration && Number.isFinite(audio.duration)) {
      audio.currentTime = savedPosition % audio.duration;
    }
  };

  const updateUi = () => {
    const isPlaying = enabled && !audio.paused;
    player.classList.toggle('is-playing', isPlaying);
    player.classList.toggle('is-muted', muted || preferredVolume === 0);
    playButton.innerHTML = isPlaying ? icons.pause : icons.play;
    playButton.setAttribute('aria-label', isPlaying ? 'Mettre la musique en pause' : 'Activer la musique');
    muteButton.innerHTML = (muted || preferredVolume === 0) ? icons.muted : icons.volume;
    muteButton.setAttribute('aria-label', muted ? 'Rétablir le son' : 'Couper le son');
    status.textContent = isPlaying ? 'En lecture' : (waitingForInteraction ? 'Cliquer pour écouter' : 'Désactivée');
  };

  const showIntroOnce = () => {
    if (localStorage.getItem(STORAGE.introSeen) === 'true') return false;
    if (!document.body.contains(intro)) document.body.appendChild(intro);

    intro.classList.remove('is-leaving');
    // Deux frames garantissent que le navigateur applique d'abord l'état caché,
    // puis l'état visible et lance bien la transition CSS.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => intro.classList.add('is-visible'));
    });

    window.setTimeout(() => intro.classList.add('is-leaving'), 5600);
    window.setTimeout(() => {
      localStorage.setItem(STORAGE.introSeen, 'true');
      intro.classList.remove('is-visible', 'is-leaving');
      intro.remove();
    }, 7200);

    return true;
  };

  const fadeTo = (target, duration = FADE_DURATION, onComplete) => {
    if (fadeFrame) cancelAnimationFrame(fadeFrame);
    const start = audio.volume;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      audio.volume = start + (target - start) * progress;
      if (progress < 1) {
        fadeFrame = requestAnimationFrame(tick);
      } else {
        fadeFrame = null;
        if (typeof onComplete === 'function') onComplete();
      }
    };

    fadeFrame = requestAnimationFrame(tick);
  };

  const startPlayback = async (withFade = true, fromUserInteraction = false) => {
    enabled = true;
    waitingForInteraction = false;
    localStorage.setItem(STORAGE.enabled, 'true');

    // L'intro doit partir pendant le geste utilisateur, sans attendre la promesse audio.
    // Cela évite qu'elle soit perdue si le navigateur retarde ou refuse audio.play().
    if (fromUserInteraction && introPending) {
      introPending = false;
      showIntroOnce();
    }

    try {
      if (withFade) audio.volume = 0;
      await audio.play();
      fadeTo(muted ? 0 : preferredVolume, withFade ? FADE_DURATION : 150);
    } catch (error) {
      waitingForInteraction = true;
      // Si la lecture a échoué, on permettra une nouvelle tentative d'intro.
      if (localStorage.getItem(STORAGE.introSeen) !== 'true') introPending = true;
    }
    updateUi();
  };

  const stopPlayback = () => {
    enabled = false;
    waitingForInteraction = false;
    localStorage.setItem(STORAGE.enabled, 'false');
    fadeTo(0, 450, () => {
      audio.pause();
      updateUi();
    });
    updateUi();
  };

  playButton.addEventListener('click', () => {
    if (enabled && !audio.paused) stopPlayback();
    else startPlayback(true, true);
  });

  muteButton.addEventListener('click', () => {
    muted = !muted;
    audio.muted = muted;
    localStorage.setItem(STORAGE.muted, String(muted));
    if (enabled && !audio.paused) fadeTo(muted ? 0 : preferredVolume, 250);
    updateUi();
  });

  volumeInput.addEventListener('input', () => {
    preferredVolume = Number(volumeInput.value) / 100;
    localStorage.setItem(STORAGE.volume, String(preferredVolume));

    if (preferredVolume > 0 && muted) {
      muted = false;
      audio.muted = false;
      localStorage.setItem(STORAGE.muted, 'false');
    }

    if (enabled && !audio.paused) audio.volume = preferredVolume;
    updateUi();
  });

  audio.addEventListener('loadedmetadata', () => {
    setPositionWhenReady();
    if (enabled) startPlayback(false);
  }, { once: true });

  audio.addEventListener('play', updateUi);
  audio.addEventListener('pause', updateUi);
  audio.addEventListener('error', () => {
    status.textContent = 'Audio indisponible';
    player.classList.remove('is-playing');
  });

  window.addEventListener('pagehide', savePosition);
  window.addEventListener('beforeunload', savePosition);
  window.setInterval(savePosition, 4000);

  const resumeAfterInteraction = (event) => {
    if (!enabled || !audio.paused) return;
    if (event?.target?.closest?.('.senzany-ambient-player')) return;
    startPlayback(true, true);
  };

  document.addEventListener('pointerdown', resumeAfterInteraction, { passive: true });
  document.addEventListener('keydown', resumeAfterInteraction);

  updateUi();
})();
