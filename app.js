// =====================================================
// WINTER FILM CLUB
// Steph · Elliot · Dan · Wendy
// =====================================================


// -----------------------------------------------------
// BASIC SETTINGS
// -----------------------------------------------------

const PEOPLE = [
  "Steph",
  "Elliot",
  "Dan",
  "Wendy"
];

const TOKENS_PER_PERSON = 5;

const CLUB_ID = "main";

const PERSON_KEY =
  "winter-film-club-person";


// -----------------------------------------------------
// SUPABASE
// -----------------------------------------------------

const SUPABASE_URL =
  "https://hdbpyemnyvzaevrsjfqu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_LVfjHTKeB2pP2ibkTq2HhA_MgCcdAI-";


const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// -----------------------------------------------------
// DEFAULT STATE
// -----------------------------------------------------

function defaultState() {

  return {

    phase: "nominations",

    activePerson: "Dan",

    nominations: Object.fromEntries(
      PEOPLE.map(person => [
        person,
        ["", ""]
      ])
    ),

    wildcards: [],

    finalMovies: []

  };

}


let state = {

  ...defaultState(),

  activePerson:
    localStorage.getItem(PERSON_KEY) ||
    "Dan"

};


// -----------------------------------------------------
// GENERAL HELPERS
// -----------------------------------------------------

const el = id =>
  document.getElementById(id);


const uid = () =>
  Math.random()
    .toString(36)
    .slice(2, 10);


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// -----------------------------------------------------
// DATABASE STATE
// -----------------------------------------------------

function sharedState() {

  const {
    activePerson,
    ...shared
  } = state;

  return shared;

}


function applyRemoteState(remoteData) {

  const currentPerson =
    state.activePerson ||
    localStorage.getItem(PERSON_KEY) ||
    "Dan";


  state = {

    ...defaultState(),

    ...(remoteData || {}),

    activePerson:
      currentPerson

  };

}


async function loadState() {

  const {
    data,
    error
  } = await db
    .from("club_state")
    .select("data")
    .eq("id", CLUB_ID)
    .single();


  if (error) {

    console.error(
      "Could not load film club:",
      error
    );

    throw error;

  }


  applyRemoteState(
    data.data
  );

}


async function saveState() {

  const {
    error
  } = await db
    .from("club_state")
    .update({

      data:
        sharedState(),

      updated_at:
        new Date().toISOString()

    })
    .eq("id", CLUB_ID);


  if (error) {

    console.error(
      "Could not save film club:",
      error
    );

    alert(
      "The film club could not be saved. Please try again."
    );

    return false;

  }


  return true;

}


// -----------------------------------------------------
// PERSON SELECTOR
// -----------------------------------------------------

function setupPeople() {

  const select =
    el("activePerson");


  select.innerHTML =
    PEOPLE
      .map(
        person =>
          `<option value="${person}">${person}</option>`
      )
      .join("");


  select.value =
    state.activePerson;


  select.addEventListener(
    "change",
    event => {

      state.activePerson =
        event.target.value;


      localStorage.setItem(
        PERSON_KEY,
        state.activePerson
      );


      render();

    }
  );

}


// -----------------------------------------------------
// PHASES
// -----------------------------------------------------

async function setPhase(phase) {

  state.phase =
    phase;


  await saveState();


  render();


  window.scrollTo({

    top: 0,

    behavior: "smooth"

  });

}


function renderPhases() {

  const ordering = [
    "nominations",
    "bidding",
    "watching",
    "reviewing"
  ];


  const currentIndex =
    state.phase === "watching"
      ? 2
      : ordering.indexOf(
          state.phase
        );


  document
    .querySelectorAll(".phase")
    .forEach(
      (node, index) => {

        node.classList.toggle(

          "active",

          index === currentIndex ||

          (
            state.phase === "watching" &&
            index === 3 &&
            state.finalMovies.some(
              isUnlocked
            )
          )

        );


        node.classList.toggle(

          "complete",

          index < currentIndex

        );

      }
    );

}


