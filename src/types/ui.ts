/**
 * src/types/ui.ts
 *
 * Presentation layer component prop interfaces:
 * DispatchPad, SandboxStage, GhostReplay, ExhibitsPanel, and MastheadHeader.
 */

import { ShinkansenMicroState } from './engine';
import { TelegramLine, ScoreReport, AgentCursorState, StampStatus } from './game';
import { SoMElement, TargetGhostReplayDefinition } from './puzzle';

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
 * Framed by outer rulers (COL A–D, ROW 1–4) with uniform CSS transform scaling.
 */
export interface SandboxStageProps {
  /** Current active Macro-View identifier (e.g. 'MV-03'). */
  macroViewId: string;
  /** Current sandbox micro-state data. */
  microState: ShinkansenMicroState;
  /** Field agent cursor position, thought note, and theme variant. */
  agentCursor: AgentCursorState;
  /** Whether the 1:1 visual Target Ghost Replay overlay is active. */
  ghostReplayActive: boolean;
  /** Whether backend Set-of-Mark numbered tags overlay is visible. */
  somOverlayActive: boolean;
  /** Whether decoy trap shake animation class is applied to the stage. */
  stageShake: boolean;
  /** Uniform scale factor calculated from available viewport width. */
  scaleFactor?: number;
  /** Bounded Set-of-Mark elements registered in this macro-view. */
  somElements?: SoMElement[];
  /** Ghost replay trajectory definition for rendering overlay. */
  ghostReplay?: TargetGhostReplayDefinition;
  /** Callback for interactive element clicks (if in manual/practice mode). */
  onElementClick?: (elementId: number | string) => void;
}

/**
 * Props for the in-engine 1:1 Visual Target Ghost Replay overlay.
 * Renders SVG curved dashed trajectory and timestamp pulses without leaking text.
 */
export interface GhostReplayProps {
  /** Whether the overlay scrim is open. */
  active: boolean;
  /** Callback to close or toggle the overlay. */
  onToggle: () => void;
  /** Trajectory definition containing waypoint coordinates and path. */
  trajectory?: TargetGhostReplayDefinition;
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
  /** Callback to copy shareable plaintext scorecard to clipboard. */
  onCopyClipping?: () => void;
  /** Callback to return to active play in practice/exploration mode. */
  onReopenCase?: () => void;
}

/**
 * Props for the Broadsheet Masthead Header component.
 */
export interface MastheadProps {
  /** Case number string (e.g. '#042'). */
  caseNumber: string;
  /** Case title string (e.g. 'THE INSTRUCT DOSSIER'). */
  caseTitle: string;
  /** Theme / difficulty badge text (e.g. '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN'). */
  difficultyBadge: string;
  /** Ghost replay overlay toggle state. */
  ghostReplayActive: boolean;
  /** Callback to toggle ghost replay overlay. */
  onToggleGhostReplay: () => void;
  /** Backend SoM IDs overlay toggle state. */
  somOverlayActive: boolean;
  /** Callback to toggle backend SoM IDs. */
  onToggleSomOverlay: () => void;
  /** Current case status ('active' or 'closed'). */
  caseStatus: 'active' | 'closed';
  /** Total count of sealed/unsealed exhibits (e.g. 5). */
  exhibitCount: number;
}

/**
 * Framing coordinate rulers props.
 */
export interface CoordinateRulerProps {
  columns: string[];
  rows: string[];
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
