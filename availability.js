// =====================================================
// WINTER FILM CLUB — UK AVAILABILITY
// Shows UK cinema / streaming availability on the Final Ten.
// Streaming provider data comes from TMDB watch-provider data
// when the Supabase proxy supports it, with a live TMDB fallback.
// =====================================================

(() => {
  if (window.__WFC_AVAILABILITY_LOADED__) return;
  window.__WFC_AVAILABILITY_LOADED__ = true;

  const cache = new Map();
  const CACHE_MS = 12 * 60 * 60 * 1000;
  let queued = false;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function todayIso() {
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

  function daysFromToday(value) {
    if (!value) return null;
    const target = new Date(`${value}T12:00:00`);
    const now = new Date(`${todayIso()}T12:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.round((target - now) / 86400000);
  }

  function cinemaStatus(movie) {
    const date = clean(movie.ukReleaseDate);
    if (!date) return null;

    const delta = daysFromToday(date);
    if (delta === null) return null;

    if (delta > 0) {
      return {
        className: "future",
        label: `UK cinema from ${formatUkDate(date)}`,
        current: false
      };
    }

    // A recent theatrical release is likely still useful to the group,
    // but we avoid claiming that every local cinema is still screening it.
    if (delta >= -56) {
      return {
        className: "cinema",
        label: `UK cinema release ${formatUkDate(date)}`,
        current: true
      };
    }

    return null;
  }

  function providerNames(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .slice()
      .sort((a, b) => Number(a.display_priority || 999) - Number(b.display_priority || 999))
      .map(item => clean(item.provider_name))
      .filter(name => {
        const key = name.toLowerCase();
        if (!name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function extractGbProviderData(data) {
    if (!data || typeof data !== "object") return null;

    const candidates = [
      data?.results?.GB,
      data?.GB,
      data?.providers?.results?.GB,
      data?.watchProviders?.results?.GB,
      data?.watch_providers?.results?.GB,
      data?.["watch/providers"]?.results?.GB,
      data?.append_to_response?.["watch/providers"]?.results?.GB
    ];

    return candidates.find(Boolean) || null;
  }

  function normaliseAvailability(gb, source = "tmdb") {
    if (!gb) return null;

    const subscription = providerNames([
      ...(gb.flatrate || []),
      ...(gb.free || []),
      ...(gb.ads || [])
    ]);

    return {
      source,
      exact: true,
      subscription,
      rent: providerNames(gb.rent),
      buy: providerNames(gb.buy),
      link: clean(gb.link)
    };
  }

  function cacheKey(movie) {
    return `wfc-availability-v1:${movie.tmdbId || movie.id || clean(movie.title).toLowerCase()}`;
  }

  function readStored(movie) {
    try {
      const raw = localStorage.getItem(cacheKey(movie));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_MS) return null;
      return parsed.value || null;
    } catch {
      return null;
    }
  }

  function writeStored(movie, value) {
    try {
      localStorage.setItem(cacheKey(movie), JSON.stringify({
        savedAt: Date.now(),
        value
      }));
    } catch {
      // Storage may be unavailable in private browsing; memory cache still works.
    }
  }

  async function tryProviderAction(action, movie, extras = {}) {
    try {
      const data = await callTmdbProxy({
        action,
        id: movie.tmdbId,
        region: "GB",
        ...extras
      });

      return normaliseAvailability(extractGbProviderData(data));
    } catch (error) {
      console.debug(`TMDB availability action ${action} unavailable:`, error?.message || error);
      return null;
    }
  }

  async function fetchAvailability(movie) {
    const key = cacheKey(movie);
    if (cache.has(key)) return cache.get(key);

    const stored = readStored(movie);
    if (stored) {
      cache.set(key, stored);
      return stored;
    }

    if (!movie.tmdbId) {
      const fallback = { exact: false, subscription: [], rent: [], buy: [], link: "" };
      cache.set(key, fallback);
      return fallback;
    }

    let result = await tryProviderAction("watchProviders", movie);
    result = result || await tryProviderAction("providers", movie);
    result = result || await tryProviderAction("watch_providers", movie);
    result = result || await tryProviderAction("details", movie, {
      append_to_response: "watch/providers"
    });

    if (!result) {
      result = { exact: false, subscription: [], rent: [], buy: [], link: "" };
    }

    cache.set(key, result);
    writeStored(movie, result);
    return result;
  }

  function tmdbWatchUrl(movie) {
    return movie.tmdbId
      ? `https://www.themoviedb.org/movie/${encodeURIComponent(movie.tmdbId)}/watch?locale=GB`
      : `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(movie.title || "")}`;
  }

  function cinemaSearchUrl(movie) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${movie.title || ""} cinema showtimes UK`)}`;
  }

  function row(label, text, className = "") {
    const item = document.createElement("div");
    item.className = `availability-row ${className}`.trim();

    const heading = document.createElement("span");
    heading.textContent = label;

    const value = document.createElement("strong");
    value.textContent = text;

    item.append(heading, value);
    return item;
  }

  function makeLink(label, href, className = "") {
    const a = document.createElement("a");
    a.className = `availability-link ${className}`.trim();
    a.href = href;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = label;
    return a;
  }

  async function decorateCard(card, movie, isCurrent) {
    if (!card || !movie) return;

    let box = card.querySelector(":scope .uk-availability");
    if (!box) {
      box = document.createElement("div");
      box.className = "uk-availability";
      const synopsis = card.querySelector(".movie-synopsis");
      const pickedBy = card.querySelector(".picked-by");
      if (synopsis) synopsis.insertAdjacentElement("afterend", box);
      else if (pickedBy) pickedBy.insertAdjacentElement("afterend", box);
      else card.querySelector(".movie-body")?.appendChild(box);
    }

    box.classList.toggle("current", !!isCurrent);
    box.innerHTML = "";

    const title = document.createElement("div");
    title.className = "availability-title";
    title.innerHTML = `<span>Where to watch</span><small>UK availability</small>`;
    box.appendChild(title);

    const cinema = cinemaStatus(movie);
    if (cinema) {
      box.appendChild(row("Cinema", cinema.label, cinema.className));
    }

    const loading = row("Streaming", "Checking current services…", "loading");
    box.appendChild(loading);

    const availability = await fetchAvailability(movie);
    if (!box.isConnected) return;

    loading.remove();

    if (availability.exact) {
      if (availability.subscription.length) {
        box.appendChild(row("Included with", availability.subscription.join(" · "), "streaming"));
      }

      if (availability.rent.length) {
        box.appendChild(row("Rent", availability.rent.join(" · "), "rent"));
      }

      if (availability.buy.length) {
        box.appendChild(row("Buy", availability.buy.join(" · "), "buy"));
      }

      if (!availability.subscription.length && !availability.rent.length && !availability.buy.length) {
        box.appendChild(row("Streaming", "No UK provider listing found", "unavailable"));
      }
    } else {
      box.appendChild(row("Streaming", "Check current UK services", "unknown"));
    }

    const actions = document.createElement("div");
    actions.className = "availability-actions";
    actions.appendChild(makeLink(
      availability.exact ? "See all watch options" : "Check streaming options",
      availability.link || tmdbWatchUrl(movie)
    ));

    if (cinema?.current || (movie.ukReleaseDate && clean(movie.ukReleaseDate) <= todayIso())) {
      actions.appendChild(makeLink("Find cinema times", cinemaSearchUrl(movie), "cinema-link"));
    }

    box.appendChild(actions);

    if (isCurrent) {
      const bannerCopy = card.querySelector(".next-film-banner-copy small");
      if (bannerCopy) {
        if (availability.subscription.length) {
          bannerCopy.textContent = `Available in the UK on ${availability.subscription.slice(0, 3).join(", ")}.`;
        } else if (cinema?.current) {
          bannerCopy.textContent = cinema.label;
        } else if (availability.rent.length) {
          bannerCopy.textContent = `Available to rent in the UK on ${availability.rent.slice(0, 3).join(", ")}.`;
        } else {
          bannerCopy.textContent = "Check the current UK watch options below.";
        }
      }
    }
  }

  function addAttribution() {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector(".watch-provider-credit")) return;

    const p = document.createElement("p");
    p.className = "tmdb-credit watch-provider-credit";
    p.innerHTML = `Streaming availability is supplied via TMDB watch-provider data, powered by JustWatch. Availability can change.`;
    footer.appendChild(p);
  }

  async function decorateAll() {
    if (state?.phase !== "watching") return;

    const movies = state?.finalMovies || [];
    const cards = [...document.querySelectorAll("#movieGrid > .movie-card")];
    const currentId = state?.currentMovieId;

    await Promise.all(cards.map((card, index) =>
      decorateCard(card, movies[index], movies[index]?.id === currentId)
    ));

    addAttribution();
  }

  function queueDecorate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateAll();
    });
  }

  const grid = document.getElementById("movieGrid");
  if (grid) {
    new MutationObserver(queueDecorate).observe(grid, {
      childList: true,
      subtree: true
    });
  }

  const style = document.createElement("style");
  style.textContent = `
    .uk-availability {
      margin: 10px 0 13px;
      padding: 10px 11px;
      border: 1px solid rgba(19,34,56,.1);
      border-radius: 12px;
      background: #f7f4ed;
    }

    .uk-availability.current {
      border-color: rgba(143,75,50,.24);
      background: #fff9f3;
    }

    .availability-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 7px;
    }

    .availability-title span {
      color: #30445f;
      font-size: .72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .availability-title small {
      color: #8a94a1;
      font-size: .62rem;
    }

    .availability-row {
      display: grid;
      grid-template-columns: 74px 1fr;
      gap: 9px;
      padding: 5px 0;
      border-top: 1px solid rgba(19,34,56,.07);
    }

    .availability-row:first-of-type {
      border-top: 0;
    }

    .availability-row span {
      color: #8a94a1;
      font-size: .68rem;
      font-weight: 800;
    }

    .availability-row strong {
      color: #4f5d6c;
      font-size: .72rem;
      line-height: 1.4;
    }

    .availability-row.streaming strong,
    .availability-row.cinema strong {
      color: #2f6741;
    }

    .availability-row.future strong {
      color: #8f4b32;
    }

    .availability-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 8px;
    }

    .availability-link {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 10px;
      border-radius: 999px;
      background: #132238;
      color: #fff;
      font-size: .66rem;
      font-weight: 850;
      text-decoration: none;
    }

    .availability-link.cinema-link {
      background: #ebe5d8;
      color: #30445f;
    }

    .watch-provider-credit {
      max-width: 520px;
    }

    @media (max-width: 760px) {
      .uk-availability {
        margin: 9px 0 11px;
        padding: 9px 10px;
      }

      .availability-row {
        grid-template-columns: 65px 1fr;
      }

      .availability-row span,
      .availability-row strong {
        font-size: .66rem;
      }

      .availability-actions {
        display: grid;
        grid-template-columns: 1fr;
      }

      .availability-link {
        justify-content: center;
        min-height: 40px;
      }
    }
  `;
  document.head.appendChild(style);

  queueDecorate();
})();
