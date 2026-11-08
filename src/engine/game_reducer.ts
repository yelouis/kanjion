/**
 * src/engine/game_reducer.ts
 *
 * Centralized immutable game state reducer for Kanjion.
 * Manages typewriter input, telegram lines, agent action execution via the generic
 * puzzle engine, stage error shake triggers, and case closure lifecycles.
 */

import { AgentAction } from '../types/engine';
import { GameState, TelegramLine, AgentCursorState, ScoreReport } from '../types/game';
import { ExhibitDefinition } from '../types/puzzle';
import { ExhibitDef, FieldValue, PuzzleData, PuzzleState } from '../types/puzzle_data';
import { CASE_001_PUZZLE } from '../data/puzzles/case_001/puzzle';
import { applyDecision, createInitialPuzzleState } from './puzzle_engine';
import { calculateScoreReport } from './scoring';

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
        exhibits?: Array<ExhibitDef | ExhibitDefinition>;
        puzzle?: PuzzleData;
      };
    }
  | {
      type: 'CLOSE_CASE';
      payload?: {
        exhibits?: Array<ExhibitDef | ExhibitDefinition>;
        puzzle?: PuzzleData;
      };
    }
  | { type: 'START_PRACTICE' }
  | { type: 'CLEAR_STAGE_SHAKE' }
  | {
      type: 'RESET_GAME';
      payload?: {
        caseNumber?: string;
        initialMicroState?: Record<string, FieldValue>;
        initialPuzzleState?: PuzzleState;
        puzzle?: PuzzleData;
      };
    };

/**
 * Creates canonical initial GameState for a puzzle (default: Case File #001).
 */
export function createInitialGameState(options?: {
  caseNumber?: string;
  initialMicroState?: Record<string, FieldValue>;
  initialPuzzleState?: PuzzleState;
  puzzle?: PuzzleData;
  mode?: 'official' | 'practice';
  officialResult?: ScoreReport | null;
}): GameState {
  const puzzle = options?.puzzle ?? CASE_001_PUZZLE;
  const caseNumber = options?.caseNumber ?? puzzle.caseNumber ?? '#001';
  const mode = options?.mode ?? 'official';
  const officialResult = options?.officialResult ?? null;

  const basePuzzleState = options?.initialPuzzleState
    ? {
        pageId: options.initialPuzzleState.pageId,
        previousPageId: options.initialPuzzleState.previousPageId,
        fields: { ...options.initialPuzzleState.fields },
      }
    : createInitialPuzzleState(puzzle);

  if (options?.initialMicroState) {
    const { macroViewId, ...restFields } = options.initialMicroState;
    if (typeof macroViewId === 'string' && macroViewId.length > 0) {
      basePuzzleState.pageId = macroViewId;
    }
    basePuzzleState.fields = {
      ...basePuzzleState.fields,
      ...restFields,
    };
  }

  const telegrams: TelegramLine[] = Array.from({ length: 6 }, (_, i) => ({
    lineNumber: i + 1,
    text: '',
    submitted: false,
    exhibitRedactedStatus: 'SEALED' as const,
  }));

  return {
    caseNumber,
    mode,
    officialResult,
    caseStatus: 'active',
    activeLineIndex: 0,
    telegrams,
    currentInput: '',
    macroViewId: basePuzzleState.pageId,
    puzzleState: basePuzzleState,
    microState: basePuzzleState.fields,
    agentCursor: {
      xPercent: 65,
      yPercent: 55,
      thought: '📌 FIELD AGENT: Awaiting Telegram 01...',
      variant: 'idle',
      isShaking: false,
    },
    stageShake: false,
    isExecuting: false,
    scoreReport: null,
  };
}

