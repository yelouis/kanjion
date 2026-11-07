import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import {
  DossierLayout,
  MastheadHeader,
  CoordinateRulers,
  SandboxStage,
  ShinkansenSandbox,
  AgentCursor,
  GhostReplay,
  DispatchPad,
  ExhibitsPanel,
} from '../src/components';
import App from '../src/App';

import {
  CASE_042_INITIAL_MICRO_STATE,
  CASE_042_GHOST_REPLAY,
  CASE_042_MV03_ELEMENTS,
} from '../src/data/puzzles/case_042';
import type { ScoreReport, TelegramLine } from '../src/types/game';

describe('1. DossierLayout Component', () => {
  it('renders slotted sections and applies archival styling', () => {
    const { container } = render(
      <DossierLayout
        telemetryBar={<div data-testid="telemetry">TELEMETRY BAR</div>}
        header={<header data-testid="header">HEADER SLOT</header>}
        stage={<div data-testid="stage">STAGE SLOT</div>}
        dispatchPad={<div data-testid="dispatch">DISPATCH SLOT</div>}
        exhibitsPanel={<div data-testid="exhibits">EXHIBITS SLOT</div>}
        modal={<div data-testid="modal">MODAL SLOT</div>}
      >
        <div data-testid="children">EXTRA CHILDREN</div>
      </DossierLayout>
    );

    expect(screen.getByTestId('telemetry')).toHaveTextContent('TELEMETRY BAR');
    expect(screen.getByTestId('header')).toHaveTextContent('HEADER SLOT');
    expect(screen.getByTestId('stage')).toHaveTextContent('STAGE SLOT');
    expect(screen.getByTestId('dispatch')).toHaveTextContent('DISPATCH SLOT');
    expect(screen.getByTestId('exhibits')).toHaveTextContent('EXHIBITS SLOT');
    expect(screen.getByTestId('modal')).toHaveTextContent('MODAL SLOT');
    expect(screen.getByTestId('children')).toHaveTextContent('EXTRA CHILDREN');

    // Archival broadsheet classes
    const main = container.querySelector('main');
    expect(main).toHaveClass('bg-dossier-paper', 'border-dossier-ink', 'shadow-ink-lg');
  });
});

describe('2. MastheadHeader Component', () => {
  it('renders case file metadata, difficulty badge, and date slug', () => {
    render(
      <MastheadHeader
        caseNumber="#042"
        caseTitle="THE INSTRUCT DOSSIER"
        difficultyBadge="🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN"
        ghostReplayActive={false}
        onToggleGhostReplay={vi.fn()}
        somOverlayActive={false}
        onToggleSomOverlay={vi.fn()}
        caseStatus="active"
        exhibitCount={5}
        dateSlug="NOVEMBER 06, 2026"
      />
    );

    expect(screen.getByText(/CASE FILE #042/i)).toBeInTheDocument();
    expect(screen.getByText('THE INSTRUCT DOSSIER')).toBeInTheDocument();
    expect(screen.getByText(/🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN/i)).toBeInTheDocument();
    expect(screen.getByText(/NOVEMBER 06, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/COPY-PASTE DISABLED/i)).toBeInTheDocument();
    expect(screen.getByText(/██ SEALED UNTIL CASE CLOSED ██/i)).toBeInTheDocument();
  });

  it('handles Ghost Replay and Backend SoM toggle buttons', () => {
    const toggleGhost = vi.fn();
    const toggleSom = vi.fn();

    const { rerender } = render(
      <MastheadHeader
        caseNumber="#042"
        caseTitle="THE INSTRUCT DOSSIER"
        difficultyBadge="🇯🇵 HARD MODE"
        ghostReplayActive={false}
        onToggleGhostReplay={toggleGhost}
        somOverlayActive={false}
        onToggleSomOverlay={toggleSom}
        caseStatus="active"
        exhibitCount={5}
      />
    );

    const ghostBtn = screen.getByRole('button', { name: /Target Ghost Replay/i });
    fireEvent.click(ghostBtn);
    expect(toggleGhost).toHaveBeenCalledTimes(1);

    const somBtn = screen.getByRole('button', { name: /Backend SoM IDs/i });
    fireEvent.click(somBtn);
    expect(toggleSom).toHaveBeenCalledTimes(1);

    // Rerender in active toggled states and closed case
    rerender(
      <MastheadHeader
        caseNumber="#042"
        caseTitle="THE INSTRUCT DOSSIER"
        difficultyBadge="🇯🇵 HARD MODE"
        ghostReplayActive={true}
        onToggleGhostReplay={toggleGhost}
        somOverlayActive={true}
        onToggleSomOverlay={toggleSom}
        caseStatus="closed"
        exhibitCount={5}
      />
    );

    expect(screen.getByText(/Target Ghost Replay: ON/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend SoM IDs: ON/i)).toBeInTheDocument();
    expect(screen.getByText(/🔓 UNSEALED \(CASE CLOSED\)/i)).toBeInTheDocument();
  });
});

describe('3. CoordinateRulers Component', () => {
  it('renders top column ruler (COL A–D) and left row ruler (ROW 1–4)', () => {
    render(
      <CoordinateRulers>
        <div data-testid="inner-stage">VIRTUAL STAGE CANVAS</div>
      </CoordinateRulers>
    );

    expect(screen.getByText(/COL A \(LEFT: 0–256\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL B \(CENTER-LEFT: 256–512\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL C \(CENTER-RIGHT: 512–768\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL D \(RIGHT: 768–1024\)/i)).toBeInTheDocument();
    expect(screen.getByText('ROW 1')).toBeInTheDocument();
    expect(screen.getByText('ROW 2')).toBeInTheDocument();
    expect(screen.getByText('ROW 3')).toBeInTheDocument();
    expect(screen.getByText('ROW 4')).toBeInTheDocument();
    expect(screen.getByTestId('inner-stage')).toBeInTheDocument();
  });
});

describe('4. SandboxStage Component', () => {
  it('renders fixed 1024x768 stage with uniform CSS scaling and browser chrome', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test thought',
          variant: 'idle',
          isShaking: false,
        }}
        ghostReplayActive={false}
        somOverlayActive={false}
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

    expect(screen.getByText(/sandbox:\/\/ekinet-jr-sim\.jp\/reserve\/seat-matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/🔒 TEXT SELECTION LOCKED/i)).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('prevents copy, cut, paste, contextmenu, and dragstart events', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test thought',
          variant: 'idle',
          isShaking: false,
        }}
        ghostReplayActive={false}
        somOverlayActive={false}
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
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={{
          xPercent: 50,
          yPercent: 50,
          thought: 'Test',
          variant: 'idle',
          isShaking: false,
        }}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={true}
      />
    );

    const core = screen.getByTestId('sandbox-core');
    expect(core).toHaveClass('shake-anim');
  });
});

