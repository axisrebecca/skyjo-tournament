firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const statusEl = document.getElementById("status");
const playerListEl = document.getElementById("player-list");
const authTestForm = document.getElementById("auth-test-form");
const organizerPinInput = document.getElementById("organizer-pin");
const authStatusEl = document.getElementById("auth-status");
const signOutButton = document.getElementById("sign-out");
const addPlayerForm = document.getElementById("add-player-form");
const playerNameInput = document.getElementById("player-name");
const rosterStatusEl = document.getElementById("roster-status");
const leaderboardListEl = document.getElementById("leaderboard-list");
const leaderboardViewButtons = document.querySelectorAll(
  "button[data-leaderboard-view]",
);
const gameHistoryEl = document.getElementById("game-history");
const newGameSection = document.getElementById("new-game");
const unfinishedGamesEl = document.getElementById("unfinished-games");
const unfinishedGamesStatusEl = document.getElementById(
  "unfinished-games-status",
);
const unfinishedGameListEl = document.getElementById("unfinished-game-list");
const newGameControls = document.getElementById("new-game-controls");
const newGameLockedEl = document.getElementById("new-game-locked");
const selectionCountEl = document.getElementById("selection-count");
const addAllPlayersButton = document.getElementById("add-all-players");
const gameSetupStatusEl = document.getElementById("game-setup-status");
const gamePlayerListEl = document.getElementById("game-player-list");
const generateSeatingButton = document.getElementById("generate-seating");
const seatingEl = document.getElementById("seating");
const seatingListEl = document.getElementById("seating-list");
const gameFinishedButton = document.getElementById("game-finished");
const scoreEntrySection = document.getElementById("score-entry");
const scoreEntryForm = document.getElementById("score-entry-form");
let players = [];
let games = [];
let leaderboardView = "leaders";
let suggestedPlayerIds = [];
const selectedPlayerIds = new Set();
let seatedPlayerIds = [];
let currentGameId = null;

const MAX_SEATS = 8;
const UNFINISHED_GAME_AGE_MS = 2 * 60 * 60 * 1000;

