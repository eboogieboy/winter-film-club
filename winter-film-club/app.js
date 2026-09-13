const PEOPLE = ["Steph", "Elliot", "Dan", "Wendy"];
const TOKENS_PER_PERSON = 5;
const STORAGE_KEY = "winter-film-club-v1";

const defaultState = () => ({
  phase: "nominations",
  activePerson: "Dan",
  nominations: Object.fromEntries(PEOPLE.map(p => [p, ["", ""]])),
  wildcards: [],
  finalMovies: []
});

let state = loadState();

const el = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState(), ...saved } : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setPhase(phase) {
  state.phase = phase;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupPeople() {
  const select = el("activePerson");
  select.innerHTML = PEOPLE.map(p => `<option value="${p}">${p}</option>`).join("");
  select.value = state.activePerson;
  select.addEventListener("change", e => {
    state.activePerson = e.target.value;
    saveState();
    render();
  });
}

function renderPhases() {
  const ordering = ["nominations", "bidding", "watching", "reviewing"];
  const currentIndex = state.phase === "watching" ? 2 : ordering.indexOf(state.phase);

  document.querySelectorAll(".phase").forEach((node, index) => {
    node.classList.toggle("active", index === currentIndex || (state.phase === "watching" && index === 3 && state.finalMovies.some(isUnlocked)));
    node.classList.toggle("complete", index < currentIndex);
  });
}

function renderVisibility() {
  el("nominationsSection").classList.toggle("hidden", state.phase !== "nominations");
  el("biddingSection").classList.toggle("hidden", state.phase !== "bidding");
  const watching = state.phase === "watching";
  el("watchingSection").classList.toggle("hidden", !watching);
  el("finalTableSection").classList.toggle("hidden", !watching);
}

function renderNominations() {
  const grid = el("nominationGrid");
  grid.innerHTML = "";
  const template = el("nominationCardTemplate");

  PEOPLE.forEach(person => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector("h3").textContent = person;

    const [pick1, pick2] = state.nominations[person] || ["", ""];
    const input1 = card.querySelector(".pick-one");
    const input2 = card.querySelector(".pick-two");
    input1.value = pick1;
    input2.value = pick2;

    if (person !== state.activePerson) {
      input1.disabled = true;
      input2.disabled = true;
      card.querySelector(".save-picks").disabled = true;
    }

    card.querySelector(".save-picks").addEventListener("click", () => {
      state.nominations[person] = [input1.value.trim(), input2.value.trim()];
      saveState();
      renderNominations();
    });

    grid.appendChild(card);
  });

  renderWildcards();

  const picksComplete = PEOPLE.every(p => state.nominations[p].filter(Boolean).length === 2);
  const enoughWildcards = state.wildcards.length >= 2;
  el("startBiddingBtn").disabled = !(picksComplete && enoughWildcards);

  let hint = "";
  if (!picksComplete) hint = "All four people need to save two picks.";
  else if (!enoughWildcards) hint = "Add at least two wildcard films.";
  else hint = "Ready: 8 guaranteed picks + wildcard bidding.";
  el("startBiddingHint").textContent = hint;
}

function renderWildcards() {
  const list = el("wildcardList");
  list.innerHTML = "";
  list.classList.toggle("empty-state", state.wildcards.length === 0);

  state.wildcards.forEach(w => {
    const chip = document.createElement("div");
    chip.className = "wildcard-chip";
    chip.innerHTML = `<strong>${escapeHtml(w.title)}</strong><small>${escapeHtml(w.proposer)}</small>`;

    if (w.proposer === state.activePerson) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${w.title}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        state.wildcards = state.wildcards.filter(x => x.id !== w.id);
        saveState();
        renderNominations();
      });
      chip.appendChild(remove);
    }

    list.appendChild(chip);
  });
}

function addWildcard(title) {
  const clean = title.trim();
  if (!clean) return;

  const duplicate = [
    ...state.wildcards.map(w => w.title),
    ...Object.values(state.nominations).flat()
  ].some(t => t && t.toLowerCase() === clean.toLowerCase());

  if (duplicate) {
    alert("That film is already on the board.");
    return;
  }

  state.wildcards.push({
    id: uid(),
    title: clean,
    proposer: state.activePerson,
    bids: Object.fromEntries(PEOPLE.map(p => [p, 0]))
  });
  saveState();
  renderNominations();
}

function bidsUsed(person) {
  return state.wildcards.reduce((sum, w) => sum + Number(w.bids?.[person] || 0), 0);
}