/**
 * Central state machine reducer for Kanjion.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_INPUT': {
      if (state.caseStatus === 'closed' || state.isExecuting) {
        return state;
      }
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
      const puzzle = action.payload.puzzle ?? CASE_001_PUZZLE;
      const exhibits = action.payload.exhibits ?? puzzle.exhibits;
      const activeIdx = state.activeLineIndex;

      if (activeIdx < 0 || activeIdx >= 6) {
        return state;
      }

      const rawId = agentAction.targetId ? agentAction.targetId.replace(/^#/, '') : '';
      const mark = rawId ? parseInt(rawId, 10) : null;

      const { next: nextPuzzleState, summary, shake } = applyDecision(puzzle, state.puzzleState, {
        action: agentAction.action,
        pageId: state.puzzleState.pageId,
        mark: Number.isNaN(mark as number) ? null : mark,
        text: agentAction.textValue,
        stroke: agentAction.textValue,
        thought: agentAction.thought,
      });

      const xPercent = agentAction.targetCoordinate
        ? Number(((agentAction.targetCoordinate.x / 1024) * 100).toFixed(2))
        : state.agentCursor.xPercent;
      const yPercent = agentAction.targetCoordinate
        ? Number(((agentAction.targetCoordinate.y / 768) * 100).toFixed(2))
        : state.agentCursor.yPercent;

      const thoughtText = (agentAction.thought || summary).slice(0, 80);

      let cursorVariant: AgentCursorState['variant'] = 'executing';
      if (agentAction.action === 'CONFUSED' || agentAction.action === 'NOOP') {
        cursorVariant = 'confused';
      } else if (shake || agentAction.isTrap) {
        cursorVariant = 'trap';
      } else if (agentAction.targetId === '#30' || agentAction.targetId === '30') {
        cursorVariant = 'confirmed';
      }

      const updatedCursor: AgentCursorState = {
        xPercent,
        yPercent,
        thought: thoughtText,
        variant: cursorVariant,
        isShaking: shake || Boolean(agentAction.isTrap) || agentAction.action === 'NOOP',
      };

      const instructionText = (
        instruction ??
        state.currentInput ??
        state.telegrams[activeIdx]?.text ??
        ''
      ).trim();

      const finalSummary = agentAction.cloudFailed
        ? `${summary} (backup agent)`
        : summary;

      const updatedTelegrams: TelegramLine[] = state.telegrams.map((tel, idx) => {
        if (idx === activeIdx) {
          return {
            ...tel,
            text: instructionText,
            submitted: true,
            timestamp: new Date().toISOString(),
            actionSummary: finalSummary,
            exhibitRedactedStatus: 'SEALED',
            agentAction,
          };
        }
        return tel;
      });

      const isFinalLine = activeIdx === 5;
      const nextActiveIndex = isFinalLine ? 5 : activeIdx + 1;

      let nextCaseStatus: 'active' | 'closed' = state.caseStatus;
      let scoreReport: ScoreReport | null = state.scoreReport;
      let officialResult: ScoreReport | null = state.officialResult;

      if (isFinalLine) {
        nextCaseStatus = 'closed';
        scoreReport = calculateScoreReport(exhibits, nextPuzzleState, 6, state.caseNumber);
        if (state.mode === 'official' && state.officialResult === null) {
          officialResult = scoreReport;
        }
      }

      return {
        ...state,
        caseStatus: nextCaseStatus,
        activeLineIndex: nextActiveIndex,
        telegrams: updatedTelegrams,
        currentInput: '',
        macroViewId: nextPuzzleState.pageId,
        puzzleState: nextPuzzleState,
        microState: nextPuzzleState.fields,
        agentCursor: updatedCursor,
        stageShake: shake || Boolean(agentAction.isTrap),
        isExecuting: false,
        scoreReport,
        officialResult,
      };
    }

    case 'CLOSE_CASE': {
      if (state.caseStatus === 'closed') {
        return state;
      }

      const puzzle = action.payload?.puzzle ?? CASE_001_PUZZLE;
      const exhibits = action.payload?.exhibits ?? puzzle.exhibits;
      const linesUsed = state.telegrams.filter((t) => t.submitted).length;
      const scoreReport = calculateScoreReport(
        exhibits,
        state.puzzleState,
        linesUsed,
        state.caseNumber
      );
      const officialResult =
        state.mode === 'official' && state.officialResult === null
          ? scoreReport
          : state.officialResult;

      return {
        ...state,
        caseStatus: 'closed',
        isExecuting: false,
        scoreReport,
        officialResult,
      };
    }

    case 'START_PRACTICE': {
      return createInitialGameState({
        caseNumber: state.caseNumber,
        mode: 'practice',
        officialResult: state.officialResult,
      });
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
