// Texas Hold'em — heads-up vs the Bandit. No backend, all client-side.

// ---------- Cards ----------
const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false },
];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function newDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ rank: r, suit: s });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---------- Hand evaluation (best 5 of 7) ----------
const HAND_NAMES = [
  "High Card", "One Pair", "Two Pair", "Three of a Kind",
  "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush",
];

function evaluate5(cards) {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);

  // Straight detection (wheel counts: A-2-3-4-5).
  const unique = [...new Set(ranks)];
  let straightHigh = -1;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    else if (unique[0] === 12 && unique[1] === 3) straightHigh = 3; // wheel
  }

  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, n]) => ({ rank: Number(r), n }))
    .sort((a, b) => b.n - a.n || b.rank - a.rank);

  const tiebreak = groups.map((g) => g.rank);
  let cat;
  if (flush && straightHigh >= 0) cat = 8;
  else if (groups[0].n === 4) cat = 7;
  else if (groups[0].n === 3 && groups[1].n === 2) cat = 6;
  else if (flush) cat = 5;
  else if (straightHigh >= 0) cat = 4;
  else if (groups[0].n === 3) cat = 3;
  else if (groups[0].n === 2 && groups[1].n === 2) cat = 2;
  else if (groups[0].n === 2) cat = 1;
  else cat = 0;

  return { cat, tiebreak };
}

