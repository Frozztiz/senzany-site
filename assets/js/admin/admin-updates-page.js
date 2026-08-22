document.addEventListener("DOMContentLoaded", async () => {
  const timeline = document.getElementById("updatesTimeline");
  const buttons = [...document.querySelectorAll("[data-filter]")];
  let entries = [];

  const labels = {
    feature: "NOUVEAUTÉ",
    fix: "CORRECTIF",
    system: "SYSTÈME"
  };

  const months = ["JANV.","FÉVR.","MARS","AVR.","MAI","JUIN","JUIL.","AOÛT","SEPT.","OCT.","NOV.","DÉC."];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render(filter = "all") {
    if (!timeline) return;

    const visible = entries.filter(entry => filter === "all" || entry.type === filter);

    if (!visible.length) {
      timeline.innerHTML = '<div class="update-card"><p>Aucune mise à jour dans cette catégorie.</p></div>';
      return;
    }

    timeline.innerHTML = visible.map(entry => {
      const d = new Date(`${entry.date}T12:00:00`);
      const day = String(d.getDate()).padStart(2, "0");
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const dateFr = new Intl.DateTimeFormat("fr-FR").format(d);
      const type = ["feature","fix","system"].includes(entry.type) ? entry.type : "system";
      const details = Array.isArray(entry.details) && entry.details.length
        ? `<ul>${entry.details.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";

      return `<article class="update-entry" data-type="${type}">
        <div class="update-date"><strong>${day}</strong><span>${month}<br>${year}</span></div>
        <div class="update-card">
          <div class="update-meta"><span class="tag ${type}">${labels[type]}</span><time>${dateFr}</time></div>
          <h2>${escapeHtml(entry.title)}</h2>
          <p>${escapeHtml(entry.description || "")}</p>
          ${details}
        </div>
      </article>`;
    }).join("");
  }

  try {
    const response = await fetch("/data/updates.json", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    entries = Array.isArray(payload.entries) ? payload.entries : [];
    entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    render("all");
  } catch (error) {
    console.error("[Senzany Updates] Chargement impossible :", error);
    if (timeline) timeline.innerHTML = '<div class="update-card"><p>Impossible de charger le journal des mises à jour.</p></div>';
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("is-active"));
    button.classList.add("is-active");
    render(button.dataset.filter || "all");
  }));
});
