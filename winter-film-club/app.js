// =====================================================
// WINTER FILM CLUB
// Steph · Elliot · Dan · Wendy
// =====================================================

const PEOPLE = ["Steph", "Elliot", "Dan", "Wendy"];
const TOKENS_PER_PERSON = 5;
const CLUB_ID = "main";
const PERSON_KEY = "winter-film-club-person";

// -----------------------------------------------------
// CONNECTION DETAILS
// Keep your existing working Supabase values here.
// -----------------------------------------------------

const SUPABASE_URL =
  "https://hdbpyemnyvzaevrsjfqu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_LVfjHTKeB2pP2ibkTq2HhA_MgCcdAI-";


const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// TMDB search/details now go through Supabase.
// Poster images themselves are public.

const TMDB_IMAGE =
  "https://image.tmdb.org/t/p";

const TMDB_PROXY_FUNCTION =
  "tmdb-proxy";


// -----------------------------------------------------
// STATE
// -----------------------------------------------------

function defaultState() {

  return {

    phase:
      "nominations",

    activePerson:
      "Dan",

    nominations:
      Object.fromEntries(
        PEOPLE.map(
          person => [
            person,
            [null, null]
          ]
        )
      ),

    wildcards: [],

    finalMovies: []

  };

}


let state = {

  ...defaultState(),

  activePerson:
    localStorage.getItem(
      PERSON_KEY
    ) ||
    "Dan"

};


let pendingWildcardMovie =
  null;

let realtimeChannel =
  null;

let wildcardPickerReady =
  false;


const el =
  id =>
    document.getElementById(
      id
    );


const uid =
  () =>
    Math.random()
      .toString(36)
      .slice(2, 10);


// -----------------------------------------------------
// GENERAL HELPERS
// -----------------------------------------------------

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function debounce(
  fn,
  wait = 350
) {

  let timer;


  return (
    ...args
  ) => {

    clearTimeout(
      timer
    );


    timer =
      setTimeout(
        () =>
          fn(
            ...args
          ),
        wait
      );

  };

}


function posterUrl(
  path,
  size = "w342"
) {

  return path

    ? `${TMDB_IMAGE}/${size}${path}`

    : "";

}


function movieLabel(
  movie
) {

  if (
    !movie
  ) {

    return "";

  }


  const bits =
    [];


  if (
    movie.year
  ) {

    bits.push(
      movie.year
    );

  }


  if (
    movie.runtime
  ) {

    bits.push(
      `${movie.runtime} min`
    );

  }


  return bits.join(
    " · "
  );

}


// -----------------------------------------------------
// MOVIE NORMALISATION
// Keeps compatibility with the original text-only version
// -----------------------------------------------------

function normalizeMovie(
  value
) {

  if (
    !value
  ) {

    return null;

  }


  if (
    typeof value ===
    "string"
  ) {

    const title =
      value.trim();


    if (
      !title
    ) {

      return null;

    }


    return {

      tmdbId:
        null,

      title,

      year:
        "",

      posterPath:
        null,

      runtime:
        null,

      overview:
        ""

    };

  }


  const title =
    String(
      value.title ||
      ""
    ).trim();


  if (
    !title
  ) {

    return null;

  }


  return {

    tmdbId:
      value.tmdbId ??
      value.id ??
      null,

    title,

    year:
      value.year ||
      "",

    posterPath:
      value.posterPath ||
      value.poster_path ||
      null,

    runtime:
      value.runtime ||
      null,

    overview:
      value.overview ||
      ""

  };

}


function wildcardMovie(
  wildcard
) {

  return normalizeMovie(

    wildcard?.movie ||

    (
      wildcard?.title

        ? {

            title:
              wildcard.title,

            tmdbId:
              wildcard.tmdbId,

            year:
              wildcard.year,

            posterPath:
              wildcard.posterPath,

            runtime:
              wildcard.runtime,

            overview:
              wildcard.overview

          }

        : null
    )

  );

}


