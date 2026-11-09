# Kanjion — Agent Execution Guide · Queue Complete: Frustratingly Funny · 2026-11-08

You are an implementor agent with no memory of this project. This file is your single entry point. Read it top to bottom before you touch code. Then work the queue in §2 one item at a time, using **THE LOOP** at the end.

**What this build is for.** The game is too easy: five lazy lines (`green` / `name tanaka` / `sale` / `draw a dragon` / `blue`) score the maximum, and "draw a dragon" passes the signature check. The owner wants the difficulty to live in *instructing* the agent, and wants the comedy to come from a literal-minded intern on pages as cluttered as real Japanese booking sites — like the frustrating fun of a New York Times game.

**Approved scope:** items 1–8 below, nothing else.

**Specs are decisions.** Every number, file name, identifier and quoted string here is deliberate. Implement it as written; don't substitute your own values or copy.

**Companion documents**
- [`ongoing_general_errors.md`](ongoing_general_errors.md) holds:
  - the findings **F-21…F-27** for this build (F-1…F-20 are resolved);
  - the owner's decisions **D-1…D-14** (read each `Your selection:` line);
  - owner actions **OA-n**;
  - the Blocked / Resolved lists.
- [`concepts_brief.md`](concepts_brief.md) is the product brief.

**Precedence.** When a selected D-entry differs from the brief, the D-entry wins: update the brief's Decision Log in the same commit. When a D-entry selection differs from what an item below assumes, follow the selection and adapt the steps.

**Branch and commits.** Work on a new branch `feat/frustratingly-funny`, created from `main`. Commit locally; never push.

---

## Standing constraints (apply to every item)

- **S1 Free only — owner-locked.** Never link a billing account, add a paid API, or add a service that needs a card.
- **S2 No secrets in the client.** Only the public Firebase web config and the App Check site key, via `VITE_*` variables in `.env.local`. Never commit a real key.
- **S3 Goal blindness.** Nothing sent to a model, and nothing the fallback scores, may contain:
  - exhibit definitions or criteria;
  - expected values that aren't visible on the current screen (e.g. `TANAKA` before it is typed);
  - the replay script, the answer key, or pinned answers.

  Allowed authoring metadata: `aliases`, `thought`, `visual`, and the new `PageDef.distractionKey`. The distraction is a fixed per-page element, not a hint about the goal.
- **S4 One agent for everyone.** Scored play uses the same tiers in the same order on every device. The fallback is a pure function of (puzzle, page, fields, instruction).
- **S5 Test the shipped game.**
  - No `process.env.NODE_ENV` in `src/`.
  - No hidden or `sr-only` text for tests.
  - No production branches keyed on `navigator.webdriver`, query parameters or globals.
  - Tests configure the app only through `GameConfig`.
- **S6 Keep the decided look and feel.**
  - The newspaper cover and the two-page spread (agent 8/12, replay 4/12; expanded 5/12 + 7/12).
  - 6 lines × 60 characters; multiplier `1 + 0.2 × unused lines`, capped at 2.0×.
  - Exhibit weights A 25 · B 20 · C 20 · D 15 · E 20.
  - Kinematics: 1,150 ms glide, 220 ms per typed character, 6 × 180 ms + 500 ms signature, 700 ms click hold.
- **S7 Bundle budget.** Initial JS ≤ **120 kB gzip** (baseline 85.76 kB).
- **S8 Hands off production.**
  - Never deploy, push, or change Firebase or Google Cloud console settings. Owner-only work goes to "Owner actions" in the tracking doc.
  - Don't edit `.agents/`.
- **S9 Copy is verbatim.** Quoted UI strings below are exact, including punctuation and emoji.
- **S10 Green before every commit.**
  - Every item ends with the full battery (§1) passing.
  - If you delete a test, name it in the commit body and say which item removed its behavior.
- **S11 Realism (D-8).**
  - Every element you add must be something a real Japanese booking site plausibly shows.
  - Sandbox copy stays Japanese. It must keep passing the Latin-letters test at `test/ui_components.test.tsx:552`: only `PR`, `IC` and `QR` may appear as runs of two or more Latin letters, and single letters such as `e`/`A` are fine.
- **S12 No artificial penalties and no feints (D-9, D-11).**
  - A wrong click has only its natural effect (navigate, select, attach what the element attaches).
  - Never add effects that punish later, such as re-attaching add-ons or multi-step escapes.
  - The replay shows only the steps to copy.
- **S13 Fair frustration.** The same (page, fields, instruction) always gives the same result for every player. Every failure must be explainable by the intern rules in item 1.
- **S14 The published answer is always reachable.**
  - After each item, every `answerKey` line must:
    - be ≤ 60 characters;
    - describe only things a non-Japanese reader can see (colour, position, icons, digits, Latin text typed by the replay);
    - reproduce its replay step through the fallback with the pinned tier **off**.
  - The minimum number of agent actions that reaches 100 % stays **5** (`test/solvability.test.ts`).

**Deviation and escalation.**
- If a value is impossible as written, keep the intent, deviate minimally, and say so in the commit body.
- If a design can't work, STOP that item. File it under **Blocked — needs owner** with 2–3 options and a `Your selection:` line, then continue with the next item that doesn't depend on it.

---

## §1 Verified baseline (run 2026-11-08 — the regression bar)

| Gate | Command | Result on 2026-11-08 |
|---|---|---|
| Unit/component | `npm test` | **428 passed / 27 files** (≈ 22 s) |
| Typecheck + build | `npm run build` | Clean. `dist/assets/index-*.js` 310.38 kB, **93.27 kB gzip**. |
| Compiler | `npx tsx tools/compile_puzzle.ts --case 001 --validate` | Exit 0. |
| E2E | `npm run test:e2e` | **3 passed** (`desktop-chromium`, `mobile-chromium`). |
| Lint | — | No lint script exists. |
| Difficulty probe | `npx vitest run test/difficulty.test.ts` | **0 of 28** lazy prompts reproduce the replay step, and the laziest run `["green","name tanaka","sale","draw a dragon","blue"]` scores **0 %** (`scripts/difficulty_probe.mts` ported and deleted in item 8). |
| Live site | `curl -s https://kanjion-game.web.app/` | Still serves the pre-fix bundle `assets/index-DWnC1R4E.js` (F-27, owner action OA-5). |

