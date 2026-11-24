/**
 * UAG RUGBY GAILLAC - Interface Minimaliste & Sobre
 * Suivi de match en direct, optimisé pour une utilisation fluide et concentrée sur l'action
 */

// Liste épurée des actions officielles
const ACTIONS = [
  { key: "tackles_made", label: "Plaquage réussi", icon: "🛡️", group: "defense", sub: "Adversaire stoppé" },
  { key: "tackles_missed", label: "Plaquage manqué", icon: "⚠️", group: "defense", sub: "Adversaire battu / non stoppé" },
  { key: "turnovers_won", label: "Grattage", icon: "🧲", group: "defense", sub: "Ballon récupéré au sol" },
  { key: "offensive_actions", label: "Action offensive", icon: "⚡", group: "attaque", sub: "Percée, franchissement, passe clé" },
  { key: "turnovers_lost", label: "Perte de balle", icon: "❌", group: "attaque", sub: "En-avant, ballon perdu" },
  { key: "rucks_lost", label: "Ruck inefficace", icon: "📉", group: "attaque", sub: "Soutien en retard, ballon concédé" },
  { key: "tries", label: "Essai marqué", icon: "🏉", group: "marque", sub: "+5 pts au score du match", isHighlight: true },
  { key: "lineout_throws_made", label: "Lancer réussi", icon: "🎯", group: "conquete", sub: "Touche captée par notre alignement" },
  { key: "lineout_throws_lost", label: "Lancer manqué", icon: "💨", group: "conquete", sub: "Touche perdue ou pas droite" },
  { key: "penalties", label: "Pénalité", icon: "🚩", group: "discipline", sub: "Faute concédée au sifflet" },
  { key: "cards", label: "Carton", icon: "🟨", group: "discipline", sub: "Blanc, Jaune ou Rouge", isCardModal: true },
  { key: "minutes_played", label: "Temps de jeu", icon: "⏱️", group: "temps", sub: "Minutes sur le terrain", isTime: true }
];

let matchState = {
  match: {
    opponent: "Adversaire",
    scoreUAG: 0,
    scoreOpponent: 0,
    currentHalf: "first",
    timer: { minutes: 40, seconds: 0, isRunning: false }
  },
  players: [],
  history: []
};

let activePlayerId = "p1";
let selectedPlayerIds = ["p1"];
let myAssignedPlayerIds = [];
try {
  const saved = localStorage.getItem("uag_my_players");
  if (saved) {
    myAssignedPlayerIds = JSON.parse(saved);
  }
} catch (e) {
  myAssignedPlayerIds = [];
}
let activeHalf = "first"; // "first", "second", "total"
let activePhaseFilter = "all";
let activePosFilter = "all";
let tableSortCol = "name";
let tableSortAsc = true;
let eventSource = null;
let timerInterval = null;
let serverNetworkInfo = null;
let toastTimeout = null;
let standingsData = null;
let isToucheMode = localStorage.getItem("uag_touche_mode") !== "false";
let showMoreActionsInToucheMode = false;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initHalfButtons();
  initPhaseFilterButtons();
  fetchState();
  initSSE();
  initUIEvents();
  initStandingsEvents();
  initSunlightMode();
  fetchNetworkInfo();
  fetchStandings();
});

/* ==========================================================================
   TEMPS RÉEL SSE
   ========================================================================== */
function initSSE() {
  const liveDot = document.querySelector(".pulse-dot");
  const liveText = document.getElementById("live-text");

  if (eventSource) eventSource.close();

  try {
    eventSource = new EventSource("/api/events");

    eventSource.onopen = () => {
      if (liveDot) liveDot.style.background = "var(--uag-green)";
      if (liveText) liveText.textContent = "Direct";
    };

    eventSource.addEventListener("init", (e) => {
      try {
        matchState = JSON.parse(e.data);
        renderAll();
      } catch (err) {}
    });

    eventSource.addEventListener("action", (e) => {
      try {
        const payload = JSON.parse(e.data);
        matchState = payload.state;
        renderAll();
        if (payload.lastAction) {
          flashCard(payload.lastAction.category);
          showToast(payload.lastAction);
        }
      } catch (err) {}
    });

    eventSource.addEventListener("undo", (e) => {
      try {
        const payload = JSON.parse(e.data);
        matchState = payload.state;
        renderAll();
        hideToast();
      } catch (err) {}
    });

    eventSource.addEventListener("match_update", (e) => {
      try {
        matchState = JSON.parse(e.data);
        renderAll();
      } catch (err) {}
    });

    eventSource.addEventListener("players_update", (e) => {
      try {
        matchState = JSON.parse(e.data);
        renderAll();
      } catch (err) {}
    });

    eventSource.addEventListener("reset", (e) => {
      try {
        matchState = JSON.parse(e.data);
        renderAll();
      } catch (err) {}
    });

    eventSource.addEventListener("standings_update", (e) => {
      try {
        standingsData = JSON.parse(e.data);
        renderStandings();
      } catch (err) {}
    });

    eventSource.onerror = () => {
      if (liveDot) liveDot.style.background = "var(--uag-danger)";
      if (liveText) liveText.textContent = "Reconnexion...";
    };
  } catch (err) {
    fetchState();
  }
}

async function fetchState() {
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      matchState = await res.json();
      renderAll();
    }
  } catch (e) {}
}

async function fetchNetworkInfo() {
  try {
    const res = await fetch("/api/network");
    if (res.ok) {
      serverNetworkInfo = await res.json();
      const el = document.getElementById("share-url-text");
      if (el && serverNetworkInfo.url) el.textContent = serverNetworkInfo.url;
    }
  } catch (e) {}
}

/* ==========================================================================
   NAVIGATION PAR ONGLETS & MI-TEMPS
   ========================================================================== */
function initTabs() {
  const tabButtons = document.querySelectorAll(".nav-tab-item");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-tab-item").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `tab-${tabId}`);
  });

  if (tabId === "team") {
    renderTeamTable();
    renderTeamKPIs();
  } else if (tabId === "feed") {
    renderLiveFeed();
  } else if (tabId === "standings") {
    renderStandings();
  }
}

function initHalfButtons() {
  const halfButtons = document.querySelectorAll(".segment-btn");
  halfButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      halfButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeHalf = btn.dataset.half;
      renderAll();
    });
  });
}

function initPhaseFilterButtons() {
  const filterBtns = document.querySelectorAll(".phase-pill");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activePhaseFilter = btn.dataset.phase;
      renderActionsGrid();
    });
  });
}

/* ==========================================================================
   ENVOI D'ACTIONS DE SAISIE
   ========================================================================== */
async function sendStatAction(category, delta) {
  if (activeHalf === "total") {
    alert("Mode consultation actif. Choisissez 1ère ou 2ème mi-temps pour saisir.");
    return;
  }

  if (!activePlayerId) {
    alert("Veuillez sélectionner une joueuse dans votre bandeau.");
    openGroupModal();
    return;
  }

  if (navigator.vibrate) {
    try { navigator.vibrate(delta > 0 ? 25 : [15, 10, 15]); } catch (e) {}
  }

  if (category === "tries" && delta > 0) {
    triggerEssaiCelebration();
  }

  const payload = {
    playerId: activePlayerId,
    playerIds: [activePlayerId],
    half: activeHalf,
    category: category,
    delta: delta,
    user: "Staff UAG"
  };

  try {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      matchState = data.state;
      renderAll();
      flashCard(category);
      triggerCountPop(category);
      if (data.action) showToast(data.action);
    }
  } catch (e) {
    console.error(e);
  }
}

async function sendUndoAction() {
  if (navigator.vibrate) {
    try { navigator.vibrate(40); } catch (e) {}
  }
  try {
    const res = await fetch("/api/undo", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        matchState = data.state;
        renderAll();
        hideToast();
      } else {
        alert(data.message || "Aucune action à annuler");
      }
    }
  } catch (e) {}
}

