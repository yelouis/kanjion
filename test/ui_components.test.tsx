import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import {
  MastheadHeader,
  SandboxStage,
  ShinkansenSandbox,
  AgentCursor,
  DispatchPad,
  ExhibitsPanel,
} from '../src/components';
import App from '../src/App';

import {
  CASE_001_INITIAL_MICRO_STATE,
} from '../src/data/puzzles/case_001';
import type { ScoreReport, TelegramLine } from '../src/types/game';

describe('2. MastheadHeader Component', () => {
  it('renders case file metadata, difficulty badge, and date slug', () => {
    render(
      <MastheadHeader
        caseNumber="#001"
        caseTitle="THE INSTRUCT DOSSIER"
        difficultyBadge="🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN"
        caseStatus="active"
        exhibitCount={5}
        dateSlug="NOVEMBER 06, 2026"
      />
    );

    expect(screen.getByText(/CASE FILE #001/i)).toBeInTheDocument();
    expect(screen.getByText('THE INSTRUCT DOSSIER')).toBeInTheDocument();
    expect(screen.getByText(/🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN/i)).toBeInTheDocument();
    expect(screen.getByText(/NOVEMBER 06, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/██ SEALED UNTIL CASE CLOSED ██/i)).toBeInTheDocument();
  });
});

describe('4. SandboxStage Component', () => {
  it('renders fixed 1024x768 stage with uniform CSS scaling and browser chrome', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_001_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test thought',
          variant: 'idle',
          isShaking: false,
        }}
        stageShake={false}
        scaleFactor={0.75}
      >
        <div data-testid="content">STAGE CONTENT</div>
      </SandboxStage>
    );

    const outer = screen.getByTestId('sandbox-stage');
    // Height = 768 * 0.75 = 576px
    expect(outer).toHaveStyle({ height: '576px' });

    const core = screen.getByTestId('sandbox-core');
    expect(core).toHaveStyle({
      width: '1024px',
      height: '768px',
      transform: 'scale(0.75)',
      transformOrigin: 'top left',
    });

    expect(screen.getByText(/sandbox:\/\/kanjion-rail\.example\/reserve\/seats/i)).toBeInTheDocument();
    expect(screen.getByText(/🔒 TEXT SELECTION LOCKED/i)).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('prevents copy, cut, paste, contextmenu, and dragstart events', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_001_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test thought',
          variant: 'idle',
          isShaking: false,
        }}
        stageShake={false}
      />
    );

    const stage = screen.getByTestId('sandbox-stage');

    const copyEvent = new Event('copy', { bubbles: true, cancelable: true });
    stage.dispatchEvent(copyEvent);
    expect(copyEvent.defaultPrevented).toBe(true);

    const cutEvent = new Event('cut', { bubbles: true, cancelable: true });
    stage.dispatchEvent(cutEvent);
    expect(cutEvent.defaultPrevented).toBe(true);

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    stage.dispatchEvent(pasteEvent);
    expect(pasteEvent.defaultPrevented).toBe(true);

    const contextEvent = new Event('contextmenu', { bubbles: true, cancelable: true });
    stage.dispatchEvent(contextEvent);
    expect(contextEvent.defaultPrevented).toBe(true);
  });

  it('applies shake-anim when stageShake is true', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_001_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test',
          variant: 'idle',
          isShaking: false,
        }}
        stageShake={true}
      />
    );

    const core = screen.getByTestId('sandbox-core');
    expect(core).toHaveClass('shake-anim');
  });
});

describe('5. ShinkansenSandbox Component', () => {
  it('updates visual selection state from microState across multi-page views', () => {
    const mv03State = {
      ...CASE_001_INITIAL_MICRO_STATE,
      macroViewId: 'MV-03' as const,
      selectedRoute: 'tokyo_shinosaka' as const,
      departureTime: '14:30' as const,
      passengerName: 'TANAKA',
      greenCarSelected: false,
    };

    const { rerender } = render(
      <ShinkansenSandbox
        microState={mv03State}
      />
    );

    const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥13,870/i });
    expect(greenBtn).toBeInTheDocument();

    const mv04State = {
      ...mv03State,
      macroViewId: 'MV-04' as const,
      greenCarSelected: true,
      insuranceCheckboxChecked: true,
      finalConfirmed: false,
    };

    rerender(
      <ShinkansenSandbox
        microState={mv04State}
      />
    );

    const insCheckbox = screen.getByRole('checkbox', { name: /旅行キャンセル保険/i });
    expect(insCheckbox).toBeChecked();

    const confirmBtn = screen.getByRole('button', { name: /予約内容を確認・確定へ/i });
    expect(confirmBtn).toBeInTheDocument();
  });
});