function numberValue(value) {
  return Number.isFinite(value) ? value : 0;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function refreshSuggestions() {
  const activePlayers = shuffle(
    players.filter((player) => player.active !== false),
  ).sort(
    (left, right) =>
      numberValue(left.gamesPlayed) - numberValue(right.gamesPlayed),
  );
  suggestedPlayerIds = activePlayers.map(({ id }) => id);

  const activeIds = new Set(suggestedPlayerIds);
  for (const id of selectedPlayerIds) {
    if (!activeIds.has(id)) selectedPlayerIds.delete(id);
  }
}

function renderGameSetup() {
  const suggestedPlayers = suggestedPlayerIds
    .map((id) => players.find((player) => player.id === id))
    .filter(Boolean);

  selectionCountEl.textContent = `${selectedPlayerIds.size} of ${MAX_SEATS} players selected`;
  addAllPlayersButton.disabled =
    suggestedPlayers.length === 0 ||
    selectedPlayerIds.size === Math.min(suggestedPlayers.length, MAX_SEATS);
  generateSeatingButton.disabled = selectedPlayerIds.size < 2;
  gamePlayerListEl.replaceChildren();

  for (const player of suggestedPlayers) {
    const item = document.createElement("li");
    const details = document.createElement("span");
    const button = document.createElement("button");
    const isSelected = selectedPlayerIds.has(player.id);
    const gamesPlayed = numberValue(player.gamesPlayed);

    details.textContent = `${player.name} · ${gamesPlayed} game${gamesPlayed === 1 ? "" : "s"}`;
    button.type = "button";
    button.dataset.gamePlayerId = player.id;
    button.textContent = isSelected ? "Remove" : "Add";
    button.disabled = !isSelected && selectedPlayerIds.size >= MAX_SEATS;
    item.className = isSelected ? "selected" : "";
    item.append(details, button);
    gamePlayerListEl.appendChild(item);
  }

  if (suggestedPlayers.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Add an active player before starting a game.";
    item.className = "empty-state";
    gamePlayerListEl.appendChild(item);
  }
}

function renderSeating() {
  seatingListEl.replaceChildren();
  for (const playerId of seatedPlayerIds) {
    const player = players.find(({ id }) => id === playerId);
    const item = document.createElement("li");
    item.textContent = player?.name || "Unknown player";
    seatingListEl.appendChild(item);
  }
}

function renderScoreEntry() {
  scoreEntryForm.replaceChildren();
  for (const playerId of seatedPlayerIds) {
    const player = players.find(({ id }) => id === playerId);
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.textContent = player?.name || "Unknown player";
    input.type = "number";
    input.inputMode = "numeric";
    input.name = playerId;
    input.required = true;
    label.appendChild(input);
    scoreEntryForm.appendChild(label);
  }
}

function renderLeaderboard() {
  const sortedPlayers = [...players].sort((left, right) => {
    if (leaderboardView === "least-games") {
      return (
        numberValue(left.gamesPlayed) - numberValue(right.gamesPlayed) ||
        left.name.localeCompare(right.name)
      );
    }

    return (
      numberValue(right.totalPoints) - numberValue(left.totalPoints) ||
      numberValue(right.firstPlaceCount) - numberValue(left.firstPlaceCount) ||
      numberValue(right.secondPlaceCount) -
        numberValue(left.secondPlaceCount) ||
      left.name.localeCompare(right.name)
    );
  });

  leaderboardListEl.replaceChildren();
  for (const player of sortedPlayers) {
    const row = document.createElement("tr");
    const values = [
      player.name,
      numberValue(player.totalPoints),
      numberValue(player.gamesPlayed),
      numberValue(player.firstPlaceCount),
      numberValue(player.secondPlaceCount),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    leaderboardListEl.appendChild(row);
  }

  if (sortedPlayers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No players yet.";
    cell.className = "empty-state";
    row.appendChild(cell);
    leaderboardListEl.appendChild(row);
  }
}

function gameDate(game) {
  const date = game.date || game.createdAt;
  if (date?.toDate) return date.toDate();
  if (date) return new Date(date);
  return null;
}

function renderUnfinishedGames() {
  const cutoff = Date.now() - UNFINISHED_GAME_AGE_MS;
  const unfinishedGames = games
    .filter(
      (game) =>
        game.status === "in-progress" && gameDate(game)?.getTime() < cutoff,
    )
    .sort(
      (left, right) => gameDate(left).getTime() - gameDate(right).getTime(),
    );

  unfinishedGamesEl.hidden =
    unfinishedGames.length === 0 && !unfinishedGamesStatusEl.textContent;
  unfinishedGameListEl.replaceChildren();

  for (const game of unfinishedGames) {
    const item = document.createElement("li");
    const details = document.createElement("p");
    const resumeButton = document.createElement("button");
    const discardButton = document.createElement("button");
    const playerNames = game.seatedIds.map(
      (playerId) =>
        players.find((player) => player.id === playerId)?.name ||
        "Unknown player",
    );

    details.textContent = `${gameDate(game).toLocaleString()} · ${playerNames.join(", ")}`;
    resumeButton.type = "button";
    resumeButton.textContent = "Resume";
    resumeButton.dataset.resumeGameId = game.id;
    resumeButton.disabled = !auth.currentUser;
    discardButton.type = "button";
    discardButton.textContent = "Discard";
    discardButton.dataset.discardGameId = game.id;
    discardButton.dataset.gameRevision = numberValue(game.revision);
    discardButton.disabled = !auth.currentUser;
    item.append(details, resumeButton, " ", discardButton);
    unfinishedGameListEl.appendChild(item);
  }
}

function renderGameHistory() {
  const sortedGames = [...games].sort(
    (left, right) =>
      (gameDate(right)?.getTime() || 0) - (gameDate(left)?.getTime() || 0),
  );

  gameHistoryEl.replaceChildren();
  for (const game of sortedGames) {
    const item = document.createElement("li");
    const date = gameDate(game);
    const dateText =
      date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString()
        : "Undated";
    const playerCount = game.seatedIds?.length || game.results?.length || 0;
    const statusText = game.status === "in-progress" ? " · Not finished" : "";
    item.textContent = `${dateText} · ${playerCount} players${statusText}`;
    gameHistoryEl.appendChild(item);
  }

  if (sortedGames.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No games recorded yet.";
    item.className = "empty-state";
    gameHistoryEl.appendChild(item);
  }
}

function renderPlayers() {
  const activePlayers = players
    .filter((player) => player.active !== false)
    .sort((left, right) => left.name.localeCompare(right.name));

  statusEl.textContent = `Connected. ${activePlayers.length} active player(s).`;
  playerListEl.replaceChildren();

  for (const player of activePlayers) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const removeButton = document.createElement("button");
    name.textContent = player.name;
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.dataset.playerId = player.id;
    removeButton.disabled = !auth.currentUser;
    li.append(name, removeButton);
    playerListEl.appendChild(li);
  }

  if (activePlayers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No active players yet.";
    li.className = "empty-state";
    playerListEl.appendChild(li);
  }
}

function loadPlayers() {
  return db.collection("players").onSnapshot(
    (snapshot) => {
      players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      refreshSuggestions();
      renderPlayers();
      renderLeaderboard();
      renderGameSetup();
      renderUnfinishedGames();
    },
    (err) => {
      statusEl.textContent =
        "Could not connect to Firestore. Check firebase-config.js and the Firestore rules.";
      console.error(err);
    },
  );
}

function loadGames() {
  return db.collection("games").onSnapshot(
    (snapshot) => {
      games = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderGameHistory();
      renderUnfinishedGames();
    },
    (err) => {
      gameHistoryEl.replaceChildren();
      const item = document.createElement("li");
      item.textContent = "Could not load game history.";
      item.className = "empty-state";
      gameHistoryEl.appendChild(item);
      console.error(err);
    },
  );
}

authTestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = authTestForm.querySelector("button");
  submitButton.disabled = true;
  authStatusEl.textContent = "Testing PIN...";

  try {
    await auth.signInWithEmailAndPassword(
      firebaseOperatorEmail,
      organizerPinInput.value,
    );
    authTestForm.reset();
    authStatusEl.textContent = "Editing unlocked.";
  } catch (err) {
    const invalidPinErrors = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ];
    authStatusEl.textContent = invalidPinErrors.includes(err.code)
      ? "Incorrect PIN."
      : "Could not authenticate. Check the Firebase setup and try again.";
    console.error(err);
  } finally {
    submitButton.disabled = false;
  }
});

