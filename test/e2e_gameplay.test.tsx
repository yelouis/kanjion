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
  // SUITE 1: The Golden Path — Canonical 100% Perfect Run (140 PTS)
  // =========================================================================
  describe('Suite 1: Canonical 100% Perfect Run (The Golden Path)', () => {
    it('executes full dispatch sequence, cursor kinematics, exhibits unsealing, and clipboard sharing', async () => {
      const { container } = render(<App />);

      // -----------------------------------------------------------------------
      // 1. Initial Broadsheet Layout & Archival Framing Verification
      // -----------------------------------------------------------------------
      const main = container.querySelector('main');
      expect(main).toHaveClass('bg-dossier-paper', 'border-dossier-ink', 'shadow-ink-lg');

      // Header Branding & Metadata
      expect(screen.getByText('KANJION')).toBeInTheDocument();
      expect(screen.getByText(/CASE FILE #042/i)).toBeInTheDocument();
      expect(screen.getByText(/🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN/i)).toBeInTheDocument();
      expect(screen.getByText(/COPY-PASTE DISABLED/i)).toBeInTheDocument();

      // Sealed status pill active
      const sealedPill = container.querySelector('#sealed-status-pill');
      expect(sealedPill).toHaveTextContent(/██ SEALED UNTIL CASE CLOSED ██/i);

      // Coordinate Rulers
      expect(screen.getByText(/COL A \(LEFT: 0–256\)/i)).toBeInTheDocument();
      expect(screen.getByText(/COL B \(CENTER-LEFT: 256–512\)/i)).toBeInTheDocument();
      expect(screen.getByText(/COL C \(CENTER-RIGHT: 512–768\)/i)).toBeInTheDocument();
      expect(screen.getByText(/COL D \(RIGHT: 768–1024\)/i)).toBeInTheDocument();
      expect(screen.getByText('ROW 1')).toBeInTheDocument();
      expect(screen.getByText('ROW 2')).toBeInTheDocument();
      expect(screen.getByText('ROW 3')).toBeInTheDocument();
      expect(screen.getByText('ROW 4')).toBeInTheDocument();

      // Virtual Sandbox Stage geometry
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).toHaveStyle({ width: '1024px', height: '768px' });
      expect(screen.getByText(/sandbox:\/\/ekinet-jr-sim\.jp\/reserve\/seat-matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/🔒 TEXT SELECTION LOCKED/i)).toBeInTheDocument();

      // Initial Pre-Seeded Ledger State
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 03 / 06');
      expect(screen.getByText(/CURRENT MULTIPLIER IF CLOSED NOW:/i)).toBeInTheDocument();
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.8x');

      // Sealed exhibits preview banner
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED BEHIND REDACTION BARS/i)).toBeInTheDocument();
      expect(container.querySelector('#unsealed-exhibits-panel')).not.toBeInTheDocument();

      // -----------------------------------------------------------------------
      // 2. Line 03 Dispatch: "select nozomi green car"
      // -----------------------------------------------------------------------
      const input = container.querySelector('#telegram-input') as HTMLInputElement;
      expect(input).toBeInTheDocument();

      // Enter instruction: "select nozomi green car"
      fireEvent.change(input, { target: { value: 'select nozomi green car' } });
      expect(input.value).toBe('select nozomi green car');
      expect(container.querySelector('#char-counter')).toHaveTextContent('23/60');

      // Dispatch line
      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 03/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Verification: Active line advanced to Line 04
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 04 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.6x');

      // Verification: Agent Cursor glided to #25 at D3 (885, 468) -> (86.43%, 60.94%)
      const agentCursor = container.querySelector('#agent-cursor') as HTMLElement;
      expect(agentCursor).toBeInTheDocument();
      expect(agentCursor.style.left).toBe('86.43%');
      expect(agentCursor.style.top).toBe('60.94%');

      // Verification: Pinned Yellow Thought Note
      const agentNote = container.querySelector('#agent-note') as HTMLElement;
      expect(agentNote).toBeInTheDocument();
      expect(agentNote).toHaveTextContent(/📌 FIELD NOTE: Clicked \[🍀 ◯ ¥13,870\] at D3/i);
      expect(agentNote).toHaveTextContent(/\[ACTION EXECUTED\]/i);
      // Flipped to left because xPercent > 72%
      expect(agentNote).toHaveClass('right-full', 'mr-3');

      // Verification: Green car button in sandbox is highlighted
      const greenCarBtn = container.querySelector('#target-green-btn');
      expect(greenCarBtn).toHaveClass('bg-emerald-700', 'ring-2');

      // -----------------------------------------------------------------------
      // 3. Line 04 Dispatch: "confirm booking"
      // -----------------------------------------------------------------------
      const inputLine4 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(inputLine4, { target: { value: 'confirm booking' } });
      expect(container.querySelector('#char-counter')).toHaveTextContent('15/60');

      const dispatchBtn4 = screen.getByRole('button', { name: /DISPATCH LINE 04/i });
      await act(async () => {
        fireEvent.click(dispatchBtn4);
      });

      // Verification: Active line advanced to Line 05
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 05 / 06');
      expect(container.querySelector('#live-mult-label')).toHaveTextContent('1.4x');

      // Verification: Cursor glided to #30 at D4 (905, 720) -> (88.38%, 93.75%)
      expect(agentCursor.style.left).toBe('88.38%');
      expect(agentCursor.style.top).toBe('93.75%');

      // Verification: Note updated to confirmed variant
      expect(agentNote).toHaveTextContent(/📌 FIELD NOTE: Clicked \[予約内容を確認・確定へ ▶\] at D4/i);
      expect(agentNote).toHaveTextContent(/\[✓ CONFIRMED STEP\]/i);

      // Verification: Blue confirm button in sandbox has confirmation ring
      const confirmBtn = container.querySelector('#target-confirm-btn');
      expect(confirmBtn).toHaveClass('bg-blue-800', 'ring-2');

      // -----------------------------------------------------------------------
      // 4. Case Closure Trigger & Unsealing Verification
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
      // 5. Exhibits Panel & Rubber Stamps Verification
      // -----------------------------------------------------------------------
      const unsealedPanel = container.querySelector('#unsealed-exhibits-panel');
      expect(unsealedPanel).toBeInTheDocument();

      // Score Banner: 100% closeness x 1.4x multiplier = 140 PTS
      const scoreBanner = container.querySelector('#final-score-banner');
      expect(scoreBanner).toHaveTextContent('100% × 1.4x = 140 PTS');

      // 5 Sealed Exhibits Unsealed with Dynamic Angled Rubber Stamps
      // Exhibit A: Route 東京⇒新大阪
      const stampA = container.querySelector('#exhibit-a-stamp');
      expect(stampA).toHaveTextContent('[VERIFIED ✓ +25%]');
      expect(stampA).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate'); // -4deg

      // Exhibit B: 14:30 Departure Slot
      const stampB = container.querySelector('#exhibit-b-stamp');
      expect(stampB).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampB).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate-alt'); // +3deg

      // Exhibit C: Row 2: 🍀 ¥13,870 Seat
      const stampC = container.querySelector('#exhibit-c-stamp');
      expect(stampC).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampC).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate'); // -4deg

      // Exhibit D: Avoid ¥2,400 Ins. Ad
      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[CLEAN ✓ +15%]');
      expect(stampD).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate-alt'); // +3deg

      // Exhibit E: Final Blue Confirm
      const stampE = container.querySelector('#exhibit-e-stamp');
      expect(stampE).toHaveTextContent('[VERIFIED ✓ +20%]');
      expect(stampE).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen', 'stamp-rotate'); // -4deg

      // -----------------------------------------------------------------------
      // 6. Shareable Wordle-Style Result & Clipboard Copy
      // -----------------------------------------------------------------------
      expect(container.querySelector('#share-summary-txt')).toHaveTextContent('100% × 1.4x = 140 PTS');
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩🟩🟩🟩 (4/6 Telegrams Sent)');

      const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('KANJION #042 🇯🇵 — 100% × 1.4x = 140 PTS\n🟩🟩🟩🟩🟩 (4/6 Telegrams Sent)')
      );
      expect(screen.getByText(/✓ DISPATCH CLIPPING COPIED!/i)).toBeInTheDocument();

      // -----------------------------------------------------------------------
      // 7. Practice Mode (Return to Active Play)
      // -----------------------------------------------------------------------
      const reopenBtn = screen.getByRole('button', { name: /Return to Active Play/i });
      await act(async () => {
        fireEvent.click(reopenBtn);
      });

      // Exhibits resealed
      expect(container.querySelector('#unsealed-exhibits-panel')).not.toBeInTheDocument();
      expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED BEHIND REDACTION BARS/i)).toBeInTheDocument();

      // Dispatch pad restored at Line 05
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 05 / 06');
      expect(container.querySelector('#telegram-input')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 2: Target Ghost Replay Toggle & Anti-Leak Redaction Mask
  // =========================================================================
  describe('Suite 2: Target Ghost Replay Overlay & Redaction Integrity', () => {
    it('toggles vector trajectory and masks all text behind 14 solid black redaction bars', async () => {
      const { container } = render(<App />);

      const ghostToggleBtn = screen.getByRole('button', { name: /Target Ghost Replay/i });
      expect(ghostToggleBtn).toHaveTextContent(/Target Ghost Replay: OFF/i);
      expect(container.querySelector('#ghost-trace-overlay')).not.toBeInTheDocument();

      // Toggle ON
      await act(async () => {
        fireEvent.click(ghostToggleBtn);
      });

      expect(ghostToggleBtn).toHaveTextContent(/Target Ghost Replay: ON/i);
      const overlay = container.querySelector('#ghost-trace-overlay');
      expect(overlay).toBeInTheDocument();

      // Vector Trajectory SVG path
      const trajectoryPath = container.querySelector('#ghost-trajectory-paths path');
      expect(trajectoryPath).toBeInTheDocument();

      // Waypoints at (885, 468) and (905, 720)
      expect(screen.getByText(/TARGET CLICK @ 0:03 \(COL D, ROW 3\)/i)).toBeInTheDocument();
      expect(screen.getByText(/TARGET CLICK @ 0:05 \(COL D, ROW 4\)/i)).toBeInTheDocument();

      // Redaction Marker Mask: Exactly 14 solid black redaction bars
      const redactionMask = container.querySelector('#redaction-marker-mask');
      expect(redactionMask).toBeInTheDocument();
      const rects = redactionMask?.querySelectorAll('rect');
      expect(rects?.length).toBe(14);

      // Verify no plain Japanese fare text is leaked in the overlay
      expect(overlay?.textContent).not.toContain('¥13,870');
      expect(overlay?.textContent).not.toContain('ひかり 515号');
      expect(overlay?.textContent).not.toContain('のぞみ 24号');

      // Dismiss overlay via close button
      const closeOverlayBtn = screen.getByRole('button', { name: /✕ RETURN TO DOSSIER/i });
      await act(async () => {
        fireEvent.click(closeOverlayBtn);
      });

      expect(container.querySelector('#ghost-trace-overlay')).not.toBeInTheDocument();
      expect(ghostToggleBtn).toHaveTextContent(/Target Ghost Replay: OFF/i);
    });
  });

  // =========================================================================
  // SUITE 3: Decoy Trap Contamination & Stage Error Shake
  // =========================================================================
  describe('Suite 3: Decoy Trap Contamination & Visual Error Recovery', () => {
    it('handles decoy insurance click, triggers stage shake, and marks Exhibit D contaminated', async () => {
      const { container } = render(<App />);

      const input = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'click the red button' } });

      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 03/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Stage Shake triggered
      const stageCore = container.querySelector('#sandbox-core');
      expect(stageCore).toHaveClass('shake-anim');

      // Agent cursor receives trap styling
      const agentNote = container.querySelector('#agent-note');
      expect(agentNote).toHaveTextContent(/\[⚠️ TRAP DETECTED\]/i);
      expect(agentNote).toHaveClass('bg-red-700', 'text-white');

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

      // Exhibit D is CONTAMINATED (0 points)
      const stampD = container.querySelector('#exhibit-d-stamp');
      expect(stampD).toHaveTextContent('[CONTAMINATED ✗ +0%]');
      expect(stampD).toHaveClass('border-dossier-stampRed', 'text-dossier-stampRed');

      // Closeness score drops: 25 (A) + 20 (B) + 0 (C missed) + 0 (D contam) + 0 (E missed) = 45%
      expect(container.querySelector('#final-score-banner')).toHaveTextContent(/45% × 1\.6x = 72 PTS/i);
      expect(container.querySelector('#share-emoji-row')).toHaveTextContent('🟩🟩⬜🟥⬜');
    });
  });

  // =========================================================================
  // SUITE 4: 6-Line Auto-Closure Lifecycle
  // =========================================================================
  describe('Suite 4: Telegram Ledger Exhaustion & Line 06 Auto-Closure', () => {
    it('automatically unseals case file on line 6 dispatch with 1.0x efficiency multiplier', async () => {
      const { container } = render(<App />);

      // Line 3: Select green car
      const input3 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input3, { target: { value: 'select green clover seat' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 03/i }));
      });

      // Line 4: Confirm
      const input4 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input4, { target: { value: 'confirm booking' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 04/i }));
      });

      // Line 5: Filler instruction
      const input5 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input5, { target: { value: 'check schedule' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 05/i }));
      });

      // Line 6: Final telegram line
      const input6 = container.querySelector('#telegram-input') as HTMLInputElement;
      fireEvent.change(input6, { target: { value: 'final review' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 06/i }));
      });

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
      const { container } = render(<App />);
      const input = container.querySelector('#telegram-input') as HTMLInputElement;

      // 1. Strict 60-char capping
      const longText = 'A'.repeat(75);
      fireEvent.change(input, { target: { value: longText } });
      expect(input.value.length).toBe(60);
      expect(container.querySelector('#char-counter')).toHaveTextContent('60/60');
      expect(container.querySelector('#char-counter')).toHaveClass('text-red-700', 'font-black');

      // 2. Empty / whitespace submission rejection
      fireEvent.change(input, { target: { value: '    ' } });
      const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 03/i });
      await act(async () => {
        fireEvent.click(dispatchBtn);
      });

      // Did not advance; still Line 03
      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 03 / 06');
    });

    it('submits on Enter key press', async () => {
      const { container } = render(<App />);
      const input = container.querySelector('#telegram-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'click green clover seat' } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      expect(container.querySelector('#active-line-label')).toHaveTextContent('LINE 04 / 06');
    });
  });

  // =========================================================================
  // SUITE 6: Dual-Mode Backend Toggle & SoM Badges
  // =========================================================================
  describe('Suite 6: Dual-Mode Execution & Set-of-Mark Overlay', () => {
    it('toggles backend execution mode between Offline and Cloud Vision', async () => {
      const { container } = render(<App />);

      const modeBtn = container.querySelector('#btn-mode-toggle') as HTMLButtonElement;
      expect(modeBtn).toHaveTextContent(/Mode: Offline/i);

      await act(async () => {
        fireEvent.click(modeBtn);
      });

      expect(modeBtn).toHaveTextContent(/Mode: Cloud Vision/i);
    });

    it('toggles Set-of-Mark numbered badges over interactive nodes', async () => {
      const { container } = render(<App />);

      const somBtn = screen.getByRole('button', { name: /Backend SoM IDs/i });
      expect(somBtn).toHaveTextContent(/Backend SoM IDs: OFF/i);
      expect(container.querySelector('.som-badge')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(somBtn);
      });

      expect(somBtn).toHaveTextContent(/Backend SoM IDs: ON/i);
      const badges = container.querySelectorAll('.som-badge');
      expect(badges.length).toBeGreaterThanOrEqual(10);
      expect(screen.getByText('#25')).toBeInTheDocument();
      expect(screen.getByText('#30')).toBeInTheDocument();
    });
  });
});
