/**
 * test/e2e_adversarial_hardening.test.ts
 *
 * Milestone 5: Tier 5 Comprehensive Adversarial Hardening Suite for Instruct.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// UI Components
import {
  SandboxStage,
  ShinkansenSandbox,
  DispatchPad,
} from '../src/components';

// Engine & Reducer
import {
  gameReducer,
  createInitialGameState,
} from '../src/engine/game_reducer';
import {
  resolveLine,
  fallbackResolve,
  decisionToAgentAction,
  assertGoalBlindness,
  sanitizeDomForClient,
  filterPromptSyntheticIds,
} from '../src/engine/agent';

// Scoring
import {
  calculateScoreReport,
  calculateClosenessScore,
  calculateEfficiencyMultiplier,
  calculateFinalScore,
} from '../src/engine/scoring';

// Geometry & Normalizer Utilities
import {
  pixelToGrid,
  STAGE_WIDTH,
  STAGE_HEIGHT,
} from '../src/utils/coordinate_projector';
import {
  validateInstruction,
  normalizeInstruction,
} from '../src/utils/text_normalizer';

// Compiler Tooling & Invariants
import {
  sanitizePuzzleHtml,
} from '../tools/lib/sanitizer';
import {
  validatePuzzleInvariants,
} from '../tools/lib/manifest_builder';
import {
  computeBadgeGeometry,
} from '../tools/lib/som_annotator';
import {
  EXIT_SUCCESS,
  EXIT_INVALID_ARGS,
  EXIT_RESOURCE_NOT_FOUND,
  EXIT_SANITIZATION_FAILED,
  EXIT_GEOMETRY_VIOLATION,
  EXIT_INVARIANT_VIOLATION,
  EXIT_BROWSER_ERROR,
  EXIT_IO_ERROR,
  SanitizationError,
  GeometryViolationError,
  SchemaInvariantError,
} from '../tools/lib/types';

// Case File #001 Fixtures
import {
  CASE_001_PUZZLE,
  CASE_001_MANIFEST,
  CASE_001_GENERATED_MANIFEST,
  CASE_001_MV03_ELEMENTS,
  CASE_001_INITIAL_MICRO_STATE,
} from '../src/data/puzzles/case_001';

import type { AgentAction } from '../src/types/engine';
import type { AgentCursorState } from '../src/types/game';
import type { PuzzleManifest } from '../src/types/puzzle';

const defaultCursor: AgentCursorState = {
  xPercent: 50,
  yPercent: 50,
  thought: 'Idle test cursor',
  variant: 'idle',
  isShaking: false,
};

describe('Tier 5 Adversarial Hardening Suite', () => {

  // =========================================================================
  // SUITE 1: UI & Presentation Layer Adversarial Vectors
  // =========================================================================
  describe('Suite 1: UI & Presentation Layer Adversarial Vectors', () => {

    it('1.1 protects against rapid multi-line dispatch hammering and race re-entrancy', async () => {
      let state = createInitialGameState({});
      expect(state.activeLineIndex).toBe(0);

      const dispatchAction: AgentAction = {
        action: 'CLICK',
        targetId: '#25',
        thought: 'Hammering dispatch',
      };

      for (let i = 0; i < 10; i++) {
        if (!state.isExecuting && state.caseStatus !== 'closed') {
          state = gameReducer(state, { type: 'START_EXECUTION' });
          state = gameReducer(state, {
            type: 'APPLY_AGENT_ACTION',
            payload: { action: dispatchAction, instruction: `rapid ${i}` },
          });
        }
      }

      expect(state.telegrams.filter((t) => t.submitted).length).toBe(6);
      expect(state.caseStatus).toBe('closed');
      expect(state.activeLineIndex).toBe(5);
    });

    it('1.2 verifies focus management and clean DOM input unmounting upon case closure', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        React.createElement(DispatchPad, {
          telegrams: createInitialGameState({}).telegrams,
          activeLineIndex: 0,
          currentInput: 'active text',
          onInputChange: vi.fn(),
          onSubmitLine: vi.fn(),
          onCloseCase: handleClose,
          caseStatus: 'active',
          currentMultiplier: 2.0,
        })
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'telegram-input');

      rerender(
        React.createElement(DispatchPad, {
          telegrams: createInitialGameState({}).telegrams,
          activeLineIndex: 0,
          currentInput: '',
          onInputChange: vi.fn(),
          onSubmitLine: vi.fn(),
          onCloseCase: handleClose,
          caseStatus: 'closed',
          currentMultiplier: 2.0,
        })
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText(/DISPATCH PAD LOCKED/i)).toBeInTheDocument();
    });

    it('1.3 rejects empty lines, whitespace, and non-printable zero-width characters', () => {
      const emptyPayloads = [
        '',
        '   ',
        '\t\t\t',
        '\n\n',
        '   \t   \n  ',
      ];

      for (const payload of emptyPayloads) {
        const validation = validateInstruction(payload);
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('cannot be empty or whitespace only');
      }

      const zeroWidthPayload = '\u200B\u200C\u200D\uFEFF';
      const normalizedZero = normalizeInstruction(zeroWidthPayload);
      expect(normalizedZero).toBe('');
    });

    it('1.4 intercepts all 5 prohibited clipboard/drag events across deep nested sandbox elements', () => {
      const mv03State = {
        ...CASE_001_INITIAL_MICRO_STATE,
        macroViewId: 'MV-03',
        selectedRoute: 'tokyo_osaka' as const,
        passengerName: 'TANAKA',
      };
      render(
        React.createElement(
          SandboxStage,
          {
            macroViewId: 'MV-03',
            microState: mv03State,
            agentCursor: defaultCursor,
            stageShake: false,
          },
          React.createElement(ShinkansenSandbox, { microState: mv03State })
        )
      );

      const stage = screen.getByTestId('sandbox-stage');
      const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥(?:13,870|19,590)/i });

      const prohibitedEvents = ['copy', 'cut', 'paste', 'dragstart', 'contextmenu'];

      for (const evtName of prohibitedEvents) {
        const stageEvt = new Event(evtName, { bubbles: true, cancelable: true });
        stage.dispatchEvent(stageEvt);
        expect(stageEvt.defaultPrevented).toBe(true);

        const childEvt = new Event(evtName, { bubbles: true, cancelable: true });
        greenBtn.dispatchEvent(childEvt);
        expect(childEvt.defaultPrevented).toBe(true);
      }
    });

    it('1.5 enforces coordinate ruler scaling invariants across mobile/tablet screen sizes (375, 600, 768, 1024px)', () => {
      const viewports = [
        { width: 375, expectedScale: 375 / 1024, expectedHeight: Math.round(768 * (375 / 1024)) },
        { width: 600, expectedScale: 600 / 1024, expectedHeight: Math.round(768 * (600 / 1024)) },
        { width: 768, expectedScale: 768 / 1024, expectedHeight: Math.round(768 * (768 / 1024)) },
        { width: 1024, expectedScale: 1.0, expectedHeight: 768 },
      ];

      for (const vp of viewports) {
        const { unmount } = render(
          React.createElement(SandboxStage, {
            macroViewId: 'MV-03',
            microState: CASE_001_INITIAL_MICRO_STATE,
            agentCursor: defaultCursor,
            stageShake: false,
            scaleFactor: vp.expectedScale,
          })
        );

        const stageContainer = screen.getByTestId('sandbox-stage');
        const stageCore = screen.getByTestId('sandbox-core');

        expect(stageContainer.style.height).toBe(`${vp.expectedHeight}px`);
        expect(stageCore.style.width).toBe('1024px');
        expect(stageCore.style.height).toBe('768px');
        expect(stageCore.style.transform).toBe(`scale(${vp.expectedScale})`);
        expect(stageCore.style.transformOrigin).toBe('top left');

        unmount();
      }
    });
  });

  // =========================================================================
  // SUITE 2: Engine & Security Guardrails Adversarial Vectors
  // =========================================================================
  describe('Suite 2: Engine & Security Guardrails Adversarial Vectors', () => {

    it('2.1 asserts Guardrail 1 (Goal Blindness) strictly prevents criteria or target leakage in prompts', () => {
      const cleanContext = {
        pageId: 'MV-03',
        instruction: 'select green car',
        elements: CASE_001_MV03_ELEMENTS.map((e) => ({ mark: e.id, role: e.role, visibleText: e.text })),
      };

      expect(() => assertGoalBlindness(cleanContext)).not.toThrow();

      const forbiddenLeaks = [
        { exhibit_a: 'Hikari Route' },
        { targetWaypoint: [885, 468] },
        { winningPath: ['#25', '#30'] },
        { isTarget: true },
        { isTrap: true },
        { rubberStamp: '[VERIFIED]' },
      ];

      for (const leak of forbiddenLeaks) {
        expect(() => {
          assertGoalBlindness({ ...cleanContext, ...leak });
        }).toThrow(/Security Guardrail Violation: Goal leakage detected/i);
      }
    });

    it('2.2 sanitizes client DOM and strips synthetic SoM attributes across case/whitespace variations', () => {
      const dirtyHtml = `
        <div class="table">
          <button DATA-SOM-ID="25" data-target="true" data-is-trap="false">
            <span class="som-badge">25</span>
            ¥13,870
          </button>
          <!-- mark #25 target note -->
          <a som-id=14 href="#">Back</a>
        </div>
      `;

      const cleaned = sanitizeDomForClient(dirtyHtml);
      expect(cleaned).not.toMatch(/data-som-id/i);
      expect(cleaned).not.toMatch(/data-target/i);
      expect(cleaned).not.toMatch(/data-is-trap/i);
      expect(cleaned).not.toMatch(/som-id/i);
      expect(cleaned).not.toMatch(/som-badge/i);
      expect(cleaned).not.toContain('mark #25');
    });

    it('2.3 verifies Guardrail 3 prompt filtering catches evasions while permitting visible currency literals', () => {
      const evasionAttempts = [
        'click #25',
        'click mark 25',
        'click badge 25',
        'click tag 25',
        'click som_25',
        'click ＃２５',
        'click #㉕',
        'click %2325',
        'click mark%2025',
        'click badge%20%2325',
        'click %23%32%35',
        'click%20%2325',
        'click #2\u200B5',
        'click #\u200B25',
        'click mark\u200B25',
        'click #2\u200C5',
        'click #2\u200D5',
        'click #2\uFEFF5',
        'click #2\u200B\u200C\u200D5',
      ];

      for (const attempt of evasionAttempts) {
        const res = filterPromptSyntheticIds(attempt, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(true);
      }

      const permittedInputs = [
        'select ¥14,520',
        'select ¥14,720',
        'choose 13870',
        'click ¥13,870',
        'select ¥2,400',
        '10% discount on ¥13,870',
      ];

      for (const fare of permittedInputs) {
        const res = filterPromptSyntheticIds(fare, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(false);
      }
    });

    it('2.4 recovers gracefully from network timeouts and 500 errors via fallback', async () => {
      const action = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: {
          pageId: 'MV-03',
          fields: { ...CASE_001_INITIAL_MICRO_STATE },
        },
        instruction: 'click green clover',
        cloudResolver: async () => {
          throw new Error('Gateway Timeout (504)');
        },
      });
      expect(action.action).toBe('CLICK');
      expect(action.mark).toBe(25);
      expect(action.tier).toBe('fallback');
      expect(action.cloudFailed).toBe(true);
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('2.5 handles malformed URL percent escapes and validates rejection of encoded evasions', async () => {
      const malformedInputs = [
        'select 50% discount',
        'get +20% bonus',
        'click %ZZ25',
        'click %E0%A4%A',
        'click %2',
        'click %',
      ];

      for (const input of malformedInputs) {
        expect(() => filterPromptSyntheticIds(input, CASE_001_MV03_ELEMENTS)).not.toThrow();
        const res = filterPromptSyntheticIds(input, CASE_001_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(false);
      }

      const resMalformedWithTarget = filterPromptSyntheticIds('click %E0%A4%A #25', CASE_001_MV03_ELEMENTS);
      expect(resMalformedWithTarget.isBlocked).toBe(true);
      expect(resMalformedWithTarget.flaggedId).toBe(25);

      const evasionPrompts = ['click %2325', 'click #2\u200B5', 'click mark%2025'];
      for (const prompt of evasionPrompts) {
        let cloudCalled = false;
        const action = await resolveLine({
          puzzle: CASE_001_PUZZLE,
          manifest: CASE_001_GENERATED_MANIFEST,
          state: {
            pageId: 'MV-03',
            fields: { ...CASE_001_INITIAL_MICRO_STATE },
          },
          instruction: prompt,
          cloudResolver: async () => {
            cloudCalled = true;
            return { action: 'CLICK', pageId: 'MV-03', mark: 25, thought: 'ok', tier: 'cloud' };
          },
        });
        const mv03 = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-03')!;
        const distractionEl = mv03.elements.find((e) => e.key === mv03.distractionKey)!;
        expect(action.action).toBe('CLICK');
        expect(action.mark).toBe(distractionEl.mark);
        expect(action.thought).toBe("💭 I don't see numbers like that on the page, so I clicked the shiniest thing instead.");
        expect(cloudCalled).toBe(false);
      }
    });
  });

  // =========================================================================
  // SUITE 3: Scoring & Reducer Immutability Hardening
  // =========================================================================
  describe('Suite 3: Scoring & Reducer Immutability Hardening', () => {

    it('3.1 preserves deep immutability when state tree is recursively frozen', () => {
      const state = createInitialGameState({});
      Object.freeze(state);
      Object.freeze(state.microState);
      Object.freeze(state.telegrams);
      Object.freeze(state.agentCursor);

      const nextInput = gameReducer(state, { type: 'SET_INPUT', payload: 'immutable test' });
      expect(nextInput).not.toBe(state);
      expect(nextInput.currentInput).toBe('immutable test');

      const nextExec = gameReducer(state, { type: 'START_EXECUTION' });
      expect(nextExec).not.toBe(state);
      expect(nextExec.isExecuting).toBe(true);
    });

    it('3.2 enforces mathematical clamping: closeness [0, 100], multiplier [1.0, 2.0], score [0, 200]', () => {
      expect(calculateClosenessScore([])).toBe(0);
      expect(calculateClosenessScore([{ id: 'ex', code: 'A', title: 'T', weight: 500, status: 'VERIFIED', stampText: '', rotationDeg: 0, awardedPoints: 500 }])).toBe(100);

      expect(calculateEfficiencyMultiplier(-10).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(0).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(1).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(6).multiplier).toBe(1.0);
      expect(calculateEfficiencyMultiplier(999).multiplier).toBe(1.0);

      expect(calculateFinalScore(100, 2.0)).toBe(200);
      expect(calculateFinalScore(500, 5.0)).toBe(200);
      expect(calculateFinalScore(-50, 1.5)).toBe(0);
    });

    it('3.3 verifies trap flag and unsigned Exhibit D is MISSED (85% closeness)', () => {
      let state = createInitialGameState({
        initialMicroState: {
          ...CASE_001_INITIAL_MICRO_STATE,
          macroViewId: 'MV-03',
          selectedRoute: 'tokyo_osaka',
          departureTime: '14:30',
          passengerName: 'TANAKA',
        },
      });

      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#12', thought: 'Promo banner', isTrap: true },
          instruction: 'click promo',
        },
      });

      expect(state.microState.insuranceAttached).toBe(true);
      expect(state.macroViewId).toBe('MV-03');

      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: { action: 'TIMED_CLICK', targetId: '#25', thought: 'Green car' }, instruction: 'wait for sale glow green car' },
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#28', thought: 'Uncheck box' },
          instruction: 'uncheck insurance',
        },
      });

      expect(state.microState.insuranceAttached).toBe(false);

      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: { action: 'CLICK', targetId: '#30', thought: 'Confirm' }, instruction: 'confirm' },
      });
      state = gameReducer(state, { type: 'CLOSE_CASE' });

      expect(state.scoreReport?.closenessScore).toBe(85);
      const exD = state.scoreReport?.exhibitEvaluations.find((e) => e.id === 'D');
      expect(exD?.status).toBe('MISSED');
      expect(exD?.awardedPoints).toBe(0);
    });

    it('3.4 maintains strict exhibit secrecy during active play and unseals only upon closure', () => {
      let state = createInitialGameState();

      for (let i = 0; i < 5; i++) {
        state = gameReducer(state, {
          type: 'APPLY_AGENT_ACTION',
          payload: { action: { action: 'CLICK', targetId: '#25', thought: `turn ${i}` }, instruction: `turn ${i}` },
        });

        expect(state.scoreReport).toBeNull();
        expect(state.caseStatus).toBe('active');
        state.telegrams.forEach((t) => expect(t.exhibitRedactedStatus).toBe('SEALED'));

        const serialized = JSON.stringify(state);
        expect(serialized).not.toContain('VERIFIED');
        expect(serialized).not.toContain('CONTAMINATED');
        expect(serialized).not.toContain('MISSED');
      }

      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: { action: 'CLICK', targetId: '#30', thought: 'confirm' }, instruction: 'confirm' },
      });

      expect(state.caseStatus).toBe('closed');
      expect(state.scoreReport).not.toBeNull();
      expect(state.scoreReport?.multiplier).toBe(1.0);
    });

    it('3.5 gracefully handles corrupted or missing checkpoint evaluations', () => {
      const corruptedExhibits = [
        {
          id: 'exhibit_corrupt',
          code: 'X',
          title: 'Corrupted Checkpoint',
          weight: NaN,
          evaluate: () => ({ status: 'VERIFIED' as const, stampText: '[OK]', awardedPoints: -Infinity }),
        },
      ];

      const report = calculateScoreReport(corruptedExhibits as any, CASE_001_INITIAL_MICRO_STATE, 3);
      expect(report.closenessScore).toBe(0);
      expect(report.finalScore).toBe(0);
      expect(Number.isNaN(report.finalScore)).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Compiler Tooling & Geometry Hardening
  // =========================================================================
  describe('Suite 4: Compiler Tooling & Geometry Hardening', () => {

    it('4.1 sanitizes 300+ levels of deep DOM nesting without stack overflow or memory leaks', () => {
      const deepHtml = '<div>'.repeat(300) + '<button id="deep-btn">Deep Target</button>' + '</div>'.repeat(300);
      const report = sanitizePuzzleHtml(deepHtml);
      expect(report.sanitizedHtml).toContain('Deep Target');
      expect(report.detectedControlsCount).toBe(1);
    });

    it('4.2 validates circular transition links in FSA macro-view graph without recursion locks', () => {
      const circularManifest: PuzzleManifest = {
        ...CASE_001_MANIFEST,
        macroViews: CASE_001_MANIFEST.macroViews.map((mv, i, arr) => ({
          ...mv,
          transitions: [
            {
              targetElementId: 1,
              actionType: 'CLICK',
              destinationMacroViewId: arr[(i + 1) % arr.length].id,
            },
          ],
        })),
      };

      const result = validatePuzzleInvariants(circularManifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('4.3 clamps extreme coordinates to grid corners and stage boundary safety boxes', () => {
      expect(pixelToGrid(-999999, -999999)).toBe('A1');
      expect(pixelToGrid(999999, 999999)).toBe('D4');

      const minBadge = computeBadgeGeometry({ x: -500, y: -500, width: 20, height: 20 }, '#1');
      expect(minBadge.badgeX).toBe(2);
      expect(minBadge.badgeY).toBe(2);

      const maxBadge = computeBadgeGeometry({ x: 5000, y: 5000, width: 20, height: 20 }, '#1');
      expect(maxBadge.badgeX + maxBadge.badgeWidth).toBeLessThanOrEqual(STAGE_WIDTH - 2);
      expect(maxBadge.badgeY + maxBadge.badgeHeight).toBeLessThanOrEqual(STAGE_HEIGHT - 2);
    });

    it('4.4 verifies compiler error classes carry deterministic exit codes 0 through 7', () => {
      expect(EXIT_SUCCESS).toBe(0);
      expect(EXIT_INVALID_ARGS).toBe(1);
      expect(EXIT_RESOURCE_NOT_FOUND).toBe(2);
      expect(EXIT_SANITIZATION_FAILED).toBe(3);
      expect(EXIT_GEOMETRY_VIOLATION).toBe(4);
      expect(EXIT_INVARIANT_VIOLATION).toBe(5);
      expect(EXIT_BROWSER_ERROR).toBe(6);
      expect(EXIT_IO_ERROR).toBe(7);

      expect(new SanitizationError('Sanitization failed').exitCode).toBe(3);
      expect(new GeometryViolationError('Geometry failed').exitCode).toBe(4);
      expect(new SchemaInvariantError('Schema failed').exitCode).toBe(5);
    });

    it('4.5 neutralizes HTML/CSS sanitization evasion vectors and rejects native unstylable controls', () => {
      const forbiddenControls = [
        '<select><option>Native Dropdown</option></select>',
        '<input type="date">',
        '<input type="color">',
        '<link rel="stylesheet" href="https://cdn.example.com/remote.css">',
      ];

      for (const ctrl of forbiddenControls) {
        expect(() => sanitizePuzzleHtml(ctrl)).toThrow(SanitizationError);
      }
    });
  });

  // =========================================================================
  // SUITE 5: Full Adversarial Gameplay Session
  // =========================================================================
  describe('Suite 5: Full Adversarial Gameplay Session', () => {

    it('5.1 executes full gameplay workflow with injection attempts, practice mode toggle, and declassification', async () => {
      let state = createInitialGameState();

      const injectionResult = filterPromptSyntheticIds('click #25 directly', CASE_001_MV03_ELEMENTS);
      expect(injectionResult.isBlocked).toBe(true);

      const urlEncodedResult = filterPromptSyntheticIds('click %2325 directly', CASE_001_MV03_ELEMENTS);
      expect(urlEncodedResult.isBlocked).toBe(true);

      const zeroWidthResult = filterPromptSyntheticIds('click #2\u200B5 directly', CASE_001_MV03_ELEMENTS);
      expect(zeroWidthResult.isBlocked).toBe(true);

      const dec1 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { pageId: state.macroViewId, fields: state.microState },
        instruction: 'select tokyo to osaka',
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: decisionToAgentAction(dec1, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
          instruction: 'select tokyo to osaka',
        },
      });
      expect(state.activeLineIndex).toBe(1);
      expect(state.macroViewId).toBe('MV-02');

      const dec2 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { pageId: state.macroViewId, fields: state.microState },
        instruction: 'type TANAKA in the romaji box on the left',
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: decisionToAgentAction(dec2, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
          instruction: 'type TANAKA in the romaji box on the left',
        },
      });
      expect(state.macroViewId).toBe('MV-03');

      const dec3 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { pageId: state.macroViewId, fields: state.microState },
        instruction: 'Wait for the sale glow, then click the green ¥13,870',
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: decisionToAgentAction(dec3, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
          instruction: 'Wait for the sale glow, then click the green ¥13,870',
        },
      });
      expect(state.microState.greenCarSelected).toBe(true);
      expect(state.macroViewId).toBe('MV-04');

      const dec4 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { pageId: state.macroViewId, fields: state.microState },
        instruction: 'draw a cat in the dashed box',
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: decisionToAgentAction(dec4, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
          instruction: 'draw a cat in the dashed box',
        },
      });

      const dec5 = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: { pageId: state.macroViewId, fields: state.microState },
        instruction: 'click blue confirm button at bottom right',
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: decisionToAgentAction(dec5, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
          instruction: 'confirm booking',
        },
      });
      expect(state.microState.finalConfirmed).toBe(true);

      state = gameReducer(state, { type: 'CLOSE_CASE' });
      expect(state.caseStatus).toBe('closed');
      expect(state.scoreReport).not.toBeNull();
      expect(state.scoreReport?.linesUsed).toBe(5);
      expect(state.scoreReport?.unusedLines).toBe(1);
      expect(state.scoreReport?.multiplier).toBe(1.2);
      expect(state.scoreReport?.closenessScore).toBe(100);
      expect(state.scoreReport?.finalScore).toBe(120);

      state = gameReducer(state, { type: 'START_PRACTICE' });
      expect(state.mode).toBe('practice');
      expect(state.caseStatus).toBe('active');
      expect(state.scoreReport).toBeNull();
      expect(state.officialResult?.finalScore).toBe(120);
    });

    it('5.2 maintains strict behavioral parity between fallbackResolve and resolveLine when cloud fails', async () => {
      const instruction = 'click green clover 13870 button in 2nd row';
      const pState = {
        pageId: 'MV-03',
        fields: { ...CASE_001_INITIAL_MICRO_STATE },
      };
      const fallbackAction = fallbackResolve({
        pages: CASE_001_PUZZLE.pages,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: pState,
        instruction,
      });
      const resolvedAction = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state: pState,
        instruction,
        cloudResolver: async () => {
          throw new Error('Network offline');
        },
      });

      expect(resolvedAction.action).toBe(fallbackAction.action);
      expect(resolvedAction.mark).toBe(fallbackAction.mark);
      expect(resolvedAction.cloudFailed).toBe(true);
    });
  });
});