---

## §2 Execution order

| # | Item | Why this position |
|---|---|---|
| 1 | Literal-intern rules in the fallback | Every page item's ★ tests depend on these rules: ties, the distraction click, bare words, and scoring that rewards precision. Generic, so it's testable on today's pages and the `mini` fixture. |
| 2 | The drawing must match the replay | The owner's specific complaint ("draw a dragon" passes). Small and independent of the page redesigns. |
| 3 | Page 01: a realistic portal homepage | First page of the flow. Adds `orange`, banners and tabs, which items 4–6 reuse. |
| 4 | Page 02: the name-form maze | Depends on item 1's bare-word rule. |
| 5 | Page 03: timetable overload | Depends on item 1's ordinal rows and columns. |
| 6 | Page 04: 確認 vs 確定 | Last page of the flow. After it, all four lazy-prompt suites exist. |
| 7 | Cloud tier follows the same rules | The prompt and selection rules need the final marks, colours and distraction elements from items 3–6. |
| 8 | Show the struggle | Needs final exhibits, replay and line outcomes. Deletes the difficulty probe once its scenarios are tests. |

★ marks the falsifying assertion in each Validation block. It's a test that fails against today's code for the stated reason. Write it first and watch it fail.

**After every page item (3–6):** re-run the capture `npx tsx tools/compile_puzzle.ts --case 001`, then `--validate`, and commit the regenerated `public/puzzles/001/som/*.png` and `src/data/puzzles/case_001/manifest.generated.json`. The fallback's reading order and position words use those boxes.

---

## §3 Item 1 — Literal-intern rules in the fallback (F-23, F-24; D-10)

**What this means for the user.** Today a one-word hint like "green" solves a step, and an instruction the agent doesn't understand makes nothing happen. The intern should commit to a confident, predictable, sometimes-wrong reading. That's where the challenge and the comedy come from.

**The gap** (`src/engine/agent/fallback.ts`)
- Aliases score +40 once, so a more specific description scores no higher (`:94-113`).
- Position words score +20 once (`:170-216`).
- Rows stop at 2 and are hard-coded to Case #001 train words `hikari|515|14 12` and `nozomi|24|14 30` (`:172-173`).
- `promo_insurance` is special-cased by key (`:224`).
- Below a score of 30 the result is NOOP, so nothing happens (`:286-294`).
- Ties always say "Two things matched" (`:305`, `:321`, `:341`).
- A bare word like `tanaka` does nothing.

**Implementation**
1. Types (`src/types/puzzle_data.ts`):
   - `ElementDef.role` adds `'banner' | 'link' | 'tab'`.
   - `PageDef` adds `distractionKey?: string`.
   - The distraction element must have role `banner`, `link` or `tab`, and its effects must never raise the satisfied-exhibit count (★ safety test).
2. Engine helper (`src/engine/puzzle_engine.ts`): `satisfiedCount(puzzle, state)` returns the number of exhibits whose status is VERIFIED.
3. Scoring changes in `scoreElementOnPage`:
   - **Aliases:** +40 for the first distinct alias phrase that occurs, then +15 for each further distinct alias, capped at +70 in total. If one matched alias contains another, count only the longer one.
   - **Position words:** +20 for each matched word in {left, right, top, bottom, middle/center}, capped at +40. The contradiction rule is unchanged.
   - **Rows and columns:** recognise ordinals `first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last` before `row`/`column`/`col`, and `row N`/`column N` for N = 1–9.
     - `top row` = row 1; `bottom row` and `last row` = the largest `visual.row` on the page; `last column` = the largest `visual.column`.
     - A matching `visual.row` gives +20, and a matching `visual.column` gives another +20.
     - Delete the train words from the row regex (`:172-173`); they live in the seat aliases.
   - **Role words:** `banner|ad|advert|campaign` → role `banner`; `tab` → role `tab`; `link` → role `link`. Delete the `promo_insurance` key special case (`:224`) and give `promo_insurance` role `'banner'`.
   - Unchanged: colour +30, glyph +35, number +25, input/canvas role words +15, TYPE intent +30, DRAW intent +30.
4. `fallbackResolve` decision rules, applied in this order:
   1. **Guardrails** (meta-prompt or mark ID, already in `resolveLine`) now return the **distraction** (rule 5) instead of NOOP.
   2. **Bare words.** This rule applies only when all three conditions hold:
      - the instruction contains none of these verbs: `click, press, tap, hit, push, select, choose, pick, open, go, type, enter, write, input, fill, put, draw, sign, scribble, doodle, sketch, paint, wait, check, tick, uncheck, use`;
      - no non-input element scores ≥ 30;
      - the page has an input whose `setFromText` field is `''`.

      Then TYPE into the first such input in reading order. The text is the instruction uppercased, keeping only A–Z and spaces, collapsed and trimmed, max 16 characters. If that text is empty, go to rule 5.
      Thought: `💭 You didn't say what to do with "{TEXT}", so I typed it into the first empty box I saw.`
   3. **Score** every element except `page_title`. If the top score is below 30, go to rule 5.
   4. **Ties.** The candidates are the elements with the top score. The winner is the first in reading order (box center y, then x).
      - With more than one candidate, the thought is: `💭 I found {n} that fit, so I took the first one — reading left to right, top to bottom, like a professional.`
      - The action rules are unchanged: TYPE for inputs, DRAW for canvases, TIMED_CLICK with `timedColumn` plus a timing word, otherwise CLICK.
   5. **Distraction.** CLICK the page's `distractionKey`, with a thought for the reason:
      - No clue: `💭 No idea what "{first 24 chars of the instruction}" means, but this flashy thing looked important, so I clicked it.`
      - Meta-prompt: `💭 "Win"? I can't find a win button. I clicked the shiniest thing instead.`
      - Mark ID: `💭 I don't see numbers like that on the page, so I clicked the shiniest thing instead.`

      If the page has no `distractionKey` (MV-07, the cancel modal), return today's NOOP with its no-signal thought.
