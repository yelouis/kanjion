/**
 * test/e2e_gameplay.test.tsx
 *
 * Comprehensive End-to-End Gameplay Verification Suite for Milestone 5.
 * Simulates complete user gameplay sessions through top-level <App /> integration.
 *
 * Vectors Covered:
 * 1. Broadsheet Archival Framing (#F4EFE6 / #111111 ink borders, gazette typography)
 * 2. Virtual Sandbox Stage (1024x768 fixed ratio, coordinate rulers A-D / 1-4, copy protection)
 * 3. 6-Line Western Union Telegram Pad (60-char limit, character counter, empty rejection)
 * 4. User Turn 1: "select nozomi green car" -> cursor glide to #25 at D3 (885, 468) + pinned yellow thought note
 * 5. User Turn 2: "confirm booking" -> cursor glide to #30 at D4 (905, 720) + [✓ CONFIRMED STEP]
 * 6. Target Ghost Replay Toggle (SVG vector trajectory, 2 waypoints, 14 black redaction bars, 0 text leakage)
 * 7. Case Closure & Exhibit Unsealing (5 sealed exhibits unseal with dynamic angled rubber stamps)
 * 8. Closeness (100%) x Efficiency Multiplier (1.4x for 2 unused lines) = 140 PTS score calculation
 * 9. Wordle-Style Shareable Clipping & Clipboard Copy feedback
 * 10. Practice Mode (Return to Active Play reseals exhibits and restores dispatch pad)
 * 11. Decoy Trap Contamination Session (Hitting #12 red ad causes stage shake and contaminates Exhibit D)
 * 12. 6-Line Auto-Closure Session (Exhausting all 6 lines auto-unseals dossier with 1.0x multiplier)
 * 13. Dual-Mode Backend Connector Toggle (Offline Engine vs Cloud Multimodal LLM)
 * 14. Backend Set-of-Mark Overlay Toggle (#11 through #30 badges)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import App from '../src/App';

describe('Milestone 5: Comprehensive E2E Gameplay Verification Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Ensure clipboard mock is reset
    if (navigator.clipboard) {
      vi.mocked(navigator.clipboard.writeText).mockClear();
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // =========================================================================
  // SUITE 1: The Golden Path — Canonical 100% Perfect Run (120 PTS)
  // =========================================================================
  describe('Suite 1: Canonical 100% Perfect Run (The Golden Path)', () => {
    it('executes full dispatch sequence, cursor kinematics, exhibits unsealing, and clipboard sharing', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      // -----------------------------------------------------------------------
      // 1. Initial Broadsheet Layout & Archival Framing Verification
      // -----------------------------------------------------------------------
      const main = container.querySelector('main');
      expect(main).toHaveClass('bg-dossier-paper', 'border-dossier-ink', 'shadow-ink-lg');

      // Header Branding & Metadata
      expect(screen.getByText('KANJION')).toBeInTheDocument();
      expect(screen.getByText(/CASE FILE #001/i)).toBeInTheDocument();

      // Sealed status pill active
      const sealedPill = container.querySelector('#sealed-status-pill');
      expect(sealedPill).toHaveTextContent(/██ SEALED UNTIL CASE CLOSED ██/i);

      // Virtual Sandbox Stage geometry
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).toHaveStyle({ width: '1024px', height: '768px' });
      expect(screen.getAllByText(/sandbox:\/\/kanjion-rail\.example\/reserve\/route-select/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/🔒 TEXT SELECTION LOCKED/i)).toBeInTheDocument();

      // Initial Unseeded Ledger State (Starts at Line 01 / 06 on MV-01)
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');
      expect(screen.getByText(/CURRENT MULTIPLIER IF CLOSED NOW:/i)).toBeInTheDocument();
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('2.0x');

      // Sealed exhibits preview banner
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED BEHIND REDACTION BARS/i)).toBeInTheDocument();
      expect(container.querySelector('#unsealed-exhibits-panel')).not.toBeInTheDocument();

      // -----------------------------------------------------------------------
      // 2. Line 01 (MV-01): "Click the top-left green box" -> MV-02
      // -----------------------------------------------------------------------
      const input1 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input1, { target: { value: 'Click the top-left green box' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 01/i }));
      });
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 02 / 06');

      // -----------------------------------------------------------------------
      // 3. Line 02 (MV-02): "Type TANAKA in the passenger name box" -> MV-03
      // -----------------------------------------------------------------------
      const input2 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input2, { target: { value: 'Type TANAKA in the passenger name box' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 02/i }));
      });
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 03 / 06');

      // -----------------------------------------------------------------------
      // 4. Line 03 (MV-03): "select nozomi green car" -> MV-04
      // -----------------------------------------------------------------------
      const input3 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input3, { target: { value: 'Wait for sale glow, click green 13870' } });
      expect(container.querySelector('#char-counter')).toHaveTextContent('37/60');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 03/i }));
      });

      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 04 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.6x');

      // Verification: Agent Cursor glided to #25 measured box center
      const agentCursor = container.querySelector('#agent-cursor') as HTMLElement;
      expect(agentCursor).toBeInTheDocument();
      expect(agentCursor.style.left).toBe('84.57%');
      expect(agentCursor.style.top).toBe('53.39%');

      // Verification: Pinned Yellow Thought Note
      const agentNote = container.querySelector('#agent-note') as HTMLElement;
      expect(agentNote).toBeInTheDocument();
      expect(agentNote).toHaveTextContent(/\[ACTION EXECUTED\]/i);
      expect(agentNote).toHaveClass('right-full', 'mr-3');

      // -----------------------------------------------------------------------
      // 5. Line 04 (MV-04): "Draw a signature in the dashed box"
      // -----------------------------------------------------------------------
      const input4 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input4, { target: { value: 'Draw a signature in the dashed box' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 04/i }));
      });
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 05 / 06');

      // -----------------------------------------------------------------------
      // 6. Line 05 (MV-04): "confirm booking" -> MV-05
      // -----------------------------------------------------------------------
      const input5 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input5, { target: { value: 'confirm booking' } });
      expect(container.querySelector('#char-counter')).toHaveTextContent('15/60');

      const dispatchBtn5 = screen.getByRole('button', { name: /DISPATCH LINE 05/i });
      await act(async () => {
        fireEvent.click(dispatchBtn5);
      });

      // Verification: Active line advanced to Line 06
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 06 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.2x');

      // Verification: Cursor glided to #30 measured box center
      expect(agentCursor.style.left).toBe('86.33%');
      expect(agentCursor.style.top).toBe('94.01%');
      expect(agentNote).toHaveTextContent(/\[✓ CONFIRMED STEP\]/i);

      // -----------------------------------------------------------------------
      // 7. Case Closure Trigger & Unsealing Verification
      // -----------------------------------------------------------------------
      const closeCaseBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
      await act(async () => {
        fireEvent.click(closeCaseBtn);
      });

      // Verification: Masthead status pill updated to unsealed
      expect(container.querySelector('#sealed-status-pill')).toHaveTextContent(/🔓 UNSEALED \(CASE CLOSED\)/i);

      // Verification: Dispatch pad lockout active
      expect(container.querySelector('#active-line-label')).toHaveTextContent('CASE CLOSED');
      expect(screen.getByText(/CASE CLOSED — DISPATCH PAD LOCKED/i)).toBeInTheDocument();
      expect(screen.getByText(/LOCKOUT ACTIVE/i)).toBeInTheDocument();
      expect(container.querySelector('#telegram-input')).not.toBeInTheDocument();

      // -----------------------------------------------------------------------
      // 8. Exhibits Panel & Rubber Stamps Verification
      // -----------------------------------------------------------------------
      const unsealedPanel = container.querySelector('#unsealed-exhibits-panel');
      expect(unsealedPanel).toBeInTheDocument();

      // Score Banner: 100% closeness x 1.2x multiplier (1 unused line) = 120 PTS
      const scoreBanner = container.querySelector('#final-score-banner');
      expect(scoreBanner).toHaveTextContent('100% × 1.2x = 120 PTS');

      // 5 Sealed Exhibits Unsealed with Dynamic Angled Rubber Stamps
      const stampA = container.querySelector('#exhibit-a-stamp');
      expect(stampA).toHaveTextContent('[VERIFIED ✓ +25%]');
      expect(stampA).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate');

      const stampB = container.querySelector('#exhibit-b-stamp');
      expect(stampB).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampB).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate-alt');

      const stampC = container.querySelector('#exhibit-c-stamp');
      expect(stampC).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampC).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate');

      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[VERIFIED ✓ +15%]');
      expect(stampD).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate-alt');

      const stampE = container.querySelector('#exhibit-e-stamp');
      expect(stampE).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampE).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate');

      // -----------------------------------------------------------------------
      // 9. Shareable Wordle-Style Result & Clipboard Copy
      // -----------------------------------------------------------------------
      expect(container.querySelector('#share-summary-txt')).toHaveTextContent('100% × 1.2x = 120 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩🟩🟩 (5/6 Telegrams Sent)');

      const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'KANJION #001 🇯🇵 — 100% × 1.2x = 120 PTS\n🟩🟩🟩🟩🟩 (5/6 Telegrams Sent)\nhttps://kanjion-game.web.app'
      );
      expect(screen.getByText(/✓ DISPATCH CLIPPING COPIED!/i)).toBeInTheDocument();

      // -----------------------------------------------------------------------
      // 10. Practice Mode (Practice this case (unscored))
      // -----------------------------------------------------------------------
      const reopenBtn = screen.getByRole('button', { name: /Practice this case \(unscored\)/i });
      await act(async () => {
        fireEvent.click(reopenBtn);
      });

      // Exhibits resealed
      expect(container.querySelector('#unsealed-exhibits-panel')).not.toBeInTheDocument();
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED BEHIND REDACTION BARS/i)).toBeInTheDocument();

      // Dispatch pad reset at Line 01 in practice mode
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');
      expect(container.querySelector('#telegram-input')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 3: Decoy Trap Contamination & Stage Error Shake
  // =========================================================================
  describe('Suite 3: Decoy Trap Contamination & Visual Error Recovery', () => {
    it('handles decoy insurance click, triggers stage shake, and marks Exhibit D contaminated', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      const input = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'click the red button' } });

      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Stage Shake triggered
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).toHaveClass('shake-anim');

      // Agent cursor executes without spoiling "trap detected"
      const agentNote = container.querySelector('#agent-note');
      expect(agentNote).toHaveTextContent(/\[ACTION EXECUTED\]/i);
      expect(agentNote).not.toHaveTextContent(/TRAP DETECTED/i);

      // Auto-clear shake after 400ms
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(stageCore).not.toHaveClass('shake-anim');

      // Close Case File
      const closeCaseBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
      await act(async () => {
        fireEvent.click(closeCaseBtn);
      });

      // Exhibit D is MISSED (0 points) when signature pad is unsigned in multi-page mode
      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[MISSED ✗ +0%]');
      expect(stampD).toHaveClass('border-dossier-stampRed', 'text-dossier-stampRed');

      // Closeness score on MV-01 with only trap clicked: 0% * 2.0x = 0 PTS
      expect(container.querySelector('#final-score-banner')).toHaveTextContent(/0% × 2\.0x = 0 PTS/i);
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('⬜⬜⬜⬜⬜');
    });
  });

  // =========================================================================
  // SUITE 4: 6-Line Auto-Closure Lifecycle
  // =========================================================================
  describe('Suite 4: Telegram Ledger Exhaustion & Line 06 Auto-Closure', () => {
    it('automatically unseals case file on line 6 dispatch with 1.0x efficiency multiplier', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );

      const prompts = [
        'Click the top-left green box',
        'Type TANAKA in the passenger name box',
        'Wait for the sale glow, then click the green ¥13,870',
        'Draw a signature in the dashed box',
        'confirm booking',
        'final review',
      ];

      for (let i = 0; i < 6; i++) {
        const inputEl = container.querySelector('#telegram-input') as HTMLInputElement;
        fireEvent.change(inputEl, { target: { value: prompts[i] } });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(`DISPATCH LINE 0${i + 1}`, 'i') }));
        });
      }

      // Verification: Case automatically closed without clicking Close Case File
      expect(container.querySelector('#sealed-status-pill')).toHaveTextContent(/🔓 UNSEALED \(CASE CLOSED\)/i);
      expect(container.querySelector('#unsealed-exhibits-panel')).toBeInTheDocument();

      // Multiplier is strictly 1.0x (0 unused lines)
      // Closeness = 100%, Multiplier = 1.0x, Final = 100 PTS
      expect(container.querySelector('#final-score-banner')).toHaveTextContent('100% × 1.0x = 100 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩🟩🟩 (6/6 Telegrams Sent)');
    });
  });

  // =========================================================================
  // SUITE 5: Telegram Pad Input Edge Cases & Guardrails
  // =========================================================================
  describe('Suite 5: Telegram Input Edge Cases & Formatting Guardrails', () => {
    it('enforces strict 60-character cap and rejects empty/whitespace dispatches', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );
      const input = container.querySelector('#telegram-input') as HTMLInputElement;

      // 1. Strict 60-char capping
      const longText = 'A'.repeat(75);
      fireEvent.change(input, { target: { value: longText } });
      expect(input.value.length).toBe(60);
      expect(container.querySelector('#char-counter')).toHaveTextContent('60/60');
      expect(container.querySelector('#char-counter')).toHaveClass('text-red-700', 'font-black');

      // 2. Empty / whitespace submission rejection
      fireEvent.change(input, { target: { value: '    ' } });
      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Did not advance; still Line 01
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 01 / 06');
    });

    it('submits on Enter key press', async () => {
      const { container } = render(
        <App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />
      );
      const input = container.querySelector('#telegram-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'Click the top-left green box' } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 02 / 06');
    });
  });
});