function wildcardTotal(wildcard) {
  return PEOPLE.reduce((sum, p) => sum + Number(wildcard.bids?.[p] || 0), 0);
}

function topWildcardIds() {
  return [...state.wildcards]
    .sort((a, b) => wildcardTotal(b) - wildcardTotal(a) || a.title.localeCompare(b.title))
    .slice(0, 2)
    .map(w => w.id);
}

function renderBidding() {
  el("bidPersonName").textContent = state.activePerson;
  const remaining = TOKENS_PER_PERSON - bidsUsed(state.activePerson);
  el("tokensRemaining").textContent = remaining;

  const topIds = topWildcardIds();
  const grid = el("biddingGrid");
  grid.innerHTML = "";

  [...state.wildcards]
    .sort((a,b) => wildcardTotal(b) - wildcardTotal(a))
    .forEach(w => {
      const card = document.createElement("article");
      card.className = "bid-card" + (topIds.includes(w.id) ? " top-two" : "");

      const mine = Number(w.bids?.[state.activePerson] || 0);
      const total = wildcardTotal(w);

      card.innerHTML = `
        <div>
          <h3>${escapeHtml(w.title)}</h3>
          <p>Suggested by ${escapeHtml(w.proposer)} · ${total} total token${total === 1 ? "" : "s"}</p>
        </div>
        <div class="bid-controls">
          <button class="minus" type="button" aria-label="Remove token">−</button>
          <strong>${mine}</strong>
          <button class="plus" type="button" aria-label="Add token">+</button>
        </div>
      `;

      card.querySelector(".minus").disabled = mine <= 0;
      card.querySelector(".plus").disabled = remaining <= 0;

      card.querySelector(".minus").addEventListener("click", () => {
        w.bids[state.activePerson] = Math.max(0, mine - 1);
        saveState();
        renderBidding();
      });

      card.querySelector(".plus").addEventListener("click", () => {
        if (bidsUsed(state.activePerson) >= TOKENS_PER_PERSON) return;
        w.bids[state.activePerson] = mine + 1;
        saveState();
        renderBidding();
      });

      grid.appendChild(card);
    });

  const allSpent = PEOPLE.every(p => bidsUsed(p) === TOKENS_PER_PERSON);
  el("lockFinalBtn").disabled = !(allSpent && state.wildcards.length >= 2);
  el("lockFinalBtn").textContent = allSpent ? "Lock the final 10" : "Waiting for everyone to bid";
}

function buildFinalMovies() {
  const guaranteed = [];
  PEOPLE.forEach(person => {
    (state.nominations[person] || []).forEach((title, i) => {
      guaranteed.push(makeMovie(title, "guaranteed", `${person}'s pick ${i + 1}`, person));
    });
  });

  const winningWildcards = [...state.wildcards]
    .sort((a,b) => wildcardTotal(b) - wildcardTotal(a) || a.title.localeCompare(b.title))
    .slice(0, 2)
    .map(w => makeMovie(w.title, "wildcard", `Wildcard · ${wildcardTotal(w)} tokens`, w.proposer));

  state.finalMovies = [...guaranteed, ...winningWildcards];
  saveState();
}

function makeMovie(title, source, note, picker) {
  return {
    id: uid(),
    title,
    source,
    note,
    picker,
    watched: Object.fromEntries(PEOPLE.map(p => [p, false])),
    ratings: Object.fromEntries(PEOPLE.map(p => [p, ""])),
    reviews: Object.fromEntries(PEOPLE.map(p => [p, ""]))
  };
}

function isUnlocked(movie) {
  return PEOPLE.every(p => movie.watched?.[p]);
}

