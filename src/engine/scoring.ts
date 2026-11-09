/**
 * src/engine/scoring.ts
 *
 * Scoring mathematics engine and declassified exhibit evaluator.
 * Evaluates the 5 target exhibits against the final micro-state,
 * generates tactile rubber ink stamps, computes closeness and efficiency multipliers,
 * and formats shareable forensic clipping scorecards for clipboard export.
 */

import { ExhibitEvaluation, LineOutcome, ScoreReport, TelegramLine } from '../types/game';
import { ExhibitDefinition } from '../types/puzzle';
import {
  ExhibitCompareItem,
  ExhibitDef,
  FieldValue,
  PuzzleData,
  PuzzleState,
} from '../types/puzzle_data';
import { CASE_001_PUZZLE } from '../data/puzzles/case_001/puzzle';
import {
  applyDecision,
  createInitialPuzzleState,
  evaluateExhibitDef,
  extractFields,
} from './puzzle_engine';
import { resolveSignatureDrawingSpec } from '../utils/text_normalizer';

/**
 * Maximum telegram lines allowed in the dispatch ledger.
 */
export const MAX_TELEGRAM_LINES = 6;

/**
 * Efficiency bonus rate awarded per unused telegram line (20% = 0.20).
 */
export const EFFICIENCY_BONUS_PER_UNUSED_LINE = 0.2;

/**
 * Computes the final fields reached by applying a puzzle's replay script to initialFields.
 */
export function computeReplayFinalFields(
  puzzle: PuzzleData = CASE_001_PUZZLE
): Record<string, FieldValue> {
  let s = createInitialPuzzleState(puzzle);
  for (const step of puzzle.replay) {
    const page = puzzle.pages.find((p) => p.id === step.pageId);
    const el = page?.elements.find((e) => e.key === step.key);
    if (!el) continue;
    s = applyDecision(puzzle, s, {
      action: step.action,
      pageId: step.pageId,
      mark: el.mark,
      text: step.text,
      stroke: step.stroke,
    }).next;
  }
  return s.fields;
}

/**
 * Formats a single field value according to an ExhibitCompareItem specification.
 */
export function formatCompareValue(
  item: ExhibitCompareItem,
  fields: Record<string, FieldValue>
): string {
  const rawVal = fields[item.field];
  if (item.format === 'yen') {
    const num = typeof rawVal === 'number' ? rawVal : Number(rawVal) || 0;
    return `¥${num.toLocaleString('en-US')}`;
  }
  if (item.format === 'stroke') {
    const str = typeof rawVal === 'string' ? rawVal.trim() : '';
    if (!str) return 'not signed';
    if (str === 'SHAPE:signature') return 'signature';
    const spec = resolveSignatureDrawingSpec(str);
    if (str.startsWith('SHAPE:')) {
      return (
        spec.displayLabel.replace(/^[^A-Za-z]+/, '').toLowerCase() ||
        str.slice(6).toLowerCase()
      );
    }
    return spec.displayLabel || str;
  }
  if (item.format === 'bool') {
    const key = rawVal ? 'true' : 'false';
    return item.values?.[key] ?? key;
  }
  const str = rawVal === undefined || rawVal === null ? '' : String(rawVal);
  if (item.values && Object.prototype.hasOwnProperty.call(item.values, str)) {
    return item.values[str];
  }
  if (str === '') return '(blank)';
  return str;
}

/**
 * Formats the "You: ... · Replay: ..." comparison line for an unverified exhibit.
 */
export function formatExhibitComparison(
  compare: ExhibitCompareItem[],
  playerFields: Record<string, FieldValue>,
  replayFields: Record<string, FieldValue>
): string {
  const youStr = compare.map((item) => formatCompareValue(item, playerFields)).join(' · ');
  const replayStr = compare.map((item) => formatCompareValue(item, replayFields)).join(' · ');
  return `You: ${youStr} · Replay: ${replayStr}`;
}

/**
 * Evaluates a single exhibit checkpoint against the given state.
 * Assigns tactile rubber stamp rotation angles (-4deg or +3deg).
 */