auth.onAuthStateChanged((user) => {
  authTestForm.hidden = Boolean(user);
  signOutButton.hidden = !user;
  addPlayerForm.hidden = !user;
  newGameControls.hidden = !user || seatedPlayerIds.length > 0;
  newGameLockedEl.hidden = Boolean(user);
  if (!user) {
    authStatusEl.textContent = "Enter the organizer PIN to edit the roster.";
  }
  renderPlayers();
  renderUnfinishedGames();
});

signOutButton.addEventListener("click", async () => {
  await auth.signOut();
  authStatusEl.textContent = "Editing locked.";
});

addPlayerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = playerNameInput.value.trim();
  const submitButton = addPlayerForm.querySelector("button");
  const existingPlayer = players.find(
    (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );

  if (existingPlayer && existingPlayer.active !== false) {
    rosterStatusEl.textContent = `${existingPlayer.name} is already active.`;
    return;
  }

  submitButton.disabled = true;
  rosterStatusEl.textContent = "Saving player...";

  try {
    if (existingPlayer) {
      await db
        .collection("players")
        .doc(existingPlayer.id)
        .update({ active: true });
    } else {
      await db.collection("players").add({
        name,
        gamesPlayed: 0,
        totalPoints: 0,
        firstPlaceCount: 0,
        secondPlaceCount: 0,
        active: true,
        qualifiedForFinale: false,
      });
    }
    addPlayerForm.reset();
    rosterStatusEl.textContent = `${name} added.`;
    playerNameInput.focus();
  } catch (err) {
    rosterStatusEl.textContent =
      "Could not save the player. Try unlocking editing again.";
    console.error(err);
  } finally {
    submitButton.disabled = false;
  }
});

playerListEl.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-player-id]");
  if (!removeButton) return;

  const player = players.find(({ id }) => id === removeButton.dataset.playerId);
  if (
    !player ||
    !window.confirm(`Remove ${player.name} from the active roster?`)
  )
    return;

  removeButton.disabled = true;
  rosterStatusEl.textContent = `Removing ${player.name}...`;
  try {
    await db.collection("players").doc(player.id).update({ active: false });
    rosterStatusEl.textContent = `${player.name} removed.`;
  } catch (err) {
    removeButton.disabled = false;
    rosterStatusEl.textContent =
      "Could not remove the player. Try unlocking editing again.";
    console.error(err);
  }
});