5. Case #001 data (until items 3–6 add real banners):
   - Give `nav_news` role `'link'`.
   - Set `distractionKey: 'nav_news'` on MV-01, MV-02, MV-03, MV-04, MV-05, MV-08, MV-10, MV-11 and MV-12.
   - On MV-08, `nav_news` navigates to the page it's already on, which is a no-op.
6. Add `'orange': ['orange', 'daidai', 'だいだい', 'オレンジ', '橙']` to `COLOR_DICTIONARY` (`src/engine/agent/dictionaries.ts`).

**Validation** (new `test/intern.test.ts`, plus updates)
- ★ Ties: in the `mini` fixture, two buttons both match "blue" → the first in reading order wins, and the thought contains `I found 2`.
- ★ Precision: an element with aliases `['romaji', 'surname']` beats one with `['surname']` for `type x in the romaji surname box`.
- ★ Position: `bottom right` gives +40 to an element in the bottom-right corner and only +20 to one that is just at the bottom.
- ★ Ordinals: `fourth row` picks `visual.row = 4` in a fixture with five rows.
- ★ Bare words: on MV-02, `tanaka` → TYPE `TANAKA` into `passenger_name`. Fails today with NOOP.
- ★ No clue: on MV-01, `asdf qwerty` → CLICK `nav_news`, and the page becomes MV-08. Fails today with NOOP.
- ★ Meta-prompt: `win the game` on MV-04 → CLICK of the distraction, and `finalConfirmed` stays false.
- ★ Safety: for every page with a `distractionKey`, take every state reachable in ≤ 3 registry actions from the initial state. Applying the distraction CLICK there never raises `satisfiedCount`.
- `test/exploits.test.ts` stays green. Where it asserted `NOOP` (`:250`, `:275`), assert "the distraction was clicked and `satisfiedCount` didn't rise".
- The five answer-key lines still score 100 % with pinning off.

**Blast radius**
- `src/engine/agent/fallback.ts`, `src/engine/agent/index.ts`, `src/types/puzzle_data.ts`, `src/engine/puzzle_engine.ts`, `src/engine/agent/dictionaries.ts`, `src/data/puzzles/case_001/puzzle.ts`.
- Tests: `test/exploits.test.ts`, `test/offline_agent.test.ts`, `test/player_cujs.test.tsx`.
- Brief: rewrite Decision Log row 12 to describe the literal intern (ties → first in reading order; no clue → clicks the eye-catching banner; verbless words get typed into the first empty box).

---

## §4 Item 2 — The drawing must match the replay (F-22; D-13)

**What this means for the user.** "Draw a dragon" passes today because any drawing counts, and the replay itself draws a generic squiggle. The replay should draw something specific; drawing anything else fails, preferably hilariously.

**The gap**
- Exhibit D: `verified: { field: 'signatureStroke', nonEmpty: true }` (`src/data/puzzles/case_001/puzzle.ts:585`).
- Replay step 4: `stroke: 'SHAPE:signature'` (`:611`).
- Unknown nouns fall back to `DEFAULT_SQUIGGLE_SPEC` (`src/utils/text_normalizer.ts:497-500`, `:607`).

**Implementation**
1. In `extractSignatureDrawingSpec`, keep the existing shape checks and quoted-text check first. Then:
   1. Find a drawing verb `draw|sketch|doodle|paint`.
   2. After it, skip these words: `a, an, the, some, my, me, us, one, two, three, big, small, little, tiny, huge, cute, funny, scary, nice, quick, simple`.
   3. Take the next word (letters only, lowercased, max 16 characters).
   4. If that word is one of `signature, sign, line, something, anything, it, this, that, here, there, box, pad, in, on`, or there is no word, return the default squiggle (`SHAPE:signature`).
   5. Otherwise return:
      ```ts
      {
        strokeValue: `ATTEMPT:${word}`,
        displayLabel: `${word} (attempt)`,
        thought: `💭 I can't draw a ${word}. Here's a very long worm with ambition.`,
        svgPaths: [
          'M 30 38 C 55 18, 75 56, 100 36 S 145 18, 170 38 S 205 54, 222 34',
          'M 216 34 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
        ],
      }
      ```
   `sign it`, `sign here` and `scribble` keep producing `SHAPE:signature`.
2. `resolveSignatureDrawingSpec('ATTEMPT:<word>')` returns the same spec, so a reloaded game renders the worm.
3. Case #001 data:
   - Replay step 4: `stroke: 'SHAPE:cat'`.
   - Exhibit D: title `Signature: 🐱 Cat`; criteria `Signed the pad with the same drawing as the replay (a cat).`; `verified: { field: 'signatureStroke', eq: 'SHAPE:cat' }`.
   - `answerKey[3]`: `Draw a cat in the dashed box`.
   - `capturePresets['MV-05'].signatureStroke`: `'SHAPE:cat'`.

**Validation**
- ★ `draw a dragon` on MV-04 → stroke `ATTEMPT:dragon`, and Exhibit D is MISSED. Fails today: `SHAPE:signature`, VERIFIED.
- ★ `sign it` → `SHAPE:signature` → D MISSED.
- `draw a cat`, `draw a kitty` and `draw me a cute kitten` → `SHAPE:cat` → D VERIFIED.
- `draw "Bob"` → `TEXT:Bob` → D MISSED.
- `test/replay.test.ts`: the replay still yields 100 %, and the answer key (pinning off) still yields 100 %.
- Manual: in `npm run dev`, the replay visibly draws a cat at both compact and expanded sizes.

**Blast radius**
- `src/utils/text_normalizer.ts`, `src/data/puzzles/case_001/puzzle.ts`.
- Tests: `test/replay.test.ts`, `test/exploits.test.ts`, and any test asserting that `SHAPE:signature` verifies D.
- Brief: Analysis §5 and Decision Log rows 9 and 13 say the drawing must match the replay's drawing, and unknown subjects come out as a "worm with ambition".

---

## §5 Item 3 — Page 01: a realistic portal homepage (F-21, F-24; D-8)

**What this means for the user.** "Click green" or "the blue card" should land on the portal's real-looking clutter — a campaign banner, the other lines in their own colours — not automatically on the right route.

