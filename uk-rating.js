// =====================================================
// WINTER FILM CLUB — UK AGE CLASSIFICATION BADGES
// Reads certification data from TMDB without changing club state.
// =====================================================

(() => {
  if (window.__WFC_UK_RATING_LOADED__) return;
  window.__WFC_UK_RATING_LOADED__ = true;

  const CACHE_MS = 30 * 24 * 60 * 60 * 1000;
  const memory = new Map();
  let queued = false;

  function cacheKey(movie) {
    return `wfc-uk-rating-v1:${movie.tmdbId || movie.id || movie.title || ""}`;
  }

  function readCache(movie) {
    const key = cacheKey(movie);
    if (memory.has(key)) return memory.get(key);

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_MS) return null;
      memory.set(key, parsed.value || "");
      return parsed.value || "";
    } catch {
      return null;
    }
  }

  function writeCache(movie, value) {
    const key = cacheKey(movie);
    memory.set(key, value || "");
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: value || "" }));
    } catch {}
  }

  function normalise(value) {
    const cert = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    const supported = new Set(["U", "PG", "12", "12A", "15", "18", "R18"]);
    return supported.has(cert) ? cert : "";
  }

  function releaseResults(data) {
    if (!data || typeof data !== "object") return [];

    const candidates = [
      data?.release_dates?.results,
      data?.releaseDates?.results,
      data?.results
    ];

    return candidates.find(Array.isArray) || [];
  }

  function pickUkCertification(data) {
    const gb = releaseResults(data).find(item => item?.iso_3166_1 === "GB");
    if (!gb || !Array.isArray(gb.release_dates)) return "";

    const priority = new Map([
      [3, 1], // Theatrical
      [2, 2], // Theatrical limited
      [4, 3], // Digital
      [5, 4], // Physical
      [6, 5], // TV
      [1, 6]  // Premiere
    ]);

    const rated = gb.release_dates
      .map(item => ({
        certification: normalise(item?.certification),
        type: Number(item?.type || 99)
      }))
      .filter(item => item.certification)
      .sort((a, b) => (priority.get(a.type) || 99) - (priority.get(b.type) || 99));

    return rated[0]?.certification || "";
  }

  async function tryProxy(body) {
    try {
      const data = await callTmdbProxy(body);
      return pickUkCertification(data);
    } catch {
      return "";
    }
  }

  async function getRating(movie) {
    const cached = readCache(movie);
    if (cached !== null) return cached;
    if (!movie?.tmdbId) return "";

    // The existing proxy already supports movie details. Ask it to append
    // release dates first, then try common dedicated action names.
    let rating = await tryProxy({
      action: "details",
      id: movie.tmdbId,
      append_to_response: "release_dates"
    });

    if (!rating) {
      rating = await tryProxy({ action: "releaseDates", id: movie.tmdbId });
    }

    if (!rating) {
      rating = await tryProxy({ action: "release_dates", id: movie.tmdbId });
    }

    if (!rating) {
      rating = await tryProxy({ action: "releases", id: movie.tmdbId });
    }

    writeCache(movie, rating);
    return rating;
  }

  function classFor(rating) {
    if (rating === "U") return "u";
    if (rating === "PG") return "pg";
    if (rating === "12" || rating === "12A") return "twelve";
    if (rating === "15") return "fifteen";
    if (rating === "18") return "eighteen";
    if (rating === "R18") return "r18";
    return "unknown";
  }

  function makeBadge(rating) {
    const badge = document.createElement("span");
    badge.className = `uk-cert-badge ${classFor(rating)}`;
    badge.textContent = rating;
    badge.title = `UK age classification: ${rating}`;
    badge.setAttribute("aria-label", `UK age classification ${rating}`);
    return badge;
  }

  async function decorateFinalCards() {
    const movies = state?.finalMovies || [];
    const cards = [...document.querySelectorAll("#movieGrid > .movie-card")];

    await Promise.all(cards.map(async (card, index) => {
      const movie = movies[index];
      if (!movie) return;

      card.querySelector(".uk-cert-badge")?.remove();

      const rating = await getRating(movie);
      if (!rating || !card.isConnected) return;

      const meta = card.querySelector(".movie-meta");
      if (!meta || meta.querySelector(".uk-cert-badge")) return;
      meta.appendChild(makeBadge(rating));
    }));
  }

  function allSelectedMovies() {
    const movies = [];

    for (const person of PEOPLE) {
      for (const value of state?.nominations?.[person] || []) {
        const movie = normalizeMovie(value);
        if (movie) movies.push(movie);
      }
    }

    for (const wildcard of state?.wildcards || []) {
      const movie = wildcardMovie(wildcard);
      if (movie) movies.push(movie);
    }

    for (const movie of state?.finalMovies || []) {
      if (movie) movies.push(movie);
    }

    return movies;
  }

  async function decorateChosenMovies() {
    const known = allSelectedMovies();

    const chosen = [...document.querySelectorAll(".chosen-movie:not(.hidden)")];
    await Promise.all(chosen.map(async node => {
      node.querySelector(".uk-cert-badge")?.remove();

      const title = node.querySelector(".chosen-title")?.textContent?.trim();
      const yearText = node.querySelector(".chosen-meta")?.textContent || "";
      if (!title) return;

      const movie = known.find(item =>
        String(item.title || "").trim().toLowerCase() === title.toLowerCase() &&
        (!item.year || !yearText || yearText.includes(String(item.year)))
      ) || known.find(item =>
        String(item.title || "").trim().toLowerCase() === title.toLowerCase()
      );

      if (!movie) return;

      const rating = await getRating(movie);
      if (!rating || !node.isConnected) return;

      const copy = node.querySelector(".chosen-copy");
      if (copy && !copy.querySelector(".uk-cert-badge")) {
        copy.appendChild(makeBadge(rating));
      }
    }));
  }

  async function decorate() {
    await Promise.all([
      decorateFinalCards(),
      decorateChosenMovies()
    ]);
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorate();
    });
  }

  new MutationObserver(queueDecorate).observe(document.body, {
    childList: true,
    subtree: true
  });

  const style = document.createElement("style");
  style.textContent = `
    .uk-cert-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 30px;
      height: 30px;
      margin-left: 4px;
      border: 2px solid rgba(255,255,255,.92);
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(19,34,56,.22);
      font-family: Arial, Helvetica, sans-serif;
      font-size: .68rem;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -.02em;
      color: #fff;
      vertical-align: middle;
    }

    .uk-cert-badge.u { background: #2f8f4e; }
    .uk-cert-badge.pg { background: #d4a91f; color: #17202a; }
    .uk-cert-badge.twelve { background: #e88923; }
    .uk-cert-badge.fifteen { background: #c83d58; }
    .uk-cert-badge.eighteen { background: #b3262e; }
    .uk-cert-badge.r18 { background: #242424; }

    .chosen-copy .uk-cert-badge {
      margin-top: 6px;
      margin-left: 0;
    }

    @media (max-width: 760px) {
      .uk-cert-badge {
        width: 28px;
        height: 28px;
        font-size: .64rem;
      }
    }
  `;
  document.head.appendChild(style);

  queueDecorate();
})();