describe('5. ShinkansenSandbox Component', () => {
  it('renders all 11 Set-of-Mark interactive elements and dispatches clicks', () => {
    const handleClick = vi.fn();

    render(
      <ShinkansenSandbox
        microState={CASE_042_INITIAL_MICRO_STATE}
        somOverlayActive={true}
        onElementClick={handleClick}
        somElements={CASE_042_MV03_ELEMENTS}
      />
    );

    // Header buttons
    const logoutBtn = screen.getByRole('button', { name: /ログアウト/i });
    fireEvent.click(logoutBtn);
    expect(handleClick).toHaveBeenCalledWith(11);

    // Promo banner
    const promoBtn = screen.getByRole('button', { name: /今すぐ申し込む（赤ボタン）/i });
    fireEvent.click(promoBtn);
    expect(handleClick).toHaveBeenCalledWith(12);

    // Back to conditions
    const backBtn = screen.getByRole('button', { name: /◀ 条件変更へ戻る/i });
    fireEvent.click(backBtn);
    expect(handleClick).toHaveBeenCalledWith(14);

    // Fare buttons
    const fareButtons = screen.getAllByRole('button', { name: /◯ ¥13,870/i });
    fireEvent.click(fareButtons[0]);
    expect(handleClick).toHaveBeenCalledWith(21);

    fireEvent.click(screen.getByRole('button', { name: /△ ¥14,520/i }));
    expect(handleClick).toHaveBeenCalledWith(22);

    fireEvent.click(fareButtons[1]);
    expect(handleClick).toHaveBeenCalledWith(23);

    // Target green car button #25
    const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥13,870 \(特割\)/i });
    fireEvent.click(greenBtn);
    expect(handleClick).toHaveBeenCalledWith(25);

    // Insurance checkbox #28
    const insCheckbox = screen.getByRole('checkbox', { name: /旅行キャンセル保険/i });
    fireEvent.click(insCheckbox);
    expect(handleClick).toHaveBeenCalledWith(28);

    // Cancel button #29
    const cancelBtn = screen.getByRole('button', { name: /予約を取消/i });
    fireEvent.click(cancelBtn);
    expect(handleClick).toHaveBeenCalledWith(29);

    // Confirm button #30
    const confirmBtn = screen.getByRole('button', { name: /予約内容を確認・確定へ/i });
    fireEvent.click(confirmBtn);
    expect(handleClick).toHaveBeenCalledWith(30);

    // SoM badges present
    expect(screen.getByText('#11')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('#14')).toBeInTheDocument();
    expect(screen.getByText('#25')).toBeInTheDocument();
    expect(screen.getByText('#28')).toBeInTheDocument();
    expect(screen.getByText('#30')).toBeInTheDocument();
  });

  it('updates visual selection state from microState', () => {
    const modifiedState = {
      ...CASE_042_INITIAL_MICRO_STATE,
      greenCarSelected: true,
      insuranceCheckboxChecked: true,
      finalConfirmed: true,
    };

    render(
      <ShinkansenSandbox
        microState={modifiedState}
        somOverlayActive={false}
      />
    );

    const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥13,870/i });
    expect(greenBtn).toHaveClass('ring-2', 'ring-emerald-950');

    const insCheckbox = screen.getByRole('checkbox', { name: /旅行キャンセル保険/i });
    expect(insCheckbox).toBeChecked();

    const confirmBtn = screen.getByRole('button', { name: /予約内容を確認・確定へ/i });
    expect(confirmBtn).toHaveClass('ring-2', 'ring-blue-950');
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