**Realism notes.**
- Rail portals colour each Shinkansen line by its livery.
- They put a campaign carousel above the fold.
- They show a row of service tabs.
- Every route leaves from Tokyo.

**The gap.** The target card is the only green thing on the page (`puzzle.ts:70-73`), and its aliases include position words like `top left` and `green box`.

**Implementation (MV-01)**
1. Add these elements:

| Mark | `key` | Role | Label (as rendered) | Visual | Effects | Aliases | Thought |
|---|---|---|---|---|---|---|---|
| 5 | `tab_shinkansen` | tab | `新幹線・特急` | current tab: underlined | none | shinkansen, bullet train, first tab | `💭 Clicked the Shinkansen tab. We were already on it. Very productive.` |
| 6 | `tab_local` | tab | `在来線` | — | none | local, local trains, second tab | `💭 Clicked a tab. Nothing changed. I'm calling that a success.` |
| 7 | `tab_hotel` | tab | `ホテル・宿泊` | — | none | hotel, hotels, third tab | `💭 Looked at hotels. We still don't have a train.` |
| 8 | `tab_rental` | tab | `レンタカー` | — | none | car, rental, rent a car, fourth tab | `💭 Considered renting a car instead. Tempting.` |
| 9 | `campaign_banner` | banner | `【期間限定】新幹線 早割28 キャンペーン実施中！ ▶` | color `green` (`#2E9E4F`, white text), glyphs `['▶']` | CLICK → navigate MV-08 | campaign, early bird, discount, banner | `💭 A big green banner said 期間限定! That means important, right?` |

2. Recolour, relabel and reorder the route cards. Keep the marks and keys. Reading order:
   - top-left `route_hokuriku`, label `路線 01 • 北陸・上越新幹線`, colour `blue` (sky blue `#3FA9F5` with a copper `#B87333` stripe);
   - top-right `route_tokaido`, label `路線 02 • 東海道・山陽新幹線`, colour `blue` (`#1E50A2` stripe on white);
   - bottom-left `route_tohoku`, label `路線 03 • 東北・北海道新幹線`, colour `green` (`#00A040`);
   - bottom-right `route_points`, label `メニュー 04 • かんじおんポイント・ICカード連携`, colour `orange` (`#F08300`).

   Each card keeps its current sub-lines and effects.
3. Card aliases, exactly (positions come from the boxes, so remove `top left`, `top-left`, `green card` and `green box`):

   | Card | Aliases |
   |---|---|
   | `route_hokuriku` | hokuriku, kanazawa, nagano, niigata, tokyo, light blue, sky blue, card 1, route 1, first card |
   | `route_tokaido` | tokaido, osaka, shin-osaka, tokyo, dark blue, navy, card 2, route 2, second card |
   | `route_tohoku` | tohoku, sendai, aomori, hokkaido, tokyo, card 3, route 3, third card |
   | `route_points` | points, ic card, card 4, menu 4, fourth card |

4. Layout, top to bottom: header; tabs row; campaign banner (full width, about 70 px tall); 2 × 2 card grid.
5. Set `distractionKey: 'campaign_banner'` on MV-01.
6. `answerKey[0]`: `Click the blue card on the right`.
7. Recapture, then validate (see §2).

**Validation** (new `test/difficulty.test.ts`, page 01 block)
- ★ None of these lazy prompts reproduce replay step 1 (`CLICK route_tokaido`). Each lands where stated:

  | Prompt | Lands on |
  |---|---|
  | `green` | `campaign_banner` → MV-08 |
  | `blue` | `route_hokuriku` |
  | `tokyo` | `route_hokuriku` |
  | `the card` | `campaign_banner` (distraction: a role word alone scores 15, under 30) |
  | `top right` | a header element |
  | `first one` | `campaign_banner` (distraction) |

  Today `green` and `tokyo` reproduce it.
- `Click the blue card on the right` and `click the dark blue card` reproduce step 1.
- The Latin-letters test at `test/ui_components.test.tsx:552` passes for MV-01.
- Manual: the page looks like a busy, real portal; the cards show the line colours.

**Blast radius**
- `src/data/puzzles/case_001/puzzle.ts`, `Sandbox.tsx`, `manifest.generated.json`, the SoM PNGs.
- `src/engine/agent/dictionaries.ts` (already done in item 1).
- Tests that select route cards by position or colour.
- Brief: a new Decision Log row "16 · Realistic clutter" describing D-8.

---

## §6 Item 4 — Page 02: the name-form maze (F-21; D-8)

**What this means for the user.** Japanese forms ask for your name three ways — kanji, katakana and romaji. "Type TANAKA in the name box" should land in the wrong box, exactly like on a real site.

**The gap.** One input on the page (`passenger_name`, `puzzle.ts:208`), so every name instruction lands in it.

**Implementation (MV-02)**
1. Replace the single field with a 3 × 2 grid. Reading order is row by row, left then right.

   | Mark | `key` | Label | Row/col | TYPE effects | Aliases | Placeholder |
   |---|---|---|---|---|---|---|
   | 31 | `name_kanji_sei` | `姓（漢字）` | 1/1 | setFromText `nameKanjiSei` | kanji, surname, family name, last name | `例）山田` |
   | 32 | `name_kanji_mei` | `名（漢字）` | 1/2 | setFromText `nameKanjiMei` | kanji, first name, given name | `例）太郎` |
   | 33 | `name_kana_sei` | `セイ（カナ）` | 2/1 | setFromText `nameKanaSei` | katakana, kana, surname, family name, last name | `例）ヤマダ` |
   | 34 | `name_kana_mei` | `メイ（カナ）` | 2/2 | setFromText `nameKanaMei` | katakana, kana, first name, given name | `例）タロウ` |
   | 17 | `passenger_name` | `姓（ローマ字）` | 3/1 | setFromText `passengerName`; navigate MV-03 | romaji, roman, english letters, alphabet, surname, family name, last name | `半角英字` |
   | 35 | `name_romaji_mei` | `名（ローマ字）` | 3/2 | setFromText `givenNameRomaji` | romaji, roman, english letters, alphabet, first name, given name | `半角英字` |

   All six have role `input`. Only `passenger_name` auto-advances (as today).