function compareScores(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const d = (a.tiebreak[i] ?? -1) - (b.tiebreak[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

function bestOf7(cards) {
  // Best 5-card hand out of however many cards are available (5, 6, or 7).
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const score = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareScores(score, best) > 0) best = score;
          }
  return best;
}

// ---------- Game state ----------
const BET_SIZE = 20;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const START_CHIPS = 1000;

const state = {
  playerChips: START_CHIPS,
  aiChips: START_CHIPS,
  deck: [],
  playerHand: [],
  aiHand: [],
  board: [],
  pot: 0,
  street: "idle", // idle | preflop | flop | turn | river | showdown
  playerInvested: 0,
  aiInvested: 0,
  awaiting: null, // 'check' | 'call' when it's the player's turn
  aiActed: false, // has the Bandit taken his action this street?
  handOver: true,
  dealerIsPlayer: true,
};

const $ = (id) => document.getElementById(id);
const messageEl = $("message");
const dealBtn = $("deal-btn");
const checkCallBtn = $("check-call-btn");
const betBtn = $("bet-btn");
const foldBtn = $("fold-btn");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Rendering ----------
function cardEl(card, faceDown = false) {
  const el = document.createElement("div");
  if (faceDown) {
    el.className = "card back";
    return el;
  }
  el.className = "card" + (SUITS[card.suit].red ? " red" : "");
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = RANKS[card.rank];
  const suit = document.createElement("span");
  suit.className = "suit";
  suit.textContent = SUITS[card.suit].symbol;
  el.append(rank, suit);
  return el;
}

function renderCards(container, cards, { faceDown = false, placeholders = 0 } = {}) {
  const el = $(container);
  el.textContent = "";
  for (const card of cards) el.appendChild(cardEl(card, faceDown));
  for (let i = 0; i < placeholders; i++) {
    const ph = document.createElement("div");
    ph.className = "card placeholder";
    el.appendChild(ph);
  }
}

function setMessage(text, cls = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${cls}`;
}

function render() {
  $("player-chips").textContent = state.playerChips;
  $("ai-chips").textContent = state.aiChips;
  $("pot").textContent = state.pot;

  const showAi = state.street === "showdown";
  renderCards("ai-cards", state.aiHand, {
    faceDown: !showAi,
    placeholders: state.handOver && state.aiHand.length === 0 ? 2 : 0,
  });
  renderCards("player-cards", state.playerHand, {
    placeholders: state.handOver && state.playerHand.length === 0 ? 2 : 0,
  });
  renderCards("board", state.board, {
    placeholders: 5 - state.board.length,
  });

  // Hand strength notes.
  const playerNote = $("player-note");
  const aiNote = $("ai-note");
  if (state.playerHand.length === 2 && state.playerHand.length + state.board.length >= 5) {
    const s = bestOf7([...state.playerHand, ...state.board]);
    playerNote.textContent = HAND_NAMES[s.cat];
    playerNote.className = "hand-note" + (s.cat >= 3 ? " strong" : "");
  } else {
    playerNote.textContent = "";
    playerNote.className = "hand-note";
  }
  if (showAi && state.aiHand.length === 2) {
    const s = bestOf7([...state.aiHand, ...state.board]);
    aiNote.textContent = HAND_NAMES[s.cat];
    aiNote.className = "hand-note" + (s.cat >= 3 ? " strong" : "");
  } else {
    aiNote.textContent = "";
    aiNote.className = "hand-note";
  }

  // Buttons.
  const toCall = state.aiInvested - state.playerInvested;
  const playerTurn = !state.handOver && state.awaiting;
  dealBtn.disabled = !state.handOver || state.playerChips <= 0 || state.aiChips <= 0;
  checkCallBtn.disabled = !playerTurn;
  betBtn.disabled = !playerTurn || state.playerChips <= toCall;
  foldBtn.disabled = !playerTurn || toCall === 0;

  if (playerTurn) {
    checkCallBtn.textContent = toCall > 0 ? `CALL ${Math.min(toCall, state.playerChips)}` : "CHECK";
    const raiseTotal = toCall + BET_SIZE;
    betBtn.textContent = toCall > 0 ? `RAISE ${Math.min(raiseTotal, state.playerChips)}` : `BET ${Math.min(BET_SIZE, state.playerChips)}`;
  } else {
    checkCallBtn.textContent = "CHECK";
    betBtn.textContent = `BET ${BET_SIZE}`;
  }
}

// ---------- Betting helpers ----------
function commit(who, amount) {
  const chips = who === "player" ? state.playerChips : state.aiChips;
  const paid = Math.min(amount, chips);
  if (who === "player") {
    state.playerChips -= paid;
    state.playerInvested += paid;
  } else {
    state.aiChips -= paid;
    state.aiInvested += paid;
  }
  state.pot += paid;
  return paid;
}

// ---------- Bandit AI ----------
function aiHoleStrength() {
  const [a, b] = state.aiHand;
  const high = Math.max(a.rank, b.rank);
  const pair = a.rank === b.rank;
  const suited = a.suit === b.suit;
  if (pair) return 0.55 + a.rank / 24; // pairs are strong heads-up
  let s = high / 24;
  if (suited) s += 0.08;
  if (Math.abs(a.rank - b.rank) <= 2) s += 0.06; // connectors-ish
  return s;
}

function aiMadeStrength() {
  const s = bestOf7([...state.aiHand, ...state.board]);
  return s.cat / 8;
}

function aiDecide(toCall) {
  // Returns 'fold' | 'call' | 'raise'.
  const strength = state.street === "preflop" ? aiHoleStrength() : aiMadeStrength();
  const bluff = Math.random() < 0.07;

  if (toCall > 0) {
    if (strength >= 0.75 && state.aiChips > toCall + BET_SIZE && Math.random() < 0.5) return "raise";
    if (strength >= 0.3 || bluff) return "call";
    return "fold";
  }
  if ((strength >= 0.6 || bluff) && state.aiChips >= BET_SIZE) return "raise"; // bet out
  return "call"; // check
}

// ---------- Hand flow ----------
function startHand() {
  if (state.playerChips <= 0 || state.aiChips <= 0) return;
  state.deck = newDeck();
  state.playerHand = [state.deck.pop(), state.deck.pop()];
  state.aiHand = [state.deck.pop(), state.deck.pop()];
  state.board = [];
  state.pot = 0;
  state.playerInvested = 0;
  state.aiInvested = 0;
  state.street = "preflop";
  state.handOver = false;
  state.dealerIsPlayer = !state.dealerIsPlayer;

  // Blinds: dealer posts small blind heads-up.
  if (state.dealerIsPlayer) {
    commit("player", SMALL_BLIND);
    commit("ai", BIG_BLIND);
  } else {
    commit("ai", SMALL_BLIND);
    commit("player", BIG_BLIND);
  }

  setMessage(state.dealerIsPlayer
    ? "Your small blind is in. Call, raise, or fold."
    : "The Bandit dealt. You're the big blind.");

  if (state.dealerIsPlayer) {
    state.awaiting = "call";
    render();
  } else {
    state.awaiting = null;
    render();
    aiPreflopAsDealer();
  }
}

async function aiPreflopAsDealer() {
  await sleep(700);
  if (state.handOver) return;
  const toCall = state.playerInvested - state.aiInvested;
  const decision = aiDecide(toCall);
  if (decision === "fold") {
    endByFold("ai");
    return;
  }
  if (decision === "raise") {
    commit("ai", toCall + BET_SIZE);
    setMessage("The Bandit raises. Your move.");
  } else {
    commit("ai", toCall);
    setMessage("The Bandit calls. Check or raise.");
  }
  state.aiActed = true;
  state.awaiting = "call";
  render();
}

async function nextStreet() {
  state.awaiting = null;
  state.playerInvested = 0;
  state.aiInvested = 0;
  state.aiActed = false;
  render();
  await sleep(600);

  if (state.street === "preflop") {
    state.board.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.street = "flop";
    setMessage("The flop.");
  } else if (state.street === "flop") {
    state.board.push(state.deck.pop());
    state.street = "turn";
    setMessage("The turn.");
  } else if (state.street === "turn") {
    state.board.push(state.deck.pop());
    state.street = "river";
    setMessage("The river.");
  } else {
    showdown();
    return;
  }

  render();
  // Bandit acts first after the flop when player is dealer; otherwise player acts first.
  if (state.dealerIsPlayer) {
    await aiPostflopFirst();
  } else {
    state.awaiting = "check";
    render();
  }
}

async function aiPostflopFirst() {
  await sleep(700);
  if (state.handOver) return;
  const decision = aiDecide(0);
  if (decision === "raise") {
    commit("ai", BET_SIZE);
    setMessage("The Bandit bets. Call, raise, or fold.");
  } else {
    setMessage("The Bandit checks.");
  }
  state.aiActed = true;
  state.awaiting = "call";
  render();
}

async function aiRespond() {
  // Player just bet/raised; Bandit must respond to state.playerInvested - state.aiInvested.
  await sleep(700);
  if (state.handOver) return;
  const toCall = state.playerInvested - state.aiInvested;
  const decision = aiDecide(toCall);

  if (decision === "fold") {
    endByFold("ai");
    return;
  }
  if (decision === "raise" && state.aiChips > toCall) {
    commit("ai", toCall + BET_SIZE);
    setMessage("The Bandit re-raises! Your move.");
    state.awaiting = "call";
    render();
    return;
  }
  commit("ai", toCall);
  setMessage("The Bandit calls.");
  render();
  await sleep(500);
  nextStreet();
}

function endByFold(loser) {
  state.handOver = true;
  state.street = "idle";
  state.awaiting = null;
  if (loser === "player") {
    state.aiChips += state.pot;
    setMessage("You folded. The Bandit takes the pot.", "lose");
  } else {
    state.playerChips += state.pot;
    setMessage("The Bandit folds! Pot is yours.", "win");
  }
  state.pot = 0;
  checkBust();
  render();
}

function showdown() {
  state.street = "showdown";
  state.handOver = true;
  state.awaiting = null;

  const playerScore = bestOf7([...state.playerHand, ...state.board]);
  const aiScore = bestOf7([...state.aiHand, ...state.board]);
  const cmp = compareScores(playerScore, aiScore);

  if (cmp > 0) {
    state.playerChips += state.pot;
    setMessage(`You win with ${HAND_NAMES[playerScore.cat]}! Pot is yours.`, "win");
  } else if (cmp < 0) {
    state.aiChips += state.pot;
    setMessage(`The Bandit wins with ${HAND_NAMES[aiScore.cat]}.`, "lose");
  } else {
    state.playerChips += Math.floor(state.pot / 2);
    state.aiChips += Math.ceil(state.pot / 2);
    setMessage(`Split pot — both have ${HAND_NAMES[playerScore.cat]}.`);
  }
  state.pot = 0;
  checkBust();
  render();
}

function checkBust() {
  if (state.aiChips <= 0) {
    setMessage("🏆 You busted the Bandit! Refresh to run it back.", "win");
  } else if (state.playerChips <= 0) {
    setMessage("The Bandit cleaned you out. Refresh for revenge.", "lose");
  }
}

// ---------- Player actions ----------
function onCheckCall() {
  if (!state.awaiting) return;
  const toCall = state.aiInvested - state.playerInvested;
  state.awaiting = null;

  if (toCall > 0) {
    commit("player", toCall);
    setMessage("You call.");
    render();
    if (state.street === "preflop" && state.playerInvested === BIG_BLIND && state.aiInvested === BIG_BLIND) {
      // Limped pot preflop as the big blind — Bandit (dealer) already called.
      setTimeout(nextStreet, 500);
    } else {
      setTimeout(nextStreet, 500);
    }
  } else {
    setMessage("You check.");
    render();
    if (state.street === "preflop") {
      // Player checked the big-blind option; dealer already called.
      setTimeout(nextStreet, 500);
    } else if (state.aiActed) {
      // Bandit already acted this street (checked) — street is done.
      setTimeout(nextStreet, 500);
    } else {
      // Player checked first — Bandit responds.
      aiRespondToCheck();
    }
  }
}

async function aiRespondToCheck() {
  await sleep(700);
  if (state.handOver) return;
  const decision = aiDecide(0);
  if (decision === "raise") {
    commit("ai", BET_SIZE);
    setMessage("The Bandit bets. Call, raise, or fold.");
    state.aiActed = true;
    state.awaiting = "call";
    render();
  } else {
    setMessage("The Bandit checks back.");
    render();
    setTimeout(nextStreet, 500);
  }
}

function onBet() {
  if (!state.awaiting) return;
  const toCall = state.aiInvested - state.playerInvested;
  state.awaiting = null;
  commit("player", toCall + BET_SIZE);
  setMessage(toCall > 0 ? "You raise." : "You bet.");
  render();
  aiRespond();
}

function onFold() {
  if (!state.awaiting) return;
  endByFold("player");
}

dealBtn.addEventListener("click", startHand);
checkCallBtn.addEventListener("click", onCheckCall);
betBtn.addEventListener("click", onBet);
foldBtn.addEventListener("click", onFold);

render();
