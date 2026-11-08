/**
 * src/engine/scoring.ts
 *
 * Scoring mathematics engine and declassified exhibit evaluator.
 * Evaluates the 5 target exhibits against the final micro-state,
 * generates tactile rubber ink stamps, computes closeness and efficiency multipliers,
 * and formats shareable forensic clipping scorecards for clipboard export.
 */

import { ExhibitEvaluation, ScoreReport } from '../types/game';
import { ExhibitDefinition } from '../types/puzzle';
import { ExhibitDef, FieldValue, PuzzleData, PuzzleState } from '../types/puzzle_data';
import { evaluateExhibitDef, evaluateExhibits, extractFields } from './puzzle_engine';

/**
 * Maximum telegram lines allowed in the dispatch ledger.
 */
export const MAX_TELEGRAM_LINES = 6;

/**
 * Efficiency bonus rate awarded per unused telegram line (20% = 0.20).
 */
export const EFFICIENCY_BONUS_PER_UNUSED_LINE = 0.2;

/**
 * Evaluates a single exhibit checkpoint against the given state.
 * Assigns tactile rubber stamp rotation angles (-4deg or +3deg).
 */
export function evaluateExhibit(
  exhibit: ExhibitDef | ExhibitDefinition,
  state: PuzzleState | Record<string, FieldValue>,
  index: number = 0
): ExhibitEvaluation {
  if ('verified' in exhibit) {
    return evaluateExhibitDef(exhibit, state, index);
  }
  const fields = extractFields(state);
  const result = exhibit.evaluate(fields);
  const rotationDeg = index % 2 === 0 ? -4 : 3;

  return {
    id: exhibit.id,
    code: exhibit.code,
    title: exhibit.title,
    weight: exhibit.weight,
    status: result.status,
    stampText: result.stampText,
    rotationDeg,
    awardedPoints: result.awardedPoints,
  };
}

/**
 * Evaluates all exhibits against the provided state.
 */
export function evaluateAllExhibits(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  state: PuzzleState | Record<string, FieldValue>
): ExhibitEvaluation[] {
  if (!Array.isArray(puzzleOrExhibits)) {
    return evaluateExhibits(puzzleOrExhibits, state);
  }
  return puzzleOrExhibits.map((exhibit, index) => evaluateExhibit(exhibit, state, index));
}

/**
 * Calculates the total closeness percentage (0 to 100) from evaluated exhibits.
 * Sums the awarded points of all verified or clean exhibits.
 *
 * @param evaluations Array of evaluated exhibit badges.
 */
export function calculateClosenessScore(evaluations: ExhibitEvaluation[]): number {
  const sum = evaluations.reduce((acc, curr) => {
    if (curr.status === 'VERIFIED') {
      return acc + (curr.awardedPoints ?? curr.weight);
    }
    return acc;
  }, 0);

  return Math.min(100, Math.max(0, Math.round(sum)));
}

/**
 * Computes unused lines count and efficiency multiplier based on lines used.
 *
 * Formula:
 * U = max(0, 6 - linesUsed)
 * M = 1.0 + (U * 0.20)
 *
 * @param linesUsed Number of dispatched telegram lines (0 to 6).
 */
export function calculateEfficiencyMultiplier(linesUsed: number): {
  unusedLines: number;
  multiplier: number;
} {
  const clampedLinesUsed = Math.max(0, Math.min(MAX_TELEGRAM_LINES, linesUsed));
  const unusedLines = Math.max(0, MAX_TELEGRAM_LINES - clampedLinesUsed);

  // Multiplier is strictly clamped between 1.0x (all 6 used) and 2.0x (1 or 0 used)
  const rawMultiplier = 1.0 + Math.min(5, unusedLines) * EFFICIENCY_BONUS_PER_UNUSED_LINE;
  const multiplier = Number(rawMultiplier.toFixed(1));

  return {
    unusedLines,
    multiplier,
  };
}

/**
 * Computes final verified score: round(closeness * multiplier), clamped to 0–200 PTS.
 *
 * @param closeness Closeness percentage (0 to 100).
 * @param multiplier Efficiency multiplier (1.0 to 2.0).
 */
export function calculateFinalScore(closeness: number, multiplier: number): number {
  const raw = Math.round(closeness * multiplier);
  return Math.min(200, Math.max(0, raw));
}

/**
 * Generates visual emoji matrix row for shareable clipping.
 * - 🟩 for VERIFIED
 * - 🟥 for CONTAMINATED
 * - ⬜ for MISSED
 *
 * @param evaluations Array of evaluated exhibit badges.
 */
export function generateEmojiRow(evaluations: ExhibitEvaluation[]): string {
  return evaluations
    .map((e) => {
      switch (e.status) {
        case 'VERIFIED':
          return '🟩';
        case 'CONTAMINATED':
          return '🟥';
        case 'MISSED':
        default:
          return '⬜';
      }
    })
    .join('');
}

/**
 * Formats a Wordle-style shareable plaintext clipping ready for clipboard export.
 *
 * Example Output:
 * KANJION #001 🇯🇵 — 100% × 1.4x = 140 PTS
 * 🟩🟩🟩🟩🟩 (4/6 Telegrams Sent)
 * https://kanjion-game.web.app
 */
export function generateShareableClipping(params: {
  caseNumber: string;
  closenessScore: number;
  multiplier: number;
  finalScore: number;
  linesUsed: number;
  evaluations: ExhibitEvaluation[];
  themeFlag?: string;
  baseUrl?: string;
}): string {
  const {
    caseNumber,
    closenessScore,
    multiplier,
    finalScore,
    linesUsed,
    evaluations,
    themeFlag = '🇯🇵',
    baseUrl = 'https://kanjion-game.web.app',
  } = params;

  const emojiRow = generateEmojiRow(evaluations);

  return [
    `KANJION ${caseNumber} ${themeFlag} — ${closenessScore}% × ${multiplier.toFixed(1)}x = ${finalScore} PTS`,
    `${emojiRow} (${linesUsed}/${MAX_TELEGRAM_LINES} Telegrams Sent)`,
    `${baseUrl}`,
  ].join('\n');
}

/**
 * Complete evaluation and scoring pipeline.
 * Evaluates exhibits against the micro-state and produces a complete ScoreReport.
 *
 * @param exhibits Checkpoint exhibit definitions.
 * @param microState Final Shinkansen sandbox micro-state.
 * @param linesUsed Total telegram lines dispatched by player.
 * @param caseNumber Case file identifier (default: '#001').
 */
export function calculateScoreReport(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  state: PuzzleState | Record<string, FieldValue>,
  linesUsed: number,
  caseNumber: string = '#001'
): ScoreReport {
  const exhibitEvaluations = evaluateAllExhibits(puzzleOrExhibits, state);
  const closenessScore = calculateClosenessScore(exhibitEvaluations);
  const { unusedLines, multiplier } = calculateEfficiencyMultiplier(linesUsed);
  const finalScore = calculateFinalScore(closenessScore, multiplier);
  const emojiRow = generateEmojiRow(exhibitEvaluations);

  const shareableClipping = generateShareableClipping({
    caseNumber,
    closenessScore,
    multiplier,
    finalScore,
    linesUsed,
    evaluations: exhibitEvaluations,
  });

  return {
    closenessScore,
    linesUsed,
    unusedLines,
    multiplier,
    finalScore,
    exhibitEvaluations,
    shareableClipping,
    emojiRow,
  };
}
