
(() => {
  "use strict";

  const hero = document.querySelector(".home-hero");
  if (!hero || hero.dataset.carouselRestored === "true") return;
  hero.dataset.carouselRestored = "true";

  /*
   * On réutilise UNIQUEMENT les visuels déjà présents dans le projet.
   * Chaque slide a plusieurs chemins de secours pour ne jamais casser le hero
   * si le nom d'un ancien fichier diffère sur le VPS.
   */
  const slideCandidates = [
    [
      "assets/images/backgrounds/hero-bg.jpg"
    ],
    [
      "assets/images/accueil/evenements-new.webp",
      "assets/images/accueil/evenements-permanents.webp"
    ],
    [
      "assets/images/accueil/communaute-new.webp",
      "assets/images/accueil/communaute-vraie.webp",
      "assets/images/accueil/exploration-new.webp",
      "assets/images/accueil/monde-transforme.webp"
    ]
  ];

  const ROTATION_MS = 8000;
  let slides = [];
  let current = 0;
  let timer = null;

  function imageExists(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function pickFirstExisting(candidates) {
    for (const src of candidates) {
      const found = await imageExists(src);
      if (found) return found;
    }
    return null;
  }

  async function boot() {
    const resolved = [];
    for (const candidates of slideCandidates) {
      const src = await pickFirstExisting(candidates);
      if (src) resolved.push(src);
    }

    // Il faut au minimum deux images pour que le carrousel ait un sens.
    if (resolved.length < 2) {
      console.warn("[Senzany Accueil] Visuels du carrousel introuvables.", resolved);
      return;
    }

    const layer = document.createElement("div");
    layer.className = "home-hero-carousel";
    layer.setAttribute("aria-hidden", "true");

    resolved.forEach((src, index) => {
      const slide = document.createElement("div");
      slide.className = "home-hero-carousel__slide" + (index === 0 ? " is-active" : "");
      slide.style.backgroundImage = `url("${src}")`;
      layer.appendChild(slide);
    });

    hero.prepend(layer);
    slides = [...layer.querySelectorAll(".home-hero-carousel__slide")];

    const nav = document.createElement("div");
    nav.className = "home-hero-carousel__nav";
    nav.innerHTML = `
      <button class="home-hero-carousel__arrow home-hero-carousel__arrow--prev" type="button" aria-label="Image précédente">‹</button>
      <button class="home-hero-carousel__arrow home-hero-carousel__arrow--next" type="button" aria-label="Image suivante">›</button>
      <div class="home-hero-carousel__dots" aria-label="Choisir l'image du carrousel"></div>
      <div class="home-hero-carousel__counter"><b>01</b> / ${String(slides.length).padStart(2,"0")}</div>
    `;
    hero.appendChild(nav);

    const dots = nav.querySelector(".home-hero-carousel__dots");
    slides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "home-hero-carousel__dot" + (index === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", `Afficher l'image ${index + 1}`);
      dot.addEventListener("click", () => {
        show(index);
        restart();
      });
      dots.appendChild(dot);
    });

    nav.querySelector(".home-hero-carousel__arrow--prev").addEventListener("click", () => {
      show(current - 1);
      restart();
    });
    nav.querySelector(".home-hero-carousel__arrow--next").addEventListener("click", () => {
      show(current + 1);
      restart();
    });

    hero.addEventListener("mouseenter", stop);
    hero.addEventListener("mouseleave", start);
    hero.addEventListener("focusin", stop);
    hero.addEventListener("focusout", start);

    start();
  }

  function show(index) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
    document.querySelectorAll(".home-hero-carousel__dot")
      .forEach((dot, i) => dot.classList.toggle("is-active", i === current));

    const counter = hero.querySelector(".home-hero-carousel__counter b");
    if (counter) counter.textContent = String(current + 1).padStart(2, "0");
  }

  function start() {
    stop();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = window.setInterval(() => show(current + 1), ROTATION_MS);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function restart() {
    start();
  }

  boot();
})();
