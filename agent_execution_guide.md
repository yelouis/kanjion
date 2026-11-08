# Kanjion — Agent Execution Guide · Active Build: Integrity Fixes + Free-Model Agent · 2026-11-07

You are an implementor agent with no memory of this project. This file is your single entry point. Read it top to bottom before you touch code. Then work the queue in §2 one item at a time, using **THE LOOP** at the end.

**Approved scope:** items 1–13 below, nothing else.

**Specs are decisions.** Every number, file name, identifier and quoted string here is deliberate. Implement it as written; don't substitute your own values or copy.

**Companion documents**
- [`ongoing_general_errors.md`](ongoing_general_errors.md) holds:
  - findings **F-n** (verified bugs with `file:line`);
  - the owner's decisions **D-1…D-7** (read each `Your selection:` line);
  - owner actions **OA-n**;
  - the Blocked / Resolved lists.
- [`concepts_brief.md`](concepts_brief.md) is the product brief, updated 2026-11-07.

**Precedence.** When a selected D-entry differs from the brief, the D-entry wins: update the brief's Decision Log in the same commit. When a D-entry selection differs from what an item below assumes, follow the selection and adapt the steps; each affected item says what changes.

**Branch and commits.** Work on a branch named `fix/integrity-and-agent`, created from `main`. Commit locally; never push.

---

## Standing constraints (apply to every item)

- **S1 Free only — owner-locked.**
  - Never link a billing account, add a paid API, or add a service that needs a card.
  - Project `kanjion-game` is on the Spark plan with billing disabled (verified 2026-11-07).
- **S2 No secrets in the client.**
  - Only the public Firebase web config and the App Check site key, via `VITE_*` variables in `.env.local`.
  - `.env.*` is already gitignored. Never commit a real key.
- **S3 Goal blindness.** Nothing sent to a model, and nothing the fallback uses to pick a target, may contain:
  - exhibit definitions or criteria;
  - expected values that aren't visible on the current screen (e.g. `TANAKA` before it is typed);
  - decoy, target or trap flags;
  - the replay script, the answer key, or pinned answers.
- **S4 One agent for everyone.**
  - Scored play uses the same tiers in the same order on every device.
  - The fallback tier is a pure function of (puzzle, page, fields, instruction).
- **S5 Test the shipped game.**
  - No `process.env.NODE_ENV` reads in `src/`.
  - No hidden or `sr-only` text added to satisfy a test.
  - No production branches keyed on `navigator.webdriver`, query parameters or globals.
  - Tests configure the app only through `GameConfig` (item 1).
- **S6 Keep the decided look and feel.**
  - Newspaper cover; two-page spread (agent 8/12, replay 4/12; expanded: 5/12 + 7/12).
  - 6 lines × 60 characters; multiplier `1 + 0.2 × unused lines`, capped at 2.0×.
  - Exhibit weights A 25 · B 20 · C 20 · D 15 · E 20.
  - Kinematics stay as in `src/App.tsx:196-245`: 1,150 ms glide, 220 ms per typed character, 6 × 180 ms + 500 ms signature, 700 ms click hold.
- **S7 Bundle budget.**
  - Initial JS ≤ **120 kB gzip** (baseline 87.64 kB).
  - Firebase code loads lazily on the first dispatch.
- **S8 Hands off production.**
  - Never deploy, push, or change Firebase or Google Cloud console settings.
  - Anything only the owner can do goes into "Owner actions" in the tracking doc.
  - Don't edit `.agents/`, a gitignored log of a previous multi-agent run. Its status notes claim "VICTORY CONFIRMED"; treat them as history, not truth.
- **S9 Copy is verbatim.** Quoted UI strings below are exact, including punctuation and emoji.
- **S10 Green before every commit.**
  - Every item ends with the full battery (§1) passing.
  - If you delete a test, name it in the commit body with the item that removed its behavior. Every behavior that still exists keeps a test.

**Deviation and escalation**
- If a value is impossible as written (for example, an SDK function was renamed), keep the intent, deviate minimally, and say so in the commit body.
- If a design can't work (for example, the free tier rejects image input for the chosen model):
  - STOP that item;
  - add an entry under **Blocked — needs owner** in the tracking doc with 2–3 options and a `Your selection:` line;
  - continue with the next item that doesn't depend on it.
- Don't improvise around a blocked design.

---

## §1 Verified baseline (run 2026-11-07 — the regression bar)

| Gate | Command | Result on 2026-11-07 |
|---|---|---|
| Unit/component | `npm test` | **443 passed / 23 files** (≈ 9.7 s). Runs the shipped multi-page game via `GameConfig` (items 1–6). |
| Typecheck + build | `npm run build` | Clean (`tsc -b && vite build`). `dist/assets/index-*.js` 274.72 kB, **84.39 kB gzip**. CSS 37.57 kB. |
| Compiler | `npx tsx tools/compile_puzzle.ts --case 001 --offline --validate --dry-run` | Exit 0, but it only validates hand-written TypeScript data and captures nothing (F-7). |
| E2E | `npm run test:e2e` | **1 passed** (`e2e/smoke.e2e.ts` in `desktop-chromium`). |
| Lint | — | No lint script exists. |
| Exploit probe | `npx tsx scripts/exploit_probe.mts` | Only the answer-key path reaches 100% (`120 PTS`); F-1, F-2, F-3, F-4, F-5 all blocked/mitigated (items 3–4). |

---

## §2 Execution order

| # | Item | Why this position |
|---|---|---|
| 1 | Run the shipped game under test | Every later ★ test must exercise what players actually get. It also deletes the test-only single-page sandbox, which later items would otherwise edit twice. |
| 2 | Case #001 everywhere, no hidden test text, honest share card | The renames touch nearly every file; doing them before the data refactor avoids two rounds of churn. It also removes hidden test text before new tests are written. |
| 3 | Close the scoring holes | Critical exploits on the live site. Small, permanent changes (exhibits, result lock, persistence) that later items build on. |
| 4 | Agent rules: no free answers, harmless when unsure | Critical answer leaks on the live site. The tests written here become the contract item 10 must keep. |
| 5 | Sandbox copy, branding and anti-copy | Live-site risk (a phishing flag) plus answer leaks. Independent of the refactor, and it gives item 9's captures clean pages. |
| 6 | Puzzle as data | Needs items 3–5 settled. Required by item 7 (per-action effects), 8 (engine), 9 (`data-el` attributes) and 10 (registry). |
| 7 | Real flash-sale timing and the add-on trap | Builds on item 6's per-action effects. Must land before the replay script (8) and the captures (9). |
| 8 | Replay from data | Uses the engine (6) and the final timing rules (7). |
| 9 | Capture pipeline: real SoM images and measured boxes | Needs `data-el` (6) and final page content (5, 7). Produces the boxes and images that items 10–11 read. |
| 10 | One agent pipeline with a data-driven fallback | Needs the registry (6) and manifest boxes (9). Replaces the code patched in item 4. |
| 11 | Free cloud tier via Firebase AI Logic | Needs the pipeline (10) and SoM images (9). Also needs owner actions OA-1–OA-4, so build it to stay off until they're done. |
| 12 | Daily schedule | Needs per-puzzle persistence (3) and the puzzle registry (6). |
| 13 | Phone zoom | UI-only. Last, so the stage it zooms is final. |

★ marks the falsifying assertion in each Validation block: a test that fails against today's code for the stated reason. Write it first and watch it fail.

---

## §3 Item 1 — Run the shipped game under test

**What this means for the user.** CI is green while players hit bugs, because the tests play a different start page, agent and sandbox than the live site.

**The gap**
- `process.env.NODE_ENV` picks:
  - whether the cover shows (`src/App.tsx:40`);
  - the start state (`:42-52`);
  - the engine (`:70-72`, `:96-107`);
  - the choreography (`:187`);
  - the sandbox mode (`:550`).
  The same switch appears in `src/components/LoopedTargetReplay.tsx:84` and `src/components/ShinkansenSandbox.tsx:69`.
- In tests the sandbox renders a single-page layout (`ShinkansenSandbox.tsx:985-1464`) that players never see.
- `src/App.tsx:188-190` speeds animation up when `navigator.webdriver` is true — a test hook in production code.
- `npm run test:e2e` has no config and no specs.

**Implementation**
1. Create `src/config/game_config.ts`:
   ```ts
   export interface GameConfig {
     startOnCover: boolean;    // production: true
     animationScale: number;   // multiplies every choreography delay; production: 1
     replayAutoplay: boolean;  // production: true
     storage: Storage | null;  // production: window.localStorage, or null if access throws
     now: () => Date;          // production: () => new Date()
   }
   export function productionConfig(): GameConfig;
   ```
   `animationScale` reads `import.meta.env.VITE_ANIMATION_SCALE` (a number, default `1`). Nothing else in `src/` reads env variables until item 11.
2. `App` accepts `config?: Partial<GameConfig>`, merged over `productionConfig()`.
   - Delete every `process.env.NODE_ENV` read in `src/` and the `navigator.webdriver` check.
   - `LoopedTargetReplay` takes `autoplay` from config; the sandbox's flash timer always runs.
3. Use one start state. The browser start state that `App.tsx:45-52` builds today becomes `CASE_042_INITIAL_MICRO_STATE` itself: page MV-01, route `'none'`, departure `'none'`, name `''`, `signatureSigned: false` (item 3 removes that field).
   - Delete `browserInitialMicroState`.
   - Delete the `preSeeded` option and its branch (`src/engine/game_reducer.ts:358-412`). Brief decision 7: always start at Line 01.
4. Choreography (`App.tsx:187-251`): every `sleep(ms)` becomes `sleep(ms * animationScale)`. When `animationScale === 0`, skip the timers but still run the same state updates in the same order.
5. Delete the single-page branch of `ShinkansenSandbox` (`:985-1464`) and the props only it used: `multiPageMode`, `somOverlayActive`, `somElements`, `onElementClick`, `instantPageFlip`. Delete `SandboxStage`'s default-children path (`SandboxStage.tsx:122-153`).
6. Tests use the production engine. Remove `MockVisionLLMTransport` from `App` (`App.tsx:97-100`). jsdom has no `window.LanguageModel`, so the production transport takes its deterministic path.
7. Add `playwright.config.ts`:
   - `testDir: 'e2e'`, `testMatch: '**/*.e2e.ts'`;
   - `use: { baseURL: 'http://localhost:4173' }`;
   - one project `desktop-chromium` (Desktop Chrome, viewport 1440×900);
   - webServer:
     ```ts
     webServer: {
       command: 'npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
       url: 'http://localhost:4173',
       reuseExistingServer: false,
       env: { VITE_ANIMATION_SCALE: '0.05' },
     }
     ```
   Add `dist-e2e/` to `.gitignore`. The E2E build never touches `dist/`, so it can't be deployed by mistake.
