// =====================================================
// WINTER FILM CLUB — FULLER SYNOPSES
// Uses the full TMDB overview, with a sensible visual clamp
// only on compact list cards.
// =====================================================

(() => {
  if (window.__WFC_FULLER_SYNOPSIS_LOADED__) return;
  window.__WFC_FULLER_SYNOPSIS_LOADED__ = true;

  const tidy = value => String(value || "").replace(/\s+/g, " ").trim();

  function textWithoutRatingBadge(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll?.(".uk-cert-badge").forEach(badge => badge.remove());
    return tidy(clone.textContent);
  }

  function knownMovies() {
    const movies = [];

    Object.values(state?.nominations || {})
      .flat()
      .map(normalizeMovie)
      .filter(Boolean)
      .forEach(movie => movies.push(movie));

    (state?.wildcards || [])
      .map(wildcardMovie)
      .filter(Boolean)
      .forEach(movie => movies.push(movie));

    (state?.finalMovies || [])
      .map(normalizeMovie)
      .filter(Boolean)
      .forEach(movie => movies.push(movie));

    if (typeof pendingWildcardMovie !== "undefined" && pendingWildcardMovie) {
      const movie = normalizeMovie(pendingWildcardMovie);
      if (movie) movies.push(movie);
    }

    return movies;
  }

  function findMovie(title) {
    const wanted = tidy(title).toLowerCase();
    if (!wanted) return null;

    return knownMovies().find(movie =>
      tidy(movie?.title).toLowerCase() === wanted
    ) || null;
  }

  function replaceSynopsis(container, movie) {
    if (!container || !movie?.overview) return;

    const text = tidy(movie.overview);
    const p = container.querySelector("p");

    if (p && p.textContent !== text) {
      p.textContent = text;
    }
  }

  function updateAll() {
    // Guaranteed picks — both the editable card and compact read-only summaries.
    document.querySelectorAll("#nominationGrid .person-card").forEach(card => {
      const person = tidy(card.querySelector(".person-title h3")?.textContent);
      const saved = state?.nominations?.[person] || [];

      card.querySelectorAll(".pick-block").forEach((block, index) => {
        const title = textWithoutRatingBadge(block.querySelector(".chosen-title"));
        const movie = normalizeMovie(saved[index]) || findMovie(title);
        replaceSynopsis(block.querySelector(".selection-synopsis"), movie);
      });

      card.querySelectorAll(".other-pick-row").forEach(row => {
        const title = textWithoutRatingBadge(row.querySelector(".other-pick-copy strong"));
        const movie = saved.map(normalizeMovie).find(item =>
          item && tidy(item.title).toLowerCase() === title.toLowerCase()
        ) || findMovie(title);
        replaceSynopsis(row.querySelector(".other-pick-synopsis"), movie);
      });
    });

    // Wildcard currently being selected.
    const wildcardPicker = document.getElementById("wildcardPicker");
    if (wildcardPicker) {
      const title = textWithoutRatingBadge(wildcardPicker.querySelector(".chosen-title"));
      let movie = null;
      if (typeof pendingWildcardMovie !== "undefined" && pendingWildcardMovie) {
        movie = normalizeMovie(pendingWildcardMovie);
      }
      movie = movie || findMovie(title);
      replaceSynopsis(wildcardPicker.querySelector(".wildcard-selection-synopsis"), movie);
    }

    // Added wildcard cards.
    document.querySelectorAll("#wildcardList .wildcard-chip").forEach(chip => {
      const title = textWithoutRatingBadge(chip.querySelector(".wildcard-copy strong"));
      const movie = (state?.wildcards || [])
        .map(wildcardMovie)
        .find(item => item && tidy(item.title).toLowerCase() === title.toLowerCase())
        || findMovie(title);
      replaceSynopsis(chip.querySelector(".wildcard-chip-synopsis"), movie);
    });

    // Bidding cards.
    document.querySelectorAll("#biddingGrid .bid-card").forEach(card => {
      const title = textWithoutRatingBadge(card.querySelector(".bid-copy h3"));
      const movie = (state?.wildcards || [])
        .map(wildcardMovie)
        .find(item => item && tidy(item.title).toLowerCase() === title.toLowerCase())
        || findMovie(title);
      replaceSynopsis(card.querySelector(".bid-synopsis"), movie);
    });

    // Final Ten — show the full overview with no line clamp.
    document.querySelectorAll("#movieGrid .movie-card").forEach((card, index) => {
      const movie = state?.finalMovies?.[index];
      replaceSynopsis(card.querySelector(".movie-synopsis"), movie);
    });
  }

  let queued = false;
  function queueUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      updateAll();
    });
  }

  ["nominationGrid", "wildcardPicker", "wildcardList", "biddingGrid", "movieGrid"]
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .forEach(node => {
      new MutationObserver(queueUpdate).observe(node, {
        childList: true,
        subtree: true
      });
    });

  const style = document.createElement("style");
  style.textContent = `
    .wildcard-chip-synopsis p,
    .other-pick-synopsis p,
    .bid-synopsis p {
      -webkit-line-clamp: 6 !important;
    }

    .movie-synopsis p,
    .selection-synopsis p,
    .wildcard-selection-synopsis p {
      -webkit-line-clamp: unset !important;
      overflow: visible !important;
    }
  `;
  document.head.appendChild(style);

  queueUpdate();
})();