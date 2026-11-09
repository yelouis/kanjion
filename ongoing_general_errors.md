# Kanjion — Tracking: Findings, Decisions, Owner Actions

Companion to [`agent_execution_guide.md`](agent_execution_guide.md). The product brief is [`concepts_brief.md`](concepts_brief.md).

- **Findings (F-n)** are problems verified in the code, with `file:line`. Each findings section is dated.
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
| OA-5 | After item 11 | Deploy: `npm run build && firebase deploy --only hosting`. The implementor never deploys. **Still pending on 2026-11-08:** the live site serves the pre-fix bundle `assets/index-DWnC1R4E.js` (F-27). |

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

### D-8 · Red herrings
Context. Each step's target is the only thing on its page with its most obvious feature, so one word ("green", "blue") solves the step (F-21).

- **A. Realistic clutter, modelled on how real Japanese booking sites actually look.** The joke is how hard real sites are to navigate. *(Owner's choice, 2026-11-08.)* Examples:
  - route cards in each line's real livery colour;
  - campaign banners and service tabs;
  - a kanji / katakana / romaji name grid;
  - a dense timetable;
  - 確認 ("review") and 確定 ("finalize") buttons side by side.
- B. Artificial duplicates, such as two identical green buttons.

Your selection: A

### D-9 · Feints in the replay
- **A. No feints.** The replay shows only the steps to copy, so it's never unclear what should be replicated. *(Owner's choice, 2026-11-08.)*
- B. Feints: the replay hovers over or types something, then corrects it.

Your selection: A

