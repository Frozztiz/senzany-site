(function () {
  const personaStates = {
    0: "Hors ligne",
    1: "En ligne",
    2: "Occupé",
    3: "Absent",
    4: "En pause",
    5: "Recherche une partie",
    6: "Recherche un échange"
  };

  const loading = document.getElementById("profileLoading");
  const loggedOut = document.getElementById("loggedOutView");
  const loggedIn = document.getElementById("loggedInView");

  function reveal(view) {
    loading.hidden = true;
    loggedOut.hidden = view !== "out";
    loggedIn.hidden = view !== "in";
  }

  function formatLastActivity(timestamp) {
    if (!timestamp) return "Non communiquée";
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(timestamp * 1000));
  }

  function renderDayz(dayz) {
    const hours = document.getElementById("dayzHours");
    const explanation = document.getElementById("dayzExplanation");
    const state = document.getElementById("dayzState");

    if (dayz && dayz.available) {
      hours.textContent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(dayz.hours);
      explanation.textContent = "Temps de jeu total enregistré par Steam pour DayZ. Cette valeur inclut tous les serveurs fréquentés par le joueur.";
      state.textContent = "Donnée publique";
      state.classList.add("panel-state--online");
      return;
    }

    hours.textContent = "Privé";
    state.textContent = "Indisponible";
    state.classList.add("panel-state--pending");

    if (dayz && dayz.reason === "not_found") {
      explanation.textContent = "DayZ n’apparaît pas dans les jeux visibles de ce compte Steam.";
    } else {
      explanation.textContent = "Steam ne permet pas d’afficher cette donnée lorsque les détails de jeux du profil sont privés ou indisponibles.";
    }
  }


  function renderDiscord(discord) {
    const state = document.getElementById("discordState");
    const unlinked = document.getElementById("discordUnlinked");
    const linked = document.getElementById("discordLinked");
    const linkButton = document.getElementById("discordLinkButton");
    const unlinkButton = document.getElementById("discordUnlinkButton");

    if (discord && discord.linked) {
      state.textContent = "Associé";
      state.classList.remove("panel-state--pending");
      state.classList.add("panel-state--online");
      unlinked.hidden = true;
      linked.hidden = false;
      linkButton.hidden = true;
      unlinkButton.hidden = false;
      document.getElementById("discordUsername").textContent = discord.username || "Compte Discord";
      document.getElementById("discordId").textContent = discord.id || "—";
      const avatar = document.getElementById("discordAvatar");
      if (discord.avatar) { avatar.src = discord.avatar; avatar.hidden = false; } else { avatar.hidden = true; }

      const rolesBox = document.getElementById("discordRoles");
      const rolesList = document.getElementById("discordRolesList");
      const rolesEmpty = document.getElementById("discordRolesEmpty");
      rolesList.innerHTML = "";

      if (discord.rolesAvailable) {
        rolesBox.hidden = false;
        const roles = Array.isArray(discord.roles) ? discord.roles : [];
        if (roles.length) {
          rolesEmpty.hidden = true;
          roles.forEach(function (role) {
            const badge = document.createElement("span");
            badge.className = "discord-role-badge";
            badge.textContent = role.name;
            rolesList.appendChild(badge);
          });
        } else {
          rolesEmpty.hidden = false;
        }
      } else {
        rolesBox.hidden = true;
      }
    } else {
      state.textContent = "Non associé";
      state.classList.add("panel-state--pending");
      unlinked.hidden = false;
      linked.hidden = true;
      linkButton.hidden = false;
      unlinkButton.hidden = true;
    }
  }

  function showDiscordFeedback() {
    const code = new URLSearchParams(window.location.search).get("discord");
    if (!code) return;
    const messages = {
      linked: "Compte Discord associé avec succès.",
      cancelled: "Association Discord annulée.",
      already_linked: "Ce compte Discord est déjà associé à un autre compte Steam.",
      steam_required: "Reconnectez-vous à Steam avant d’associer Discord.",
      invalid_state: "La demande d’association a expiré. Recommencez.",
      invalid_callback: "Réponse Discord invalide.",
      token_error: "Discord n’a pas pu finaliser l’autorisation.",
      user_error: "Impossible de lire votre profil Discord.",
      server_error: "Impossible d’enregistrer l’association pour le moment."
    };
    const feedback = document.getElementById("discordFeedback");
    feedback.textContent = messages[code] || "État Discord mis à jour.";
    feedback.hidden = false;
    if (code !== "linked") feedback.classList.add("discord-feedback--error");
    history.replaceState({}, document.title, window.location.pathname);
  }

  document.getElementById("discordUnlinkButton").addEventListener("click", function () {
    if (!confirm("Dissocier votre compte Discord de votre compte Steam Senzany ?")) return;
    window.SenzanyAPI.discord.unlink()
      .then(function () { window.location.reload(); })
      .catch(function () {
        const feedback = document.getElementById("discordFeedback");
        feedback.textContent = "Impossible de dissocier Discord pour le moment.";
        feedback.hidden = false;
        feedback.classList.add("discord-feedback--error");
      });
  });

  window.SenzanyAPI.steam.getMe()
    .then(function (data) {
      if (!data.loggedIn) {
        reveal("out");
        return;
      }

      document.getElementById("profileTag").textContent = "Steam connecté";
      document.getElementById("steamAvatar").src = data.avatar || "";
      document.getElementById("steamName").textContent = data.name || "Survivant";
      document.getElementById("identityName").textContent = data.name || "—";
      document.getElementById("steamIdValue").textContent = data.steamId || "—";
      document.getElementById("steamStatusValue").textContent = personaStates[data.personaState] || "Statut inconnu";
      document.getElementById("lastLogoffValue").textContent = formatLastActivity(data.lastLogoff);

      const profileLink = document.getElementById("steamProfileLink");
      profileLink.href = data.profileUrl || ("https://steamcommunity.com/profiles/" + data.steamId);

      renderDayz(data.dayz);
      renderDiscord(data.discord);
      reveal("in");
      showDiscordFeedback();
    })
    .catch(function () {
      reveal("out");
    });
})();