2. Add these decoys:

   | Mark | `key` | Role | Label | Visual | Effects | Aliases | Thought |
   |---|---|---|---|---|---|---|---|
   | 36 | `phone` | input (row 4, col 1) | `電話番号（ハイフンなし）` | placeholder `例）09012345678` | TYPE → setFromText `phone` | phone, telephone, number | `💭 Typed it into the phone box. Someone is getting a very confusing call.` |
   | 37 | `reuse_info` | checkbox | `前回の入力内容を使用する` | — | CLICK → toggle `reuseInfo` | reuse, previous, last time | `💭 Ticked "reuse previous info". There is no previous info. Bold of me.` |
   | 38 | `member_banner` | banner | `会員登録で次回から入力不要！ ▶` | color `orange` | CLICK → navigate MV-08 | member, membership, register, sign up, banner | `💭 A banner promised I'd never type my name again. I believed it.` |

3. Validation hints appear under a field only when its value is non-empty and invalid. They are display only, with no state change.
   - Kanji fields containing `[A-Za-z]` show `全角で入力してください`.
   - Kana fields not matching `/^[ァ-ヶー　 ]+$/` show `全角カタカナで入力してください`.
4. Add to `initialFields`: `nameKanjiSei: ''`, `nameKanjiMei: ''`, `nameKanaSei: ''`, `nameKanaMei: ''`, `givenNameRomaji: ''`, `phone: ''`, `reuseInfo: false`. The MV-02 `back` button also resets these fields.
5. Set `distractionKey: 'member_banner'` on MV-02.
6. Exhibit B criteria: `Typed TANAKA into the romaji family-name box (third row, left) on page 02.` The predicate is unchanged.
7. `answerKey[1]`: `Type TANAKA in the romaji box on the left`.
8. Recapture, then validate.

**Validation** (`test/difficulty.test.ts`, page 02 block)
- ★ None of these reproduce replay step 2 (TYPE `TANAKA` into `passenger_name`):

  | Prompt | Result |
  |---|---|
  | `tanaka` | bare word → TYPE `TANAKA` into `name_kanji_sei` |
  | `name tanaka` | bare word → `NAME TANAKA` into `name_kanji_sei` |
  | `type tanaka` | seven-way tie → `name_kanji_sei` |
  | `type tanaka in the name box` | → `name_kanji_sei` |
  | `surname tanaka` | bare word → `name_kanji_sei` |

  Today `name tanaka` and `type tanaka` reproduce it.
- `Type TANAKA in the romaji box on the left` reproduces step 2 and moves to MV-03.
- TYPE `TANAKA` into `name_kanji_sei` shows `全角で入力してください` and stays on MV-02.
- Manual: the form looks like a real Japanese form, with three name rows and the hints.

**Blast radius**
- `puzzle.ts`, `Sandbox.tsx`, the manifest and PNGs.
- Tests that type into `passenger_name` by vague description: `test/player_cujs.test.tsx`, `test/e2e_gameplay.test.tsx`, `e2e/smoke.e2e.ts` (use answer-key wording).

---

## §7 Item 5 — Page 03: timetable overload (F-21; D-8)

**What this means for the user.** Real timetables list train after train with the same prices. "Click the green button" should pick the first of several green buttons.

**The gap.** Two trains; the only green button is the target (`puzzle.ts:310-313`). "sale" alone reproduces the timed click.

**Implementation (MV-03)**
1. Replace the 2-train table with five trains, in this row order. A `× 満席` cell is rendered text, not an element.

   | Row | Train (`trainName`) | Times | 自由席 · col 1 | 指定席 · col 2 | グリーン車 · col 3 |
   |---|---|---|---|---|---|
   | 1 | `こだま 723号` (`Kodama 723`) | `14:03発 ⇒ 17:57着` | 41 `◯ ¥13,870` | 42 `◯ ¥14,400` | 43 `◯ ¥18,170` |
   | 2 | `ひかり 515号` (`Hikari 515`) | `14:12発 ⇒ 17:10着` | 44 `◯ ¥13,870` | 45 `△ ¥14,520` | `× 満席` |
   | 3 | `のぞみ 22号` (`Nozomi 22`) | `14:21発 ⇒ 16:48着` | 47 `◯ ¥13,870` | 48 `◯ ¥14,720` | 49 `◯ ¥19,590` |
   | 4 | `のぞみ 24号` (`Nozomi 24`) | `14:30発 ⇒ 16:57着` | 50 `◯ ¥13,870` | 51 `◯ ¥14,720` | 52 `🍀 ◯ ¥13,870 (特割)` |
   | 5 | `のぞみ 26号` (`Nozomi 26`) | `14:39発 ⇒ 17:06着` | 53 `◯ ¥13,870` | `× 満席` | 55 `◯ ¥19,590` |

2. Keys are `seat_r{row}_free`, `seat_r{row}_reserved` and `seat_r{row}_green`. The target is `seat_r4_green` (mark 52). Delete `seat_hikari_free`, `seat_hikari_reserved`, `seat_nozomi_free`, `seat_nozomi_reserved` and `seat_nozomi_green`.
3. Visuals:

   | Seat class | `visual` |
   |---|---|
   | Free | `{ color: 'white', glyphs: ['◯'], row, column: 1 }` |
   | Reserved | `{ color: 'white', glyphs: ['◯' or '△'], row, column: 2 }` |
   | Green | `{ color: 'green', glyphs: ['◯'], row, column: 3 }` |
   | `seat_r4_green` | adds `'🍀'` to its glyphs and `timedColumn: 2` |

4. Aliases are the row words plus the class words.
   - Row words:

     | Row | Words |
     |---|---|
     | 1 | kodama, 723, 14:03 |
     | 2 | hikari, 515, 14:12 |
     | 3 | nozomi, nozomi 22, 22, 14:21 |
     | 4 | nozomi, nozomi 24, 24, 14:30 |
     | 5 | nozomi, nozomi 26, 26, 14:39 |

   - Class words: free → `free seat, unreserved, non reserved`; reserved → `reserved, reserved seat`; green → `green car, first class`.
   - `seat_r4_green` also gets `clover, leaf`.
   - Remove `sale`, `discount` and `special` from every alias list.
