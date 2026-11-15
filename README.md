# Bandit Arcade 🥷

A suite of little casino games. Pure HTML/CSS/JS — no build step, no backend,
no accounts, no real money. Just play.

![deps](https://img.shields.io/badge/deps-zero-green) ![games](https://img.shields.io/badge/games-6-blue)

## Games

| Game | Path | What |
| --- | --- | --- |
| 🎰 **Bandit Slots** | `/slots/` | One-armed bandit: 3 reels, weighted odds, staggered stops |
| ♠️ **Texas Hold'em** | `/holdem/` | Heads-up poker against the Bandit — bet, call, raise, fold |
| 🃏 **Blackjack** | `/blackjack/` | Beat the dealer to 21 — hit, stand, double down, 3:2 blackjack |
| 🐤 **Flappy Bandit** | `/flappy/` | Canvas arcade — flap through the towers, chase the high score |
| 🐍 **Snake** | `/snake/` | Eat the loot, grow the tail, don't eat yourself |
| 🫧 **Bubble Bandit** | `/bubble/` | Bubble shooter — aim, fire, match 3 to pop, clear the board |

## Play locally

It's a static site — serve the folder and open it:

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

Or with Docker:

```sh
docker build -t bandit-arcade .
docker run --rm -p 8080:80 bandit-arcade
# → http://localhost:8080
```

## Deploy

Push this repo to GitHub (public is fine) and point your platform at it —
it's a plain static site with a `Dockerfile` if the platform prefers containers.
No environment variables, no secrets, no build step.

The container listens on **8080** and runs as the **non-root `nginx` user**,
so it drops straight into platforms that require both (e.g. portalcloud):

- **Address:** pick a short name (first come, first served)
- **Build:** give the portal this repo's URL — it builds the root `Dockerfile`
  from the default branch (`.git`, `node_modules`, and `.dockerignore` entries excluded)
- **Port:** `8080` · **Replicas:** `1`
- **Env / secrets:** none needed

## Design

Follows the Burtson Labs front-end standards (from the Burtson.io theme):
Roboto, dark surfaces (`#303030` / `#424242`), indigo primary `#3f51b5`,
pink secondary `#f50057`, React-blue `#61dafb` accents. Shared styles live in
`theme.css`; each game adds its own stylesheet on top. Fully self-contained —
no external assets, fonts, or icon services.

## Files

| Path | What |
| --- | --- |
| `index.html` | Suite home page |
| `theme.css` | Shared Burtson-standard theme |
| `slots/` | Bandit Slots |
| `holdem/` | Texas Hold'em |
| `blackjack/` | Blackjack |
| `flappy/` | Flappy Bandit |
| `snake/` | Snake |
| `bubble/` | Bubble Bandit |
| `Dockerfile` / `nginx.conf` | Optional container for static hosting |

## License

MIT — see [LICENSE](LICENSE).
