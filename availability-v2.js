// =====================================================
// WINTER FILM CLUB — UK WATCH AVAILABILITY
// =====================================================

(() => {
  if (window.__WFC_AVAILABILITY_V2_LOADED__) return;
  window.__WFC_AVAILABILITY_V2_LOADED__ = true;

  const cache = new Map();
  const CACHE_MS = 12 * 60 * 60 * 1000;
  let queued = false;

  const clean = value => String(value || "").replace(/\s+/g, " ").trim();

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(d);
  }

  function cinemaStatus(movie) {
    const date = clean(movie?.ukReleaseDate);
    if (!date) return null;

    const today = new Date(`${todayIso()}T12:00:00`);
    const release = new Date(`${date}T12:00:00`);
    if (Number.isNaN(release.getTime())) return null;

    const days = Math.round((release - today) / 86400000);
    if (days > 0) return { current: false, text: `UK cinema from ${formatDate(date)}` };
    if (days >= -56) return { current: true, text: `UK cinema release ${formatDate(date)}` };
    return null;
  }

  function names(list) {
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

  function gbFrom(data) {
    if (!data || typeof data !== "object") return null;
    return [
      data?.results?.GB,
      data?.GB,
      data?.providers?.results?.GB,
      data?.watchProviders?.results?.GB,
      data?.watch_providers?.results?.GB,
      data?.["watch/providers"]?.results?.GB
    ].find(Boolean) || null;
  }

  function normalise(gb) {
    if (!gb) return null;
    return {
      exact: true,
      subscription: names([...(gb.flatrate || []), ...(gb.free || []), ...(gb.ads || [])]),
      rent: names(gb.rent),
      buy: names(gb.buy),
      link: clean(gb.link)
    };
  }

  function keyFor(movie) {
    return `wfc-avail-v2:${movie.tmdbId || movie.id || clean(movie.title).toLowerCase()}`;
  }

  function stored(movie) {
    try {
      const raw = localStorage.getItem(keyFor(movie));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_MS) return null;
      return parsed.value || null;
    } catch {
      return null;
    }
  }

  function remember(movie, value) {
    cache.set(keyFor(movie), value);
    try {
      localStorage.setItem(keyFor(movie), JSON.stringify({ savedAt: Date.now(), value }));
    } catch {}
  }

  async function tryAction(action, movie, extras = {}) {
    try {
      const data = await callTmdbProxy({
        action,
        id: movie.tmdbId,
        region: "GB",
        ...extras
      });
      return normalise(gbFrom(data));
    } catch {
      return null;
    }
  }

  async function availabilityFor(movie) {
    const key = keyFor(movie);
    if (cache.has(key)) return cache.get(key);

    const saved = stored(movie);
    if (saved) {
      cache.set(key, saved);
      return saved;
    }

    let result = null;
    if (movie.tmdbId) {
      result = await tryAction("watchProviders", movie);
      result = result || await tryAction("providers", movie);
      result = result || await tryAction("watch_providers", movie);
      result = result || await tryAction("details", movie, { append_to_response: "watch/providers" });
    }

    result = result || { exact: false, subscription: [], rent: [], buy: [], link: "" };
    remember(movie, result);
    return result;
  }

  function watchUrl(movie) {
    return movie.tmdbId
      ? `https://www.themoviedb.org/movie/${encodeURIComponent(movie.tmdbId)}/watch?locale=GB`
      : `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(movie.title || "")}`;
  }

  function cinemaUrl(movie) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${movie.title || ""} cinema showtimes UK`)}`;
  }

  function makeRow(label, text, className = "") {
    const div = document.createElement("div");
    div.className = `availability-row ${className}`.trim();
    div.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong>`;
    return div;
  }

  function makeLink(label, href, className = "") {
    const link = document.createElement("a");
    link.className = `availability-link ${className}`.trim();
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = label;
    return link;
  }

  async function decorateCard(card, movie, isCurrent) {
    if (!card || !movie) return;

    const marker = `${movie.id || movie.tmdbId || movie.title}:${isCurrent ? 1 : 0}`;
    let box = card.querySelector(".uk-availability");
    if (box?.dataset.marker === marker && box.dataset.complete === "1") return;

    if (!box) {
      box = document.createElement("div");
      box.className = "uk-availability";
      const synopsis = card.querySelector(".movie-synopsis");
      const pickedBy = card.querySelector(".picked-by");
      if (synopsis) synopsis.insertAdjacentElement("afterend", box);
      else if (pickedBy) pickedBy.insertAdjacentElement("afterend", box);
      else card.querySelector(".movie-body")?.appendChild(box);
    }

    box.dataset.marker = marker;
    box.dataset.complete = "0";
    box.classList.toggle("current", !!isCurrent);
    box.innerHTML = `
      <div class="availability-title">
        <span>Where to watch</span>
        <small>UK availability</small>
      </div>
    `;

    const cinema = cinemaStatus(movie);
    if (cinema) box.appendChild(makeRow("Cinema", cinema.text, cinema.current ? "cinema" : "future"));

    const loading = makeRow("Streaming", "Checking current services…", "loading");
    box.appendChild(loading);

    const availability = await availabilityFor(movie);
    if (!box.isConnected || box.dataset.marker !== marker) return;

    loading.remove();

    if (availability.exact) {
      if (availability.subscription.length) {
        box.appendChild(makeRow("Included with", availability.subscription.join(" · "), "streaming"));
      }
      if (availability.rent.length) box.appendChild(makeRow("Rent", availability.rent.join(" · ")));
      if (availability.buy.length) box.appendChild(makeRow("Buy", availability.buy.join(" · ")));
      if (!availability.subscription.length && !availability.rent.length && !availability.buy.length) {
        box.appendChild(makeRow("Streaming", "No UK provider listing found"));
      }
    } else {
      box.appendChild(makeRow("Streaming", "Check current UK services"));
    }

    const actions = document.createElement("div");
    actions.className = "availability-actions";
    actions.appendChild(makeLink(
      availability.exact ? "See all watch options" : "Check streaming options",
      availability.link || watchUrl(movie)
    ));

    if (cinema?.current || (movie.ukReleaseDate && clean(movie.ukReleaseDate) <= todayIso())) {
      actions.appendChild(makeLink("Find cinema times", cinemaUrl(movie), "cinema-link"));
    }

    box.appendChild(actions);
    box.dataset.complete = "1";

    if (isCurrent) {
      const small = card.querySelector(".next-film-banner-copy small");
      if (small) {
        if (availability.subscription.length) {
          small.textContent = `Available in the UK on ${availability.subscription.slice(0, 3).join(", ")}.`;
        } else if (cinema?.current) {
          small.textContent = cinema.text;
        } else if (availability.rent.length) {
          small.textContent = `Available to rent in the UK on ${availability.rent.slice(0, 3).join(", ")}.`;
        } else {
          small.textContent = "Check the current UK watch options below.";
        }
      }
    }
  }

  async function decorateAll() {
    if (state?.phase !== "watching") return;

    const movies = state?.finalMovies || [];
    const cards = [...document.querySelectorAll("#movieGrid > .movie-card")];
    await Promise.all(cards.map((card, index) =>
      decorateCard(card, movies[index], movies[index]?.id === state?.currentMovieId)
    ));

    const footer = document.querySelector("footer");
    if (footer && !footer.querySelector(".watch-provider-credit")) {
      const credit = document.createElement("p");
      credit.className = "tmdb-credit watch-provider-credit";
      credit.textContent = "Streaming availability via TMDB watch-provider data, powered by JustWatch. Availability can change.";
      footer.appendChild(credit);
    }
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
    // Only watch for rebuilt movie cards. Changes inside our own availability
    // panel do not trigger another pass.
    new MutationObserver(queueDecorate).observe(grid, { childList: true });
  }

  const style = document.createElement("style");
  style.textContent = `
    .uk-availability{margin:10px 0 13px;padding:10px 11px;border:1px solid rgba(19,34,56,.1);border-radius:12px;background:#f7f4ed}
    .uk-availability.current{border-color:rgba(143,75,50,.24);background:#fff9f3}
    .availability-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:7px}
    .availability-title span{color:#30445f;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em}
    .availability-title small{color:#8a94a1;font-size:.62rem}
    .availability-row{display:grid;grid-template-columns:74px 1fr;gap:9px;padding:5px 0;border-top:1px solid rgba(19,34,56,.07)}
    .availability-row span{color:#8a94a1;font-size:.68rem;font-weight:800}
    .availability-row strong{color:#4f5d6c;font-size:.72rem;line-height:1.4}
    .availability-row.streaming strong,.availability-row.cinema strong{color:#2f6741}
    .availability-row.future strong{color:#8f4b32}
    .availability-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
    .availability-link{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border-radius:999px;background:#132238;color:#fff;font-size:.66rem;font-weight:850;text-decoration:none}
    .availability-link.cinema-link{background:#ebe5d8;color:#30445f}
    .watch-provider-credit{max-width:520px}
    @media(max-width:760px){.uk-availability{margin:9px 0 11px;padding:9px 10px}.availability-row{grid-template-columns:65px 1fr}.availability-row span,.availability-row strong{font-size:.66rem}.availability-actions{display:grid;grid-template-columns:1fr}.availability-link{justify-content:center;min-height:40px}}
  `;
  document.head.appendChild(style);

  queueDecorate();
})();
