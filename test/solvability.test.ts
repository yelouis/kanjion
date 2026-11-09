import { describe, it, expect } from 'vitest';
import {
  applyDecision,
  createInitialPuzzleState,
  elementsOnPage,
  evaluateExhibits,
} from '../src/engine/puzzle_engine';
import { calculateClosenessScore } from '../src/engine/scoring';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import type { ActionKind, PuzzleState } from '../src/types/puzzle_data';

function serializePuzzleState(s: PuzzleState): string {
  const orderedKeys = Object.keys(CASE_001_PUZZLE.initialFields).sort();
  return JSON.stringify([
    s.pageId,
    s.previousPageId,
    ...orderedKeys.map((k) => s.fields[k]),
  ]);
}

function candidateDecisionsForPage(pageId: string): Array<{
  pageId: string;
  mark: number;
  action: ActionKind;
  text?: string;
  stroke?: string;
}> {
  const candidates: Array<{
    pageId: string;
    mark: number;
    action: ActionKind;
    text?: string;
    stroke?: string;
  }> = [];

  for (const el of elementsOnPage(CASE_001_PUZZLE, pageId)) {
    const actions = Object.keys(el.effects) as ActionKind[];
    for (const action of actions) {
      if (action === 'TYPE') {
        candidates.push({ pageId, mark: el.mark, action: 'TYPE', text: 'TANAKA' });
        candidates.push({ pageId, mark: el.mark, action: 'TYPE', text: 'OTHER' });
      } else if (action === 'DRAW') {
        candidates.push({ pageId, mark: el.mark, action: 'DRAW', stroke: 'SHAPE:cat' });
        candidates.push({ pageId, mark: el.mark, action: 'DRAW', stroke: 'SHAPE:signature' });
      } else {
        candidates.push({ pageId, mark: el.mark, action });
      }
    }
  }
  return candidates;
}

describe('Item 3 & Item 6: Solvability BFS from Registry', () => {
  it('★ enumerates actions from puzzle.pages registry and requires a minimum of 5 actions to reach closeness 100', () => {
    const startState = createInitialPuzzleState(CASE_001_PUZZLE);
    const visited = new Set<string>([serializePuzzleState(startState)]);
    const queue: Array<{ state: PuzzleState; depth: number }> = [
      { state: startState, depth: 0 },
    ];

    let minStepsTo100: number | null = null;

    while (queue.length > 0) {
      const { state, depth } = queue.shift()!;
      const evals = evaluateExhibits(CASE_001_PUZZLE, state);
      const closeness = calculateClosenessScore(evals);
      if (closeness === 100) {
        minStepsTo100 = depth;
        break;
      }
      if (depth >= 6) continue;

      for (const decision of candidateDecisionsForPage(state.pageId)) {
        const { next } = applyDecision(CASE_001_PUZZLE, state, decision);
        const key = serializePuzzleState(next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: next, depth: depth + 1 });
        }
      }
    }

    expect(minStepsTo100).toBe(5);
    expect(minStepsTo100).toBe(CASE_001_PUZZLE.answerKey.length);
  });
});
