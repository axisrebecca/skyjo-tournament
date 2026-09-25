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
const gameNotificationEl = document.getElementById("game-notification");
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
const scoreEntryHeading = document.getElementById("score-entry-heading");
const scoreEntryForm = document.getElementById("score-entry-form");
const scoreReviewEl = document.getElementById("score-review");
const scoreReviewListEl = document.getElementById("score-review-list");
const editScoresButton = document.getElementById("edit-scores");
const saveScoresButton = document.getElementById("save-scores");
const scoreReviewStatusEl = document.getElementById("score-review-status");

let players = [];
let games = [];
let leaderboardView = "leaders";
let suggestedPlayerIds = [];
const selectedPlayerIds = new Set();
let seatedPlayerIds = [];
let currentGameId = null;
let currentGameRevision = null;
let reviewedScores = null;

const MAX_SEATS = 8;

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
