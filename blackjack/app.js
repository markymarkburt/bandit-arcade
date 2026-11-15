// Bandit Blackjack — beat the dealer. No backend, all client-side.

const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false },
];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const BET_STEPS = [5, 10, 25, 50, 100];
const START_CHIPS = 500;

const state = {
  chips: START_CHIPS,
  wins: 0,
  losses: 0,
  pushes: 0,
  betIndex: 2, // 25
  deck: [],
  playerHand: [],
  dealerHand: [],
  bet: 0,
  phase: "betting", // betting | player | dealer | done
  doubled: false,
};

const $ = (id) => document.getElementById(id);
const messageEl = $("message");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Deck ----------
function newShoe() {
  // 4-deck shoe, reshuffled each hand — simple and fine for a toy game.
  const deck = [];
  for (let d = 0; d < 4; d++)
    for (let s = 0; s < 4; s++)
      for (let r = 0; r < 13; r++)
        deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ---------- Hand values ----------
function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 0) {
      aces++;
      total += 11;
    } else if (card.rank >= 9) {
      total += 10;
    } else {
      total += card.rank + 1;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
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

function renderCards(container, hand, { hideSecond = false } = {}) {
  const el = $(container);
  el.textContent = "";
  hand.forEach((card, i) => {
    el.appendChild(cardEl(card, hideSecond && i === 1));
  });
}

function setMessage(text, cls = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${cls}`;
}

function totalEl(id, hand, { hide = false } = {}) {
  const el = $(id);
  if (hide || hand.length === 0) {
    el.textContent = "";
    el.className = "hand-total";
    return;
  }
  const value = handValue(hand);
  el.textContent = value;
  el.className = "hand-total" + (value > 21 ? " bust" : isBlackjack(hand) ? " bj" : "");
}

function render() {
  const playing = state.phase === "player";
  const hideHole = state.phase === "player"; // dealer's second card stays hidden on your turn

  renderCards("dealer-cards", state.dealerHand, { hideSecond: hideHole });
  renderCards("player-cards", state.playerHand);

  totalEl("player-total", state.playerHand);
  totalEl("dealer-total", hideHole && state.dealerHand.length > 0
    ? [state.dealerHand[0]]
    : state.dealerHand, { hide: state.dealerHand.length === 0 });

  $("chips").textContent = state.chips;
  $("wins").textContent = state.wins;
  $("losses").textContent = state.losses;
  $("pushes").textContent = state.pushes;
  $("bet-amount").textContent = BET_STEPS[state.betIndex];

  $("bet-row").hidden = state.phase !== "betting";
  $("actions").hidden = !playing;

  $("deal-btn").disabled = state.chips < BET_STEPS[state.betIndex];
  $("hit-btn").disabled = !playing;
  $("stand-btn").disabled = !playing;
  // Double only on the first decision, and only if you can cover it.
  $("double-btn").disabled = !playing || state.playerHand.length !== 2 ||
    state.chips < state.bet;
}

// ---------- Game flow ----------
function deal() {
  const bet = BET_STEPS[state.betIndex];
  if (state.chips < bet) return;

  state.bet = bet;
  state.chips -= bet;
  state.doubled = false;
  state.deck = newShoe();
  state.playerHand = [state.deck.pop(), state.deck.pop()];
  state.dealerHand = [state.deck.pop(), state.deck.pop()];
  state.phase = "player";

  // Naturals end the hand immediately.
  const playerBJ = isBlackjack(state.playerHand);
  const dealerBJ = isBlackjack(state.dealerHand);
  if (playerBJ || dealerBJ) {
    state.phase = "done";
    if (playerBJ && dealerBJ) {
      push("Both blackjack — push.");
    } else if (playerBJ) {
      settle(Math.floor(state.bet * 2.5), "Blackjack! Pays 3:2.", "win", true);
    } else {
      settle(0, "The Bandit has blackjack.", "lose");
    }
    render();
    return;
  }

  setMessage("Hit, stand, or double.");
  render();
}

function hit() {
  if (state.phase !== "player") return;
  state.playerHand.push(state.deck.pop());
  const value = handValue(state.playerHand);
  if (value > 21) {
    state.phase = "done";
    settle(0, `Bust with ${value}. The Bandit takes it.`, "lose");
  } else if (value === 21) {
    setMessage("21! Standing automatically.");
    state.phase = "dealer";
    render();
    dealerPlay();
    return;
  } else {
    setMessage(state.doubled ? "Doubled — one card only." : "Hit again?");
  }
  if (state.doubled) {
    state.phase = "dealer";
    render();
    dealerPlay();
    return;
  }
  render();
}

function stand() {
  if (state.phase !== "player") return;
  state.phase = "dealer";
  render();
  dealerPlay();
}

function doubleDown() {
  if (state.phase !== "player" || state.playerHand.length !== 2) return;
  if (state.chips < state.bet) return;
  state.chips -= state.bet;
  state.bet *= 2;
  state.doubled = true;
  setMessage("Bet doubled — one card coming.");
  hit(); // exactly one card, then the dealer plays
}

async function dealerPlay() {
  await sleep(700);
  // Reveal the hole card, then hit to 17.
  render();
  await sleep(500);
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(state.deck.pop());
    render();
    await sleep(650);
  }

  state.phase = "done";
  const player = handValue(state.playerHand);
  const dealer = handValue(state.dealerHand);

  if (dealer > 21) {
    settle(state.bet * 2, `The Bandit busts with ${dealer}. You win!`, "win", true);
  } else if (player > dealer) {
    settle(state.bet * 2, `${player} beats ${dealer}. You win!`, "win", true);
  } else if (player < dealer) {
    settle(0, `${dealer} beats your ${player}.`, "lose");
  } else {
    push(`Both ${player} — push.`);
  }
  render();
}

// payout = total chips returned (stake + winnings). 0 on a loss.
function settle(payout, text, cls, isWin = false) {
  state.chips += payout;
  if (isWin) state.wins++;
  else state.losses++;
  setMessage(text, cls);
  checkBust();
}

function push(text) {
  state.chips += state.bet;
  state.pushes++;
  setMessage(text, "push");
}

function checkBust() {
  if (state.chips <= 0) {
    setMessage("The Bandit cleaned you out. Refresh for revenge.", "lose");
  }
}

function changeBet(delta) {
  state.betIndex = Math.min(Math.max(state.betIndex + delta, 0), BET_STEPS.length - 1);
  render();
}

$("deal-btn").addEventListener("click", deal);
$("hit-btn").addEventListener("click", hit);
$("stand-btn").addEventListener("click", stand);
$("double-btn").addEventListener("click", doubleDown);
$("bet-up").addEventListener("click", () => changeBet(1));
$("bet-down").addEventListener("click", () => changeBet(-1));
document.addEventListener("keydown", (e) => {
  if (state.phase === "player") {
    if (e.key === "h") hit();
    else if (e.key === "s") stand();
    else if (e.key === "d") doubleDown();
  } else if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    deal();
  }
});

render();