5. Effects. Every seat CLICK sets `trainName`, `seatClass` (`ordinary_free` | `ordinary_reserved` | `green_car`), `fare` (the label price) and `greenCarSelected` (true only for green), sets `timedWindowHit: false`, and navigates to MV-04. Choosing a seat moves on, as on a real site.
   - `seat_r4_green` CLICK → `fare 19590`.
   - `seat_r4_green` TIMED_CLICK → `fare 13870`, `timedWindowHit: true`.
   - The flash bar and the price flip on mark 52 stay as they are today.
6. Add mark 56, `upgrade_banner`:
   - role banner;
   - label `グリーン車 アップグレードキャンペーン実施中 ▶`;
   - color `green`, glyphs `['▶']`;
   - CLICK → navigate MV-08;
   - aliases `upgrade, campaign, banner`;
   - thought `💭 Green banner, green car — close enough. Clicked it.`

   Place it above the table and set `distractionKey: 'upgrade_banner'`.
7. Replay step 3 uses key `seat_r4_green`. `answerKey[2]`: `Wait for the glow, then click the clover`.
8. Recapture, then validate.

**Validation** (`test/difficulty.test.ts`, page 03 block)
- ★ None of these reproduce replay step 3 (TIMED_CLICK `seat_r4_green`):

  | Prompt | Result |
  |---|---|
  | `green` | `upgrade_banner` → MV-08 |
  | `the green button` | `upgrade_banner` |
  | `13870` | `upgrade_banner` (distraction: a number alone scores 25, under 30) |
  | `clover` | CLICK `seat_r4_green` → `fare 19590` |
  | `nozomi green` | `seat_r3_green` |
  | `sale` | distraction |

  Today `sale` and `wait then green` reproduce it.
- `Wait for the glow, then click the clover` and `wait for the glow, then click the green seat in the fourth row` reproduce step 3.
- `test/solvability.test.ts` still finds a minimum of 5.

**Blast radius**
- `puzzle.ts`, `Sandbox.tsx`, the manifest and PNGs.
- `test/replay.test.ts`, `test/solvability.test.ts`, and tests using the old seat keys.
- `src/engine/flash_clock.ts` only if the mark-25 assumption is hard-coded (search for `25` and `seat_nozomi_green`).

---

## §8 Item 6 — Page 04: 確認 vs 確定 (F-21; D-8)

**What this means for the user.** Japanese checkout pages put a 確認 ("review") button next to a 確定 ("finalize") button, both blue, and both translate as "confirm". "Click confirm" should pick the wrong one.

**The gap.** One blue button on the page (`puzzle.ts:399-402`); `blue` and `confirm` both reproduce the final step.

**Implementation (MV-04)**
1. Bottom bar, left to right:
   1. `insurance_checkbox` (28)
   2. `cancel_booking` (29)
   3. `save_for_later` (60)
   4. `review_booking` (61)
   5. `confirm_booking` (30)

   Group `save_for_later`, `review_booking` and `confirm_booking` at the right end of the bar, as real checkouts do, so both blue buttons have a center x > 683.
2. Element changes and additions:

   | Mark | `key` | Role | Label | Visual | Effects | Aliases | Thought |
   |---|---|---|---|---|---|---|---|
   | 30 | `confirm_booking` | button | `予約を確定する ▶` (changed) | color `blue`, glyphs `['▶']` | unchanged | confirm, finalize, finalise, book, purchase, complete, final, 確定 | `💭 Finalized! Booked! Probably!` |
   | 60 | `save_for_later` | button | `一時保存` | color `grey` | none | save, later, save for later, keep | `💭 Saved it for later. Later never comes.` |
   | 61 | `review_booking` | button | `入力内容を確認する` | color `blue` | none | confirm, check, review, verify, 確認 | `💭 Reviewed everything. Still Japanese. Still not booked.` |
   | 62 | `change_details` | link | `内容を変更する` (in the summary card) | — | CLICK → navigate MV-02 | change, edit, modify, change details | `💭 Changing the details! Which details? All of them, apparently.` |
   | 63 | `terms_link` | link | `利用規約` (under the pad) | — | none | terms, rules, conditions, small print | `💭 Read the terms. All 48 pages. Agreed to nothing.` |
   | 64 | `eticket_banner` | banner | `eチケットなら さらに¥200おトク！ ▶` (above the summary) | color `orange`, glyphs `['▶']` | CLICK → navigate MV-08 | eticket, e-ticket, deal, banner | `💭 ¥200 off! I had to look.` |

3. Set `distractionKey: 'eticket_banner'` on MV-04.
4. Exhibit E criteria: `Clicked 予約を確定する ▶ (finalize — not 確認, review) with no add-ons attached.` The title and predicates are unchanged.
5. `answerKey[4]`: `Click the blue button with the arrow`.
6. Recapture, then validate.

**Validation** (`test/difficulty.test.ts`, page 04 block)
- ★ None of these reproduce replay step 5 (CLICK `confirm_booking`). Today `blue` and `confirm` reproduce it.

  | Prompt | Lands on |
  |---|---|
  | `blue` | `review_booking` |
  | `confirm` | `review_booking` |
  | `click the blue button` | `review_booking` |
  | `bottom right` | `review_booking` |
  | `next` | `eticket_banner` (distraction) → MV-08 |

- `Click the blue button with the arrow` and `click the finalize button` reproduce step 5.
- `test/exploits.test.ts`: gibberish and meta-prompts on MV-04 never set `finalConfirmed`.
- Manual: two similar blue buttons sit side by side and the page reads like a real checkout.

**Blast radius**
- `puzzle.ts`, `Sandbox.tsx`, the manifest and PNGs, `GLYPH_DICTIONARY['▶']` (its `確定へ` token becomes `確定`).
- Tests that click "confirm" or "blue".
- Brief: Analysis §1 (Page 04) and Decision Log row 16 mention 確認 vs 確定.

---

## §9 Item 7 — Cloud tier follows the same rules (F-25; D-10)

