import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SCHEDULE,
  PUZZLES,
  todaysPuzzle,
  formatNextCaseStatus,
  formatCoverDateHeader,
  type ScheduleEntry,
} from '../src/data/schedule';
import { NewspaperFrontCover } from '../src/components/NewspaperFrontCover';
import { ExhibitsPanel } from '../src/components/ExhibitsPanel';
import { loadPersistedState, savePersistedState } from '../src/App';
import { CASE_001_PUZZLE } from '../src/data/puzzles/case_001';
import { calculateScoreReport } from '../src/engine/scoring';
import { initialPuzzleState } from '../src/engine/puzzle_engine';
import { createInitialGameState } from '../src/engine/game_reducer';
import type { PuzzleData } from '../src/types/puzzle_data';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

const MINI_PUZZLE: PuzzleData = {
  ...CASE_001_PUZZLE,
  id: 'mini',
  caseNumber: '#002',
  title: 'Mini Shinkansen Test',
};

describe('Item 12 (§14): Daily schedule (F-15; D-6 = A)', () => {
  const testSchedule: ReadonlyArray<ScheduleEntry> = [
    { date: '2026-11-05', puzzleId: '001' },
    { date: '2026-11-07', puzzleId: 'mini' },
  ];

  const testRegistry: Record<string, PuzzleData> = {
    ...PUZZLES,
    mini: MINI_PUZZLE,
  };

  it('★ exports exact default SCHEDULE [{ date: "2026-11-05", puzzleId: "001" }]', () => {
    expect(SCHEDULE).toEqual([{ date: '2026-11-05', puzzleId: '001' }]);
  });

  it('★ at 23:59:59 local on Nov 6 -> 001; at 00:00:00 local on Nov 7 -> mini', () => {
    const nov6Late = new Date(2026, 10, 6, 23, 59, 59);
    const nov7Midnight = new Date(2026, 10, 7, 0, 0, 0);

    const p1 = todaysPuzzle(nov6Late, testSchedule, testRegistry);
    expect(p1.id).toBe('001');

    const p2 = todaysPuzzle(nov7Midnight, testSchedule, testRegistry);
    expect(p2.id).toBe('mini');
  });

  it('★ a stored official result for 001 does not change what mini shows', () => {
    const storage = createMemoryStorage();
    const report001 = calculateScoreReport(
      CASE_001_PUZZLE.exhibits,
      initialPuzzleState(CASE_001_PUZZLE),
      6,
      '#001'
    );

    const closedState001 = {
      ...createInitialGameState({ caseNumber: '#001', puzzle: CASE_001_PUZZLE }),
      caseStatus: 'closed' as const,
      scoreReport: report001,
      officialResult: report001,
    };

    savePersistedState(storage, closedState001, '001');

    const loaded001 = loadPersistedState(storage, CASE_001_PUZZLE);
    const loadedMini = loadPersistedState(storage, MINI_PUZZLE);

    expect(loaded001?.officialResult?.finalScore).toBe(report001.finalScore);
    expect(loadedMini).toBeNull();
  });

  it('★ at 23:59:58 local with a later schedule entry, countdown reads "Next case in 00:00:02", and "Next case: coming soon" when none exists', () => {
    const nov6At235958 = new Date(2026, 10, 6, 23, 59, 58);
    expect(formatNextCaseStatus(nov6At235958, testSchedule)).toBe('Next case in 00:00:02');

    // On Nov 7 (last entry in testSchedule), no later entry exists
    const nov7At120000 = new Date(2026, 10, 7, 12, 0, 0);
    expect(formatNextCaseStatus(nov7At120000, testSchedule)).toBe('Next case: coming soon');
  });

  it('cover shows CASE FILE #{caseNumber} • {date} and report footer shows countdown status', () => {
    const satNov7 = new Date(2026, 10, 7, 12, 0, 0);
    expect(formatCoverDateHeader('#001', satNov7)).toBe('CASE FILE #001 • Saturday, November 7');

    render(
      React.createElement(NewspaperFrontCover, {
        caseNumber: '#001',
        now: satNov7,
        onOpenNewspaper: () => {},
      })
    );
    expect(screen.getByText(/CASE FILE #001 • Saturday, November 7/i)).toBeInTheDocument();

    const report = calculateScoreReport(
      CASE_001_PUZZLE.exhibits,
      initialPuzzleState(CASE_001_PUZZLE),
      5,
      '#001'
    );
    render(
      React.createElement(ExhibitsPanel, {
        caseClosed: true,
        scoreReport: report,
        officialResult: report,
        caseNumber: '#001',
        now: new Date(2026, 10, 6, 23, 59, 58),
        schedule: testSchedule,
      })
    );
    expect(screen.getByText('Next case in 00:00:02')).toBeInTheDocument();
  });
});
