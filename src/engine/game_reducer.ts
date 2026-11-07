/**
 * src/engine/game_reducer.ts
 *
 * Centralized immutable game state reducer for Instruct.
 * Manages typewriter input, telegram lines, agent action execution,
 * micro-state mutations for Case File #042, agent cursor glide kinematics,
 * stage error shake triggers, and case closure lifecycles.
 */

import { AgentAction, ShinkansenMicroState } from '../types/engine';
import { GameState, TelegramLine, AgentCursorState, ScoreReport } from '../types/game';
import { ExhibitDefinition } from '../types/puzzle';
import {
  CASE_042_INITIAL_MICRO_STATE,
  CASE_042_EXHIBITS,
  CASE_042_MV03_ELEMENTS,
} from '../data/puzzles/case_042';
import { calculateScoreReport } from './scoring';
import { gridToCenter } from '../utils/coordinate_projector';

/**
 * Union of all dispatchable actions accepted by gameReducer.
 */
export type GameAction =
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'START_EXECUTION'; payload?: { instruction?: string } }
  | {
      type: 'APPLY_AGENT_ACTION';
      payload: {
        action: AgentAction;
        instruction?: string;
        exhibits?: ExhibitDefinition[];
      };
    }
  | { type: 'CLOSE_CASE'; payload?: { exhibits?: ExhibitDefinition[] } }
  | { type: 'REOPEN_CASE' }
  | { type: 'TOGGLE_GHOST_REPLAY' }
  | { type: 'TOGGLE_SOM_OVERLAY' }
  | { type: 'CLEAR_STAGE_SHAKE' }
  | {
      type: 'RESET_GAME';
      payload?: {
        caseNumber?: string;
        preSeeded?: boolean;
        initialMicroState?: ShinkansenMicroState;
      };
    };

/**
 * Evaluates the micro-state mutation resulting from an agent action on Case File #042.
 */