function renderVisibility() {

  el(
    "nominationsSection"
  ).classList.toggle(

    "hidden",

    state.phase !==
      "nominations"

  );


  el(
    "biddingSection"
  ).classList.toggle(

    "hidden",

    state.phase !==
      "bidding"

  );


  const watching =
    state.phase ===
    "watching";


  el(
    "watchingSection"
  ).classList.toggle(

    "hidden",

    !watching

  );


  el(
    "finalTableSection"
  ).classList.toggle(

    "hidden",

    !watching

  );

}


// -----------------------------------------------------
// NOMINATIONS
// -----------------------------------------------------

function renderNominations() {

  const grid =
    el("nominationGrid");


  grid.innerHTML = "";


  const template =
    el(
      "nominationCardTemplate"
    );


  PEOPLE.forEach(
    person => {

      const card =
        template.content
          .firstElementChild
          .cloneNode(true);


      card.querySelector(
        "h3"
      ).textContent =
        person;


      const [
        pick1,
        pick2
      ] =
        state.nominations[
          person
        ] ||
        ["", ""];


      const input1 =
        card.querySelector(
          ".pick-one"
        );


      const input2 =
        card.querySelector(
          ".pick-two"
        );


      input1.value =
        pick1;


      input2.value =
        pick2;


      if (
        person !==
        state.activePerson
      ) {

        input1.disabled =
          true;

        input2.disabled =
          true;

        card
          .querySelector(
            ".save-picks"
          )
          .disabled =
          true;

      }


      card
        .querySelector(
          ".save-picks"
        )
        .addEventListener(
          "click",
          async () => {

            state.nominations[
              person
            ] = [

              input1.value.trim(),

              input2.value.trim()

            ];


            await saveState();


            renderNominations();

          }
        );


      grid.appendChild(
        card
      );

    }
  );


  renderWildcards();


  const picksComplete =
    PEOPLE.every(
      person =>

        state
          .nominations[
            person
          ]
          .filter(Boolean)
          .length === 2
    );


  const enoughWildcards =
    state.wildcards.length >= 2;


  el(
    "startBiddingBtn"
  ).disabled =
    !(
      picksComplete &&
      enoughWildcards
    );


  let hint = "";


  if (
    !picksComplete
  ) {

    hint =
      "All four people need to save two picks.";

  }

  else if (
    !enoughWildcards
  ) {

    hint =
      "Add at least two wildcard films.";

  }

  else {

    hint =
      "Ready: 8 guaranteed picks + wildcard bidding.";

  }


  el(
    "startBiddingHint"
  ).textContent =
    hint;

}


// -----------------------------------------------------
// WILDCARDS
// -----------------------------------------------------

function renderWildcards() {

  const list =
    el("wildcardList");


  list.innerHTML = "";


  list.classList.toggle(

    "empty-state",

    state.wildcards.length === 0

  );


  state.wildcards.forEach(
    wildcard => {

      const chip =
        document.createElement(
          "div"
        );


      chip.className =
        "wildcard-chip";


      chip.innerHTML = `

        <strong>
          ${escapeHtml(
            wildcard.title
          )}
        </strong>

        <small>
          ${escapeHtml(
            wildcard.proposer
          )}
        </small>

      `;


      if (
        wildcard.proposer ===
        state.activePerson
      ) {

        const remove =
          document.createElement(
            "button"
          );


        remove.type =
          "button";


        remove.setAttribute(

          "aria-label",

          `Remove ${wildcard.title}`

        );


        remove.textContent =
          "×";


        remove.addEventListener(
          "click",
          async () => {

            state.wildcards =
              state.wildcards.filter(
                item =>
                  item.id !==
                  wildcard.id
              );


            await saveState();


            renderNominations();

          }
        );


        chip.appendChild(
          remove
        );

      }


      list.appendChild(
        chip
      );

    }
  );

}


