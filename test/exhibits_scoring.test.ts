/**
 * test/exhibits_scoring.test.ts
 *
 * Automated verification suite for the Scoring & Exhibit Evaluation Engine:
 * - Rubber ink stamp evaluations ([VERIFIED ✓], [CLEAN ✓], [CONTAMINATED ✗], [MISSED ✗])
 * - Tactile alternating rotation angles (-4deg, +3deg)
 * - Closeness percentage math (0-100%)
 * - Unused-line efficiency multiplier (1.0x-2.0x) avoiding floating point drift
 * - Final score calculation: round(C * M) clamped to [0, 200] PTS
 * - Wordle-style shareable clipping generator
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateExhibit,
  evaluateAllExhibits,
  calculateClosenessScore,
  calculateEfficiencyMultiplier,
  calculateFinalScore,
  generateEmojiRow,
  generateShareableClipping,
  calculateScoreReport,
} from '../src/engine/scoring';
import { CASE_001_EXHIBITS, CASE_001_INITIAL_MICRO_STATE } from '../src/data/puzzles/case_001';
import { ShinkansenMicroState } from '../src/types/engine';
import { ExhibitEvaluation } from '../src/types/game';

describe('Scoring & Exhibit Evaluation Engine', () => {
  describe('Rubber Ink Stamp Evaluations & Rotation Angles', () => {
    it('evaluates target condition satisfaction with [VERIFIED ✓] badge', () => {
      const winningState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        greenCarSelected: true,
        trainName: 'Nozomi 24',
        fare: 13870,
      };
      const evalC = evaluateExhibit(CASE_001_EXHIBITS[2], winningState, 2);
      expect(evalC.status).toBe('VERIFIED');
      expect(evalC.stampText).toBe('[VERIFIED ✓ +20%]');
      expect(evalC.awardedPoints).toBe(20);
    });

    it('evaluates clean decoy trap avoidance with [CLEAN ✓] badge', () => {
      const cleanState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        signatureSigned: true,
        insuranceTrapHit: false,
        insuranceCheckboxChecked: false,
      };
      const evalD = evaluateExhibit(CASE_001_EXHIBITS[3], cleanState, 3);
      expect(evalD.status).toBe('CLEAN');
      expect(evalD.stampText).toBe('[CLEAN ✓ +15%]');
      expect(evalD.awardedPoints).toBe(15);
    });

    it('evaluates decoy trap contamination with [CONTAMINATED ✗] badge and 0 points', () => {
      const contaminatedState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        signatureSigned: true,
        insuranceTrapHit: true,
      };
      const evalD = evaluateExhibit(CASE_001_EXHIBITS[3], contaminatedState, 3);
      expect(evalD.status).toBe('CONTAMINATED');
      expect(evalD.stampText).toBe('[CONTAMINATED ✗ +0%]');
      expect(evalD.awardedPoints).toBe(0);
    });

    it('evaluates unsatisfied condition with [MISSED ✗] badge and 0 points', () => {
      const missedState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        finalConfirmed: false,
      };
      const evalE = evaluateExhibit(CASE_001_EXHIBITS[4], missedState, 4);
      expect(evalE.status).toBe('MISSED');
      expect(evalE.stampText).toBe('[MISSED ✗ +0%]');
      expect(evalE.awardedPoints).toBe(0);
    });

    it('assigns tactile alternating rotation angles (-4deg, +3deg)', () => {
      const state = { ...CASE_001_INITIAL_MICRO_STATE };
      const evals = evaluateAllExhibits(CASE_001_EXHIBITS, state);
      const angles = evals.map((e) => e.rotationDeg);
      expect(angles).toEqual([-4, 3, -4, 3, -4]);
    });
  });

  describe('Closeness Percentage Calculations', () => {
    it('calculates 100% closeness for perfect solution path', () => {
      const perfectState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        selectedRoute: 'tokyo_osaka',
        departureTime: '14:30',
        passengerName: 'TANAKA',
        greenCarSelected: true,
        trainName: 'Nozomi 24',
        fare: 13870,
        signatureSigned: true,
        signatureStroke: 'SHAPE:signature',
        insuranceTrapHit: false,
        insuranceCheckboxChecked: false,
        finalConfirmed: true,
      };
      const evals = evaluateAllExhibits(CASE_001_EXHIBITS, perfectState);
      const closeness = calculateClosenessScore(evals);
      expect(closeness).toBe(100);
    });

    it('calculates 85% closeness when insurance trap is contaminated', () => {
      const trapState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        selectedRoute: 'tokyo_osaka',
        departureTime: '14:30',
        passengerName: 'TANAKA',
        greenCarSelected: true,
        trainName: 'Nozomi 24',
        fare: 13870,
        signatureSigned: true,
        insuranceTrapHit: true, // Contaminates Exhibit D (15%)
        finalConfirmed: true,
      };
      const evals = evaluateAllExhibits(CASE_001_EXHIBITS, trapState);
      const closeness = calculateClosenessScore(evals);
      expect(closeness).toBe(85);
    });

    it('calculates 45% closeness after route and passenger name before green car and confirm', () => {
      // Exhibit A (25) + Exhibit B (20) = 45
      const mv03State: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        selectedRoute: 'tokyo_osaka',
        departureTime: '14:30',
        passengerName: 'TANAKA',
      };
      const evals = evaluateAllExhibits(CASE_001_EXHIBITS, mv03State);
      const closeness = calculateClosenessScore(evals);
      expect(closeness).toBe(45);
    });

    it('calculates 0% closeness when all conditions are failed or contaminated', () => {
      const worstState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        selectedRoute: 'nagoya_kyoto',
        departureTime: '08:00',
        greenCarSelected: false,
        insuranceTrapHit: true,
        finalConfirmed: false,
      };
      const evals = evaluateAllExhibits(CASE_001_EXHIBITS, worstState);
      const closeness = calculateClosenessScore(evals);
      expect(closeness).toBe(0);
    });
  });

  describe('Efficiency Multiplier & Final Score Formulas', () => {
    it('computes exact multipliers for lines 1 through 6 without floating point drift', () => {
      const testCases = [
        { linesUsed: 1, expectedUnused: 5, expectedMultiplier: 2.0 },
        { linesUsed: 2, expectedUnused: 4, expectedMultiplier: 1.8 },
        { linesUsed: 3, expectedUnused: 3, expectedMultiplier: 1.6 },
        { linesUsed: 4, expectedUnused: 2, expectedMultiplier: 1.4 },
        { linesUsed: 5, expectedUnused: 1, expectedMultiplier: 1.2 },
        { linesUsed: 6, expectedUnused: 0, expectedMultiplier: 1.0 },
      ];

      for (const tc of testCases) {
        const { unusedLines, multiplier } = calculateEfficiencyMultiplier(tc.linesUsed);
        expect(unusedLines).toBe(tc.expectedUnused);
        expect(multiplier).toBe(tc.expectedMultiplier);
        expect(multiplier.toFixed(1)).toBe(tc.expectedMultiplier.toFixed(1));
      }
    });

    it('clamps linesUsed outside normal range (0 or > 6)', () => {
      const zeroUsed = calculateEfficiencyMultiplier(0);
      expect(zeroUsed.multiplier).toBe(2.0);

      const sevenUsed = calculateEfficiencyMultiplier(7);
      expect(sevenUsed.multiplier).toBe(1.0);
    });

    it('calculates final verified scores rounded to nearest integer and clamped [0, 200]', () => {
      // 100% * 2.0x = 200 PTS (Theoretical max)
      expect(calculateFinalScore(100, 2.0)).toBe(200);

      // 100% * 1.4x = 140 PTS
      expect(calculateFinalScore(100, 1.4)).toBe(140);

      // 80% * 1.6x = 128 PTS
      expect(calculateFinalScore(80, 1.6)).toBe(128);

      // 85% * 1.4x = 119 PTS
      expect(calculateFinalScore(85, 1.4)).toBe(119);

      // 60% * 1.2x = 72 PTS
      expect(calculateFinalScore(60, 1.2)).toBe(72);

      // Clamped maximum
      expect(calculateFinalScore(150, 2.0)).toBe(200);

      // Clamped minimum
      expect(calculateFinalScore(0, 1.0)).toBe(0);
    });
  });

  describe('Wordle-Style Shareable Clipping Generator', () => {
    it('generates emoji row representing exhibit states', () => {
      const mockEvals: ExhibitEvaluation[] = [
        { id: 'a', title: 'A', weight: 25, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'b', title: 'B', weight: 20, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'c', title: 'C', weight: 20, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'd', title: 'D', weight: 15, status: 'CONTAMINATED', stampText: '', rotationDeg: 0 },
        { id: 'e', title: 'E', weight: 20, status: 'MISSED', stampText: '', rotationDeg: 0 },
      ];
      const emojiRow = generateEmojiRow(mockEvals);
      expect(emojiRow).toBe('🟩🟩🟩🟥⬜');
    });

    it('generates full shareable clipboard text', () => {
      const mockEvals: ExhibitEvaluation[] = [
        { id: 'a', title: 'A', weight: 25, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'b', title: 'B', weight: 20, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'c', title: 'C', weight: 20, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
        { id: 'd', title: 'D', weight: 15, status: 'CLEAN', stampText: '', rotationDeg: 0 },
        { id: 'e', title: 'E', weight: 20, status: 'VERIFIED', stampText: '', rotationDeg: 0 },
      ];

      const clipping = generateShareableClipping({
        caseNumber: '#001',
        closenessScore: 100,
        multiplier: 1.4,
        finalScore: 140,
        linesUsed: 4,
        evaluations: mockEvals,
      });

      expect(clipping).toBe(
        'KANJION #001 🇯🇵 — 100% × 1.4x = 140 PTS\n🟩🟩🟩🟩🟩 (4/6 Telegrams Sent)\nhttps://kanjion-game.web.app'
      );
    });
  });

  describe('Integrated ScoreReport Generator', () => {
    it('produces complete ScoreReport for winning 4-line execution', () => {
      const winningState: ShinkansenMicroState = {
        ...CASE_001_INITIAL_MICRO_STATE,
        selectedRoute: 'tokyo_osaka',
        departureTime: '14:30',
        passengerName: 'TANAKA',
        greenCarSelected: true,
        trainName: 'Nozomi 24',
        fare: 13870,
        signatureSigned: true,
        signatureStroke: 'SHAPE:signature',
        insuranceTrapHit: false,
        insuranceCheckboxChecked: false,
        finalConfirmed: true,
      };

      const report = calculateScoreReport(CASE_001_EXHIBITS, winningState, 4, '#001');
      expect(report.closenessScore).toBe(100);
      expect(report.linesUsed).toBe(4);
      expect(report.unusedLines).toBe(2);
      expect(report.multiplier).toBe(1.4);
      expect(report.finalScore).toBe(140);
      expect(report.exhibitEvaluations.length).toBe(5);
      expect(report.emojiRow).toBe('🟩🟩🟩🟩🟩');
      expect(report.shareableClipping).toContain('100% × 1.4x = 140 PTS');
    });
  });
});