function sameMovie(
  a,
  b
) {

  const first =
    normalizeMovie(
      a
    );


  const second =
    normalizeMovie(
      b
    );


  if (
    !first ||
    !second
  ) {

    return false;

  }


  if (
    first.tmdbId &&
    second.tmdbId
  ) {

    return (

      String(
        first.tmdbId
      )

      ===

      String(
        second.tmdbId
      )

    );

  }


  return (

    first.title
      .toLowerCase()

    ===

    second.title
      .toLowerCase()

    &&

    String(
      first.year ||
      ""
    )

    ===

    String(
      second.year ||
      ""
    )

  );

}


// -----------------------------------------------------
// SUPABASE SHARED STATE
// -----------------------------------------------------

function sharedState() {

  const {
    activePerson,
    ...shared
  } = state;


  return shared;

}


function applyRemoteState(
  remoteData
) {

  const currentPerson =

    state.activePerson ||

    localStorage.getItem(
      PERSON_KEY
    ) ||

    "Dan";


  state = {

    ...defaultState(),

    ...(remoteData || {}),

    activePerson:
      currentPerson

  };


  state.nominations = {

    ...defaultState()
      .nominations,

    ...(state.nominations || {})

  };


  state.wildcards =

    Array.isArray(
      state.wildcards
    )

      ? state.wildcards

      : [];


  state.finalMovies =

    Array.isArray(
      state.finalMovies
    )

      ? state.finalMovies

      : [];

}


