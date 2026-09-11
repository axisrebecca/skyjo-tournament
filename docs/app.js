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
let players = [];
let games = [];
let leaderboardView = "leaders";

function numberValue(value) {
  return Number.isFinite(value) ? value : 0;
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
  if (game.date?.toDate) return game.date.toDate();
  if (game.date) return new Date(game.date);
  return null;
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
    item.textContent = `Session ${game.sessionIndex ?? "?"} · ${dateText} · ${playerCount} player(s)`;
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
      renderPlayers();
      renderLeaderboard();
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
  if (!user) {
    authStatusEl.textContent = "Enter the organizer PIN to edit the roster.";
  }
  renderPlayers();
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

loadPlayers();
loadGames();