function showToast(action) {
  const container = document.getElementById("toast-action-container");
  const textEl = document.getElementById("toast-action-text");
  if (!container || !textEl) return;

  const sign = action.delta > 0 ? "+" : "";
  textEl.textContent = `${action.playerName} : ${sign}${action.delta} ${action.label}`;
  container.style.display = "flex";

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(hideToast, 4000);
}

function hideToast() {
  const container = document.getElementById("toast-action-container");
  if (container) container.style.display = "none";
}

function flashCard(category) {
  const card = document.querySelector(`.action-card[data-cat="${category}"]`);
  if (card) {
    card.classList.remove("card-flash");
    void card.offsetWidth;
    card.classList.add("card-flash");
  }
}

function triggerCountPop(category) {
  const el = document.getElementById(`touche-count-${category}`);
  if (el) {
    el.classList.remove("count-pop");
    void el.offsetWidth;
    el.classList.add("count-pop");
  }
}

/* ==========================================================================
   RENDU VISUEL
   ========================================================================== */
function renderAll() {
  updateToucheModeUI();
  renderScoreboard();
  renderAssignedPlayersSection();
  renderActionsGrid();
  renderUndoButton();
  renderTeamTable();
  renderTeamKPIs();
  renderLiveFeed();
  renderSettingsPlayersList();
}

function updateToucheModeUI() {
  const btnTouche = document.getElementById("btn-toggle-touche-mode");
  const labelTouche = document.getElementById("label-touche-mode");

  if (btnTouche) btnTouche.classList.toggle("active", isToucheMode);
  if (labelTouche) labelTouche.textContent = isToucheMode ? "Mode Touche" : "Mode Complet";
}

function renderScoreboard() {
  const m = matchState.match || {};
  const uagEl = document.getElementById("score-uag");
  const oppEl = document.getElementById("score-opponent");
  const oppLbl = document.getElementById("label-opponent");
  if (uagEl) uagEl.textContent = m.scoreUAG !== undefined ? m.scoreUAG : 0;
  if (oppEl) oppEl.textContent = m.scoreOpponent !== undefined ? m.scoreOpponent : 0;
  if (oppLbl) oppLbl.textContent = (m.opponent || "ADV").substring(0, 5).toUpperCase();

  const timerDisplay = document.getElementById("match-timer-display");
  const btnToggle = document.getElementById("btn-timer-toggle");
  if (m.timer && timerDisplay) {
    const min = String(m.timer.minutes || 0).padStart(2, "0");
    const sec = String(m.timer.seconds || 0).padStart(2, "0");
    timerDisplay.textContent = `${min}:${sec}`;
    if (btnToggle) btnToggle.textContent = m.timer.isRunning ? "⏸" : "▶";
  }

  // Modale score
  const modalUag = document.getElementById("score-modal-uag-val");
  const modalOpp = document.getElementById("score-modal-opp-val");
  const modalOppLbl = document.getElementById("score-modal-opp-label");
  if (modalUag) modalUag.textContent = m.scoreUAG || 0;
  if (modalOpp) modalOpp.textContent = m.scoreOpponent || 0;
  if (modalOppLbl) modalOppLbl.textContent = (m.opponent || "ADVERSAIRE").toUpperCase();
}

/* ==========================================================================
   BANDEAU DES JOUEUSES ASSIGNÉES (PARTAGE ENTRE BLESSÉES SUR LA TOUCHE)
   ========================================================================== */
function renderAssignedPlayersSection() {
  const players = matchState.players || [];
  if (players.length === 0) return;

  // Si aucun joueur assigné en mémoire, initialiser avec les 5 premières
  if (!myAssignedPlayerIds || myAssignedPlayerIds.length === 0) {
    myAssignedPlayerIds = players.slice(0, 5).map(p => p.id);
    try {
      localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
    } catch (e) {}
  }

  // Filtrer les IDs qui n'existent plus
  myAssignedPlayerIds = myAssignedPlayerIds.filter(id => players.some(p => p.id === id));
  if (myAssignedPlayerIds.length === 0 && players.length > 0) {
    myAssignedPlayerIds = [players[0].id];
  }

  // Vérifier activePlayerId
  if (!activePlayerId || !myAssignedPlayerIds.includes(activePlayerId)) {
    activePlayerId = myAssignedPlayerIds[0] || (players[0] ? players[0].id : "");
  }

  // Mettre à jour le badge de compteur
  const countBadge = document.getElementById("assigned-count-pill");
  if (countBadge) {
    countBadge.textContent = myAssignedPlayerIds.length;
  }

  renderAssignedPlayersStrip();
  renderActivePlayerBanner();
}

function renderAssignedPlayersStrip() {
  const strip = document.getElementById("assigned-players-strip");
  if (!strip) return;

  const players = matchState.players || [];
  strip.innerHTML = "";

  if (myAssignedPlayerIds.length === 0) {
    const emptyPrompt = document.createElement("div");
    emptyPrompt.className = "assigned-empty-prompt";
    emptyPrompt.innerHTML = `<span>👥</span> <span>Aucune joueuse suivie. Touchez ici pour choisir vos joueuses</span>`;
    emptyPrompt.onclick = openGroupModal;
    strip.appendChild(emptyPrompt);
    return;
  }

  myAssignedPlayerIds.forEach(id => {
    const p = players.find(x => x.id === id);
    if (!p) return;

    const isActive = (p.id === activePlayerId);
    const stats = getPlayerStats(p, activeHalf);
    const tMade = stats.tackles_made || 0;
    const tries = stats.tries || 0;

    const badge = document.createElement("div");
    badge.className = `assigned-player-badge ${isActive ? "active" : ""}`;
    badge.title = `Sélectionner ${p.name} (#${p.number || "-"})`;
    badge.onclick = () => setActivePlayer(p.id);

    badge.innerHTML = `
      <div class="rugby-jersey-mini ${isActive ? "jersey-active" : ""}">
        <span class="jersey-mini-num">${p.number || "-"}</span>
      </div>
      <span class="assigned-badge-name">${p.name}</span>
      <span class="assigned-badge-stat">${tMade} plq${tries > 0 ? ` • ${tries} 🏉` : ""}</span>
      ${isActive ? `<span class="assigned-badge-active-dot" title="Active"></span>` : ""}
    `;

    strip.appendChild(badge);
  });
}

function setActivePlayer(id) {
  activePlayerId = id;
  if (!myAssignedPlayerIds.includes(id)) {
    myAssignedPlayerIds.push(id);
    try {
      localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
    } catch (e) {}
  }
  renderAssignedPlayersStrip();
  renderActivePlayerBanner();
  renderActionsGrid();
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch (e) {}
  }
}

function renderActivePlayerBanner() {
  const banner = document.getElementById("active-player-banner");
  if (!banner) return;

  const players = matchState.players || [];
  const p = players.find(x => x.id === activePlayerId);

  if (!p) {
    banner.innerHTML = `
      <div class="active-banner-left">
        <span style="font-size:1.1rem;">⚠️</span>
        <span class="active-banner-name" style="color:var(--uag-gold);">Aucune joueuse active</span>
      </div>
      <button type="button" class="btn-manage-group" onclick="openGroupModal()">Choisir</button>
    `;
    return;
  }

  const stats = getPlayerStats(p, activeHalf);
  const tMade = stats.tackles_made || 0;
  const tMiss = stats.tackles_missed || 0;
  const tTot = tMade + tMiss;
  const tRate = tTot > 0 ? Math.round((tMade / tTot) * 100) : 0;
  const tries = stats.tries || 0;
  const turnWon = stats.turnovers_won || 0;

  banner.innerHTML = `
    <div class="active-banner-left">
      <div class="rugby-jersey-mini jersey-active">
        <span class="jersey-mini-num">${p.number || "-"}</span>
      </div>
      <span class="active-banner-name">${p.name}</span>
      <span class="active-banner-pos">${p.position || "Joueuse"}</span>
    </div>
    <div class="active-banner-stats">
      ${tTot > 0 ? `🛡️ ${tRate}% (${tMade}/${tTot})` : `🛡️ 0 plq`} • 🏉 ${tries} essai${tries > 1 ? "s" : ""} • 🧲 ${turnWon} grattage${turnWon > 1 ? "s" : ""}
    </div>
  `;
}