for (const button of leaderboardViewButtons) {
  button.addEventListener("click", () => {
    leaderboardView = button.dataset.leaderboardView;
    for (const viewButton of leaderboardViewButtons) {
      viewButton.setAttribute("aria-pressed", String(viewButton === button));
    }
    renderLeaderboard();
  });
}

unfinishedGameListEl.addEventListener("click", async (event) => {
  const resumeButton = event.target.closest("button[data-resume-game-id]");
  if (resumeButton) {
    const game = games.find(
      ({ id }) => id === resumeButton.dataset.resumeGameId,
    );
    if (!game || game.status !== "in-progress") return;

    currentGameId = game.id;
    seatedPlayerIds = [...game.seatedIds];
    renderScoreEntry();
    newGameSection.hidden = true;
    scoreEntrySection.hidden = false;
    scoreEntrySection.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const discardButton = event.target.closest("button[data-discard-game-id]");
  if (!discardButton || !window.confirm("Discard this unfinished game?")) {
    return;
  }

  const gameId = discardButton.dataset.discardGameId;
  const expectedRevision = Number(discardButton.dataset.gameRevision);
  discardButton.disabled = true;
  unfinishedGamesStatusEl.textContent = "Discarding game...";

  try {
    await db.runTransaction(async (transaction) => {
      const gameRef = db.collection("games").doc(gameId);
      const snapshot = await transaction.get(gameRef);
      const game = snapshot.data();
      if (
        !snapshot.exists ||
        game.status !== "in-progress" ||
        numberValue(game.revision) !== expectedRevision
      ) {
        throw new Error("game-conflict");
      }
      transaction.delete(gameRef);
    });
    unfinishedGamesStatusEl.textContent = "Game discarded.";
  } catch (err) {
    discardButton.disabled = false;
    unfinishedGamesEl.hidden = false;
    unfinishedGamesStatusEl.textContent =
      err.message === "game-conflict"
        ? "Conflict: this game changed and was not discarded."
        : "Could not discard the game. Try again.";
    console.error(err);
  }
});

gamePlayerListEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-game-player-id]");
  if (!button) return;

  const playerId = button.dataset.gamePlayerId;
  if (selectedPlayerIds.has(playerId)) {
    selectedPlayerIds.delete(playerId);
  } else if (selectedPlayerIds.size < MAX_SEATS) {
    selectedPlayerIds.add(playerId);
  }
  gameSetupStatusEl.textContent = "";
  renderGameSetup();
});

addAllPlayersButton.addEventListener("click", () => {
  selectedPlayerIds.clear();
  for (const playerId of suggestedPlayerIds.slice(0, MAX_SEATS)) {
    selectedPlayerIds.add(playerId);
  }
  gameSetupStatusEl.textContent =
    suggestedPlayerIds.length > MAX_SEATS
      ? "Selected the 8 players with the fewest games."
      : "All active players selected.";
  renderGameSetup();
});

generateSeatingButton.addEventListener("click", async () => {
  const nextSeatedPlayerIds = shuffle([...selectedPlayerIds]);
  gameSetupStatusEl.textContent = "Starting game...";

  try {
    const gameRef = await db.collection("games").add({
      status: "in-progress",
      revision: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      seatedIds: nextSeatedPlayerIds,
      waitingIds: suggestedPlayerIds.filter(
        (playerId) => !selectedPlayerIds.has(playerId),
      ),
    });
    currentGameId = gameRef.id;
    seatedPlayerIds = nextSeatedPlayerIds;
    newGameControls.hidden = true;
    seatingEl.hidden = false;
    renderSeating();
    seatingEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    gameSetupStatusEl.textContent = "Could not start the game. Try again.";
    console.error(err);
  }
});

gameFinishedButton.addEventListener("click", () => {
  renderScoreEntry();
  newGameSection.hidden = true;
  scoreEntrySection.hidden = false;
  scoreEntrySection.scrollIntoView({ behavior: "smooth", block: "start" });
});

loadPlayers();
loadGames();
