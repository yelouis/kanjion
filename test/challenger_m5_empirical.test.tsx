/**
 * test/challenger_m5_empirical.test.tsx
 *
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE FOR MILESTONE 5
 * Challenger 1 (chal_m5_1)
 *
 * Verifies live React Testing Library executions across all 6 core gameplay & UX domains:
 * 1. Full Multi-Turn Game Loop (Line 01 -> Line 02 -> Line 03 -> Case Closure)
 * 2. Decoy Trap Interaction (#12 red button -> stage shake -> contaminated Exhibit D)
 * 3. Practice Mode Loop (Reopening closed case file resealing exhibits and restoring pad)
 * 4. Line 06 Auto-Closure When Player Exhausts All 6 Telegram Lines
 * 5. Clipboard Copy Feedback & Wordle-Style Clipping Text Format
 * 6. 60-Character Input Boundary Enforcement & Live Character Counter Accuracy
 */

import React, { useReducer } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../src/App';
import {
  DispatchPad,
  ExhibitsPanel,
} from '../src/components';
import {
  gameReducer,
  createInitialGameState,
} from '../src/engine/game_reducer';
import { resolveLine, decisionToAgentAction } from '../src/engine/agent';
import {
  CASE_001_EXHIBITS,
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import { calculateEfficiencyMultiplier } from '../src/engine/scoring';

describe('CHALLENGER M5: Empirical Interactive Gameplay & UX Stress Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    if (navigator.clipboard) {
      vi.mocked(navigator.clipboard.writeText).mockClear();
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // =========================================================================
  // DOMAIN 1: Full Multi-Turn Game Loop (Line 01 -> Line 02 -> Line 03 -> Closure)
  // =========================================================================
  describe('Domain 1: Full Multi-Turn Game Loop Progression', () => {
    // Custom test component representing a completely fresh, unseeded game starting at Line 01
    const FreshGameHarness: React.FC = () => {
      const [state, dispatch] = useReducer(
        gameReducer,
        undefined,
        () => createInitialGameState({ caseNumber: '#001' })
      );

      const linesUsed = state.telegrams.filter((t) => t.submitted).length;
      const { multiplier } = calculateEfficiencyMultiplier(linesUsed);

      const handleDispatch = async () => {
        if (state.caseStatus === 'closed' || state.isExecuting) return;
        const instruction = state.currentInput.trim();
        if (!instruction) return;

        dispatch({ type: 'START_EXECUTION' });
        const decision = await resolveLine({
          puzzle: CASE_001_PUZZLE,
          manifest: CASE_001_GENERATED_MANIFEST,
          state: state.puzzleState,
          instruction,
          visibleText: '',
        });
        const action = decisionToAgentAction(
          decision,
          CASE_001_PUZZLE,
          CASE_001_GENERATED_MANIFEST
        );
        dispatch({
          type: 'APPLY_AGENT_ACTION',
          payload: {
            action,
            instruction,
            exhibits: CASE_001_EXHIBITS,
          },
        });
      };

      return (
        <div>
          <DispatchPad
            telegrams={state.telegrams}
            activeLineIndex={state.activeLineIndex}
            currentInput={state.currentInput}
            onInputChange={(val) => dispatch({ type: 'SET_INPUT', payload: val })}
            onSubmitLine={handleDispatch}
            onCloseCase={() =>
              dispatch({ type: 'CLOSE_CASE', payload: { exhibits: CASE_001_EXHIBITS } })
            }
            caseStatus={state.caseStatus}
            currentMultiplier={multiplier}
          />
          <ExhibitsPanel
            caseClosed={state.caseStatus === 'closed'}
            scoreReport={state.scoreReport}
            onReopenCase={() => dispatch({ type: 'START_PRACTICE' })}
          />
        </div>
      );
    };

    it('empirically executes unseeded turn sequence: Line 01 -> Line 02 -> Line 03 -> Early Case Closure', async () => {
      const { container } = render(<FreshGameHarness />);

      // Initial Unseeded Baseline: Starts at Line 01 with 2.0x efficiency multiplier
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('2.0x');
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED/i)).toBeInTheDocument();

      // --- Turn 1 (MV-01): Dispatch Line 01 ---
      const input1 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input1, { target: { value: 'click tokyo to shin-osaka route' } });
      expect(container.querySelector('#char-counter')).toHaveTextContent('31/60');

      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Verify Turn 1 Transition: Line 01 submitted and redacted, active advances to Line 02
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 02 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('2.0x'); // 1 line used -> 5 unused -> 1.0 + 5*0.2 = 2.0x
      expect(screen.getByText(/LINE 01:/i)).toBeInTheDocument();
      expect(screen.getByTestId('line-01-model-thought')).toBeInTheDocument();

      // --- Turn 2 (MV-02): Dispatch Line 02 ---
      const input2 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input2, { target: { value: 'Type TANAKA in the romaji box on the left' } });
      const dispatchBtn2 = screen.getByRole('button', { name: /DISPATCH LINE 02/i });
      await act(async () => {
        fireEvent.click(dispatchBtn2);
      });

      // Verify Turn 2 Transition: Line 02 submitted, active advances to Line 03
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 03 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.8x'); // 2 lines used -> 4 unused -> 1.0 + 4*0.2 = 1.8x
      expect(screen.getByText(/LINE 02:/i)).toBeInTheDocument();

      // --- Turn 3 (MV-03): Dispatch Line 03 ---
      const input3 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input3, { target: { value: 'wait for sale glow then select nozomi green car' } });
      const dispatchBtn3 = screen.getByRole('button', { name: /DISPATCH LINE 03/i });
      await act(async () => {
        fireEvent.click(dispatchBtn3);
      });

      // Verify Turn 3 Transition: Line 03 submitted, active advances to Line 04, mult becomes 1.6x
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 04 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.6x'); // 3 lines used -> 3 unused -> 1.0 + 3*0.2 = 1.6x

      // --- Turn 4: Close Case File Early ---
      const closeBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      // Verification: Dispatch pad locked down
      expect(container.querySelector('#active-line-label')).toHaveTextContent('CASE CLOSED');
      expect(container.querySelector('#telegram-input')).not.toBeInTheDocument();

      // Verification: Unsealed Exhibits & Closeness Calculation
      // Exhibits A (+25%), B (+20%), C (+20%), D Missed (+0%), E Missed (+0%) = 65%
      // Multiplier: 3 lines used (Lines 1, 2, 3) -> 3 lines unused -> 1.0 + 3*0.2 = 1.6x
      // Final Score: round(65 * 1.6) = 104 PTS
      const unsealedPanel = container.querySelector('#unsealed-exhibits-panel');
      expect(unsealedPanel).toBeInTheDocument();
      expect(container.querySelector('#final-score-banner')).toHaveTextContent('65% × 1.6x = 104 PTS');

      // Verify Rubber Stamp statuses
      expect(container.querySelector('#exhibit-a-stamp')).toHaveTextContent('[VERIFIED ✓ +25%]');
      expect(container.querySelector('#exhibit-b-stamp')).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(container.querySelector('#exhibit-c-stamp')).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(container.querySelector('#exhibit-d-stamp')).toHaveTextContent('[MISSED ✗ +0%]');
      expect(container.querySelector('#exhibit-e-stamp')).toHaveTextContent('[MISSED ✗ +0%]');

      // Verify Shareable Wordle emoji row
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩⬜⬜ (3/6 Telegrams Sent)');
    });

    it('empirically verifies golden path progression in top-level <App /> starting at Line 01', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      // Starts at Line 01 with all 6 instructions available
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');

      const steps = [
        'Click the blue card on the right',
        'Type TANAKA in the romaji box on the left',
        'Wait for the sale glow, then click the green ¥13,870',
        'Draw a cat in the dashed box',
        'confirm booking',
      ];

      for (let i = 0; i < steps.length; i++) {
        const inputEl = container.querySelector('#telegram-input') as HTMLInputElement;
        fireEvent.change(inputEl, { target: { value: steps[i] } });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(`DISPATCH LINE 0${i + 1}`, 'i') }));
        });
        expect(container.querySelector('#active-line-label')).toHaveTextContent(`LINE 0${i + 2} / 06`);
      }

      // Close Case: 5 lines used, 1 unused -> 100% x 1.2x = 120 PTS
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      expect(container.querySelector('#final-score-banner')).toHaveTextContent('100% × 1.2x = 120 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩🟩🟩 (5/6 Telegrams Sent)');
    });
  });

  // =========================================================================
  // DOMAIN 2: Decoy Trap Interaction & Exhibit D Contamination
  // =========================================================================
  describe('Domain 2: Decoy Trap Interaction (#12 Red Button)', () => {
    it('empirically triggers stage shake and contaminates Exhibit D via natural language dispatch', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      const input = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'click the red button' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 01/i }));
      });

      // 1. Stage Shake error class applied to virtual stage core
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).toHaveClass('shake-anim');

      // 2. Yellow thought note executes without spoiling "trap detected"
      const agentNote = container.querySelector('#agent-note');
      expect(agentNote).toHaveTextContent(/\[ACTION EXECUTED\]/i);
      expect(agentNote).not.toHaveTextContent(/TRAP DETECTED/i);

      // 3. Shake automatically expires after 400ms timeout
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(stageCore).not.toHaveClass('shake-anim');

      // 4. Close case and verify Exhibit D is not verified
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[MISSED ✗ +0%]');
      expect(stampD).toHaveClass('border-dossier-stampRed', 'text-dossier-stampRed');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('⬜⬜⬜⬜⬜');
    });

    it('empirically blocks direct manual webpage clicks in prompt-only mode without contaminating Exhibit D', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      // Direct click on the red promo insurance button (#12) in the Japanese sandbox
      const promoBtn = container.querySelector('#btn-promo-insurance') as HTMLButtonElement;
      expect(promoBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(promoBtn);
      });

      // Verify manual click is silently ignored (no warning banner shown and stage was NOT mutated)
      expect(screen.queryByTestId('manual-click-warning')).not.toBeInTheDocument();
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).not.toHaveClass('shake-anim');

      // Close case and verify Exhibit D was not contaminated by manual click
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[MISSED ✗ +0%]');
    });

    it('empirically enforces trap detour: subsequent green car pick still requires returning from MV-06', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      const prompts = [
        'click the red button',
        CASE_001_PUZZLE.answerKey[0],
        CASE_001_PUZZLE.answerKey[1],
        CASE_001_PUZZLE.answerKey[2],
        'click the red button',
      ];

      for (let i = 0; i < prompts.length; i++) {
        const inputEl = container.querySelector('#telegram-input') as HTMLInputElement;
        fireEvent.change(inputEl, { target: { value: prompts[i] } });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(`DISPATCH LINE 0${i + 1}`, 'i') }));
        });
      }

      // Close case
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      // Exhibits A, B, C verified, Exhibit D and E missed (ran out of steps to sign & confirm)
      expect(container.querySelector('#exhibit-a-stamp')).toHaveTextContent('[VERIFIED ✓ +25%]');
      expect(container.querySelector('#exhibit-b-stamp')).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(container.querySelector('#exhibit-c-stamp')).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(container.querySelector('#exhibit-d-stamp')).toHaveTextContent('[MISSED ✗ +0%]');
      // Closeness is 25 (A) + 20 (B) + 20 (C) + 0 (D missed) + 0 (E missed) = 65%
      // 5 lines used, 1 unused -> 1.2x multiplier -> round(65 * 1.2) = 78 PTS
      expect(container.querySelector('#final-score-banner')).toHaveTextContent('65% × 1.2x = 78 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩⬜⬜ (5/6 Telegrams Sent)');
    });
  });

  // =========================================================================
  // DOMAIN 3: Practice Mode Loop (Reopening Closed Case File)
  // =========================================================================
  describe('Domain 3: Practice Mode Loop & State Resealing', () => {
    it('empirically reseals exhibits, restores dispatch pad, and maintains sandbox consistency on reopen', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      // Close case immediately
      const closeBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
      await act(async () => {
        fireEvent.click(closeBtn);
      });

      // Assert Closed State
      expect(container.querySelector('#unsealed-exhibits-panel')).toBeInTheDocument();
      expect(container.querySelector('#sealed-status-pill')).toHaveTextContent(/🔓 UNSEALED/i);
      expect(container.querySelector('#telegram-input')).not.toBeInTheDocument();

      // Click "↺ Practice this case (unscored)"
      const reopenBtn = screen.getByRole('button', { name: /Practice this case \(unscored\)/i });
      await act(async () => {
        fireEvent.click(reopenBtn);
      });

      // 1. Unsealed panel is completely removed
      expect(container.querySelector('#unsealed-exhibits-panel')).not.toBeInTheDocument();

      // 2. Sealed teaser preview is restored
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED/i)).toBeInTheDocument();

      // 3. Status pill shows practice mode
      expect(container.querySelector('#sealed-status-pill')).toHaveTextContent(/PRACTICE — NOT SCORED/i);

      // 4. Dispatch pad input is restored and operational at Line 01
      const restoredInput = container.querySelector('#telegram-input') as HTMLInputElement;
      expect(restoredInput).toBeInTheDocument();
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');

      // 5. Player can continue typing and dispatching in practice mode
      fireEvent.change(restoredInput, { target: { value: 'Click the blue card on the right' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 01/i }));
      });
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 02 / 06');

      // 6. Case can be closed again with updated state
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });
      expect(container.querySelector('#unsealed-exhibits-panel')).toBeInTheDocument();
      expect(container.querySelector('#exhibit-a-stamp')).toHaveTextContent('[VERIFIED ✓ +25%]');
    });
  });

  // =========================================================================
  // DOMAIN 4: Line 06 Auto-Closure on Exhaustion
  // =========================================================================
  describe('Domain 4: Line 06 Exhaustion & Auto-Closure Trigger', () => {
    it('empirically triggers automatic case closure on 6th telegram dispatch with 1.0x multiplier', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      const prompts = [
        'Click the blue card on the right',
        'Type TANAKA in the romaji box on the left',
        'Wait for the sale glow, then click the green ¥13,870',
        'Draw a cat in the dashed box',
        'confirm booking',
        'final dispatch confirmation',
      ];

      for (let i = 0; i < 6; i++) {
        const inputEl = container.querySelector('#telegram-input') as HTMLInputElement;
        fireEvent.change(inputEl, { target: { value: prompts[i] } });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(`DISPATCH LINE 0${i + 1}`, 'i') }));
        });
      }

      // Verification: Case automatically closed WITHOUT clicking "Close Case File"
      expect(container.querySelector('#sealed-status-pill')).toHaveTextContent(/🔓 UNSEALED \(CASE CLOSED\)/i);
      expect(container.querySelector('#unsealed-exhibits-panel')).toBeInTheDocument();
      expect(container.querySelector('#telegram-input')).not.toBeInTheDocument();

      // Verification: Score is 100% closeness x 1.0x multiplier = 100 PTS
      expect(container.querySelector('#final-score-banner')).toHaveTextContent('100% × 1.0x = 100 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩🟩🟩 (6/6 Telegrams Sent)');
      expect(container.querySelector('#share-summary-txt')).toHaveTextContent('100% × 1.0x = 100 PTS');
    });
  });

  // =========================================================================
  // DOMAIN 5: Clipboard Copy Feedback & Wordle-Style Plaintext Format
  // =========================================================================
  describe('Domain 5: Clipboard Copy Feedback & Forensic Formatting', () => {
    it('empirically verifies clipboard export format, tactile UI feedback, and revert timer', async () => {
      render(<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />);

      // Close case
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
      expect(copyBtn).toHaveTextContent('📋 Copy Case Clipping');
      expect(copyBtn).toHaveClass('bg-dossier-ink', 'text-dossier-accent');

      // Click copy button
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      // 1. Tactile UI feedback activated
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByText('✓ DISPATCH CLIPPING COPIED!')).toBeInTheDocument();
      expect(copyBtn).toHaveClass('bg-emerald-700', 'text-white');

      // 2. Exact Wordle-style formatting verification
      const copiedPayload = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
      const lines = copiedPayload.split('\n');
      expect(lines.length).toBe(3);

      // Line 1: KANJION #001 🇯🇵 — Closeness% × Mult = Score PTS
      expect(lines[0]).toMatch(/^KANJION #001 🇯🇵 — \d+% × \d+\.\d+x = \d+ PTS$/);

      // Line 2: 5-symbol emoji matrix + (X/6 Telegrams Sent)
      expect(lines[1]).toMatch(/^[🟩🟥⬜]{5} \(\d\/6 Telegrams Sent\)$/u);

      // Line 3: Canonical forensic URL
      expect(lines[2]).toBe('https://kanjion-game.web.app');

      // 3. Feedback reverts after 2500ms
      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(copyBtn).toHaveTextContent('📋 Copy Case Clipping');
      expect(copyBtn).not.toHaveClass('bg-emerald-700');
    });

    it('empirically handles clipboard write rejection without throwing UI errors', async () => {
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard permission denied'));

      render(<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /CLOSE CASE FILE/i }));
      });

      const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      // UI should still show feedback gracefully without crashing
      expect(screen.getByText('✓ DISPATCH CLIPPING COPIED!')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // DOMAIN 6: 60-Character Input Boundary & Character Counter Accuracy
  // =========================================================================
  describe('Domain 6: 60-Character Input Boundary & Character Counter', () => {
    it('empirically tracks character counter across 0, 1, 30, 59, and 60 chars with warning highlight', () => {
      const handleInputChange = vi.fn();
      const createTel = () =>
        Array.from({ length: 6 }, (_, i) => ({
          lineNumber: i + 1,
          text: '',
          submitted: false,
          exhibitRedactedStatus: 'SEALED' as const,
        }));

      const { rerender } = render(
        <DispatchPad
          telegrams={createTel()}
          activeLineIndex={0}
          currentInput=""
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      // 0 chars
      const counter = screen.getByText('0/60');
      expect(counter).toBeInTheDocument();
      expect(counter).toHaveClass('text-dossier-muted');

      // 1 char
      rerender(
        <DispatchPad
          telegrams={createTel()}
          activeLineIndex={0}
          currentInput="A"
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );
      expect(screen.getByText('1/60')).toHaveClass('text-dossier-muted');

      // 30 chars
      rerender(
        <DispatchPad
          telegrams={createTel()}
          activeLineIndex={0}
          currentInput={'X'.repeat(30)}
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );
      expect(screen.getByText('30/60')).toHaveClass('text-dossier-muted');

      // 59 chars (boundary safe)
      rerender(
        <DispatchPad
          telegrams={createTel()}
          activeLineIndex={0}
          currentInput={'Y'.repeat(59)}
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );
      expect(screen.getByText('59/60')).not.toHaveClass('text-red-700');

      // 60 chars (boundary maximum) -> switches to warning color text-red-700 font-black
      rerender(
        <DispatchPad
          telegrams={createTel()}
          activeLineIndex={0}
          currentInput={'Z'.repeat(60)}
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );
      const capCounter = screen.getByText('60/60');
      expect(capCounter).toHaveClass('text-red-700', 'font-black');
    });

    it('empirically enforces strict 60-character slicing on typing overflow', () => {
      const handleInputChange = vi.fn();
      render(
        <DispatchPad
          telegrams={Array.from({ length: 6 }, (_, i) => ({
            lineNumber: i + 1,
            text: '',
            submitted: false,
            exhibitRedactedStatus: 'SEALED' as const,
          }))}
          activeLineIndex={0}
          currentInput=""
          onInputChange={handleInputChange}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.maxLength).toBe(60);

      // Simulate typing a 90-character prompt
      const longString = 'A'.repeat(90);
      fireEvent.change(input, { target: { value: longString } });

      // onInputChange received slice(0, 60)
      expect(handleInputChange).toHaveBeenCalledWith('A'.repeat(60));
    });

    it('empirically rejects empty and whitespace-only submissions with shake animation', () => {
      const submitLineMock = vi.fn();
      const { container } = render(
        <DispatchPad
          telegrams={Array.from({ length: 6 }, (_, i) => ({
            lineNumber: i + 1,
            text: '',
            submitted: false,
            exhibitRedactedStatus: 'SEALED' as const,
          }))}
          activeLineIndex={0}
          currentInput={'   \t   '}
          onInputChange={vi.fn()}
          onSubmitLine={submitLineMock}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
      fireEvent.click(dispatchBtn);

      // submitLine was NOT called
      expect(submitLineMock).not.toHaveBeenCalled();

      // Row received shake animation
      const activeRow = container.querySelector('.shake-anim');
      expect(activeRow).toBeInTheDocument();
      expect(activeRow).toHaveClass('border-red-600');

      // Shake animation expires after 400ms
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(container.querySelector('.shake-anim')).not.toBeInTheDocument();
    });

    it('empirically submits on Enter key when input is valid', () => {
      const submitLineMock = vi.fn();
      render(
        <DispatchPad
          telegrams={Array.from({ length: 6 }, (_, i) => ({
            lineNumber: i + 1,
            text: '',
            submitted: false,
            exhibitRedactedStatus: 'SEALED' as const,
          }))}
          activeLineIndex={0}
          currentInput="valid instruction"
          onInputChange={vi.fn()}
          onSubmitLine={submitLineMock}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(submitLineMock).toHaveBeenCalledTimes(1);
    });
  });
});
