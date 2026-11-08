/**
 * test/e2e_adversarial_hardening.test.ts
 *
 * Milestone 5: Tier 5 Comprehensive Adversarial Hardening Suite for Instruct.
 *
 * Verifies end-to-end adversarial robustness across:
 * 1. UI & Presentation Layer: Rapid multi-line dispatches, focus management,
 *    empty line rejections, stage copy-paste prevention, ruler scaling invariants (375px, 600px, 768px, 1024px).
 * 2. Engine & Security Guardrails: Prompt injection evasions (zero-width chars, homoglyphs, URL encoding),
 *    goal blindness, client DOM sanitization, network timeouts, and malformed JSON recovery.
 * 3. Scoring & Reducer Immutability: Deeply frozen state trees, score cap enforcement (100% closeness x unused lines),
 *    negative score prevention, trap permanence, and corrupted exhibit evaluations.
 * 4. Compiler & Tooling Stress: 300+ deep DOM nesting, circular transition links in FSA graph,
 *    extreme coordinates, badge boundary clamping, and deterministic exit codes 0-7.
 * 5. Full Adversarial Gameplay Session: Injection attempts, practice mode toggle, and declassified exhibits.
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
  OfflineSimulationEngine,
} from '../src/engine/offline_simulator';
import {
  CloudVisionConnector,
  MockVisionLLMTransport,
  assertGoalBlindness,
  sanitizeDomForClient,
  filterPromptSyntheticIds,
  buildMultimodalPrompt,
  validateLLMOutput,
} from '../src/engine/cloud_connector';

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

// Case File #042 Fixtures
import {
  CASE_042_MANIFEST,
  CASE_042_MACRO_VIEWS,
  CASE_042_MV03_ELEMENTS,
  CASE_042_INITIAL_MICRO_STATE,
} from '../src/data/puzzles/case_042';

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

      // Simulate 10 rapid concurrent dispatch attempts
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

      // Line progression must strictly advance sequentially up to 6 max
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

      // Rerender as closed
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

      // Input must be removed cleanly and replaced with lockout badge
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

      // Zero-width characters (e.g. \u200B) normalize to empty string
      const zeroWidthPayload = '\u200B\u200C\u200D\uFEFF';
      const normalizedZero = normalizeInstruction(zeroWidthPayload);
      expect(normalizedZero).toBe('');
    });

    it('1.4 intercepts all 5 prohibited clipboard/drag events across deep nested sandbox elements', () => {
      const mv03State = {
        ...CASE_042_INITIAL_MICRO_STATE,
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
            ghostReplayActive: false,
            somOverlayActive: false,
            stageShake: false,
          },
          React.createElement(ShinkansenSandbox, { microState: mv03State })
        )
      );

      const stage = screen.getByTestId('sandbox-stage');
      const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥13,870/i });

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
            microState: CASE_042_INITIAL_MICRO_STATE,
            agentCursor: defaultCursor,
            ghostReplayActive: false,
            somOverlayActive: false,
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
      const mv03 = CASE_042_MACRO_VIEWS.find((mv) => mv.id === 'MV-03')!;
      const cleanPrompt = buildMultimodalPrompt(mv03, CASE_042_INITIAL_MICRO_STATE, 'select green car');

      expect(() => assertGoalBlindness(cleanPrompt.contextJson)).not.toThrow();

      // Guardrail throws on forbidden keywords
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
          assertGoalBlindness({ ...cleanPrompt.contextJson, ...leak });
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
      // Evasion vectors targeting synthetic ID #25:
      // Includes explicit marks, fullwidth numbers, circled digits, URL percent encoding, and zero-width characters
      const evasionAttempts = [
        'click #25',
        'click mark 25',
        'click badge 25',
        'click tag 25',
        'click som_25',
        'click 25',
        'click ＃２５', // Fullwidth unicode
        'click ㉕',     // Circled numeral 25
        'click %2325',  // URL encoded #25
        'click mark%2025', // URL encoded space
        'click %32%35', // URL encoded digits '2' and '5'
        'click badge%20%2325', // URL encoded badge #25
        'click %23%32%35', // Fully URL encoded #25
        'click%20%2325',
        'click%2025',
        'click 2\u200B5', // Embedded zero-width space in digits
        'click #2\u200B5', // Embedded zero-width space with mark
        'click #\u200B25', // Leading zero-width space
        'click mark\u200B25', // Zero-width space in mark keyword
        'click 2\u200C5', // Zero-width non-joiner
        'click 2\u200D5', // Zero-width joiner
        'click 2\uFEFF5', // Zero-width no-break space / BOM
        'click 2\u200B\u200C\u200D5', // Multi-character zero-width sequence
      ];

      for (const attempt of evasionAttempts) {
        const res = filterPromptSyntheticIds(attempt, CASE_042_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(true);
      }

      // Permitted visible fare literals & legitimate percent expressions (must NOT be blocked)
      const permittedInputs = [
        'select ¥14,520',
        'select ¥14,720',
        'choose 13870',
        'click ¥13,870',
        'select ¥2,400',
        '10% discount on ¥13,870',
      ];

      for (const fare of permittedInputs) {
        const res = filterPromptSyntheticIds(fare, CASE_042_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(false);
      }
    });

    it('2.4 recovers gracefully from network timeouts and 500 errors via offline engine fallback', async () => {
      const mockTransport = new MockVisionLLMTransport();
      mockTransport.setSimulateError(true, 'Gateway Timeout (504)');

      const connector = new CloudVisionConnector({
        puzzleId: 'case_042',
        macroViews: CASE_042_MACRO_VIEWS,
        transport: mockTransport,
        fallbackEngine: new OfflineSimulationEngine(CASE_042_MACRO_VIEWS),
      });

      const action = await connector.resolveInstruction('MV-03', CASE_042_INITIAL_MICRO_STATE, 'click green clover');
      expect(action.action).toBe('CLICK');
      expect(action.targetId).toBe('#25');
      expect(action.thought).toContain('(Offline Fallback)');
      expect(action.thought.length).toBeLessThanOrEqual(80);
    });

    it('2.5 validates and recovers from malformed, truncated, or markdown-wrapped LLM JSON outputs', () => {
      // Markdown code fence wrapped JSON
      const fenced = '```json\n{"action": "CLICK", "target_id": 25, "thought": "Fenced"}\n```';
      const parsedFenced = validateLLMOutput(fenced);
      expect(parsedFenced.action).toBe('CLICK');
      expect(parsedFenced.target_id).toBe(25);

      // Malformed non-JSON
      const malformed = 'Error: upstream connect failed or disconnect/reset before headers';
      const parsedBad = validateLLMOutput(malformed);
      expect(parsedBad.action).toBe('CONFUSED');
      expect(parsedBad.target_id).toBeNull();

      // Schema invalid action
      const invalidAction = validateLLMOutput({ action: 'EXPLODE', target_id: 25, thought: 'Invalid' });
      expect(invalidAction.action).toBe('CONFUSED');

      // Overflowing thought clamped strictly to <= 80 chars
      const overLong = validateLLMOutput({ action: 'CLICK', target_id: 25, thought: 'X'.repeat(200) });
      expect(overLong.thought.length).toBeLessThanOrEqual(80);
      expect(overLong.thought.endsWith('...')).toBe(true);
    });

    it('2.6 handles malformed URL percent escapes and validates connector rejection of encoded evasions', async () => {
      // Malformed URL sequences must not throw uncaught URIError exceptions
      const malformedInputs = [
        'select 50% discount',
        'get +20% bonus',
        'click %ZZ25',
        'click %E0%A4%A',
        'click %2',
        'click %',
      ];

      for (const input of malformedInputs) {
        expect(() => filterPromptSyntheticIds(input, CASE_042_MV03_ELEMENTS)).not.toThrow();
        const res = filterPromptSyntheticIds(input, CASE_042_MV03_ELEMENTS);
        expect(res.isBlocked).toBe(false);
      }

      // Malformed escape combined with synthetic mark ID must still be blocked
      const resMalformedWithTarget = filterPromptSyntheticIds('click %E0%A4%A #25', CASE_042_MV03_ELEMENTS);
      expect(resMalformedWithTarget.isBlocked).toBe(true);
      expect(resMalformedWithTarget.flaggedId).toBe(25);

      // Verify CloudVisionConnector integration: URL-encoded and zero-width inputs are blocked at guardrail
      const mockTransport = new MockVisionLLMTransport();
      const connector = new CloudVisionConnector({
        puzzleId: 'case_042',
        macroViews: CASE_042_MACRO_VIEWS,
        transport: mockTransport,
      });

      const evasionPrompts = ['click %2325', 'click 2\u200B5', 'click mark%2025'];
      for (const prompt of evasionPrompts) {
        mockTransport.recordedRequests = [];
        const action = await connector.resolveInstruction('MV-03', CASE_042_INITIAL_MICRO_STATE, prompt);
        expect(action.action).toBe('CONFUSED');
        expect(action.thought).toBe('📌 FIELD NOTE: Synthetic mark IDs cannot be targeted directly.');
        expect(mockTransport.recordedRequests.length).toBe(0);
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

      // Mutating dispatches must return new copies without throwing TypeError
      const nextInput = gameReducer(state, { type: 'SET_INPUT', payload: 'immutable test' });
      expect(nextInput).not.toBe(state);
      expect(nextInput.currentInput).toBe('immutable test');

      const nextExec = gameReducer(state, { type: 'START_EXECUTION' });
      expect(nextExec).not.toBe(state);
      expect(nextExec.isExecuting).toBe(true);

      const nextGhost = gameReducer(state, { type: 'TOGGLE_GHOST_REPLAY' });
      expect(nextGhost).not.toBe(state);
      expect(nextGhost.ghostReplayActive).toBe(true);
    });

    it('3.2 enforces mathematical clamping: closeness [0, 100], multiplier [1.0, 2.0], score [0, 200]', () => {
      // Closeness bounds
      expect(calculateClosenessScore([])).toBe(0);
      expect(calculateClosenessScore([{ id: 'ex', code: 'A', title: 'T', weight: 500, status: 'VERIFIED', stampText: '', rotationDeg: 0, awardedPoints: 500 }])).toBe(100);

      // Multiplier bounds
      expect(calculateEfficiencyMultiplier(-10).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(0).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(1).multiplier).toBe(2.0);
      expect(calculateEfficiencyMultiplier(6).multiplier).toBe(1.0);
      expect(calculateEfficiencyMultiplier(999).multiplier).toBe(1.0);

      // Final score clamps
      expect(calculateFinalScore(100, 2.0)).toBe(200);
      expect(calculateFinalScore(500, 5.0)).toBe(200);
      expect(calculateFinalScore(-50, 1.5)).toBe(0);
    });

    it('3.3 verifies trap contamination of Exhibit D is permanent and cannot be laundered', () => {
      let state = createInitialGameState({
        initialMicroState: {
          ...CASE_042_INITIAL_MICRO_STATE,
          macroViewId: 'MV-03',
          selectedRoute: 'tokyo_osaka',
          departureTime: '14:30',
          passengerName: 'TANAKA',
          signatureSigned: true,
        },
      });

      // Step 1: Hit Decoy Trap #12 (Promo Banner)
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#12', thought: 'Promo banner', isTrap: true },
          instruction: 'click promo',
        },
      });

      expect(state.microState.insuranceTrapHit).toBe(true);

      // Step 2: Untoggle Checkbox #28
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#28', thought: 'Uncheck box' },
          instruction: 'uncheck insurance',
        },
      });

      // Trap hit remains true permanently
      expect(state.microState.insuranceCheckboxChecked).toBe(false);
      expect(state.microState.insuranceTrapHit).toBe(true);

      // Step 3: Perform target actions (#25 Green Car, #30 Confirm) and close case
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: { action: 'CLICK', targetId: '#25', thought: 'Green car' }, instruction: 'green car' },
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: { action: 'CLICK', targetId: '#30', thought: 'Confirm' }, instruction: 'confirm' },
      });
      state = gameReducer(state, { type: 'CLOSE_CASE' });

      // Exhibit D must be CONTAMINATED, capped at 85% closeness
      expect(state.scoreReport?.closenessScore).toBe(85);
      const exD = state.scoreReport?.exhibitEvaluations.find((e) => e.id === 'exhibit_d');
      expect(exD?.status).toBe('CONTAMINATED');
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

        // Serialized state must not contain stamp keywords
        const serialized = JSON.stringify(state);
        expect(serialized).not.toContain('VERIFIED');
        expect(serialized).not.toContain('CONTAMINATED');
        expect(serialized).not.toContain('MISSED');
      }

      // 6th line auto-closes case and populates report
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

      const report = calculateScoreReport(corruptedExhibits as any, CASE_042_INITIAL_MICRO_STATE, 3);
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
        ...CASE_042_MANIFEST,
        macroViews: CASE_042_MANIFEST.macroViews.map((mv, i, arr) => ({
          ...mv,
          transitions: [
            {
              targetElementId: 1,
              actionType: 'CLICK',
              destinationMacroViewId: arr[(i + 1) % arr.length].id, // 0->1->2->...->0
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

      // Badges must stay within [2, 1022] x [2, 766]
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
      const engine = new OfflineSimulationEngine(CASE_042_MACRO_VIEWS);

      // Line 1: Attempt prompt injection targeting synthetic mark ID #25 (standard, URL-encoded, and zero-width)
      const injectionResult = filterPromptSyntheticIds('click #25 directly', CASE_042_MV03_ELEMENTS);
      expect(injectionResult.isBlocked).toBe(true);

      const urlEncodedResult = filterPromptSyntheticIds('click %2325 directly', CASE_042_MV03_ELEMENTS);
      expect(urlEncodedResult.isBlocked).toBe(true);

      const zeroWidthResult = filterPromptSyntheticIds('click 2\u200B5 directly', CASE_042_MV03_ELEMENTS);
      expect(zeroWidthResult.isBlocked).toBe(true);

      // Line 1: Select route on MV-01
      const act1 = engine.resolveInstruction(state.macroViewId, state.microState, 'select tokyo to osaka');
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: act1, instruction: 'select tokyo to osaka' },
      });
      expect(state.activeLineIndex).toBe(1);
      expect(state.macroViewId).toBe('MV-02');

      // Line 2: Type passenger name on MV-02
      const act2 = engine.resolveInstruction(state.macroViewId, state.microState, 'type TANAKA in the passenger name box');
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: act2, instruction: 'type TANAKA in the passenger name box' },
      });
      expect(state.macroViewId).toBe('MV-03');

      // Line 3: Valid green car selection on MV-03
      const act3 = engine.resolveInstruction(state.macroViewId, state.microState, 'click green clover ¥13,870');
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: act3, instruction: 'click green clover' },
      });
      expect(state.microState.greenCarSelected).toBe(true);
      expect(state.macroViewId).toBe('MV-04');

      // Line 4: Draw signature on MV-04
      const act4 = engine.resolveInstruction(state.macroViewId, state.microState, 'draw a signature in the dashed box');
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: act4, instruction: 'draw a signature in the dashed box' },
      });

      // Line 5: Confirm booking on MV-04
      const act5 = engine.resolveInstruction(state.macroViewId, state.microState, 'click blue confirm button at D4');
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: { action: act5, instruction: 'confirm booking' },
      });
      expect(state.microState.finalConfirmed).toBe(true);

      // Early close case to lock in efficiency multiplier
      state = gameReducer(state, { type: 'CLOSE_CASE' });
      expect(state.caseStatus).toBe('closed');
      expect(state.scoreReport).not.toBeNull();
      expect(state.scoreReport?.linesUsed).toBe(5);
      expect(state.scoreReport?.unusedLines).toBe(1);
      expect(state.scoreReport?.multiplier).toBe(1.2);
      expect(state.scoreReport?.closenessScore).toBe(100);
      expect(state.scoreReport?.finalScore).toBe(120); // 100 * 1.2 = 120 PTS

      // Practice mode: Reopen case
      state = gameReducer(state, { type: 'REOPEN_CASE' });
      expect(state.caseStatus).toBe('active');
      expect(state.scoreReport).toBeNull();
    });

    it('5.2 maintains strict behavioral parity between offline engine and cloud connector fallback', async () => {
      const offlineEngine = new OfflineSimulationEngine(CASE_042_MACRO_VIEWS);
      const mockTransport = new MockVisionLLMTransport();
      mockTransport.setSimulateError(true, 'Network offline');

      const cloudConnector = new CloudVisionConnector({
        puzzleId: 'case_042',
        macroViews: CASE_042_MACRO_VIEWS,
        transport: mockTransport,
        fallbackEngine: offlineEngine,
      });

      const instruction = 'click green clover 13870 button in 2nd row';
      const offlineAction = offlineEngine.resolveInstruction('MV-03', CASE_042_INITIAL_MICRO_STATE, instruction);
      const cloudAction = await cloudConnector.resolveInstruction('MV-03', CASE_042_INITIAL_MICRO_STATE, instruction);

      expect(cloudAction.action).toBe(offlineAction.action);
      expect(cloudAction.targetId).toBe(offlineAction.targetId);
      expect(cloudAction.gridRef).toBe(offlineAction.gridRef);
      expect(cloudAction.thought).toContain('(Offline Fallback)');
    });
  });
});