async function addWildcard(title) {

  const clean =
    title.trim();


  if (!clean) {
    return;
  }


  const duplicate = [

    ...state.wildcards.map(
      wildcard =>
        wildcard.title
    ),

    ...Object.values(
      state.nominations
    ).flat()

  ].some(

    existing =>

      existing &&

      existing
        .toLowerCase() ===
      clean
        .toLowerCase()

  );


  if (duplicate) {

    alert(
      "That film is already on the board."
    );

    return;

  }


  state.wildcards.push({

    id:
      uid(),

    title:
      clean,

    proposer:
      state.activePerson,

    bids:
      Object.fromEntries(
        PEOPLE.map(
          person => [
            person,
            0
          ]
        )
      )

  });


  await saveState();


  renderNominations();

}


// -----------------------------------------------------
// BIDDING
// -----------------------------------------------------

function bidsUsed(person) {

  return state.wildcards.reduce(

    (
      sum,
      wildcard
    ) =>

      sum +

      Number(
        wildcard.bids?.[
          person
        ] ||
        0
      ),

    0

  );

}


function wildcardTotal(
  wildcard
) {

  return PEOPLE.reduce(

    (
      sum,
      person
    ) =>

      sum +

      Number(
        wildcard.bids?.[
          person
        ] ||
        0
      ),

    0

  );

}


function topWildcardIds() {

  return [
    ...state.wildcards
  ]

    .sort(
      (
        a,
        b
      ) =>

        wildcardTotal(b) -
        wildcardTotal(a) ||

        a.title.localeCompare(
          b.title
        )
    )

    .slice(
      0,
      2
    )

    .map(
      wildcard =>
        wildcard.id
    );

}


function renderBidding() {

  el(
    "bidPersonName"
  ).textContent =
    state.activePerson;


  const remaining =

    TOKENS_PER_PERSON -

    bidsUsed(
      state.activePerson
    );


  el(
    "tokensRemaining"
  ).textContent =
    remaining;


  const topIds =
    topWildcardIds();


  const grid =
    el("biddingGrid");


  grid.innerHTML = "";


  [
    ...state.wildcards
  ]

    .sort(
      (
        a,
        b
      ) =>

        wildcardTotal(b) -
        wildcardTotal(a)
    )

    .forEach(
      wildcard => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "bid-card" +

          (
            topIds.includes(
              wildcard.id
            )

              ? " top-two"

              : ""
          );


        const mine =
          Number(

            wildcard.bids?.[
              state.activePerson
            ] ||
            0

          );


        const total =
          wildcardTotal(
            wildcard
          );


        card.innerHTML = `

          <div>

            <h3>
              ${escapeHtml(
                wildcard.title
              )}
            </h3>

            <p>

              Suggested by
              ${escapeHtml(
                wildcard.proposer
              )}

              ·

              ${total}

              total
              token${total === 1
                ? ""
                : "s"}

            </p>

          </div>


          <div class="bid-controls">

            <button
              class="minus"
              type="button"
              aria-label="Remove token"
            >
              −
            </button>


            <strong>
              ${mine}
            </strong>


            <button
              class="plus"
              type="button"
              aria-label="Add token"
            >
              +
            </button>

          </div>

        `;


        card.querySelector(
          ".minus"
        ).disabled =
          mine <= 0;


        card.querySelector(
          ".plus"
        ).disabled =
          remaining <= 0;


        card.querySelector(
          ".minus"
        ).addEventListener(
          "click",
          async () => {

            wildcard.bids[
              state.activePerson
            ] =
              Math.max(
                0,
                mine - 1
              );


            await saveState();


            renderBidding();

          }
        );


        card.querySelector(
          ".plus"
        ).addEventListener(
          "click",
          async () => {

            if (

              bidsUsed(
                state.activePerson
              ) >=
              TOKENS_PER_PERSON

            ) {
              return;
            }


            wildcard.bids[
              state.activePerson
            ] =
              mine + 1;


            await saveState();


            renderBidding();

          }
        );


        grid.appendChild(
          card
        );

      }
    );


  const allSpent =
    PEOPLE.every(

      person =>

        bidsUsed(
          person
        ) ===
        TOKENS_PER_PERSON

    );


  el(
    "lockFinalBtn"
  ).disabled =
    !(
      allSpent &&
      state.wildcards.length >= 2
    );


  el(
    "lockFinalBtn"
  ).textContent =

    allSpent

      ? "Lock the final 10"

      : "Waiting for everyone to bid";

}