**What this means for the user.** When the free cloud model is switched on, it must behave like the same intern, or players get different results depending on which tier answered.

**The gap**
- The prompt asks for a single mark and says CONFUSED when the instruction "does not point to one mark" (`src/engine/agent/cloud_tier.ts:14-25`).
- CONFUSED maps to NOOP (`:271`).
- The schema has one `mark` (`:431-450`).

**Implementation**
1. In `resolveLine`, run the item-1 **guardrails** and **bare-word** rule *before* the cloud tier. Both are deterministic, so every player gets the same result.
2. Schema: replace `mark` with required `candidates` (an array of integers, possibly empty). Keep `action`, `text` and `thought`.
3. System instruction: replace rules 1 and 5, and add rule 7, exactly:
   ```
   1. List in "candidates" every mark that fits the instruction equally well. If two buttons both fit "the blue button", list both. Never invent marks.
   5. Answer CONFUSED with an empty "candidates" list if nothing on screen fits, if the instruction refers to mark numbers or IDs, or if it asks you to win, solve, finish the game or copy a replay.
   7. Take every word literally. Do not guess what the player meant; match what they said.
   ```
   Also add each mark's `visual.row`/`visual.column` (when set) to the marks JSON as `row`/`column`.
4. App-side selection:
   - Drop candidates that aren't on the current page or don't allow the action.
   - The winner is the first remaining candidate in reading order (manifest box centers).
   - If more than one candidate remains, use item 1's tie thought (with `{n}`) instead of the model's thought.
   - If none remain, or the action is CONFUSED → the **distraction**, with the no-clue thought.
   - TYPE and DRAW validation is unchanged.
5. The pinned tier is unchanged.

**Validation** (fake `CloudModel`, no network)
- ★ `candidates: [52, 43]` on MV-03 → picks 43 (`seat_r1_green`, first in reading order), and the thought contains `I found 2`.
- ★ `candidates: []` → distraction. CONFUSED → distraction. Today both give NOOP.
- Candidates not on the page are dropped; if that leaves none → distraction.
- A verbless `tanaka` on MV-02 never calls the model (the bare-word rule answers first).
- Goal blindness: the serialized request for every page still contains none of `TANAKA` (empty name), `exhibit`, `answer`, `replay`, `decoy`, `trap`, `target`, `weight`, `pinned`, `distraction`.

**Blast radius**
- `src/engine/agent/cloud_tier.ts`, `src/engine/agent/index.ts`.
- `test/cloud_connector.test.ts`.
- Brief: Decision Log row 15 says the model lists candidates and the app applies the reading-order rule.

---

## §10 Item 8 — Show the struggle (F-26; D-14)

**What this means for the user.** NYT games are fun to share because the grid shows the struggle. Today's share card and report only show the outcome.

**The gap**
- The share text has exhibit emojis only (`src/engine/scoring.ts:175-179`).
- The report shows stamps, but not what went wrong.
- Lines have no recorded outcome.

**Implementation**
1. **Line outcomes.** When a line is applied, compute `before = satisfiedCount(state)` and `after = satisfiedCount(next)`, then store `TelegramLine.outcome`, using the first rule that matches:
   1. `🎯` if `after > before`;
   2. `💥` if `after < before`;
   3. `🔙` if the page changed;
   4. `🤡` if any field changed;
   5. `💤` otherwise.

   Render outcomes **only after the case is closed**, because they would leak exhibit progress during play.
2. **Share text**, exact (four lines):
   ```
   KANJION #001 🇯🇵 — {closeness}% × {multiplier, 1 decimal}x = {final} PTS
   {one outcome emoji per dispatched line, no spaces}
   {one 🟩/🟥/⬜ per exhibit, A to E}
   https://kanjion-game.web.app
   ```
   The report's preview shows lines 1–3.
3. **You vs Replay.** Add `ExhibitDef.compare?: Array<{ field: string; format?: 'yen' | 'stroke' | 'bool'; values?: Record<string, string> }>`.
   - Under every exhibit that isn't VERIFIED, render `You: {values} · Replay: {values}`.
   - Player values come from the final state; replay values come from applying `puzzle.replay` to `initialFields`.
   - Parts are joined with ` · `.
   - `format: 'yen'` → `¥13,870`; `'stroke'` → the stroke's `displayLabel`, or `not signed` when empty; `'bool'` → `values.true` / `values.false`.

   Case #001:

   | Exhibit | `compare` |
   |---|---|
   | A | `selectedRoute` with values `tokyo_osaka → Tokaido`, `tohoku → Tohoku`, `hokuriku → Hokuriku`, `none → no route` |
   | B | `passengerName` (empty → `(blank)`) |
   | C | `trainName`; `seatClass` with values `ordinary_free → free seat`, `ordinary_reserved → reserved`, `green_car → green car`, `none → no seat`; `fare` as yen |
   | D | `signatureStroke` as stroke |
   | E | `finalConfirmed` as bool (`confirmed` / `not confirmed`); `confirmedWithInsurance` as bool (`+ ¥2,400 insurance` / `no add-ons`) |

4. **Best blunder.** If any line's outcome is `🤡`, `🔙` or `💥`, the report shows the first such line as `Best blunder — LINE {nn}: "{line text}" → {thought}`.
5. Port every scenario in `scripts/difficulty_probe.mts` into `test/difficulty.test.ts`, then delete the script.

**Validation**
- ★ Unit test: the answer-key run produces outcomes `🎯🎯🎯🎯🎯`.
- ★ A run of `green` → `Click the blue card on the right` → … produces a first outcome of `🔙` (campaign page).
- ★ The clipboard text for a 5-line perfect run equals exactly `KANJION #001 🇯🇵 — 100% × 1.2x = 120 PTS\n🎯🎯🎯🎯🎯\n🟩🟩🟩🟩🟩\nhttps://kanjion-game.web.app`. Fails today.
- ★ During play, no outcome emoji appears anywhere in the DOM. After closing, they do.
- The `You vs Replay` line for D after `draw a dragon` reads `You: dragon (attempt) · Replay: cat`.
- E2E: dispatch `green` (detour to MV-08), `click back` (back to MV-01) and `Click the blue card on the right`, then close the case. Line 2 of the clipboard text equals `🔙🔙🎯`.

