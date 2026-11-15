// Bandit Slots — a one-armed bandit. No backend, all client-side.

// Reel symbols with weights and payouts.
const SYMBOLS = [
  { id: "ninja",  emoji: "🥷", weight: 2,  pay3: 50, pay2: 10 },
  { id: "coin",   emoji: "💰", weight: 4,  pay3: 25, pay2: 6  },
  { id: "gem",    emoji: "💎", weight: 5,  pay3: 15, pay2: 4  },
  { id: "star",   emoji: "⭐", weight: 7,  pay3: 10, pay2: 3  },
  { id: "bolt",   emoji: "⚡", weight: 9,  pay3: 6,  pay2: 2  },
  { id: "cherry", emoji: "🍒", weight: 11, pay3: 4,  pay2: 1  },
];

const BET_STEPS = [5, 10, 25, 50, 100];
const START_CREDITS = 100;

const state = {
  credits: START_CREDITS,
  betIndex: 1,
  spins: 0,
  lastWin: 0,
  spinning: false,
};

const $ = (id) => document.getElementById(id);
const reels = [$("reel-0"), $("reel-1"), $("reel-2")];
const messageEl = $("message");
const leverBtn = $("lever");

function setReelSymbol(reel, sym) {
  reel.querySelector(".symbol").textContent = sym.emoji;
}

function pickSymbol() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const sym of SYMBOLS) {
    roll -= sym.weight;
    if (roll <= 0) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function scoreSpin(results) {
  const [a, b, c] = results;
  if (a.id === b.id && b.id === c.id) {
    return { win: a.pay3, kind: "three", sym: a };
  }
  // Any adjacent pair pays the pair rate of the better symbol.
  if (a.id === b.id) return { win: a.pay2, kind: "pair", sym: a };
  if (b.id === c.id) return { win: b.pay2, kind: "pair", sym: b };
  return { win: 0, kind: "none", sym: null };
}

function render() {
  $("credits").textContent = state.credits;
  $("last-win").textContent = state.lastWin;
  $("spins").textContent = state.spins;
  $("bet-amount").textContent = BET_STEPS[state.betIndex];
  leverBtn.disabled = state.spinning || state.credits < BET_STEPS[state.betIndex];
}

function setMessage(text, cls = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${cls}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spin() {
  if (state.spinning) return;
  const bet = BET_STEPS[state.betIndex];
  if (state.credits < bet) {
    setMessage("Not enough credits — lower your bet.", "lose");
    return;
  }

  state.spinning = true;
  state.credits -= bet;
  state.spins += 1;
  state.lastWin = 0;
  reels.forEach((r) => r.classList.remove("win"));
  setMessage("The bandit is thinking…");
  render();

  const results = [pickSymbol(), pickSymbol(), pickSymbol()];

  // Staggered reel stop, left to right, like a real machine.
  for (let i = 0; i < reels.length; i++) {
    reels[i].classList.add("spinning");
  }
  for (let i = 0; i < reels.length; i++) {
    await sleep(450 + i * 350);
    reels[i].classList.remove("spinning");
    setReelSymbol(reels[i], results[i]);
  }

  const { win, kind, sym } = scoreSpin(results);
  const payout = win * bet;

  if (payout > 0) {
    state.credits += payout;
    state.lastWin = payout;
    reels.forEach((r) => r.classList.add("win"));
    if (kind === "three") {
      setMessage(`JACKPOT! Three ${sym.id}s — you took the bandit for ${payout}!`, "big");
    } else {
      setMessage(`Pair of ${sym.id}s — won ${payout}.`, "win");
    }
  } else {
    setMessage(state.credits > 0 ? "The bandit keeps your coin. Again?" : "Cleaned out! Refresh to play again.", "lose");
  }

  state.spinning = false;
  render();
}

function changeBet(delta) {
  state.betIndex = Math.min(Math.max(state.betIndex + delta, 0), BET_STEPS.length - 1);
  render();
}

function buildPaytable() {
  const table = $("paytable");
  const rows = SYMBOLS.map(
    (s) => `<tr><td>${s.emoji} ${s.id}</td><td>3× → ${s.pay3}× bet · pair → ${s.pay2}× bet</td></tr>`
  ).join("");
  table.innerHTML = rows;
}

leverBtn.addEventListener("click", spin);
$("bet-up").addEventListener("click", () => changeBet(1));
$("bet-down").addEventListener("click", () => changeBet(-1));
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    spin();
  }
});

buildPaytable();
render();