// -----------------------------------------------------
// FINAL TEN
// -----------------------------------------------------

function makeMovie(
  title,
  source,
  note,
  picker
) {

  return {

    id:
      uid(),

    title,

    source,

    note,

    picker,


    watched:
      Object.fromEntries(
        PEOPLE.map(
          person => [
            person,
            false
          ]
        )
      ),


    ratings:
      Object.fromEntries(
        PEOPLE.map(
          person => [
            person,
            ""
          ]
        )
      ),


    reviews:
      Object.fromEntries(
        PEOPLE.map(
          person => [
            person,
            ""
          ]
        )
      )

  };

}


function buildFinalMovies() {

  const guaranteed =
    [];


  PEOPLE.forEach(
    person => {

      (
        state.nominations[
          person
        ] ||
        []
      ).forEach(
        (
          title,
          index
        ) => {

          guaranteed.push(

            makeMovie(

              title,

              "guaranteed",

              `${person}'s pick ${index + 1}`,

              person

            )

          );

        }
      );

    }
  );


  const winningWildcards =

    [
      ...state.wildcards
    ]

      .sort(
        (
          a,
          b
        ) =>

          wildcardTotal(b) -
          wildcardTotal(a) ||

          a.title.localeCompare(
            b.title
          )
      )

      .slice(
        0,
        2
      )

      .map(
        wildcard =>

          makeMovie(

            wildcard.title,

            "wildcard",

            `Wildcard · ${wildcardTotal(
              wildcard
            )} tokens`,

            wildcard.proposer

          )
      );


  state.finalMovies = [

    ...guaranteed,

    ...winningWildcards

  ];

}


// -----------------------------------------------------
// WATCHING
// -----------------------------------------------------

function isUnlocked(
  movie
) {

  return PEOPLE.every(

    person =>
      movie.watched?.[
        person
      ]

  );

}


