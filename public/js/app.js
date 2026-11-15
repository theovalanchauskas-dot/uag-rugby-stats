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
let activeHalf = "first"; // "first", "second", "total"
let activePhaseFilter = "all";
let activePosFilter = "all";
let tableSortCol = "name";
let tableSortAsc = true;
let eventSource = null;
let timerInterval = null;
let serverNetworkInfo = null;
let toastTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initHalfButtons();
  initPhaseFilterButtons();
  initSSE();
  initUIEvents();
  fetchNetworkInfo();
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
    alert("Mode consultation active. Choisissez 1ère ou 2ème mi-temps pour saisir.");
    return;
  }

  if (navigator.vibrate) {
    try { navigator.vibrate(delta > 0 ? 25 : [15, 10, 15]); } catch (e) {}
  }

  const payload = {
    playerId: activePlayerId,
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

/* ==========================================================================
   RENDU VISUEL
   ========================================================================== */
function renderAll() {
  renderScoreboard();
  renderPlayerChips();
  renderPlayerSummary();
  renderActionsGrid();
  renderUndoButton();
  renderTeamTable();
  renderTeamKPIs();
  renderLiveFeed();
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

function renderPlayerChips() {
  const track = document.getElementById("player-carousel-track");
  if (!track) return;

  const players = matchState.players || [];
  track.innerHTML = "";

  if (players.length === 0) return;

  if (!players.some(p => p.id === activePlayerId)) {
    activePlayerId = players[0].id;
  }

  players.forEach(p => {
    const chip = document.createElement("div");
    chip.className = `player-chip ${p.id === activePlayerId ? "active" : ""}`;
    chip.onclick = () => {
      activePlayerId = p.id;
      renderAll();
    };

    chip.innerHTML = `
      <span class="chip-num">#${p.number || "-"}</span>
      <span class="chip-name">${p.name}</span>
    `;

    track.appendChild(chip);
  });
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

function renderPlayerSummary() {
  const player = (matchState.players || []).find(p => p.id === activePlayerId);
  if (!player) return;

  const avatar = document.getElementById("current-player-avatar");
  const nameEl = document.getElementById("current-player-name");
  const posEl = document.getElementById("tracker-position-badge");

  if (avatar) avatar.textContent = player.number || player.name.charAt(0);
  if (nameEl) nameEl.textContent = player.name;
  if (posEl) posEl.textContent = player.position || "Joueuse";

  const stats = getPlayerStats(player, activeHalf);

  const tMade = stats.tackles_made || 0;
  const tMiss = stats.tackles_missed || 0;
  const tTot = tMade + tMiss;
  const tRate = tTot > 0 ? Math.round((tMade / tTot) * 100) : 0;
  const tackEl = document.getElementById("kpi-tackles-rate");
  if (tackEl) {
    tackEl.innerHTML = `Plaquages: <strong>${tTot > 0 ? tRate + "%" : "-"}</strong> (${tMade}/${tTot})`;
  }

  const lMade = stats.lineout_throws_made || 0;
  const lMiss = stats.lineout_throws_lost || 0;
  const lTot = lMade + lMiss;
  const lRate = lTot > 0 ? Math.round((lMade / lTot) * 100) : 0;
  const throwEl = document.getElementById("kpi-throws-rate");
  if (throwEl) {
    throwEl.innerHTML = lTot > 0 ? `Touches: <strong>${lRate}%</strong> (${lMade}/${lTot})` : `Touches: -`;
  }

  const off = stats.offensive_actions || 0;
  const lost = stats.turnovers_lost || 0;
  const ratio = off - lost;
  const ratioEl = document.getElementById("kpi-attack-ratio");
  if (ratioEl) {
    const sign = ratio > 0 ? `+${ratio}` : `${ratio}`;
    ratioEl.innerHTML = `Bilan: <strong>${sign}</strong>`;
  }
}

function renderActionsGrid() {
  const grid = document.getElementById("stats-buttons-grid");
  if (!grid) return;

  const player = (matchState.players || []).find(p => p.id === activePlayerId);
  const stats = getPlayerStats(player, activeHalf);
  const isTotal = activeHalf === "total";

  grid.innerHTML = "";

  const filteredActions = ACTIONS.filter(a => {
    if (activePhaseFilter === "all") return true;
    return a.group === activePhaseFilter;
  });

  filteredActions.forEach(action => {
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

    grid.appendChild(card);
  });
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
   VUE ÉQUIPE STAFF
   ========================================================================== */
function renderTeamKPIs() {
  const players = matchState.players || [];
  let topTackler = { name: "-", count: 0 };
  let topScorer = { name: "-", count: 0 };
  let totalTMade = 0, totalTMiss = 0, totalLMade = 0, totalLMiss = 0;

  players.forEach(p => {
    const s = getPlayerStats(p, activeHalf);
    const tMade = s.tackles_made || 0;
    const tMiss = s.tackles_missed || 0;
    const tries = s.tries || 0;

    totalTMade += tMade;
    totalTMiss += tMiss;
    totalLMade += s.lineout_throws_made || 0;
    totalLMiss += s.lineout_throws_lost || 0;

    if (tMade > topTackler.count) topTackler = { name: `${p.name} (#${p.number})`, count: tMade };
    if (tries > topScorer.count) topScorer = { name: `${p.name} (#${p.number})`, count: tries };
  });

  const topTacklerEl = document.getElementById("summary-top-tackler");
  const topScorerEl = document.getElementById("summary-top-scorer");
  const teamTackEl = document.getElementById("summary-team-tackles-rate");
  const teamLineEl = document.getElementById("summary-team-lineout-rate");

  if (topTacklerEl) topTacklerEl.textContent = topTackler.count > 0 ? `${topTackler.name} (${topTackler.count})` : "-";
  if (topScorerEl) topScorerEl.textContent = topScorer.count > 0 ? `${topScorer.name} (${topScorer.count})` : "-";

  const tTot = totalTMade + totalTMiss;
  if (teamTackEl) teamTackEl.textContent = tTot > 0 ? Math.round((totalTMade / tTot) * 100) + "%" : "0%";

  const lTot = totalLMade + totalLMiss;
  if (teamLineEl) teamLineEl.textContent = lTot > 0 ? Math.round((totalLMade / lTot) * 100) + "%" : "0%";
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
  const player = (matchState.players || []).find(p => p.id === activePlayerId);
  const title = document.getElementById("card-picker-player-name");
  if (title && player) title.textContent = `#${player.number} ${player.name} (${player.position})`;
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
  // Undo buttons
  document.getElementById("btn-undo-action")?.addEventListener("click", sendUndoAction);
  document.getElementById("btn-toast-undo")?.addEventListener("click", sendUndoAction);

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

// Global exposure
window.switchTab = switchTab;
window.sendStatAction = sendStatAction;
window.addPointsToTeam = addPointsToTeam;
window.openCardPicker = openCardPicker;
window.submitCardAction = submitCardAction;