/* ==========================================================================
   MODALE DU CHOIX DU GROUPE DE JOUEUSES
   ========================================================================== */
function openGroupModal() {
  const modal = document.getElementById("group-modal-backdrop");
  if (!modal) return;
  modal.style.display = "flex";
  renderGroupModalList();
}

function closeGroupModal() {
  const modal = document.getElementById("group-modal-backdrop");
  if (!modal) return;
  modal.style.display = "none";
}

function renderGroupModalList() {
  const list = document.getElementById("dropdown-players-list");
  if (!list) return;

  const players = matchState.players || [];
  list.innerHTML = "";

  players.forEach(p => {
    const isChecked = myAssignedPlayerIds.includes(p.id);
    const stats = getPlayerStats(p, activeHalf);
    const tMade = stats.tackles_made || 0;

    const row = document.createElement("div");
    row.className = `group-player-row ${isChecked ? "selected" : ""}`;
    row.onclick = () => toggleAssignedPlayer(p.id);

    row.innerHTML = `
      <input type="checkbox" class="group-player-checkbox" ${isChecked ? "checked" : ""} onclick="event.stopPropagation(); toggleAssignedPlayer('${p.id}');">
      <div class="rugby-jersey-mini ${isChecked ? "jersey-active" : ""}">
        <span class="jersey-mini-num">${p.number || "-"}</span>
      </div>
      <div class="group-player-meta">
        <span class="group-player-name">${p.name}</span>
        <span class="group-player-pos">${p.position || "Joueuse"}</span>
      </div>
      <div class="group-player-quickstat">
        ${tMade} plq
      </div>
      <button type="button" class="btn-select-only" onclick="event.stopPropagation(); selectOnlyAssignedPlayer('${p.id}')">
        Seule
      </button>
    `;

    list.appendChild(row);
  });

  const summary = document.getElementById("dropdown-footer-summary");
  if (summary) {
    summary.textContent = `${myAssignedPlayerIds.length} joueuse${myAssignedPlayerIds.length > 1 ? "s" : ""} dans mon bandeau`;
  }
}

function toggleAssignedPlayer(id) {
  if (myAssignedPlayerIds.includes(id)) {
    myAssignedPlayerIds = myAssignedPlayerIds.filter(x => x !== id);
    if (activePlayerId === id) {
      activePlayerId = myAssignedPlayerIds[0] || "";
    }
  } else {
    myAssignedPlayerIds.push(id);
    if (!activePlayerId) {
      activePlayerId = id;
    }
  }
  try {
    localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
  } catch (e) {}

  renderGroupModalList();
  renderAssignedPlayersSection();
  renderActionsGrid();
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
}

function selectOnlyAssignedPlayer(id) {
  myAssignedPlayerIds = [id];
  activePlayerId = id;
  try {
    localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
  } catch (e) {}

  closeGroupModal();
  renderAssignedPlayersSection();
  renderActionsGrid();
  if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
}

function setAssignedPreset(preset) {
  const players = matchState.players || [];
  if (preset === "all") {
    myAssignedPlayerIds = players.map(p => p.id);
  } else if (preset === "forwards") {
    myAssignedPlayerIds = players.filter(p => (p.number || 0) >= 1 && (p.number || 0) <= 8).map(p => p.id);
    if (myAssignedPlayerIds.length === 0) {
      myAssignedPlayerIds = players.slice(0, 8).map(p => p.id);
    }
  } else if (preset === "backs") {
    myAssignedPlayerIds = players.filter(p => (p.number || 0) >= 9).map(p => p.id);
    if (myAssignedPlayerIds.length === 0) {
      myAssignedPlayerIds = players.slice(8).map(p => p.id);
    }
  } else if (preset === "clear") {
    myAssignedPlayerIds = [];
  }

  if (!myAssignedPlayerIds.includes(activePlayerId)) {
    activePlayerId = myAssignedPlayerIds[0] || (players[0] ? players[0].id : "");
  }

  try {
    localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
  } catch (e) {}

  renderGroupModalList();
  renderAssignedPlayersSection();
  renderActionsGrid();
  if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
}

function validateGroupSelection() {
  try {
    localStorage.setItem("uag_my_players", JSON.stringify(myAssignedPlayerIds));
  } catch (e) {}
  closeGroupModal();
  renderAssignedPlayersSection();
  renderActionsGrid();
  if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
}

// Compatibilité
function renderPlayerDropdown() { renderAssignedPlayersSection(); }
function openPlayerDropdown() { openGroupModal(); }
function closePlayerDropdown() { closeGroupModal(); }
function togglePlayerDropdown() { openGroupModal(); }
function togglePlayerSelection(id) { toggleAssignedPlayer(id); }
function selectOnlyPlayer(id) { selectOnlyAssignedPlayer(id); }
function selectPlayerPreset(preset) { setAssignedPreset(preset); }
function clearPlayerSelection() { setAssignedPreset("clear"); }

function renderPlayerChips() {}
function renderQuickNumberPad() {}
function renderPlayerSummary() {}

// MODE PLEIN SOLEIL / HAUT CONTRASTE EXTÉRIEUR
function initSunlightMode() {
  const btn = document.getElementById("btn-sunlight-toggle");
  const icon = document.getElementById("sunlight-icon");
  const isSunlight = localStorage.getItem("uag_sunlight_mode") === "true";

  if (isSunlight) {
    document.body.classList.add("sunlight-mode");
    if (icon) icon.textContent = "🌙";
  }

  if (btn) {
    btn.onclick = () => {
      const active = document.body.classList.toggle("sunlight-mode");
      localStorage.setItem("uag_sunlight_mode", active ? "true" : "false");
      if (icon) icon.textContent = active ? "🌙" : "☀️";
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
    };
  }
}

function getPlayerStats(player, half) {
  if (!player || !player.stats) return {};
  if (half === "total") {
    const first = player.stats.first || {};
    const second = player.stats.second || {};
    const total = {};
    ACTIONS.forEach(a => {
      total[a.key] = (first[a.key] || 0) + (second[a.key] || 0);
    });
    total.yellow_cards = (first.yellow_cards || 0) + (second.yellow_cards || 0);
    total.white_cards = (first.white_cards || 0) + (second.white_cards || 0);
    total.red_cards = (first.red_cards || 0) + (second.red_cards || 0);
    return total;
  }
  return player.stats[half] || {};
}

