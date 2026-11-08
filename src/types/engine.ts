/**
 * src/types/engine.ts
 *
 * Core spatial coordinate system, agent actions, micro-state definitions,
 * execution connector contracts, and multimodal LLM request/response interfaces.
 */

/**
 * 4 horizontal coordinate columns across the 1024px stage width.
 * Each column spans 256px:
 * - A: 0px – 255px (Left Sidebar / Controls)
 * - B: 256px – 511px (Center-Left / Unreserved Seats / Insurance Checkbox)
 * - C: 512px – 767px (Center-Right / Reserved Seats / Cancel Button)
 * - D: 768px – 1023px (Right / Green Car Button / Decoy Banner / Confirm Button)
 */
export type GridColumn = 'A' | 'B' | 'C' | 'D';

/**
 * 4 vertical coordinate rows across the 768px stage height.
 * Each row spans 192px:
 * - 1: 0px – 191px (Browser Chrome, Masthead, Decoy Promo Banner)
 * - 2: 192px – 383px (Search Filter Box, Train 1 - Hikari 515 Fare Row)
 * - 3: 384px – 575px (Train 2 - Nozomi 24 Target Fare Row)
 * - 4: 576px – 767px (Bottom Action Bar: Insurance Checkbox, Cancel, Confirm)
 */
export type GridRow = '1' | '2' | '3' | '4';

/**
 * 4x4 grid coordinate cell token (e.g. 'A1', 'D3', 'D4').
 * Directly recognized by the instruction normalizer and offline matcher.
 */
export type GridCoordinate = `${GridColumn}${GridRow}`;

/**
 * Discrete actions supported by the agent runtime schema.
 * - CLICK: Left mouse click at the target element's center coordinates.
 * - TYPE: Text input into an active editable element (e.g. passenger name field).
 * - DRAW: Freehand stroke / signature drawing inside a canvas/signature pad element.
 * - TIMED_CLICK: Click synchronized with a moving or cycling UI element window.
 * - SCROLL: Viewport or container scroll.
 * - CONFUSED: Fallback when instruction is ambiguous or ungrounded.
 */
export type AgentActionType = 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK' | 'SCROLL' | 'CONFUSED' | 'NOOP';

/**
 * Exact pixel coordinates in normalized 1024x768 stage coordinate space.
 */
export interface AgentCoordinate {
  x: number; // 0 to 1024
  y: number; // 0 to 768
}

/**
 * Concrete action emitted by an execution connector (offline simulator or cloud LLM).
 */
export interface AgentAction {
  /** The action primitive to execute. */
  action: AgentActionType;
  /** The numeric or tagged element identifier targeted (e.g. '#25' or '25'). Optional if CONFUSED. */
  targetId?: string;
  /** Exact pixel coordinates in normalized 1024x768 stage coordinate space. */
  targetCoordinate?: AgentCoordinate;
  /** Framed grid reference cell (e.g. 'D3', 'D4', 'D1'). */
  gridRef?: GridCoordinate;
  /** Text value to enter if action is TYPE. */
  textValue?: string;
  /** Scroll direction if action is SCROLL. */
  scrollDirection?: 'up' | 'down';
  /**
   * Explanatory field note displayed on the pinned yellow agent thought note.
   * Maximum 80 characters.
   */
  thought: string;
  /** Whether this action hit a known decoy trap (triggers stage shake animation). */
  isTrap?: boolean;
}

/**
 * Case File #001: Tokyo–Osaka Shinkansen Micro-State Model.
 * Represents all mutable state variables of the sandboxed booking website clone.
 */
