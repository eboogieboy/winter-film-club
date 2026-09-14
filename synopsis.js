// =====================================================
// WINTER FILM CLUB — MOVIE SYNOPSES
// Adds a fuller TMDB synopsis to each film in the final ten.
// =====================================================

(() => {
  const movieGrid = document.getElementById("movieGrid");

  if (!movieGrid) {
    return;
  }

  function shortSynopsis(value) {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      return "";
    }

    const sentences =
      text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

    let summary = sentences
      .slice(0, 3)
      .join(" ")
      .trim();

    if (summary.length > 420) {
      summary = summary
        .slice(0, 417)
        .replace(/\s+\S*$/, "")
        .trim() + "…";
    }

    return summary;
  }

  function decorateSynopses() {
    const cards = [
      ...movieGrid.querySelectorAll(":scope > .movie-card")
    ];

    cards.forEach((card, index) => {
      const movie = state?.finalMovies?.[index];
      const synopsis = shortSynopsis(movie?.overview);

      let block = card.querySelector(".movie-synopsis");

      if (!synopsis) {
        block?.remove();
        return;
      }

      if (!block) {
        block = document.createElement("div");
        block.className = "movie-synopsis";

        const pickedBy = card.querySelector(".picked-by");
        const watchers = card.querySelector(".watchers");

        if (pickedBy) {
          pickedBy.insertAdjacentElement("afterend", block);
        } else if (watchers) {
          watchers.insertAdjacentElement("beforebegin", block);
        }
      }

      block.innerHTML = "";

      const label = document.createElement("span");
      label.className = "movie-synopsis-label";
      label.textContent = "Synopsis";

      const copy = document.createElement("p");
      copy.textContent = synopsis;

      block.append(label, copy);
    });
  }

  let queued = false;

  function queueDecorate() {
    if (queued) {
      return;
    }

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      decorateSynopses();
    });
  }

  new MutationObserver(queueDecorate).observe(
    movieGrid,
    { childList: true }
  );

  const style = document.createElement("style");
  style.textContent = `
    .movie-synopsis {
      margin: 10px 0 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(19,34,56,.09);
    }

    .movie-synopsis-label {
      display: block;
      margin-bottom: 4px;
      color: #8f4b32;
      font-size: .65rem;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .movie-synopsis p {
      margin: 0;
      color: #596474;
      font-size: .84rem;
      line-height: 1.45;
    }

    @media (max-width: 760px) {
      .movie-synopsis {
        margin: 9px 0 11px;
        padding-top: 8px;
      }

      .movie-synopsis-label {
        font-size: .58rem;
      }

      .movie-synopsis p {
        font-size: .74rem;
        line-height: 1.4;
      }
    }
  `;

  document.head.appendChild(style);
  queueDecorate();
})();