export function reduceShinkansenMicroState(
  state: ShinkansenMicroState,
  action: AgentAction
): {
  nextState: ShinkansenMicroState;
  summary: string;
  isTrap: boolean;
  stageShake: boolean;
  nextMacroViewId: string;
} {
  const nextState: ShinkansenMicroState = {
    ...state,
    passengerCount: state.passengerCount ? { ...state.passengerCount } : { adults: 1, children: 0 },
    stepHistory: state.stepHistory ? [...state.stepHistory] : [],
  };

  let summary = 'Agent executed action';
  let isTrap = false;
  let stageShake = false;
  let nextMacroViewId = state.macroViewId;

  if (action.action === 'CONFUSED' || !action.targetId) {
    summary = action.thought || 'Agent was confused; no target identified';
    return { nextState, summary, isTrap: false, stageShake: false, nextMacroViewId };
  }

  // Parse numeric SoM ID
  const rawId = action.targetId.replace(/^#/, '');
  const numId = parseInt(rawId, 10);

  switch (numId) {
    case 1: // Tokaido-Sanyo Shinkansen Route (Page 1 -> Page 2, Exhibit A)
      nextState.selectedRoute = 'tokyo_osaka';
      nextMacroViewId = 'MV-02';
      summary = 'Agent clicked [東海道新幹線 東京⇒新大阪]';
      break;

    case 2: // Tohoku Shinkansen Wrong Route (Page 1 -> Page 10)
      nextState.selectedRoute = 'tohoku_hayabusa';
      nextMacroViewId = 'MV-10';
      summary = 'Agent clicked [東北・北海道新幹線]';
      break;

    case 17: // Passenger Name Input Field (Page 2 -> Page 3, Exhibit B TYPE Task)
      nextState.passengerName = (action.textValue || 'TANAKA').toUpperCase();
      nextState.departureTime = '14:30';
      nextMacroViewId = 'MV-03';
      summary = `Agent typed [${nextState.passengerName}] into [搭乗者名]`;
      break;

    case 25: // Green Car Nozomi 24 (Page 3 -> Page 4, Exhibit C Timed Flash Seat)
      nextState.trainName = 'Nozomi 24';
      nextState.seatClass = 'green_car';
      nextState.fare = 13870;
      nextState.greenCarSelected = true;
      nextState.timedWindowHit = true;
      summary = 'Agent clicked [🍀 ◯ ¥13,870]';
      break;

    case 27: // Digital Signature Authorization Pad (Page 4, Exhibit D DRAW Task)
      nextState.signatureSigned = true;
      nextState.signatureStroke = action.textValue || 'T. Tanaka';
      summary = 'Agent signed [自署・サイン欄]';
      break;

    case 12: // Red Promo Insurance Banner (Decoy Trap Contamination)
      nextState.insuranceTrapHit = true;
      nextState.insuranceCheckboxChecked = true;
      isTrap = true;
      stageShake = true;
      summary = 'Agent clicked [今すぐ申し込む]';
      break;

    case 28: // Insurance Checkbox Toggle
      nextState.insuranceCheckboxChecked = !state.insuranceCheckboxChecked;
      // If checked, it contaminates Exhibit D
      nextState.insuranceTrapHit = nextState.insuranceCheckboxChecked || state.insuranceTrapHit;
      summary = nextState.insuranceCheckboxChecked
        ? 'Agent checked [旅行キャンセル保険を追加]'
        : 'Agent unchecked [旅行キャンセル保険を追加]';
      break;

    case 30: // Blue Confirmation Button (Target Exhibit E)
      nextState.finalConfirmed = true;
      nextMacroViewId = 'MV-05';
      summary = 'Agent clicked [予約内容を確認・確定へ ▶]';
      break;

    case 21: // Hikari Non-reserved
      nextState.trainName = 'Hikari 515';
      nextState.seatClass = 'ordinary_free';
      nextState.fare = 13870;
      nextState.greenCarSelected = false;
      summary = 'Agent clicked [◯ ¥13,870 (ひかり自由席)]';
      break;

    case 22: // Hikari Reserved
      nextState.trainName = 'Hikari 515';
      nextState.seatClass = 'ordinary_reserved';
      nextState.fare = 14520;
      nextState.greenCarSelected = false;
      summary = 'Agent clicked [△ ¥14,520 (ひかり指定席)]';
      break;

    case 23: // Nozomi Non-reserved
      nextState.trainName = 'Nozomi 24';
      nextState.seatClass = 'ordinary_free';
      nextState.fare = 13870;
      nextState.greenCarSelected = false;
      summary = 'Agent clicked [◯ ¥13,870 (のぞみ自由席)]';
      break;

    case 24: // Nozomi Reserved
      nextState.trainName = 'Nozomi 24';
      nextState.seatClass = 'ordinary_reserved';
      nextState.fare = 14720;
      nextState.greenCarSelected = false;
      summary = 'Agent clicked [◯ ¥14,720 (のぞみ指定席)]';
      break;

    case 14: // Back to Search Conditions / Previous Page
      if (state.selectedRoute === 'tohoku_hayabusa' || state.macroViewId === 'MV-10') {
        nextState.selectedRoute = 'none';
        nextMacroViewId = 'MV-01';
      } else {
        nextMacroViewId = 'MV-02';
      }
      summary = 'Agent clicked [◀ 条件変更へ戻る]';
      break;

    case 29: // Cancel Booking Modal
      nextState.activeModal = 'cancel';
      summary = 'Agent clicked [予約を取消]';
      break;

    case 11: // Red Logout Button (Decoy Trap)
      nextState.activeModal = 'logout';
      isTrap = true;
      stageShake = true;
      summary = 'Agent clicked [ログアウト]';
      break;

    default:
      summary = `Agent clicked element #${numId}`;
      break;
  }

  // Update audit log
  nextState.stepHistory = [
    ...(nextState.stepHistory || []),
    {
      lineIndex: (nextState.stepHistory?.length || 0) + 1,
      instruction: action.thought,
      actionType: action.action,
      targetId: action.targetId,
      fieldNote: action.thought,
    },
  ];

  return { nextState, summary, isTrap, stageShake, nextMacroViewId };
}

/**
 * Calculates cursor percentage coordinates (0–100%) for a given AgentAction.
 */
function resolveCursorPosition(
  action: AgentAction,
  currentCursor: AgentCursorState
): { xPercent: number; yPercent: number } {
  if (action.targetCoordinate) {
    return {
      xPercent: Number(((action.targetCoordinate.x / 1024) * 100).toFixed(2)),
      yPercent: Number(((action.targetCoordinate.y / 768) * 100).toFixed(2)),
    };
  }

  if (action.targetId) {
    const rawId = parseInt(action.targetId.replace(/^#/, ''), 10);
    const element = CASE_042_MV03_ELEMENTS.find((e) => e.id === rawId);
    if (element) {
      const cx = element.boundingBox.x + element.boundingBox.width / 2;
      const cy = element.boundingBox.y + element.boundingBox.height / 2;
      return {
        xPercent: Number(((cx / 1024) * 100).toFixed(2)),
        yPercent: Number(((cy / 768) * 100).toFixed(2)),
      };
    }
  }

  if (action.gridRef) {
    const pt = gridToCenter(action.gridRef);
    return {
      xPercent: Number(((pt.x / 1024) * 100).toFixed(2)),
      yPercent: Number(((pt.y / 768) * 100).toFixed(2)),
    };
  }

  return { xPercent: currentCursor.xPercent, yPercent: currentCursor.yPercent };
}

/**
 * Creates canonical initial GameState for Case File #042.
 */
export function createInitialGameState(options?: {
  caseNumber?: string;
  preSeeded?: boolean;
  initialMicroState?: ShinkansenMicroState;
}): GameState {
  const caseNumber = options?.caseNumber ?? '#042';
  const preSeeded = options?.preSeeded ?? true;
  const microState = options?.initialMicroState
    ? { ...options.initialMicroState }
    : { ...CASE_042_INITIAL_MICRO_STATE };

  let telegrams: TelegramLine[];
  let activeLineIndex: number;
  let currentInput: string;
  let cursorThought: string;

  if (preSeeded) {
    telegrams = [
      {
        lineNumber: 1,
        text: 'select tokyo to shin-osaka tab',
        submitted: true,
        actionSummary: 'Agent clicked [東海道新幹線 東京⇒新大阪]',
        exhibitRedactedStatus: 'SEALED',
      },
      {
        lineNumber: 2,
        text: 'set departure dropdown to 14:30',
        submitted: true,
        actionSummary: 'Agent selected [14:30発]',
        exhibitRedactedStatus: 'SEALED',
      },
      {
        lineNumber: 3,
        text: '',
        submitted: false,
        exhibitRedactedStatus: 'SEALED',
      },
      {
        lineNumber: 4,
        text: '',
        submitted: false,
        exhibitRedactedStatus: 'SEALED',
      },
      {
        lineNumber: 5,
        text: '',
        submitted: false,
        exhibitRedactedStatus: 'SEALED',
      },
      {
        lineNumber: 6,
        text: '',
        submitted: false,
        exhibitRedactedStatus: 'SEALED',
      },
    ];
    activeLineIndex = 2; // Line 03 is active
    currentInput = 'click green clover 13870 button in 2nd row';
    cursorThought = '📌 FIELD AGENT: Awaiting Telegram 03...';
  } else {
    telegrams = Array.from({ length: 6 }, (_, i) => ({
      lineNumber: i + 1,
      text: '',
      submitted: false,
      exhibitRedactedStatus: 'SEALED' as const,
    }));
    activeLineIndex = 0;
    currentInput = '';
    cursorThought = '📌 FIELD AGENT: Awaiting Telegram 01...';
  }

  return {
    caseNumber,
    caseStatus: 'active',
    activeLineIndex,
    telegrams,
    currentInput,
    macroViewId: microState.macroViewId || 'MV-03',
    microState,
    agentCursor: {
      xPercent: 65,
      yPercent: 55,
      thought: cursorThought,
      variant: 'idle',
      isShaking: false,
    },
    ghostReplayActive: false,
    somOverlayActive: false,
    stageShake: false,
    isExecuting: false,
    scoreReport: null,
  };
}

/**
 * Central state machine reducer for Instruct.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_INPUT': {
      // Do not allow typing if case is closed or execution in flight
      if (state.caseStatus === 'closed' || state.isExecuting) {
        return state;
      }
      // Strictly enforce 60-character limit
      return {
        ...state,
        currentInput: action.payload.slice(0, 60),
      };
    }

    case 'START_EXECUTION': {
      if (state.caseStatus === 'closed' || state.isExecuting) {
        return state;
      }
      return {
        ...state,
        isExecuting: true,
      };
    }

    case 'APPLY_AGENT_ACTION': {
      if (state.caseStatus === 'closed') {
        return state;
      }

      const { action: agentAction, instruction } = action.payload;
      const exhibits = action.payload.exhibits ?? CASE_042_EXHIBITS;
      const activeIdx = state.activeLineIndex;

      // Disallow out-of-bounds dispatch
      if (activeIdx < 0 || activeIdx >= 6) {
        return state;
      }

      // 1. Mutate micro-state
      const { nextState, summary, isTrap, stageShake, nextMacroViewId } = reduceShinkansenMicroState(
        state.microState,
        agentAction
      );

      // 2. Resolve cursor position and note
      const { xPercent, yPercent } = resolveCursorPosition(agentAction, state.agentCursor);
      const thoughtText = (agentAction.thought || summary).slice(0, 80);

      let cursorVariant: AgentCursorState['variant'] = 'executing';
      if (agentAction.action === 'CONFUSED') {
        cursorVariant = 'confused';
      } else if (isTrap || agentAction.isTrap) {
        cursorVariant = 'trap';
      } else if (agentAction.targetId === '#30' || agentAction.targetId === '30') {
        cursorVariant = 'confirmed';
      }

      const updatedCursor: AgentCursorState = {
        xPercent,
        yPercent,
        thought: thoughtText,
        variant: cursorVariant,
        isShaking: isTrap || stageShake,
      };

      // 3. Update telegram row in ledger (keep exhibit status SEALED during active play)
      const instructionText = (
        instruction ??
        state.currentInput ??
        state.telegrams[activeIdx]?.text ??
        ''
      ).trim();

      const updatedTelegrams: TelegramLine[] = state.telegrams.map((tel, idx) => {
        if (idx === activeIdx) {
          return {
            ...tel,
            text: instructionText,
            submitted: true,
            timestamp: new Date().toISOString(),
            actionSummary: summary,
            exhibitRedactedStatus: 'SEALED',
            agentAction,
          };
        }
        return tel;
      });

      // 4. Check whether this was the final line (Line 06 auto-closure)
      const isFinalLine = activeIdx === 5;
      const nextActiveIndex = isFinalLine ? 5 : activeIdx + 1;

      let nextCaseStatus: 'active' | 'closed' = state.caseStatus;
      let scoreReport: ScoreReport | null = state.scoreReport;

      if (isFinalLine) {
        nextCaseStatus = 'closed';
        scoreReport = calculateScoreReport(exhibits, nextState, 6, state.caseNumber);
      }

      return {
        ...state,
        caseStatus: nextCaseStatus,
        activeLineIndex: nextActiveIndex,
        telegrams: updatedTelegrams,
        currentInput: '',
        macroViewId: nextMacroViewId,
        microState: nextState,
        agentCursor: updatedCursor,
        stageShake: isTrap || stageShake,
        isExecuting: false,
        scoreReport,
      };
    }

    case 'CLOSE_CASE': {
      if (state.caseStatus === 'closed') {
        return state;
      }

      const exhibits = action.payload?.exhibits ?? CASE_042_EXHIBITS;
      const linesUsed = state.telegrams.filter((t) => t.submitted).length;
      const scoreReport = calculateScoreReport(exhibits, state.microState, linesUsed, state.caseNumber);

      return {
        ...state,
        caseStatus: 'closed',
        isExecuting: false,
        scoreReport,
      };
    }

    case 'REOPEN_CASE': {
      if (state.caseStatus === 'active') {
        return state;
      }
      return {
        ...state,
        caseStatus: 'active',
        scoreReport: null,
      };
    }

    case 'TOGGLE_GHOST_REPLAY': {
      return {
        ...state,
        ghostReplayActive: !state.ghostReplayActive,
      };
    }

    case 'TOGGLE_SOM_OVERLAY': {
      return {
        ...state,
        somOverlayActive: !state.somOverlayActive,
      };
    }

    case 'CLEAR_STAGE_SHAKE': {
      return {
        ...state,
        stageShake: false,
        agentCursor: {
          ...state.agentCursor,
          isShaking: false,
        },
      };
    }

    case 'RESET_GAME': {
      return createInitialGameState(action.payload);
    }

    default:
      return state;
  }
}
