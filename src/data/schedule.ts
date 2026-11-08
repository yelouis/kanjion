import type { PuzzleData } from '../types/puzzle_data';
import { CASE_001_PUZZLE } from './puzzles/case_001';

export interface ScheduleEntry {
  date: string;
  puzzleId: string;
}

export const SCHEDULE: ReadonlyArray<{ date: string; puzzleId: string }> = [
  { date: '2026-11-05', puzzleId: '001' },
];

export const PUZZLES: Record<string, PuzzleData> = {
  '001': CASE_001_PUZZLE,
};

export function toLocalDateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todaysPuzzle(
  now: Date = new Date(),
  schedule: ReadonlyArray<{ date: string; puzzleId: string }> = SCHEDULE,
  registry: Record<string, PuzzleData> = PUZZLES
): PuzzleData {
  const localKey = toLocalDateKey(now);
  let chosenId = schedule[0]?.puzzleId ?? '001';
  for (const entry of schedule) {
    if (entry.date <= localKey) {
      chosenId = entry.puzzleId;
    }
  }
  return registry[chosenId] ?? CASE_001_PUZZLE;
}

export function hasLaterScheduleEntry(
  now: Date = new Date(),
  schedule: ReadonlyArray<{ date: string; puzzleId: string }> = SCHEDULE
): boolean {
  const localKey = toLocalDateKey(now);
  return schedule.some((entry) => entry.date > localKey);
}

export function formatNextCaseStatus(
  now: Date = new Date(),
  schedule: ReadonlyArray<{ date: string; puzzleId: string }> = SCHEDULE
): string {
  if (!hasLaterScheduleEntry(now, schedule)) {
    return 'Next case: coming soon';
  }

  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSeconds = Math.ceil(diffMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `Next case in ${hours}:${minutes}:${seconds}`;
}

export function formatCoverDateHeader(
  caseNumber: string,
  now: Date = new Date()
): string {
  const formattedCase = caseNumber.startsWith('#') ? caseNumber : `#${caseNumber}`;
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return `CASE FILE ${formattedCase} • ${dateStr}`;
}