**Blast radius**
- `src/engine/scoring.ts`, `src/components/ExhibitsPanel.tsx`, `src/engine/game_reducer.ts` (outcome per line), `src/types/game.ts`, `src/types/puzzle_data.ts`, `puzzle.ts`.
- `test/exhibits_scoring.test.ts`, `test/ui_components.test.tsx`, `e2e/smoke.e2e.ts`.
- Brief: a new Decision Log row "17 · Show the struggle" describing D-14.

---

## Deferred — do not start

| ID | Item | Trigger |
|---|---|---|
| DEF-1 | Shared pre-warmed decision cache: run likely phrasings through the cloud tier at authoring time and ship the results as static JSON beside the puzzle. | More than 10 % of a day's lines show `(backup agent)` on 2 days in one week, or the owner plans a public launch push. |
| DEF-2 | Gemini Nano only for the "Model Thought" wording, never the action. | The owner asks. |
| DEF-3 | Authoring pipeline for Case #002 and later (a way to build realistic sandbox sites quickly). | The owner starts writing Case #002. |
| DEF-4 | Usage analytics (fallback rate, popular phrasings). | The owner asks; it needs a privacy note. |
| DEF-5 | Difficulty week: an easy English Monday through a brutal dense Saturday (D-12). | DEF-3 exists and at least 7 cases are authored. |

## Already delivered — do not rework

Previous build items 1–13 (commits `5efae7f`…`12e912e`):
- The shipped-game test harness (`GameConfig`, Playwright).
- Case #001 naming and the share URL.
- The official-result lock, practice mode and persistence.
- Literal TYPE text (`extractTypedText`).
- Japanese-only sandbox copy and the fictional brand.
- The data-driven puzzle engine (`PuzzleData`, `applyDecision`, `data-el` cursor targets).
- Real flash-sale timing and Exhibit E add-on contamination.
- The replay played from data.
- The Playwright SoM capture pipeline and self-hosted font.
- The agent pipeline (guardrails → pinned → cloud → fallback).
- The Firebase AI Logic free cloud tier with App Check.
- The daily schedule and phone zoom.

Also delivered: the newspaper UI, the dispatch pad, the scoring formulas, the stamp visuals, the drawing shapes and the fixed 1024 × 768 stage.

## Accepted equivalents — do not "fix" back

- The replay is an always-on looping panel; it renders live DOM, and paste-blocking the input is the anti-copy measure.
- Signatures are SVG path presets, not freehand strokes.
- TYPE into `passenger_name` advances to page 03 without a separate "Next" button. The other name fields don't advance.
- MV-07 is drawn as a modal over a dimmed MV-04.
- Choosing any seat on page 03 advances to page 04 (item 5). A wrong seat is undone with `back`.

## Intentional decisions / invariants — do not change

- The model must be free (owner-locked).
- No replay feints (D-9). No artificial penalties; natural effects only (D-11).
- Realistic clutter only — nothing a real booking site wouldn't show (D-8).
- The literal-intern rules of item 1, which define fairness (D-10, S13).
- No COL A–D / ROW 1–4 rulers, no debug chrome, no difficulty toggles. The click lock and paste block stay silent.
- 6 lines × 60 characters; Line 01 start; the multiplier formula; weights A 25 · B 20 · C 20 · D 15 · E 20; positive exhibit titles.
- Kinematics as listed in S6.
- The answer key appears when the official score is under 100 %. Outbound "Inspired by eki-net.com" links stay.
- No accounts and no server-side database for session state.

## Where the contracts live

- Product intent: `concepts_brief.md`. Decisions and findings: `ongoing_general_errors.md`.
- Puzzle data contract: `src/types/puzzle_data.ts`.
- Agent tiers and intern rules: `src/engine/agent/` (`index.ts`, `fallback.ts`, `cloud_tier.ts`, `guardrails.ts`).
- Engine: `src/engine/puzzle_engine.ts`. Scoring math: `src/engine/scoring.ts`.
- Case #001: `src/data/puzzles/case_001/` (`puzzle.ts`, `Sandbox.tsx`, `manifest.generated.json`).
- Capture tool: `tools/compile_puzzle.ts`.

---

## THE LOOP (repeat for each item)

1. Re-read the item and its F- and D-entries. Confirm the D-selection it depends on.
2. Write the ★ tests first. Run them and confirm they fail for the stated reason.
3. Implement the steps in order, staying inside the item's scope.
4. For page items 3–6, recapture with `npx tsx tools/compile_puzzle.ts --case 001`, then run `--validate`.
5. Run the battery: `npm test`, `npm run build`, `npm run test:e2e`, plus the item's own commands. Also run `npx tsx scripts/difficulty_probe.mts` until item 8 deletes it; its match count should only go down.
6. Do the item's manual check in `npm run dev`.
7. Update the blast-radius files, including the brief's Decision Log wherever behavior changed.
8. In `ongoing_general_errors.md`, move the item's F-entries to **Resolved**, each with one line: `F-n — resolved by item N (<short note>)`.
9. Commit with subject `feat(kanjion): item N — <item title>`. The body says what changed, why (F/D ids), which tests were deleted and why, and any deviation.
10. Update §1's numbers in the same commit.

## Definition of Done

- [x] Items 1–8 are committed, each with its ★ tests passing.
- [x] `npm test`, `npm run build` and `npm run test:e2e` are green; the main JS is ≤ 120 kB gzip.
- [x] `test/difficulty.test.ts`, `test/intern.test.ts`, `test/exploits.test.ts`, `test/solvability.test.ts` and `test/replay.test.ts` are green. No lazy prompt from items 3–6 reproduces its replay step, and the five answer-key lines score 100 % with pinning off.
- [x] F-21 to F-26 are under Resolved. F-27 stays open for the owner (OA-5).
- [x] `concepts_brief.md` matches the shipped behavior.
- [x] §1 shows the final numbers, and the title says **Queue Complete**.
- [x] **Queue empty → stop. Don't invent work.** The only legitimate triggers for more work are a message from the owner, an answered Blocked entry, or a DEF-n trigger firing.
