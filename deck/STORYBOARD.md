# FEASTFALL: Storyboard and Run-of-Show

> "Thanksgiving, but everyone's lying — and the animals remember what you did last year."
> Multiplayer AI Hackathon · Finch.AI × Crewbase · AWS Builder Loft SF · Nov 23 2026 · Co-op Multiplayer Game track
> Repo: https://github.com/vnmoorthy/feastfall

Decks: `deck/Feastfall.pptx` (primary, Morph transitions) · `deck/index.html` (backup: any browser, arrow keys, **F** fullscreen).

**Setup:** in the `feastfall` folder run `npm start` → http://localhost:8787.
Projector / TV view: **http://localhost:8787/?tv** (auto spectator mode: cinematic orbit camera, Director panel open, "Scan to play" QR bottom-right).
Phones and laptops on the same Wi-Fi scan that QR (LAN URL `http://<laptop-ip>:8787`), or click **📱 Join QR** for a big QR.

---

## Part 1: The 3-minute pitch (0:00–3:00)

About 18 s per slide. **Cut to the live TV view at 1:30, back to the deck at 1:55.** If the demo machine fails, stay on slide 6 and read the quote aloud.

| Time | On screen | What to say |
|---|---|---|
| **0:00–0:18** | **1 · Title**: FEASTFALL, tagline, five animal portraits | "This is Feastfall. Thanksgiving, but everyone's lying — and the animals remember what you did last year. Humans and five AI animals, one island, one feast, one traitor." |
| **0:18–0:36** | **2 · Problem**: giant "0", two cards | "Game NPCs are scripted and amnesiac — betray them or save them, they reset when the match ends. And party games are human-only: AI never gets a seat at the table. Zero grudges." |
| **0:36–0:54** | **3 · The Game**: Gather → Betray → Accuse → Council → Feast | "Join from any phone by QR. Gather berries, fish and wood into the Granary before sunset. One animal is secretly the traitor: it steals only when nobody's watching and can set a wildfire as a distraction. Marigold calls a council, everyone votes, and exile reveals the role." |
| **0:54–1:12** | **4 · Meet the agents**: five cards | "Bram the trusting builder. Juniper the vigilant detective. Vex the charming merchant. Marigold the elder. Pip, chaotic and brave. Each has its own voice, and the traitor is random every match." |
| **1:12–1:30** | **5 · Emergence**: Perception → Trust → Utility → Action, ledger panel | "Agents only know what they see. Each keeps a trust score toward every player, updated by witnessed thefts, deposits and gifts. Every action is utility-scored and logged live. The traitor's secret moves are sealed with SHA-256 and revealed at the end — proof the AI didn't cheat." |
| **1:30–1:55** | **6 · The grudge** → **CUT TO LIVE TV VIEW** (http://localhost:8787/?tv, match 2 ready) | "Here's what that looks like." *(Join as "Moorthy".)* Juniper's golden memory bubble and voice: *"Moorthy. Last feast: 6 stolen. I keep records. I am watching you."* "Not a script. Every trust bar toward me starts red — that's last match's memory." |
| **1:55–2:13** | **BACK TO DECK** · **7 · Architecture** | "Three.js clients over WebSocket to a Node server running an authoritative 10 Hz sim. Every event goes to a JSONL ledger; Bruin turns it into reputation and policy priors the server hot-loads. Runware generated all 14 images — 5 portraits, 8 event scenes and the hero — in about 2.5 seconds, in parallel." |
| **2:13–2:31** | **8 · Learning loop + Bruin** | "Bruin is the memory: 6 assets and 27 column quality checks on DuckDB, in about a tenth of a second. After each match, policies get a reward update — utility AI plus tabular reinforcement. No LLM, runs offline. In a headless test, theft, witness, accusation, council and the traitor's exile all happened with no scripting." |
| **2:31–2:47** | **9 · Checklist** | "Our agents move, interact, compete, cooperate, and decide outcomes. Every requirement, every bonus: 3D, memory, voice. In one live test the agents even exiled me — because of the Bruin grudge." |
| **2:47–3:00** | **10 · Vision**: "NPCs that hold grudges" | "NPCs that hold grudges: persistent-memory social agents for any game, starting with a party game for your family table. Next: LLM dialogue, Twitch-plays, BAND for cross-tool agent comms. Scan the QR, play a round, get remembered." |

**Hard cut rule:** if you're past **2:40** when you reach slide 9, skip to slide 10.

---

## Part 2: The 10-minute live demo run-of-show (0:00–10:00)

**Driver** runs the laptop and projector; **Narrator** talks (can be the same person).
Bottom-left buttons: **🎬 Director** · **🧠 Memory** · **🔊 Voices on** · **📱 Join QR** · **❔** (help).
Player controls: WASD/arrows or tap the ground to move · **E** Gather/Deposit/Fight fire · **Q** Take (steal) from Granary · **F** Eat · **G** Gift · **T** Talk · **🎙️** mic to speak to agents (Chrome speech recognition).

| Time | Action (exact clicks) | What judges see / what to say |
|---|---|---|
| **0:00** | Projector shows **http://localhost:8787/?tv**: orbit camera, Director panel open, QR bottom-right. Click **📱 Join QR** for the big QR. | "Grab your phone and scan the QR." |
| **0:30** | Judges scan → type a name → **Join the island →**. Driver joins in a second tab as **Moorthy**. | Names appear. Juniper's golden memory bubble + voice: *"Moorthy. Last feast: 6 stolen. I keep records. I am watching you."* Camera focuses on her; every agent's trust bar toward Moorthy starts red. |
| **1:15** | Director panel: speed **2×**, day length **3.5m**, tick **🌶️ Drama mode (greedier traitor)**, click **▶ Start match**. | "Drama mode makes the traitor greedier so the social play shows up in minutes." |
| **1:45** | Judges walk to bushes / fishing spots / trees, press **E** to gather, then **E** at the Granary to deposit. Try **T** Talk: "who is the traitor?", "do you trust me?", "hi". | Granary fills; agents answer by voice. Point at the right panel **Decision Ledger**: "every decision with its utility scores." |
| **3:00** | Ledger filter **🔒 Sealed**. | Sealed rows show only a sha256 commitment. "The traitor just did something nobody saw. The hash is committed; we can't read it yet." |
| **3:45** | If a **wildfire** starts: judges press **E** near it to fight the fire. Ledger filter **Drama**. | "The traitor set that fire — an agent-caused world event, a distraction so it can steal." |
| **4:30** | Watch for an **accusation** (Juniper usually first). Ledger filter **Agents**. | "Juniper only accuses because she *saw* the theft. Trust comes from witnessed events." |
| **5:15** | Wait for Marigold, or Director **🔥 Force council**. | **🔥 The Council** modal: 20 s countdown, ballot portraits, live vote pips with each agent's vote and reason. |
| **5:30** | Judges tap a portrait to vote on their phones. | "Humans and agents vote together." |
| **6:00** | Exile reveal. | e.g. **"⚖️ VEX WAS THE TRAITOR!"** + stash returned, or innocence revealed. Sealed entries flip open: **"✅ commitment verified (SHA-256 matches the sealed hash)"**. |
| **6:45** | Director **⏹ End at sunset now**. | End screen: hero art, **🔓 Unsealed: the traitor's private decisions**, **📈 What the agents learned this match** (policy weights before → after, reward ±1), **🤝 Trust toward humans (start → end)**. |
| **7:30** | On the end screen, point at **🧠 Bruin pipeline** live log (or click **Re-run Bruin**). Optional terminal: `npm run bruin` (runs `scripts/run-bruin.sh` → `bruin run bruin/feastfall_memory`). | "6 assets, 27 quality checks, about 0.1 s." Show the reputation table. Optional: **⬇ Ledger JSONL**. |
| **8:30** | Click **🧠 Memory** to show what each agent remembers about each human. | "This is persistent memory, not a prompt." |
| **9:00** | Click **▶ Next match (agents remember)**. | Agents start with learned trust; whoever stole this round gets called out by name. |
| **9:40** | Close. | "Feastfall: NPCs that hold grudges. Built on Bruin and Runware. github.com/vnmoorthy/feastfall." |

### Pre-demo checklist (15 minutes before)
- [ ] `npm start` running; **http://localhost:8787/?tv** fullscreen on the projector; QR readable from the back row.
- [ ] Laptop and phones on the **same Wi-Fi**; one phone join tested via the LAN URL `http://<laptop-ip>:8787`.
- [ ] Click once on the TV view so the browser allows audio; **🔊 Voices on**; volume up.
- [ ] Runware images cached in `data/images/` (no live API call needed).
- [ ] A prior match exists where "Moorthy" stole, and `npm run bruin` has run, so the grudge fires on join.
- [ ] Chrome for the 🎙️ mic (speech recognition).

### Fallbacks
- **Wi-Fi fails:** run everything on the laptop — TV view in one window, a second tab joined as a player.
- **Council doesn't happen naturally:** Director **🔥 Force council**.
- **Match too slow:** speed **4×**, day length **2m**.
- **Laptop or projector fails:** present `deck/index.html` from any machine; slide 6 carries the grudge quote.
