(() => {
  "use strict";

  const SERVER_ADDRESS = "208.115.196.109:2302";

  const slots = document.getElementById("slotsInfo");
  const map = document.getElementById("serverMap");
  const fill = document.getElementById("capacityFill");
  const dot = document.getElementById("serverStatusDot");
  const label = document.getElementById("serverStatusLabel");

  // ============================================================
  // COPIE DE L’ADRESSE DU SERVEUR
  // ============================================================

  function copyAddress(button) {
    const done = () => {
      const original =
        button.dataset.original || button.textContent;

      button.dataset.original = original;
      button.textContent = "ADRESSE COPIÉE ✓";
      button.classList.add("is-copied");

      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1800);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(SERVER_ADDRESS)
        .then(done)
        .catch(() => {
          button.textContent = SERVER_ADDRESS;
        });

      return;
    }

    button.textContent = SERVER_ADDRESS;
  }

  ["copyIpBtn", "copyIpSecondary"].forEach((id) => {
    const button = document.getElementById(id);

    if (button) {
      button.addEventListener("click", () => {
        copyAddress(button);
      });
    }
  });

  // ============================================================
  // ÉTAT DU SERVEUR DAYZ
  // ============================================================

  function mapName(value) {
    if (!value) {
      return "Chernarus+";
    }

    const normalizedValue = String(value);

    return normalizedValue
      .toLowerCase()
      .includes("chernarus")
      ? "Chernarus+"
      : normalizedValue.replace(/_/g, " ");
  }

  function animatePlayers(target, max) {
    if (!slots) {
      return;
    }

    const previousValue = Number(
      slots.dataset.players || 0
    );

    const start = Number.isFinite(previousValue)
      ? previousValue
      : 0;

    const started = performance.now();
    const duration = 750;

    const frame = (now) => {
      const progress = Math.min(
        (now - started) / duration,
        1
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      const current = Math.round(
        start + (target - start) * eased
      );

      slots.textContent = `${current} / ${max}`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        slots.dataset.players = String(target);
      }
    };

    requestAnimationFrame(frame);
  }

  function offline() {
    if (slots) {
      slots.textContent = "HORS LIGNE";
      delete slots.dataset.players;
    }

    if (fill) {
      fill.style.width = "0%";
    }

    dot?.classList.add("is-offline");

    if (label) {
      label.textContent = "OFFLINE";
    }
  }

  async function refresh() {
    try {
      if (!window.SenzanyAPI?.game) {
        throw new Error(
          "API du serveur DayZ indisponible."
        );
      }

      const data =
        await window.SenzanyAPI.game.getStats();

      const players = Number(data?.players);
      const maxPlayers =
        Number(data?.maxPlayers) || 50;

      if (
        !data?.online ||
        !Number.isFinite(players)
      ) {
        offline();
        return;
      }

      animatePlayers(players, maxPlayers);

      if (fill) {
        const occupancy = Math.min(
          (players / maxPlayers) * 100,
          100
        );

        fill.style.width = `${occupancy}%`;
      }

      if (map) {
        map.textContent = mapName(data.map);
      }

      dot?.classList.remove("is-offline");

      if (label) {
        label.textContent = "LIVE";
      }
    } catch (error) {
      offline();

      console.warn(
        "Stats DayZ indisponibles.",
        error
      );
    }
  }

  refresh();

  window.setInterval(refresh, 30000);

  // ============================================================
  // SÉLECTEUR DES EXPÉRIENCES SENZANY
  // ============================================================

  const featureButtons = Array.from(
    document.querySelectorAll(".feature-switch")
  );

  const featurePreview =
    document.getElementById("featurePreview");

  const featureKicker =
    document.getElementById("featureKicker");

  const featureTitle =
    document.getElementById("featureTitle");

  const featureCurrent =
    document.getElementById("featureCurrent");

  let activeFeatureIndex = 0;
  let featureTransitionTimer = null;
  let featureLocked = false;

  function preloadFeatureImages() {
    featureButtons.forEach((button) => {
      const imageSource = button.dataset.image;

      if (!imageSource) {
        return;
      }

      const image = new Image();
      image.src = imageSource;
    });
  }

  function prepareFeaturePreview() {
    if (!featurePreview) {
      return;
    }

    featurePreview.style.transition =
      "opacity 280ms ease, transform 650ms cubic-bezier(0.2, 0.75, 0.2, 1), filter 280ms ease";

    featurePreview.style.opacity = "1";
    featurePreview.style.transform = "scale(1)";
    featurePreview.style.filter = "brightness(1)";
  }

  function updateFeature(index, force = false) {
    const button = featureButtons[index];

    if (
      !button ||
      !featurePreview ||
      !featureKicker ||
      !featureTitle ||
      !featureCurrent
    ) {
      return;
    }

    if (
      index === activeFeatureIndex &&
      !force
    ) {
      return;
    }

    if (featureLocked && !force) {
      return;
    }

    featureLocked = true;

    window.clearTimeout(featureTransitionTimer);

    featureButtons.forEach(
      (featureButton, buttonIndex) => {
        const isActive = buttonIndex === index;

        featureButton.classList.toggle(
          "is-active",
          isActive
        );

        featureButton.setAttribute(
          "aria-pressed",
          String(isActive)
        );
      }
    );

    featurePreview.style.opacity = "0";
    featurePreview.style.transform =
      "scale(1.035)";

    featurePreview.style.filter =
      "brightness(0.62)";

    featureKicker.style.opacity = "0";
    featureTitle.style.opacity = "0";
    featureCurrent.style.opacity = "0";

    featureKicker.style.transform =
      "translateY(8px)";

    featureTitle.style.transform =
      "translateY(12px)";

    featureTransitionTimer =
      window.setTimeout(() => {
        const nextImage = button.dataset.image;
        const nextKicker =
          button.dataset.kicker || "";

        const nextTitle =
          button.dataset.title || "";

        const finishTransition = () => {
          featureKicker.textContent =
            nextKicker;

          featureTitle.textContent =
            nextTitle;

          featureCurrent.textContent =
            String(index + 1).padStart(2, "0");

          featurePreview.style.opacity = "1";
          featurePreview.style.transform =
            "scale(1)";

          featurePreview.style.filter =
            "brightness(1)";

          featureKicker.style.opacity = "1";
          featureTitle.style.opacity = "1";
          featureCurrent.style.opacity = "1";

          featureKicker.style.transform =
            "translateY(0)";

          featureTitle.style.transform =
            "translateY(0)";

          activeFeatureIndex = index;

          window.setTimeout(() => {
            featureLocked = false;
          }, 300);
        };

        if (
          nextImage &&
          featurePreview.src !==
            new URL(
              nextImage,
              window.location.href
            ).href
        ) {
          featurePreview.onload = () => {
            featurePreview.onload = null;
            featurePreview.onerror = null;
            finishTransition();
          };

          featurePreview.onerror = () => {
            featurePreview.onload = null;
            featurePreview.onerror = null;

            console.warn(
              `Impossible de charger l’image : ${nextImage}`
            );

            finishTransition();
          };

          featurePreview.src = nextImage;
        } else {
          finishTransition();
        }
      }, 220);
  }

  function initFeatureSwitcher() {
    if (!featureButtons.length) {
      return;
    }

    preloadFeatureImages();
    prepareFeaturePreview();

    [
      featureKicker,
      featureTitle,
      featureCurrent,
    ].forEach((element) => {
      if (!element) {
        return;
      }

      element.style.transition =
        "opacity 220ms ease, transform 320ms ease";
    });

    featureButtons.forEach(
      (button, index) => {
        button.setAttribute(
          "aria-pressed",
          String(index === 0)
        );

        button.addEventListener(
          "click",
          () => {
            updateFeature(index);
          }
        );

        button.addEventListener(
          "mouseenter",
          () => {
            updateFeature(index);
          }
        );

        button.addEventListener(
          "focus",
          () => {
            updateFeature(index);
          }
        );

        button.addEventListener(
          "keydown",
          (event) => {
            if (
              event.key !== "ArrowDown" &&
              event.key !== "ArrowUp" &&
              event.key !== "ArrowRight" &&
              event.key !== "ArrowLeft"
            ) {
              return;
            }

            event.preventDefault();

            const direction =
              event.key === "ArrowDown" ||
              event.key === "ArrowRight"
                ? 1
                : -1;

            const nextIndex =
              (index +
                direction +
                featureButtons.length) %
              featureButtons.length;

            featureButtons[nextIndex].focus();
            updateFeature(nextIndex);
          }
        );
      }
    );

    updateFeature(0, true);
  }

  initFeatureSwitcher();

  // ============================================================
  // FILM SENZANY
  // ============================================================

  const filmButton =
    document.getElementById("openFilm");

  const filmModal =
    document.getElementById("filmModal");

  const filmFrame =
    document.getElementById("filmFrame");

  const filmClose =
    document.getElementById("closeFilm");

  const YOUTUBE_VIDEO_ID = "3Uf5WygzmrI";

  function openFilm() {
    if (!filmModal || !filmFrame) {
      window.open(
        `https://www.youtube.com/watch?v=${YOUTUBE_VIDEO_ID}`,
        "_blank",
        "noopener,noreferrer"
      );

      return;
    }

    filmFrame.innerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0"
        title="Film Senzany"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>
    `;

    filmModal.classList.add("is-open");

    filmModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow = "hidden";

    filmClose?.focus();
  }

  function closeFilm() {
    if (!filmModal || !filmFrame) {
      return;
    }

    filmModal.classList.remove("is-open");

    filmModal.setAttribute(
      "aria-hidden",
      "true"
    );

    filmFrame.innerHTML = "";

    document.body.style.overflow = "";

    filmButton?.focus();
  }

  filmButton?.addEventListener(
    "click",
    openFilm
  );

  filmClose?.addEventListener(
    "click",
    closeFilm
  );

  filmModal
    ?.querySelectorAll("[data-close-film]")
    .forEach((element) => {
      element.addEventListener(
        "click",
        closeFilm
      );
    });

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        filmModal?.classList.contains("is-open")
      ) {
        closeFilm();
      }
    }
  );

  // ============================================================
  // APPARITION PROGRESSIVE DES SECTIONS
  // ============================================================

  if ("IntersectionObserver" in window) {
    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add(
              "is-visible"
            );

            observer.unobserve(
              entry.target
            );
          });
        },
        {
          threshold: 0.12,
        }
      );

    document
      .querySelectorAll(".reveal")
      .forEach((element, index) => {
        element.style.transitionDelay =
          `${Math.min(index % 4, 3) * 70}ms`;

        observer.observe(element);
      });
  } else {
    document
      .querySelectorAll(".reveal")
      .forEach((element) => {
        element.classList.add("is-visible");
      });
  }
})();