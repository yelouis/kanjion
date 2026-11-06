# Kanjion: Daily AI Browser-Instruction Puzzle Game

* **Author:** yelouis
* **Date:** 2026-11-05

## Overview

**Kanjion** is a daily browser-based puzzle game built in TypeScript and React where players watch an in-engine **Ghost Replay** of a task performed on a simplified, sandboxed clone of a recognizable website and guide an AI agent to replicate the result using as few short text instructions as possible. Levels scale from standard English layouts to dense Japanese websites (such as train reservation matrices or shopping portals) where copy-paste is disabled, forcing players to describe visual layout, grid coordinates, colors, icons, numerals, and symbol shapes rather than copying foreign text.

The game uses **"The Redacted Dossier"** visual and spatial interface: an archival newsprint broadsheet framing a coordinate-ruled (`COL A–D`, `ROW 1–4`) microfiche sandbox stage above a **6-Line Western Union Telegram Dispatch Pad** (where all 6 instruction rows are visible at once, similar to *Wordle*). Each line is capped at 60 characters. After the player dispatches a line, a low-cost cloud vision LLM inspects a pre-cached Set-of-Mark (SoM) image of the current **Macro-View** (one of 8–12 discrete screen/modal states per puzzle) paired with compact JSON **Micro-State**—where 30 to 50 interactive elements (the winning path plus decoys like fake banner ads, newsletter popups, and adjacent cancel buttons, while out-of-scope links are inert) are tagged with bounded IDs—and returns a structured action. The browser animates a field-agent cursor with a pinned yellow field note across the stage in real time so the player can see what the agent clicked and use subsequent lines to recover from mistakes.

Crucially, the **4 to 6 target state checkpoints ("Required Exhibits") remain sealed/redacted during active play**. Players must compare their live screen against the Target Ghost Replay to judge whether they have matched the target state. When the player clicks **"Close Case File"** (early submission) or finishes all 6 telegram lines, the dossier unseals the Required Exhibits with rubber ink stamps (`[VERIFIED ✓]`, `[CONTAMINATED ✗]`, `[MISSED ✗]`) to calculate the deterministic closeness score (0–100%) multiplied by the unused-line efficiency bonus.

## Analysis

The six-lens Goldfish review and Game UX Art Direction review surfaced six architectural and gameplay risks, each resolved into concrete system constraints:

1. **Combinatorial Explosion in Pre-Cached Screen Images (Design & Structural Blocker — Resolved)**:
   If a puzzle has 5 independent state properties (selected tab, open modal, dropdown choice, quantity, checkbox), pre-rendering a static Set-of-Mark screenshot for every possible combination at build time is unworkable.
   * *Resolution*: Partition each puzzle into **8–12 pre-rendered Macro-Views** (screens/modals), each with a build-time Set-of-Mark image, and pass **Micro-State Values** (such as selected radio options or input text) as compact JSON alongside the macro-view image. Out-of-scope links on the cloned webpage are either non-clickable or lead to one of the bounded trap views.

2. **Anonymous API Abuse & Token Cost Spikes (Cost & Quota Blocker — Resolved)**:
   A zero-login daily web game exposes its step evaluation endpoint to anonymous traffic. Sending a 1,200-token image prompt up to 6 times per player means a viral spike or script attack could trigger upstream rate limits or run up API bills. Furthermore, because instructions are limited to 60 characters on a shared daily puzzle, many players will type the exact same prompt (such as `"close the popup"` or `"click red button"`).
   * *Resolution*: Normalize each 60-character instruction (lowercase, trimmed, punctuation stripped) and cache `(puzzle_id, state_hash, normalized_instruction)` in an edge key-value store so repeat instructions across players cost $0 and resolve in milliseconds. Combine this with provider context caching on the Set-of-Mark image, per-IP daily round quotas, and a hard daily spend circuit breaker.

3. **Coordinate Drift Between the Pre-Cached Image and the Player's Browser (Structural & SRE Blocker — Resolved)**:
   If the player's browser renders the sandbox using live responsive HTML/CSS, font differences (especially Japanese fonts across iOS, Android, and desktop) or screen widths will shift element positions relative to the pre-cached Set-of-Mark image.
   * *Resolution*: Render the sandbox inside a fixed-resolution virtual stage (`1024x768`) framed with outer coordinate rulers (`COL A–D`, `ROW 1–4`), scaled uniformly with CSS transforms and bundled self-hosted web fonts (such as subsetted Noto Sans JP). Generate the Set-of-Mark images and the element bounding-box manifest from the exact same headless build step so coordinates match to the pixel.