export interface ShinkansenMicroState {
  /** Current active Macro-View identifier (e.g. 'MV-03' or 'view_03'). */
  macroViewId: string;
  /** Currently selected route identifier (e.g. 'tokyo_osaka' or 'tokyo_shinosaka'). */
  selectedRoute: string;
  /** Configured departure time slot (e.g. '14:30'). */
  departureTime: string;
  /** Selected train name (e.g. 'Nozomi 24', 'Hikari 515', or 'none'). */
  trainName: string;
  /** Selected seat class (e.g. 'green_car', 'ordinary_reserved', 'ordinary_free', or 'none'). */
  seatClass: string;
  /** Total calculated fare in Japanese Yen (e.g. 13870). */
  fare: number;
  /** True if the target discount Green Car seat (🍀 Nozomi 24) is selected (Exhibit C). */
  greenCarSelected: boolean;
  /** True if the red decoy promotional insurance banner (#12) was clicked (Exhibit D contamination). */
  insuranceTrapHit: boolean;
  /** True if the add-on insurance checkbox (#28) is checked in Row 4 (Exhibit D contamination). */
  insuranceCheckboxChecked: boolean;
  /** True if the final blue confirmation button (#30) was clicked (Exhibit E). */
  finalConfirmed: boolean;
  /** Active modal dialog overlay (if any). */
  activeModal?: 'none' | 'insurance' | 'cancel' | 'logout' | 'seat_map';
  /** Departure date string (e.g. '2026-11-05'). */
  departureDate?: string;
  /** Passenger count record. */
  passengerCount?: {
    adults: number;
    children: number;
  };
  /** Passenger name typed into the reservation input field. */
  passengerName?: string;
  /** Signature label or stroke rendered inside the signature pad. */
  signatureStroke?: string;
  /** True if the timed flash-sale window was clicked on the green seat button. */
  timedWindowHit?: boolean;
  /** Ordered list of Macro-View page IDs visited across the 12-page portal graph. */
  visitedViews?: string[];
  /** Step history audit log for simulation debugging. */
  stepHistory?: Array<{
    lineIndex: number;
    instruction: string;
    actionType: AgentActionType;
    targetId?: string;
    fieldNote: string;
  }>;
}

/**
 * Canonical interface for agent execution engines.
 * Implemented by both:
 * 1. OfflineSimulator (standalone deterministic regex/heuristic interpreter)
 * 2. CloudVisionConnector (multimodal vision LLM with edge caching)
 */
export interface AgentExecutionConnector {
  resolveInstruction(
    macroViewId: string,
    microState: ShinkansenMicroState,
    instruction: string
  ): Promise<AgentAction> | AgentAction;
}

/**
 * Normalized payload sent to the multimodal vision LLM connector or edge cache.
 */
export interface LLMDecisionRequest {
  /** Case puzzle identifier (e.g. 'case_001'). */
  puzzleId: string;
  /** Macro-View identifier (e.g. 'MV-03'). */
  macroViewId: string;
  /** Raw 60-character player instruction. */
  instruction: string;
  /** Normalized instruction string (lowercase, NFKC, stripped punctuation). */
  normalizedInstruction: string;
  /** Micro-state context passed as compact JSON. */
  microState: ShinkansenMicroState;
  /** Public URL or base64 data URI of the pre-rendered Set-of-Mark view image. */
  somImageUrl?: string;
  /** Bounded list of visible Set-of-Mark tags and descriptions in this view. */
  visibleMarks?: Array<{
    id: number;
    somId: string;
    region: GridCoordinate;
    desc: string;
  }>;
}

/**
 * Schema-constrained JSON response returned by the vision LLM.
 */
export interface LLMDecisionResponse {
  /** The action primitive chosen by the model. */
  action: AgentActionType;
  /** Numeric ID of the Set-of-Mark mark targeted, or null if CONFUSED. */
  target_id: number | null;
  /** Text to type if action is TYPE, otherwise null. */
  text_value: string | null;
  /** Scroll direction if action is SCROLL, otherwise null. */
  scroll_direction: 'up' | 'down' | null;
  /**
   * Explanation under 80 characters shown as a pinned field note on the cursor.
   */
  thought: string;
  /** True if response was served from the edge key-value cache. */
  cached?: boolean;
}
