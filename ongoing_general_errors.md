# Kanjion — Tracking: Findings, Decisions, Owner Actions

Companion to [`agent_execution_guide.md`](agent_execution_guide.md). The product brief is [`concepts_brief.md`](concepts_brief.md).

- **Findings (F-n)** are problems verified in the code on 2026-11-07, with `file:line`.
- **Decisions (D-n)** are choices the owner makes. Each has a `Your selection:` line. The review pre-filled its recommendation; the owner may change any line before handing the guide to an implementor. The implementor follows whatever is written there. Where a selection differs from `concepts_brief.md`, the selection wins and the implementor updates the brief's Decision Log in the same commit.
- **Owner actions (OA-n)** are things only the owner can do (console access, keys, deploys).
- When a guide item lands, move its F-entries to **Resolved** with a one-line note and the commit hash.

---

## Owner actions

| ID | Needed by | Action |
|---|---|---|
| OA-1 | Item 11 | Firebase console → Build → **AI Logic** → Get started → choose **Gemini Developer API**. Keep project `kanjion-game` on the **Spark** plan: the Gemini Developer API free tier requires a project with no Cloud Billing account. Verified 2026-11-07 via the Firebase CLI environment: billing **disabled**. |
| OA-2 | Item 11 | Register a **Web app** in the Firebase project, or reuse an existing one. On 2026-11-07 the Firebase CLI detected no web-app config in this folder. Copy its config into `.env.local`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. |
| OA-3 | Item 11 | **App Check**: create a reCAPTCHA v3 site key for `kanjion-game.web.app` (do **not** add `localhost`), register it for the web app under App Check, and put it in `.env.local` as `VITE_APPCHECK_SITE_KEY`. For local development, register a debug token. Turn on App Check **enforcement** for AI Logic once its metrics show verified requests. |
| OA-4 | Item 11 | In AI Studio, open the project's rate-limit view and pick the newest Flash-Lite (or Flash) model that shows a **Free-tier** quota. Put its ID in `.env.local` as `VITE_AGENT_MODEL_ID` and record the limits here → RPM: ____ · RPD: ____ |
| OA-5 | After item 11 | Deploy: `npm run build && firebase deploy --only hosting`. The implementor never deploys. |

---

## Decisions (owner selects)

### D-1 · How the free model reaches players
Locked by the owner: **the model must be free.** Everything else here is open.

Context. Today's agent (`BrowserGeminiNanoTransport`) only calls Chrome's on-device Gemini Nano when the model is *already* downloaded (`src/engine/cloud_connector.ts:1126-1133`), and even then the regex answer wins whenever it matches (`:1174-1183`). Chrome's Prompt API runs only on desktop Chrome (Windows 10/11, macOS 13+, Linux, Chromebook Plus). It needs ≥22 GB free disk and either >4 GB VRAM or 16 GB RAM with 4 cores, and it is not available on Android or iOS (Chrome docs, last updated 2026-10-21). In practice almost every player gets the regex.

- **A. Free-tier Gemini Developer API through Firebase AI Logic** (client SDK, Spark plan, App Check). Cloud-only for scored play, with a deterministic data-driven fallback whenever the cloud fails or the quota runs out. *(Recommended.)*
  - Pros: works on every browser; one model for everyone, so scores are comparable; no server to run.
  - Costs: one free quota is shared by the whole project, so traffic spikes fall back. Google no longer publishes per-model free-tier numbers: your project's limits are in AI Studio's rate-limit dashboard (OA-4). A third-party summary of Google's pricing page (Sept 2026) lists the current Flash-Lite models as free of charge. Free-tier prompts may be used by Google to improve its products, which needs a disclosure. There is no cross-player cache.