export function evaluateExhibit(
  exhibit: ExhibitDef | ExhibitDefinition,
  state: PuzzleState | Record<string, FieldValue>,
  index: number = 0,
  replayFields?: Record<string, FieldValue>
): ExhibitEvaluation {
  const fields = extractFields(state);
  let baseEval: ExhibitEvaluation;
  if ('verified' in exhibit) {
    baseEval = evaluateExhibitDef(exhibit, state, index);
  } else {
    const result = exhibit.evaluate(fields);
    const rotationDeg = index % 2 === 0 ? -4 : 3;
    baseEval = {
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

  if (baseEval.status !== 'VERIFIED' && exhibit.compare && exhibit.compare.length > 0) {
    const rep = replayFields ?? computeReplayFinalFields(CASE_001_PUZZLE);
    baseEval = {
      ...baseEval,
      compareText: formatExhibitComparison(exhibit.compare, fields, rep),
    };
  }

  return baseEval;
}

/**
 * Evaluates all exhibits against the provided state.
 */
export function evaluateAllExhibits(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  state: PuzzleState | Record<string, FieldValue>
): ExhibitEvaluation[] {
  if (!Array.isArray(puzzleOrExhibits)) {
    const rep = computeReplayFinalFields(puzzleOrExhibits);
    return puzzleOrExhibits.exhibits.map((exhibit, index) =>
      evaluateExhibit(exhibit, state, index, rep)
    );
  }
  const rep = computeReplayFinalFields(CASE_001_PUZZLE);
  return puzzleOrExhibits.map((exhibit, index) => evaluateExhibit(exhibit, state, index, rep));
}

/**
 * Counts how many exhibits are currently VERIFIED.
 */
export function satisfiedCount(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  state: PuzzleState | Record<string, FieldValue>
): number {
  return evaluateAllExhibits(puzzleOrExhibits, state).filter((e) => e.status === 'VERIFIED').length;
}

/**
 * Computes the per-line outcome emoji when an agent action transitions beforeState -> afterState.
 */
export function computeLineOutcome(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  beforeState: PuzzleState,
  afterState: PuzzleState
): LineOutcome {
  const before = satisfiedCount(puzzleOrExhibits, beforeState);
  const after = satisfiedCount(puzzleOrExhibits, afterState);
  if (after > before) return '🎯';
  if (after < before) return '💥';
  if (afterState.pageId !== beforeState.pageId) return '🔙';
  const allKeys = new Set([
    ...Object.keys(beforeState.fields),
    ...Object.keys(afterState.fields),
  ]);
  for (const k of allKeys) {
    if (beforeState.fields[k] !== afterState.fields[k]) {
      return '🤡';
    }
  }
  return '💤';
}

/**
 * Formats the first blunder line (outcome in {🤡, 🔙, 💥}) for the forensic report.
 */
export function formatBestBlunder(telegrams?: TelegramLine[]): string | null {
  if (!telegrams) return null;
  const blunder = telegrams.find(
    (t) => t.submitted && (t.outcome === '🤡' || t.outcome === '🔙' || t.outcome === '💥')
  );
  if (!blunder) return null;
  const nn = String(blunder.lineNumber).padStart(2, '0');
  const thought = blunder.agentAction?.thought || blunder.actionSummary || '';
  return `Best blunder — LINE ${nn}: "${blunder.text}" → ${thought}`;
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
 * KANJION #001 🇯🇵 — 100% × 1.2x = 120 PTS
 * 🎯🎯🎯🎯🎯
 * 🟩🟩🟩🟩🟩
 * https://kanjion-game.web.app
 */
export function generateShareableClipping(params: {
  caseNumber: string;
  closenessScore: number;
  multiplier: number;
  finalScore: number;
  linesUsed: number;
  evaluations: ExhibitEvaluation[];
  outcomes?: LineOutcome[];
  outcomeRow?: string;
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
    outcomes,
    outcomeRow: explicitOutcomeRow,
    themeFlag = '🇯🇵',
    baseUrl = 'https://kanjion-game.web.app',
  } = params;

  const emojiRow = generateEmojiRow(evaluations);
  const outcomeRow =
    explicitOutcomeRow !== undefined
      ? explicitOutcomeRow
      : outcomes
      ? outcomes.join('')
      : '🎯'.repeat(Math.max(0, Math.min(MAX_TELEGRAM_LINES, linesUsed)));

  return [
    `KANJION ${caseNumber} ${themeFlag} — ${closenessScore}% × ${multiplier.toFixed(1)}x = ${finalScore} PTS`,
    `${outcomeRow}`,
    `${emojiRow}`,
    `${baseUrl}`,
  ].join('\n');
}

/**
 * Complete evaluation and scoring pipeline.
 * Evaluates exhibits against the micro-state and produces a complete ScoreReport.
 */
export function calculateScoreReport(
  puzzleOrExhibits: PuzzleData | Array<ExhibitDef | ExhibitDefinition>,
  state: PuzzleState | Record<string, FieldValue>,
  linesUsed: number,
  caseNumber: string = '#001',
  options?: {
    outcomes?: LineOutcome[];
    telegrams?: TelegramLine[];
  }
): ScoreReport {
  const exhibitEvaluations = evaluateAllExhibits(puzzleOrExhibits, state);
  const closenessScore = calculateClosenessScore(exhibitEvaluations);
  const { unusedLines, multiplier } = calculateEfficiencyMultiplier(linesUsed);
  const finalScore = calculateFinalScore(closenessScore, multiplier);
  const emojiRow = generateEmojiRow(exhibitEvaluations);

  const submittedTelegrams = options?.telegrams?.filter((t) => t.submitted);
  const outcomes: LineOutcome[] | undefined =
    options?.outcomes ??
    (submittedTelegrams
      ? submittedTelegrams.map((t) => t.outcome ?? '💤')
      : undefined);
  const outcomeRow = outcomes
    ? outcomes.join('')
    : '🎯'.repeat(Math.max(0, Math.min(MAX_TELEGRAM_LINES, linesUsed)));
  const bestBlunder = formatBestBlunder(options?.telegrams);

  const shareableClipping = generateShareableClipping({
    caseNumber,
    closenessScore,
    multiplier,
    finalScore,
    linesUsed,
    evaluations: exhibitEvaluations,
    outcomeRow,
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
    outcomeRow,
    bestBlunder,
  };
}
