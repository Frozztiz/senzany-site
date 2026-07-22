(() => {
  'use strict';

  if (window.__senzanyAmbientPlayerLoaded) return;
  window.__senzanyAmbientPlayerLoaded = true;

  const STORAGE = {
    enabled: 'senzanyAmbientEnabled',
    muted: 'senzanyAmbientMuted',
    volume: 'senzanyAmbientVolume',
    position: 'senzanyAmbientPosition',
    introSeen: 'senzanyAmbientIntroSeenSmokeV4'
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
    <div class="senzany-audio-intro__scene" aria-hidden="true">
      <div class="senzany-audio-intro__moon"></div>
      <div class="senzany-audio-intro__forest senzany-audio-intro__forest--far"></div>
      <div class="senzany-audio-intro__forest senzany-audio-intro__forest--near"></div>
    </div>
    <canvas class="senzany-audio-intro__atmosphere" aria-hidden="true"></canvas>
    <div class="senzany-audio-intro__glow" aria-hidden="true"></div>
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
    <div class="senzany-audio-intro__shutter" aria-hidden="true"></div>
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
  const params = new URLSearchParams(window.location.search);

// Forcer l'intro
if (params.has("intro")) {
  localStorage.removeItem(STORAGE.introSeen);
}

// Réinitialiser l'intro puis nettoyer l'URL
if (params.has("resetintro")) {
  localStorage.removeItem(STORAGE.introSeen);

  history.replaceState(
    {},
    "",
    window.location.pathname + window.location.hash
  );
}

let introPending = localStorage.getItem(STORAGE.introSeen) !== "true";
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

  const createAtmosphere = (canvas) => {
    const context = canvas.getContext('2d', { alpha: true });
    const state = { frame: 0, running: true, width: 0, height: 0, dpr: 1 };
    const fog = [];
    const sparks = [];

    const resize = () => {
      state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };

    const resetFog = (particle, initial = false) => {
      const band = Math.random();
      particle.x = initial ? Math.random() * state.width : -state.width * (0.12 + Math.random() * 0.25);
      particle.y = state.height * (0.12 + band * 0.78);
      particle.radiusX = state.width * (0.14 + Math.random() * 0.24);
      particle.radiusY = state.height * (0.07 + Math.random() * 0.17);
      particle.speed = 7 + Math.random() * 18;
      particle.wave = 12 + Math.random() * 42;
      particle.phase = Math.random() * Math.PI * 2;
      particle.alpha = 0.035 + Math.random() * 0.095;
      particle.warmth = Math.random();
    };

    const resetSpark = (spark, initial = false) => {
      spark.x = Math.random() * state.width;
      spark.y = initial ? Math.random() * state.height : state.height + 20;
      spark.vy = 20 + Math.random() * 70;
      spark.vx = -12 + Math.random() * 24;
      spark.size = 0.7 + Math.random() * 2.8;
      spark.life = 0.25 + Math.random() * 0.75;
      spark.phase = Math.random() * Math.PI * 2;
    };

    resize();
    for (let index = 0; index < 38; index += 1) {
      const particle = {};
      resetFog(particle, true);
      fog.push(particle);
    }
    for (let index = 0; index < 95; index += 1) {
      const spark = {};
      resetSpark(spark, true);
      sparks.push(spark);
    }

    let previous = performance.now();
    const render = (now) => {
      if (!state.running) return;
      const delta = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      context.clearRect(0, 0, state.width, state.height);

      context.globalCompositeOperation = 'screen';
      fog.forEach((particle) => {
        particle.x += particle.speed * delta;
        particle.phase += delta * 0.22;
        if (particle.x - particle.radiusX > state.width * 1.2) resetFog(particle);
        const py = particle.y + Math.sin(particle.phase) * particle.wave;
        context.save();
        context.translate(particle.x, py);
        context.scale(1, particle.radiusY / particle.radiusX);
        const gradient = context.createRadialGradient(0, 0, 0, 0, 0, particle.radiusX);
        const tint = particle.warmth > 0.76 ? '190,94,100' : '200,205,214';
        gradient.addColorStop(0, `rgba(${tint},${particle.alpha})`);
        gradient.addColorStop(0.38, `rgba(${tint},${particle.alpha * 0.72})`);
        gradient.addColorStop(0.72, `rgba(${tint},${particle.alpha * 0.22})`);
        gradient.addColorStop(1, `rgba(${tint},0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(0, 0, particle.radiusX, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      context.globalCompositeOperation = 'lighter';
      sparks.forEach((spark) => {
        spark.y -= spark.vy * delta;
        spark.x += spark.vx * delta + Math.sin(now * 0.0018 + spark.phase) * 0.25;
        if (spark.y < -30) resetSpark(spark);
        const flicker = 0.42 + Math.sin(now * 0.012 + spark.phase) * 0.25;
        const gradient = context.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * 5.5);
        gradient.addColorStop(0, `rgba(255,220,170,${Math.max(0, flicker * spark.life)})`);
        gradient.addColorStop(0.25, `rgba(255,72,38,${Math.max(0, flicker * spark.life * 0.9)})`);
        gradient.addColorStop(1, 'rgba(180,0,15,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.size * 5.5, 0, Math.PI * 2);
        context.fill();
      });

      context.globalCompositeOperation = 'source-over';
      state.frame = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize, { passive: true });
    state.frame = requestAnimationFrame(render);

    return {
      stop() {
        state.running = false;
        cancelAnimationFrame(state.frame);
        window.removeEventListener('resize', resize);
        context.clearRect(0, 0, state.width, state.height);
      }
    };
  };

  const playGsapIntro = async () => {
    const gsap = await loadGsap();
    if (!gsap) throw new Error('GSAP indisponible');

    if (!document.body.contains(intro)) document.body.appendChild(intro);
    const q = gsap.utils.selector(intro);
    const canvas = q('.senzany-audio-intro__atmosphere')[0];
    const atmosphere = createAtmosphere(canvas);

    intro.style.visibility = 'visible';
    intro.style.pointerEvents = 'all';
    document.documentElement.classList.add('senzany-intro-running');

    gsap.set(intro, { autoAlpha: 0 });
    gsap.set(canvas, { autoAlpha: 0, scale: 1.08 });
    gsap.set(q('.senzany-audio-intro__scene'), { scale: 1.28, filter: 'brightness(0.08) saturate(0.35)' });
    gsap.set(q('.senzany-audio-intro__moon'), { autoAlpha: 0, scale: 0.55 });
    gsap.set(q('.senzany-audio-intro__forest--far'), { autoAlpha: 0, y: 50 });
    gsap.set(q('.senzany-audio-intro__forest--near'), { autoAlpha: 0, y: 70 });
    gsap.set(q('.senzany-audio-intro__glow'), { autoAlpha: 0, scale: 0.18 });
    gsap.set(q('.senzany-audio-intro__overline'), { autoAlpha: 0, y: 22, letterSpacing: '1em' });
    gsap.set(q('.senzany-audio-intro__logo'), { autoAlpha: 0, scale: 0.52, rotation: -4, filter: 'blur(30px) brightness(0.1)' });
    gsap.set(q('.senzany-audio-intro__brand'), { autoAlpha: 0, y: 55, scale: 0.78, filter: 'blur(34px)' });
    gsap.set(q('.senzany-audio-intro__line span'), { scaleX: 0, transformOrigin: '50% 50%' });
    gsap.set(q('.senzany-audio-intro__tagline span'), { autoAlpha: 0, y: 38, filter: 'blur(20px)' });
    gsap.set(q('.senzany-audio-intro__tagline strong'), { autoAlpha: 0, y: 64, scale: 1.18, filter: 'blur(32px)', letterSpacing: '0.22em' });
    gsap.set(q('.senzany-audio-intro__hint'), { autoAlpha: 0, y: 16 });
    gsap.set(q('.senzany-audio-intro__vignette'), { autoAlpha: 0 });
    gsap.set(q('.senzany-audio-intro__shutter'), { autoAlpha: 0 });

    const timeline = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        localStorage.setItem(STORAGE.introSeen, 'true');
        atmosphere.stop();
        document.documentElement.classList.remove('senzany-intro-running');
        intro.style.pointerEvents = 'none';
        intro.remove();
      }
    });

    timeline
      .to(intro, { autoAlpha: 1, duration: 0.9 }, 0)
      .to(q('.senzany-audio-intro__vignette'), { autoAlpha: 1, duration: 1.2 }, 0)
      .to(q('.senzany-audio-intro__scene'), { scale: 1.02, filter: 'brightness(0.5) saturate(0.85)', duration: 12.5, ease: 'power1.out' }, 0)
      .to(q('.senzany-audio-intro__moon'), { autoAlpha: 0.9, scale: 1, duration: 3.2, ease: 'expo.out' }, 0.15)
      .to(q('.senzany-audio-intro__forest--far'), { autoAlpha: 0.72, y: 0, duration: 2.6 }, 0.2)
      .to(q('.senzany-audio-intro__forest--near'), { autoAlpha: 0.98, y: 0, duration: 3.1 }, 0.35)
      .to(canvas, { autoAlpha: 1, scale: 1, duration: 2.3 }, 0.2)
      .to(q('.senzany-audio-intro__glow'), { autoAlpha: 1, scale: 1.25, duration: 3.5, ease: 'expo.out' }, 0.8)
      .to(q('.senzany-audio-intro__overline'), { autoAlpha: 1, y: 0, letterSpacing: '0.56em', duration: 1.4 }, 1.35)
      .to(q('.senzany-audio-intro__logo'), { autoAlpha: 1, scale: 1, rotation: 0, filter: 'blur(0px) brightness(1)', duration: 2.4, ease: 'expo.out' }, 1.65)
      .to(q('.senzany-audio-intro__brand'), { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 2.6, ease: 'expo.out' }, 1.8)
      .to(q('.senzany-audio-intro__identity'), { scale: 1.035, duration: 1.9, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 3.0)
      .to(q('.senzany-audio-intro__line span'), { scaleX: 1, duration: 1.25, ease: 'expo.inOut' }, 3.75)
      .to(q('.senzany-audio-intro__tagline span'), { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.55 }, 4.25)
      .to(q('.senzany-audio-intro__tagline strong'), { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', letterSpacing: '0.028em', duration: 2.2, ease: 'expo.out' }, 4.85)
      .to(q('.senzany-audio-intro__hint'), { autoAlpha: 1, y: 0, duration: 1.0 }, 6.15)
      .to(q('.senzany-audio-intro__glow'), { scale: 1.58, autoAlpha: 0.95, duration: 3.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 5.8)
      .to({}, { duration: 2.25 })
      .to(q('.senzany-audio-intro__hint'), { autoAlpha: 0, y: -12, duration: 0.55 }, 9.15)
      .to(canvas, { scale: 1.16, filter: 'brightness(1.35) contrast(1.15)', duration: 1.6, ease: 'power2.in' }, 9.1)
      .to(q('.senzany-audio-intro__content'), { autoAlpha: 0, scale: 1.09, filter: 'blur(24px)', duration: 1.65, ease: 'power2.in' }, 9.35)
      .to(q('.senzany-audio-intro__shutter'), { autoAlpha: 1, duration: 0.65, ease: 'power2.in' }, 9.7)
      .to(q('.senzany-audio-intro__glow'), { autoAlpha: 0, scale: 1.9, duration: 1.2 }, 9.8)
      .to(canvas, { autoAlpha: 0, scale: 1.28, duration: 2.1, ease: 'power2.inOut' }, 10.35)
      .to(q('.senzany-audio-intro__shutter'), { autoAlpha: 0, duration: 1.15, ease: 'power2.out' }, 10.65)
      .to(intro, { autoAlpha: 0, duration: 1.8, ease: 'power2.inOut' }, 10.7);

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