function renderActionsGrid() {
  const grid = document.getElementById("stats-buttons-grid");
  if (!grid) return;

  const players = matchState.players || [];
  const activePlayer = players.find(p => p.id === activePlayerId) || (players.length > 0 ? players[0] : null);
  const stats = activePlayer ? getPlayerStats(activePlayer, activeHalf) : {};
  const isTotal = activeHalf === "total";

  grid.innerHTML = "";

  if (isToucheMode) {
    // TOUTES LES ACTIONS EN GROS BOUTONS ERGONOMIQUES (MODE TOUCHE COMPLET)
    const toucheContainer = document.createElement("div");
    toucheContainer.className = "touche-grid-6";

    const toucheActions = [
      { key: "tackles_made", label: "Plaquage Réussi", icon: "🛡️", cls: "touche-plaq-made", sub: "Adversaire stoppé" },
      { key: "tackles_missed", label: "Plaquage Manqué", icon: "⚠️", cls: "touche-plaq-miss", sub: "Adversaire manqué" },
      { key: "turnovers_won", label: "Grattage Gagné", icon: "🧲", cls: "touche-grattage", sub: "Ballon récupéré au sol" },
      { key: "offensive_actions", label: "Action Off.", icon: "⚡", cls: "touche-offense", sub: "Percée ou passe clé" },
      { key: "turnovers_lost", label: "Balle Perdue", icon: "❌", cls: "touche-lost", sub: "En-avant ou perte" },
      { key: "rucks_lost", label: "Ruck Inefficace", icon: "📉", cls: "touche-ruck", sub: "Soutien en retard" },
      { key: "lineout_throws_made", label: "Lancer Réussi", icon: "🎯", cls: "touche-lineout-made", sub: "Alignement UAG vainqueur" },
      { key: "lineout_throws_lost", label: "Lancer Manqué", icon: "💨", cls: "touche-lineout-lost", sub: "Ballon perdu / pas droit" },
      { key: "penalties", label: "Pénalité", icon: "🚩", cls: "touche-penality", sub: "Faute au sifflet" },
      { key: "yellow_cards", label: "Cartons (B/J/R)", icon: "🟨", cls: "touche-card", isCardModal: true, sub: "Blanc, Jaune ou Rouge" },
      { key: "tries", label: "Essai UAG !", icon: "🏉", cls: "touche-try", sub: "+5 pts au score du match" },
      { key: "minutes_played", label: "Temps de Jeu", icon: "⏱", cls: "touche-time", isTime: true, sub: "Ajuster le temps de jeu" }
    ];

    toucheActions.forEach(act => {
      const btn = document.createElement("div");
      btn.className = `btn-touche-big ${act.cls}`;

      if (act.isCardModal) {
        const totalCards = (stats.yellow_cards || 0) + (stats.white_cards || 0) + (stats.red_cards || 0);
        btn.innerHTML = `
          <div class="btn-touche-header">
            <span class="btn-touche-icon">${act.icon}</span>
            <span class="btn-touche-count" id="touche-count-${act.key}">${totalCards}</span>
          </div>
          <div class="btn-touche-bottom">
            <div class="btn-touche-labels-wrap">
              <span class="btn-touche-label">${act.label}</span>
              <span class="btn-touche-sub">${act.sub}</span>
            </div>
            <span style="font-size:0.75rem; font-weight:800; opacity:0.85;">Choisir ➔</span>
          </div>
        `;
        btn.onclick = () => {
          if (isTotal) { alert("Mode consultation actif. Sélectionnez 1ère ou 2ème mi-temps."); return; }
          openCardPicker();
        };
      } else if (act.isTime) {
        const minVal = stats.minutes_played !== undefined ? stats.minutes_played : 40;
        btn.innerHTML = `
          <div class="btn-touche-header">
            <span class="btn-touche-icon">${act.icon}</span>
            <span class="btn-touche-count" id="touche-count-${act.key}">${minVal}'</span>
          </div>
          <div class="btn-touche-bottom">
            <div class="btn-touche-labels-wrap">
              <span class="btn-touche-label">${act.label}</span>
              <span class="btn-touche-sub">${act.sub}</span>
            </div>
            <div style="display:flex; gap:4px;" onclick="event.stopPropagation();">
              <button class="btn-touche-minus" onclick="sendStatAction('minutes_played', -5)">−5</button>
              <button class="btn-touche-minus" onclick="sendStatAction('minutes_played', 5)">+5</button>
            </div>
          </div>
        `;
        btn.onclick = () => {
          if (isTotal) { alert("Mode consultation actif."); return; }
          sendStatAction("minutes_played", 5);
        };
      } else {
        const count = stats[act.key] || 0;
        btn.innerHTML = `
          <div class="btn-touche-header">
            <span class="btn-touche-icon">${act.icon}</span>
            <span class="btn-touche-count" id="touche-count-${act.key}">${count}</span>
          </div>
          <div class="btn-touche-bottom">
            <div class="btn-touche-labels-wrap">
              <span class="btn-touche-label">${act.label}</span>
              <span class="btn-touche-sub">${act.sub}</span>
            </div>
            ${count > 0 && !isTotal ? `<button class="btn-touche-minus" onclick="event.stopPropagation(); sendStatAction('${act.key}', -1)" title="Retirer 1">−</button>` : ''}
          </div>
        `;
        btn.onclick = () => {
          if (isTotal) {
            alert("Mode consultation actif. Sélectionnez 1ère ou 2ème mi-temps pour saisir.");
            return;
          }
          sendStatAction(act.key, 1);
        };
      }

      toucheContainer.appendChild(btn);
    });

    grid.appendChild(toucheContainer);
    return;
  }

  // MODE STANDARD COMPLET
  const filteredActions = ACTIONS.filter(a => {
    if (activePhaseFilter === "all") return true;
    return a.group === activePhaseFilter;
  });

  filteredActions.forEach(action => {
    renderStandardActionCard(grid, action, stats, isTotal);
  });
}

function renderStandardActionCard(container, action, stats, isTotal) {
  const card = document.createElement("div");
  card.className = `action-card ${action.isHighlight ? "card-highlight" : ""}`;
  card.dataset.cat = action.key;

  if (action.isCardModal) {
    const totalCards = (stats.yellow_cards || 0) + (stats.white_cards || 0) + (stats.red_cards || 0);
    card.innerHTML = `
      <div class="action-label-group">
        <div class="action-name"><span>${action.icon}</span> ${action.label}</div>
        <div class="action-sub">Blanc, Jaune ou Rouge</div>
      </div>
      <div class="action-controls">
        <span class="action-val">${totalCards}</span>
        <button class="btn-act btn-act-plus" ${isTotal ? "disabled style='opacity:0.3;'" : ""} onclick="openCardPicker()">+</button>
      </div>
    `;
  } else if (action.isTime) {
    const minVal = stats.minutes_played !== undefined ? stats.minutes_played : 40;
    card.innerHTML = `
      <div class="action-label-group">
        <div class="action-name"><span>${action.icon}</span> ${action.label}</div>
        <div class="action-sub">${action.sub}</div>
      </div>
      <div class="action-controls">
        <button class="btn-act btn-act-minus" ${isTotal ? "disabled style='opacity:0.3;'" : ""} onclick="sendStatAction('minutes_played', -5)">−5</button>
        <span class="action-val">${minVal}'</span>
        <button class="btn-act btn-act-plus" ${isTotal ? "disabled style='opacity:0.3;'" : ""} onclick="sendStatAction('minutes_played', 5)">+5</button>
      </div>
    `;
  } else {
    const val = stats[action.key] || 0;
    card.innerHTML = `
      <div class="action-label-group">
        <div class="action-name"><span>${action.icon}</span> ${action.label}</div>
        <div class="action-sub">${action.sub}</div>
      </div>
      <div class="action-controls">
        <button class="btn-act btn-act-minus" ${isTotal ? "disabled style='opacity:0.3;'" : ""} onclick="sendStatAction('${action.key}', -1)">−</button>
        <span class="action-val">${val}</span>
        <button class="btn-act btn-act-plus" ${isTotal ? "disabled style='opacity:0.3;'" : ""} onclick="sendStatAction('${action.key}', 1)">+</button>
      </div>
    `;
  }

  container.appendChild(card);
}

function renderUndoButton() {
  const history = matchState.history || [];
  const preview = document.getElementById("undo-label-preview");
  const wrapper = document.getElementById("floating-actions-bar");

  if (!preview || !wrapper) return;

  if (history.length > 0) {
    const last = history[0];
    const sign = last.delta > 0 ? "+" : "";
    preview.textContent = `${last.playerName}: ${sign}${last.delta} ${last.label}`;
    wrapper.style.display = "flex";
  } else {
    wrapper.style.display = "none";
  }
}

/* ==========================================================================
   VUE ÉQUIPE STAFF (LES 3 CHIFFRES CLÉS DU COACH)
   ========================================================================== */
