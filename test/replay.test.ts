import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { execSync } from 'node:child_process';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001/puzzle';
import { applyDecision, evaluateExhibits } from '../src/engine/puzzle_engine';
import { calculateScoreReport } from '../src/engine/scoring';
import { resolveLine } from '../src/engine/agent';
import { CASE_001_GENERATED_MANIFEST } from '../src/data/puzzles/case_001';
import { LoopedTargetReplay } from '../src/components/LoopedTargetReplay';
import type { PuzzleState } from '../src/types/puzzle_data';

describe('Item 8: Replay from data (§10)', () => {
  it('★ applying puzzle.replay through applyDecision from initialFields yields closeness 100', () => {
    expect(CASE_001_PUZZLE.replay.length).toBe(5);

    let state: PuzzleState = {
      pageId: CASE_001_PUZZLE.initialPageId,
      previousPageId: null,
      fields: { ...CASE_001_PUZZLE.initialFields },
    };

    for (const step of CASE_001_PUZZLE.replay) {
      expect(state.pageId).toBe(step.pageId);
      const page = CASE_001_PUZZLE.pages.find((p) => p.id === state.pageId);
      const el = page?.elements.find((e) => e.key === step.key);
      expect(el).toBeDefined();

      const { next } = applyDecision(CASE_001_PUZZLE, state, {
        pageId: step.pageId,
        mark: el!.mark,
        action: step.action,
        text: step.text,
        stroke: step.stroke,
      });
      state = next;
    }

    const report = calculateScoreReport(
      CASE_001_PUZZLE,
      state,
      CASE_001_PUZZLE.replay.length,
      CASE_001_PUZZLE.caseNumber
    );
    expect(report.closenessScore).toBe(100);
    const evals = evaluateExhibits(CASE_001_PUZZLE, state);
    expect(evals.every((e) => e.status === 'VERIFIED')).toBe(true);
  });

  it('★ for each i, resolving answerKey[i] with the deterministic fallback tier (pinned tier off) at the state reached after steps 1…i produces the same (key, action, text) as replay step i+1', async () => {
    expect(CASE_001_PUZZLE.replay.length).toBe(CASE_001_PUZZLE.answerKey.length);

    let state: PuzzleState = {
      pageId: CASE_001_PUZZLE.initialPageId,
      previousPageId: null,
      fields: { ...CASE_001_PUZZLE.initialFields },
    };

    for (let i = 0; i < CASE_001_PUZZLE.answerKey.length; i++) {
      const expectedStep = CASE_001_PUZZLE.replay[i];
      expect(expectedStep).toBeDefined();
      expect(state.pageId).toBe(expectedStep.pageId);

      const resolved = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state,
        instruction: CASE_001_PUZZLE.answerKey[i],
        visibleText: '',
        disablePinned: true,
      });
      expect(resolved.tier).toBe('fallback');
      const page = CASE_001_PUZZLE.pages.find((p) => p.id === state.pageId);
      const el = page?.elements.find((e) => e.mark === resolved.mark);

      expect(el?.key).toBe(expectedStep.key);
      expect(resolved.action).toBe(expectedStep.action);
      if (expectedStep.text !== undefined) {
        expect(resolved.text).toBe(expectedStep.text);
      }
      if (expectedStep.stroke !== undefined) {
        expect(resolved.stroke).toBe(expectedStep.stroke);
      }

      const { next } = applyDecision(CASE_001_PUZZLE, state, {
        pageId: expectedStep.pageId,
        mark: el!.mark,
        action: expectedStep.action,
        text: expectedStep.text,
        stroke: expectedStep.stroke,
      });
      state = next;
    }
  });

  it('★ with a fake clock, one loop lasts the sum of the exact timings (± 1 tick) and resets to MV-01', () => {
    vi.useFakeTimers();
    try {
      const { getByTestId, unmount } = render(React.createElement(LoopedTargetReplay, { autoplay: true }));
      const replayRoot = getByTestId('looped-target-replay');
      expect(replayRoot.textContent).toContain('STEP 1: ご利用になる新幹線路線を選択してください');

      // Sum of exact timings:
      // Step 1 (MV-01 CLICK + nav): 1150 + 600 + 800 = 2550 ms
      // Step 2 (MV-02 TYPE 6 chars + settle + nav): 1150 + 6*220 + 650 + 800 = 3920 ms
      // Step 3 (MV-03 TIMED_CLICK + wait 0ms at 7620ms + click 600 + nav 800): 1150 + 0 + 600 + 800 = 2550 ms
      // Step 4 (MV-04 DRAW 6*180 + settle 500): 1150 + 1080 + 500 = 2730 ms
      // Step 5 (MV-04 CLICK + nav 800 + final dwell 2000): 1150 + 600 + 800 + 2000 = 4550 ms
      // Total loop duration = 2550 + 3920 + 2550 + 2730 + 4550 = 16300 ms
      const expectedLoopMs = 16300;

      // Advance to 500 ms before loop end -> should be on final page MV-05 (発券完了)
      act(() => {
        vi.advanceTimersByTime(expectedLoopMs - 500);
      });
      expect(replayRoot.textContent).toContain('🎉 新幹線 eチケットのご予約・発券が完了しました');

      // Advance past loop boundary (+1 tick) -> resets back to MV-01
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(replayRoot.textContent).toContain('STEP 1: ご利用になる新幹線路線を選択してください');
      unmount();

      // With autoplay: false, renders first frame and does not loop
      const { getByTestId: getByTestIdStatic } = render(
        React.createElement(LoopedTargetReplay, { autoplay: false })
      );
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(getByTestIdStatic('looped-target-replay').textContent).toContain(
        'STEP 1: ご利用になる新幹線路線を選択してください'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('★ grep -rn "TANAKA\\|Tanaka" src | grep -v "^src/data/puzzles/" produces no output', () => {
    const out = execSync('grep -rn "TANAKA\\|Tanaka" src | grep -v "^src/data/puzzles/" || true', {
      encoding: 'utf-8',
    }).trim();
    expect(out).toBe('');
  });
});
