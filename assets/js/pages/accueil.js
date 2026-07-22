(() => {
  "use strict";

  const PAGE_DATA = {
    seasonStartDate: "2026-07-21T20:00:00",
    nextWipeDate: "2026-07-29",
    eventDate: "2026-07-29T00:00:00",
  };

  const setText = (id, value) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  };

  function renderInitialData() {
    const wipeDate = new Date(
      `${PAGE_DATA.nextWipeDate}T00:00:00`
    );

    setText("hero-countdown-title", "29 juillet 2026");
    setText("statPlayers", "Connexion…");
    setText("statVotes", "—");

    setText(
      "statWipe",
      wipeDate.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      })
    );

    const eventTime = document.querySelector(
      ".doomsday-countdown__event small"
    );

    if (eventTime) {
      eventTime.textContent = "Wipe officiel — 00h00";
    }
  }

  async function refreshTopServeursStats() {
    try {
      if (!window.SenzanyAPI?.topServeurs) {
        return;
      }

      const data =
        await window.SenzanyAPI.topServeurs.getStats();

      if (Number.isFinite(data?.monthlyVotes)) {
        setText(
          "statVotes",
          data.monthlyVotes.toLocaleString("fr-FR")
        );
      }
    } catch (error) {
      console.warn(
        "Stats Top-Serveurs indisponibles.",
        error
      );
    }
  }

  function getNetworkElements() {
    const card = document.querySelector(
      ".home-live-card"
    );

    if (!card) {
      return {};
    }

    const gridItems = card.querySelectorAll(
      ".home-live-card__grid > div"
    );

    const mapElement =
      gridItems[0]?.querySelector("strong") || null;

    const statusLabel = card.querySelector(
      ".home-live-card__head small"
    );

    const dot = card.querySelector(
      ".home-live-dot"
    );

    const main = card.querySelector(
      ".home-live-card__main"
    );

    let occupancy = card.querySelector(
      ".home-live-card__occupancy"
    );

    if (!occupancy && main) {
      occupancy = document.createElement("div");

      occupancy.className =
        "home-live-card__occupancy";

      occupancy.setAttribute(
        "aria-hidden",
        "true"
      );

      occupancy.innerHTML = "<span></span>";

      main.insertAdjacentElement(
        "afterend",
        occupancy
      );
    }

    return {
      card,
      dot,
      mapElement,
      occupancy,
      occupancyBar:
        occupancy?.querySelector("span") || null,
      playersElement:
        document.getElementById("statPlayers"),
      statusLabel,
    };
  }

  function animatePlayerCount(
    element,
    players,
    maxPlayers
  ) {
    if (!element) {
      return;
    }

    const previousPlayers = Number(
      element.dataset.players
    );

    const startValue = Number.isFinite(
      previousPlayers
    )
      ? previousPlayers
      : 0;

    element.dataset.players = String(players);

    const finalLabel =
      players >= maxPlayers
        ? "SERVEUR COMPLET"
        : `${players} / ${maxPlayers}`;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      element.textContent = finalLabel;
      return;
    }

    element.classList.remove("is-updating");

    void element.offsetWidth;

    element.classList.add("is-updating");

    const startedAt = performance.now();
    const duration = 780;

    const tick = (now) => {
      const progress = Math.min(
        1,
        (now - startedAt) / duration
      );

      const eased =
        1 - Math.pow(1 - progress, 3);

      const current = Math.round(
        startValue +
          (players - startValue) * eased
      );

      element.textContent =
        progress >= 1
          ? finalLabel
          : `${current} / ${maxPlayers}`;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => {
          element.classList.remove(
            "is-updating"
          );
        }, 260);
      }
    };

    requestAnimationFrame(tick);
  }

  function updateNetworkCard(data) {
    const elements = getNetworkElements();

    if (!elements.playersElement) {
      return;
    }

    const online = Boolean(data?.online);
    const degraded = Boolean(data?.degraded);

    const players = Number(data?.players);
    const maxPlayers = Number(
      data?.maxPlayers
    );

    const hasPlayerCount =
      online &&
      Number.isFinite(players) &&
      Number.isFinite(maxPlayers) &&
      maxPlayers > 0;

    elements.card?.classList.toggle(
      "is-online",
      online
    );

    elements.card?.classList.toggle(
      "is-offline",
      !online
    );

    elements.dot?.classList.toggle(
      "is-online",
      online
    );

    elements.dot?.classList.toggle(
      "is-offline",
      !online
    );

    if (elements.statusLabel) {
      if (online && degraded) {
        elements.statusLabel.textContent =
          "ONLINE";
      } else {
        elements.statusLabel.textContent =
          online ? "LIVE" : "OFFLINE";
      }
    }

    if (!hasPlayerCount) {
      delete elements.playersElement.dataset
        .players;

      if (online) {
        elements.playersElement.textContent =
          "Serveur en ligne";
      } else {
        elements.playersElement.textContent =
          "Hors ligne";
      }

      if (elements.occupancyBar) {
        elements.occupancyBar.style.width =
          "0%";

        elements.occupancyBar.setAttribute(
          "aria-valuenow",
          "0"
        );
      }

      elements.card?.classList.remove(
        "is-calm",
        "is-busy",
        "is-near-full",
        "is-full"
      );

      return;
    }

    animatePlayerCount(
      elements.playersElement,
      players,
      maxPlayers
    );

    const occupancyPercent = Math.max(
      0,
      Math.min(
        100,
        (players / maxPlayers) * 100
      )
    );

    if (elements.occupancyBar) {
      elements.occupancyBar.style.width =
        `${occupancyPercent.toFixed(1)}%`;

      elements.occupancyBar.setAttribute(
        "role",
        "progressbar"
      );

      elements.occupancyBar.setAttribute(
        "aria-valuemin",
        "0"
      );

      elements.occupancyBar.setAttribute(
        "aria-valuemax",
        "100"
      );

      elements.occupancyBar.setAttribute(
        "aria-valuenow",
        String(Math.round(occupancyPercent))
      );
    }

    elements.card?.classList.remove(
      "is-calm",
      "is-busy",
      "is-near-full",
      "is-full"
    );

    if (players >= maxPlayers) {
      elements.card?.classList.add(
        "is-full"
      );
    } else if (occupancyPercent >= 80) {
      elements.card?.classList.add(
        "is-near-full"
      );
    } else if (occupancyPercent >= 45) {
      elements.card?.classList.add(
        "is-busy"
      );
    } else {
      elements.card?.classList.add(
        "is-calm"
      );
    }

    if (
      elements.mapElement &&
      data?.map
    ) {
      const normalizedMap = String(
        data.map
      ).toLowerCase();

      elements.mapElement.textContent =
        normalizedMap.includes("chernarus")
          ? "Chernarus+"
          : data.map;
    }
  }

  async function refreshGameStats() {
    const playersElement =
      document.getElementById(
        "statPlayers"
      );

    if (!playersElement) {
      return;
    }

    try {
      if (!window.SenzanyAPI?.game) {
        return;
      }

      const data =
        await window.SenzanyAPI.game.getStats();

      updateNetworkCard(data);
    } catch (error) {
      updateNetworkCard({
        online: true,
        degraded: true,
        players: null,
        maxPlayers: 50,
        map: "chernarusplus",
      });

      console.warn(
        "Les joueurs connectés sont temporairement indisponibles.",
        error
      );
    }
  }

  function updateCountdown() {
    const countdown =
      document.getElementById("countdown");

    if (!countdown) {
      return;
    }

    const targetDate = new Date(
      PAGE_DATA.eventDate
    );

    const diff =
      targetDate.getTime() - Date.now();

    if (diff <= 0) {
      countdown.innerHTML = `
        <div class="doomsday-unit">
          <strong>LIVE</strong>
          <span>Saison ouverte</span>
        </div>
      `;

      setText(
        "seasonProgressLabel",
        "100%"
      );

      const progressBar =
        document.getElementById(
          "seasonProgressBar"
        );

      if (progressBar) {
        progressBar.style.width = "100%";
      }

      return;
    }

    const values = {
      "cd-d": String(
        Math.floor(diff / 86400000)
      ).padStart(2, "0"),

      "cd-h": String(
        Math.floor(
          (diff % 86400000) / 3600000
        )
      ).padStart(2, "0"),

      "cd-m": String(
        Math.floor(
          (diff % 3600000) / 60000
        )
      ).padStart(2, "0"),

      "cd-s": String(
        Math.floor(
          (diff % 60000) / 1000
        )
      ).padStart(2, "0"),
    };

    Object.entries(values).forEach(
      ([id, value]) => {
        const element =
          document.getElementById(id);

        if (
          !element ||
          element.textContent === value
        ) {
          return;
        }

        element.textContent = value;

        element.classList.remove(
          "is-ticking"
        );

        void element.offsetWidth;

        element.classList.add(
          "is-ticking"
        );
      }
    );

    const start = new Date(
      PAGE_DATA.seasonStartDate
    ).getTime();

    const end = targetDate.getTime();

    const progress = Math.max(
      0,
      Math.min(
        100,
        ((Date.now() - start) /
          (end - start)) *
          100
      )
    );

    const progressBar =
      document.getElementById(
        "seasonProgressBar"
      );

    if (progressBar) {
      progressBar.style.width =
        `${progress.toFixed(1)}%`;
    }

    setText(
      "seasonProgressLabel",
      `${Math.round(progress)}%`
    );
  }

  function createAshParticles() {
    const ash =
      document.getElementById("heroAsh");

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (!ash || reducedMotion) {
      return;
    }

    for (
      let index = 0;
      index < 24;
      index += 1
    ) {
      const particle =
        document.createElement("span");

      const size =
        1 + Math.random() * 2.5;

      particle.style.left =
        `${Math.random() * 100}%`;

      particle.style.width =
        `${size}px`;

      particle.style.height =
        `${size}px`;

      particle.style.animationDuration =
        `${10 + Math.random() * 12}s`;

      particle.style.animationDelay =
        `${Math.random() * 12}s`;

      ash.appendChild(particle);
    }
  }

  function initReveal() {
    const elements =
      document.querySelectorAll(
        ".home-reveal"
      );

    if (!elements.length) {
      return;
    }

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (
      !("IntersectionObserver" in window) ||
      reducedMotion
    ) {
      elements.forEach((element) => {
        element.classList.add(
          "is-visible"
        );
      });

      return;
    }

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
          threshold: 0.14,
          rootMargin:
            "0px 0px -30px",
        }
      );

    elements.forEach(
      (element, index) => {
        element.style.transitionDelay =
          `${Math.min(
            index % 4,
            3
          ) * 80}ms`;

        observer.observe(element);
      }
    );
  }

  function initCardTilt() {
    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    const coarsePointer =
      window.matchMedia(
        "(pointer: coarse)"
      ).matches;

    if (
      reducedMotion ||
      coarsePointer
    ) {
      return;
    }

    document
      .querySelectorAll(
        ".home-world-card"
      )
      .forEach((card) => {
        card.addEventListener(
          "pointermove",
          (event) => {
            const rect =
              card.getBoundingClientRect();

            const x =
              (event.clientX -
                rect.left) /
              rect.width;

            const y =
              (event.clientY -
                rect.top) /
              rect.height;

            card.style.setProperty(
              "--mx",
              `${x * 100}%`
            );

            card.style.setProperty(
              "--my",
              `${y * 100}%`
            );

            card.style.setProperty(
              "--rx",
              `${(0.5 - y) * 4}deg`
            );

            card.style.setProperty(
              "--ry",
              `${(x - 0.5) * 5}deg`
            );
          }
        );

        card.addEventListener(
          "pointerleave",
          () => {
            card.style.removeProperty(
              "--rx"
            );

            card.style.removeProperty(
              "--ry"
            );
          }
        );
      });
  }

  renderInitialData();
  refreshTopServeursStats();
  refreshGameStats();
  updateCountdown();
  createAshParticles();
  initReveal();
  initCardTilt();

  window.setInterval(
    refreshTopServeursStats,
    300000
  );

  window.setInterval(
    refreshGameStats,
    30000
  );

  window.setInterval(
    updateCountdown,
    1000
  );
})();

(() => {
  const inaccessible =
    window.matchMedia(
      "(pointer: coarse), (prefers-reduced-motion: reduce)"
    ).matches;

  if (inaccessible) {
    return;
  }

  document
    .querySelectorAll(
      ".home-pillar[data-tilt]"
    )
    .forEach((card) => {
      card.addEventListener(
        "pointermove",
        (event) => {
          const rect =
            card.getBoundingClientRect();

          const x =
            (event.clientX -
              rect.left) /
            rect.width;

          const y =
            (event.clientY -
              rect.top) /
            rect.height;

          card.style.setProperty(
            "--mx",
            `${x * 100}%`
          );

          card.style.setProperty(
            "--my",
            `${y * 100}%`
          );

          card.style.transform =
            `perspective(950px) ` +
            `rotateX(${
              (0.5 - y) * 3.2
            }deg) ` +
            `rotateY(${
              (x - 0.5) * 3.2
            }deg) ` +
            "translateY(-8px)";
        }
      );

      card.addEventListener(
        "pointerleave",
        () => {
          card.style.removeProperty(
            "transform"
          );

          card.style.setProperty(
            "--mx",
            "50%"
          );

          card.style.setProperty(
            "--my",
            "50%"
          );
        }
      );
    });
})();