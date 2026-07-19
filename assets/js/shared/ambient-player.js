(() => {
  'use strict';

  if (window.__senzanyAmbientPlayerLoaded) return;
  window.__senzanyAmbientPlayerLoaded = true;

  const STORAGE = {
    enabled: 'senzanyAmbientEnabled',
    muted: 'senzanyAmbientMuted',
    volume: 'senzanyAmbientVolume',
    position: 'senzanyAmbientPosition',
    introSeen: 'senzanyAmbientIntroSeenGSAPV2'
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
    <div class="senzany-audio-intro__scene" aria-hidden="true"></div>
    <div class="senzany-audio-intro__glow" aria-hidden="true"></div>
    <div class="senzany-audio-intro__embers" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
    <div class="senzany-audio-intro__fog senzany-audio-intro__fog--back" aria-hidden="true"></div>
    <div class="senzany-audio-intro__fog senzany-audio-intro__fog--middle" aria-hidden="true"></div>
    <div class="senzany-audio-intro__fog senzany-audio-intro__fog--front" aria-hidden="true"></div>
    <div class="senzany-audio-intro__content">
      <div class="senzany-audio-intro__overline">PORTAIL OFFICIEL</div>
      <div class="senzany-audio-intro__identity">
        <img class="senzany-audio-intro__logo" src="assets/images/branding/logo.png" alt="" aria-hidden="true">
        <div class="senzany-audio-intro__brand" data-text="SENZANY">SENZANY</div>
      </div>
      <div class="senzany-audio-intro__line"><span></span></div>
      <div class="senzany-audio-intro__tagline">
        <span>VOICI LE RÉCIT</span>
        <strong>DE VOTRE MORT</strong>
      </div>
      <div class="senzany-audio-intro__hint">L’EXPÉRIENCE COMMENCE</div>
    </div>
    <div class="senzany-audio-intro__vignette" aria-hidden="true"></div>
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

  const loadGsap = () => new Promise((resolve, reject) => {
    if (window.gsap) {
      resolve(window.gsap);
      return;
    }

    const existing = document.querySelector('script[data-senzany-gsap]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.gsap), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
    script.async = true;
    script.dataset.senzanyGsap = 'true';
    script.addEventListener('load', () => resolve(window.gsap), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.head.appendChild(script);
  });

  const createEmbers = () => {
    const container = intro.querySelector('.senzany-audio-intro__embers');
    container.innerHTML = '';
    for (let index = 0; index < 34; index += 1) {
      const ember = document.createElement('i');
      ember.style.left = `${Math.random() * 100}%`;
      ember.style.bottom = `${-5 - Math.random() * 18}%`;
      ember.style.width = `${1 + Math.random() * 3}px`;
      ember.style.height = ember.style.width;
      ember.dataset.drift = String((Math.random() - 0.5) * 180);
      ember.dataset.rise = String(65 + Math.random() * 55);
      ember.dataset.duration = String(3.8 + Math.random() * 4.5);
      ember.dataset.delay = String(Math.random() * 3.2);
      container.appendChild(ember);
    }
  };

  const playGsapIntro = async () => {
    const gsap = await loadGsap();
    if (!gsap) throw new Error('GSAP indisponible');

    if (!document.body.contains(intro)) document.body.appendChild(intro);
    createEmbers();

    const q = gsap.utils.selector(intro);
    const embers = q('.senzany-audio-intro__embers i');
    const fogBack = q('.senzany-audio-intro__fog--back');
    const fogMiddle = q('.senzany-audio-intro__fog--middle');
    const fogFront = q('.senzany-audio-intro__fog--front');

    intro.style.visibility = 'visible';
    intro.style.pointerEvents = 'all';
    document.documentElement.classList.add('senzany-intro-running');

    gsap.killTweensOf('*');
    gsap.set(intro, { autoAlpha: 0 });
    gsap.set(q('.senzany-audio-intro__scene'), { scale: 1.22, filter: 'brightness(0.18) saturate(0.5)' });
    gsap.set(q('.senzany-audio-intro__glow'), { autoAlpha: 0, scale: 0.18 });
    gsap.set([fogBack, fogMiddle, fogFront], { autoAlpha: 0 });
    gsap.set(q('.senzany-audio-intro__overline'), { autoAlpha: 0, y: 18, letterSpacing: '1.05em' });
    gsap.set(q('.senzany-audio-intro__logo'), { autoAlpha: 0, scale: 0.55, rotation: -2, filter: 'blur(20px) brightness(0.35)' });
    gsap.set(q('.senzany-audio-intro__brand'), { autoAlpha: 0, y: 42, scale: 0.82, filter: 'blur(24px)' });
    gsap.set(q('.senzany-audio-intro__line span'), { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set(q('.senzany-audio-intro__tagline span'), { autoAlpha: 0, y: 36, filter: 'blur(18px)' });
    gsap.set(q('.senzany-audio-intro__tagline strong'), { autoAlpha: 0, y: 48, scale: 1.08, filter: 'blur(24px)', letterSpacing: '0.16em' });
    gsap.set(q('.senzany-audio-intro__hint'), { autoAlpha: 0, y: 14 });
    gsap.set(q('.senzany-audio-intro__vignette'), { autoAlpha: 0 });

    embers.forEach((ember) => {
      gsap.set(ember, { autoAlpha: 0, scale: 0.35 });
      gsap.to(ember, {
        y: () => `-${ember.dataset.rise}vh`,
        x: () => Number(ember.dataset.drift),
        autoAlpha: 0.95,
        scale: () => 0.8 + Math.random() * 1.9,
        duration: () => Number(ember.dataset.duration) + 2,
        delay: () => Number(ember.dataset.delay),
        repeat: 2,
        ease: 'none'
      });
    });

    gsap.to(fogBack, { xPercent: 24, scale: 1.2, duration: 16, ease: 'sine.inOut' });
    gsap.to(fogMiddle, { xPercent: -28, scale: 1.28, duration: 15, ease: 'sine.inOut' });
    gsap.to(fogFront, { xPercent: 20, scale: 1.38, duration: 14, ease: 'sine.inOut' });

    const timeline = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        localStorage.setItem(STORAGE.introSeen, 'true');
        document.documentElement.classList.remove('senzany-intro-running');
        intro.style.pointerEvents = 'none';
        intro.remove();
      }
    });

    timeline
      .to(intro, { autoAlpha: 1, duration: 1.05 }, 0)
      .to(q('.senzany-audio-intro__scene'), { scale: 1.04, filter: 'brightness(0.48) saturate(0.76)', duration: 11.8, ease: 'power1.out' }, 0)
      .to(q('.senzany-audio-intro__vignette'), { autoAlpha: 1, duration: 1.25 }, 0)
      .to(fogBack, { autoAlpha: 0.78, duration: 2.0 }, 0.25)
      .to(fogMiddle, { autoAlpha: 0.72, duration: 2.2 }, 0.45)
      .to(fogFront, { autoAlpha: 0.9, duration: 2.4 }, 0.65)
      .to(q('.senzany-audio-intro__glow'), { autoAlpha: 1, scale: 1.15, duration: 2.8, ease: 'power3.out' }, 0.75)
      .to(q('.senzany-audio-intro__overline'), { autoAlpha: 1, y: 0, letterSpacing: '0.58em', duration: 1.3 }, 1.15)
      .to(q('.senzany-audio-intro__logo'), { autoAlpha: 1, scale: 1, rotation: 0, filter: 'blur(0px) brightness(1)', duration: 2.05, ease: 'expo.out' }, 1.45)
      .to(q('.senzany-audio-intro__brand'), { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 2.15, ease: 'expo.out' }, 1.7)
      .to(q('.senzany-audio-intro__identity'), { scale: 1.025, duration: 1.7, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 2.6)
      .to(q('.senzany-audio-intro__line span'), { scaleX: 1, duration: 1.15, ease: 'expo.inOut' }, 3.25)
      .to(q('.senzany-audio-intro__tagline span'), { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.45 }, 3.65)
      .to(q('.senzany-audio-intro__tagline strong'), { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', letterSpacing: '0.028em', duration: 1.85, ease: 'expo.out' }, 4.0)
      .to(q('.senzany-audio-intro__hint'), { autoAlpha: 1, y: 0, duration: 1.0 }, 5.1)
      .to(q('.senzany-audio-intro__glow'), { scale: 1.35, autoAlpha: 0.78, duration: 2.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 5.0)
      .to({}, { duration: 2.2 })
      .to(q('.senzany-audio-intro__hint'), { autoAlpha: 0, y: -10, duration: 0.7 }, 8.2)
      .to(fogFront, { autoAlpha: 1, scale: 1.58, filter: 'blur(28px)', duration: 1.15, ease: 'power2.in' }, 8.35)
      .to(fogMiddle, { autoAlpha: 1, scale: 1.42, duration: 1.25, ease: 'power2.in' }, 8.4)
      .to(q('.senzany-audio-intro__content'), { autoAlpha: 0, scale: 1.07, filter: 'blur(18px)', duration: 1.5, ease: 'power2.in' }, 8.65)
      .to(q('.senzany-audio-intro__glow'), { autoAlpha: 0, scale: 1.7, duration: 1.2 }, 9.0)
      .to([fogBack, fogMiddle, fogFront], { autoAlpha: 0, xPercent: '+=12', duration: 2.0, ease: 'power2.inOut' }, 9.55)
      .to(intro, { autoAlpha: 0, duration: 1.85, ease: 'power2.inOut' }, 10.0);

    return true;
  };

  const showIntroOnce = () => {
    if (localStorage.getItem(STORAGE.introSeen) === 'true') return false;
    playGsapIntro().catch(() => {
      intro.classList.add('is-visible');
      window.setTimeout(() => intro.classList.add('is-leaving'), 7600);
      window.setTimeout(() => {
        localStorage.setItem(STORAGE.introSeen, 'true');
        intro.remove();
      }, 9300);
    });
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