4. **Non-Click Interactions and Unclear Agent Mistakes (UX & Readiness Major — Resolved)**:
   Real web tasks involve dropdowns, text inputs, and scrolling—not just clicking buttons. Native browser `<select>` tags cannot be styled, captured in DOM screenshots, or clicked by a virtual cursor.
   * *Resolution*: Forbid native OS `<select>` and date inputs in sandboxes; build custom in-DOM dropdowns and steppers so every option has its own clickable element ID. Restrict the LLM schema to `CLICK`, `TYPE` (with a `text_value` string), `SCROLL`, and `CONFUSED`, plus a short `thought` string (under 80 characters, shown as a pinned field note on the cursor) explaining what element the agent targeted.

5. **Meta-Prompting, Goal-Leak Exploits & Anti-Phishing Guardrails (Design & Security Major — Resolved)**:
   Within 60 characters, players will try typing `"complete the task"`, `"click the winning button"`, or `"click id 14"`. Additionally, hosting verbatim clones of real commercial login/payment pages risks browser anti-phishing blocks.
   * *Resolution*: Keep the LLM completely blind to the target replay and the winning checklist—it only sees the current screen and executes the literal UI instruction. Strip Set-of-Mark ID numbers from the client DOM and filter raw numeric ID references from user prompts unless that number appears visibly in the element's label. Restrict cloned website sandboxes to non-login public workflows (catalogs, booking filters, directories) inside a simulated browser frame with parody/sanitized branding and all external scripts removed.

6. **Gamified "Redacted Dossier" UI, Sealed Exhibits & In-Engine Ghost Replay (UX & YAGNI Majors — Resolved)**:
   * *Anti-SaaS Tactile Broadsheet UI*: Replaced generic SaaS dashboard cards with **"The Redacted Dossier"** aesthetic—archival newsprint (`#F4EFE6`), carbon ink rules (`#111111`), coordinate-ruled microfiche stage, and a 6-Row Western Union Telegram Dispatch Pad where unused lines display their `+20% EFFICIENCY MULTIPLIER` watermark.
   * *Sealed Required Exhibits Until Case Closed*: Keep the 4–6 state checkpoints ("Required Exhibits") hidden/redacted during active play so they do not leak text spoilers or remove the tension of deciding when to stop. Unseal the exhibits with rubber ink stamps only when the player clicks **"Close Case File"** or completes all 6 telegram lines.
   * *In-Engine Ghost Replay*: Render the target demonstration as an in-engine visual **Ghost Replay** overlay (with DevTools text inspection blocked/canvas-rendered) rather than streaming `.mp4` videos, keeping kanji crisp and payload size under 1 KB of JSON.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Daily browser puzzle loop in TypeScript/React styled as **"The Redacted Dossier"** with zero-login play, a 6-line Telegram Dispatch Pad (max 60 characters per line), coordinate-ruled microfiche stage, and shareable daily case-clipping scorecards.
  * Fixed-viewport sandbox engine (`1024x768`) supporting 8–12 Macro-Views of simplified real-website clones, 30–50 interactive elements per view (winning path + decoys, with out-of-scope links inert), custom in-DOM controls, disabled copy-paste, 1:1 visual Ghost Replay overlay, and animated field-agent cursor playback.
  * Step-by-step cloud vision LLM evaluation using Set-of-Mark annotated Macro-View images + JSON Micro-State, schema-constrained JSON output (`CLICK`, `TYPE`, `SCROLL`, `CONFUSED`), and edge caching of normalized instructions.
  * Sealed/redacted 4–6 weighted sandbox state checkpoints ("Required Exhibits") that unseal upon clicking "Close Case File" or finishing Line 06 to compute deterministic closeness (0–100%) multiplied by an unused-line efficiency bonus.
  * Daily puzzle capture/compilation pipeline (`tools/compile_puzzle.ts`) that extracts simplified HTML/CSS clones of recognizable websites into bounded 8–12 Macro-View bundles and auto-generates Set-of-Mark manifests via headless Playwright.
