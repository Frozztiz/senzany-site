(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    loading: $("bpLoading"),
    loggedOut: $("bpLoggedOut"),
    content: $("bpContent"),
    error: $("bpError")
  };

  function show(name) {
    Object.entries(state).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
  }

  function text(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function formatDate(value) {
    if (!value) return "NON DÉFINIE";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "NON DÉFINIE";
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      .format(date)
      .replace(".", "")
      .toUpperCase();
  }

  function number(value) {
    return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
  }

  function seasonStatus(value) {
    return ({ active: "ACTIVE", draft: "PRÉPARATION", ended: "TERMINÉE" })[value] || String(value || "—").toUpperCase();
  }

  function rewardRows(rewards) {
    const rows = [];
    const payload = rewards && typeof rewards === "object" ? rewards : {};
    const items = Array.isArray(payload.items) ? payload.items : [];

    items.forEach(item => {
      const classname = String(item?.classname || "").trim();
      if (!classname) return;
      rows.push({ label: classname, value: `×${Math.max(1, Number(item?.quantity) || 1)}` });
    });

    if (Number(payload.roubles) > 0) rows.push({ label: "Roubles", value: number(payload.roubles) });
    if (Number(payload.bitcoin) > 0) rows.push({ label: "Bitcoin", value: number(payload.bitcoin) });

    return rows;
  }

  function renderRewardBlock(rewards) {
    const rows = rewardRows(rewards);
    if (!rows.length) return '<div class="bp-empty">Aucune récompense configurée</div>';
    return rows.map(row => `
      <div class="bp-reward">
        <span>${escapeHtml(row.label)}</span>
        <b>${escapeHtml(row.value)}</b>
      </div>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function renderLevels(data) {
    const grid = $("bpLevelsGrid");
    if (!grid) return;

    const progress = data.progress || {};
    const season = data.season || {};
    const current = Math.max(1, Number(progress.level) || 1);
    const isPremium = progress.is_premium === true;

    grid.innerHTML = (Array.isArray(data.levels) ? data.levels : []).map(level => {
      const n = Number(level.level) || 1;
      const unlocked = n <= current;
      const currentClass = n === current ? " is-current" : "";
      const statusClass = unlocked ? " is-unlocked" : " is-locked";
      const status = n === current ? "NIVEAU ACTUEL" : unlocked ? "DÉBLOQUÉ" : "VERROUILLÉ";
      const premiumStatus = !season.premium_enabled
        ? "DÉSACTIVÉ"
        : isPremium
          ? (unlocked ? "ACCESSIBLE" : "VERROUILLÉ")
          : "PREMIUM REQUIS";

      return `
        <article class="bp-tier${statusClass}${currentClass}" data-level="${n}">
          <header class="bp-tier__head">
            <strong class="bp-tier__number">${String(n).padStart(2, "0")}</strong>
            <span class="bp-tier__xp">${number(level.xp_required)} XP</span>
          </header>
          <span class="bp-tier__status">${status}</span>
          <section class="bp-track">
            <div class="bp-track__head"><span>FREE</span><em>${unlocked ? "ACCESSIBLE" : "VERROUILLÉ"}</em></div>
            <div class="bp-rewards">${renderRewardBlock(level.free_rewards)}</div>
          </section>
          <section class="bp-track bp-track--premium">
            <div class="bp-track__head"><span>PREMIUM</span><em>${premiumStatus}</em></div>
            <div class="bp-rewards">${renderRewardBlock(level.premium_rewards)}</div>
          </section>
        </article>
      `;
    }).join("");

    requestAnimationFrame(() => {
      grid.querySelector(".bp-tier.is-current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function render(data, steam) {
    if (!data?.season) {
      throw new Error("Aucune saison Battle Pass n’est actuellement configurée.");
    }

    const season = data.season;
    const progress = data.progress || { xp: 0, level: 1, is_premium: false, xp_in_level: 0, xp_to_next: season.xp_per_level };
    const level = Math.max(1, Number(progress.level) || 1);
    const maxLevel = Math.max(1, Number(season.max_level) || 50);
    const xpPerLevel = Math.max(1, Number(season.xp_per_level) || 1000);
    const xpInLevel = Math.max(0, Number(progress.xp_in_level) || 0);
    const isMax = level >= maxLevel;
    const percent = isMax ? 100 : Math.max(0, Math.min(100, Math.round((xpInLevel / xpPerLevel) * 100)));
    const premium = progress.is_premium === true;

    text("bpSeasonCode", season.code || "SAISON");
    text("bpSeasonName", season.name || "Battle Pass Senzany");
    text("bpSeasonStart", formatDate(season.starts_at));
    text("bpSeasonEnd", formatDate(season.ends_at));
    text("bpSeasonStatus", seasonStatus(season.status));
    text("bpSeasonMini", season.code || "—");
    text("bpSeasonWindow", `${formatDate(season.starts_at)} → ${formatDate(season.ends_at)}`);

    const avatar = $("bpAvatar");
    if (avatar && steam?.avatar) avatar.src = steam.avatar;
    text("bpPlayerName", steam?.name || progress.player_name || "Survivant");
    text("bpSteamId", `SteamID64 // ${steam?.steamId || progress.steam_id || "—"}`);

    text("bpCurrentLevel", level);
    text("bpMaxLevel", `/ ${maxLevel}`);
    text("bpTotalXp", `XP TOTAL // ${number(progress.xp)}`);
    text("bpXpText", isMax ? "NIVEAU MAXIMUM" : `${number(xpInLevel)} / ${number(xpPerLevel)} XP`);
    text("bpXpPercent", `${percent}%`);
    const bar = $("bpProgressBar");
    if (bar) bar.style.width = `${percent}%`;

    text("bpNextLevel", isMax ? "NIVEAU MAXIMUM" : `NIVEAU ${Math.min(maxLevel, level + 1)}`);
    text("bpNextXp", isMax ? "Progression de saison complétée" : `${number(Math.max(0, xpPerLevel - xpInLevel))} XP restantes`);

    const badge = $("bpPremiumBadge");
    if (badge) {
      badge.textContent = premium ? "PREMIUM" : "FREE";
      badge.classList.toggle("is-premium", premium);
    }

    text("bpPremiumState", premium ? "ACTIVE" : "NON ACTIVE");
    text("bpPremiumHint", premium ? "SteamID autorisé" : "Activation via Tip4Serv");

    const premiumButton = $("bpPremiumButton");
    if (premiumButton) premiumButton.hidden = premium;

    const cta = $("bpPremiumCta");
    if (cta && premium) {
      cta.classList.add("is-owned");
      const title = cta.querySelector("h2");
      const paragraph = cta.querySelector("p");
      if (title) title.textContent = "Pass Premium actif";
      if (paragraph) paragraph.textContent = "Ton accès Premium est synchronisé. Les paliers Premium atteints sont accessibles depuis le Battle Pass en jeu.";
    }

    renderLevels(data);
    show("content");
  }

  async function load() {
    show("loading");
    try {
      // Vérifier d'abord la session Steam. Ne pas appeler le Battle Pass
      // tant que le joueur n'est pas authentifié, sinon /me répond 401.
      const steam = await window.SenzanyAPI.steam.getMe();

      if (!steam?.loggedIn) {
        show("loggedOut");
        return;
      }

      const battlePass = await window.SenzanyAPI.battlePass.getMe();
      render(battlePass, steam);
    } catch (error) {
      if (error?.status === 401) {
        show("loggedOut");
        return;
      }
      text("bpErrorText", error?.message || "Impossible de récupérer les données pour le moment.");
      show("error");
      console.error("[BATTLE PASS PAGE]", error);
    }
  }

  $("bpRetry")?.addEventListener("click", load);
  load();
})();
