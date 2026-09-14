// Load the movie synopsis enhancements after the core app is available.
const synopsisScript = document.createElement("script");
synopsisScript.src = "synopsis.js";
document.head.appendChild(synopsisScript);

const selectionSynopsisScript = document.createElement("script");
selectionSynopsisScript.src = "selection-synopsis.js";
document.head.appendChild(selectionSynopsisScript);

// =====================================================
// WINTER FILM CLUB — BIDDING RULES
// You cannot spend tokens on a wildcard you proposed.
// =====================================================

(() => {
  // Ignore proposer self-bids everywhere totals are calculated.
  bidsUsed = function (person) {
    return state.wildcards.reduce((sum, wildcard) => {
      if (wildcard.proposer === person) {
        return sum;
      }

      return sum + Number(wildcard.bids?.[person] || 0);
    }, 0);
  };

  wildcardTotal = function (wildcard) {
    return PEOPLE.reduce((sum, person) => {
      if (person === wildcard.proposer) {
        return sum;
      }

      return sum + Number(wildcard.bids?.[person] || 0);
    }, 0);
  };

  const baseRenderBidding = renderBidding;

  renderBidding = function () {
    // Clean any old test votes that may already exist on a person's
    // own wildcard. They are also ignored by the totals above.
    state.wildcards.forEach(wildcard => {
      if (wildcard.bids && wildcard.proposer) {
        wildcard.bids[wildcard.proposer] = 0;
      }
    });

    baseRenderBidding();

    // Match the cards to the same ordering used by renderBidding().
    const orderedWildcards = [...state.wildcards].sort(
      (a, b) => wildcardTotal(b) - wildcardTotal(a)
    );

    const cards = [
      ...document.querySelectorAll("#biddingGrid .bid-card")
    ];

    cards.forEach((card, index) => {
      const wildcard = orderedWildcards[index];

      if (!wildcard || wildcard.proposer !== state.activePerson) {
        return;
      }

      card.classList.add("own-wildcard");

      const controls = card.querySelector(".bid-controls");

      if (controls) {
        controls.innerHTML = `
          <div class="own-wildcard-note">
            <strong>Your wildcard</strong>
            <span>You can’t spend tokens on your own suggestion.</span>
          </div>
        `;
      }
    });
  };

  const biddingNote = document.querySelector(
    "#biddingSection .section-note.wide"
  );

  if (biddingNote) {
    biddingNote.textContent =
      "Put all five tokens on one film or spread them around. " +
      "You can’t bid on a wildcard you suggested yourself. " +
      "When everyone has used their tokens, the top two complete the winter ten.";
  }

  const style = document.createElement("style");
  style.textContent = `
    .bid-card.own-wildcard {
      background: #f8f6f0;
    }

    .bid-card.own-wildcard .bid-total {
      opacity: .72;
    }

    .own-wildcard-note {
      width: 100%;
      padding: 9px 11px;
      border-radius: 12px;
      background: #ebe5d8;
      color: #596474;
      text-align: left;
    }

    .own-wildcard-note strong,
    .own-wildcard-note span {
      display: block;
    }

    .own-wildcard-note strong {
      color: #30445f;
      font-size: .8rem;
    }

    .own-wildcard-note span {
      margin-top: 2px;
      font-size: .72rem;
      line-height: 1.35;
    }

    @media (max-width: 760px) {
      .own-wildcard-note {
        min-height: 44px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    }
  `;

  document.head.appendChild(style);

  // If the page was restored directly into the bidding phase, redraw it
  // immediately using the new rule.
  if (state.phase === "bidding") {
    renderBidding();
  }
})();