- **B. A, plus Firebase's `PREFER_IN_CLOUD` hybrid mode**, so desktop Chrome with Nano takes over when the cloud fails. More AI coverage during spikes, but on-device answers differ from cloud answers, so the same line can score differently.
- **C. Keep Nano as the primary** (brief decision #15). Trigger the model download on a user gesture, send the page image, and keep a data-driven fallback. No quota, but no phones at all and a different agent per device.
- **D. A trusted proxy on a free serverless plan** (e.g. Cloudflare Workers) holding a free-tier key from an unbilled project, plus a shared cross-player decision cache. Best consistency and scaling, but adds a second platform and account to run.

Your selection: A

### D-2 · Branding inside the sandbox
Context. The live pages show:
- "えきねっと JR" in the header (`src/components/ShinkansenSandbox.tsx:121`);
- a fake `eki-net.com/personal/page-NN` address (`:202`);
- a ログアウト (log out) button (`:131-138`), which implies a logged-in account;
- name entry, a signature pad and a payment-style confirm button, all on a non-JR domain.

That combination is the pattern phishing classifiers flag, and a Safe Browsing flag on `kanjion-game.web.app` would block the whole game. The original brief asked for parody branding.

- **A. Fictional brand inside the sandbox**, keeping the real site as an explicit outbound link: *(Recommended.)*
  - header "かんじおん鉄道" + "新幹線ネット予約";
  - URL bar `sandbox://kanjion-rail.example/reserve/<page>`;
  - ログアウト replaced by an お知らせ (news) decoy;
  - "Inspired by eki-net.com ↗" links in the header, menu and report.
- B. Keep the real branding.

Your selection: A

### D-3 · What happens after the dossier unseals
Context. "Return to Active Play" (`src/components/ExhibitsPanel.tsx:226-235`, `src/engine/game_reducer.ts:572-582`) reopens the scored game after the answer key is shown, and closing again replaces the score (probe: 50 → 140). Nothing persists, so a refresh is a free retry.

- **A. The first close is the official result.** It is persisted in localStorage along with the in-progress game. The button becomes "↺ Practice this case (unscored)", which starts a fresh unscored run, and the share card always shows the official result. *(Recommended.)*
- B. Keep today's behavior.

Your selection: A

### D-4 · The flash-sale timing on page 03
Context. The flash bar cycles every 950 ms, but nothing checks it: any click on the green seat records `timedWindowHit = true` (`src/engine/game_reducer.ts:164`), while Exhibit C's criteria say the click was timed (`src/data/puzzles/case_042.ts:414`).

- **A. Make the timing real and deterministic.** *(Recommended.)*
  - The green seat shows `¥13,870 (特割)` while the highlight is on its column and `¥19,590` otherwise.
  - A plain CLICK always lands outside the window (¥19,590).
  - TIMED_CLICK waits for the window (¥13,870).
  - Exhibit C requires ¥13,870.
- B. Drop the timing: remove TIMED_CLICK and the "timed" wording from the brief and the criteria, and leave the bar decorative.

Your selection: A

### D-5 · Do traps cost anything?
Context. With positive-only exhibits, the ¥2,400 insurance banner and checkbox cost nothing beyond a wasted line.

- **A. Exhibit E keeps the title "Final Blue Confirm".** *(Recommended.)* The title stays positive and Exhibit D stays signed-or-missed, as the brief decided.
  - VERIFIED when the booking is confirmed with no add-on.
  - CONTAMINATED when it is confirmed with the ¥2,400 insurance attached; the report shows the note "¥2,400 travel insurance was attached".
  - MISSED when it is never confirmed.
- B. Traps cost only the line they waste.

Your selection: A

### D-6 · When the daily case rolls over
- **A. The player's local midnight** (Wordle-style). *(Recommended.)*
- B. 00:00 JST.
- C. 00:00 UTC.

Your selection: A

### D-7 · Phones
Context. At 375 px wide, the 1024×768 stage renders at 0.32×, so Japanese text is about 4 px tall.

- **A. A "🔍 Zoom" toggle on the agent page and the replay.** It renders the stage at 2× its fit scale inside a pannable box. *(Recommended.)*
- B. Show "Best on a laptop" and change nothing else.

Your selection: A

---

## Open findings (verified 2026-11-07)

| ID | Severity | Finding | Where | Fixed by |
|---|---|---|---|---|
| F-2 | Critical | The answer "TANAKA" is the agent's default and is printed on the page. | TYPE defaults: `src/engine/cloud_connector.ts:758`, `:1440`; `src/engine/game_reducer.ts:153`; `src/App.tsx:215`; `src/engine/offline_simulator.ts:133-135`<br>Prompts: `src/engine/cloud_connector.ts:1146`; `functions/src/index.ts:288`<br>Page hints: `src/components/ShinkansenSandbox.tsx:426`, `:443`, `:455`<br>Shown when nothing was typed: `:484`, `:709`, `:886`<br>Gating message: `src/engine/game_reducer.ts:92`<br>Default signature thought "drawing a very fancy squiggly "T. Tanaka"": `src/utils/text_normalizer.ts:408` | Items 4, 5 |
| F-3 | Critical | Gibberish and meta-prompts ("asdf qwerty zxcv", "complete the task", "click the winning button") click the winning Confirm button on page 04, because the always-act fallback for MV-04 targets #30. | `src/engine/cloud_connector.ts:1019-1027` | Items 4, 10 |
| F-4 | High | The mark-ID guardrail only works on page 03. It checks the current view's element list, which is empty on 11 of 12 views, so "#1", "#17" and "#30" get through. | `src/engine/cloud_connector.ts:1300`; `src/data/puzzles/case_042.ts:245-369` | Items 4, 6 |
| F-6 | High | Players almost never reach a model. Nano is used only if it is already downloaded, the regex wins whenever it matches, and everything else is a ~450-line regex. | `src/engine/cloud_connector.ts:1126-1133`, `:1174-1183`, `:602-1046` | Items 10, 11 |
| F-7 | High | No model ever receives an image. | All 24 `.webp` files in `public/puzzles/042/views/` are 0 bytes; 11 of 12 SoM SVGs are empty<br>`--case 042` re-serializes the TS fixture: `tools/lib/offline_compiler.ts:108`<br>`template.html` is a hard-coded stub: `:136-160`<br>The game never loads `manifest.json` | Item 9 |
| F-9 | Medium | The sandbox impersonates a real railway brand. | `src/components/ShinkansenSandbox.tsx:121`, `:202`, `:131-138` | Item 5 |
| F-10 | Medium | The live pages carry English glosses that announce outcomes, plus internal codes: "(WRONG ROUTE)", "(Page 10)", "REQUIRED TYPE FIELD", "DRAW SIGNATURE HERE", "（赤ボタン）", "（MV-10）". | `src/components/ShinkansenSandbox.tsx:226`, `:242`, `:298-360`, `:379-455`, `:479-492`, `:670-745`, `:822`, `:852-892`, `:907-975` | Item 5 |
| F-11 | Medium | The timed click isn't timed, so Exhibit C's criteria are false. | `src/engine/game_reducer.ts:159-169`; `src/data/puzzles/case_042.ts:409-423` | Item 7 |
| F-12 | Medium | Puzzle behavior is a per-ID `switch` statement. MV-06, MV-07, MV-08 and MV-09 never render, `activeModal` is set but never drawn, and page gating keys off `signatureSigned === false`. | `src/engine/game_reducer.ts:53-299`; `src/data/puzzles/case_042.ts:304-342` | Item 6 |
| F-13 | Medium | Cursor targets come from a hand-tuned percentage table. The manifest centers the green seat at (885, 468), but it renders near (875, 392). The URL bar says "seat-matrix" on every page. | `src/App.tsx:131-150`; `src/data/puzzles/case_042.ts:166-183`; `src/components/SandboxStage.tsx:109` | Items 5, 6 |
| F-15 | Low | There is no daily schedule or rollover; the one case is hard-coded. | — | Item 12 |
| F-16 | Low | Phones show the stage at 0.32×, which is too small to read. | `src/components/SandboxStage.tsx:24-59` | Item 13 |
| F-17 | Low | Dead code. | `functions/` can't deploy on Spark and nothing calls it<br>Dev-server regex middleware duplicates the agent: `vite.config.ts:10-383`<br>Unused components: `GhostReplay`, `CoordinateRulers`, `DossierLayout`<br>Single-page sandbox branch used only by tests: `src/components/ShinkansenSandbox.tsx:985-1464` | Items 1, 2, 10, 11 |
| F-18 | Low | Paste isn't blocked in the instruction box, and its placeholder hints at the page-03 answer. | `src/components/DispatchPad.tsx:132-145`, `:141` | Item 5 |
| F-19 | Low | `/puzzles/**` is served `immutable` for a year, so regenerating a file under the same name would leave players on stale assets. | `firebase.json:43-47` | Item 9 |
| F-20 | Low | The Japanese font loads from the Google Fonts CDN, so SoM captures and players' screens can lay out differently. | `index.html:9-11` | Item 9 |

Reproduce F-1 to F-5 with `npx tsx scripts/exploit_probe.mts`.

---

## Blocked — needs owner
_(none yet — implementors add entries here as options with a `Your selection:` line)_

## Resolved
- F-1 — resolved by item 3 (deleted hidden shortcut #16, gated Exhibit B on `passengerName === 'TANAKA'` and Exhibit D on non-empty `signatureStroke`, removed `CLEAN` and `signatureSigned`, and added BFS solvability proof that minimum steps to 100% = 5)
- F-5 — resolved by item 3 (locked `officialResult` on first official `CLOSE_CASE`, replaced `REOPEN_CASE` with unscored `START_PRACTICE`, and added `kanjion:v1:case:001` persistence across refreshes)
- F-8 — resolved by item 2 (removed all `sr-only` hidden test strings and unused debug toggles; item 1 `5efae7f` removed `NODE_ENV` and `navigator.webdriver` branches, added `GameConfig`, and added Playwright `e2e/smoke.e2e.ts`)
- F-14 — resolved by item 2 (renamed Case #042 to Case #001 everywhere, updated share card URL to `https://kanjion-game.web.app`, and rendered lines 1–2 of `scoreReport.shareableClipping` in `ExhibitsPanel.tsx`)
- F-17 (part) — resolved by item 2 (deleted unused `GhostReplay.tsx`, `CoordinateRulers.tsx`, and `DossierLayout.tsx`; item 1 `5efae7f` deleted single-page test-only sandbox branch)

## History
- **2026-11-07** — Reviewed the build against the original and the updated concept briefs.
  - Ran `npm test` (443/443 pass, 19 files), `npm run build` (clean) and the compiler dry-run (exit 0).
  - Playwright has no config or specs ("No tests found").
  - Reproduced F-1, F-2, F-3, F-4 and F-5 with `scripts/exploit_probe.mts`, and F-1 in the browser: the 4-line shortcut scored 140 in the live UI.
  - Saved the updated brief to `concepts_brief.md` (the previous version is in git history).
  - Wrote `agent_execution_guide.md` (Active Build).