function renderMovies() {

  const grid =
    el("movieGrid");


  grid.innerHTML = "";


  const template =
    el(
      "movieCardTemplate"
    );


  state.finalMovies.forEach(

    (
      movie,
      index
    ) => {

      const card =
        template.content
          .firstElementChild
          .cloneNode(true);


      card.querySelector(
        ".movie-number"
      ).textContent =

        String(
          index + 1
        ).padStart(
          2,
          "0"
        );


      card.querySelector(
        ".movie-title"
      ).textContent =
        movie.title;


      card.querySelector(
        ".source-pill"
      ).textContent =

        movie.source ===
          "wildcard"

          ? "Wildcard winner"

          : "Guaranteed pick";


      card.querySelector(
        ".picked-by"
      ).textContent =
        movie.note;


      const watchedTotal =

        PEOPLE.filter(
          person =>
            movie.watched?.[
              person
            ]
        ).length;


      card.querySelector(
        ".watched-count"
      ).textContent =

        `${watchedTotal}/4 watched`;



      // WATCHERS

      const watchers =
        card.querySelector(
          ".watchers"
        );


      PEOPLE.forEach(
        person => {

          const pill =
            document.createElement(
              "span"
            );


          pill.className =

            "watcher" +

            (
              movie.watched?.[
                person
              ]

                ? " done"

                : ""
            );


          pill.textContent =
            person;


          watchers.appendChild(
            pill
          );

        }
      );



      // WATCHED BUTTON

      const watchedButton =
        card.querySelector(
          ".watched-toggle"
        );


      const alreadyWatched =
        !!movie.watched?.[
          state.activePerson
        ];


      watchedButton.textContent =

        alreadyWatched

          ? `✓ ${state.activePerson} watched it`

          : `${state.activePerson}: mark as watched`;


      watchedButton.addEventListener(
        "click",
        async () => {

          movie.watched[
            state.activePerson
          ] =
            !alreadyWatched;


          await saveState();


          renderMovies();

          renderRanking();

          renderPhases();

        }
      );



      // REVIEWS

      const unlocked =
        isUnlocked(
          movie
        );


      card.querySelector(
        ".review-lock"
      ).classList.toggle(

        "hidden",

        unlocked

      );


      const reviewPanel =
        card.querySelector(
          ".review-panel"
        );


      reviewPanel.classList.toggle(

        "hidden",

        !unlocked

      );


      if (
        unlocked
      ) {

        const score =
          card.querySelector(
            ".score-select"
          );


        const review =
          card.querySelector(
            ".review-text"
          );


        score.value =

          movie.ratings?.[
            state.activePerson
          ] ||
          "";


        review.value =

          movie.reviews?.[
            state.activePerson
          ] ||
          "";


        card.querySelector(
          ".save-review"
        ).addEventListener(
          "click",
          async () => {

            movie.ratings[
              state.activePerson
            ] =
              score.value;


            movie.reviews[
              state.activePerson
            ] =
              review.value.trim();


            await saveState();


            renderMovies();

            renderRanking();

          }
        );



        const numericRatings =

          PEOPLE

            .map(
              person =>
                Number(
                  movie.ratings?.[
                    person
                  ]
                )
            )

            .filter(
              Boolean
            );


        const groupScore =
          card.querySelector(
            ".group-score"
          );


        if (
          numericRatings.length
        ) {

          const average =

            numericRatings.reduce(
              (
                a,
                b
              ) =>
                a + b,
              0
            ) /
            numericRatings.length;


          groupScore.textContent =

            `Group score: ${average.toFixed(
              1
            )}/10 · ${numericRatings.length}/4 scored`;

        }

        else {

          groupScore.textContent =
            "No scores yet.";

        }



        const reviewList =
          card.querySelector(
            ".review-list"
          );


        reviewList.innerHTML =
          "";


        PEOPLE.forEach(
          person => {

            const text =
              movie.reviews?.[
                person
              ];


            const rating =
              movie.ratings?.[
                person
              ];


            if (
              !text &&
              !rating
            ) {
              return;
            }


            const entry =
              document.createElement(
                "div"
              );


            entry.className =
              "review-entry";


            entry.innerHTML = `

              <strong>

                ${escapeHtml(
                  person
                )}

                ${
                  rating
                    ? ` · ${escapeHtml(
                        rating
                      )}/10`
                    : ""
                }

              </strong>

              ${
                text
                  ? escapeHtml(
                      text
                    )
                  : "No written review."
              }

            `;


            reviewList.appendChild(
              entry
            );

          }
        );

      }


      grid.appendChild(
        card
      );

    }
  );


  el(
    "fullyWatchedCount"
  ).textContent =

    state.finalMovies.filter(
      isUnlocked
    ).length;

}


// -----------------------------------------------------
// RANKINGS
// -----------------------------------------------------

function averageRating(
  movie
) {

  const ratings =

    PEOPLE

      .map(
        person =>
          Number(
            movie.ratings?.[
              person
            ]
          )
      )

      .filter(
        Boolean
      );


  if (
    !ratings.length
  ) {

    return 0;

  }


  return (

    ratings.reduce(
      (
        a,
        b
      ) =>
        a + b,
      0
    ) /
    ratings.length

  );

}


