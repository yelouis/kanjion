/**
 * src/types/game.ts
 *
 * State and scoring layer contracts: rubber ink stamps, exhibit evaluations,
 * score calculation reports, telegram lines, and immutable game state.
 */

import { AgentAction, ShinkansenMicroState } from './engine';

/**
 * Status resulting from evaluating an exhibit checkpoint against the final micro-state:
 * - VERIFIED: Target condition met in final state (full points awarded).
 * - CLEAN: Decoy/trap condition successfully avoided (full points awarded).
 * - CONTAMINATED: Decoy/trap condition was triggered (0 points awarded).
 * - MISSED: Required target condition was not met (0 points awarded).
 */
export type StampStatus = 'VERIFIED' | 'CONTAMINATED' | 'MISSED' | 'CLEAN';

/**
 * Evaluated exhibit badge rendered on the declassified Polaroid exhibit card.
 */
export interface ExhibitEvaluation {
  /** Unique exhibit identifier (e.g. 'exhibit_a' to 'exhibit_e'). */
  id: string;
  /** Code letter ('A' to 'E'). */
  code?: string;
  /** Card title (e.g. 'Route: 東京 ⇒ 新大阪'). */
  title: string;
  /** Checkpoint weight percentage (e.g. 25, 20, 15). */
  weight: number;
  /** Evaluated status. */
  status: StampStatus;
  /** Exact badge text stamped on the card (e.g. '[VERIFIED ✓ +20%]' or '[MISSED ✗ +0%]'). */
  stampText: string;
  /** Ink stamp rotation angle in degrees for tactile feel (-4 or +3). */
  rotationDeg: number;
  /** Actual points awarded (either weight or 0). */
  awardedPoints?: number;
}

/**
 * Final verified forensic score report calculated upon case closure.
 */
export interface ScoreReport {
  /** Closeness score: sum of awarded exhibit weights (0 to 100). */
  closenessScore: number;
  /** Number of telegram lines dispatched by the player (1 to 6). */
  linesUsed: number;
  /** Number of unused telegram lines preserved for efficiency bonus (0 to 5). */
  unusedLines: number;
  /**
   * Efficiency multiplier: M = 1.0 + (unusedLines * 0.20).
   * Ranges from 1.0x (all 6 used) to 2.0x (1 used).
   */
  multiplier: number;
  /**
   * Final verified points: round(closenessScore * multiplier).
   * Ranges from 0 to 200 PTS.
   */
  finalScore: number;
  /** Detailed evaluation for each of the 4 to 6 exhibits. */
  exhibitEvaluations: ExhibitEvaluation[];
  /** Shareable plaintext scorecard formatted for clipboard copy. */
  shareableClipping: string;
  /** Visual emoji row (e.g. '🟩🟩🟩🟩⬜ (3/6 Telegrams Sent)'). */
  emojiRow?: string;
}

/**
 * A single row within the 6-Line Western Union Telegram Dispatch Pad.
 */
export interface TelegramLine {
  /** Line index (1 to 6). */
  lineNumber: number;
  /** User-entered instruction string (max 60 characters). */
  text: string;
  /** Whether this telegram line has been dispatched. */
  submitted: boolean;
  /** ISO timestamp when line was dispatched. */
  timestamp?: string;
  /** Brief action summary logged in ledger (e.g. 'Agent clicked [🍀 ◯ ¥13,870]'). */
  actionSummary?: string;
  /**
   * Redacted checkpoint status mask.
   * Strictly 'SEALED' during active play to prevent state leakage.
   */
  exhibitRedactedStatus: 'SEALED' | 'UNSEALED';
  /** Full executed action object associated with this line. */
  agentAction?: AgentAction;
}

/**
 * Real-time field-agent cursor state on the microfiche sandbox stage.
 */
export interface AgentCursorState {
  /** Left position as a percentage of stage width (0 to 100). */
  xPercent: number;
  /** Top position as a percentage of stage height (0 to 100). */
  yPercent: number;
  /** Pinned yellow index-card field note text (max 80 chars). */
  thought: string;
  /** Visual theme variant of the cursor and thought note. */
  variant: 'idle' | 'executing' | 'confirmed' | 'trap' | 'confused';
  /** Whether the stage is currently executing a shake animation. */
  isShaking: boolean;
}

/**
 * Complete centralized game state managed by the game reducer.
 */
export interface GameState {
  /** Case number identifier (e.g. '#042'). */
  caseNumber: string;
  /** Current case status: 'active' during play, 'closed' upon submission. */
  caseStatus: 'active' | 'closed';
  /** Zero-based index of the active input row (0 = Line 01, 5 = Line 06). */
  activeLineIndex: number;
  /** The 6 telegram ledger lines (past, active, future bonus rows). */
  telegrams: TelegramLine[];
  /** Current value of the typewriter input field (0 to 60 chars). */
  currentInput: string;
  /** Current active Macro-View ID. */
  macroViewId: string;
  /** Current sandbox micro-state. */
  microState: ShinkansenMicroState;
  /** Animated field agent cursor position, note, and styling. */
  agentCursor: AgentCursorState;
  /** True when in-engine visual Target Ghost Replay overlay is toggled ON. */
  ghostReplayActive: boolean;
  /** True when backend Set-of-Mark ID tags overlay is toggled ON. */
  somOverlayActive: boolean;
  /** True when stage error shake animation is active. */
  stageShake: boolean;
  /** True while asynchronous agent instruction resolution is in progress. */
  isExecuting: boolean;
  /** Calculated score report (null during active play, populated on case closure). */
  scoreReport: ScoreReport | null;
}

/**
 * Alias for DossierState matching Explorer 1
 */
export type DossierState = GameState;
