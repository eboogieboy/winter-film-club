// =====================================================
// WINTER FILM CLUB — EXPERIENCE ENHANCEMENTS
// Personalises the nomination screen and turns the final
// ten into a more visual collection/review experience.
// No changes are made to the Supabase data model.
// =====================================================

(() => {
  const activePersonSelect = document.getElementById("activePerson");
  const nominationGrid = document.getElementById("nominationGrid");
  const movieGrid = document.getElementById("movieGrid");
  const watchingSection = document.getElementById("watchingSection");

  if (!activePersonSelect || !nominationGrid || !movieGrid || !watchingSection) {
    return;
  }

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  let nominationQueued = false;
  let moviesQueued = false;

  function queueNominationDecorate() {
    if (nominationQueued) return;
    nominationQueued = true;
    requestAnimationFrame(() => {
      nominationQueued = false;
      decorateNominations();
    });
  }

  function queueMovieDecorate() {
    if (moviesQueued) return;
    moviesQueued = true;
    requestAnimationFrame(() => {
      moviesQueued = false;
      decorateMovieGrid();
    });
  }

  function selectedPickData(card) {
    return [...card.querySelectorAll(".pick-block")].map(block => {
      const chosen = block.querySelector(".chosen-movie");
      if (!chosen || chosen.classList.contains("hidden")) return null;

      const title = chosen.querySelector(".chosen-title")?.textContent?.trim() || "";
      const meta = chosen.querySelector(".chosen-meta")?.textContent?.trim() || "";
      const image = chosen.querySelector(".chosen-poster");
      const poster = image && !image.classList.contains("hidden") ? image.src : "";

      if (!title) return null;
      return { title, meta, poster };
    }).filter(Boolean);
  }

  function buildOtherPicksSummary(card, person) {
    const picks = selectedPickData(card);
    const summary = document.createElement("div");
    summary.className = "other-picks-summary";

    const status = document.createElement("div");
    status.className = "other-picks-status";
    status.innerHTML = `
      <strong>${picks.length}/2 picked</strong>
      <span>${picks.length === 2 ? "Ready" : "Waiting"}</span>
    `;
    summary.appendChild(status);

    if (!picks.length) {
      const waiting = document.createElement("p");
      waiting.className = "waiting-picks";
      waiting.textContent = `Waiting for ${person}'s picks.`;
      summary.appendChild(waiting);
      return summary;
    }

    picks.forEach(pick => {
      const row = document.createElement("div");
      row.className = "other-pick-row";
      row.innerHTML = `
        ${pick.poster
          ? `<img src="${esc(pick.poster)}" alt="" />`
          : `<span class="other-pick-placeholder">FILM</span>`}
        <span class="other-pick-copy">
          <strong>${esc(pick.title)}</strong>
          <small>${esc(pick.meta || "Selected film")}</small>
        </span>
      `;
      summary.appendChild(row);
    });

    return summary;
  }

  function decorateNominations() {
    const activePerson = activePersonSelect.value;
    const cards = [...nominationGrid.querySelectorAll(":scope > .person-card")];

    cards.forEach(card => {
      const person = card.querySelector(".person-title h3")?.textContent?.trim() || "";
      const isMine = person === activePerson;

      card.classList.toggle("is-my-picks", isMine);
      card.classList.toggle("is-other-picks", !isMine);
      card.querySelector(".other-picks-summary")?.remove();

      let label = card.querySelector(".my-picks-label");
      if (isMine) {
        if (!label) {
          label = document.createElement("span");
          label.className = "my-picks-label";
          label.textContent = "Your picks";
          card.querySelector(".person-title")?.appendChild(label);
        }
      } else {
        label?.remove();
        card.appendChild(buildOtherPicksSummary(card, person));
      }
    });
  }

  function watchedTotal(card) {
    const text = card.querySelector(".watched-count")?.textContent || "";
    const match = text.match(/(\d+)\s*\/\s*4/);
    return match ? Number(match[1]) : 0;
  }

  function waitingNames(card) {
    return [...card.querySelectorAll(".watcher:not(.done)")]
      .map(node => node.textContent.trim())
      .filter(Boolean);
  }

  function myWatched(card) {
    const text = card.querySelector(".watched-toggle")?.textContent || "";
    return text.trim().startsWith("✓");
  }

  function discussionReady(card) {
    const panel = card.querySelector(".review-panel");
    return watchedTotal(card) === 4 || (panel && !panel.classList.contains("hidden"));
  }

  function stateLabel(card) {
    if (discussionReady(card)) return "Discuss";
    if (myWatched(card)) return "Watched";
    return "To watch";
  }

  function decorateCard(card, index) {
    const ready = discussionReady(card);
    const mine = myWatched(card);
    const total = watchedTotal(card);
    const pending = waitingNames(card);

    card.id = `winter-film-${index + 1}`;
    card.classList.toggle("discussion-ready", ready);
    card.classList.toggle("my-film-watched", mine && !ready);

    const meta = card.querySelector(".movie-meta");
    if (meta) {
      let badge = meta.querySelector(".collection-state");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "collection-state";
        meta.appendChild(badge);
      }
      badge.className = `collection-state ${ready ? "ready" : mine ? "watched" : "todo"}`;
      badge.textContent = ready ? "Discussion ready" : mine ? "You've watched" : "To watch";
    }

    const lock = card.querySelector(".review-lock");
    if (lock && !ready) {
      const strong = lock.querySelector("strong");
      const span = lock.querySelector("span");
      if (strong) strong.textContent = `${total}/4 watched`;
      if (span) {
        if (!pending.length) {
          span.textContent = "Waiting for the group.";
        } else if (pending.length === 1) {
          span.textContent = `Waiting for ${pending[0]}.`;
        } else {
          const last = pending[pending.length - 1];
          span.textContent = `Waiting for ${pending.slice(0, -1).join(", ")} & ${last}.`;
        }
      }
    }
  }

  function makeShelf(cards) {
    let shell = watchingSection.querySelector(".winter-shelf-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "winter-shelf-shell";
      movieGrid.before(shell);
    }

    shell.innerHTML = `
      <div class="winter-shelf-heading">
        <div>
          <span>YOUR WINTER SHELF</span>
          <strong>The final ten</strong>
        </div>
        <small>Tap a poster to jump to the film</small>
      </div>
      <div class="winter-shelf" role="list"></div>
    `;

    const shelf = shell.querySelector(".winter-shelf");

    cards.forEach((card, index) => {
      const title = card.querySelector(".movie-title")?.textContent?.trim() || `Film ${index + 1}`;
      const posterImage = card.querySelector(".poster-image");
      const poster = posterImage && !posterImage.classList.contains("hidden") ? posterImage.src : "";
      const ready = discussionReady(card);
      const mine = myWatched(card);
      const total = watchedTotal(card);

      const button = document.createElement("button");
      button.type = "button";
      button.className = `shelf-film ${ready ? "ready" : mine ? "watched" : "todo"}`;
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", `${title}. ${stateLabel(card)}. ${total} of 4 watched.`);
      button.innerHTML = `
        <span class="shelf-poster">
          ${poster
            ? `<img src="${esc(poster)}" alt="" />`
            : `<span class="shelf-placeholder">WFC</span>`}
          <span class="shelf-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="shelf-status">${ready ? "✓" : total}</span>
        </span>
      `;

      button.addEventListener("click", () => {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
        card.classList.add("film-pulse");
        setTimeout(() => card.classList.remove("film-pulse"), 900);
      });

      shelf.appendChild(button);
    });
  }

  function decorateMovieGrid() {
    const cards = [...movieGrid.querySelectorAll(":scope > .movie-card")];

    if (!cards.length) {
      watchingSection.querySelector(".winter-shelf-shell")?.remove();
      return;
    }

    cards.forEach(decorateCard);
    makeShelf(cards);
  }

  new MutationObserver(queueNominationDecorate)
    .observe(nominationGrid, { childList: true });

  new MutationObserver(queueMovieDecorate)
    .observe(movieGrid, { childList: true });

  activePersonSelect.addEventListener("change", () => {
    queueNominationDecorate();
    queueMovieDecorate();
  });

  queueNominationDecorate();
  queueMovieDecorate();
})();