function renderRanking() {

  const box =
    el("rankingTable");


  box.innerHTML = "";


  const sorted = [

    ...state.finalMovies

  ].sort(

    (
      a,
      b
    ) =>

      averageRating(b) -
      averageRating(a)

  );


  sorted.forEach(
    (
      movie,
      index
    ) => {

      const rated =

        PEOPLE.filter(
          person =>
            Number(
              movie.ratings?.[
                person
              ]
            )
        ).length;


      const average =
        averageRating(
          movie
        );


      const watched =

        PEOPLE.filter(
          person =>
            movie.watched?.[
              person
            ]
        ).length;


      const row =
        document.createElement(
          "div"
        );


      row.className =
        "ranking-row";


      row.innerHTML = `

        <div class="rank-number">

          ${index + 1}

        </div>


        <div class="rank-title">

          <strong>

            ${escapeHtml(
              movie.title
            )}

          </strong>

          <span>

            ${escapeHtml(
              movie.note
            )}

          </span>

        </div>


        <div class="rank-status">

          ${watched}/4 watched

        </div>


        <div class="rank-score">

          ${
            rated

              ? `${average.toFixed(
                  1
                )}/10`

              : "—"
          }

        </div>

      `;


      box.appendChild(
        row
      );

    }
  );

}


// -----------------------------------------------------
// MAIN RENDER
// -----------------------------------------------------

function render() {

  renderPhases();

  renderVisibility();


  if (
    state.phase ===
    "nominations"
  ) {

    renderNominations();

  }


  if (
    state.phase ===
    "bidding"
  ) {

    renderBidding();

  }


  if (
    state.phase ===
    "watching"
  ) {

    renderMovies();

    renderRanking();

  }

}


// -----------------------------------------------------
// EVENT LISTENERS
// -----------------------------------------------------

el(
  "wildcardForm"
).addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const input =
      el(
        "wildcardTitle"
      );


    await addWildcard(
      input.value
    );


    input.value =
      "";


    input.focus();

  }
);


el(
  "startBiddingBtn"
).addEventListener(
  "click",
  async () => {

    await setPhase(
      "bidding"
    );

  }
);


el(
  "backToNominationsBtn"
).addEventListener(
  "click",
  async () => {

    await setPhase(
      "nominations"
    );

  }
);


el(
  "lockFinalBtn"
).addEventListener(
  "click",
  async () => {

    if (

      !PEOPLE.every(
        person =>
          bidsUsed(
            person
          ) ===
          TOKENS_PER_PERSON
      )

    ) {
      return;
    }


    buildFinalMovies();


    state.phase =
      "watching";


    await saveState();


    render();


    window.scrollTo({

      top: 0,

      behavior: "smooth"

    });

  }
);


el(
  "resetBtn"
).addEventListener(
  "click",
  async () => {

    const confirmed =
      confirm(
        "Reset all picks, bids, watched status and reviews?"
      );


    if (
      !confirmed
    ) {
      return;
    }


    const currentPerson =
      state.activePerson;


    state = {

      ...defaultState(),

      activePerson:
        currentPerson

    };


    await saveState();


    render();

  }
);


// -----------------------------------------------------
// LIVE SUPABASE UPDATES
// -----------------------------------------------------

let realtimeChannel =
  null;


function subscribeToSharedState() {

  // Prevent accidentally creating
  // multiple subscriptions.

  if (
    realtimeChannel
  ) {
    return;
  }


  realtimeChannel =
    db
      .channel(
        "winter-film-club-live"
      )

      .on(
        "postgres_changes",

        {

          event:
            "UPDATE",

          schema:
            "public",

          table:
            "club_state",

          filter:
            `id=eq.${CLUB_ID}`

        },

        payload => {

          if (
            !payload.new?.data
          ) {
            return;
          }


          console.log(
            "Film club received a live update"
          );


          applyRemoteState(
            payload.new.data
          );


          render();

        }
      )

      .subscribe(
        status => {

          console.log(
            "Winter Film Club realtime:",
            status
          );

        }
      );

}


// -----------------------------------------------------
// START APP
// -----------------------------------------------------

async function initialise() {

  setupPeople();


  render();


  try {

    await loadState();


    el(
      "activePerson"
    ).value =
      state.activePerson;


    render();


    // THIS IS THE IMPORTANT ADDITION:
    // start listening for changes made
    // on other phones / browsers.

    subscribeToSharedState();


    console.log(
      "Winter Film Club connected to Supabase"
    );

  }

  catch (
    error
  ) {

    console.error(
      error
    );


    alert(
      "Could not connect to the shared Winter Film Club database."
    );

  }

}


initialise();