### D-10 · How the agent behaves when an instruction is vague
- **A. A literal-minded intern with consistent rules a player can learn.** *(Owner's choice, 2026-11-08.)*
  - If several things match equally well, it takes the first in reading order.
  - With no clue, it clicks the page's most eye-catching banner.
  - Words with no verb get typed into the first empty box.
  - It types and draws exactly what it's told.
- B. Today's cautious agent: with no clue, nothing happens.

Your selection: A

### D-11 · What mistakes cost
- **A. Nothing artificial.** Instructing the agent is the hard part. A wrong click has only its natural effect, such as opening another page. There are no add-ons that re-attach themselves and no detours that take several steps to escape. *(Owner's choice, 2026-11-08.)*
- B. Sticky penalties.

Your selection: A

### D-12 · A difficulty week
- **A. Defer until a pipeline for building sandbox sites exists (DEF-3).** Then run an easy Monday through a brutal Saturday. *(Owner's choice, 2026-11-08.)*
- B. Build it now.

Your selection: A

### D-13 · Must the drawing match the replay?
Context. "draw a dragon" passes today (F-22). The owner didn't comment on this proposal, so the review's recommendation is pre-filled.

- **A. Yes.** *(Recommended.)*
  - The replay draws a specific shape (for Case #001, a cat), and Exhibit D requires that shape.
  - A shape the agent can't draw comes out as a funny failed attempt that never matches.
- B. Any drawing counts, as today.

Your selection: A

### D-14 · Show the struggle in the share card and report
Context. The owner didn't comment on this proposal, so the review's recommendation is pre-filled.

- **A. Show how the game went, not just the result.** *(Recommended.)*
  - The share card gets one emoji per line: 🎯 progress · 🤡 wrong thing done · 🔙 wandered to another page · 💥 undid progress · 💤 nothing happened.
  - The report adds a "You vs Replay" note under each missed exhibit, plus a "best blunder" quote.
- B. Keep today's share card and report.

Your selection: A

---

## Open findings (verified 2026-11-08)

| ID | Severity | Finding | Where | Fixed by |
|---|---|---|---|---|
| F-25 | Medium | The cloud tier returns a single mark and turns CONFUSED into NOOP, so it can't follow the intern's rules. | `src/engine/agent/cloud_tier.ts:14-25`, `:271`, `:431-450` | Item 7 |
| F-26 | Low | The share card and report show results, not the struggle. | `src/engine/scoring.ts:175-179`; `src/components/ExhibitsPanel.tsx` | Item 8 |
| F-27 | Info | The live site still serves the pre-fix bundle `assets/index-DWnC1R4E.js` (checked 2026-11-08), so players still see the old giveaways. | — | OA-5 (owner) |

Reproduce F-21 and F-22 with `npx tsx scripts/difficulty_probe.mts`. Verify the old F-1 to F-5 with `npx vitest run test/exploits.test.ts`.

---

## Blocked — needs owner
_(none yet — implementors add entries here as options with a `Your selection:` line)_

## Resolved
- F-21 — resolved by items 1 and 3–6 (added realistic portal clutter across Pages 01–04 — livery-coloured route cards, service tabs, campaign banners, a 3×2 Kanji/Katakana/Romaji name grid, a 5-train timetable with multiple green buttons and `¥13,870` cells, and side-by-side blue `内容を確認する` / `予約を確定する ▶` buttons — reducing `scripts/difficulty_probe.mts` lazy-prompt hits from 15/28 to 0/28 and the laziest run from 120 PTS to 0%)
- F-24 — resolved by items 1 and 3 (added multi-alias scoring up to +70, multi-position scoring up to +40, generic ordinal/numeric rows and columns, role-based banner/tab/link scoring, `orange` colour synonyms, and realistic MV-01 service tabs, campaign banner, and livery-coloured route cards)
- F-22 — resolved by item 2 (changed Case #001 replay step 4 and Exhibit D to require `SHAPE:cat` (`Signature: 🐱 Cat`), and turned unknown drawing subjects into `ATTEMPT:<word>` "worm with ambition" strokes that leave Exhibit D MISSED)
- F-23 — resolved by item 1 (added distraction clicks for no-clue, meta-prompt, and mark-ID instructions, bare-word typing into the first empty input, and exact `{n}` count in reading-order tie thoughts)
- F-1 — resolved by item 3 (deleted hidden shortcut #16, gated Exhibit B on `passengerName === 'TANAKA'` and Exhibit D on non-empty `signatureStroke`, removed `CLEAN` and `signatureSigned`, and added BFS solvability proof that minimum steps to 100% = 5)
- F-2 — resolved by item 5 (removed all `'TANAKA'` defaults in `2ee1ef3` item 4 and removed `'TANAKA'` page hints and unentered passenger-name fallback labels from `ShinkansenSandbox.tsx`)
- F-3 — resolved by item 10 (replaced hardcoded `cloud_connector.ts` / `offline_simulator.ts` fallback with unified `resolveLine` and data-driven `fallbackResolve` in `src/engine/agent/`, returning `NOOP` below score 30 and on meta-prompts; item 4 `2ee1ef3` added `NOOP` action and `isMetaPrompt`)
- F-4 — resolved by item 6 (populated elements on all 10 pages in `src/data/puzzles/case_001/puzzle.ts`, derived `CASE_001_MACRO_VIEWS` from `CASE_001_PUZZLE`, and enforced page-scoped mark resolution in `applyDecision`; item 4 `2ee1ef3` added full mark-set regex blocking)
- F-5 — resolved by item 3 (locked `officialResult` on first official `CLOSE_CASE`, replaced `REOPEN_CASE` with unscored `START_PRACTICE`, and added `kanjion:v1:case:001` persistence across refreshes)
- F-6 — resolved by item 11 (implemented lazy-loaded Firebase AI Logic free cloud tier in `src/engine/agent/cloud_tier.ts` with `responseSchema`, SoM PNG + mark metadata request, response validation, 6,000 ms timeout, and 3-failure 10-minute circuit breaker `kanjion:v1:cloud-paused-until`; item 10 `02883e8` unified the agent pipeline)
- F-7 — resolved by item 9 (implemented headless Chromium SoM capture pipeline via `capture.html` and `tools/compile_puzzle.ts`, generated 1024×768 content-hashed SoM PNGs in `public/puzzles/001/som/` and measured bounding boxes in `src/data/puzzles/case_001/manifest.generated.json`, and removed dead `public/puzzles/001/views/`, `template.html`, and `manifest.json`)
- F-8 — resolved by item 2 (removed all `sr-only` hidden test strings and unused debug toggles; item 1 `5efae7f` removed `NODE_ENV` and `navigator.webdriver` branches, added `GameConfig`, and added Playwright `e2e/smoke.e2e.ts`)
- F-9 — resolved by item 5 (replaced `えきねっと JR` branding, `eki-net.com/personal` URLs, `JRE POINT`, `Suica`, and `ログアウト` with fictional `かんじおん鉄道` + `新幹線ネット予約`, `sandbox://kanjion-rail.example/reserve/<slug>`, and `お知らせ` button; updated outbound links to `"Inspired by eki-net.com ↗"`)
- F-10 — resolved by item 5 (removed English glosses, page-number spoilers, and internal view codes from `ShinkansenSandbox.tsx`)
- F-11 — resolved by item 7 (added shared flash clock `src/engine/flash_clock.ts`, split mark 25 `CLICK` (`fare: 19590`) vs `TIMED_CLICK` (`fare: 13870`), added Exhibit E `contaminated` rule for attached ¥2,400 travel insurance, and updated `answerKey[2]`)
- F-12 — resolved by item 6 (replaced `ShinkansenMicroState` and `reduceShinkansenMicroState` with generic data-driven `PuzzleData` + `applyDecision` in `src/engine/puzzle_engine.ts`, rendered `MV-07` promo modal and `MV-08` news modal in `src/data/puzzles/case_001/Sandbox.tsx`, and deleted dead `MV-06` and `MV-09`)
- F-13 — resolved by item 6 (deleted `pageCoordMap` and hardcoded bounding boxes from case data, annotated every interactive element and `page_title` with `data-mark` and `data-el`, and measured live DOM centers inside `#sandbox-core` divided by stage scale; item 5 `a8e32aa` updated URL bar to use `currentView.simulatedUrl`)
- F-14 — resolved by item 2 (renamed Case #042 to Case #001 everywhere, updated share card URL to `https://kanjion-game.web.app`, and rendered lines 1–2 of `scoreReport.shareableClipping` in `ExhibitsPanel.tsx`)
- F-15 — resolved by item 12 (added `src/data/schedule.ts` with `SCHEDULE`, `PUZZLES`, `todaysPuzzle`, local-date cover header `CASE FILE #{caseNumber} • {date}`, per-puzzle persistence keys, and `Next case in HH:MM:SS` / `Next case: coming soon` countdown in `ExhibitsPanel.tsx`)
- F-16 — resolved by item 13 (added `🔍 Zoom` / `↙ Fit` toggle below 768 px on agent and replay headers, 2× pannable stage zoom (`min(1, 2 × fitScale)`) with `overflow: auto; touch-action: pan-x pan-y`, automatic cursor centering after dispatch, and `mobile-chromium` Playwright verification)
- F-17 — resolved by item 11 (deleted `functions/` and the `functions` block of `firebase.json`; earlier dead code removed in item 1 `5efae7f`, item 2 `a47a14d`, and item 10 `02883e8`)
- F-18 — resolved by item 5 (blocked `onPaste` and `onDrop` on the instruction input in `DispatchPad.tsx` and updated placeholder to `'Tell your agent what to do (English, max 60 characters)'`)
- F-19 — resolved by item 9 (named SoM PNG assets with an 8-char SHA-256 content hash `public/puzzles/001/som/<pageId>.<hash8>.png` referenced from `manifest.generated.json`)
- F-20 — resolved by item 9 (bundled self-hosted `@fontsource/noto-sans-jp` weights 400, 700, 900 in `src/main.tsx` and `src/capture/main.tsx` and removed Google Fonts CDN `<link>` tags from `index.html`)

## History
- **2026-11-07** — Reviewed the build against the original and the updated concept briefs.
  - Ran `npm test` (443/443 pass, 19 files), `npm run build` (clean) and the compiler dry-run (exit 0).
  - Playwright has no config or specs ("No tests found").
  - Reproduced F-1, F-2, F-3, F-4 and F-5 with `scripts/exploit_probe.mts`, and F-1 in the browser: the 4-line shortcut scored 140 in the live UI.
  - Saved the updated brief to `concepts_brief.md` (the previous version is in git history).
  - Wrote `agent_execution_guide.md` (Active Build).
- **2026-11-08** — Items 1–13 landed (commits `5efae7f`…`12e912e`), and the security review of those commits found no vulnerabilities.
  - The owner played the live site and found the game too easy: "draw a dragon" passed. The live site still runs the pre-fix build (F-27).
  - Measured the current code with `scripts/difficulty_probe.mts`: 15 of 28 lazy prompts reproduce the replay, and the laziest run scores 120.
  - The owner decided D-8 to D-12; D-13 and D-14 are pre-filled with the review's recommendation.
  - Baseline: `npm test` 402/402 (25 files); `npm run build` clean (85.76 kB gzip); compiler `--case 001 --validate` exit 0; `npm run test:e2e` 2/2.
  - Rewrote `agent_execution_guide.md` (Active Build: Frustratingly Funny).
