(() => {
  'use strict';

  const STORAGE = {
    enabled: 'senzanyAmbientEnabled',
    volume: 'senzanyAmbientVolume',
    position: 'senzanyAmbientPosition',
    updatedAt: 'senzanyAmbientUpdatedAt'
  };

  const DEFAULT_VOLUME = 0.22;
  const audio = new Audio('assets/audio/senzany-wasteland-ambient.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;

  const getStoredNumber = (key, fallback) => {
    const value = Number.parseFloat(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  };

  let targetVolume = Math.min(1, Math.max(0, getStoredNumber(STORAGE.volume, DEFAULT_VOLUME)));
  let enabled = localStorage.getItem(STORAGE.enabled) === 'true';
  let fadeFrame = null;
  let saveTimer = null;
  let hasPlayedThisVisit = false;

  const icons = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zm-2.5-8.77v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>',
    muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.7 2.7-1.42 1.42-2.7-2.7-2.7 2.7-1.42-1.42 2.7-2.7-2.7-2.7 1.42-1.42 2.7 2.7 2.7-2.7 1.42 1.42-2.7 2.7z"/></svg>'
  };

  const player = document.createElement('aside');
  player.className = 'senzany-ambient';
  player.setAttribute('aria-label', 'Lecteur de musique d’ambiance');
  player.innerHTML = `
    <button class="senzany-ambient__toggle" type="button" aria-label="Lire la musique">${icons.play}</button>
    <div class="senzany-ambient__meta">
      <span class="senzany-ambient__eyebrow">Senzany ambient</span>
      <strong class="senzany-ambient__title">Wasteland Ambient</strong>
    </div>
    <div class="senzany-ambient__volume-wrap">
      <button class="senzany-ambient__mute" type="button" aria-label="Couper le son">${icons.volume}</button>
      <input class="senzany-ambient__volume" type="range" min="0" max="1" step="0.01" aria-label="Volume de la musique">
    </div>`;

  const hint = document.createElement('div');
  hint.className = 'senzany-ambient__hint';
  hint.textContent = '♪ Senzany Wasteland Ambient';

  document.body.append(player, hint);

  const toggleButton = player.querySelector('.senzany-ambient__toggle');
  const muteButton = player.querySelector('.senzany-ambient__mute');
  const volumeInput = player.querySelector('.senzany-ambient__volume');
  volumeInput.value = String(targetVolume);

  const setUi = () => {
    const playing = !audio.paused;
    toggleButton.innerHTML = playing ? icons.pause : icons.play;
    toggleButton.setAttribute('aria-label', playing ? 'Mettre la musique en pause' : 'Lire la musique');
    muteButton.innerHTML = targetVolume === 0 ? icons.muted : icons.volume;
    muteButton.setAttribute('aria-label', targetVolume === 0 ? 'Rétablir le son' : 'Couper le son');
  };

  const fadeTo = (endVolume, duration = 900, onComplete) => {
    if (fadeFrame) cancelAnimationFrame(fadeFrame);
    const startVolume = audio.volume;
    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = startVolume + (endVolume - startVolume) * eased;
      if (progress < 1) fadeFrame = requestAnimationFrame(step);
      else {
        fadeFrame = null;
        if (onComplete) onComplete();
      }
    };
    fadeFrame = requestAnimationFrame(step);
  };

  const restorePosition = () => {
    const storedPosition = getStoredNumber(STORAGE.position, 0);
    const storedAt = getStoredNumber(STORAGE.updatedAt, Date.now());
    const elapsed = enabled ? Math.max(0, (Date.now() - storedAt) / 1000) : 0;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 60;
    audio.currentTime = (storedPosition + elapsed) % duration;
  };

  const showHint = () => {
    if (hasPlayedThisVisit) return;
    hasPlayedThisVisit = true;
    hint.classList.add('is-visible');
    window.setTimeout(() => hint.classList.remove('is-visible'), 2400);
  };

  const play = async () => {
    enabled = true;
    localStorage.setItem(STORAGE.enabled, 'true');
    try {
      await audio.play();
      fadeTo(targetVolume, 1200);
      showHint();
    } catch {
      enabled = false;
      localStorage.setItem(STORAGE.enabled, 'false');
    }
    setUi();
  };

  const pause = () => {
    enabled = false;
    localStorage.setItem(STORAGE.enabled, 'false');
    fadeTo(0, 600, () => {
      audio.pause();
      setUi();
    });
  };

  const persistPosition = () => {
    if (!Number.isFinite(audio.currentTime)) return;
    localStorage.setItem(STORAGE.position, String(audio.currentTime));
    localStorage.setItem(STORAGE.updatedAt, String(Date.now()));
  };

  toggleButton.addEventListener('click', () => {
    if (audio.paused) play();
    else pause();
  });

  muteButton.addEventListener('click', () => {
    if (targetVolume > 0) {
      muteButton.dataset.previousVolume = String(targetVolume);
      targetVolume = 0;
    } else {
      targetVolume = Number.parseFloat(muteButton.dataset.previousVolume || '') || DEFAULT_VOLUME;
    }
    volumeInput.value = String(targetVolume);
    localStorage.setItem(STORAGE.volume, String(targetVolume));
    if (!audio.paused) fadeTo(targetVolume, 350);
    setUi();
  });

  volumeInput.addEventListener('input', () => {
    targetVolume = Number.parseFloat(volumeInput.value);
    localStorage.setItem(STORAGE.volume, String(targetVolume));
    if (!audio.paused) audio.volume = targetVolume;
    setUi();
  });

  audio.addEventListener('play', setUi);
  audio.addEventListener('pause', setUi);
  audio.addEventListener('loadedmetadata', restorePosition, { once: true });

  saveTimer = window.setInterval(() => {
    if (!audio.paused) persistPosition();
  }, 1000);

  window.addEventListener('pagehide', () => {
    persistPosition();
    if (saveTimer) window.clearInterval(saveTimer);
  });

  window.requestAnimationFrame(() => player.classList.add('is-ready'));
  setUi();

  // Les navigateurs exigent une interaction avant la lecture avec son.
  if (enabled) {
    const resumeOnFirstInteraction = () => {
      restorePosition();
      play();
      document.removeEventListener('pointerdown', resumeOnFirstInteraction);
      document.removeEventListener('keydown', resumeOnFirstInteraction);
    };
    document.addEventListener('pointerdown', resumeOnFirstInteraction, { once: true });
    document.addEventListener('keydown', resumeOnFirstInteraction, { once: true });
  }
})();
