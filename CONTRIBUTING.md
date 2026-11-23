# Contributing to FEASTFALL

Thanks for wanting to make the animals smarter, sneakier or better looking.

## Setup

```bash
git clone https://github.com/vnmoorthy/feastfall && cd feastfall
npm install
cp .env.example .env
npm run dev                          # node --watch server/index.js on :8787
brew install bruin-data/tap/bruin    # for the learning loop
npm run bruin
```

Open http://localhost:8787 in two tabs to play as two humans on one machine, and `http://localhost:8787/?tv` for the spectator view.

## Where things live

- **Agent brain** (utilities, trust, council, ledger, learning): `server/game.js`
- **Server, API, Bruin runner**: `server/index.js`
- **Art prompts and Runware client**: `server/runware.js`
- **Client** (Three.js, HUD, voices, WebCrypto): `public/main.js`, `public/index.html`, `public/style.css`
- **Memory pipeline**: `bruin/feastfall_memory/assets/*.sql`

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how they connect.

## Ground rules

1. **No scripted outcomes.** A new behaviour should be a utility term, a trust update or a world rule, not an `if (match 2) say X`. If it can't be explained by the ledger, it doesn't belong.
2. **Log it.** Any new agent action that matters should go through `log()`, or `sealedLog()` if it's secret, with a human-readable `reason` and its `utility`.
3. **Keep it offline.** The game must run with no API key and no network. Network features need a cached or local fallback.
4. **Keep Bruin honest.** If you add a ledger action, add it to the `accepted_values` check in `raw_ledger.sql`. If you add a mart, give it checks.
5. **Keep the server authoritative.** Clients send intents; the server decides. Never send hidden roles or the stash to clients before the reveal.

## Pull requests

- One change per PR, with a short description of what changes in play.
- For agent behaviour changes, attach a ledger excerpt (`/api/ledger/<match>.jsonl`) from a match that shows the new behaviour.
- For pipeline changes, paste the output of `npm run bruin` showing the checks passing.
- For visual changes, attach a screenshot.

## Reporting bugs and ideas

Use the issue templates in `.github/ISSUE_TEMPLATE/`. A match id and its ledger make agent bugs much easier to reproduce.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
