// =====================================================
// WINTER FILM CLUB — GUIDED WATCH FLOW
// One current film at a time, UK-release-aware randomiser,
// discussion prompt, opinion badges and WhatsApp sharing.
// =====================================================

(() => {
  if (window.__WFC_GUIDED_WATCH_FLOW_LOADED__) return;
  window.__WFC_GUIDED_WATCH_FLOW_LOADED__ = true;

  const byId = id => document.getElementById(id);
  let syncing = false;
  let syncQueued = false;

  function allWatched(movie) {
    return PEOPLE.every(person => !!movie.watched?.[person]);
  }

  function reviewComplete(movie) {
    return PEOPLE.every(person => {
      const score = Number(movie.ratings?.[person] || 0);
      const review = String(movie.reviews?.[person] || "").trim();
      return score > 0 && review.length > 0;
    });
  }

  function allRated(movie) {
    return PEOPLE.every(person => Number(movie.ratings?.[person] || 0) > 0);
  }

  function todayIsoLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatUkDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  function isReleasedInUk(movie) {
    const date = String(movie.ukReleaseDate || "").trim();

    if (date) {
      return date <= todayIsoLocal();
    }

    // If a future-year film could not be matched to a GB search result,
    // do not risk drawing it early. Older/current-year films remain eligible.
    const year = Number(movie.year || 0);
    return !year || year <= new Date().getFullYear();
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function chooseRandomLookingMovie(candidates) {
    if (!candidates.length) return null;

    // The movie IDs are random when the final ten is built. Using them as
    // the seed makes every connected browser reach the same "random" choice,
    // avoiding two people picking different next films at the same moment.
    const completed = (state.finalMovies || [])
      .filter(reviewComplete)
      .map(movie => movie.id)
      .sort()
      .join("|");

    const seed = `${(state.finalMovies || []).map(movie => movie.id).join("|")}::${completed}`;
    return candidates[hashString(seed) % candidates.length];
  }

  async function backfillUkReleaseDates() {
    let changed = false;

    for (const movie of state.finalMovies || []) {
      if (movie.ukReleaseDateChecked) continue;

      try {
        const results = await searchMovies(movie.title);
        const exactId = results.find(result =>
          movie.tmdbId && String(result.id) === String(movie.tmdbId)
        );

        const sameTitleYear = results.find(result => {
          const titleMatches = String(result.title || result.original_title || "")
            .trim()
            .toLowerCase() === String(movie.title || "").trim().toLowerCase();

          const resultYear = String(result.release_date || "").slice(0, 4);
          return titleMatches && (!movie.year || !resultYear || String(movie.year) === resultYear);
        });

        const match = exactId || sameTitleYear || null;
        movie.ukReleaseDate = match?.release_date || "";
        movie.ukReleaseDateChecked = true;
        changed = true;
      } catch (error) {
        console.warn(`Could not check UK release date for ${movie.title}:`, error);
        // Leave unchecked so a later page load can try again.
      }
    }

    return changed;
  }

  async function syncCurrentMovie() {
    if (syncing) return;
    if (state.phase !== "watching" || (state.finalMovies || []).length !== 10) return;

    syncing = true;
    let changed = false;

    try {
      if (await backfillUkReleaseDates()) changed = true;

      let current = (state.finalMovies || []).find(movie => movie.id === state.currentMovieId) || null;

      if (current && reviewComplete(current)) {
        state.lastCompletedMovieId = current.id;
        state.currentMovieId = null;
        current = null;
        changed = true;
      }

      if (current && !isReleasedInUk(current) && !allWatched(current)) {
        state.currentMovieId = null;
        current = null;
        changed = true;
      }

      if (!current) {
        const unfinished = (state.finalMovies || []).filter(movie => !reviewComplete(movie));
        const eligible = unfinished.filter(isReleasedInUk);
        const next = chooseRandomLookingMovie(eligible);

        if (next) {
          state.currentMovieId = next.id;
          state.currentMovieChosenAt = new Date().toISOString();
          changed = true;
        }
      }

      if (changed) {
        const saved = await saveState();
        if (saved === false) return;
        renderMovies();
        renderRanking();
      }
    } finally {
      syncing = false;
    }
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;

    setTimeout(() => {
      syncQueued = false;
      syncCurrentMovie();
    }, 0);
  }

  function opinionBadge(movie) {
    if (!allRated(movie)) return null;

    const ratings = PEOPLE.map(person => Number(movie.ratings?.[person] || 0));
    const spread = Math.max(...ratings) - Math.min(...ratings);

    if (spread <= 1) {
      return { label: "Rare agreement", className: "agreement" };
    }

    if (spread >= 4) {
      return { label: "Divided the room", className: "divided" };
    }

    return null;
  }

  function shortShareSynopsis(movie) {
    const text = String(movie.overview || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    return sentences.slice(0, 1).join(" ").trim();
  }

  function shareToWhatsApp(movie) {
    const title = `${movie.title}${movie.year ? ` (${movie.year})` : ""}`;
    const synopsis = shortShareSynopsis(movie);

    const lines = [
      "🎬 Winter Film Club",
      "",
      `Next one to watch: ${title}`
    ];

    if (synopsis) {
      lines.push("", synopsis);
    }

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addBadge(card, movie) {
    card.querySelectorAll(".opinion-badge, .release-badge").forEach(node => node.remove());

    const meta = card.querySelector(".movie-meta");
    if (!meta) return;

    const opinion = opinionBadge(movie);
    if (opinion) {
      const badge = document.createElement("span");
      badge.className = `opinion-badge ${opinion.className}`;
      badge.textContent = opinion.label;
      meta.appendChild(badge);
    }

    if (movie.ukReleaseDate && !isReleasedInUk(movie)) {
      const release = document.createElement("span");
      release.className = "release-badge";
      release.textContent = `UK cinema ${formatUkDate(movie.ukReleaseDate)}`;
      meta.appendChild(release);
    }
  }

  function addCurrentBanner(card, movie) {
    const body = card.querySelector(".movie-body");
    if (!body) return;

    const banner = document.createElement("div");
    banner.className = "next-film-banner";

    const copy = document.createElement("div");
    copy.className = "next-film-banner-copy";
    copy.innerHTML = `
      <span>Next one to watch</span>
      <strong>${escapeHtml(movie.title)}</strong>
      <small>Chosen from the films currently eligible for a UK cinema release.</small>
    `;

    const share = document.createElement("button");
    share.type = "button";
    share.className = "whatsapp-share-btn";
    share.textContent = "Share to WhatsApp";
    share.addEventListener("click", () => shareToWhatsApp(movie));

    banner.append(copy, share);
    body.insertBefore(banner, body.firstChild);
  }

  function addDiscussionPrompt(card) {
    const panel = card.querySelector(".review-panel");
    if (!panel) return;

    const callout = document.createElement("div");
    callout.className = "discussion-callout";
    callout.innerHTML = `
      <strong>Everyone’s watched it — time to get together and discuss it.</strong>
      <span>Have the conversation first, then add your score and quick review. The next film will only be chosen when all four reviews are in.</span>
    `;

    panel.insertAdjacentElement("beforebegin", callout);

    const note = document.createElement("p");
    note.className = "review-completion-note";
    note.textContent = "A score and a written quick review from all four people are needed before the randomiser moves on.";
    panel.appendChild(note);
  }

  function decorateMovieCards() {
    const grid = byId("movieGrid");
    const section = byId("watchingSection");
    if (!grid || !section) return;

    const heading = section.querySelector(".section-heading h2");
    if (heading) heading.textContent = "Next one to watch";

    const note = section.querySelector(".section-note.wide");
    if (note) {
      note.textContent = "The club watches one film at a time. When all four have watched it, get together and discuss it; after all four scores and quick reviews are saved, the next eligible film is chosen automatically.";
    }

    grid.querySelectorAll(":scope > .next-film-waiting").forEach(node => node.remove());

    const movies = state.finalMovies || [];
    const cards = [...grid.querySelectorAll(":scope > .movie-card")];
    const current = movies.find(movie => movie.id === state.currentMovieId) || null;

    if (!current && movies.length === 10) {
      const unfinished = movies.filter(movie => !reviewComplete(movie));
      const panel = document.createElement("div");
      panel.className = "next-film-waiting";

      if (!unfinished.length) {
        panel.innerHTML = `
          <span>Winter Film Club</span>
          <strong>All ten complete</strong>
          <small>The final table is ready below.</small>
        `;
      } else {
        panel.innerHTML = `
          <span>Next one to watch</span>
          <strong>Waiting for an eligible film</strong>
          <small>The remaining films have not yet reached their UK cinema release date. The randomiser will choose one automatically when an eligible film is available.</small>
        `;
      }

      grid.prepend(panel);
    }

    cards.forEach((card, index) => {
      const movie = movies[index];
      if (!movie) return;

      card.classList.remove("next-film-card", "waiting-film-card", "completed-film-card");
      card.style.order = "";
      card.querySelectorAll(".next-film-banner, .discussion-callout, .review-completion-note, .later-film-label").forEach(node => node.remove());

      addBadge(card, movie);

      const watchedButton = card.querySelector(".watched-toggle");
      const reviewPanel = card.querySelector(".review-panel");
      const reviewLock = card.querySelector(".review-lock");

      if (current && movie.id === current.id) {
        card.classList.add("next-film-card");
        card.style.order = "-1";
        addCurrentBanner(card, movie);

        if (watchedButton) watchedButton.disabled = false;

        if (allWatched(movie) && !reviewComplete(movie)) {
          addDiscussionPrompt(card);
        }

        return;
      }

      if (reviewComplete(movie)) {
        card.classList.add("completed-film-card");
        if (watchedButton) watchedButton.disabled = true;

        const body = card.querySelector(".movie-body");
        if (body) {
          const label = document.createElement("span");
          label.className = "later-film-label";
          label.textContent = "Completed";
          body.insertBefore(label, body.firstChild);
        }
        return;
      }

      card.classList.add("waiting-film-card");
      if (watchedButton) {
        watchedButton.disabled = true;
        watchedButton.textContent = "Waiting its turn";
      }

      if (reviewPanel) reviewPanel.classList.add("hidden");
      if (reviewLock) {
        reviewLock.classList.remove("hidden");
        const strong = reviewLock.querySelector("strong");
        const span = reviewLock.querySelector("span");
        if (strong) strong.textContent = "Waiting its turn";
        if (span) {
          span.textContent = movie.ukReleaseDate && !isReleasedInUk(movie)
            ? `UK cinema release: ${formatUkDate(movie.ukReleaseDate)}.`
            : "This film opens when the randomiser selects it.";
        }
      }

      const body = card.querySelector(".movie-body");
      if (body) {
        const label = document.createElement("span");
        label.className = "later-film-label";
        label.textContent = movie.ukReleaseDate && !isReleasedInUk(movie)
          ? `Not in the draw yet · UK release ${formatUkDate(movie.ukReleaseDate)}`
          : "Later in the Winter Ten";
        body.insertBefore(label, body.firstChild);
      }
    });

    updateReviewProgress();
  }

  function decorateRanking() {
    const rows = [...document.querySelectorAll("#rankingTable .ranking-row")];

    rows.forEach(row => {
      row.querySelector(".rank-opinion-badge")?.remove();
      const title = row.querySelector(".rank-title strong")?.textContent?.trim() || "";
      const movie = (state.finalMovies || []).find(item => item.title === title);
      if (!movie) return;

      const opinion = opinionBadge(movie);
      if (!opinion) return;

      const host = row.querySelector(".rank-title");
      if (!host) return;

      const badge = document.createElement("span");
      badge.className = `rank-opinion-badge ${opinion.className}`;
      badge.textContent = opinion.label;
      host.appendChild(badge);
    });
  }

  function updateReviewProgress() {
    const panel = document.querySelector(".club-progress-overview");
    if (!panel) return;

    const item = [...panel.querySelectorAll(".club-progress-item")]
      .find(node => node.querySelector("span")?.textContent?.trim() === "Reviews");

    if (!item) return;

    const count = (state.finalMovies || []).filter(reviewComplete).length;
    const value = item.querySelector("strong");
    if (value) value.textContent = `${count}/10 done`;
    item.classList.toggle("complete", count === 10);
  }

  const baseRenderMovies = renderMovies;
  renderMovies = function () {
    baseRenderMovies();
    decorateMovieCards();
    queueSync();
  };

  const baseRenderRanking = renderRanking;
  renderRanking = function () {
    baseRenderRanking();
    decorateRanking();
    updateReviewProgress();
  };

  // The current film can be absent on the first render immediately after
  // the final ten is locked, so initialise the guided flow here too.
  queueSync();
})();
