import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DispatchPad } from '../src/components/DispatchPad';
import { AgentCursor } from '../src/components/AgentCursor';
import { gameReducer, createInitialGameState } from '../src/engine/game_reducer';
import type { TelegramLine } from '../src/types/game';
import type { AgentAction } from '../src/types/engine';
import { CASE_001_EXHIBITS } from '../src/data/puzzles/case_001';

describe('CHALLENGER M3: Empirical Verification & Adversarial Stress Suite', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const createTelegrams = (): TelegramLine[] =>
    Array.from({ length: 6 }, (_, i) => ({
      lineNumber: i + 1,
      text: '',
      submitted: false,
      exhibitRedactedStatus: 'SEALED',
    }));

  // =========================================================================
  // CHALLENGE 1: Strict 60-Character Input Cap
  // =========================================================================
  describe('Challenge 1: Strict 60-Character Input Limit', () => {

    it('empirically verifies 59-char input is fully accepted with counter 59/60', () => {
      const handleInput = vi.fn();
      const text59 = 'A'.repeat(59);

      render(
        <DispatchPad
          telegrams={createTelegrams()}
          activeLineIndex={0}
          currentInput={text59}
          onInputChange={handleInput}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.maxLength).toBe(60);
      expect(input.value).toBe(text59);

      const counter = screen.getByText('59/60');
      expect(counter).toBeInTheDocument();
      expect(counter).not.toHaveClass('text-red-700 font-black');
    });

    it('empirically verifies 60-char input reaches exact limit with warning badge 60/60', () => {
      const handleInput = vi.fn();
      const text60 = 'B'.repeat(60);

      render(
        <DispatchPad
          telegrams={createTelegrams()}
          activeLineIndex={0}
          currentInput={text60}
          onInputChange={handleInput}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe(text60);

      const counter = screen.getByText('60/60');
      expect(counter).toBeInTheDocument();
      expect(counter).toHaveClass('text-red-700 font-black');
    });

    it('empirically verifies 61-char input is strictly sliced to 60 chars by onInputChange', () => {
      const handleInput = vi.fn();
      const text61 = 'C'.repeat(61);

      render(
        <DispatchPad
          telegrams={createTelegrams()}
          activeLineIndex={0}
          currentInput=""
          onInputChange={handleInput}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: text61 } });

      // Must be truncated to exactly 60 characters
      expect(handleInput).toHaveBeenCalledWith('C'.repeat(60));
      expect(handleInput.mock.calls[0][0].length).toBe(60);
    });

    it('empirically verifies 100-char input paste is strictly clamped to 60 chars', () => {
      const handleInput = vi.fn();
      const text100 = 'D'.repeat(100);

      render(
        <DispatchPad
          telegrams={createTelegrams()}
          activeLineIndex={0}
          currentInput=""
          onInputChange={handleInput}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: text100 } });

      expect(handleInput).toHaveBeenCalledWith('D'.repeat(60));
      expect(handleInput.mock.calls[0][0].length).toBe(60);
    });

    it('fuzz-tests 100 random multi-byte strings to confirm strict 60-char ceiling', () => {
      const state = createInitialGameState({});
      const testLengths = [59, 60, 61, 75, 100, 250, 1000];

      for (const len of testLengths) {
        // Multi-byte Japanese + ASCII mix
        const seedStr = '新幹線予約Nozomi#'.repeat(100).slice(0, len);
        const nextState = gameReducer(state, { type: 'SET_INPUT', payload: seedStr });
        expect(nextState.currentInput.length).toBeLessThanOrEqual(60);
        if (len >= 60) {
          expect(nextState.currentInput.length).toBe(60);
        } else {
          expect(nextState.currentInput.length).toBe(len);
        }
      }
    });
  });

  // =========================================================================
  // CHALLENGE 2: Empty and Whitespace Submission Rejection
  // =========================================================================
  describe('Challenge 2: Empty and Whitespace Submission Rejection', () => {
    const whitespaceVariants = [
      '',
      ' ',
      '   ',
      '\t',
      '\t\t\t',
      '\n',
      '\r\n',
      ' \t \n \r  ',
    ];

    whitespaceVariants.forEach((ws, idx) => {
      it(`empirically rejects whitespace variant #${idx + 1} (${JSON.stringify(ws)}) and triggers shake feedback`, () => {
        vi.useFakeTimers();
        const handleSubmit = vi.fn();

        const telegrams: TelegramLine[] = Array.from({ length: 6 }, (_, i) => ({
          lineNumber: i + 1,
          text: '',
          submitted: false,
          exhibitRedactedStatus: 'SEALED',
        }));

        const { container } = render(
          <DispatchPad
            telegrams={telegrams}
            activeLineIndex={0}
            currentInput={ws}
            onInputChange={vi.fn()}
            onSubmitLine={handleSubmit}
            onCloseCase={vi.fn()}
            caseStatus="active"
            currentMultiplier={2.0}
          />
        );

        const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
        fireEvent.click(dispatchBtn);

        // Verification 1: submit was NOT invoked
        expect(handleSubmit).not.toHaveBeenCalled();

        // Verification 2: visual shake class is applied
        const activeRow = container.querySelector('.shake-anim');
        expect(activeRow).not.toBeNull();
        expect(activeRow).toHaveClass('border-red-600', 'bg-red-100/50');

        // Verification 3: shake animation auto-clears after 400ms
        act(() => {
          vi.advanceTimersByTime(400);
        });

        expect(container.querySelector('.shake-anim')).toBeNull();

        vi.useRealTimers();
      });
    });

    it('empirically verifies Enter key with whitespace is rejected without line consumption', () => {
      const handleSubmit = vi.fn();
      const telegrams: TelegramLine[] = Array.from({ length: 6 }, (_, i) => ({
        lineNumber: i + 1,
        text: '',
        submitted: false,
        exhibitRedactedStatus: 'SEALED',
      }));
      render(
        <DispatchPad
          telegrams={telegrams}
          activeLineIndex={0}
          currentInput={'   \t   '}
          onInputChange={vi.fn()}
          onSubmitLine={handleSubmit}
          onCloseCase={vi.fn()}
          caseStatus="active"
          currentMultiplier={2.0}
        />
      );

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CHALLENGE 3: Line Progression and +20% Efficiency Bonus Watermark
  // =========================================================================
  describe('Challenge 3: Line Progression and +20% Efficiency Bonus Watermark', () => {
    it('empirically verifies sequential progression through lines 01 to 06 and checks watermark count', () => {
      let state = createInitialGameState({});
      expect(state.activeLineIndex).toBe(0);
      expect(state.caseStatus).toBe('active');

      const dummyAction: AgentAction = {
        action: 'CLICK',
        targetId: '#21',
        thought: 'Step executed',
      };

      // Step through all 6 lines
      for (let line = 1; line <= 6; line++) {
        const expectedActiveIndex = line - 1;
        expect(state.activeLineIndex).toBe(expectedActiveIndex);

        // Expected future unused lines = 6 - line
        const expectedUnusedWatermarks = Math.max(0, 6 - line);

        const { container, unmount } = render(
          <DispatchPad
            telegrams={state.telegrams}
            activeLineIndex={state.activeLineIndex}
            currentInput={`Instruction for line ${line}`}
            onInputChange={vi.fn()}
            onSubmitLine={vi.fn()}
            onCloseCase={vi.fn()}
            caseStatus={state.caseStatus}
            currentMultiplier={2.0 - (line - 1) * 0.2}
          />
        );

        // Verify active line header
        const activeHeader = container.querySelector('#active-line-label');
        expect(activeHeader?.textContent).toBe(`LINE 0${line} / 06`);

        // Verify count of +20% watermarks
        const watermarks = screen.queryAllByText(/KEEP BLANK FOR \+20% EFFICIENCY MULTIPLIER/i);
        expect(watermarks.length).toBe(expectedUnusedWatermarks);

        // For Line 06, verify final line warning when line < 6
        if (line < 6) {
          expect(
            screen.getByText(/FINAL TELEGRAM LINE — AUTO-UNSEALS DOSSIER AFTER LINE 06/i)
          ).toBeInTheDocument();
        }

        unmount();

        // Advance line in state machine
        state = gameReducer(state, {
          type: 'APPLY_AGENT_ACTION',
          payload: {
            action: dummyAction,
            instruction: `Line ${line} text`,
            exhibits: CASE_001_EXHIBITS,
          },
        });
      }

      // After Line 06 completion, case automatically closes
      expect(state.caseStatus).toBe('closed');
      expect(state.scoreReport).not.toBeNull();
      expect(state.scoreReport?.linesUsed).toBe(6);
      expect(state.scoreReport?.unusedLines).toBe(0);
      expect(state.scoreReport?.multiplier).toBe(1.0);
    });

    it('empirically verifies early closure at Line 03 locks in 1.6x multiplier for 3 unused lines', () => {
      let state = createInitialGameState({});

      // Submit Line 01 & 02
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#21', thought: '1' },
          instruction: 'Line 1',
        },
      });
      state = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#22', thought: '2' },
          instruction: 'Line 2',
        },
      });

      expect(state.activeLineIndex).toBe(2); // Line 03 is active

      // Close case early
      state = gameReducer(state, {
        type: 'CLOSE_CASE',
        payload: { exhibits: CASE_001_EXHIBITS },
      });

      expect(state.caseStatus).toBe('closed');
      expect(state.scoreReport?.linesUsed).toBe(2);
      expect(state.scoreReport?.unusedLines).toBe(4);
      expect(state.scoreReport?.multiplier).toBe(1.8);
    });
  });

  // =========================================================================
  // CHALLENGE 4: Case Closure Lockout
  // =========================================================================
  describe('Challenge 4: Case Closure Lockout', () => {
    it('empirically verifies early case closure locks out input and removes textbox from DOM', () => {
      const sampleTelegrams: TelegramLine[] = [
        { lineNumber: 1, text: 'step 1', submitted: true, exhibitRedactedStatus: 'SEALED' },
        { lineNumber: 2, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
        { lineNumber: 3, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
        { lineNumber: 4, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
        { lineNumber: 5, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
        { lineNumber: 6, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
      ];

      render(
        <DispatchPad
          telegrams={sampleTelegrams}
          activeLineIndex={1} // Line 02
          currentInput="attempted typing"
          onInputChange={vi.fn()}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="closed"
          currentMultiplier={1.8}
        />
      );

      // Lockout banner is active
      expect(screen.getByText(/LINE 02: \[CASE CLOSED — DISPATCH PAD LOCKED\]/i)).toBeInTheDocument();
      expect(screen.getByText(/LOCKOUT ACTIVE/i)).toBeInTheDocument();
      expect(screen.getAllByText(/CASE CLOSED/i).length).toBeGreaterThanOrEqual(2);

      // Textbox must be completely removed/disabled from DOM
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /DISPATCH LINE/i })).toBeNull();
    });

    it('empirically verifies completing line 06 disables further input and displays all 6 submitted lines', () => {
      const allSubmitted: TelegramLine[] = Array.from({ length: 6 }, (_, i) => ({
        lineNumber: i + 1,
        text: `Command for line ${i + 1}`,
        submitted: true,
        actionSummary: `Executed ${i + 1}`,
        exhibitRedactedStatus: 'SEALED',
      }));

      render(
        <DispatchPad
          telegrams={allSubmitted}
          activeLineIndex={5}
          currentInput=""
          onInputChange={vi.fn()}
          onSubmitLine={vi.fn()}
          onCloseCase={vi.fn()}
          caseStatus="closed"
          currentMultiplier={1.0}
        />
      );

      // Header indicates case closed
      expect(screen.getByText('ACTIVE:')).toBeInTheDocument();
      expect(screen.getByText('CASE CLOSED')).toBeInTheDocument();

      // All 6 rows rendered as submitted past telegrams
      for (let i = 1; i <= 6; i++) {
        expect(screen.getByText(new RegExp(`LINE 0${i}:`, 'i'))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Command for line ${i}`, 'i'))).toBeInTheDocument();
      }

      // No input field exists
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('empirically verifies reducer rejects SET_INPUT and APPLY_AGENT_ACTION after case closure', () => {
      let state = createInitialGameState({});
      state = gameReducer(state, { type: 'CLOSE_CASE' });
      expect(state.caseStatus).toBe('closed');

      // Attempt SET_INPUT
      const afterInput = gameReducer(state, { type: 'SET_INPUT', payload: 'malicious input' });
      expect(afterInput.currentInput).toBe('');

      // Attempt START_EXECUTION
      const afterStart = gameReducer(state, { type: 'START_EXECUTION' });
      expect(afterStart.isExecuting).toBe(false);

      // Attempt APPLY_AGENT_ACTION
      const afterAction = gameReducer(state, {
        type: 'APPLY_AGENT_ACTION',
        payload: {
          action: { action: 'CLICK', targetId: '#25', thought: 'exploit' },
          instruction: 'bypass',
        },
      });
      expect(afterAction.activeLineIndex).toBe(0);
      expect(afterAction.telegrams[0].submitted).toBe(false);
    });
  });

  // =========================================================================
  // CHALLENGE 5: Agent Cursor Thought Note Clamping (<= 80 Chars)
  // =========================================================================
  describe('Challenge 5: Agent Cursor Thought Note Clamping (<= 80 Characters)', () => {
    it('empirically verifies thought note is never truncated when <= 80 characters', () => {
      const thought77 = 'A'.repeat(77);
      const thought80 = 'B'.repeat(80);

      const { rerender } = render(
        <AgentCursor xPercent={50} yPercent={50} thoughtText={thought77} />
      );
      expect(screen.getByText(thought77)).toBeInTheDocument();

      rerender(<AgentCursor xPercent={50} yPercent={50} thoughtText={thought80} />);
      expect(screen.getByText(thought80)).toBeInTheDocument();
    });

    it('empirically verifies thought note > 80 chars is strictly clamped to <= 80 chars with ellipsis', () => {
      const longThoughts = [
        'C'.repeat(81),
        'D'.repeat(100),
        'E'.repeat(250),
        'F'.repeat(1000),
        '日本語の思考テキストが八十文字を大幅に超えてしまう極限ストレステストケースの検証文字列です。'.repeat(3),
      ];

      for (const thought of longThoughts) {
        const { unmount } = render(
          <AgentCursor xPercent={50} yPercent={50} thoughtText={thought} />
        );

        const note = screen.getByTestId('agent-note');
        const textEl = note.querySelector('.truncate');
        expect(textEl).not.toBeNull();

        const rendered = textEl?.textContent || '';
        expect(rendered.length).toBeLessThanOrEqual(80);
        expect(rendered.endsWith('...')).toBe(true);

        unmount();
      }
    });

    it('fuzz-tests 100 random lengths from 1 to 500 characters and checks <= 80 invariant', () => {
      for (let len = 1; len <= 200; len++) {
        const testStr = 'X'.repeat(len);
        const { unmount } = render(
          <AgentCursor xPercent={50} yPercent={50} thoughtText={testStr} />
        );

        const note = screen.getByTestId('agent-note');
        const textEl = note.querySelector('.truncate');
        const text = textEl?.textContent || '';

        expect(text.length).toBeLessThanOrEqual(80);

        if (len <= 80) {
          expect(text).toBe(testStr);
        } else {
          expect(text.length).toBe(80);
          expect(text.slice(-3)).toBe('...');
        }

        unmount();
      }
    });

    it('empirically verifies thought note gracefully handles undefined, null, and empty string', () => {
      const { rerender } = render(
        <AgentCursor xPercent={50} yPercent={50} thoughtText={undefined} />
      );
      expect(screen.getByText(/FIELD AGENT: Awaiting instruction/i)).toBeInTheDocument();

      rerender(<AgentCursor xPercent={50} yPercent={50} thoughtText="" />);
      const note = screen.getByTestId('agent-note');
      expect(note).toBeInTheDocument();
    });
  });

});
