// =====================================================
// WINTER FILM CLUB — SELECTION SYNOPSES
// Shows short TMDB descriptions while choosing guaranteed
// picks and wildcards, and on wildcard/bidding cards.
// =====================================================

(() => {
  if (window.__WFC_SELECTION_SYNOPSIS_LOADED__) {
    return;
  }

  window.__WFC_SELECTION_SYNOPSIS_LOADED__ = true;

  const nominationGrid = document.getElementById("nominationGrid");
  const wildcardPicker = document.getElementById("wildcardPicker");
  const wildcardList = document.getElementById("wildcardList");
  const biddingGrid = document.getElementById("biddingGrid");

  if (!nominationGrid || !wildcardPicker || !wildcardList || !biddingGrid) {
    return;
  }

  const recentMovies = new Map();

  function textWithoutRatingBadge(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll?.(".uk-cert-badge").forEach(badge => badge.remove());
    return String(clone.textContent || "").trim();
  }

  function movieKey(movie) {
    if (!movie) return "";
    if (movie.tmdbId) return `id:${movie.tmdbId}`;
    return `title:${String(movie.title || "").trim().toLowerCase()}`;
  }

  function rememberMovie(movie) {
    const key = movieKey(movie);
    if (key) recentMovies.set(key, movie);

    const title = String(movie?.title || "").trim().toLowerCase();
    if (title) recentMovies.set(`title:${title}`, movie);
  }

  // Keep freshly selected movies available before the user presses Save.
  if (typeof movieFromSearchResult === "function") {
    const baseMovieFromSearchResult = movieFromSearchResult;

    movieFromSearchResult = async function (result) {
      const movie = await baseMovieFromSearchResult(result);
      rememberMovie(movie);
      return movie;
    };
  }

  function shortSynopsis(value, limit = 420) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return "";

    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let summary = sentences.slice(0, 3).join(" ").trim();

    if (summary.length > limit) {
      summary = summary
        .slice(0, limit - 1)
        .replace(/\s+\S*$/, "")
        .trim() + "…";
    }

    return summary;
  }

  function allKnownMovies() {
    const known = [];

    Object.values(state?.nominations || {})
      .flat()
      .map(normalizeMovie)
      .filter(Boolean)
      .forEach(movie => known.push(movie));

    (state?.wildcards || [])
      .map(wildcardMovie)
      .filter(Boolean)
      .forEach(movie => known.push(movie));

    (state?.finalMovies || [])
      .map(normalizeMovie)
      .filter(Boolean)
      .forEach(movie => known.push(movie));

    if (typeof pendingWildcardMovie !== "undefined" && pendingWildcardMovie) {
      const pending = normalizeMovie(pendingWildcardMovie);
      if (pending) known.push(pending);
    }

    recentMovies.forEach(movie => known.push(movie));

    return known;
  }

  function findMovie(title, tmdbId = null) {
    const cleanTitle = String(title || "").trim().toLowerCase();

    if (tmdbId) {
      const remembered = recentMovies.get(`id:${tmdbId}`);
      if (remembered) return remembered;
    }

    if (cleanTitle) {
      const remembered = recentMovies.get(`title:${cleanTitle}`);
      if (remembered) return remembered;
    }

    return allKnownMovies().find(movie => {
      if (tmdbId && movie.tmdbId && String(movie.tmdbId) === String(tmdbId)) {
        return true;
      }

      return String(movie.title || "").trim().toLowerCase() === cleanTitle;
    }) || null;
  }

  function setSynopsis(container, movie, className = "selection-synopsis") {
    if (!container) return;

    const synopsis = shortSynopsis(movie?.overview);
    let block = container.querySelector(`:scope > .${className}`);

    if (!synopsis) {
      block?.remove();
      return;
    }

    // Avoid repeatedly rebuilding the same block. This also prevents
    // our MutationObservers from triggering themselves in a loop.
    if (block?.dataset.synopsis === synopsis) {
      return;
    }

    if (!block) {
      block = document.createElement("div");
      block.className = className;
      container.appendChild(block);
    }

    block.dataset.synopsis = synopsis;
    block.innerHTML = "";

    const label = document.createElement("span");
    label.className = "selection-synopsis-label";
    label.textContent = "Synopsis";

    const copy = document.createElement("p");
    copy.textContent = synopsis;

    block.append(label, copy);
  }

  function decorateNominationCards() {
    const cards = [...nominationGrid.querySelectorAll(":scope > .person-card")];

    cards.forEach(card => {
      const person = card.querySelector(".person-title h3")?.textContent?.trim() || "";
      const savedPicks = state?.nominations?.[person] || [];

      [...card.querySelectorAll(".pick-block")].forEach((block, index) => {
        const picker = block.querySelector(".movie-picker");
        const chosen = picker?.querySelector(".chosen-movie");
        const title = textWithoutRatingBadge(chosen?.querySelector(".chosen-title"));

        let movie = normalizeMovie(savedPicks[index]);

        if (!movie || (title && movie.title !== title)) {
          movie = findMovie(title);
        }

        setSynopsis(picker, movie);
      });

      // The compact read-only summaries for everybody else's picks.
      const summaryRows = [...card.querySelectorAll(".other-pick-row")];
      summaryRows.forEach(row => {
        const title = textWithoutRatingBadge(row.querySelector(".other-pick-copy strong"));
        const movie = savedPicks
          .map(normalizeMovie)
          .find(item => item && item.title === title) || findMovie(title);

        const copy = row.querySelector(".other-pick-copy");
        setSynopsis(copy, movie, "other-pick-synopsis");
      });
    });
  }

  function decorateWildcardPicker() {
    const chosen = wildcardPicker.querySelector(".chosen-movie");
    const title = textWithoutRatingBadge(chosen?.querySelector(".chosen-title"));

    let movie = null;

    if (typeof pendingWildcardMovie !== "undefined" && pendingWildcardMovie) {
      movie = normalizeMovie(pendingWildcardMovie);
    }

    if (!movie || (title && movie.title !== title)) {
      movie = findMovie(title);
    }

    setSynopsis(wildcardPicker, movie, "wildcard-selection-synopsis");
  }

  function decorateWildcardList() {
    const chips = [...wildcardList.querySelectorAll(":scope > .wildcard-chip")];

    chips.forEach(chip => {
      const title = textWithoutRatingBadge(chip.querySelector(".wildcard-copy strong"));
      const movie = (state?.wildcards || [])
        .map(wildcardMovie)
        .find(item => item && item.title === title) || findMovie(title);

      const copy = chip.querySelector(".wildcard-copy");
      setSynopsis(copy, movie, "wildcard-chip-synopsis");
    });
  }

  function decorateBiddingCards() {
    const cards = [...biddingGrid.querySelectorAll(":scope > .bid-card")];

    cards.forEach(card => {
      const title = textWithoutRatingBadge(card.querySelector(".bid-copy h3"));
      const movie = (state?.wildcards || [])
        .map(wildcardMovie)
        .find(item => item && item.title === title) || findMovie(title);

      const copy = card.querySelector(".bid-copy");
      setSynopsis(copy, movie, "bid-synopsis");
    });
  }

  let queued = false;

  function decorateAll() {
    decorateNominationCards();
    decorateWildcardPicker();
    decorateWildcardList();
    decorateBiddingCards();
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      decorateAll();
    });
  }

  [nominationGrid, wildcardPicker, wildcardList, biddingGrid].forEach(node => {
    new MutationObserver(queueDecorate).observe(node, {
      childList: true,
      subtree: true
    });
  });

  const style = document.createElement("style");
  style.textContent = `
    .selection-synopsis,
    .wildcard-selection-synopsis {
      margin-top: 8px;
      padding: 9px 10px;
      border-radius: 11px;
      background: #f7f4ed;
      color: #596474;
    }

    .selection-synopsis-label {
      display: block;
      margin-bottom: 3px;
      color: #8f4b32;
      font-size: .6rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .selection-synopsis p,
    .wildcard-selection-synopsis p,
    .other-pick-synopsis p,
    .wildcard-chip-synopsis p,
    .bid-synopsis p {
      margin: 0;
      color: #657180;
      font-size: .76rem;
      line-height: 1.42;
    }

    .other-pick-synopsis,
    .wildcard-chip-synopsis,
    .bid-synopsis {
      margin-top: 5px;
    }

    .other-pick-synopsis .selection-synopsis-label,
    .wildcard-chip-synopsis .selection-synopsis-label,
    .bid-synopsis .selection-synopsis-label {
      display: none;
    }

    .wildcard-chip {
      align-items: start;
    }

    .wildcard-chip-synopsis p,
    .other-pick-synopsis p {
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .bid-synopsis p {
      margin-top: 2px;
      display: -webkit-box;
      -webkit-line-clamp: 5;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    @media (max-width: 760px) {
      .selection-synopsis,
      .wildcard-selection-synopsis {
        padding: 8px 9px;
      }

      .selection-synopsis p,
      .wildcard-selection-synopsis p,
      .other-pick-synopsis p,
      .wildcard-chip-synopsis p,
      .bid-synopsis p {
        font-size: .72rem;
        line-height: 1.38;
      }
    }
  `;

  document.head.appendChild(style);
  queueDecorate();
})();