describe('7. GhostReplay Component', () => {
  it('renders trajectory waypoints, redaction bars, and dismiss button when active', () => {
    const toggleFn = vi.fn();

    render(
      <GhostReplay
        active={true}
        onToggle={toggleFn}
        trajectory={CASE_042_GHOST_REPLAY}
      />
    );

    expect(screen.getByTestId('ghost-replay-overlay')).toBeInTheDocument();
    expect(screen.getByText(/TARGET GHOST REPLAY/i)).toBeInTheDocument();
    expect(screen.getByText(/TARGET CLICK @ 0:03 \(COL D, ROW 3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/TARGET CLICK @ 0:05 \(COL D, ROW 4\)/i)).toBeInTheDocument();
    expect(screen.getByText(/FORENSIC ANTI-LEAK PROTOCOL/i)).toBeInTheDocument();

    const returnBtn = screen.getByRole('button', { name: /RETURN TO DOSSIER/i });
    fireEvent.click(returnBtn);
    expect(toggleFn).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when active is false', () => {
    const { container } = render(
      <GhostReplay
        active={false}
        onToggle={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
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
    expect(screen.getAllByText(/\(Exhibit Status: ██ REDACTED ██\)/i)).toHaveLength(2);

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
      { id: 'exhibit_b', code: 'B', title: '14:30 Departure Slot', weight: 20, status: 'VERIFIED', stampText: '[VERIFIED ✓ +20%]', rotationDeg: 3 },
      { id: 'exhibit_c', code: 'C', title: 'Row 2: 🍀 ¥13,870 Seat', weight: 20, status: 'VERIFIED', stampText: '[VERIFIED ✓ +20%]', rotationDeg: -4 },
      { id: 'exhibit_d', code: 'D', title: 'Avoid ¥2,400 Ins. Ad', weight: 15, status: 'CLEAN', stampText: '[CLEAN ✓ +15%]', rotationDeg: 3 },
      { id: 'exhibit_e', code: 'E', title: 'Final Blue Confirm', weight: 20, status: 'MISSED', stampText: '[MISSED ✗ +0%]', rotationDeg: -4 },
    ],
    emojiRow: '🟩🟩🟩🟩⬜',
    shareableClipping: 'KANJION #042 🇯🇵 — 80% × 1.6x = 128 PTS\n🟩🟩🟩🟩⬜ (3/6 Telegrams Sent)',
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

    expect(screen.getByText(/FORENSIC AUDIT REPORT • CASE #042/i)).toBeInTheDocument();
    expect(screen.getAllByText(/80% × 1\.6x = 128 PTS/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Route: 東京 ⇒ 新大阪')).toBeInTheDocument();
    expect(screen.getByText('[VERIFIED ✓ +25%]')).toBeInTheDocument();
    expect(screen.getByText('[CLEAN ✓ +15%]')).toBeInTheDocument();
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
    render(<App />);

    // Initial state: Every game starts at Line 01 with all 6 instructions available
    expect(screen.getByText(/LINE 01 \/ 06/i)).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');

    // Type and Dispatch Line 01
    fireEvent.change(input, { target: { value: 'click green clover 13870 button in 2nd row' } });
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
    expect(screen.getByText(/FORENSIC AUDIT REPORT • CASE #042/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\[VERIFIED ✓ \+20%\]/i).length).toBe(2); // Exhibits B and C both verified at +20%!

    // Return to active play (practice mode)
    const reopenBtn = screen.getByRole('button', { name: /Return to Active Play/i });
    await act(async () => {
      fireEvent.click(reopenBtn);
    });

    expect(screen.queryByText(/FORENSIC AUDIT REPORT/i)).not.toBeInTheDocument();
    expect(screen.getByText(/LINE 02 \/ 06/i)).toBeInTheDocument();
  });

  it('starts on the Krillion-style Newspaper Front Cover, unfolds into a two-page spread, and supports top-left menu & mobile flip tabs', async () => {
    render(<App initialNewspaperOpen={false} />);

    // 1. Newspaper Front Cover is rendered initially
    expect(screen.getByTestId('newspaper-front-cover')).toBeInTheDocument();
    expect(screen.getByText(/THE DAILY DOSSIER/i)).toBeInTheDocument();

    // 2. Top-Left Menu button opens the menu drawer
    const menuBtn = screen.getByRole('button', { name: /Open Game Menu/i });
    fireEvent.click(menuBtn);
    expect(screen.getByTestId('top-left-menu-drawer')).toBeInTheDocument();
    expect(screen.getByText(/Daily Puzzle #042/i)).toBeInTheDocument();

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