* **Out-of-Scope Non-Goals:**
  * Running live headless browsers against external public websites at play time.
  * Coding the frontend in Flutter Web (rejected due to multi-megabyte CanvasKit/font startup bundle size and friction when recreating HTML/CSS website layouts).
  * Downloading or running local LLMs in the client browser via WebGPU/WebAssembly or packaging a desktop Steam client for v1.
  * Pre-recording and CDN-streaming `.mp4` video files for daily target demonstrations.
  * Freeform `(x, y)` pixel coordinate prediction without element bounding-box mapping.
  * User accounts, server-side relational databases for session state, or multiplayer real-time matchmaking.

## Alternatives Weighed

* **Live external websites via Playwright/headless browser**: Rejected by author because per-session browser containers add 10–60 second latency, high server costs, and break whenever external sites update their DOM.
* **Client-side local model (WebGPU/WASM) or Steam desktop download with bundled model**: Rejected by author because a 350–900 MB model download causes severe mobile browser drop-off and memory crashes, and a Steam download removes instant link-click daily-game virality.
* **Flutter Web frontend**: Rejected by author because Flutter Web's WASM/CanvasKit runtime slows down mobile link-click startup, makes recreating dense HTML/CSS webpages verbose, and complicates DOM bounding-box extraction compared to TypeScript/React.
* **Restricting sandboxes to only 2–3 clickable links**: Rejected by author because a tiny action space lets vague or random prompts succeed by chance, removing the puzzle challenge. Replaced with 30–50 bounded interactive elements including decoys while keeping unrelated page links inert.
* **Raw image-to-`(x, y)` pixel coordinate output from a cheap vision model**: Rejected by author because low-cost vision models have poor pixel accuracy on dense Japanese layouts and miss small links. Replaced with Set-of-Mark numbered bounding boxes mapped to exact DOM coordinates.
* **Text-only DOM snapshots without vision**: Rejected by author because a text-only model cannot interpret visual descriptions of kanji shapes or visual layout traits unless manually tagged in advance.
* **Upfront batch scripting of all 6 instructions before execution**: Rejected by author because an AI misclick on instruction 1 invalidates instructions 2–6 and prevents the player from interactively recovering from mistakes.
* **LLM-as-a-judge or click-sequence matching for closeness scoring**: Rejected by author because LLM numerical ratings are inconsistent across players and click-history matching penalizes valid shortcuts or rewards progress that was later undone. Replaced with a deterministic checklist of final sandbox state properties.
* **Combinatorial pre-rendering of every micro-state screenshot**: Rejected by author due to build-time asset explosion; replaced with 8–12 pre-rendered Macro-Views paired with JSON Micro-State.
* **Streaming `.mp4` target videos**: Rejected by author in favor of an in-engine Ghost Replay to keep small Japanese text sharp, avoid multi-megabyte mobile downloads, and eliminate re-recording when puzzles change.
* **Generic SaaS Dashboard UI or visible live checkpoint pills during play**: Rejected by author in favor of **"The Redacted Dossier"** broadsheet aesthetic with the 5 Required Exhibits kept invisible/sealed until the player clicks "Close Case File" or finishes all 6 instructions, preventing spoiler hints and making early submission a real observational test.

## Key Decisions & Staging for Next Steps

* **Frontend Stack & UI ("The Redacted Dossier")**: TypeScript + React (HTML/CSS) app styled as an archival forensic broadsheet (`#F4EFE6` paper, `#111111` ink rules, serif masthead + monospace dispatches) with a coordinate-ruled (`COL A–D`, `ROW 1–4`) `1024x768` Microfiche Sandbox Stage, a 1:1 visual Target Ghost Replay toggle, an animated Field Agent Cursor with pinned yellow notes, a 6-Line Western Union Telegram Dispatch Pad (60 chars max per line), and Sealed Required Exhibits that unseal with ink stamps on "Close Case File" or after Line 06.
* **Daily Puzzle Pipeline**: Copy recognizable real-website layouts into simplified, script-stripped HTML/CSS sandboxes capped at 8–12 Macro-Views (with 30–50 active elements + decoys and all other links inert), compiled via headless Playwright into Set-of-Mark images and bounding-box manifests.
* **Stateless Inference & Caching**: Low-cost cloud vision LLM with schema-constrained outputs (`CLICK`, `TYPE`, `SCROLL`, `CONFUSED` + `thought`), backed by normalized `(puzzle_id, state_hash, instruction)` edge KV caching and provider context caching.
* **Scoring Formula**: 4–6 weighted state-property Exhibits (0–100% closeness) unsealed at round end, multiplied by an efficiency bonus for unused telegram lines.
