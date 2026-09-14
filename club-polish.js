// =====================================================
// WINTER FILM CLUB — FINAL POLISH
// Secret wildcard voting, progress overview, collapsible
// mobile synopses and an end-of-season finale.
// =====================================================

(() => {
  if (window.__WFC_CLUB_POLISH_LOADED__) return;
  window.__WFC_CLUB_POLISH_LOADED__ = true;

  // Load the companion styles even if this script is added dynamically.
  if (!document.querySelector('link[data-wfc-polish="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "club-polish.css?v=20260914-1715";
    link.dataset.wfcPolish = "true";
    document.head.appendChild(link);
  }

  const byId = id => document.getElementById(id);

  // ---------------------------------------------------
  // OVERALL CLUB PROGRESS
  // ---------------------------------------------------

  function picksReadyCount() {
    return PEOPLE.filter(person => {
      const picks = state?.nominations?.[person] || [];
      return picks.map(normalizeMovie).filter(Boolean).length === 2;
    }).length;
  }

  function biddersFinishedCount() {
    return PEOPLE.filter(person => bidsUsed(person) === TOKENS_PER_PERSON).length;
  }

  function watchedCount() {
    return (state?.finalMovies || []).reduce((sum, movie) => {
      return sum + PEOPLE.filter(person => !!movie.watched?.[person]).length;
    }, 0);
  }

  function fullyRatedFilmsCount() {
    return (state?.finalMovies || []).filter(movie =>
      PEOPLE.every(person => Number(movie.ratings?.[person] || 0) > 0)
    ).length;
  }

  function renderClubProgress() {
    const strip = document.querySelector(".phase-strip");
    if (!strip) return;

    let panel = document.querySelector(".club-progress-overview");

    if (!panel) {
      panel = document.createElement("div");
      panel.className = "club-progress-overview";
      panel.setAttribute("aria-label", "Overall film club progress");
      strip.insertAdjacentElement("afterend", panel);
    }

    const picks = picksReadyCount();
    const bids = biddersFinishedCount();
    const watched = watchedCount();
    const reviews = fullyRatedFilmsCount();

    panel.innerHTML = `
      <div class="club-progress-item ${picks === 4 ? "complete" : ""}">
        <span>Picks</span>
        <strong>${picks}/4 ready</strong>
      </div>
      <div class="club-progress-item ${bids === 4 ? "complete" : ""}">
        <span>Bids</span>
        <strong>${bids}/4 done</strong>
      </div>
      <div class="club-progress-item ${watched === 40 ? "complete" : ""}">
        <span>Watched</span>
        <strong>${watched}/40</strong>
      </div>
      <div class="club-progress-item ${reviews === 10 ? "complete" : ""}">
        <span>Reviews</span>
        <strong>${reviews}/10 done</strong>
      </div>
    `;
  }

  // ---------------------------------------------------
  // SECRET WILDCARD BIDDING + REVEAL
  // ---------------------------------------------------

  function allBidsSpent() {
    return PEOPLE.every(person => bidsUsed(person) === TOKENS_PER_PERSON);
  }

  function sortedWinners() {
    return [...(state?.wildcards || [])]
      .sort((a, b) => {
        const aMovie = wildcardMovie(a);
        const bMovie = wildcardMovie(b);

        return (
          wildcardTotal(b) - wildcardTotal(a) ||
          String(aMovie?.title || "").localeCompare(String(bMovie?.title || ""))
        );
      })
      .slice(0, 2);
  }

  function cardTitle(card) {
    return card.querySelector(".bid-copy h3")?.textContent?.trim() || "";
  }

  function wildcardTitle(wildcard) {
    return wildcardMovie(wildcard)?.title?.trim() || "";
  }

  function putCardsBackInNeutralOrder(grid) {
    const cards = [...grid.querySelectorAll(":scope > .bid-card")];
    const used = new Set();

    (state?.wildcards || []).forEach(wildcard => {
      const wanted = wildcardTitle(wildcard).toLowerCase();
      const card = cards.find(item =>
        !used.has(item) && cardTitle(item).toLowerCase() === wanted
      );

      if (card) {
        used.add(card);
        grid.appendChild(card);
      }
    });
  }

  function renderBiddingStatus(grid, revealed) {
    const section = byId("biddingSection");
    if (!section) return;

    let status = section.querySelector(".secret-bid-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "secret-bid-status";
      grid.insertAdjacentElement("beforebegin", status);
    }

    const complete = biddersFinishedCount();
    const mineDone = bidsUsed(state.activePerson) === TOKENS_PER_PERSON;

    status.innerHTML = `
      <div>
        <strong>${revealed ? "Voting revealed" : "Votes stay secret"}</strong>
        <span>${revealed
          ? "The two winning wildcards are now visible."
          : `${complete} of 4 people have finished${mineDone ? " · your 5 tokens are in" : ""}.`
        }</span>
      </div>
      <div class="secret-bid-lock ${complete === 4 ? "ready" : ""}">
        ${revealed ? "Revealed" : complete === 4 ? "Ready to reveal" : "Totals hidden"}
      </div>
    `;
  }

  function renderRevealPanel(grid) {
    const existing = document.querySelector(".reveal-panel");

    if (!state.biddingRevealed) {
      existing?.remove();
      return;
    }

    const winners = sortedWinners();
    if (winners.length < 2) {
      existing?.remove();
      return;
    }

    let panel = existing;
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "reveal-panel";
      grid.insertAdjacentElement("afterend", panel);
    }

    panel.innerHTML = `
      <div class="reveal-panel-header">
        <span>The vote is in</span>
        <strong>Your two wildcard winners</strong>
        <small>These complete the Winter Ten.</small>
      </div>
      <div class="reveal-winners">
        ${winners.map((wildcard, index) => {
          const movie = wildcardMovie(wildcard);
          const poster = movie?.posterPath
            ? `<img src="${posterUrl(movie.posterPath, "w154")}" alt="" />`
            : `<span class="reveal-winner-placeholder">FILM</span>`;

          return `
            <div class="reveal-winner">
              ${poster}
              <div class="reveal-winner-copy">
                <span>${index === 0 ? "1st wildcard" : "2nd wildcard"}</span>
                <strong>${escapeHtml(movie?.title || "Untitled")}</strong>
                <small>${wildcardTotal(wildcard)} tokens · suggested by ${escapeHtml(wildcard.proposer || "")}</small>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  const baseRenderBidding = renderBidding;

  renderBidding = function () {
    baseRenderBidding();

    const grid = byId("biddingGrid");
    const button = byId("lockFinalBtn");
    if (!grid || !button) return;

    const revealed = !!state.biddingRevealed;
    const spent = allBidsSpent();

    grid.classList.toggle("secret-voting", !revealed);
    grid.classList.toggle("voting-revealed", revealed);

    if (!revealed) {
      // The underlying totals still exist in shared state, but the normal
      // club UI gives no clue about totals, ranking or the current top two.
      putCardsBackInNeutralOrder(grid);

      grid.querySelectorAll(".bid-card").forEach(card => {
        card.classList.remove("top-two");
        const total = card.querySelector(".bid-total");
        if (total) {
          total.classList.add("secret-total");
          total.textContent = "Total hidden until reveal";
        }
      });
    } else {
      grid.querySelectorAll(".bid-controls button").forEach(control => {
        control.disabled = true;
      });
    }

    renderBiddingStatus(grid, revealed);
    renderRevealPanel(grid);

    if (!spent) {
      button.disabled = true;
      button.textContent = "Waiting for everyone to bid";
    } else if (!revealed) {
      button.disabled = false;
      button.textContent = "Reveal the winners";
    } else {
      button.disabled = false;
      button.textContent = "Add winners to the Winter Ten";
    }

    renderClubProgress();
    queueSynopsisControls();
  };

  // First click reveals the result without moving to the next phase.
  // The existing app click handler is then allowed through on the second click.
  const lockButton = byId("lockFinalBtn");
  lockButton?.addEventListener("click", async event => {
    if (state.phase !== "bidding") return;
    if (!allBidsSpent() || state.biddingRevealed) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    state.biddingRevealed = true;
    const saved = await saveState();
    if (saved === false) return;

    renderBidding();

    requestAnimationFrame(() => {
      document.querySelector(".reveal-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  }, true);

  // Starting a fresh bidding round always hides the totals again.
  byId("startBiddingBtn")?.addEventListener("click", () => {
    state.biddingRevealed = false;
  }, true);

  // ---------------------------------------------------
  // COLLAPSIBLE MOBILE SYNOPSES
  // ---------------------------------------------------

  const synopsisSelector = [
    ".movie-synopsis",
    ".selection-synopsis",
    ".wildcard-selection-synopsis",
    ".other-pick-synopsis",
    ".wildcard-chip-synopsis",
    ".bid-synopsis"
  ].join(",");

  let synopsisQueued = false;

  function applySynopsisControls() {
    document.querySelectorAll(synopsisSelector).forEach(block => {
      const paragraph = block.querySelector(":scope > p");
      if (!paragraph) return;

      const isLong = paragraph.textContent.trim().length > 190;
      let toggle = block.querySelector(":scope > .synopsis-toggle");

      if (!isLong) {
        block.classList.remove("synopsis-collapsible", "is-expanded");
        toggle?.remove();
        return;
      }

      block.classList.add("synopsis-collapsible");

      if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "synopsis-toggle";
        toggle.textContent = "More";

        toggle.addEventListener("click", () => {
          const expanded = block.classList.toggle("is-expanded");
          toggle.textContent = expanded ? "Less" : "More";
        });

        block.appendChild(toggle);
      }
    });
  }

  function queueSynopsisControls() {
    if (synopsisQueued) return;
    synopsisQueued = true;

    requestAnimationFrame(() => {
      synopsisQueued = false;
      applySynopsisControls();
    });
  }

  const main = document.querySelector("main");
  if (main) {
    new MutationObserver(queueSynopsisControls).observe(main, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // ---------------------------------------------------
  // END-OF-SEASON FINALE
  // ---------------------------------------------------

  function movieAverage(movie) {
    const values = PEOPLE
      .map(person => Number(movie.ratings?.[person] || 0))
      .filter(value => value > 0);

    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function renderSeasonFinale() {
    const section = byId("finalTableSection");
    const table = byId("rankingTable");
    if (!section || !table) return;

    const movies = state?.finalMovies || [];
    const complete = movies.length === 10 && movies.every(movie =>
      PEOPLE.every(person => Number(movie.ratings?.[person] || 0) > 0)
    );

    const heading = section.querySelector(".section-heading h2");
    let finale = section.querySelector(".season-finale");

    if (!complete) {
      finale?.remove();
      if (heading) heading.textContent = "How the films are doing";
      return;
    }

    if (heading) heading.textContent = "The final table";

    const ranked = [...movies].sort((a, b) =>
      movieAverage(b) - movieAverage(a) ||
      String(a.title || "").localeCompare(String(b.title || ""))
    );

    const winner = ranked[0];
    const runnerUp = ranked[1];

    const individualScores = movies.flatMap(movie =>
      PEOPLE.map(person => ({
        movie,
        person,
        score: Number(movie.ratings?.[person] || 0)
      }))
    ).sort((a, b) => b.score - a.score);

    const highest = individualScores[0];

    const disagreement = [...movies]
      .map(movie => {
        const ratings = PEOPLE.map(person => Number(movie.ratings?.[person] || 0));
        return {
          movie,
          spread: Math.max(...ratings) - Math.min(...ratings)
        };
      })
      .sort((a, b) =>
        b.spread - a.spread ||
        String(a.movie.title || "").localeCompare(String(b.movie.title || ""))
      )[0];

    if (!finale) {
      finale = document.createElement("div");
      finale.className = "season-finale";
      table.insertAdjacentElement("beforebegin", finale);
    }

    finale.innerHTML = `
      <div class="season-finale-heading">
        <span>Winter Film Club complete</span>
        <strong>And the winner is…</strong>
        <small>All ten films have been scored by all four of you.</small>
      </div>

      <div class="finale-podium">
        <div class="finale-place winner">
          <span>Winner</span>
          <strong>${escapeHtml(winner.title)}</strong>
          <small>${movieAverage(winner).toFixed(1)}/10 group average</small>
        </div>
        <div class="finale-place">
          <span>Runner-up</span>
          <strong>${escapeHtml(runnerUp.title)}</strong>
          <small>${movieAverage(runnerUp).toFixed(1)}/10 group average</small>
        </div>
      </div>

      <div class="finale-stats">
        <div class="finale-stat">
          <span>Highest individual score</span>
          <strong>${highest.score}/10</strong>
          <small>${escapeHtml(highest.person)} on ${escapeHtml(highest.movie.title)}</small>
        </div>
        <div class="finale-stat">
          <span>Biggest disagreement</span>
          <strong>${escapeHtml(disagreement.movie.title)}</strong>
          <small>${disagreement.spread}-point spread between scores</small>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------
  // HOOK INTO THE EXISTING RENDERS
  // ---------------------------------------------------

  const baseRenderNominations = renderNominations;
  renderNominations = function () {
    baseRenderNominations();
    renderClubProgress();
    queueSynopsisControls();
  };

  const baseRenderMovies = renderMovies;
  renderMovies = function () {
    baseRenderMovies();
    renderClubProgress();
    queueSynopsisControls();
  };

  const baseRenderRanking = renderRanking;
  renderRanking = function () {
    baseRenderRanking();
    renderSeasonFinale();
    renderClubProgress();
  };

  // Realtime updates call render(), whose phase-specific calls now flow
  // through the wrappers above. This initial pass covers the current page.
  renderClubProgress();
  renderSeasonFinale();
  queueSynopsisControls();

  if (state.phase === "bidding") {
    renderBidding();
  }
})();
