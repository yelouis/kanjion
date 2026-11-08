# Kanjion (漢字音) — Daily AI Browser-Instruction Puzzle Game

* **Author:** yelouis
* **Date:** 2026-11-07 (Updated from initial *Instruct* brief on 2026-11-05)
* **Live Site:** https://kanjion-game.web.app
* **Repository:** https://github.com/yelouis/kanjion

## Overview

**Kanjion (漢字音)** (originally prototyped as *Instruct*) is a daily browser-based puzzle game built in TypeScript and React where players watch a continuous, looping **Target Replay** of a multi-page task performed on a sandboxed clone of a real foreign-language website (starting with **Case File #001**, based on the **JR Ekinet Shinkansen Reservation Portal**, https://www.eki-net.com/) and guide an AI agent to replicate the exact outcome using up to **6 short English instructions** (capped at 60 characters per line). Copy-paste and direct manual clicking on the agent's webpage are silently disabled, forcing players to observe the replay and describe visual layout, colors, icons, numerals, form fields, and timing cues in plain English.

The game opens with a **Krillion-inspired Folded Newspaper Front Cover** (*The Kanjion Daily Dispatch*) that unfolds into an open **Two-Page Newspaper Spread** above a centered **6-Line Dispatch Pad**:
* **Left Newspaper Page (`lg:col-span-8` primary focus)**: **Your Agent's Webpage**, where an animated field-agent cursor glides (`1.15s`), types character-by-character (`220ms/char`), and draws freeform shapes or signatures in real time before transitioning pages.
* **Right Newspaper Page (`lg:col-span-4` compact by default, click-to-expand to `lg:col-span-7`)**: **Target Replay (Copy This)**, an unredacted 1:1 looping demonstration showing only the mouse cursor and click/draw highlights across the multi-page workflow, with a single `⏸ Pause Replay / ▶ Start Replay` control and click-to-expand toggle.
* **Centered Bottom Command Dock (Outside the Newspaper Spread)**: The **6-Line Dispatch Pad** (starting at `LINE 01 / 06`, with a `62ch` monospace input box sized to fit 60 characters across its full width). Every dispatched line triggers an immediate action from the agent—even when the prompt is ambiguous—and records a slightly funny, human-understandable **`Model Thought:`** row showing how the eager AI assistant interpreted the command.

Crucially, the **5 target state checkpoints ("Required Exhibits" A–E) are positive actions to perform** (never framed as *"Avoid X"*) and remain **sealed** during active play. When the player clicks **"Close Case File"** (early submission for an unused-line efficiency multiplier) or finishes all 6 lines, the dossier unseals the Required Exhibits (`[VERIFIED ✓]`, `[CONTAMINATED ✗]`, `[MISSED ✗]`), reveals a **5-Step Solution Answer Key** if the player scored under 100%, and provides a direct link to visit the real website the puzzle is based on.

---

## Analysis & Core System Design

1. **Multi-Page, Multi-Modal Real-Site Gameplay (10-Page Portal Architecture)**:
   Clicking two items on a single static screen wasn't deep enough for a puzzle game. Each daily puzzle is modeled after a real website with a **10-page state graph** (`Macro-Views`) and requires diverse interaction modalities beyond simple pointing and clicking:
   * **Page 01 (`MV-01`) — Route Selection Portal**: Choosing the correct Shinkansen line card (`01 東海道新幹線 東京 → 新大阪`) among 4 regional routes; wrong routes lead to detour pages (`Pages 10–12`) that the player can recover from via the Back button.
   * **Page 02 (`MV-02`) — Passenger Name Entry (`TYPE`)**: Typing `"TANAKA"` (or any requested passenger name) into a required Roman-letter text field (`搭乗者名`), animated letter-by-letter on screen before advancing.
   * **Page 03 (`MV-03`) — Train & Seat Matrix + Timed Flash-Sale Window**: Selecting the `14:30 Nozomi 24` Green Car seat (`🍀 ¥13,870`) or timing a click on a cycling/moving flash-sale seat banner (`⚡ トクだ値 タイムセール枠`).
   * **Page 04 (`MV-04`) — Promptable Digital Signature Pad (`DRAW`) & Final Confirmation**: Drawing on a verification canvas (`#signature-canvas`) before clicking the bottom-right blue confirmation button (`予約内容を確認・確定へ ▶`). The sandbox does not artificially restrict the agent's drawing ability: players can ask the agent to draw a **smile / smiley face**, frown, heart, star, circle, triangle, square, cat, house, stick figure, fish, flower, checkmark, cross, zigzag, spiral, straight line, or custom cursive text.
   * **Page 05 (`MV-05`) — Issued e-Ticket**: Final confirmation screen with optional decoy upsells.

2. **100% Client-Side Zero-Quota AI Execution (`BrowserGeminiNanoTransport`)**:
   To eliminate server-side Gemini API bills, quota exhaustion, and rate-limit management while keeping the game 100% free and public, Kanjion runs entirely client-side in the player's browser:
   * Uses Chrome's built-in on-device **Gemini Nano Prompt API** (`window.LanguageModel` / `window.ai.languageModel`) when available in the player's browser, paired with a page-aware deterministic client-side semantic interpreter (`evaluateClientSideDecision`) so every browser works immediately with zero API keys, zero server cost, and static hosting on Firebase Hosting (`https://kanjion-game.web.app`).

3. **Always-Act Agent, Slowed Kinematics & Witty Model Thoughts**:
   * **Always Act on Ambiguous Commands**: When a player's instruction is imprecise or wrong, doing nothing (`CONFUSED`) feels broken. Instead, the agent always performs its best-guess visible action on the current screen so the player can laugh at—and recover from—how the AI interpreted their phrasing.
   * **Unhurried, Player-Controlled Kinematics**: Cursor glides take `1.15s`, typing animates at `220ms/character`, and signature drawing traces across the pad (`1.25s`) before any page navigation occurs, making the player feel in direct control of the agent.
   * **Slightly Funny, Human-Readable `Model Thought:`**: Each completed line shows a witty one-line thought from an eager AI agent (e.g., *"Big green Box 01 on the top-left! Tokyo to Shin-Osaka bullet train, coming right up."*) with zero internal `MV-01`/`MV-05` codes and no repetitive `Exhibit Status: REDACTED` text on each line.

4. **Decluttered Newspaper Spread & Compact/Expandable Replay**:
   * All developer/debug chrome was stripped: no `Backend SoM IDs`, no `Offline/Cloud` mode pills, no `COL A–D / ROW 1–4` outer coordinate ruler bars, no cursor `(x%, y%)` readouts, no `Easy / Medium / Hard` difficulty toggles, no `Step 1 / Step 2` breakdown buttons, no mouse text callouts in the replay, and no `[⚠️ TRAP DETECTED]` spoiler tags.
   * The **Left Page** (Agent's Webpage) takes `8/12` columns by default so focus stays on gameplay, while the **Right Page** (Target Replay) sits in a compact `4/12` column preview that expands to `7/12` columns when clicked.

5. **Positive Exhibits, Uncontaminated Signature Scoring & Post-Game Answer Key**:
   * All 5 Exhibits (`A` through `E`) represent positive milestones achieved (`Route: 東京 → 新大阪`, `Passenger Name: TANAKA`, `14:30 Nozomi • 🍀 ¥13,870`, `Sign Digital Authorization Pad`, `Final Blue Confirm`).
   * Exhibit D (`Sign Digital Authorization Pad`) evaluates strictly whether the authorization pad was signed (`[VERIFIED ✓ +15%]` vs `[MISSED ✗ +0%]`), never confusingly marking a valid signature as `[CONTAMINATED ✗]`.
   * If a player finishes all 6 lines (or closes the case file) with a score under 100%, the Forensic Audit Report displays a **5-Step Solution Answer Key** showing exact English prompts that achieve a 5-step `120 PTS` (`100% × 1.2x`) clear.

---

## Decision Log (Playtest & Iteration History)

The table below tracks all product, UX, gameplay, and engineering decisions made across our design and playtesting sessions:

| # | Area | Decision Made | Rationale / Playtest Finding |
| :- | :--- | :--- | :--- |
| **1** | **Brand & Identity** | Renamed from *Instruct* to **Kanjion (漢字音)** (`kanjion-game.web.app`, repo `yelouis/kanjion`) and renumbered **Case File #042 → Case File #001**. | Gives the game a memorable Japanese-puzzle identity starting cleanly at Case #001. |
| **2** | **Entry Experience** | Added a **Krillion-inspired Folded Newspaper Front Cover** (*The Kanjion Daily Dispatch*) that unfolds into the workspace, plus a minimal top-left `☰ MENU` button. | Establishes tactile newspaper immersion before dropping the player into the dual-screen puzzle. |
| **3** | **Spatial Layout** | Restricted the newspaper spread strictly to the **two screens** (Left Page = Agent's Webpage, Right Page = Target Replay) and moved the **6-Line Dispatch Pad** into a centered dock below the newspaper. | Prevents the newspaper pages from feeling cramped and separates observation (top) from command entry (bottom). |
| **4** | **Replay Sizing** | Made the Right Page **Target Replay** compact by default (`lg:col-span-4` vs `lg:col-span-8` for the Left Page) with **click-to-expand** (`lg:col-span-7`). | Keeps visual focus on the player's active webpage while allowing full-size inspection of the replay whenever needed. |
| **5** | **UI Decluttering** | Removed `Backend SoM IDs`, `Mode: Offline/Cloud`, `COL A–D / ROW 1–4` rulers, `(x%, y%)` cursor coordinates, `Easy/Medium/Hard` mode selectors, replay `Step 1 / Step 2` buttons, replay cursor text callouts, and `YOUR GOAL` hint banners. | Eliminated technical clutter and hand-holding so the puzzle relies purely on visual observation. |
| **6** | **1:1 Unredacted Replay** | Rendered the Target Replay as a **1:1 unredacted copy** of the site with only the animated cursor and click/draw glow, plus a single `⏸ Pause Replay / ▶ Start Replay` button. | Redacting text inside the replay or labeling steps broke the core observational loop. |
| **7** | **Dispatch Pad UX** | Always start at **Line 01 / 06** (never pre-seeded at Line 03), size the input box to `w-[62ch]` so 60 characters fill its exact width, and remove repetitive `(Exhibit Status: ████ REDACTED)` tags from every submitted line. | Gives players all 6 turns, makes the 60-character limit visually intuitive, and keeps the dispatch log clean. |
| **8** | **Multi-Page & Multi-Modal Depth** | Expanded Case #001 into a **10-page JR Ekinet portal** where the target replay traverses 5 pages (`MV-01` → `MV-05`) and requires **CLICK**, **TYPE** (`TANAKA`), **timed flash-sale clicking**, and **freeform DRAW** on a signature pad. | Clicking two buttons on a single still screen was too shallow; multi-page traversal and multi-modal actions create a real game. |
| **9** | **Positive Exhibits Only** | Framed all 5 Required Exhibits (`A–E`) as **positive tasks to perform** (never *"Avoid X"*), and ensured Exhibit D (`Sign Digital Authorization Pad`) stays `[VERIFIED ✓ +15%]` once signed instead of showing `[CONTAMINATED ✗]`. | *"Avoid"* exhibits were unintuitive, and marking Exhibit D as *"Contaminated"* when a later upsell was clicked confused players about whether their signature worked. |
| **10** | **Silent Prompt-Only Lock & No Trap Spoilers** | Silently ignore direct player clicks on the agent's webpage (removed the `"Manual clicking disabled"` error popup) and removed `[⚠️ TRAP DETECTED]` from the cursor badge. | Pop-up warnings on accidental clicks were noisy, and `[TRAP DETECTED]` spoiled mistakes before the case file was closed. |
| **11** | **Slowed Agent Kinematics** | Slowed cursor movement to `1.15s` CSS glide, animated typing letter-by-letter (`220ms/char`), and animated signature drawing across multiple points before changing pages. | Instant jumps felt robotic; deliberate movement makes the player feel like they are controlling the agent in real time. |
| **12** | **Always Act + Funny Model Thoughts** | Made the agent **always execute a visible action** (even on wrong/vague commands) and added a witty, human-readable **`Model Thought:`** row under each line (stripping all internal `MV-01`/`MV-05` jargon). When an instruction carries no usable signal, asks to win, or names a mark ID, the agent makes a harmless visible move (it pokes the page title) instead of guessing a real target. | Seeing what the model *thought* you meant—and watching it confidently click the wrong thing—is much more entertaining than a no-op error. |
| **13** | **Open-Ended Sandbox Drawing** | Upgraded `#signature-canvas` and prompt parsing ([`extractSignatureDrawingSpec`](file:///Users/louisye/Desktop/Louis/instruct/src/utils/text_normalizer.ts#L397-L505)) so the agent draws requested shapes (**smile**, frown, heart, star, circle, cat, house, stick figure, fish, flower, checkmark, zigzag, spiral, straight line, or custom cursive text) and fixed `"box"` disambiguation on Page 04 so `"Click the blue box on the bottom right"` clicks `#30` instead of re-signing `#27`. | Players should never feel artificially limited when instructing the agent inside the sandbox (e.g., `"Draw a signature in the shape of a smile"`). |
| **14** | **Post-Game Answer Key & Real Site Link** | Added an **Answer Key (`5-STEP SOLUTION (120 PTS)`)** to the Forensic Audit Report when the player finishes without a perfect score, plus outbound links labelled **"Inspired by eki-net.com"** (`eki-net.com`) in the header, menu, and score report. | Gives players closure on what instructions would have worked and lets curious players explore the real Japanese site afterward without impersonating its brand inside the sandbox. |
| **15** | **Client-Side Gemini Nano Quota Strategy** | Adopted 100% client-side execution via Chrome's on-device **Gemini Nano (`window.LanguageModel`)** + deterministic client-side fallback (`evaluateClientSideDecision`). | Uses the player's own browser/device capabilities with zero server-side API quota management or hosting cost. |