describe('6. AgentCursor Component', () => {
  it('positions cursor at xPercent and yPercent and renders thought text', () => {
    render(
      <AgentCursor
        xPercent={45}
        yPercent={60}
        thoughtText="Navigating to seat matrix"
      />
    );

    const cursor = screen.getByTestId('agent-cursor');
    expect(cursor).toHaveStyle({ left: '45%', top: '60%' });
    expect(screen.getByText('Navigating to seat matrix')).toBeInTheDocument();
  });

  it('strictly caps thought text to <= 80 characters', () => {
    const longThought = 'This is an extremely long thought string exceeding the eighty character maximum constraint specified by the dossier protocol';
    expect(longThought.length).toBeGreaterThan(80);

    render(
      <AgentCursor
        xPercent={50}
        yPercent={50}
        thoughtText={longThought}
      />
    );

    const note = screen.getByTestId('agent-note');
    const thoughtEl = note.querySelector('.truncate');
    expect(thoughtEl?.textContent?.length).toBeLessThanOrEqual(80);
    expect(thoughtEl?.textContent).toContain('...');
  });

  it('flips note orientation to left when xPercent > 72%', () => {
    render(
      <AgentCursor
        xPercent={85}
        yPercent={50}
        thoughtText="Column D target"
      />
    );

    const note = screen.getByTestId('agent-note');
    expect(note).toHaveClass('right-full', 'mr-3');
  });

  it('applies trap theme and shake-anim when isTrap is true', () => {
    render(
      <AgentCursor
        xPercent={80}
        yPercent={20}
        thoughtText="Decoy trap clicked"
        variant="trap"
        isTrap={true}
      />
    );

    const note = screen.getByTestId('agent-note');
    expect(note).toHaveTextContent(/\[ACTION EXECUTED\]/i);
    expect(note).not.toHaveTextContent(/TRAP DETECTED/i);

    const container = screen.getByTestId('agent-cursor').firstChild;
    expect(container).toHaveClass('shake-anim');
  });

  it('applies confused theme when variant is confused', () => {
    render(
      <AgentCursor
        xPercent={50}
        yPercent={50}
        thoughtText="Instruction ungrounded"
        variant="confused"
      />
    );

    const note = screen.getByTestId('agent-note');
    expect(note).toHaveTextContent(/\[💭 AGENT THOUGHT\]/i);
  });
});

