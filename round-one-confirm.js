// =====================================================
// WINTER FILM CLUB — ROUND ONE CONFIRMATION
// Everyone confirms their guaranteed picks + wildcard choices
// before the club can move into bidding.
// =====================================================

(() => {
  if (window.__WFC_ROUND_ONE_CONFIRM_LOADED__) return;
  window.__WFC_ROUND_ONE_CONFIRM_LOADED__ = true;

  const section = document.getElementById("nominationsSection");
  const startBtn = document.getElementById("startBiddingBtn");
  const hint = document.getElementById("startBiddingHint");
  if (!section || !startBtn || !hint) return;

  function ensureState() {
    if (!state.roundOneConfirmed || typeof state.roundOneConfirmed !== "object") {
      state.roundOneConfirmed = {};
    }

    PEOPLE.forEach(person => {
      if (typeof state.roundOneConfirmed[person] !== "boolean") {
        state.roundOneConfirmed[person] = false;
      }
    });
  }

  function picksComplete() {
    return PEOPLE.every(person =>
      (state.nominations?.[person] || [])
        .map(normalizeMovie)
        .filter(Boolean)
        .length === 2
    );
  }

  function enoughWildcards() {
    return (state.wildcards || []).length >= 2;
  }

  function allConfirmed() {
    ensureState();
    return PEOPLE.every(person => state.roundOneConfirmed[person] === true);
  }

  function confirmedCount() {
    ensureState();
    return PEOPLE.filter(person => state.roundOneConfirmed[person]).length;
  }

  function panelHost() {
    let panel = document.getElementById("roundOneConfirmPanel");

    if (!picksComplete()) {
      panel?.remove();
      return null;
    }

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "roundOneConfirmPanel";
      panel.className = "round-one-confirm-panel";

      const actionRow = section.querySelector(".action-row");
      actionRow?.insertAdjacentElement("beforebegin", panel);
    }

    return panel;
  }

  function renderPanel() {
    ensureState();

    const panel = panelHost();
    if (!panel) {
      applyGate();
      return;
    }

    const active = state.activePerson;
    const mine = !!state.roundOneConfirmed[active];

    panel.innerHTML = "";

    const intro = document.createElement("div");
    intro.className = "round-one-confirm-copy";
    intro.innerHTML = `
      <span>FINAL CHECK</span>
      <strong>Happy with your picks and wildcards?</strong>
      <p>Once all four people confirm, the club can move on to wildcard bidding.</p>
    `;

    const people = document.createElement("div");
    people.className = "round-one-confirm-people";

    PEOPLE.forEach(person => {
      const item = document.createElement("div");
      const confirmed = !!state.roundOneConfirmed[person];
      item.className = `round-one-confirm-person ${confirmed ? "confirmed" : ""}`;
      item.innerHTML = `
        <span class="confirm-dot">${confirmed ? "✓" : ""}</span>
        <strong>${escapeHtml(person)}</strong>
        <small>${confirmed ? "Confirmed" : "Waiting"}</small>
      `;
      people.appendChild(item);
    });

    const mineRow = document.createElement("div");
    mineRow.className = "round-one-confirm-mine";

    const button = document.createElement("button");
    button.type = "button";
    button.className = mine ? "secondary confirm-round-one-btn confirmed" : "primary confirm-round-one-btn";
    button.textContent = mine
      ? "✓ I’m confirmed"
      : "Confirm my picks & wildcards";

    button.addEventListener("click", async () => {
      ensureState();
      state.roundOneConfirmed[active] = !state.roundOneConfirmed[active];
      button.disabled = true;

      await saveState();
      renderPanel();
    });

    const status = document.createElement("span");
    status.className = "round-one-confirm-status";
    status.textContent = `${confirmedCount()}/4 confirmed`;

    mineRow.append(button, status);
    panel.append(intro, people, mineRow);

    applyGate();
  }

  function applyGate() {
    ensureState();

    if (!picksComplete()) {
      return;
    }

    const confirmed = allConfirmed();
    const enough = enoughWildcards();

    startBtn.disabled = !(confirmed && enough);

    if (!enough) {
      hint.textContent = `${confirmedCount()}/4 confirmed · add at least two wildcard films before bidding.`;
    } else if (!confirmed) {
      const waiting = PEOPLE.filter(person => !state.roundOneConfirmed[person]);
      hint.textContent = waiting.length === 1
        ? `Waiting for ${waiting[0]} to confirm.`
        : `Waiting for ${waiting.slice(0, -1).join(", ")} & ${waiting[waiting.length - 1]} to confirm.`;
    } else {
      hint.textContent = "All four confirmed · ready for wildcard bidding.";
    }
  }

  function resetMineBeforeEdit() {
    ensureState();
    const active = state.activePerson;
    if (state.roundOneConfirmed[active]) {
      state.roundOneConfirmed[active] = false;
    }
  }

  // Any change to a person's picks or wildcard choices means their
  // previous confirmation no longer represents the current round.
  section.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      target.closest(".save-picks") ||
      target.closest("#addWildcardBtn") ||
      target.closest(".chip-remove")
    ) {
      resetMineBeforeEdit();
    }
  }, true);

  // Belt-and-braces gate: the core button handler must not advance
  // unless every person has explicitly confirmed.
  startBtn.addEventListener("click", event => {
    if (!picksComplete() || !enoughWildcards() || !allConfirmed()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderPanel();
    }
  }, true);

  const baseRenderNominations = renderNominations;
  renderNominations = function () {
    baseRenderNominations();
    renderPanel();
  };

  document.getElementById("activePerson")?.addEventListener("change", renderPanel);

  const observer = new MutationObserver(() => {
    if (state.phase === "nominations") {
      requestAnimationFrame(renderPanel);
    }
  });
  observer.observe(section, { childList: true, subtree: false });

  const style = document.createElement("style");
  style.textContent = `
    .round-one-confirm-panel {
      margin: 20px 0 4px;
      padding: 16px;
      border: 1px solid rgba(19,34,56,.12);
      border-radius: 16px;
      background: #f7f4ed;
    }

    .round-one-confirm-copy > span {
      display: block;
      color: #8f4b32;
      font-size: .62rem;
      font-weight: 900;
      letter-spacing: .09em;
    }

    .round-one-confirm-copy > strong {
      display: block;
      margin-top: 4px;
      color: #132238;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.15rem;
    }

    .round-one-confirm-copy > p {
      margin: 5px 0 0;
      color: #657180;
      font-size: .76rem;
      line-height: 1.4;
    }

    .round-one-confirm-people {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 14px;
    }

    .round-one-confirm-person {
      display: grid;
      grid-template-columns: 26px 1fr;
      grid-template-areas:
        "dot name"
        "dot status";
      align-items: center;
      min-width: 0;
      padding: 9px;
      border-radius: 11px;
      background: #fff;
      border: 1px solid rgba(19,34,56,.08);
    }

    .confirm-dot {
      grid-area: dot;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #e4e7eb;
      color: #fff;
      font-size: .72rem;
      font-weight: 900;
    }

    .round-one-confirm-person.confirmed .confirm-dot {
      background: #3d7850;
    }

    .round-one-confirm-person strong {
      grid-area: name;
      min-width: 0;
      color: #25364d;
      font-size: .75rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .round-one-confirm-person small {
      grid-area: status;
      color: #8a94a1;
      font-size: .62rem;
    }

    .round-one-confirm-person.confirmed small {
      color: #3d7850;
      font-weight: 800;
    }

    .round-one-confirm-mine {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 13px;
    }

    .confirm-round-one-btn {
      min-height: 44px;
    }

    .round-one-confirm-status {
      color: #657180;
      font-size: .72rem;
      font-weight: 800;
    }

    @media (max-width: 760px) {
      .round-one-confirm-panel {
        margin-top: 16px;
        padding: 13px;
      }

      .round-one-confirm-people {
        grid-template-columns: repeat(2, 1fr);
      }

      .round-one-confirm-mine {
        align-items: stretch;
        flex-direction: column;
      }

      .confirm-round-one-btn {
        width: 100%;
      }

      .round-one-confirm-status {
        text-align: center;
      }
    }
  `;

  document.head.appendChild(style);
  ensureState();
  renderPanel();
})();