8. Add `e2e/smoke.e2e.ts`:
   1. Open `/`.
   2. Click the button containing `OPEN TODAY'S NEWSPAPER`.
   3. Fill `#telegram-input` with `click the top-left green box` and press Enter.
   4. Expect the ledger to contain `LINE 01:` and `#input-passenger-name` to be visible.

**Validation**
- ★ New unit test: render `<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />` and assert the agent page shows `STEP 1: ご利用になる新幹線路線を選択してください`. It fails today because under test the app starts on the single-page MV-03 layout.
- `grep -rn "NODE_ENV\|webdriver" src` → no output.
- `npm run test:e2e` → 1 passed (today: "No tests found").
- Manual: in `npm run dev` the game looks and plays exactly as before.

**Blast radius**
- Tests that relied on test-mode defaults (MV-03 start, pre-seeded lines, single-page sandbox, SoM badges):
  - `test/e2e_gameplay.test.tsx`
  - `test/ui_components.test.tsx`
  - `test/challenger_m3_empirical.test.tsx`
  - `test/challenger_m5_empirical.test.tsx`
  - `test/ui_adversarial_challenge.test.tsx`
  - `test/scaffolding.test.ts`
  - `test/game_reducer.test.ts` (pre-seed tests)
  - `test/player_cujs.test.tsx`

  Rewrite them to start from page MV-01. Delete the ones that only covered the single-page layout, listed in the commit body.
- `scripts/exploit_probe.mts` builds its own start state; fix its imports if needed.

---

## §4 Item 2 — Case #001 everywhere, no hidden test text, honest share card

**What this means for the user.**
- The report says #001, but the text players paste into a group chat says #042 and links to a domain the game doesn't use.
- Screen-reader users hear hidden "Case #042" text.

**The gap**
- `#042`, `case_042` and `CASE_042_*` appear across `src/`, `tools/`, `public/puzzles/042/` and `test/`.
- Hidden strings exist only for old tests: `src/components/MastheadHeader.tsx:39`, `:46`; `src/components/DispatchPad.tsx:56`, `:98`; `src/components/ExhibitsPanel.tsx:77`; `src/App.tsx:415`; `src/components/AgentCursor.tsx:330`.
- The debug toggles are hidden with `sr-only` but still keyboard-focusable (`MastheadHeader.tsx:84-115`).
- Share text uses `baseUrl = 'https://kanjion.game/c'` (`src/engine/scoring.ts:154-183`), and the report renders its own hard-coded copy (`ExhibitsPanel.tsx:200-210`).
- Unused components: `GhostReplay.tsx`, `CoordinateRulers.tsx`, `DossierLayout.tsx`.

**Implementation**
1. Rename to 001:
   - `src/data/puzzles/case_042.ts` → `case_001.ts`; `CASE_042_*` → `CASE_001_*`.
   - `puzzleId: 'case_042'` → `'case_001'`; case number `'#042'` → `'#001'`.
   - The page-05 booking number `EKI-042-9921` (`ShinkansenSandbox.tsx:860`) → `K001-9921`. Keep it to at most one Latin letter, because item 5's text test allows no two-letter runs.
   - The compiler accepts `--case 001` or `--case #001` (`tools/compile_puzzle.ts:141`, `:158`, `:245`; `tools/lib/offline_compiler.ts`).
   - Regenerate `public/puzzles/001/` with the compiler, then delete `public/puzzles/042/`.
2. Delete the hidden strings listed above. `AgentCursor` renders nothing for the grid suffix.
3. Delete the debug toggles (`MastheadHeader.tsx:84-115`) and everything only they used:
   - the `ghostReplayActive` and `somOverlayActive` state;
   - the `TOGGLE_GHOST_REPLAY` and `TOGGLE_SOM_OVERLAY` actions (`game_reducer.ts:38-39`, `:583-595`);
   - the `engineMode` state and toggle (`App.tsx:70-72`, `:109`, `:469-472`);
   - the `GhostReplay`, `CoordinateRulers` and `DossierLayout` components, their exports (`src/components/index.ts:7-8`, `:13-14`, `:24-25`) and their tests.
4. Share text, exact — three lines joined with `\n`:
   ```
   KANJION #001 🇯🇵 — {closeness}% × {multiplier, 1 decimal}x = {final} PTS
   {emojiRow} ({linesUsed}/6 Telegrams Sent)
   https://kanjion-game.web.app
   ```
   - The default `baseUrl` is `'https://kanjion-game.web.app'`, with no path.
   - The report preview renders lines 1–2 of `scoreReport.shareableClipping`. Delete the hard-coded `KANJION #001 🇯🇵 —` (`ExhibitsPanel.tsx:203`) and the fallback emoji row `'🟩🟩🟩🟩⬜'` (`:209`).
   - The report title reads `FORENSIC AUDIT REPORT • CASE {caseNumber}` from data.

**Validation**
- ★ Close a 5-line game with all exhibits verified. `navigator.clipboard.writeText` receives exactly `KANJION #001 🇯🇵 — 100% × 1.2x = 120 PTS\n🟩🟩🟩🟩🟩 (5/6 Telegrams Sent)\nhttps://kanjion-game.web.app`. It fails today, which sends `#042` and `kanjion.game/c/042`.
- `grep -rn "case_042\|CASE_042\|#042\|puzzles/042" src tools test e2e` → no output.
- `grep -rn "sr-only" src` → no output.
- `npx tsx tools/compile_puzzle.ts --case 001 --offline --validate --dry-run` → exit 0.

**Blast radius**
- `test/exhibits_scoring.test.ts:215-224`
- `test/challenger_m5_empirical.test.tsx:448-455`
- `test/e2e_gameplay.test.tsx:57-58`, `:212`
- `test/ui_components.test.tsx:57-110`, `:593-705`
- `test/puzzle_compiler.test.ts`, `test/challenger_m4_empirical.test.ts`
- every import of `case_042`
- `scripts/exploit_probe.mts`

---

## §5 Item 3 — Close the scoring holes (F-1, F-5; D-3)

**What this means for the user.** A 4-line run that never types the name or signs scores 140 — more than the official answer — and anyone can peek at the answer key and re-score.

**The gap**
- Element #16 exists only in logic; no page renders it.
  - Created by `src/engine/cloud_connector.ts:708-722` and `:1425-1433`, and by the "Departure Time 14:30" branch of `src/engine/offline_simulator.ts`.
  - Allowed by the gating at `src/engine/game_reducer.ts:91`.
  - Applied at `:144-150`, where it fills `passengerName = 'TANAKA'` and sets `signatureSigned = true`.
  - Positioned by `src/App.tsx:139`.
- Exhibit B passes when `passengerName` is undefined (was `case_042.ts:399-401`).
- Exhibit D awards `CLEAN +15` without a signature (was `case_042.ts:430-459`).
- Page gating keys on `signatureSigned === false` (`game_reducer.ts:85-112`).
- `REOPEN_CASE` re-scores (`game_reducer.ts:572-582`; button at `ExhibitsPanel.tsx:226-235`).
- Nothing persists.

**Implementation**
1. Delete element #16 everywhere listed, including `getValidTargetsForPage` (`cloud_connector.ts:1074`). Page 02's `14:30発` stays as static text.
2. Exhibit B is VERIFIED only if `passengerName === 'TANAKA'`.
   - Title: `Passenger Name: TANAKA`.
   - Criteria: `Typed the passenger name TANAKA on page 02.`
3. Exhibit D is VERIFIED only if `signatureStroke` is a non-empty string; otherwise MISSED.
   - Delete its CLEAN and CONTAMINATED branches.
   - Remove `'CLEAN'` from `StampStatus` (`src/types/game.ts:17`) and from its handling (`src/engine/scoring.ts:75`, `:134`; `src/components/ExhibitsPanel.tsx:54`).
4. Delete the `signatureSigned` field; anything that shows "signed" uses `Boolean(signatureStroke)`.
   - Page gating keys only on `macroViewId`.
   - Add MV-04 with allowed IDs `[27, 28, 29, 30, 14, 11, 12]`. Item 6 replaces gating with the registry.
5. Official result and practice (D-3 = A):
   - `GameState` gains `mode: 'official' | 'practice'` and `officialResult: ScoreReport | null`.
   - The first `CLOSE_CASE` in official mode (button or Line 06) sets `officialResult`. Nothing changes it afterwards.
   - Replace `REOPEN_CASE` with `START_PRACTICE`: a fresh initial game with `mode: 'practice'` that keeps `officialResult`.
   - Closing in practice shows the exhibits and a score under the heading `PRACTICE RESULT — NOT SCORED`. The share box always shows `officialResult.shareableClipping`.
   - Copy:
     - The report button reads `↺ Practice this case (unscored)` (replaces `← Return to Active Play`).
     - While practicing, the masthead pill reads `PRACTICE — NOT SCORED`.
     - The menu entry `📅 Daily Puzzle #001 (Restart)` (`App.tsx:405-418`) becomes `↺ Practice this case (unscored)`, shown only once `officialResult` exists.
   - If D-3 = B: skip this step and step 6's "first close is final" rule. Persistence still applies.
6. Persistence, under key `kanjion:v1:case:001`:
   - Value: `{ v: 1, mode, game, officialResult }`, where `game` is `GameState` minus `isExecuting`, `stageShake` and the preview fields.
   - Write after every `APPLY_AGENT_ACTION`, `CLOSE_CASE` and `START_PRACTICE`. Read once on boot through `config.storage`.
   - Discard the stored value on a parse error or when `v !== 1`. Wrap every storage call in try/catch.
   - If `officialResult` exists on boot, the cover shows a stamp `SOLVED — {final} PTS`, and opening the newspaper shows the unsealed report.
7. `test/solvability.test.ts` does a breadth-first search from the initial state.
   - Actions on each page: every allowed element ID × its actions, applied through the reducer — CLICK; TYPE with text `'TANAKA'` or `'X'`; DRAW with `'SHAPE:signature'`; and, from item 7 on, TIMED_CLICK on #25.
   - Assert that the minimum number of actions reaching closeness 100 is exactly **5**, equal to the answer key's length.
   - From item 6 on, enumerate actions from the registry.
8. `test/exploits.test.ts` drives the production resolver plus reducer through probe scenarios F-1 and F-5.