function renderTeamKPIs() {
  const players = matchState.players || [];
  let totalTMade = 0, totalTMiss = 0, totalPenalties = 0;
  let totalTurnWon = 0, totalTurnLost = 0;
  let totalLMade = 0, totalLMiss = 0;
  let whiteCards = 0, yellowCards = 0, redCards = 0;

  const tacklers = [];

  players.forEach(p => {
    const s = getPlayerStats(p, activeHalf);
    const tMade = s.tackles_made || 0;
    const tMiss = s.tackles_missed || 0;
    totalTMade += tMade;
    totalTMiss += tMiss;
    totalPenalties += (s.penalties || 0);
    totalTurnWon += (s.turnovers_won || 0);
    totalTurnLost += (s.turnovers_lost || 0);
    totalLMade += (s.lineout_throws_made || 0);
    totalLMiss += (s.lineout_throws_lost || 0);
    whiteCards += (s.white_cards || 0);
    yellowCards += (s.yellow_cards || 0);
    redCards += (s.red_cards || 0);

    if (tMade > 0) {
      tacklers.push({ name: p.name, number: p.number, count: tMade });
    }
  });

  // 1. CARTE EFFICACITÉ AU PLAQUAGE
  const tTot = totalTMade + totalTMiss;
  const tRate = tTot > 0 ? Math.round((totalTMade / tTot) * 100) : 0;
  const rateEl = document.getElementById("coach-tackles-rate");
  const subEl = document.getElementById("coach-tackles-sub");
  const barEl = document.getElementById("coach-tackles-bar");
  const badgeDefEl = document.getElementById("coach-badge-defense");

  if (rateEl) rateEl.textContent = tTot > 0 ? `${tRate}%` : "-";
  if (subEl) subEl.textContent = `${totalTMade} réussis / ${totalTMiss} manqués`;
  if (barEl) {
    barEl.style.width = `${tRate}%`;
    barEl.style.background = tRate >= 80 ? "var(--uag-green)" : (tRate >= 65 ? "var(--uag-gold)" : "var(--uag-danger)");
  }
  if (badgeDefEl) {
    if (tTot === 0) {
      badgeDefEl.textContent = "À démarrer";
      badgeDefEl.className = "coach-kpi-badge";
    } else if (tRate >= 80) {
      badgeDefEl.textContent = "Solide 🛡️";
      badgeDefEl.className = "coach-kpi-badge badge-green";
    } else if (tRate >= 65) {
      badgeDefEl.textContent = "Correct ⚠️";
      badgeDefEl.className = "coach-kpi-badge badge-gold";
    } else {
      badgeDefEl.textContent = "Fragile 🛑";
      badgeDefEl.className = "coach-kpi-badge badge-red";
    }
  }

  // 2. CARTE DISCIPLINE
  const penEl = document.getElementById("coach-penalties-count");
  const penSubEl = document.getElementById("coach-penalties-sub");
  const discBadgeEl = document.getElementById("coach-badge-discipline");
  const cardsIconEl = document.getElementById("coach-cards-icons");

  if (penEl) penEl.textContent = totalPenalties;
  if (penSubEl) penSubEl.textContent = totalPenalties <= 1 ? "pénalité concédée" : "pénalités concédées";
  if (discBadgeEl) {
    if (totalPenalties <= 3) {
      discBadgeEl.textContent = "Impeccable 🟢";
      discBadgeEl.className = "coach-kpi-badge badge-green";
    } else if (totalPenalties <= 6) {
      discBadgeEl.textContent = "Correct ⚠️";
      discBadgeEl.className = "coach-kpi-badge badge-gold";
    } else {
      discBadgeEl.textContent = "Trop de fautes 🛑";
      discBadgeEl.className = "coach-kpi-badge badge-red";
    }
  }
  if (cardsIconEl) {
    const totalCards = whiteCards + yellowCards + redCards;
    if (totalCards === 0) {
      cardsIconEl.innerHTML = `<span class="badge-no-card">✓ 0 carton</span>`;
    } else {
      let cardsHtml = "";
      if (whiteCards > 0) cardsHtml += `<span class="card-tag card-tag-white">${whiteCards} B</span> `;
      if (yellowCards > 0) cardsHtml += `<span class="card-tag card-tag-yellow">${yellowCards} J</span> `;
      if (redCards > 0) cardsHtml += `<span class="card-tag card-tag-red">${redCards} R</span> `;
      cardsIconEl.innerHTML = cardsHtml;
    }
  }

  // 3. CARTE COMBAT & BALLONS (GRATTAGES VS PERTES)
  const diffBallons = totalTurnWon - totalTurnLost;
  const balanceEl = document.getElementById("coach-turnover-balance");
  const balanceSubEl = document.getElementById("coach-turnover-sub");
  const balanceBadgeEl = document.getElementById("coach-badge-turnovers");
  const lineoutPctEl = document.getElementById("coach-lineout-pct");

  if (balanceEl) {
    balanceEl.textContent = diffBallons > 0 ? `+${diffBallons}` : `${diffBallons}`;
    balanceEl.style.color = diffBallons > 0 ? "var(--uag-green)" : (diffBallons < 0 ? "var(--uag-danger)" : "#fff");
  }
  if (balanceSubEl) balanceSubEl.textContent = `${totalTurnWon} grattages / ${totalTurnLost} pertes`;
  if (balanceBadgeEl) {
    if (diffBallons > 0) {
      balanceBadgeEl.textContent = `+${diffBallons} ballons 💥`;
      balanceBadgeEl.className = "coach-kpi-badge badge-green";
    } else if (diffBallons === 0) {
      balanceBadgeEl.textContent = "Équilibré";
      balanceBadgeEl.className = "coach-kpi-badge badge-gold";
    } else {
      balanceBadgeEl.textContent = `${diffBallons} ballons ⚠️`;
      balanceBadgeEl.className = "coach-kpi-badge badge-red";
    }
  }
  const lTot = totalLMade + totalLMiss;
  if (lineoutPctEl) {
    lineoutPctEl.textContent = lTot > 0 ? `${Math.round((totalLMade / lTot) * 100)}% (${totalLMade}/${lTot})` : "-";
  }

  // 4. PODIUM TOP 3 DU VESTIAIRE
  const podiumEl = document.getElementById("coach-podium-list");
  if (podiumEl) {
    tacklers.sort((a, b) => b.count - a.count);
    const top3 = tacklers.slice(0, 3);
    if (top3.length === 0) {
      podiumEl.innerHTML = `<span style="color:var(--text-muted); font-size:0.75rem;">En attente des premiers plaquages...</span>`;
    } else {
      const medals = ["🥇", "🥈", "🥉"];
      podiumEl.innerHTML = top3.map((t, i) => `
        <div class="podium-item">
          <span class="podium-medal">${medals[i]}</span>
          <div>
            <div class="podium-player-name">${t.name} <small style="color:var(--text-muted);">#${t.number || ""}</small></div>
            <div class="podium-player-count"><strong>${t.count}</strong> plaquages</div>
          </div>
        </div>
      `).join("");
    }
  }
}

