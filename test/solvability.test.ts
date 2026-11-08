import { describe, it, expect } from 'vitest';
import { reduceShinkansenMicroState } from '../src/engine/game_reducer';
import { calculateScoreReport } from '../src/engine/scoring';
import {
  CASE_001_INITIAL_MICRO_STATE,
  CASE_001_EXHIBITS,
} from '../src/data/puzzles/case_001';
import type { AgentAction, ShinkansenMicroState } from '../src/types/engine';

function serializeMicroState(s: ShinkansenMicroState): string {
  return JSON.stringify([
    s.macroViewId,
    s.selectedRoute,
    s.departureTime,
    s.passengerName ?? '',
    s.seatClass,
    s.trainName,
    s.fare,
    s.greenCarSelected,
    s.timedWindowHit,
    (s as unknown as { signatureSigned?: boolean }).signatureSigned ?? false,
    s.signatureStroke ?? '',
    s.insuranceTrapHit,
    s.insuranceCheckboxChecked,
    s.finalConfirmed,
  ]);
}

function candidateActionsForPage(macroViewId: string): AgentAction[] {
  const candidates: AgentAction[] = [];
  const idsByPage: Record<string, number[]> = {
    'MV-01': [1, 2, 3, 4, 11, 12],
    'MV-02': [17, 14, 11, 12],
    'MV-03': [21, 22, 23, 24, 25, 28, 29, 30, 14, 11, 12],
    'MV-04': [27, 28, 29, 30, 14, 11, 12],
    'MV-10': [14, 11, 12],
    'MV-11': [14, 11, 12],
    'MV-12': [14, 11, 12],
  };
  const ids = idsByPage[macroViewId] ?? [];
  for (const id of ids) {
    const targetId = `#${id}`;
    candidates.push({ action: 'CLICK', targetId, thought: 'bfs click' });
    if (id === 17) {
      candidates.push({ action: 'TYPE', targetId, textValue: 'TANAKA', thought: 'bfs type TANAKA' });
      candidates.push({ action: 'TYPE', targetId, textValue: 'X', thought: 'bfs type X' });
    }
    if (id === 27) {
      candidates.push({ action: 'DRAW', targetId, textValue: 'SHAPE:signature', thought: 'bfs draw' });
    }
  }
  return candidates;
}

describe('Item 3: Solvability BFS', () => {
  it('★ requires a minimum of 5 actions (matching answerKey.length) to reach closeness 100', () => {
    const startState: ShinkansenMicroState = { ...CASE_001_INITIAL_MICRO_STATE };
    const visited = new Set<string>([serializeMicroState(startState)]);
    const queue: Array<{ state: ShinkansenMicroState; depth: number }> = [
      { state: startState, depth: 0 },
    ];

    let minStepsTo100: number | null = null;

    while (queue.length > 0) {
      const { state, depth } = queue.shift()!;
      const report = calculateScoreReport(CASE_001_EXHIBITS, state, depth);
      if (report.closenessScore === 100) {
        minStepsTo100 = depth;
        break;
      }
      if (depth >= 6) continue;

      for (const action of candidateActionsForPage(state.macroViewId)) {
        const { nextState, nextMacroViewId } = reduceShinkansenMicroState(state, action);
        const transitioned: ShinkansenMicroState = {
          ...nextState,
          macroViewId: nextMacroViewId,
        };
        const key = serializeMicroState(transitioned);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: transitioned, depth: depth + 1 });
        }
      }
    }

    expect(minStepsTo100).toBe(5);
  });
});
