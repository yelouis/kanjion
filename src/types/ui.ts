/**
 * src/types/ui.ts
 *
 * Presentation layer component prop interfaces:
 * DispatchPad, SandboxStage, ExhibitsPanel, and MastheadHeader.
 */

import { TelegramLine, ScoreReport, AgentCursorState, StampStatus } from './game';
import { SoMElement } from './puzzle';
import { FieldValue, PuzzleState } from './puzzle_data';

/**
 * Props for the 6-Line Western Union Telegram Dispatch Pad component.
 * Displays all 6 rows simultaneously (past logged, active typewriter, future bonus rows).
 */
export interface DispatchPadProps {
  /** All 6 telegram ledger lines. */
  telegrams: TelegramLine[];
  /** Zero-based index of the currently active input line (0 to 5). */
  activeLineIndex: number;
  /** Controlled typewriter text input value (max 60 chars). */
  currentInput: string;
  /** Callback on text input change with strict 60-character enforcement. */
  onInputChange: (value: string) => void;
  /** Callback to dispatch the current line (Enter or button click). */
  onSubmitLine: () => void;
  /** Callback to close the case file early and unseal the exhibits. */
  onCloseCase: () => void;
  /** Current case status. Input is disabled when 'closed'. */
  caseStatus: 'active' | 'closed';
  /** Live efficiency multiplier if closed immediately (e.g. 1.6). */
  currentMultiplier: number;
  /** True when agent action execution is currently animating or fetching. */
  isSubmitting?: boolean;
}

/**
 * Props for the 1024x768 Microfiche Sandbox Stage component.
 */
export interface SandboxStageProps {
  /** Current active Macro-View identifier (e.g. 'MV-01'). */
  macroViewId: string;
  /** Current sandbox state data. */
  microState: Record<string, FieldValue> | PuzzleState;
  /** Field agent cursor position, thought note, and theme variant. */
  agentCursor: AgentCursorState;
  /** Whether decoy trap shake animation class is applied to the stage. */
  stageShake: boolean;
  /** Uniform scale factor calculated from available viewport width. */
  scaleFactor?: number;
  /** Bounded Set-of-Mark elements registered in this macro-view. */
  somElements?: SoMElement[];
  /** Callback for interactive element clicks (if in manual/practice mode). */
  onElementClick?: (elementId: number | string) => void;
}

/**
 * Props for the Declassified Forensic Audit Report & Exhibits Panel.
 * Remains completely hidden during active play; reveals on case closure.
 */
export interface ExhibitsPanelProps {
  /** True when the case file has been closed and unsealed. */
  caseClosed: boolean;
  /** Evaluated score report containing closeness, multiplier, and stamps. */
  scoreReport: ScoreReport | null;
  /** Official first-close result used for the shareable clipping. */
  officialResult?: ScoreReport | null;
  /** Run mode ('official' or 'practice'). */
  mode?: 'official' | 'practice';
  /** Case number string (e.g. '#001'). */
  caseNumber?: string;
  /** Answer key lines to display in the report. */
  answerKey?: string[];
  /** Callback to copy shareable plaintext scorecard to clipboard. */
  onCopyClipping?: () => void;
  /** Callback to start unscored practice mode. */
  onStartPractice?: () => void;
  /** Legacy callback alias to start practice mode. */
  onReopenCase?: () => void;
}

/**
 * Props for the Broadsheet Masthead Header component.
 */
export interface MastheadProps {
  /** Case number string (e.g. '#001'). */
  caseNumber: string;
  /** Case title string (e.g. 'KANJION'). */
  caseTitle: string;
  /** Theme / difficulty badge text (e.g. '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN'). */
  difficultyBadge: string;
  /** Current case status ('active' or 'closed'). */
  caseStatus: 'active' | 'closed';
  /** Total count of sealed/unsealed exhibits (e.g. 5). */
  exhibitCount: number;
  /** Run mode ('official' or 'practice'). */
  mode?: 'official' | 'practice';
}

/**
 * Animated cursor props.
 */
export interface AgentCursorProps {
  xPercent: number;
  yPercent: number;
  thoughtText: string;
  isTrap?: boolean;
}

/**
 * Tactile rubber stamp props.
 */
export interface RubberStampProps {
  status: StampStatus;
  text: string;
  rotationDeg: number;
}
