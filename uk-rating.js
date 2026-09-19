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

  // Verified UK fallback classifications for films currently in the club.
  // These are only used when TMDB does not return a usable GB certification.
  // Keep this table deliberately small and factual rather than guessing.
  const KNOWN_BBFC_FALLBACKS = new Map([
    ["some like it hot|1959", "U"],
    ["the good, the bad and the ugly|1966", "18"],
    ["pirates of the caribbean: the curse of the black pearl|2003", "12A"],
    ["rogue one: a star wars story|2016", "12A"],
    ["the wave|2015", "15"],
    ["steel magnolias|1989", "PG"],
    ["disturbia|2007", "15"],
    ["jaws: the revenge|1987", "15"],
    ["jaws - the revenge|1987", "15"]
  ]);

  function movieFallbackKey(movie) {
    return `${String(movie?.title || "").trim().toLowerCase()}|${String(movie?.year || "").trim()}`;
  }

  function knownBbfcFallback(movie) {
    return KNOWN_BBFC_FALLBACKS.get(movieFallbackKey(movie)) || "";
  }

  function shouldShowTbc(movie) {
    const year = Number(movie?.year || 0);
    const currentYear = new Date().getFullYear();
    return !!year && year >= currentYear;
  }

  function cacheKey(movie) {
    return `wfc-uk-rating-v4:${movie.tmdbId || movie.id || movie.title || ""}`;
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
    const supported = new Set(["U", "PG", "12", "12A", "15", "18", "R18", "TBC"]);
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

  function parseUkRatingFromReleasePage(text) {
    const source = String(text || "");
    const match = source.match(/(?:Image\s+)?United Kingdom/i);
    if (!match) return "";

    const start = match.index ?? 0;
    let section = source.slice(start, start + 2500);

    const nextCountry = section.slice(30).search(/\n##\s+(?:Image\s+)?[A-Z][^\n]+/);
    if (nextCountry >= 0) {
      section = section.slice(0, nextCountry + 30);
    }

    const rows = [...section.matchAll(/\|\s*(U|PG|12A?|15|18|R18)\s*\|/gi)];
    return normalise(rows[0]?.[1] || "");
  }

  async function tryPublicTmdbReleasePage(movie) {
    if (!movie?.tmdbId) return "";

    try {
      const target = `https://www.themoviedb.org/movie/${encodeURIComponent(movie.tmdbId)}/releases`;
      const response = await fetch(`https://r.jina.ai/${target}`, {
        headers: { Accept: "text/plain" }
      });

      if (!response.ok) return "";
      return parseUkRatingFromReleasePage(await response.text());
    } catch {
      return "";
    }
  }

  function pickBestUkRating(values) {
    const order = new Map([
      ["U", 1],
      ["PG", 2],
      ["12", 3],
      ["12A", 4],
      ["15", 5],
      ["18", 6],
      ["R18", 7]
    ]);

    return values
      .map(normalise)
      .filter(Boolean)
      .sort((a, b) => (order.get(b) || 0) - (order.get(a) || 0))[0] || "";
  }

  function parseImdbUkCertification(text) {
    const source = String(text || "");
    const match = source.match(/United Kingdom/i);
    if (!match) return "";

    const start = match.index ?? 0;
    let section = source.slice(start, start + 1800);

    const nextCountry = section.slice(30).search(/\n\s*[*-]\s+[A-Z][A-Za-z ]+\n|\n###\s+[A-Z][A-Za-z ]+/);
    if (nextCountry >= 0) {
      section = section.slice(0, nextCountry + 30);
    }

    const values = [];

    for (const m of section.matchAll(/(?:^|\s)(U|PG|12A?|15|18|R18)(?=\s|$|[,.])/gim)) {
      values.push(m[1]);
    }

    return pickBestUkRating(values);
  }

  async function tryImdbUkCertification(movie) {
    if (!movie?.tmdbId) return "";

    try {
      const details = await callTmdbProxy({
        action: "details",
        id: movie.tmdbId
      });

      const imdbId = String(details?.imdb_id || "").trim();
      if (!/^tt\d+$/.test(imdbId)) return "";

      const target = `https://www.imdb.com/title/${imdbId}/parentalguide/`;
      const response = await fetch(`https://r.jina.ai/${target}`, {
        headers: { Accept: "text/plain" }
      });

      if (!response.ok) return "";
      return parseImdbUkCertification(await response.text());
    } catch {
      return "";
    }
  }

  async function getRating(movie) {
    const cached = readCache(movie);
    if (cached !== null) return cached;
    if (!movie?.tmdbId) return "";

    // First use our existing Supabase/TMDB proxy.
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

    // The current proxy deployment may not forward release_dates. In that
    // case read the same certification from TMDB's public Releases page.
    if (!rating) {
      rating = await tryPublicTmdbReleasePage(movie);
    }

    // If TMDB's own GB data is incomplete, use IMDb's UK certification
    // section as a generic fallback. Where several historic UK versions are
    // listed we use the strongest certification, which avoids choosing an
    // old cut-down cinema certificate for an uncut modern version.
    if (!rating) {
      rating = await tryImdbUkCertification(movie);
    }

    // Known BBFC fallbacks cover titles where public datasets are patchy.
    if (!rating) {
      rating = knownBbfcFallback(movie);
    }

    // Only genuinely forthcoming/current-year films with no classification
    // get TBC. Older films remain blank rather than receiving a guessed rating.
    if (!rating && shouldShowTbc(movie)) {
      rating = "TBC";
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
    if (rating === "TBC") return "tbc";
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

      if (card.querySelector(".movie-meta .uk-cert-badge")) return;

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

  function findKnownMovie(known, title, metaText = "") {
    const cleanTitle = String(title || "").trim().toLowerCase();
    if (!cleanTitle) return null;

    return known.find(item =>
      String(item.title || "").trim().toLowerCase() === cleanTitle &&
      (!item.year || !metaText || String(metaText).includes(String(item.year)))
    ) || known.find(item =>
      String(item.title || "").trim().toLowerCase() === cleanTitle
    ) || null;
  }

  async function decorateChosenMovies() {
    const known = allSelectedMovies();

    const chosen = [...document.querySelectorAll(".chosen-movie:not(.hidden)")];
    await Promise.all(chosen.map(async node => {
      if (node.querySelector(".uk-cert-badge")) return;

      const title = node.querySelector(".chosen-title")?.textContent?.trim();
      const yearText = node.querySelector(".chosen-meta")?.textContent || "";
      const movie = findKnownMovie(known, title, yearText);
      if (!movie) return;

      const rating = await getRating(movie);
      if (!rating || !node.isConnected) return;

      const titleHost = node.querySelector(".chosen-title");
      if (titleHost && !node.querySelector(".uk-cert-badge")) {
        const badge = makeBadge(rating);
        badge.classList.add("compact");
        titleHost.appendChild(badge);
      }
    }));
  }

  async function decorateCompactMovieRows() {
    const known = allSelectedMovies();

    const configs = [
      {
        selector: ".other-pick-row",
        title: ".other-pick-copy > strong",
        meta: ".other-pick-copy > small",
        host: ".other-pick-copy > strong"
      },
      {
        selector: ".wildcard-chip",
        title: ".wildcard-copy > strong",
        meta: ".wildcard-copy > span",
        host: ".wildcard-copy > strong"
      },
      {
        selector: ".bid-card",
        title: ".bid-copy h3",
        meta: ".bid-copy .bid-meta",
        host: ".bid-copy h3"
      }
    ];

    const jobs = [];

    configs.forEach(config => {
      document.querySelectorAll(config.selector).forEach(node => {
        if (node.querySelector(".uk-cert-badge")) return;

        const titleNode = node.querySelector(config.title);
        const title = titleNode?.textContent?.trim() || "";
        const meta = node.querySelector(config.meta)?.textContent || "";
        const movie = findKnownMovie(known, title, meta);
        if (!movie) return;

        jobs.push((async () => {
          const rating = await getRating(movie);
          if (!rating || !node.isConnected || node.querySelector(".uk-cert-badge")) return;

          const host = node.querySelector(config.host);
          if (host) {
            const badge = makeBadge(rating);
            badge.classList.add("compact");
            host.appendChild(badge);
          }
        })());
      });
    });

    await Promise.all(jobs);
  }

  async function decorate() {
    await Promise.all([
      decorateFinalCards(),
      decorateChosenMovies(),
      decorateCompactMovieRows()
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
    .uk-cert-badge.tbc {
      width: auto;
      min-width: 34px;
      padding: 0 7px;
      border-radius: 999px;
      background: #7b8794;
      font-size: .56rem;
      letter-spacing: .03em;
    }

    .uk-cert-badge.compact {
      display: inline-flex;
      width: 25px;
      height: 25px;
      min-width: 25px;
      margin: 0 0 0 7px;
      padding: 0;
      border-radius: 50%;
      color: #fff;
      font-size: .58rem;
      vertical-align: middle;
    }

    .uk-cert-badge.compact.pg {
      color: #17202a;
    }

    .uk-cert-badge.compact.tbc {
      width: auto;
      min-width: 38px;
      padding: 0 7px;
      border-radius: 999px;
      color: #fff;
      font-size: .54rem;
    }

    .chosen-title,
    .other-pick-copy > strong,
    .wildcard-copy > strong,
    .bid-copy h3 {
      display: flex !important;
      align-items: center;
      gap: 2px;
      min-width: 0;
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