async function loadState() {

  const {
    data,
    error
  } = await db

    .from(
      "club_state"
    )

    .select(
      "data"
    )

    .eq(
      "id",
      CLUB_ID
    )

    .single();


  if (
    error
  ) {

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

    .from(
      "club_state"
    )

    .update({

      data:
        sharedState(),

      updated_at:
        new Date()
          .toISOString()

    })

    .eq(
      "id",
      CLUB_ID
    );


  if (
    error
  ) {

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
// TMDB VIA SUPABASE EDGE FUNCTION
// -----------------------------------------------------

async function callTmdbProxy(
  body
) {

  const {
    data,
    error
  } = await db.functions.invoke(

    TMDB_PROXY_FUNCTION,

    {
      body
    }

  );


  if (
    error
  ) {

    console.error(
      "TMDB proxy invoke error:",
      error
    );


    throw new Error(
      error.message ||
      "TMDB proxy request failed."
    );

  }


  if (
    data?.error
  ) {

    throw new Error(
      data.error
    );

  }


  return data;

}


async function searchMovies(
  query
) {

  const q =
    query.trim();


  if (
    q.length <
    2
  ) {

    return [];

  }


  const data =

    await callTmdbProxy({

      action:
        "search",

      query:
        q

    });


  return (

    data?.results ||
    []

  ).slice(
    0,
    7
  );

}


async function movieFromSearchResult(
  result
) {

  let details =
    null;


  try {

    details =

      await callTmdbProxy({

        action:
          "details",

        id:
          result.id

      });

  }

  catch (
    error
  ) {

    console.warn(
      "Could not load extra movie details:",
      error
    );

  }


  const releaseDate =

    details?.release_date ||

    result.release_date ||

    "";


  return {

    tmdbId:
      result.id,

    title:
      details?.title ||
      result.title ||
      result.original_title ||
      "Untitled",

    year:
      releaseDate

        ? releaseDate.slice(
            0,
            4
          )

        : "",

    posterPath:
      details?.poster_path ||
      result.poster_path ||
      null,

    runtime:
      details?.runtime ||
      null,

    overview:
      details?.overview ||
      result.overview ||
      ""

  };

}


// -----------------------------------------------------
// SEARCH RESULTS
// -----------------------------------------------------

function renderSearchResults(
  container,
  results,
  onChoose
) {

  const box =
    container.querySelector(
      ".movie-search-results"
    );


  box.innerHTML =
    "";


  if (
    !results.length
  ) {

    box.innerHTML = `

      <div class="search-message">

        No matching films found.

      </div>

    `;


    box.classList.remove(
      "hidden"
    );


    return;

  }


  results.forEach(
    result => {

      const year =

        result.release_date

          ? result.release_date
              .slice(
                0,
                4
              )

          : "Year unknown";


      const row =
        document.createElement(
          "button"
        );


      row.type =
        "button";


      row.className =
        "search-result";


      const image =

        result.poster_path

          ? `

            <img

              src="${posterUrl(
                result.poster_path,
                "w92"
              )}"

              alt=""

            />

          `

          : `

            <div class="result-no-poster">

              FILM

            </div>

          `;


      row.innerHTML = `

        ${image}

        <span class="search-result-copy">

          <strong>

            ${escapeHtml(
              result.title ||
              result.original_title
            )}

          </strong>

          <small>

            ${escapeHtml(
              year
            )}

          </small>

        </span>

      `;


      row.addEventListener(
        "click",
        async () => {

          box.innerHTML = `

            <div class="search-message">

              Adding film…

            </div>

          `;


          try {

            const movie =

              await movieFromSearchResult(
                result
              );


            box.classList.add(
              "hidden"
            );


            box.innerHTML =
              "";


            onChoose(
              movie
            );

          }

          catch (
            error
          ) {

            console.error(
              error
            );


            box.innerHTML = `

              <div class="search-message error">

                Could not load that film.

              </div>

            `;

          }

        }
      );


      box.appendChild(
        row
      );

    }
  );


  box.classList.remove(
    "hidden"
  );

}


// -----------------------------------------------------
// GUARANTEED PICK SEARCH BOXES
// -----------------------------------------------------

function configureMoviePicker(

  container,

  initialMovie,

  options = {}

) {

  const {

    editable =
      true,

    onChange =
      () => {}

  } = options;


  const input =
    container.querySelector(
      ".movie-search-input"
    );


  const resultsBox =
    container.querySelector(
      ".movie-search-results"
    );


  const chosen =
    container.querySelector(
      ".chosen-movie"
    );


  const chosenPoster =
    container.querySelector(
      ".chosen-poster"
    );


  const chosenNoPoster =
    container.querySelector(
      ".chosen-no-poster"
    );


  const chosenTitle =
    container.querySelector(
      ".chosen-title"
    );


  const chosenMeta =
    container.querySelector(
      ".chosen-meta"
    );


  const changeBtn =
    container.querySelector(
      ".change-movie"
    );


  let selectedMovie =
    normalizeMovie(
      initialMovie
    );


  function showSelected() {

    if (
      !selectedMovie
    ) {

      chosen.classList.add(
        "hidden"
      );


      input.classList.remove(
        "hidden"
      );


      input.disabled =
        !editable;


      return;

    }


    chosenTitle.textContent =
      selectedMovie.title;


    chosenMeta.textContent =

      movieLabel(
        selectedMovie
      ) ||

      "Selected film";


    if (
      selectedMovie.posterPath
    ) {

      chosenPoster.src =

        posterUrl(
          selectedMovie.posterPath,
          "w154"
        );


      chosenPoster.alt =

        `${selectedMovie.title} poster`;


      chosenPoster.classList.remove(
        "hidden"
      );


      chosenNoPoster.classList.add(
        "hidden"
      );

    }

    else {

      chosenPoster.removeAttribute(
        "src"
      );


      chosenPoster.classList.add(
        "hidden"
      );


      chosenNoPoster.classList.remove(
        "hidden"
      );

    }


    chosen.classList.remove(
      "hidden"
    );


    input.classList.add(
      "hidden"
    );


    resultsBox.classList.add(
      "hidden"
    );


    changeBtn.classList.toggle(

      "hidden",

      !editable

    );

  }


  const doSearch =

    debounce(

      async () => {

        const query =
          input.value.trim();


        if (
          query.length <
          2
        ) {

          resultsBox.classList.add(
            "hidden"
          );


          resultsBox.innerHTML =
            "";


          return;

        }


        resultsBox.innerHTML = `

          <div class="search-message">

            Searching TMDB…

          </div>

        `;


        resultsBox.classList.remove(
          "hidden"
        );


        try {

          const results =

            await searchMovies(
              query
            );


          renderSearchResults(

            container,

            results,

            movie => {

              selectedMovie =
                movie;


              onChange(
                movie
              );


              input.value =
                "";


              showSelected();

            }

          );

        }

        catch (
          error
        ) {

          console.error(
            "TMDB search error:",
            error
          );


          resultsBox.innerHTML = `

            <div class="search-message error">

              Could not search films.
              Check the tmdb-proxy function.

            </div>

          `;

        }

      },

      350

    );


  input.addEventListener(
    "input",
    doSearch
  );


  changeBtn.addEventListener(
    "click",
    () => {

      if (
        !editable
      ) {

        return;

      }


      selectedMovie =
        null;


      onChange(
        null
      );


      chosen.classList.add(
        "hidden"
      );


      input.classList.remove(
        "hidden"
      );


      input.disabled =
        false;


      input.value =
        "";


      input.focus();

    }
  );


  showSelected();

}


// -----------------------------------------------------
// WILDCARD SEARCH BOX
// -----------------------------------------------------

function setupWildcardPicker() {

  if (
    wildcardPickerReady
  ) {

    return;

  }


  wildcardPickerReady =
    true;


  const picker =
    el(
      "wildcardPicker"
    );


  const input =
    picker.querySelector(
      ".movie-search-input"
    );


  const resultsBox =
    picker.querySelector(
      ".movie-search-results"
    );


  const chosen =
    picker.querySelector(
      ".chosen-movie"
    );


  const chosenPoster =
    picker.querySelector(
      ".chosen-poster"
    );


  const chosenNoPoster =
    picker.querySelector(
      ".chosen-no-poster"
    );


  const chosenTitle =
    picker.querySelector(
      ".chosen-title"
    );


  const chosenMeta =
    picker.querySelector(
      ".chosen-meta"
    );


  const changeBtn =
    picker.querySelector(
      ".change-movie"
    );


  const addBtn =
    el(
      "addWildcardBtn"
    );


  function clearPicker() {

    pendingWildcardMovie =
      null;


    input.value =
      "";


    input.classList.remove(
      "hidden"
    );


    chosen.classList.add(
      "hidden"
    );


    resultsBox.classList.add(
      "hidden"
    );


    resultsBox.innerHTML =
      "";


    addBtn.disabled =
      true;

  }


  function showMovie(
    movie
  ) {

    pendingWildcardMovie =
      movie;


    chosenTitle.textContent =
      movie.title;


    chosenMeta.textContent =

      movieLabel(
        movie
      ) ||

      "Selected film";


    if (
      movie.posterPath
    ) {

      chosenPoster.src =

        posterUrl(
          movie.posterPath,
          "w154"
        );


      chosenPoster.alt =

        `${movie.title} poster`;


      chosenPoster.classList.remove(
        "hidden"
      );


      chosenNoPoster.classList.add(
        "hidden"
      );

    }

    else {

      chosenPoster.removeAttribute(
        "src"
      );


      chosenPoster.classList.add(
        "hidden"
      );


      chosenNoPoster.classList.remove(
        "hidden"
      );

    }


    chosen.classList.remove(
      "hidden"
    );


    input.classList.add(
      "hidden"
    );


    resultsBox.classList.add(
      "hidden"
    );


    addBtn.disabled =
      false;

  }


  const doSearch =

    debounce(

      async () => {

        const query =
          input.value.trim();


        if (
          query.length <
          2
        ) {

          resultsBox.classList.add(
            "hidden"
          );


          resultsBox.innerHTML =
            "";


          return;

        }


        resultsBox.innerHTML = `

          <div class="search-message">

            Searching TMDB…

          </div>

        `;


        resultsBox.classList.remove(
          "hidden"
        );


        try {

          const results =

            await searchMovies(
              query
            );


          renderSearchResults(

            picker,

            results,

            showMovie

          );

        }

        catch (
          error
        ) {

          console.error(
            "TMDB wildcard search error:",
            error
          );


          resultsBox.innerHTML = `

            <div class="search-message error">

              Could not search films.
              Check the tmdb-proxy function.

            </div>

          `;

        }

      },

      350

    );


  input.addEventListener(
    "input",
    doSearch
  );


  changeBtn.addEventListener(
    "click",
    () => {

      clearPicker();

      input.focus();

    }
  );


  addBtn.addEventListener(
    "click",
    async () => {

      if (
        !pendingWildcardMovie
      ) {

        return;

      }


      const added =

        await addWildcard(
          pendingWildcardMovie
        );


      if (
        added
      ) {

        clearPicker();

      }

    }
  );

}


// -----------------------------------------------------
// PERSON SELECTOR
// -----------------------------------------------------

function setupPeople() {

  const select =
    el(
      "activePerson"
    );


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

async function setPhase(
  phase
) {

  state.phase =
    phase;


  await saveState();


  render();


  window.scrollTo({

    top: 0,

    behavior:
      "smooth"

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

    state.phase ===
      "watching"

      ? 2

      : ordering.indexOf(
          state.phase
        );


  document
    .querySelectorAll(
      ".phase"
    )
    .forEach(
      (
        node,
        index
      ) => {

        node.classList.toggle(

          "active",

          index ===
            currentIndex

          ||

          (
            state.phase ===
              "watching"

            &&

            index ===
              3

            &&

            state.finalMovies.some(
              isUnlocked
            )
          )

        );


        node.classList.toggle(

          "complete",

          index <
            currentIndex

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
    el(
      "nominationGrid"
    );


  grid.innerHTML =
    "";


  const template =
    el(
      "nominationCardTemplate"
    );


  PEOPLE.forEach(
    person => {

      const card =

        template.content

          .firstElementChild

          .cloneNode(
            true
          );


      card.querySelector(
        "h3"
      ).textContent =
        person;


      const picks =

        state.nominations[
          person
        ] ||

        [null, null];


      const localPicks = [

        normalizeMovie(
          picks[0]
        ),

        normalizeMovie(
          picks[1]
        )

      ];


      const editable =

        person ===
          state.activePerson;


      card
        .querySelectorAll(
          ".pick-block"
        )
        .forEach(
          (
            block,
            index
          ) => {

            configureMoviePicker(

              block,

              localPicks[
                index
              ],

              {

                editable,

                onChange:
                  movie => {

                    localPicks[
                      index
                    ] =
                      movie;

                  }

              }

            );

          }
        );


      const saveBtn =

        card.querySelector(
          ".save-picks"
        );


      saveBtn.disabled =
        !editable;


      saveBtn.addEventListener(
        "click",
        async () => {

          const chosen =

            localPicks.filter(
              Boolean
            );


          if (

            chosen.length ===
              2

            &&

            sameMovie(
              chosen[0],
              chosen[1]
            )

          ) {

            alert(
              "Your two guaranteed picks need to be different films."
            );


            return;

          }


          const otherPeopleMovies =

            PEOPLE

              .filter(
                other =>
                  other !==
                    person
              )

              .flatMap(
                other =>
                  state.nominations[
                    other
                  ] ||
                  []
              )

              .map(
                normalizeMovie
              )

              .filter(
                Boolean
              );


          const duplicate =

            chosen.find(
              movie =>

                otherPeopleMovies.some(
                  existing =>
                    sameMovie(
                      existing,
                      movie
                    )
                )
            );


          if (
            duplicate
          ) {

            alert(
              `${duplicate.title} has already been picked by someone else.`
            );


            return;

          }


          state.nominations[
            person
          ] =
            localPicks;


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
      person => {

        const picks =

          state.nominations[
            person
          ] ||
          [];


        return (

          picks

            .filter(
              item =>
                normalizeMovie(
                  item
                )
            )

            .length ===
              2

        );

      }
    );


  const enoughWildcards =

    state.wildcards.length >=
      2;


  el(
    "startBiddingBtn"
  ).disabled =

    !(
      picksComplete &&
      enoughWildcards
    );


  if (
    !picksComplete
  ) {

    el(
      "startBiddingHint"
    ).textContent =

      "All four people need to save two picks.";

  }

  else if (
    !enoughWildcards
  ) {

    el(
      "startBiddingHint"
    ).textContent =

      "Add at least two wildcard films.";

  }

  else {

    el(
      "startBiddingHint"
    ).textContent =

      "Ready: 8 guaranteed picks + wildcard bidding.";

  }

}


// -----------------------------------------------------
// WILDCARDS
// -----------------------------------------------------

function renderWildcards() {

  const list =
    el(
      "wildcardList"
    );


  list.innerHTML =
    "";


  list.classList.toggle(

    "empty-state",

    state.wildcards.length ===
      0

  );


  state.wildcards.forEach(
    wildcard => {

      const movie =
        wildcardMovie(
          wildcard
        );


      if (
        !movie
      ) {

        return;

      }


      const chip =
        document.createElement(
          "div"
        );


      chip.className =
        "wildcard-chip";


      const thumb =

        movie.posterPath

          ? `

            <img

              src="${posterUrl(
                movie.posterPath,
                "w92"
              )}"

              alt=""

            />

          `

          : `

            <span class="wildcard-no-poster">

              FILM

            </span>

          `;


      chip.innerHTML = `

        ${thumb}

        <span class="wildcard-copy">

          <strong>

            ${escapeHtml(
              movie.title
            )}

          </strong>

          <small>

            ${escapeHtml(
              movieLabel(
                movie
              ) ||
              "Film"
            )}

            ·

            ${escapeHtml(
              wildcard.proposer
            )}

          </small>

        </span>

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


        remove.className =
          "chip-remove";


        remove.setAttribute(

          "aria-label",

          `Remove ${movie.title}`

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


function allNominatedMovies() {

  const guaranteed =

    Object.values(
      state.nominations ||
      {}
    )

      .flat()

      .map(
        normalizeMovie
      )

      .filter(
        Boolean
      );


  const wildcards =

    state.wildcards

      .map(
        wildcardMovie
      )

      .filter(
        Boolean
      );


  return [

    ...guaranteed,

    ...wildcards

  ];

}


async function addWildcard(
  movieValue
) {

  const movie =
    normalizeMovie(
      movieValue
    );


  if (
    !movie
  ) {

    return false;

  }


  const duplicate =

    allNominatedMovies()
      .some(
        existing =>
          sameMovie(
            existing,
            movie
          )
      );


  if (
    duplicate
  ) {

    alert(
      "That film is already on the board."
    );


    return false;

  }


  state.wildcards.push({

    id:
      uid(),

    movie,

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


  return true;

}


// -----------------------------------------------------
// BIDDING
// -----------------------------------------------------

function bidsUsed(
  person
) {

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
      ) => {

        const movieA =
          wildcardMovie(
            a
          );


        const movieB =
          wildcardMovie(
            b
          );


        return (

          wildcardTotal(
            b
          )

          -

          wildcardTotal(
            a
          )

          ||

          (
            movieA?.title ||
            ""
          )
            .localeCompare(

              movieB?.title ||
              ""

            )

        );

      }
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
    el(
      "biddingGrid"
    );


  grid.innerHTML =
    "";


  [
    ...state.wildcards
  ]

    .sort(
      (
        a,
        b
      ) =>

        wildcardTotal(
          b
        )

        -

        wildcardTotal(
          a
        )
    )

    .forEach(
      wildcard => {

        const movie =
          wildcardMovie(
            wildcard
          );


        if (
          !movie
        ) {

          return;

        }


        const card =
          document.createElement(
            "article"
          );


        card.className =

          "bid-card"

          +

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


        const thumb =

          movie.posterPath

            ? `

              <img

                class="bid-poster"

                src="${posterUrl(
                  movie.posterPath,
                  "w154"
                )}"

                alt="${escapeHtml(
                  movie.title
                )} poster"

              />

            `

            : `

              <div class="bid-poster no-poster">

                FILM

              </div>

            `;


        card.innerHTML = `

          ${thumb}

          <div class="bid-copy">

            <h3>

              ${escapeHtml(
                movie.title
              )}

            </h3>

            <p>

              ${escapeHtml(
                movieLabel(
                  movie
                ) ||
                "Film"
              )}

              · suggested by

              ${escapeHtml(
                wildcard.proposer
              )}

            </p>

            <p class="bid-total">

              ${total}

              total token${total === 1
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


        const minus =
          card.querySelector(
            ".minus"
          );


        const plus =
          card.querySelector(
            ".plus"
          );


        minus.disabled =
          mine <=
          0;


        plus.disabled =
          remaining <=
          0;


        minus.addEventListener(
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


        plus.addEventListener(
          "click",
          async () => {

            if (

              bidsUsed(
                state.activePerson
              )

              >=

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
        )

        ===

        TOKENS_PER_PERSON
    );


  el(
    "lockFinalBtn"
  ).disabled =

    !(
      allSpent &&
      state.wildcards.length >=
        2
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

  movieValue,

  source,

  note,

  picker

) {

  const movie =
    normalizeMovie(
      movieValue
    );


  return {

    id:
      uid(),

    tmdbId:
      movie?.tmdbId ||
      null,

    title:
      movie?.title ||
      "Untitled",

    year:
      movie?.year ||
      "",

    posterPath:
      movie?.posterPath ||
      null,

    runtime:
      movie?.runtime ||
      null,

    overview:
      movie?.overview ||
      "",

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
      )
        .forEach(
          (
            movieValue,
            index
          ) => {

            const movie =

              normalizeMovie(
                movieValue
              );


            if (
              !movie
            ) {

              return;

            }


            guaranteed.push(

              makeMovie(

                movie,

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
        ) => {

          const movieA =
            wildcardMovie(
              a
            );


          const movieB =
            wildcardMovie(
              b
            );


          return (

            wildcardTotal(
              b
            )

            -

            wildcardTotal(
              a
            )

            ||

            (
              movieA?.title ||
              ""
            )
              .localeCompare(

                movieB?.title ||
                ""

              )

          );

        }
      )

      .slice(
        0,
        2
      )

      .map(
        wildcard =>

          makeMovie(

            wildcardMovie(
              wildcard
            ),

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
// WATCHING + REVIEWS
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
    el(
      "movieGrid"
    );


  grid.innerHTML =
    "";


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

          .cloneNode(
            true
          );


      card.querySelector(
        ".movie-number"
      ).textContent =

        String(
          index + 1
        )
          .padStart(
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


      card.querySelector(
        ".movie-facts"
      ).textContent =

        movieLabel(
          movie
        ) ||

        "Film";


      const poster =
        card.querySelector(
          ".poster"
        );


      const posterImage =
        card.querySelector(
          ".poster-image"
        );


      if (
        movie.posterPath
      ) {

        posterImage.src =

          posterUrl(
            movie.posterPath,
            "w342"
          );


        posterImage.alt =

          `${movie.title} poster`;


        posterImage.classList.remove(
          "hidden"
        );


        poster.classList.add(
          "has-image"
        );

      }


      const watchedTotal =

        PEOPLE.filter(
          person =>
            movie.watched?.[
              person
            ]
        )
          .length;


      card.querySelector(
        ".watched-count"
      ).textContent =

        `${watchedTotal}/4 watched`;


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

            "watcher"

            +

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
        )
          .addEventListener(
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

            )

            /

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

    state.finalMovies

      .filter(
        isUnlocked
      )

      .length;

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

    )

    /

    ratings.length

  );

}


function renderRanking() {

  const box =
    el(
      "rankingTable"
    );


  box.innerHTML =
    "";


  const sorted =

    [
      ...state.finalMovies
    ]

      .sort(
        (
          a,
          b
        ) =>

          averageRating(
            b
          )

          -

          averageRating(
            a
          )
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
        )
          .length;


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
        )
          .length;


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
              movieLabel(
                movie
              ) ||
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
// MAIN BUTTONS
// -----------------------------------------------------

el(
  "startBiddingBtn"
)
  .addEventListener(
    "click",
    async () => {

      await setPhase(
        "bidding"
      );

    }
  );


el(
  "backToNominationsBtn"
)
  .addEventListener(
    "click",
    async () => {

      await setPhase(
        "nominations"
      );

    }
  );


el(
  "lockFinalBtn"
)
  .addEventListener(
    "click",
    async () => {

      if (

        !PEOPLE.every(
          person =>
            bidsUsed(
              person
            )

            ===

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

        behavior:
          "smooth"

      });

    }
  );


el(
  "resetBtn"
)
  .addEventListener(
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


      pendingWildcardMovie =
        null;


      await saveState();


      render();

    }
  );


// -----------------------------------------------------
// REALTIME
// -----------------------------------------------------

function subscribeToSharedState() {

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
// START
// -----------------------------------------------------

async function initialise() {

  setupPeople();

  setupWildcardPicker();

  render();


  try {

    await loadState();


    el(
      "activePerson"
    ).value =
      state.activePerson;


    render();


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