/**
 * src/types/puzzle.ts
 *
 * Puzzle definition contracts: bounding boxes, Set-of-Mark (SoM) element manifests,
 * macro-view definitions, state checkpoints (Required Exhibits), and target trajectories.
 */

import { GridCoordinate, GridColumn, GridRow, AgentActionType } from './engine';
import { StampStatus } from './game';
import { FieldValue } from './puzzle_data';

/**
 * Bounding box coordinates within the fixed 1024x768 stage.
 */
export interface BoundingBox {
  /** Pixel offset from stage left (0 to 1024). */
  x: number;
  /** Pixel offset from stage top (0 to 768). */
  y: number;
  /** Rendered width in pixels. */
  width: number;
  /** Rendered height in pixels. */
  height: number;
  /** Left coordinate as a percentage of stage width (0 to 100). */
  xPercent?: number;
  /** Top coordinate as a percentage of stage height (0 to 100). */
  yPercent?: number;
}

/**
 * Interactive DOM element tagged with a Set-of-Mark (SoM) badge.
 */
export interface SoMElement {
  /** Numeric ID (e.g. 25). */
  id: number;
  /** Formatted badge string (e.g. '#25'). */
  somId: string;
  /** Unique element key (e.g. 'btn_seat_nozomi_green'). */
  elementKey: string;
  /** HTML tag name (e.g. 'button', 'input', 'a'). */
  tag: string;
  /** ARIA or functional role. */
  role?: string;
  /** Exact bounding-box geometry on the 1024x768 canvas (populated by capture pipeline). */
  boundingBox?: BoundingBox;
  /** Grid cell quadrant reference (e.g. 'D3'). */
  gridRef: GridCoordinate;
  /** Visible Japanese/English text label. */
  text: string;
  /** Visual attributes for heuristic matching (colors, glyphs, keywords). */
  visualAttributes: {
    color?: string;
    bgColor?: string;
    glyph?: string; // e.g. '🍀', '◯', '▶'
    description?: string;
  };
  /** True if this element is on the winning solution path. */
  isTarget?: boolean;
  /** True if clicking this element contaminates an exhibit or triggers a trap. */
  isTrap?: boolean;
  /** True if this element is an inert link (out-of-scope navigation). */
  isInert?: boolean;
  /** Primary action type associated with this element. */
  actionType: AgentActionType;
}

/**
 * Alternative representation of an element bounding box for compiler tooling.
 */
export interface ElementBoundingBox {
  somId: number;
  selector?: string;
  role?: 'button' | 'input' | 'tab' | 'checkbox' | 'link' | string;
  label?: string;
  x: number;       // 0 to 1024
  y: number;       // 0 to 768
  width: number;
  height: number;
  cx?: number;      // Center x
  cy?: number;      // Center y
  gridCol?: GridColumn;
  gridRow?: GridRow;
  isTarget?: boolean;
  isDecoy?: boolean;
}

/**
 * Outgoing transition from a macro-view.
 */
export interface MacroViewTransition {
  targetElementId: number;
  destinationMacroViewId: string;
}

/**
 * A discrete Macro-View representing a major screen or modal state in the puzzle.
 * Puzzles contain 8 to 12 Macro-Views.
 */
export interface MacroView {
  /** Unique macro-view identifier (e.g. 'MV-03' or 'view_03'). */
  id: string;
  /** Semantic name (e.g. 'seat_matrix'). */
  name: string;
  /** Description for audit and debugging. */
  description?: string;
  /** Simulated browser URL displayed in chrome bar. */
  simulatedUrl?: string;
  /** Relative asset path to pre-rendered Set-of-Mark WebP image. */
  somImagePath?: string;
  /** Legacy template or screenshot references */
  templatePath?: string;
  cleanScreenshotUrl?: string;
  somScreenshotUrl?: string;
  /** Interactive element manifest for this view. */
  elements: SoMElement[];
  /** Outgoing transitions to other macro-views. */
  transitions?: MacroViewTransition[];
}

/**
 * Checkpoint verification definition ("Required Exhibit").
 * 4 to 6 exhibits are defined per puzzle, summing to 100% base closeness.
 */
export interface ExhibitDefinition {
  /** Unique exhibit identifier (e.g. 'exhibit_a' to 'exhibit_e'). */
  id: string;
  /** Single letter code ('A', 'B', 'C', 'D', 'E'). */
  code: string;
  /** Title shown on Polaroid card (e.g. 'Row 2: 🍀 ¥13,870 Seat'). */
  title: string;
  /** Base weight percentage (e.g. 25, 20, 15). All exhibits sum to 100%. */
  weight: number;
  /** Descriptive evaluation criteria. */
  criteria: string;
  /**
   * Deterministic evaluation function checking final state.
   */
  evaluate: (microState: Record<string, FieldValue>) => {
    status: StampStatus;
    awardedPoints: number;
    stampText: string;
  };
}

/**
 * Declarative exhibit definition for puzzle manifests.
 */
export interface PuzzleExhibitDefinition {
  id: string;
  title: string;
  weight: number;
  ruleKey?: string;
  targetValue?: unknown;
}

/**
 * Waypoint along the target demonstration trajectory.
 */
export interface TargetWaypoint {
  stepNumber?: number;
  timestampSec?: number;
  timestamp?: string; // e.g. '0:03'
  gridRef: GridCoordinate; // e.g. 'D3'
  x: number; // e.g. 885
  y: number; // e.g. 468
  radius?: number; // e.g. 22
  targetSomId?: number;
  action?: 'click' | 'type';
  label?: string; // e.g. 'TARGET CLICK @ 0:03 (COL D, ROW 3)'
}

/**
 * Target Demonstration Ghost Replay data contract.
 * Strictly visual geometry and ruler quadrants — no DOM text spoilers.
 */
export interface TargetGhostReplayDefinition {
  /** Sequential click checkpoints. */
  waypoints: TargetWaypoint[];
  /** SVG bezier path string connecting the trajectory steps. */
  trajectorySvgPath: string;
  /** Explanatory note displayed in the replay overlay. */
  overlayNote?: string;
}

/**
 * Trajectory representation matching Explorer 1
 */
export interface GhostTrajectory {
  puzzleId?: string;
  totalDurationSec?: number;
  waypoints: TargetWaypoint[];
  svgPathData?: string;
}

/**
 * Complete compiled puzzle manifest.
 */
export interface PuzzleManifest {
  /** Case file identifier (e.g. '#001' or '001'). */
  caseNumber?: string;
  id?: string;
  slug?: string;
  /** Puzzle title (e.g. 'Tokyo–Osaka Shinkansen'). */
  title: string;
  /** Difficulty rating. */
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  locale?: 'en' | 'ja';
  date?: string;
  theme?: string;
  /** Region / theme flag label (e.g. '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN'). */
  themeBadge?: string;
  /** Initial Macro-View ID. */
  initialMacroViewId?: string;
  /** Initial sandbox state. */
  initialMicroState?: Record<string, FieldValue>;
  /** Stage configuration. */
  stage?: {
    width: number;
    height: number;
    rulers: {
      cols: string[];
      rows: string[];
    };
  };
  /** All bounded Macro-Views (8 to 12). */
  macroViews: MacroView[];
  /** 4 to 6 Required Exhibits summing to 100% weight. */
  exhibits: ExhibitDefinition[];
  /** 1:1 visual ghost replay definition. */
  ghostReplay?: TargetGhostReplayDefinition;
  ghostTrajectory?: GhostTrajectory;
}