function renderMovies() {
  const grid = el("movieGrid");
  grid.innerHTML = "";
  const template = el("movieCardTemplate");

  state.finalMovies.forEach((movie, index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".movie-number").textContent = String(index + 1).padStart(2, "0");
    card.querySelector(".movie-title").textContent = movie.title;
    card.querySelector(".source-pill").textContent = movie.source === "wildcard" ? "Wildcard winner" : "Guaranteed pick";
    card.querySelector(".picked-by").textContent = movie.note;

    const watchedTotal = PEOPLE.filter(p => movie.watched?.[p]).length;
    card.querySelector(".watched-count").textContent = `${watchedTotal}/4 watched`;

    const watchers = card.querySelector(".watchers");
    PEOPLE.forEach(person => {
      const pill = document.createElement("span");
      pill.className = "watcher" + (movie.watched?.[person] ? " done" : "");
      pill.textContent = person;
      watchers.appendChild(pill);
    });

    const watchedButton = card.querySelector(".watched-toggle");
    const alreadyWatched = !!movie.watched?.[state.activePerson];
    watchedButton.textContent = alreadyWatched ? `✓ ${state.activePerson} watched it` : `${state.activePerson}: mark as watched`;
    watchedButton.addEventListener("click", () => {
      movie.watched[state.activePerson] = !alreadyWatched;
      saveState();
      renderMovies();
      renderRanking();
      renderPhases();
    });

    const unlocked = isUnlocked(movie);
    card.querySelector(".review-lock").classList.toggle("hidden", unlocked);
    const reviewPanel = card.querySelector(".review-panel");
    reviewPanel.classList.toggle("hidden", !unlocked);

    if (unlocked) {
      const score = card.querySelector(".score-select");
      const review = card.querySelector(".review-text");
      score.value = movie.ratings?.[state.activePerson] || "";
      review.value = movie.reviews?.[state.activePerson] || "";

      card.querySelector(".save-review").addEventListener("click", () => {
        movie.ratings[state.activePerson] = score.value;
        movie.reviews[state.activePerson] = review.value.trim();
        saveState();
        renderMovies();
        renderRanking();
      });

      const numericRatings = PEOPLE
        .map(p => Number(movie.ratings?.[p]))
        .filter(Boolean);
      const groupScore = card.querySelector(".group-score");
      if (numericRatings.length) {
        const avg = numericRatings.reduce((a,b) => a+b,0) / numericRatings.length;
        groupScore.textContent = `Group score: ${avg.toFixed(1)}/10 · ${numericRatings.length}/4 scored`;
      } else {
        groupScore.textContent = "No scores yet.";
      }

      const reviewList = card.querySelector(".review-list");
      reviewList.innerHTML = "";
      PEOPLE.forEach(person => {
        const r = movie.reviews?.[person];
        const s = movie.ratings?.[person];
        if (!r && !s) return;
        const entry = document.createElement("div");
        entry.className = "review-entry";
        entry.innerHTML = `<strong>${escapeHtml(person)}${s ? ` · ${escapeHtml(s)}/10` : ""}</strong>${r ? escapeHtml(r) : "No written review."}`;
        reviewList.appendChild(entry);
      });
    }

    grid.appendChild(card);
  });

  el("fullyWatchedCount").textContent = state.finalMovies.filter(isUnlocked).length;
}

function renderRanking() {
  const box = el("rankingTable");
  box.innerHTML = "";

  const sorted = [...state.finalMovies].sort((a,b) => {
    const avgA = averageRating(a);
    const avgB = averageRating(b);
    return avgB - avgA;
  });

  sorted.forEach((movie, i) => {
    const rated = PEOPLE.filter(p => Number(movie.ratings?.[p])).length;
    const avg = averageRating(movie);
    const watched = PEOPLE.filter(p => movie.watched?.[p]).length;

    const row = document.createElement("div");
    row.className = "ranking-row";
    row.innerHTML = `
      <div class="rank-number">${i + 1}</div>
      <div class="rank-title">
        <strong>${escapeHtml(movie.title)}</strong>
        <span>${escapeHtml(movie.note)}</span>
      </div>
      <div class="rank-status">${watched}/4 watched</div>
      <div class="rank-score">${rated ? `${avg.toFixed(1)}/10` : "—"}</div>
    `;
    box.appendChild(row);
  });
}

function averageRating(movie) {
  const ratings = PEOPLE.map(p => Number(movie.ratings?.[p])).filter(Boolean);
  if (!ratings.length) return 0;
  return ratings.reduce((a,b) => a+b,0) / ratings.length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderPhases();
  renderVisibility();

  if (state.phase === "nominations") renderNominations();
  if (state.phase === "bidding") renderBidding();
  if (state.phase === "watching") {
    renderMovies();
    renderRanking();
  }
}

el("wildcardForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = el("wildcardTitle");
  addWildcard(input.value);
  input.value = "";
  input.focus();
});

el("startBiddingBtn").addEventListener("click", () => setPhase("bidding"));
el("backToNominationsBtn").addEventListener("click", () => setPhase("nominations"));

el("lockFinalBtn").addEventListener("click", () => {
  if (!PEOPLE.every(p => bidsUsed(p) === TOKENS_PER_PERSON)) return;
  buildFinalMovies();
  setPhase("watching");
});

el("resetBtn").addEventListener("click", () => {
  const ok = confirm("Reset all picks, bids, watched status and reviews?");
  if (!ok) return;
  state = defaultState();
  saveState();
  setupPeople();
  render();
});

setupPeople();
render();