function renderTeamTable() {
  const tbody = document.getElementById("team-table-body");
  const tfoot = document.getElementById("team-table-foot");
  if (!tbody || !tfoot) return;

  const players = matchState.players || [];
  tbody.innerHTML = "";

  const search = (document.getElementById("input-search-player")?.value || "").toLowerCase().trim();

  let filtered = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) && !String(p.number).includes(search)) return false;
    const num = parseInt(p.number) || 0;
    if (activePosFilter === "forwards") return num >= 1 && num <= 8;
    if (activePosFilter === "backs") return num >= 9 && num <= 15;
    return true;
  });

  filtered.sort((a, b) => {
    const sA = getPlayerStats(a, activeHalf);
    const sB = getPlayerStats(b, activeHalf);
    let vA = sA[tableSortCol] || a[tableSortCol] || 0;
    let vB = sB[tableSortCol] || b[tableSortCol] || 0;
    if (typeof vA === "string") return tableSortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    return tableSortAsc ? vA - vB : vB - vA;
  });

  const totals = { tMade: 0, tMiss: 0, grattage: 0, off: 0, lost: 0, pen: 0, cards: 0, tries: 0, lMade: 0, lMiss: 0 };

  filtered.forEach(p => {
    const s = getPlayerStats(p, activeHalf);
    const tMade = s.tackles_made || 0;
    const tMiss = s.tackles_missed || 0;
    const tRate = (tMade + tMiss) > 0 ? Math.round((tMade / (tMade + tMiss)) * 100) + "%" : "-";
    const lMade = s.lineout_throws_made || 0;
    const lMiss = s.lineout_throws_lost || 0;
    const lRate = (lMade + lMiss) > 0 ? Math.round((lMade / (lMade + lMiss)) * 100) + "%" : "-";
    const cards = (s.yellow_cards || 0) + (s.white_cards || 0) + (s.red_cards || 0);

    totals.tMade += tMade;
    totals.tMiss += tMiss;
    totals.grattage += s.turnovers_won || 0;
    totals.off += s.offensive_actions || 0;
    totals.lost += s.turnovers_lost || 0;
    totals.pen += s.penalties || 0;
    totals.cards += cards;
    totals.tries += s.tries || 0;
    totals.lMade += lMade;
    totals.lMiss += lMiss;

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.onclick = () => {
      activePlayerId = p.id;
      switchTab("tracker");
    };

    tr.innerHTML = `
      <td class="sticky-player-col">#${p.number || "-"} ${p.name}</td>
      <td>${p.position || "-"}</td>
      <td class="col-green">${tMade}</td>
      <td class="col-red">${tMiss}</td>
      <td>${tRate}</td>
      <td>${s.turnovers_won || 0}</td>
      <td class="col-gold">${s.offensive_actions || 0}</td>
      <td class="col-red">${s.turnovers_lost || 0}</td>
      <td class="col-red">${s.penalties || 0}</td>
      <td>${cards > 0 ? '🟨 ' + cards : 0}</td>
      <td class="col-gold">${s.tries || 0}</td>
      <td>${lMade}</td>
      <td>${lMiss}</td>
      <td>${lRate}</td>
      <td>${s.minutes_played || 0}'</td>
    `;
    tbody.appendChild(tr);
  });

  const totTRate = (totals.tMade + totals.tMiss) > 0 ? Math.round((totals.tMade / (totals.tMade + totals.tMiss)) * 100) + "%" : "-";
  const totLRate = (totals.lMade + totals.lMiss) > 0 ? Math.round((totals.lMade / (totals.lMade + totals.lMiss)) * 100) + "%" : "-";

  tfoot.innerHTML = `
    <tr style="background:var(--bg-surface); font-weight:800;">
      <td class="sticky-player-col">TOTAL</td>
      <td>-</td>
      <td class="col-green">${totals.tMade}</td>
      <td class="col-red">${totals.tMiss}</td>
      <td>${totTRate}</td>
      <td>${totals.grattage}</td>
      <td class="col-gold">${totals.off}</td>
      <td class="col-red">${totals.lost}</td>
      <td class="col-red">${totals.pen}</td>
      <td>${totals.cards}</td>
      <td class="col-gold">${totals.tries}</td>
      <td>${totals.lMade}</td>
      <td>${totals.lMiss}</td>
      <td>${totLRate}</td>
      <td>-</td>
    </tr>
  `;
}

/* ==========================================================================
   JOURNAL DU MATCH (FEED)
   ========================================================================== */
function renderLiveFeed() {
  const feedList = document.getElementById("match-live-feed");
  const countBadge = document.getElementById("feed-count-badge");
  const history = matchState.history || [];

  if (countBadge) countBadge.textContent = history.length;
  if (!feedList) return;

  feedList.innerHTML = "";

  if (history.length === 0) {
    feedList.innerHTML = `<li style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.8rem;">Aucune action enregistrée pour le moment.</li>`;
    return;
  }

  history.forEach(item => {
    const li = document.createElement("li");
    li.className = "clean-feed-item";

    const sign = item.delta > 0 ? "+" : "";
    const colorClass = item.delta > 0 ? "col-green" : "col-red";

    li.innerHTML = `
      <div>
        <span class="feed-time-chip">${item.time || item.minute + "'"}</span>
        <strong>${item.playerName}</strong> : 
        <span class="${colorClass}">${sign}${item.delta}</span> ${item.label}
      </div>
      <span style="font-size:0.7rem; color:var(--text-muted);">👤 ${item.user || "Staff"}</span>
    `;
    feedList.appendChild(li);
  });
}

/* ==========================================================================
   MODALES (SCORE, CARTON, QR)
   ========================================================================== */
function openScoreModal() {
  renderScoreboard();
  document.getElementById("modal-score")?.classList.add("active");
}

function closeScoreModal() {
  document.getElementById("modal-score")?.classList.remove("active");
}

async function addPointsToTeam(team, points) {
  const m = matchState.match || {};
  let scoreUAG = m.scoreUAG || 0;
  let scoreOpp = m.scoreOpponent || 0;

  if (team === "uag") scoreUAG = Math.max(0, scoreUAG + points);
  else scoreOpp = Math.max(0, scoreOpp + points);

  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreUAG, scoreOpponent: scoreOpp })
    });
    if (res.ok) {
      matchState.match.scoreUAG = scoreUAG;
      matchState.match.scoreOpponent = scoreOpp;
      renderScoreboard();
    }
  } catch (err) {}
}

function openCardPicker() {
  const players = matchState.players || [];
  const selected = players.filter(p => selectedPlayerIds.includes(p.id));
  const title = document.getElementById("card-picker-player-name");
  if (title) {
    if (selected.length === 1) {
      title.textContent = `#${selected[0].number} ${selected[0].name} (${selected[0].position})`;
    } else if (selected.length > 1) {
      title.textContent = `${selected.length} joueuses (${selected.map(p => p.name).join(", ")})`;
    } else {
      title.textContent = "Aucune joueuse sélectionnée";
    }
  }
  document.getElementById("modal-card-picker")?.classList.add("active");
}

function closeCardPicker() {
  document.getElementById("modal-card-picker")?.classList.remove("active");
}

async function submitCardAction(cardCategory, delta) {
  closeCardPicker();
  await sendStatAction(cardCategory, delta);
}

function openShareModal() {
  const modal = document.getElementById("modal-share");
  const url = serverNetworkInfo && serverNetworkInfo.url ? serverNetworkInfo.url : window.location.href;
  const linkEl = document.getElementById("share-url-text");
  if (linkEl) linkEl.textContent = url;

  if (window.drawQRCode) {
    const target = document.getElementById("qr-target");
    window.drawQRCode(target, url, 160);
  }

  modal?.classList.add("active");
}

function closeShareModal() {
  document.getElementById("modal-share")?.classList.remove("active");
}

/* ==========================================================================
   EVENEMENTS UI
   ========================================================================== */