**Validation**
- ★ `solvability.test.ts`: minimum = 5 (today 4, via #16).
- ★ F-1 lines `tokyo route` / `next page` / `green` / `blue confirm` → closeness ≤ 65, with B and D MISSED (today 100).
- ★ Close after line 1 → `START_PRACTICE` → play the F-1 lines → close. `officialResult.finalScore` still equals the first close (today 50 → 140).
- ★ Render `App` with an in-memory `Storage` and dispatch 2 lines. Unmount, then render again with the same storage. The active line is LINE 03 and the agent page is page 03 (today it resets).
- Exhibit D: a DRAW followed by close → VERIFIED; no DRAW → MISSED. `grep -rn "CLEAN" src` → no output.
- E2E: dispatch 2 lines and reload; `LINE 03` is the active line.

**Blast radius**
- `test/exhibits_scoring.test.ts:43-51`, `:210`
- `test/adversarial_scoring_reducer.test.ts:266`, `:417`, `:423-430`
- `test/game_reducer.test.ts:326-333`
- `test/e2e_gameplay.test.tsx:191`, `:219-221`
- `test/challenger_m5_empirical.test.tsx:179`, `:278-284`, `:331-348`
- `test/ui_components.test.tsx:593`, `:625`, `:685-687`
- `test/player_cujs.test.tsx` (CUJ 1, 6, 7)

---

## §6 Item 4 — Agent rules: no free answers, harmless when unsure (F-2, F-3, F-4)

**What this means for the user.** "fill in the passenger name" types the secret answer, and gibberish on the last page wins the game.

**The gap**
- TYPE defaults to `'TANAKA'`: `src/engine/cloud_connector.ts:758`, `:1199`, `:1440`; `src/engine/offline_simulator.ts:133-135`; `src/engine/game_reducer.ts:153`; `src/App.tsx:215`.
- `'T. Tanaka'` is used as the signature sentinel: `src/App.tsx:222`; `src/engine/game_reducer.ts:173`, `:176`; `src/engine/cloud_connector.ts:1452`; `src/utils/text_normalizer.ts:406-407`, `:523`.
- The default signature's thought shows the answer to the player: `drawing a very fancy squiggly "T. Tanaka"` (`src/utils/text_normalizer.ts:408`). A player who typed the wrong name learns the right one on page 04 and can go back.
- The always-act fallback guesses real targets, including the winning #30 on page 04 (`cloud_connector.ts:990-1037`).
- The mark-ID guardrail checks only the current view's element list, which is mostly empty (`cloud_connector.ts:1300`).
- The gating message leaks the name (`game_reducer.ts:92`).

**Implementation.** These patches go into code that item 10 deletes. The **tests** are the lasting deliverable: write them against `resolveInstruction(macroViewId, state, instruction)` and the reducer so they survive item 10.

1. Add `extractTypedText(instruction: string): string` to `src/utils/text_normalizer.ts`. Algorithm, exactly:
   1. If the instruction contains straight- or curly-quoted text, take the first quoted run.
   2. Otherwise take the words after the first verb from `type, enter, write, input, put, fill in, fill`.
      - Drop these words: `the, a, an, in, into, on, at, to, box, field, textbox, input, name, passenger, passengers, please, his, her, their, my, as, for`.
      - Keep at most 2 remaining words.
   3. If no words remain, use the dropped words from `{passenger, name}` in their original order (e.g. `passenger name`). If there are none of those either, use `name`.
   4. Uppercase, keep only A–Z and spaces, trim, and cut to 16 characters.

   Required examples:

   | Instruction | Typed text |
   |---|---|
   | `Type TANAKA in the passenger name box` | `TANAKA` |
   | `enter the name tanaka` | `TANAKA` |
   | `type "sato"` | `SATO` |
   | `type the passenger name` | `PASSENGER NAME` |
   | `fill in the passenger name` | `PASSENGER NAME` |
   | `type` | `NAME` |

   Use it everywhere a TYPE text is produced (the lines listed in the gap).
2. Replace the `'T. Tanaka'` signature sentinel with `'SHAPE:signature'`, which `resolveSignatureDrawingSpec` maps to the existing default squiggle. Change `DEFAULT_SQUIGGLE_SPEC` (`text_normalizer.ts:405-412`) to:
   - `strokeValue: 'SHAPE:signature'`
   - `displayLabel: ''`
   - thought, exact: `💭 Channeling my inner doctor's handwriting — one very fancy squiggle, coming up!`
3. Add an internal action `NOOP`. It is never part of any model schema.
   - Effect: no state change. The cursor glides to the page heading (fixed point `{ x: 512, y: 150 }` until item 6 gives the heading a mark) and wiggles. The ledger records the line with the NOOP thought.
   - Use NOOP instead of every `alwaysAct` best guess (`cloud_connector.ts:990-1037`), for meta-prompts, for blocked mark IDs, and for any `CONFUSED` result from any path.
   - Thoughts, exact:

     | Case | Thought |
     |---|---|
     | No usable signal | `💭 I have no idea what that means, so I poked the page title. Describe what to click?` |
     | Meta-prompt | `💭 Win? Solve? I only see buttons, not goals. I tapped the title while you rephrase.` |
     | Mark ID | `💭 I don't see numbers like that on the page — describe the thing instead.` |
4. Add `isMetaPrompt(instruction)`. A match on this case-insensitive regex → NOOP with the meta-prompt thought:
   ```
   /\b(win|winning|solve|solution|cheat|answer key|complete the (task|puzzle|game|level|case)|beat the (game|level|puzzle)|(do|copy|repeat) what the (replay|video|demo) (did|does|shows)|copy the (replay|video|demo))\b/i
   ```
5. Run the mark-ID guardrail on every page.
   - First apply the existing NFKC, zero-width-strip and percent-decode steps (`cloud_connector.ts:152-178`).
   - Then block (NOOP with the mark-ID thought) when the instruction matches `/#\s*\d+/` or `/\b(?:id|mark|badge|tag|som)\s*#?\s*\d+/i`.
   - Bare numbers stay allowed: prices and train numbers are on screen. Item 10 adds a registry-aware rule for bare numbers.
6. The gating message at `game_reducer.ts:92` becomes `📌 FIELD NOTE: That isn't on this page.`
7. Item 5 renames the logout button to `お知らせ`. Until item 10, the regex keyword for #11 becomes `news|notice|お知らせ`.

**Validation**
- ★ Page 02: `fill in the passenger name` → TYPE `PASSENGER NAME`, and Exhibit B is MISSED (today it types `TANAKA`).
- ★ Page 04: `asdf qwerty zxcv`, `complete the task` and `click the winning button` → NOOP each time, and `finalConfirmed` stays false (today: CLICK #30).
- ★ `#1` on page 01, `#17` on page 02, `#30` on page 04 → NOOP (today all accepted).
- ★ `grep -rn "TANAKA\|Tanaka" src/engine src/utils src/types src/App.tsx` → no output. The answer key and the replay still name TANAKA until items 6 and 8 move them into case data.
- Vague but meaningful prompts still act: `click the green button` on page 03 → CLICK #25.
- The five answer-key lines still score 120.
- `npx tsx scripts/exploit_probe.mts`: only the answer key reaches 100 %.

**Blast radius**
- Tests asserting best guesses or TANAKA defaults:
  - `test/player_cujs.test.tsx` (CUJ 2, 14, 15)
  - `test/offline_agent.test.ts`
  - `test/cloud_connector.test.ts`
  - `test/adversarial_engine.test.ts`
  - `test/adversarial_normalizer.test.ts`
  - `test/e2e_adversarial_hardening.test.ts`
- Brief: add this sentence to Decision Log row 12: "When an instruction carries no usable signal, asks to win, or names a mark ID, the agent makes a harmless visible move (it pokes the page title) instead of guessing a real target."

---

## §7 Item 5 — Sandbox copy, branding and anti-copy (F-9, F-10, F-13 URL bar, F-18; D-2)

**What this means for the user.** The pages announce wrong turns in English and print the answer. The sandbox also impersonates a real railway brand, which risks a phishing flag that would take the whole game offline.

**The gap**
- `src/components/ShinkansenSandbox.tsx` (multi-page branch)
- `src/components/SandboxStage.tsx:109`
- `src/components/DispatchPad.tsx:132-145`
- `src/App.tsx:361-371`, `:431-438`
- `src/components/ExhibitsPanel.tsx:212-221`

**Implementation (D-2 = A).** If D-2 = B, skip the brand rows (121, 124, 131-138, 349, 355) and step 2. Do everything else.

1. Replace these strings in `ShinkansenSandbox.tsx`. Search for the text in the middle column; line numbers are from 2026-11-07.

| Line | Today | Replace with |
|---|---|---|
| 121 | `えきねっと JR` | `かんじおん鉄道` |
| 124 | `新幹線 インターネット予約ポータル（全12ページ）` | `新幹線ネット予約` |
| 128-130 | the `PAGE {nn} / 12` badge | delete |
| 131-138 | the `ログアウト` button | an `お知らせ` button: white background, dark text, same mark #11; item 6 gives it a page |
| 201-203 | `eki-net.com/personal/page-{nn}` | delete |
| 226 | `今すぐ申し込む（赤ボタン）` and `✓ 申込済 • 今すぐ申し込む（赤ボタン）` | `今すぐ申し込む` and `✓ 申込済` |
| 242 | `…搭乗者名入力ページ（Page 02）へ進みます。` | `…搭乗者名入力ページへ進みます。` |
| 298 | `路線 02 • 東北・北海道新幹線 (Page 10)` | `路線 02 • 東北・北海道新幹線` |
| 308 | `…予約ページ（MV-10）へ移動します` | `…予約ページへ移動します` |
| 314 | `Page 10 へ ▶` | `空席照会 ▶` |
| 327 | `路線 03 • 北陸・上越新幹線 (Page 11)` | `路線 03 • 北陸・上越新幹線` |
| 333 | `…空席照会ページ（MV-11）` | `…空席照会ページ` |
| 337 | `Page 11 へ ▶` | `空席照会 ▶` |
| 349 | `メニュー 04 • JRE POINT・Suica連携 (Page 12)` | `メニュー 04 • かんじおんポイント・ICカード連携` |
| 355 | `ポイント交換・タッチでGo!新幹線設定ページ（MV-12）` | `ポイント交換・ICカード設定ページ` |
| 359 | `Page 12 へ ▶` | `ポイント ▶` |
| 379 | `…座席表ページ（Page 03）へ進みます。` | `…座席表ページへ進みます。` |
| 388 | `◀ 路線選択 (Page 01) へ戻る` | `◀ 路線選択へ戻る` |
| 418-420 | `必須入力 (REQUIRED TYPE FIELD)` | `必須` |
| 422 | `搭乗者名（ローマ字入力） / Passenger Name` | `搭乗者名（ローマ字）` |
| 425-427 | `入力例: TANAKA` | delete |
| 443 | `ここに搭乗者名 (TANAKA) をタイピング入力...` | `ローマ字で入力してください` |
| 455 | `✓ 入力完了 (TYPED) ▸ 次ページへ` and `TYPE "TANAKA"` | `✓ 入力済` and `未入力` |
| 479 | `…クリックすると Page 04 へ進みます。` | `…クリックすると次へ進みます。` |
| 484 | `搭乗者:` with fallback `'TANAKA'` | fallback `'未入力'` |
| 492 | `◀ 条件変更 (Page 02)` | `◀ 条件変更` |
| 670 | `STEP 4: ご予約内容の確認・本人自署サイン（Page 04 / 12）` | `STEP 4: ご予約内容の確認・本人自署サイン` |
| 682 | `◀ 座席表 (Page 03) へ戻る` | `◀ 座席表へ戻る` |
| 709 | the name with fallback `'TANAKA'` | fallback `'未入力'` |
| 719 | `必須署名 (DRAW SIGNATURE)` | `必須署名` |
| 738 | `署名欄 (DRAW SIGNATURE HERE)` | `署名欄` |
| 745 | `✓ 署名済 (SIGNED…)` | `✓ 署名済` |
| 822 | `予約を取消 (Cancel)` | `予約を取消` |
| 852 | `PAGE 05 / 12 • 発券完了 (ISSUED)` | `発券完了` |
| 884 | `搭乗者名 (Typed)` | `搭乗者名` |
| 886 | the name with fallback `'TANAKA'` | the typed name only, no fallback |
| 890 | `本人自署サイン (Drawn)` | `本人自署サイン` |
| 892 | `✓ デジタル自署認証済 (SIGNED)` | `✓ 署名済` when signed, otherwise `未署名` |
| 907 · 934 · 961 | `PAGE 1x / 12 • … (WRONG ROUTE)` / `(WRONG PORTAL)` | the Japanese title only, e.g. `東北・北海道新幹線 予約ページ` |
| 913 · 940 · 967 | `…トップ（Page 01）から…` | remove `（Page 01）` |
| 921 · 948 · 975 | `◀ 路線選択トップ (Page 01) へ戻る` | `◀ 路線選択トップへ戻る` |

2. Branding elsewhere:
   - The stage URL bar (`SandboxStage.tsx:109`) shows `sandbox://kanjion-rail.example/reserve/{slug}`. Drop the `(Macro-View N of 12)` suffix. Slugs:

     | Page | Slug |
     |---|---|
     | MV-01 | `route-select` |
     | MV-02 | `passenger` |
     | MV-03 | `seats` |
     | MV-04 | `confirm` |
     | MV-05 | `ticket` |
     | MV-07 | `cancel` |
     | MV-08 | `news` |
     | MV-10 | `tohoku` |
     | MV-11 | `hokuriku` |
     | MV-12 | `points` |

   - The case data's `simulatedUrl` values use the same URLs.
   - Outbound links keep `href="https://www.eki-net.com/"` with new labels:
     - header link (`App.tsx:370`): `Inspired by eki-net.com ↗`;
     - menu link (`App.tsx:437`): `🔗 Inspired by eki-net.com ↗`;
     - report link (`ExhibitsPanel.tsx:220`): `🔗 This case is inspired by the real JR East booking site, eki-net.com ↗`.
3. Anti-copy: `#telegram-input` gets `onPaste` and `onDrop` handlers that call `preventDefault()`. Silent, like the click lock.
4. The input placeholder (`DispatchPad.tsx:141`), exact: `Tell your agent what to do (English, max 60 characters)`.

**Validation**
- ★ Render the sandbox for each page state: MV-01; MV-02 with an empty name; MV-03; MV-04; MV-05; MV-10; MV-11; MV-12. Use `signatureStroke` `''` or `'SHAPE:signature'`; custom signature text is player-chosen and out of scope.
  - Take the page body's `textContent` and remove digits, `¥`, `,`, `:`, `.`, `/` and the current `passengerName`.
  - Assert no `/[A-Za-z]{2,}/g` match other than `PR`, `IC`, `QR`.
  - Today this finds `Page`, `WRONG`, `TYPE`, `TANAKA`, `REQUIRED`, `MV` and more.
- ★ No page contains `TANAKA` while `passengerName === ''`.
- ★ On MV-02 the stage URL bar reads `sandbox://kanjion-rail.example/reserve/passenger` (today `…seat-matrix (Macro-View 02 of 12)`).
- ★ Firing a paste event carrying `東海道` into `#telegram-input` leaves its value unchanged.
- `grep -rn "えきねっと\|eki-net.com/personal\|JRE POINT\|Suica\|ログアウト" src` → no output. The outbound `eki-net.com` labels and hrefs remain.

**Blast radius**
- Tests that query the old copy: `test/ui_components.test.tsx`, `test/e2e_gameplay.test.tsx`, `test/challenger_m3_empirical.test.tsx`.
- Brief: Decision Log row 14 now says the links are labelled "Inspired by eki-net.com".

---

## §8 Item 6 — Puzzle as data (F-4 registry, F-12, F-13 cursor)

**What this means for the user.**
- Every new daily case would need new engine code.
- Four declared pages never appear.
- The agent can only "see" page 03.

**The gap**
- Behavior is a per-ID `switch` (`src/engine/game_reducer.ts:53-299`).
- Only MV-03 lists elements (`src/data/puzzles/case_001.ts`, was `case_042.ts:47-233`).
- MV-06, MV-07, MV-08 and MV-09 never render, and `activeModal` is set but never drawn.
- The page shown is inferred from fields (`ShinkansenSandbox.tsx:79-106`).
- The cursor uses a hand-tuned table (`App.tsx:131-150`) and `resolveCursorPosition` (`game_reducer.ts:304-337`).

**Implementation**

1. Create the puzzle contract `src/types/puzzle_data.ts`. Use these exact shapes; add fields only when a later item needs them.
   ```ts
   export type FieldValue = string | number | boolean;
   export type ActionKind = 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK';
   export type Effect =
     | { op: 'set'; field: string; value: FieldValue }
     | { op: 'setFromText'; field: string }        // TYPE text (from extractTypedText)
     | { op: 'setFromStroke'; field: string }      // DRAW stroke spec, e.g. 'SHAPE:smile'
     | { op: 'toggle'; field: string }
     | { op: 'copy'; from: string; to: string }
     | { op: 'resetFields' }                       // every field back to initialFields
     | { op: 'navigate'; pageId: string }          // '$previous' = previousPageId
     | { op: 'shake' };
   export interface ElementDef {
     mark: number;                 // SoM badge number, unique within its page
     key: string;                  // rendered as data-el="<key>"
     role: 'button' | 'card' | 'input' | 'canvas' | 'checkbox' | 'heading';
     label: string;                // visible text exactly as rendered
     visual?: { color?: string; glyphs?: string[]; row?: number; column?: number; timedColumn?: 0 | 1 | 2 };
     effects: Partial<Record<ActionKind, Effect[]>>; // an action with no entry is a harmless no-op
     aliases?: string[];           // English phrases; deterministic fallback only (item 10)
     thought?: string;             // witty first-person line for the fallback (item 10)
   }
   export interface PageDef { id: string; slug: string; title: string; elements: ElementDef[] }
   export type Predicate =
     | { field: string; eq?: FieldValue; nonEmpty?: true }
     | { all: Predicate[] }
     | { any: Predicate[] };
   export interface ExhibitDef {
     id: 'A' | 'B' | 'C' | 'D' | 'E';
     title: string; weight: number; criteria: string;
     verified: Predicate; contaminated?: Predicate; contaminatedNote?: string;
   }
   export interface ReplayStep { pageId: string; key: string; action: ActionKind; text?: string; stroke?: string }
   export interface PuzzleData {
     id: string; caseNumber: string; title: string;
     initialPageId: string; initialFields: Record<string, FieldValue>;
     pages: PageDef[]; exhibits: ExhibitDef[];
     replay: ReplayStep[];     // filled in item 8
     answerKey: string[];      // exact English lines shown in the report
     capturePresets?: Record<string, Partial<Record<string, FieldValue>>>; // item 9
   }
   export interface PuzzleState { pageId: string; previousPageId: string | null; fields: Record<string, FieldValue> }
   ```

2. Build the generic engine in `src/engine/puzzle_engine.ts`:
   - `applyDecision(puzzle, state, decision)` returns `{ next, summary, shake }`.
     - The decision targets `(pageId, mark)`. A mark that isn't on the current page is a no-op.
     - Navigating to the current page doesn't change `previousPageId`.
   - `evaluateExhibits(puzzle, state)`:
     - CONTAMINATED if `contaminated` matches; otherwise VERIFIED if `verified` matches; otherwise MISSED.
     - Stamp texts: `[VERIFIED ✓ +{weight}%]`, `[MISSED ✗ +0%]`, `[CONTAMINATED ✗ +0%]`.
   - `elementsOnPage(puzzle, pageId)`.
   - `scoring.ts` keeps its formulas and consumes these evaluations.

3. Write the Case #001 data in `src/data/puzzles/case_001/puzzle.ts`.
   - Pages: MV-01, MV-02, MV-03, MV-04, MV-05, MV-07, MV-08, MV-10, MV-11, MV-12 (10 pages).
   - **Delete MV-06 and MV-09**; they have no content.
   - `initialPageId: 'MV-01'`.
   - `initialFields`, exact:
     ```ts
     { selectedRoute: 'none', passengerName: '', trainName: 'none', seatClass: 'none', fare: 0,
       greenCarSelected: false, timedWindowHit: false, signatureStroke: '', insuranceAttached: false,
       finalConfirmed: false, confirmedWithInsurance: false }
     ```
   - Elements. Marks 11, 12 and 90 appear on every page except MV-07, which has only 71, 72 and 90:

     | Page | Mark | `key` | role | Effects |
     |---|---|---|---|---|
     | all except MV-07 | 11 | `nav_news` | button | CLICK → navigate MV-08 |
     | all except MV-07 | 12 | `promo_insurance` | button | CLICK → set `insuranceAttached` true; shake |
     | every page | 90 | `page_title` | heading | none (NOOP target) |
     | MV-01 | 1 | `route_tokaido` | card | CLICK → set `selectedRoute` `'tokyo_osaka'`; navigate MV-02 |
     | MV-01 | 2 | `route_tohoku` | card | CLICK → set `selectedRoute` `'tohoku'`; navigate MV-10 |
     | MV-01 | 3 | `route_hokuriku` | card | CLICK → set `selectedRoute` `'hokuriku'`; navigate MV-11 |
     | MV-01 | 4 | `route_points` | card | CLICK → navigate MV-12 |
     | MV-02 | 14 | `back` | button | CLICK → set `selectedRoute` `'none'`, `passengerName` `''`; navigate MV-01 |
     | MV-02 | 17 | `passenger_name` | input | TYPE → setFromText `passengerName`; navigate MV-03 |
     | MV-03 | 14 | `back` | button | CLICK → navigate MV-02 |
     | MV-03 | 21 | `seat_hikari_free` | button | CLICK → set `trainName` `'Hikari 515'`, `seatClass` `'ordinary_free'`, `fare` 13870, `greenCarSelected` false |
     | MV-03 | 22 | `seat_hikari_reserved` | button | CLICK → `'Hikari 515'`, `'ordinary_reserved'`, 14520, false |
     | MV-03 | 23 | `seat_nozomi_free` | button | CLICK → `'Nozomi 24'`, `'ordinary_free'`, 13870, false |
     | MV-03 | 24 | `seat_nozomi_reserved` | button | CLICK → `'Nozomi 24'`, `'ordinary_reserved'`, 14720, false |
     | MV-03 | 25 | `seat_nozomi_green` | button | CLICK and TIMED_CLICK → set `trainName` `'Nozomi 24'`, `seatClass` `'green_car'`, `fare` 13870, `greenCarSelected` true; navigate MV-04 (item 7 splits the two) |
     | MV-04 | 14 | `back` | button | CLICK → set `trainName` `'none'`, `seatClass` `'none'`, `fare` 0, `greenCarSelected` false, `timedWindowHit` false; navigate MV-03 |
     | MV-04 | 27 | `signature_pad` | canvas | DRAW → setFromStroke `signatureStroke` |
     | MV-04 | 28 | `insurance_checkbox` | checkbox | CLICK → toggle `insuranceAttached` |
     | MV-04 | 29 | `cancel_booking` | button | CLICK → navigate MV-07 |
     | MV-04 | 30 | `confirm_booking` | button | CLICK → set `finalConfirmed` true; copy `insuranceAttached` → `confirmedWithInsurance`; navigate MV-05 |
     | MV-07 | 71 | `cancel_confirm` | button `取り消す` | CLICK → resetFields; navigate MV-01 |
     | MV-07 | 72 | `cancel_dismiss` | button `戻る` | CLICK → navigate MV-04 |
     | MV-08 | 81 | `news_back` | button `◀ 戻る` | CLICK → navigate `'$previous'` |
     | MV-10 · MV-11 · MV-12 | 14 | `back` | button | CLICK → set `selectedRoute` `'none'`; navigate MV-01 |

   - Exhibits for this item:

     | Exhibit | Title | Weight | `verified` |
     |---|---|---|---|
     | A | `Route: 東京 → 新大阪` | 25 | `{ field: 'selectedRoute', eq: 'tokyo_osaka' }` |
     | B | `Passenger Name: TANAKA` | 20 | `{ field: 'passengerName', eq: 'TANAKA' }` |
     | C | `14:30 Nozomi • 🍀 ¥13,870` | 20 | `{ all: [trainName = 'Nozomi 24', seatClass = 'green_car', fare = 13870] }` |
     | D | `Sign Digital Authorization Pad` | 15 | `{ field: 'signatureStroke', nonEmpty: true }` |
     | E | `Final Blue Confirm` | 20 | `{ field: 'finalConfirmed', eq: true }` (item 7 adds `contaminated`) |

   - `answerKey`, exact (item 7 changes line 3):
     1. `Click the top-left green box`
     2. `Type TANAKA in the passenger name box`
     3. `Click the green 13,870 button in the 2nd row`
     4. `Draw a signature in the dashed box`
     5. `Click the blue confirm button at bottom right`

     The report renders its answer key from this array instead of the hard-coded list (`ExhibitsPanel.tsx:134-197`).

4. Renderer: move `ShinkansenSandbox.tsx` to `src/data/puzzles/case_001/Sandbox.tsx`.
   - It reads `state.pageId` and `state.fields`; delete the page-inference block.
   - Every element in the table gets `data-el="<key>"`, and every page heading gets `data-el="page_title"`.
   - Draw MV-07 as a centered modal card over a dimmed MV-04, containing `予約を取り消しますか？`, `取り消す` and `戻る`.
   - Draw MV-08 as a page titled `お知らせ` with two static news items and `◀ 戻る`.

5. The current resolver keeps working through an adapter: its `targetId` (`'#25'`) maps to `(state.pageId, 25)`. Page gating becomes "the mark exists on the current page".

6. Cursor targets come from the live DOM.
   - The target is the center of `[data-el="<key>"]` inside `#sandbox-core`, measured just before the glide and converted to 1024×768 stage coordinates (divide by the stage scale).
   - Delete `pageCoordMap` (`App.tsx:131-150`), `resolveCursorPosition` (`game_reducer.ts:304-337`) and the bounding boxes in the case data.
   - Item 4's NOOP fixed point becomes `[data-el="page_title"]`.

7. Add a test-only fixture puzzle, `test/fixtures/mini_puzzle.ts` (id `mini`): an English page with three buttons and a confirm page. It proves the engine has no Case #001 assumptions.

**Validation**
- ★ `test/puzzle_engine.test.ts` runs `mini` end to end: navigate, set, toggle, `$previous`, `resetFields`, and all three stamp states via a fixture exhibit with `contaminated`. Fails today: there is no generic engine.
- ★ For every Case #001 page, render the sandbox. Every registry element of that page has exactly one `[data-el]` node, and no `[data-el]` exists outside the registry.
- ★ `solvability.test.ts` enumerates actions from the registry; minimum = 5.
- ★ The F-4 test passes on every page via the registry (`#17` on MV-02 → NOOP).
- ★ MV-07 and MV-08 are reachable and recoverable:
  - On MV-04, CLICK 29 → MV-07; then CLICK 72 → MV-04 with fields unchanged.
  - CLICK 11 → MV-08; then CLICK 81 → back to the page you came from.
- Manual: play the answer key in `npm run dev`; the cursor lands on each target's center at window widths 1440 and 1024.

**Blast radius**
- `src/engine/game_reducer.ts`: the micro-state reducer goes; the line, ledger and case lifecycle stay.
- `src/App.tsx`, `src/components/SandboxStage.tsx`.
- `src/components/LoopedTargetReplay.tsx` reads `state.pageId`.
- `src/types/engine.ts`: `ShinkansenMicroState` is removed.
- `tools/lib/*`: the manifest builder reads `PuzzleData`.
- Every test importing `CASE_001_*`.
- Brief: Analysis §1 and Decision Log row 8 say "10-page" instead of "12-page".

---

## §9 Item 7 — Real flash-sale timing and the add-on trap (F-11; D-4, D-5)

**What this means for the user.** The "timed flash sale" is cosmetic, and the ¥2,400 insurance trap costs nothing. This item makes both real observation tests.

**The gap**
- Mark 25 records a timed hit on any click (was `game_reducer.ts:159-169`), while Exhibit C's criteria claim the click was timed.
- The flash timer lives inside the sandbox component (`ShinkansenSandbox.tsx:66-76`), so the agent can't wait on it.
- Exhibit E ignores add-ons.

**Implementation (D-4 = A, D-5 = A)**
1. Add a shared flash clock, `src/engine/flash_clock.ts`.
   - Period **950 ms**; columns cycle `0 → 1 → 2 → 0`; phase comes from `performance.now()`.
   - Exports `currentColumn()`, `waitForColumn(col, signal)` and `waitForColumnNot(col, signal)`.
   - The sandbox and the agent choreography read the same clock. The replay keeps its own scripted column.
2. Green-seat label: while `currentColumn() === 2` it reads `🍀 ◯ ¥13,870 (特割)`; otherwise `🍀 ◯ ¥19,590`. The column highlight stays as today.
3. Mark 25 gets `visual.timedColumn: 2` and these effects:

   | Action | Effects |
   |---|---|
   | **CLICK** | `trainName` `'Nozomi 24'`, `seatClass` `'green_car'`, **`fare` 19590**, `greenCarSelected` true, `timedWindowHit` false; navigate MV-04 |
   | **TIMED_CLICK** | the same, except **`fare` 13870** and `timedWindowHit` true |

4. Choreography, keeping the 1,150 ms glide:
   - For TIMED_CLICK on an element with `timedColumn`: after the glide, `await waitForColumn(timedColumn)` (≤ 2,850 ms), then click.
   - For a plain CLICK on such an element: `await waitForColumnNot(timedColumn)` (≤ 950 ms), then click.
   - This way the picture always matches the stored fare.
5. The page-04 summary and page-05 ticket show the stored `fare`, plus `＋保険 ¥2,400` when insurance was attached at confirmation.
6. Exhibits:
   - C criteria: `Clicked the 🍀 Green Car seat on Nozomi 24 while the flash-sale highlight was on it (¥13,870).`
   - E: `verified { all: [finalConfirmed = true, confirmedWithInsurance = false] }`, `contaminated { all: [finalConfirmed = true, confirmedWithInsurance = true] }`, `contaminatedNote: '¥2,400 travel insurance was attached'`.
   - The report shows the note under E's stamp when E is CONTAMINATED.
7. Answer key line 3 becomes, exactly: `Wait for the sale glow, then click the green ¥13,870` (52 characters).
   - In the current resolver, choose TIMED_CLICK when the instruction resolves to an element with `timedColumn` and contains any of `wait, when, until, timed, timing, flash, sale, glow, highlight, lights up`.

If D-4 = B: remove TIMED_CLICK from the types, resolver and copy; keep `fare` 13870 for any click on 25; and drop "timed" from C's criteria. If D-5 = B: E keeps `verified: { field: 'finalConfirmed', eq: true }`, with no `contaminated`.

**Validation**
- ★ CLICK 25 → `fare` 19590 and C MISSED; TIMED_CLICK 25 → `fare` 13870 and C VERIFIED. Fails today: both give 13870.
- ★ Confirm with insurance attached → E CONTAMINATED with the note. Uncheck it (CLICK 28) before confirming → E VERIFIED.
- ★ With a fake clock, a plain CLICK choreography never clicks while `currentColumn() === 2`, and a TIMED_CLICK always does.
- `solvability.test.ts` (with TIMED_CLICK in the action set) still finds a minimum of 5.
- Manual, in `npm run dev`:
  - `click the green button` lands at ¥19,590, and page 04 shows ¥19,590.
  - `wait for the sale glow, then click the green button` lands at ¥13,870.

**Blast radius**
- `src/data/puzzles/case_001/puzzle.ts`, `Sandbox.tsx`.
- `src/App.tsx` (choreography).
- `src/components/ExhibitsPanel.tsx` (the note under the stamp).
- The current resolver's #25 rule (`cloud_connector.ts:956-972`) and tests about #25.
- Brief:
  - Analysis §1 (Page 03) and Decision Log row 8 describe the price flip and the CLICK vs TIMED_CLICK rule.
  - Row 9 adds: "Exhibit E is CONTAMINATED when the ¥2,400 insurance is attached at confirmation."

---

## §10 Item 8 — Replay from data

**What this means for the user.** The replay is a hand-coded 100-tick timeline. It should play the case's script through the same engine as the game, so it can never show something the scoring disagrees with, and the next case needs no new replay code.

**The gap.** `src/components/LoopedTargetReplay.tsx:82-281` hard-codes the phases, the coordinates (`:24-31`) and `PASSENGER_NAME` (`:33`).

**Implementation**
1. The Case #001 `replay`, exact:

   | Step | Page | Action | Key | Text / stroke |
   |---|---|---|---|---|
   | 1 | MV-01 | CLICK | `route_tokaido` | — |
   | 2 | MV-02 | TYPE | `passenger_name` | `TANAKA` |
   | 3 | MV-03 | TIMED_CLICK | `seat_nozomi_green` | — |
   | 4 | MV-04 | DRAW | `signature_pad` | `SHAPE:signature` |
   | 5 | MV-04 | CLICK | `confirm_booking` | — |

2. Rewrite `LoopedTargetReplay` as a generic player.
   - It owns a `PuzzleState` that starts at `initialFields` and applies each step with `applyDecision`, the same engine the game uses.
   - It moves its cursor to the live `[data-el]` center inside its own stage.
3. Timings, exact:
   - glide 1,150 ms;
   - click hold 600 ms;
   - TYPE 220 ms per character, then 650 ms settle;
   - DRAW 6 steps × 180 ms, then 500 ms settle;
   - TIMED_CLICK waits for the scripted column 2, on a replay-local clock with the same 950 ms period;
   - 800 ms dwell after each navigation; 2,000 ms dwell on the final page; then reset and loop.

   Keep the existing pause/start and expand controls, the cursor art and the click glow.
4. With `replayAutoplay: false`, the player renders its first frame and doesn't loop.

**Validation**
- ★ `test/replay.test.ts`: applying `puzzle.replay` through `applyDecision` from `initialFields` yields closeness **100**. Fails today: no script exists.
- ★ For each `i`, resolving `answerKey[i]` with the deterministic fallback tier (pinned tier off, from item 10 on), at the state reached after steps 1…i, produces the same `(key, action, text)` as replay step i+1. Until item 10, use the current resolver.
- With a fake clock, one loop lasts the sum of the timings above, ± 1 tick.
- ★ `grep -rn "TANAKA\|Tanaka" src | grep -v "^src/data/puzzles/"` → no output. The answer key (item 6) and the replay (this item) now live in case data.
- Manual: the replay still loops smoothly at compact and expanded sizes.

**Blast radius.** `src/components/LoopedTargetReplay.tsx`, and tests that asserted phase numbers.

---

## §11 Item 9 — Capture pipeline: real SoM images and measured boxes (F-7, F-19, F-20)

**What this means for the user.** In the brief, the agent "sees" the page through a numbered screenshot. Today those screenshots are empty files, so no model can see anything.

**The gap**
- `tools/lib/offline_compiler.ts:108` serializes the TypeScript fixture.
- `template.html` is a stub (`:136-160`).
- All `public/puzzles/*/views/*.webp` files are 0 bytes, and 11 of 12 SoM SVGs are empty.
- The game never loads the manifest.
- `/puzzles/**` is served `immutable` (`firebase.json:43-47`).
- The font comes from the Google Fonts CDN (`index.html:9-11`).

**Implementation**
1. Self-host the font. Add `@fontsource/noto-sans-jp` (weights 400, 700 and 900), import it in `src/main.tsx`, and delete the Google Fonts `<link>` tags (`index.html:8-11`).
2. Add a capture entry, `capture.html` + `src/capture/main.tsx`, served only by the dev server and never part of `vite build`'s inputs.
   - URL: `/capture.html?case=001&page=<pageId>`.
   - It renders only the 1024×768 stage for that page, with no cursor.
   - Animations are off: `*{animation:none!important;transition:none!important}`.
   - Field values come from `capturePresets` in the puzzle data; for example, MV-04 has the green seat chosen.
3. `npx tsx tools/compile_puzzle.ts --case 001`:
   1. Start Vite with `createServer` on a free port, then launch Playwright Chromium at viewport 1024×768, `deviceScaleFactor: 1`.
   2. For each page: wait for `document.fonts.ready`, then measure every `[data-el]` box relative to the stage.
   3. Draw SoM badges in the page:
      - magenta `#C026D3` background;
      - white bold 14 px monospace digits;
      - 1 px white border and `1px 4px` padding;
      - placed at the element's top-left corner offset by (−4, −10), clamped inside the stage.
   4. Screenshot the stage to `public/puzzles/001/som/<pageId>.<first 8 hex of sha256>.png`.
   5. Write `src/data/puzzles/case_001/manifest.generated.json` with keys sorted, so output is byte-stable:
      ```json
      { "puzzleId": "001", "stage": { "w": 1024, "h": 768 },
        "pages": { "<pageId>": { "som": "/puzzles/001/som/<file>",
                                 "elements": [{ "mark": 0, "key": "", "box": { "x": 0, "y": 0, "w": 0, "h": 0 } }] } } }
      ```
   6. Delete stale PNGs in that folder.
   7. Keep the existing exit-code table (`tools/compile_puzzle.ts:283-291`).
4. `--case 001 --validate` checks the puzzle data against the manifest without launching a browser:
   - every registry element has a box;
   - every box lies inside 1024×768;
   - every image file exists and is larger than 10 KB.
5. The game imports `manifest.generated.json`; Vite bundles it, so it is content-hashed.
   - SoM image names are content-hashed too, so the `immutable` header is safe.
   - Remove the old offline-JSDOM `case 042` path and the `template.html` output.
   - Leave `--url` and `--fixture` as they are; don't extend them.
6. Delete the old `views/*.webp` placeholders. Commit the generated PNGs and manifest; they ship with the site.

**Validation**
- ★ After a capture, every `som/*.png` is larger than 10 KB, and the manifest has a box for every registry element on every page. Fails today: the files are 0 bytes and only MV-03 has boxes.
- ★ Two captures in a row produce a byte-identical manifest and the same image names.
- ★ For each page, every element's manifest box center is within **2 px** of its live DOM center measured in the dev server at 1024×768. This proves the image and the live page agree.
- `npm run build` contains no `capture` chunk, and the main JS stays ≤ 120 kB gzip.

**Blast radius**
- `tools/compile_puzzle.ts`, `tools/lib/*`.
- `test/puzzle_compiler.test.ts`.
- `test/challenger_m4_empirical.test.ts`: keep exit codes 0–7, retargeted to case 001 with `--validate`.
- `index.html`, `package.json`.

---

## §12 Item 10 — One agent pipeline with a data-driven fallback (F-3, F-4, F-6 part, F-17)

**What this means for the user.** Today the "AI" is a keyword list that only understands phrasings someone thought of in advance. This item gives every player one pipeline, a fallback that reads the case's data instead of hard-coded rules, and a published answer key that is guaranteed to work.

**The gap**
- `src/engine/cloud_connector.ts:602-1237` (`evaluateClientSideDecision`, `BrowserGeminiNanoTransport`) and `:1243-1479` (`CloudVisionConnector`).
- `src/engine/offline_simulator.ts` (hard-coded branches and Case #001 numbers).
- `vite.config.ts:10-383`, a third copy of the regex as dev-server middleware.
- `scripts/exploit_probe.mts`.

**Implementation**

1. Create `src/engine/agent/` with `resolveLine(ctx): Promise<AgentDecision>`, where `ctx = { puzzle, manifest, state, instruction, visibleText }`. `visibleText` is `#sandbox-core`'s `textContent` at dispatch time.

   The tiers run in this order:
   1. **Validation** — the existing `validateInstruction`.
   2. **Guardrails**, each → NOOP:
      - `isMetaPrompt` → meta-prompt thought;
      - explicit mark-ID syntax → mark-ID thought;
      - a bare number N that equals a mark on the current page while N is not among the digit runs of `visibleText` (commas removed) → mark-ID thought.
   3. **Pinned** — `answerKey[i]` pairs with `replay[i]`. If the normalized instruction equals a normalized `answerKey[i]` **and** the current page is `replay[i].pageId`, return `replay[i]` as the decision. This keeps the published answer key working no matter what the model does.
   4. **Cloud** — item 11. Skipped until then.
   5. **Fallback** — `fallbackResolve`, described below.

   ```ts
   type AgentDecision = {
     action: 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK' | 'NOOP';
     pageId: string; mark: number | null; text?: string; stroke?: string; thought: string;
     tier: 'guardrail' | 'pinned' | 'cloud' | 'fallback'; cloudFailed?: boolean;
   };
   ```

2. `fallbackResolve` scores every element on the current page except `page_title`.

   | Signal | Points | Rule |
   |---|---|---|
   | Alias | +40 | any alias phrase occurs in the normalized instruction (word boundaries) |
   | Colour | +30 | `visual.color` or a synonym (`grey`/`gray`) occurs |
   | Glyph | +35 | via the existing `GLYPH_DICTIONARY` |
   | Number | +25 | any number in the instruction (commas removed) appears in the label's digits |
   | Position | +20 | see the position rules below |
   | Role word | +15 | `box`/`field`/`input` → input; `pad`/`box`/`canvas` → canvas; `checkbox`/`tick`/`check box` → checkbox; `card` → card; `banner`/`ad` → promo button |
   | TYPE intent | +30 to input elements | verbs `type, enter, write, input, fill`, or quoted text |
   | DRAW intent | +30 to canvas elements | `draw, sign, signature, scribble, doodle`, or a shape word from `extractSignatureDrawingSpec` |

   Position rules, measured from the manifest box center:
   - `left` (x < 341), `right` (x > 683), `top` (y < 256), `bottom` (y > 512);
   - `middle`/`center` when x is 341–683 or y is 256–512;
   - `first row`/`row 1`/`top row` ↔ `visual.row = 1`;
   - `second row`/`2nd row`/`row 2` ↔ `visual.row = 2`;
   - `last column`/`third column`/`right column` ↔ `visual.column = 3`.

   Choosing:
   - Take the highest score **≥ 30**.
   - On a tie, take the first element in reading order (box center y, then x), with the thought `💭 Two things matched — I went with the first one.`
   - Below 30 → NOOP with the no-signal thought.

   Action:
   - TYPE for inputs, with text from `extractTypedText`.
   - DRAW for canvases, with stroke from `extractSignatureDrawingSpec(instruction).strokeValue`.
   - TIMED_CLICK for elements with `timedColumn` when a timing word from item 7 occurs.
   - Otherwise CLICK.

   Thought: the element's `thought` if set. Otherwise:
   - CLICK: `💭 Clicking the {label} — fingers crossed!`
   - TYPE: `💭 Typing "{text}" one key at a time.`
   - DRAW: the stroke spec's thought.

3. Author `aliases` and `thought` for every Case #001 element in `puzzle.ts`. The minimum alias sets are below. Add more if useful, but never a word that only makes sense if you already know the answer.

   | Key | Aliases |
   |---|---|
   | `route_tokaido` | tokaido, tokyo, osaka, shin-osaka, first card, card 1, route 1, top left, top-left, green card, green box |
   | `route_tohoku` | tohoku, sendai, aomori, hokkaido, second card, card 2, route 2, top right, top-right |
   | `route_hokuriku` | hokuriku, kanazawa, nagano, niigata, third card, card 3, route 3, bottom left |
   | `route_points` | points, ic card, fourth card, card 4, menu 4, bottom right |
   | `nav_news` | news, notice, notices, announcements |
   | `promo_insurance` | insurance, banner, ad, advert, promo, red button |
   | `back` | back, go back, return, previous |
   | `passenger_name` | name, passenger, text box, textbox, input, field |
   | `seat_hikari_free` | hikari, 515, unreserved, free seat |
   | `seat_hikari_reserved` | triangle, reserved |
   | `seat_nozomi_free` | nozomi, unreserved, free seat |
   | `seat_nozomi_reserved` | reserved |
   | `seat_nozomi_green` | green car, first class, clover, discount, sale, special |
   | `signature_pad` | signature, sign, pad, dashed box, canvas |
   | `insurance_checkbox` | checkbox, check box, tick, insurance |
   | `cancel_booking` | cancel, grey button, gray button |
   | `confirm_booking` | confirm, book, submit, issue, final, proceed, finish booking |
   | `cancel_confirm` | yes, cancel it, confirm cancel |
   | `cancel_dismiss` | no, keep, go back |
   | `news_back` | back, return |

   Also set:
   - `visual.color`: `route_tokaido` green; `promo_insurance` red; `seat_nozomi_green` green; `confirm_booking` blue; `cancel_booking` grey; both free seats white.
   - `visual.glyphs`: ◯ on 21, 23 and 24; △ on 22; 🍀 on 25; ▶ on 30.
   - `row` and `column` for the five seats.

4. `App` dispatch calls `resolveLine`, then `applyDecision`, then the existing choreography.
   - NOOP choreography: glide to `page_title`, then a 3-step, 6 px wiggle at 120 ms per step.
   - The ledger shows ` (backup agent)` after the summary only when `cloudFailed` is true.

5. Delete:
   - `src/engine/cloud_connector.ts`. Move the helpers that are still needed (the decoding steps of `filterPromptSyntheticIds`) into `src/engine/agent/`.
   - `src/engine/offline_simulator.ts`. Keep `GLYPH_DICTIONARY` and `COLOR_DICTIONARY` in `src/engine/agent/dictionaries.ts`.
   - The dev-server middleware in `vite.config.ts` (`:10-383`); keep `defineConfig` with `react()` and the `test` block.
   - `scripts/exploit_probe.mts`, after porting all its scenarios to `test/exploits.test.ts`.

**Validation**
- ★ `test/exploits.test.ts` runs every probe scenario through `resolveLine` → `applyDecision`:
  - F-1 ≤ 65 %, with B and D MISSED;
  - F-2 types `PASSENGER NAME`;
  - F-3 gibberish and meta-prompts → NOOP;
  - F-4 `#1`, `#17`, `#30`, and bare `25` on MV-03 → NOOP;
  - F-5 official score unchanged.
- ★ Fallback only, with the pinned tier disabled: the five answer-key lines from the initial state score 100 % in 5 lines. This proves the fallback understands the published answers without pinning.
- ★ Determinism: 100 seeded random instructions resolve to identical decisions on two runs.
- ★ Goal blindness: a spy shows `fallbackResolve` receives only `pages`, `manifest`, `state` and `instruction` — never exhibits, the answer key or the replay.
- `grep -rn "evaluateClientSideDecision\|BrowserGeminiNano\|LanguageModel" src vite.config.ts` → no output.

**Blast radius**
- Rewrite against `resolveLine`, deleting what only tested deleted code (listed in the commit body):
  - `test/cloud_connector.test.ts`
  - `test/offline_agent.test.ts`
  - `test/adversarial_engine.test.ts`
  - `test/adversarial_normalizer.test.ts`
  - `test/e2e_adversarial_hardening.test.ts`
  - `test/player_cujs.test.tsx`

---

## §13 Item 11 — Free cloud tier via Firebase AI Logic (F-6; D-1)

**What this means for the user.** Every player, on a phone or a laptop, gets the same real model reading the page, at no cost. The fallback catches any quota or network failure.

**Prerequisites.** Owner actions OA-1 to OA-4 in the tracking doc.
- Build and test everything without them.
- The cloud tier turns on only when **all** of these are set: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_APPCHECK_SITE_KEY`, `VITE_AGENT_MODEL_ID`.
- Otherwise the pipeline skips the tier and never shows `(backup agent)`.

**The gap.** Almost no player reaches a model (F-6). `functions/` can't deploy on Spark, and nothing calls it (F-17).

**Implementation (D-1 = A)**

1. Run `npm install firebase`. `src/engine/agent/cloud_tier.ts` lazy-imports `firebase/app`, `firebase/app-check` and `firebase/ai` on the first dispatch, via dynamic `import()`, so the initial bundle doesn't grow:
   ```ts
   const app = initializeApp(firebaseConfig);
   initializeAppCheck(app, { provider: new ReCaptchaV3Provider(SITE_KEY), isTokenAutoRefreshEnabled: true });
   const ai = getAI(app, { backend: new GoogleAIBackend() });
   const model = getGenerativeModel(ai, {
     model: MODEL_ID,
     generationConfig: { temperature: 0, maxOutputTokens: 256, responseMimeType: 'application/json', responseSchema },
   });
   ```
   - In dev only (`import.meta.env.DEV`), set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before `initializeAppCheck`.
   - If a name in the current Firebase AI Logic web docs differs, follow the docs (deviation rule).

2. `responseSchema`: an object with required fields:
   - `action`: enum `CLICK`, `TYPE`, `DRAW`, `TIMED_CLICK`, `CONFUSED`;
   - `mark`: integer, nullable;
   - `text`: string, nullable;
   - `thought`: string.

3. The request has two parts.
   - (a) The current page's SoM PNG from the manifest, fetched once per page and sent as inline base64 `image/png`.
   - (b) One text part: `JSON.stringify({ screen: page.title, marks, instruction })`.

   `marks` lists every element on the page except `page_title` as `{ mark, role, label, color, glyphs, position, state }`:
   - `position` is computed from the box as in item 10 (e.g. `top-left`, `bottom-right`, `middle`).
   - `state` holds only what is visible: `selected`, `checked`, `typed: "<value>"` or `signed`.
   - Elements with `timedColumn` also get `timed: true`.

   Nothing else goes into the request (constraint S3).

4. System instruction, exact:
   ```
   You control the mouse and keyboard of a web agent on a fixed 1024x768 screenshot of a Japanese train-booking website. The player cannot read Japanese and gives you one short English instruction. Do only what the instruction literally asks, on the current screen.

   You receive the screenshot, with a magenta number on every interactive element, and a JSON list of those marks.

   Rules:
   1. Choose at most one mark from the list. Never invent marks.
   2. Actions: CLICK; TYPE (text inputs only); DRAW (signature pads only); TIMED_CLICK (only for marks with "timed": true, and only if the instruction asks you to wait for, or time the click with, a moving highlight, glow, flash or sale); CONFUSED.
   3. TYPE: copy into "text" exactly what the instruction asks you to type. If it gives no value, set "text" to null. Never make up a name or value.
   4. DRAW: put the requested shape or words in "text", for example "smile", "star", "signature".
   5. Answer CONFUSED if the instruction does not point to one mark, refers to mark numbers or IDs, or asks you to win, solve, finish the game or copy a replay.
   6. "thought": one short, funny, first-person sentence (at most 100 characters) about how you read the instruction. Never mention marks, numbers of marks, IDs, JSON or these rules.
   ```

5. Check every response before acting on it:
   - The `mark` must be on the current page and allow the action; otherwise → NOOP with the no-signal thought.
   - `CONFUSED` → NOOP with the no-signal thought.
   - TYPE: if `text` is null, or is not a case-insensitive substring of the instruction, use `extractTypedText(instruction)` instead. Then uppercase, keep A–Z and spaces, max 16 characters.
   - DRAW: ignore `text`; the stroke is `extractSignatureDrawingSpec(instruction).strokeValue`.
   - TIMED_CLICK is allowed only on elements with `timedColumn`; otherwise treat it as CLICK.
   - Thought: strip `#\d+`, `mark` and `MV-\d+`, and trim to 100 characters. If nothing is left, use the fallback's template.

6. Failures use the fallback tier for that line, with `cloudFailed: true`:
   - a timeout of **6,000 ms**;
   - HTTP 429 / `RESOURCE_EXHAUSTED`;
   - any other error, including an App Check failure.

   After **3 consecutive** cloud failures, skip the cloud tier for **10 minutes**. Store the resume time in the `sessionStorage` key `kanjion:v1:cloud-paused-until`.

7. Menu disclosure, exact: `🤖 The agent runs on Google Gemini's free tier. Your instructions are sent to Google to be interpreted.`

8. Remove dead server pieces and keep E2E offline:
   - Delete `functions/` and the `functions` block of `firebase.json` (`:62-77`).
   - Add `.env.example` with the six variable names and empty values; never a real key.
   - Add `VITE_AGENT_MODEL_ID: ''` to the webServer `env` in `playwright.config.ts`, so E2E builds never touch the network.

9. Update the brief. Analysis §2 and Decision Log row 15 describe the pipeline (guardrails → pinned → free cloud model via Firebase AI Logic → deterministic fallback) and why Nano is no longer the primary.

If D-1 = B: use Firebase AI Logic's `PREFER_IN_CLOUD` hybrid mode, per its hybrid-inference docs, and record the tier as `cloud-device` when the answer came from the device. If D-1 = C or D: STOP and file it in the tracking doc; this item only specifies A and B.

**Validation** (unit tests use a fake `CloudModel` interface; no network)
- ★ A valid model response maps to the right decision.
- ★ A mark that isn't on the page → NOOP.
- ★ TYPE text `"YAMADA"` for the instruction `type the name` → `NAME` (hallucination blocked).
- ★ A 429 → fallback decision with `cloudFailed: true`, and the ledger shows `(backup agent)`.
- ★ Three failures → no cloud call for the next 10 minutes (fake clock).
- ★ A cloud tier that isn't configured → no call and no marker.
- ★ Goal blindness: the serialized request for every Case #001 page, with an empty name, contains none of `TANAKA`, `exhibit`, `answer`, `replay`, `decoy`, `trap`, `target`, `weight`, `pinned`.
- `npm run build`: the main chunk is ≤ 120 kB gzip, and Firebase lives in a separate lazily loaded chunk.
- Manual, by the owner after OA-1–OA-4, in `npm run dev` with `.env.local`:
  - the answer key scores 120;
  - `asdf` on page 04 → NOOP;
  - `click the button with the leaf` on page 03 picks the green seat;
  - App Check metrics show verified requests.

**Blast radius.** `package.json`, `firebase.json`, `functions/` (deleted), `src/App.tsx` (menu line), `.env.example` (new), `concepts_brief.md`.

---

## §14 Item 12 — Daily schedule (F-15; D-6)

**What this means for the user.** A daily game needs to know which case is today's and when the next one arrives. Today there's one hard-coded case and no notion of a day.

**Implementation (D-6 = A)**
1. Add `src/data/schedule.ts`, exactly:
   ```ts
   export const SCHEDULE: ReadonlyArray<{ date: string; puzzleId: string }> = [
     { date: '2026-11-05', puzzleId: '001' },
   ];
   ```
2. `todaysPuzzle(now: Date)` returns the last entry whose `date` is on or before the player's **local** date (`YYYY-MM-DD` from `now`'s local fields). The app loads that puzzle from a registry, `PUZZLES: Record<string, PuzzleData>`.
3. Persistence keys stay per puzzle (`kanjion:v1:case:<id>`), so a new day's case is never blocked by yesterday's result.
4. The cover shows `CASE FILE #{caseNumber} • {date}`, where `{date}` comes from `toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })` — e.g. `CASE FILE #001 • Saturday, November 7`.
5. The report footer shows:
   - `Next case in HH:MM:SS`, a live countdown to the next local midnight, when a later schedule entry exists;
   - otherwise `Next case: coming soon`.

If D-6 = B or C, compute the date in `Asia/Tokyo` or UTC with `Intl.DateTimeFormat` instead.

**Validation** (build dates from local components, e.g. `new Date(2026, 10, 6, 23, 59, 59)`)
- ★ With the test schedule `[{ '2026-11-05': '001' }, { '2026-11-07': 'mini' }]`:
  - at 23:59:59 local on Nov 6 → `001`;
  - at 00:00:00 local on Nov 7 → `mini`;
  - a stored official result for `001` doesn't change what `mini` shows.
- At 23:59:58 local, the countdown reads `Next case in 00:00:02`.

**Blast radius.** `src/App.tsx`, `src/components/NewspaperFrontCover.tsx`, `src/components/ExhibitsPanel.tsx`.

---

## §15 Item 13 — Phone zoom (F-16; D-7)

**What this means for the user.** On a phone the page renders at a third of its size and the Japanese is unreadable, so phone players can't really play a game built on observation.

**Implementation (D-7 = A).** If D-7 = B, instead show `Best on a laptop — the pages are tiny on phones.` under the masthead below 768 px, and skip the rest.
1. Below 768 px viewport width, the agent-page header and the replay header each show a `🔍 Zoom` toggle, which reads `↙ Fit` while zoomed.
2. While zoomed:
   - the stage scale is `min(1, 2 × fitScale)`;
   - it sits inside a container with `overflow: auto` and `touch-action: pan-x pan-y`;
   - the page itself never scrolls horizontally.
3. After each dispatched line, if zoomed, scroll the container so the agent cursor is centered.
4. Don't block pinch-zoom; leave the viewport meta tag as it is.

**Validation**
- ★ Playwright project `mobile-chromium` (375×812, `isMobile`, `hasTouch`), after tapping `🔍 Zoom`:
  - the height of `[data-el="page_title"]` is at least 2× its height before;
  - `document.documentElement.scrollWidth` stays 375.

  Today there is no zoom.
- After dispatching `click the top-left green box` while zoomed, the cursor is inside the visible part of the container.

**Blast radius.** `src/components/SandboxStage.tsx`, `src/components/LoopedTargetReplay.tsx`, `src/App.tsx`, `playwright.config.ts` (new project).

---

## Deferred — do not start

| ID | Item | Trigger |
|---|---|---|
| DEF-1 | Shared pre-warmed decision cache: at authoring time, run likely phrasings through the cloud tier and ship the results as static JSON beside the puzzle, read before the cloud tier. | More than 10 % of a day's lines show `(backup agent)` on 2 days in one week, or the owner plans a public launch push. |
| DEF-2 | Gemini Nano only for the "Model Thought" wording — never the action. | The owner asks. |
| DEF-3 | Authoring tooling for Case #002 and later (`--url` bootstrap, a second `Sandbox.tsx`). | The owner starts writing Case #002. |
| DEF-4 | Usage analytics (fallback rate, popular phrasings). | The owner asks. It needs a privacy note. |

## Already delivered — do not rework

- Newspaper front cover and unfold, the menu drawer, and the two-page spread with the compact/expandable replay (`src/App.tsx:444-605`, `src/components/NewspaperFrontCover.tsx`).
- Dispatch pad structure: 60-character limit, live multiplier, close-case button, Line 06 auto-close (`src/components/DispatchPad.tsx`, `src/engine/game_reducer.ts:442-570`).
- Scoring formulas: closeness sum, `M = 1 + 0.2 × unused` capped at 2.0, rounding (`src/engine/scoring.ts:73-119`).
- Stamp visuals and tilt (`src/components/ExhibitsPanel.tsx`, `src/engine/scoring.ts:40`).
- The open-ended drawing parser and shapes (`src/utils/text_normalizer.ts:280-544`).
- The fixed 1024×768 stage with uniform scaling, and the selection/copy lock on the stage (`src/components/SandboxStage.tsx:24-81`).
- Agent cursor art, thought note and trap shake (`src/components/AgentCursor.tsx`, `src/index.css`).
- The witty tone of the thoughts.

## Accepted equivalents — do not "fix" back

- The replay is an always-on looping panel, not a toggle overlay (brief decision 6).
- The replay renders live DOM, not a canvas. Blocking paste into `#telegram-input` (item 5) is the anti-copy measure.
- Signatures are SVG path presets, not freehand strokes.
- The input width is the inline `calc(60ch + 1.75rem)`, not Tailwind `w-[62ch]`; decision 7's intent (60 characters fill the box) is met.
- TYPE into the name field advances to page 03 without a separate "Next" button.
- "Always act" is satisfied by NOOP's visible poke at the page title when there's no usable signal.

## Intentional decisions / invariants — do not change

- The model must be free (owner-locked). No billing, no paid APIs.
- No COL A–D / ROW 1–4 rulers, no debug chrome, no difficulty toggles (brief decision 5). Don't reintroduce grid references in prompts either.
- The click lock on the agent page is silent (decision 10), and so is the paste block.
- 6 lines × 60 characters; start at Line 01; the multiplier formula; weights A 25 · B 20 · C 20 · D 15 · E 20; positive exhibit titles.
- Kinematics: 1,150 ms glide, 220 ms per typed character, the existing signature timing, 700 ms click hold.
- The answer key appears when the official score is under 100 %. Outbound "Inspired by eki-net.com" links stay.
- No accounts and no server-side database for session state (original brief non-goals).
- The newspaper look: `#F4EFE6` paper, `#111111` ink, gazette serif plus monospace.

## Where the contracts live

- Product intent: `concepts_brief.md` (owner). Selected decisions and findings: `ongoing_general_errors.md`.
- Puzzle data contract: `src/types/puzzle_data.ts` (item 6).
- Game configuration: `src/config/game_config.ts` (item 1).
- Agent decision shape and tiers: `src/engine/agent/` (items 10–11).
- Scoring math: `src/engine/scoring.ts`.
- Firebase AI Logic web setup: https://firebase.google.com/docs/ai-logic/get-started?platform=web
- App Check: https://firebase.google.com/docs/app-check
- Hybrid inference modes (only if D-1 = B): https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
- Chrome Prompt API limits, which explain why Nano isn't the primary: https://developer.chrome.com/docs/ai/prompt-api

---

## THE LOOP (repeat for each item)

1. Re-read the item and its F- and D-entries. Confirm the D-selection it depends on.
2. Write the ★ tests first. Run them and confirm they fail for the stated reason.
3. Implement the steps in order, staying inside the item's scope.
4. Run the battery: `npm test`, `npm run build`, `npm run test:e2e` (from item 1 on), plus the item's own commands.
5. Do the item's manual check in `npm run dev`.
6. Update the blast-radius files, including the brief's Decision Log wherever behavior changed.
7. In `ongoing_general_errors.md`, move the item's F-entries to **Resolved**, each with one line: `F-n — resolved by item N (<short note>)`.
8. Commit with subject `fix(kanjion): item N — <item title>`. The body says what changed, why (F/D ids), which tests were deleted and why, and any deviation.
9. Update §1's numbers (test count, gzip size) in the same commit.

Then go on to the next item.

## Definition of Done

- [ ] Items 1–13 are committed, each with its ★ tests passing.
- [ ] `npm test`, `npm run build` and `npm run test:e2e` are green, and the main JS is ≤ 120 kB gzip.
- [ ] `test/exploits.test.ts` and `test/solvability.test.ts` are green.
- [ ] Every F-entry is under Resolved. Every Blocked entry is either answered by the owner or still listed with its options.
- [ ] `concepts_brief.md` matches the shipped behavior.
- [ ] §1 shows the final numbers, and the title says **Queue Complete**.
- [ ] **Queue empty → stop. Don't invent work.** The only legitimate triggers for more work are a message from the owner, an answered Blocked entry, or a DEF-n trigger firing.