describe('8. DispatchPad Component', () => {
  const sampleTelegrams: TelegramLine[] = [
    { lineNumber: 1, text: 'select tokyo to shin-osaka', submitted: true, actionSummary: 'Agent clicked tab', exhibitRedactedStatus: 'SEALED' },
    { lineNumber: 2, text: 'set departure 14:30', submitted: true, actionSummary: 'Agent selected time', exhibitRedactedStatus: 'SEALED' },
    { lineNumber: 3, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
    { lineNumber: 4, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
    { lineNumber: 5, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
    { lineNumber: 6, text: '', submitted: false, exhibitRedactedStatus: 'SEALED' },
  ];

  it('renders all 6 rows simultaneously with past, active, and future bonus lines', () => {
    render(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={2}
        currentInput="click green clover"
        onInputChange={vi.fn()}
        onSubmitLine={vi.fn()}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={1.6}
      />
    );

    // Past submitted lines
    expect(screen.getByText(/LINE 01:/i)).toBeInTheDocument();
    expect(screen.getByText(/select tokyo to shin-osaka/i)).toBeInTheDocument();
    expect(screen.getByText(/LINE 02:/i)).toBeInTheDocument();
    expect(screen.getByText(/set departure 14:30/i)).toBeInTheDocument();

    // Active input line 03
    expect(screen.getByText(/LINE 03 ▸/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('click green clover')).toBeInTheDocument();
    expect(screen.getByText('18/60')).toBeInTheDocument();

    // Future bonus lines
    expect(screen.getByText(/LINE 04:/i)).toBeInTheDocument();
    expect(screen.getByText(/LINE 05:/i)).toBeInTheDocument();
    expect(screen.getByText(/LINE 06:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KEEP BLANK FOR \+20% EFFICIENCY MULTIPLIER/i).length).toBe(3);
  });

  it('enforces 60-character input cap and calls onInputChange', () => {
    const handleInput = vi.fn();

    render(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={2}
        currentInput=""
        onInputChange={handleInput}
        onSubmitLine={vi.fn()}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={1.6}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxLength', '60');

    fireEvent.change(input, { target: { value: 'click button' } });
    expect(handleInput).toHaveBeenCalledWith('click button');
  });

  it('submits on button click or Enter key, but triggers shake on empty input', () => {
    const handleSubmit = vi.fn();

    const { rerender } = render(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={2}
        currentInput=""
        onInputChange={vi.fn()}
        onSubmitLine={handleSubmit}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={1.6}
      />
    );

    const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 03/i });
    fireEvent.click(dispatchBtn);
    // Empty input: should NOT submit
    expect(handleSubmit).not.toHaveBeenCalled();

    // Re-render with text
    rerender(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={2}
        currentInput="valid instruction"
        onInputChange={vi.fn()}
        onSubmitLine={handleSubmit}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={1.6}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /DISPATCH LINE 03/i }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);

    // Enter key submits
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleSubmit).toHaveBeenCalledTimes(2);
  });

  it('locks dispatch pad when case is closed', () => {
    render(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={2}
        currentInput=""
        onInputChange={vi.fn()}
        onSubmitLine={vi.fn()}
        onCloseCase={vi.fn()}
        caseStatus="closed"
        currentMultiplier={1.6}
      />
    );

    expect(screen.getByText(/CASE CLOSED — DISPATCH PAD LOCKED/i)).toBeInTheDocument();
    expect(screen.getByText(/LOCKOUT ACTIVE/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('9. ExhibitsPanel Component', () => {
  const sampleScoreReport: ScoreReport = {
    closenessScore: 80,
    multiplier: 1.6,
    finalScore: 128,
    linesUsed: 3,
    unusedLines: 3,
    exhibitEvaluations: [
      { id: 'exhibit_a', code: 'A', title: 'Route: 東京 ⇒ 新大阪', weight: 25, status: 'VERIFIED', stampText: '[VERIFIED ✓ +25%]', rotationDeg: -4 },
      { id: 'exhibit_b', code: 'B', title: 'Passenger Name: TANAKA', weight: 20, status: 'VERIFIED', stampText: '[VERIFIED ✓ +20%]', rotationDeg: 3 },
      { id: 'exhibit_c', code: 'C', title: 'Row 2: 🍀 ¥13,870 Seat', weight: 20, status: 'VERIFIED', stampText: '[VERIFIED ✓ +20%]', rotationDeg: -4 },
      { id: 'exhibit_d', code: 'D', title: 'Sign Digital Authorization Pad', weight: 15, status: 'VERIFIED', stampText: '[VERIFIED ✓ +15%]', rotationDeg: 3 },
      { id: 'exhibit_e', code: 'E', title: 'Final Blue Confirm', weight: 20, status: 'MISSED', stampText: '[MISSED ✗ +0%]', rotationDeg: -4 },
    ],
    emojiRow: '🟩🟩🟩🟩⬜',
    shareableClipping: 'KANJION #001 🇯🇵 — 80% × 1.6x = 128 PTS\n🟩🟩🟩🟩⬜ (3/6 Telegrams Sent)\nhttps://kanjion-game.web.app',
  };

  it('renders sealed preview during active play', () => {
    render(
      <ExhibitsPanel
        caseClosed={false}
        scoreReport={null}
      />
    );

    expect(screen.getByText(/5 REQUIRED EXHIBITS ARE CURRENTLY SEALED/i)).toBeInTheDocument();
    expect(screen.queryByText(/FORENSIC AUDIT REPORT/i)).not.toBeInTheDocument();
  });

  it('unseals declassified exhibits with rubber ink stamps upon case closure', () => {
    render(
      <ExhibitsPanel
        caseClosed={true}
        scoreReport={sampleScoreReport}
        onReopenCase={vi.fn()}
      />
    );

    expect(screen.getByText(/FORENSIC AUDIT REPORT • CASE #001/i)).toBeInTheDocument();
    expect(screen.getAllByText(/80% × 1\.6x = 128 PTS/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Route: 東京 ⇒ 新大阪')).toBeInTheDocument();
    expect(screen.getByText('[VERIFIED ✓ +25%]')).toBeInTheDocument();
    expect(screen.getByText('[VERIFIED ✓ +15%]')).toBeInTheDocument();
    expect(screen.getByText('[MISSED ✗ +0%]')).toBeInTheDocument();
    expect(screen.getByText(/🟩🟩🟩🟩⬜/i)).toBeInTheDocument();
  });

  it('handles copying case clipping to clipboard and displays feedback', async () => {
    const copyMock = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <ExhibitsPanel
        caseClosed={true}
        scoreReport={sampleScoreReport}
        onCopyClipping={copyMock}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
    fireEvent.click(copyBtn);

    expect(copyMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/✓ DISPATCH CLIPPING COPIED!/i)).toBeInTheDocument();
  });
});

describe('10. App Top-Level Integration Gameplay Loop', () => {
  it('executes full dispatch workflow starting at Line 01, updates agent cursor, and closes case file', async () => {
    render(<App config={{ startOnCover: false, animationScale: 0, replayAutoplay: false }} />);

    // Initial state: Every game starts at Line 01 with all 6 instructions available
    expect(screen.getByText(/LINE 01 \/ 06/i)).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');

    // Type and Dispatch Line 01 on MV-01 (selects Tokyo -> Shin-Osaka route + 14:30 departure)
    fireEvent.change(input, { target: { value: 'Click the top-left green box' } });
    const dispatchBtn = screen.getByRole('button', { name: /DISPATCH LINE 01/i });
    await act(async () => {
      fireEvent.click(dispatchBtn);
    });

    // Check that line was submitted and active line moved to Line 02
    expect(screen.getByText(/LINE 02 \/ 06/i)).toBeInTheDocument();

    // Close case file
    const closeBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Case is now closed
    expect(screen.getAllByText(/CASE CLOSED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/FORENSIC AUDIT REPORT • CASE #001/i)).toBeInTheDocument();
    expect(screen.getByText(/\[VERIFIED ✓ \+25%\]/i)).toBeInTheDocument();

    // Start practice mode
    const reopenBtn = screen.getByRole('button', { name: /Practice this case \(unscored\)/i });
    await act(async () => {
      fireEvent.click(reopenBtn);
    });

    expect(screen.queryByText(/FORENSIC AUDIT REPORT/i)).not.toBeInTheDocument();
    expect(screen.getByText(/LINE 01 \/ 06/i)).toBeInTheDocument();
  });

  it('starts on the Krillion-style Newspaper Front Cover, unfolds into a two-page spread, and supports top-left menu & mobile flip tabs', async () => {
    render(<App config={{ startOnCover: true, animationScale: 0, replayAutoplay: false }} />);

    // 1. Newspaper Front Cover is rendered initially
    expect(screen.getByTestId('newspaper-front-cover')).toBeInTheDocument();
    expect(screen.getByText(/THE DAILY DOSSIER/i)).toBeInTheDocument();

    // 2. Top-Left Menu button opens the menu drawer
    const menuBtn = screen.getByRole('button', { name: /Open Game Menu/i });
    fireEvent.click(menuBtn);
    expect(screen.getByTestId('top-left-menu-drawer')).toBeInTheDocument();
    expect(screen.getByText(/Return to Front Page Cover/i)).toBeInTheDocument();

    // Close menu drawer
    fireEvent.click(menuBtn);
    expect(screen.queryByTestId('top-left-menu-drawer')).not.toBeInTheDocument();

    // 3. Click "OPEN TODAY'S NEWSPAPER" to unfold into the Two-Page Spread
    const openBtn = screen.getByRole('button', { name: /OPEN TODAY'S NEWSPAPER/i });
    fireEvent.click(openBtn);

    expect(screen.queryByTestId('newspaper-front-cover')).not.toBeInTheDocument();
    expect(screen.getByTestId('newspaper-left-page')).toBeInTheDocument();
    expect(screen.getByTestId('newspaper-right-page')).toBeInTheDocument();
    expect(screen.getByTestId('looped-target-replay')).toBeInTheDocument();

    // 4. Mobile Page Switcher toggles active mobile page
    const mobileSwitcher = screen.getByTestId('mobile-page-switcher');
    expect(mobileSwitcher).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Right Page: Target Video/i }));
    expect(screen.getByTestId('newspaper-left-page')).toHaveClass('hidden');
  });
});

describe('11. Item 5 — Sandbox Copy, Branding & Anti-Copy (★ Falsifying Tests)', () => {
  const PAGE_IDS = ['MV-01', 'MV-02', 'MV-03', 'MV-04', 'MV-05', 'MV-10', 'MV-11', 'MV-12'] as const;

  it('★ renders each page state with no two-letter Latin runs other than PR, IC, QR (plus STEP in headings) and no TANAKA when passengerName is empty', () => {
    const allowedWords = new Set(['PR', 'IC', 'QR', 'STEP']);
    for (const macroViewId of PAGE_IDS) {
      const state = {
        ...CASE_001_INITIAL_MICRO_STATE,
        macroViewId,
        selectedRoute: macroViewId === 'MV-01' ? ('none' as const) : ('tokyo_shinosaka' as const),
        departureTime: macroViewId === 'MV-01' ? ('none' as const) : ('14:30' as const),
        passengerName: '',
        greenCarSelected: macroViewId === 'MV-04' || macroViewId === 'MV-05',
        signatureStroke: macroViewId === 'MV-05' ? 'SHAPE:signature' : '',
        finalConfirmed: macroViewId === 'MV-05',
      };
      const { container, unmount } = render(<ShinkansenSandbox microState={state} />);
      const rawText = container.textContent ?? '';
      expect(rawText).not.toContain('TANAKA');

      const cleaned = rawText
        .replace(/[\d¥,:.\/]/g, ' ');
      const latinMatches = (cleaned.match(/[A-Za-z]{2,}/g) ?? []).filter(
        (word) => !allowedWords.has(word)
      );
      expect(latinMatches, `Unexpected English words on ${macroViewId}: ${latinMatches.join(', ')}`).toEqual([]);
      unmount();
    }
  });

  it('★ shows sandbox://kanjion-rail.example/reserve/passenger on MV-02 URL bar without Macro-View suffix', () => {
    const mv02State = {
      ...CASE_001_INITIAL_MICRO_STATE,
      macroViewId: 'MV-02',
      passengerName: '',
    };
    render(
      <SandboxStage
        macroViewId="MV-02"
        microState={mv02State}
        agentCursor={{ xPercent: 50, yPercent: 50, thought: '', variant: 'idle', isShaking: false }}
        stageShake={false}
      >
        <div>Body</div>
      </SandboxStage>
    );
    expect(screen.getByText('sandbox://kanjion-rail.example/reserve/passenger')).toBeInTheDocument();
    expect(screen.queryByText(/Macro-View/i)).not.toBeInTheDocument();
  });

  it('★ blocks paste and drop events on #telegram-input silently', () => {
    const sampleTelegrams: TelegramLine[] = Array.from({ length: 6 }, (_, i) => ({
      lineNumber: i + 1,
      text: '',
      submitted: false,
      exhibitRedactedStatus: 'SEALED' as const,
    }));
    const onInputChange = vi.fn();
    render(
      <DispatchPad
        telegrams={sampleTelegrams}
        activeLineIndex={0}
        currentInput=""
        onInputChange={onInputChange}
        onSubmitLine={vi.fn()}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={2.0}
      />
    );
    const input = document.getElementById('telegram-input') as HTMLInputElement;
    expect(input).toBeTruthy();

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: () => '東海道' },
    });
    input.dispatchEvent(pasteEvent);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
    expect(onInputChange).not.toHaveBeenCalled();

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    input.dispatchEvent(dropEvent);
    expect(dropEvent.defaultPrevented).toBe(true);
  });
});