function initUIEvents() {
  // Gestion du Groupe de Joueuses Suivies (Modale & Bandeau)
  document.getElementById("btn-open-group-selector")?.addEventListener("click", openGroupModal);
  document.getElementById("btn-group-close-x")?.addEventListener("click", closeGroupModal);
  document.getElementById("btn-group-validate")?.addEventListener("click", validateGroupSelection);
  document.getElementById("btn-filter-forwards")?.addEventListener("click", () => setAssignedPreset("forwards"));
  document.getElementById("btn-filter-backs")?.addEventListener("click", () => setAssignedPreset("backs"));
  document.getElementById("btn-filter-all")?.addEventListener("click", () => setAssignedPreset("all"));
  document.getElementById("btn-filter-clear")?.addEventListener("click", () => setAssignedPreset("clear"));

  // Fermer la modale si clic sur le fond sombre
  document.getElementById("group-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "group-modal-backdrop") {
      closeGroupModal();
    }
  });

  // Undo buttons
  document.getElementById("btn-undo-action")?.addEventListener("click", sendUndoAction);
  document.getElementById("btn-toast-undo")?.addEventListener("click", sendUndoAction);

  // Mode Touche Toggle
  const btnTouche = document.getElementById("btn-toggle-touche-mode");
  const labelTouche = document.getElementById("label-touche-mode");
  if (btnTouche) {
    btnTouche.classList.toggle("active", isToucheMode);
    if (labelTouche) labelTouche.textContent = isToucheMode ? "Mode Touche" : "Mode Complet";
    btnTouche.addEventListener("click", () => {
      isToucheMode = !isToucheMode;
      localStorage.setItem("uag_touche_mode", isToucheMode);
      btnTouche.classList.toggle("active", isToucheMode);
      if (labelTouche) labelTouche.textContent = isToucheMode ? "Mode Touche" : "Mode Complet";
      renderActionsGrid();
    });
  }

  // Export CSV
  document.getElementById("btn-export-csv")?.addEventListener("click", exportCSV);

  // Chrono
  document.getElementById("btn-timer-toggle")?.addEventListener("click", toggleTimer);

  // Modale score
  document.getElementById("scoreboard-trigger")?.addEventListener("click", openScoreModal);
  document.getElementById("btn-close-score")?.addEventListener("click", closeScoreModal);

  // Modale cartons
  document.getElementById("btn-close-card-picker")?.addEventListener("click", closeCardPicker);

  // Modale partage
  document.getElementById("btn-open-share")?.addEventListener("click", openShareModal);
  document.getElementById("btn-close-share")?.addEventListener("click", closeShareModal);
  document.getElementById("btn-copy-url")?.addEventListener("click", () => {
    const url = document.getElementById("share-url-text").textContent;
    navigator.clipboard.writeText(url).then(() => alert("Lien copié dans le presse-papier !"));
  });

  // Filtres position table
  document.querySelectorAll(".segment-mini-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".segment-mini-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activePosFilter = btn.dataset.pos;
      renderTeamTable();
    });
  });

  document.getElementById("input-search-player")?.addEventListener("input", renderTeamTable);

  // Tri tableau
  document.querySelectorAll(".sleek-table th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (tableSortCol === col) tableSortAsc = !tableSortAsc;
      else { tableSortCol = col; tableSortAsc = false; }
      renderTeamTable();
    });
  });

  // Vider journal
  document.getElementById("btn-clear-feed")?.addEventListener("click", () => {
    if (confirm("Effacer le journal du match ?")) {
      matchState.history = [];
      renderLiveFeed();
    }
  });

  // Formulaire ajout de joueuse
  document.getElementById("form-add-player")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("input-new-name").value.trim();
    const number = parseInt(document.getElementById("input-new-number").value) || 0;
    const position = document.getElementById("input-new-position").value;
    if (!name) return;

    try {
      const res = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, number, position })
      });
      if (res.ok) {
        const data = await res.json();
        matchState = data.state;
        renderAll();
        document.getElementById("form-add-player").reset();
        alert(`Joueuse ${name} ajoutée !`);
      }
    } catch (err) {}
  });

  // Charger effectif officiel 15 joueuses
  document.getElementById("btn-load-standard-team")?.addEventListener("click", async () => {
    if (confirm("Charger la feuille type des 15 titulaires UAG Gaillac ?")) {
      const team = [
        { name: "Léa", number: 1, position: "Pilier Gauche" },
        { name: "Nono", number: 2, position: "Talonneuse" },
        { name: "Margaux", number: 3, position: "Pilier Droit" },
        { name: "Élise", number: 4, position: "Deuxième Ligne" },
        { name: "Anaïs", number: 5, position: "Deuxième Ligne" },
        { name: "Marie", number: 6, position: "Troisième Ligne Aile" },
        { name: "Clara", number: 7, position: "Troisième Ligne Aile" },
        { name: "Camille", number: 8, position: "Troisième Ligne Centre" },
        { name: "Lucie", number: 9, position: "Demi de Mêlée" },
        { name: "Sarah", number: 10, position: "Demi d'Ouverture" },
        { name: "Inès", number: 11, position: "Ailière" },
        { name: "Emma", number: 12, position: "Centre" },
        { name: "Manon", number: 13, position: "Centre" },
        { name: "Chloé", number: 14, position: "Ailière" },
        { name: "Julie", number: 15, position: "Arrière" }
      ];
      for (const p of team) {
        await fetch("/api/player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p)
        });
      }
      await fetchState();
      alert("Effectif UAG chargé !");
    }
  });

  // Enregistrer match info
  document.getElementById("btn-save-match-info")?.addEventListener("click", async () => {
    const opponent = document.getElementById("input-match-opponent").value.trim() || "Adversaire";
    const scoreUAG = parseInt(document.getElementById("input-score-uag").value) || 0;
    const scoreOpponent = parseInt(document.getElementById("input-score-opponent").value) || 0;
    try {
      await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponent, scoreUAG, scoreOpponent })
      });
      alert("Match mis à jour !");
    } catch (err) {}
  });

  // Reset mi-temps
  document.getElementById("btn-reset-half")?.addEventListener("click", async () => {
    if (confirm("Réinitialiser les stats de cette mi-temps ?")) {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: activeHalf === "total" ? "first" : activeHalf })
      });
    }
  });

  // Reset match
  document.getElementById("btn-reset-match")?.addEventListener("click", async () => {
    if (confirm("Nouveau match ? Tout remettre à zéro ?")) {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all" })
      });
    }
  });
}

function toggleTimer() {
  const timer = matchState.match.timer || { minutes: 0, seconds: 0, isRunning: false };
  timer.isRunning = !timer.isRunning;

  fetch("/api/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timer })
  });

  if (timer.isRunning) startLocalTimer();
  else clearInterval(timerInterval);
}

function startLocalTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const timer = matchState.match.timer;
    if (timer && timer.isRunning) {
      timer.seconds++;
      if (timer.seconds >= 60) {
        timer.minutes++;
        timer.seconds = 0;
      }
      const min = String(timer.minutes).padStart(2, "0");
      const sec = String(timer.seconds).padStart(2, "0");
      const el = document.getElementById("match-timer-display");
      if (el) el.textContent = `${min}:${sec}`;
    }
  }, 1000);
}

