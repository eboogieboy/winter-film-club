// =====================================================
// WINTER FILM CLUB — WATCH PROGRESS
// Counts films completed by the whole group: 0–10.
// =====================================================

(() => {
  if (window.__WFC_PROGRESS_TEN_LOADED__) return;
  window.__WFC_PROGRESS_TEN_LOADED__ = true;

  function completedFilms() {
    return (state?.finalMovies || []).filter(movie =>
      PEOPLE.every(person => !!movie.watched?.[person])
    ).length;
  }

  function updateWatchProgress() {
    const panel = document.querySelector(".club-progress-overview");
    if (!panel) return;

    const item = [...panel.querySelectorAll(".club-progress-item")]
      .find(node => node.querySelector("span")?.textContent?.trim() === "Watched");

    if (!item) return;

    const count = completedFilms();
    const value = item.querySelector("strong");
    const text = `${count}/10 done`;

    if (value && value.textContent !== text) {
      value.textContent = text;
    }

    item.classList.toggle("complete", count === 10);
  }

  const observer = new MutationObserver(updateWatchProgress);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  updateWatchProgress();
  window.addEventListener("load", updateWatchProgress);
})();