function exportCSV() {
  const players = matchState.players || [];
  const lines = [
    ["Joueuse", "Numero", "Poste", "Mi-temps", "Plaquage reussi", "Plaquage manque", "Grattage", "Action offensive", "Perte de balle", "Penalite", "Cartons", "Essai", "Lancer reussi", "Lancer manque", "Temps"].join(",")
  ];

  players.forEach(p => {
    ["first", "second"].forEach(h => {
      const s = p.stats[h] || {};
      const halfName = h === "first" ? "1ere MT" : "2eme MT";
      const cards = (s.yellow_cards || 0) + (s.white_cards || 0) + (s.red_cards || 0);
      lines.push([
        `"${p.name}"`,
        p.number || "",
        `"${p.position || ""}"`,
        `"${halfName}"`,
        s.tackles_made || 0,
        s.tackles_missed || 0,
        s.turnovers_won || 0,
        s.offensive_actions || 0,
        s.turnovers_lost || 0,
        s.penalties || 0,
        cards,
        s.tries || 0,
        s.lineout_throws_made || 0,
        s.lineout_throws_lost || 0,
        s.minutes_played || 0
      ].join(","));
    });
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Stats_UAG_Gaillac.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderSettingsPlayersList() {
  const container = document.getElementById("settings-players-list");
  const countEl = document.getElementById("settings-players-count");
  const players = matchState.players || [];
  if (countEl) countEl.textContent = players.length;
  if (!container) return;
  container.innerHTML = "";
  if (players.length === 0) {
    container.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; padding:8px 0;">Aucune joueuse enregistrée.</div>`;
    return;
  }
  players.forEach(p => {
    const item = document.createElement("div");
    item.className = "player-manage-item";
    const cleanName = (p.name || "").replace(/'/g, "\\'");
    item.innerHTML = `
      <div class="player-manage-info">
        <span class="player-manage-num">#${p.number !== undefined ? p.number : "-"}</span>
        <span class="player-manage-name">${p.name || "Sans nom"}</span>
        <span class="player-manage-pos">${p.position || "Joueuse"}</span>
      </div>
      <button class="btn-delete-player" onclick="deletePlayer('${p.id}', '${cleanName}')" title="Supprimer cette joueuse">
        🗑 Supprimer
      </button>
    `;
    container.appendChild(item);
  });
}

async function deletePlayer(playerId, playerName) {
  if (confirm(`Supprimer ${playerName} de la feuille de match ?`)) {
    try {
      const res = await fetch("/api/player/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playerId })
      });
      if (res.ok) {
        const data = await res.json();
        matchState = data.state;
        if (activePlayerId === playerId) {
          activePlayerId = matchState.players && matchState.players.length > 0 ? matchState.players[0].id : "";
        }
        renderAll();
      }
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  }
}

/* ==========================================================================
   CLASSEMENT FFR FÉDÉRALE 1 FÉMININE
   ========================================================================== */
async function fetchStandings() {
  try {
    const res = await fetch("/api/standings");
    if (res.ok) {
      standingsData = await res.json();
      renderStandings();
    }
  } catch (e) {
    console.error("Erreur chargement classement:", e);
  }
}

function renderStandings() {
  if (!standingsData) return;
  const teams = standingsData.teams || [];

  // Date de dernière mise à jour
  const dateEl = document.getElementById("standings-last-updated");
  if (dateEl && standingsData.last_updated) {
    dateEl.textContent = standingsData.last_updated;
  }

  // Focus UAG Gaillac
  const uag = teams.find(t => t.is_uag) || teams.find(t => (t.name || "").includes("Gaillac")) || null;
  if (uag) {
    const rankEl = document.getElementById("uag-rank-num");
    const ptsEl = document.getElementById("uag-stat-pts");
    const jEl = document.getElementById("uag-stat-j");
    const diffEl = document.getElementById("uag-stat-diff");
    if (rankEl) rankEl.textContent = uag.rank;
    if (ptsEl) ptsEl.textContent = uag.points;
    if (jEl) jEl.textContent = uag.played;
    if (diffEl) diffEl.textContent = (uag.diff > 0 ? "+" : "") + uag.diff;
  }

  // Tableau complet
  const tbody = document.getElementById("standings-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  teams.forEach(t => {
    const tr = document.createElement("tr");
    if (t.is_uag) tr.className = "row-uag";

    const isTop4 = t.rank <= 4;
    const rankBadgeClass = isTop4 ? "rank-top4" : "rank-other";

    // Form pills
    const formHtml = (t.form || []).map(f => {
      const cls = f === "V" ? "form-v" : (f === "N" ? "form-n" : "form-d");
      return `<span class="form-pill ${cls}">${f}</span>`;
    }).join("");

    tr.innerHTML = `
      <td style="text-align:center;">
        <span class="rank-pill ${rankBadgeClass}">${t.rank}</span>
      </td>
      <td>
        <div class="club-name-cell">
          <span>${t.name}</span>
          ${t.is_uag ? '<span class="uag-tag-mini">UAG</span>' : ''}
        </div>
      </td>
      <td style="text-align:center;" class="cell-points">${t.points}</td>
      <td style="text-align:center;">${t.played}</td>
      <td style="text-align:center; color:var(--uag-green); font-weight:600;">${t.won}</td>
      <td style="text-align:center; color:var(--uag-gold);">${t.drawn}</td>
      <td style="text-align:center; color:var(--uag-danger);">${t.lost}</td>
      <td style="text-align:center;">${t.bonus_off || 0}</td>
      <td style="text-align:center;">${t.bonus_def || 0}</td>
      <td style="text-align:center; font-weight:600; color:${t.diff > 0 ? "var(--uag-green)" : (t.diff < 0 ? "var(--uag-danger)" : "#fff")};">
        ${t.diff > 0 ? "+" + t.diff : t.diff}
      </td>
      <td style="text-align:center;">
        <div class="form-pills">${formHtml}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function initStandingsEvents() {
  document.getElementById("btn-refresh-standings")?.addEventListener("click", async () => {
    await fetchStandings();
    alert("Classement FFR actualisé !");
  });

  const btnToggle = document.getElementById("btn-toggle-edit-standings");
  const editPanel = document.getElementById("standings-edit-panel");
  const editRows = document.getElementById("standings-edit-rows");

  btnToggle?.addEventListener("click", () => {
    if (!standingsData || !editPanel || !editRows) return;
    const isVisible = editPanel.style.display === "block";
    if (isVisible) {
      editPanel.style.display = "none";
      return;
    }
    editPanel.style.display = "block";
    editRows.innerHTML = `
      <div style="display:grid; grid-template-columns:30px 1.5fr repeat(3, 1fr); gap:6px; font-size:0.7rem; color:var(--text-muted); font-weight:700; padding:0 10px;">
        <span>#</span>
        <span>Club</span>
        <span style="text-align:center;">PTS</span>
        <span style="text-align:center;">J</span>
        <span style="text-align:center;">+/-</span>
      </div>
    `;
    (standingsData.teams || []).forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "edit-row-item";
      row.innerHTML = `
        <span style="font-weight:800; color:var(--text-muted); text-align:center;">${t.rank}</span>
        <span style="font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.short_name || t.name}</span>
        <input type="number" class="edit-pts" data-idx="${i}" value="${t.points}">
        <input type="number" class="edit-played" data-idx="${i}" value="${t.played}">
        <input type="number" class="edit-diff" data-idx="${i}" value="${t.diff}">
      `;
      editRows.appendChild(row);
    });
  });

  document.getElementById("btn-cancel-standings")?.addEventListener("click", () => {
    if (editPanel) editPanel.style.display = "none";
  });

  document.getElementById("btn-save-standings")?.addEventListener("click", async () => {
    if (!standingsData) return;
    const ptsInputs = document.querySelectorAll(".edit-pts");
    const playedInputs = document.querySelectorAll(".edit-played");
    const diffInputs = document.querySelectorAll(".edit-diff");

    const newTeams = JSON.parse(JSON.stringify(standingsData.teams || []));
    ptsInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx);
      if (newTeams[idx]) newTeams[idx].points = parseInt(input.value) || 0;
    });
    playedInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx);
      if (newTeams[idx]) newTeams[idx].played = parseInt(input.value) || 0;
    });
    diffInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx);
      if (newTeams[idx]) newTeams[idx].diff = parseInt(input.value) || 0;
    });

    // Re-trier par points décroissants puis diff décroissante
    newTeams.sort((a, b) => b.points - a.points || b.diff - a.diff);
    newTeams.forEach((t, idx) => { t.rank = idx + 1; });

    try {
      const res = await fetch("/api/standings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: newTeams })
      });
      if (res.ok) {
        const data = await res.json();
        standingsData = data.standings;
        renderStandings();
        if (editPanel) editPanel.style.display = "none";
        alert("Classement mis à jour avec succès !");
      }
    } catch (err) {
      alert("Erreur lors de la sauvegarde du classement.");
    }
  });
}

// Global exposure
window.switchTab = switchTab;
window.sendStatAction = sendStatAction;
window.addPointsToTeam = addPointsToTeam;
window.openCardPicker = openCardPicker;
window.submitCardAction = submitCardAction;
window.deletePlayer = deletePlayer;
window.fetchStandings = fetchStandings;
window.renderStandings = renderStandings;
window.openGroupModal = openGroupModal;
window.closeGroupModal = closeGroupModal;
window.setActivePlayer = setActivePlayer;
window.toggleAssignedPlayer = toggleAssignedPlayer;
window.selectOnlyAssignedPlayer = selectOnlyAssignedPlayer;
window.setAssignedPreset = setAssignedPreset;
window.validateGroupSelection = validateGroupSelection;
