import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import {
  SandboxStage,
  CoordinateRulers,
  GhostReplay,
  ExhibitsPanel,
  DispatchPad,
} from '../src/components';
import {
  CASE_042_INITIAL_MICRO_STATE,
  CASE_042_GHOST_REPLAY,
  CASE_042_EXHIBITS,
} from '../src/data/puzzles/case_042';
import {
  calculateScoreReport,
  evaluateAllExhibits,
  calculateEfficiencyMultiplier,
  calculateFinalScore,
} from '../src/engine/scoring';
import type { ScoreReport, AgentCursorState } from '../src/types/game';
import { STAGE_WIDTH, STAGE_HEIGHT, COLUMN_WIDTH, ROW_HEIGHT } from '../src/utils/coordinate_projector';

const defaultCursor: AgentCursorState = {
  xPercent: 50,
  yPercent: 50,
  thought: 'Idle state',
  variant: 'idle',
  isShaking: false,
};

describe('Adversarial Challenge 1: Responsive Viewport Scaling & Stage Geometry Invariance', () => {
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = global.ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
    vi.restoreAllMocks();
  });

  it('maintains fixed 1024x768 core geometry with zero distortion across target widths: 1024, 768, 600, 480, 375px', async () => {
    const testMatrix = [
      { width: 1024, expectedScale: 1.0, expectedHeight: 768 },
      { width: 768, expectedScale: 0.75, expectedHeight: 576 },
      { width: 600, expectedScale: 600 / 1024, expectedHeight: Math.round(768 * (600 / 1024)) }, // 450px
      { width: 480, expectedScale: 480 / 1024, expectedHeight: Math.round(768 * (480 / 1024)) }, // 360px
      { width: 375, expectedScale: 375 / 1024, expectedHeight: Math.round(768 * (375 / 1024)) }, // 281px
    ];

    for (const testCase of testMatrix) {
      let observerCallback: ResizeObserverCallback | null = null;
      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          observerCallback = callback;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      const { unmount } = render(
        <SandboxStage
          macroViewId="MV-03"
          microState={CASE_042_INITIAL_MICRO_STATE}
          agentCursor={defaultCursor}
          ghostReplayActive={false}
          somOverlayActive={false}
          stageShake={false}
        />
      );

      const stageContainer = screen.getByTestId('sandbox-stage');
      const stageCore = screen.getByTestId('sandbox-core');

      // Mock clientWidth on container
      Object.defineProperty(stageContainer, 'clientWidth', {
        configurable: true,
        value: testCase.width,
      });

      // Trigger ResizeObserver callback and window resize
      await act(async () => {
        if (observerCallback) {
          observerCallback([] as ResizeObserverEntry[], {} as ResizeObserver);
        }
        window.dispatchEvent(new Event('resize'));
      });

      // 1. Verify container height matches exact scaled height: round(768 * scale)
      expect(stageContainer.style.height).toBe(`${testCase.expectedHeight}px`);

      // 2. Verify inner core maintains STRICT fixed 1024x768 dimensions
      expect(stageCore.style.width).toBe('1024px');
      expect(stageCore.style.height).toBe('768px');

      // 3. Verify uniform CSS scale transform with top-left origin
      expect(stageCore.style.transform).toBe(`scale(${testCase.expectedScale})`);
      expect(stageCore.style.transformOrigin).toBe('top left');

      // 4. Verify aspect ratio is strictly invariant (1024 / 768 = 4 / 3)
      const scaledWidth = 1024 * testCase.expectedScale;
      const scaledHeight = 768 * testCase.expectedScale;
      const effectiveRatio = scaledWidth / scaledHeight;
      expect(effectiveRatio).toBeCloseTo(1024 / 768, 5);

      unmount();
    }
  });

  it('clamps upscale on wide screens (>= 1024px) to exactly scale 1.0 without stretching', async () => {
    const wideWidths = [1200, 1440, 1920, 2560];

    for (const width of wideWidths) {
      let observerCallback: ResizeObserverCallback | null = null;
      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          observerCallback = callback;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      const { unmount } = render(
        <SandboxStage
          macroViewId="MV-03"
          microState={CASE_042_INITIAL_MICRO_STATE}
          agentCursor={defaultCursor}
          ghostReplayActive={false}
          somOverlayActive={false}
          stageShake={false}
        />
      );

      const stageContainer = screen.getByTestId('sandbox-stage');
      const stageCore = screen.getByTestId('sandbox-core');

      Object.defineProperty(stageContainer, 'clientWidth', {
        configurable: true,
        value: width,
      });

      await act(async () => {
        if (observerCallback) {
          observerCallback([] as ResizeObserverEntry[], {} as ResizeObserver);
        }
        window.dispatchEvent(new Event('resize'));
      });

      // Scaled factor must clamp at 1.0 (min(width / 1024, 1))
      expect(stageCore.style.transform).toBe('scale(1)');
      expect(stageContainer.style.height).toBe('768px');

      unmount();
    }
  });

  it('handles zero or unmounted width gracefully without dividing by zero or producing NaN', async () => {
    let observerCallback: ResizeObserverCallback | null = null;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={false}
      />
    );

    const stageContainer = screen.getByTestId('sandbox-stage');
    const stageCore = screen.getByTestId('sandbox-core');

    // Simulate 0 clientWidth
    Object.defineProperty(stageContainer, 'clientWidth', {
      configurable: true,
      value: 0,
    });

    await act(async () => {
      if (observerCallback) {
        observerCallback([] as ResizeObserverEntry[], {} as ResizeObserver);
      }
      window.dispatchEvent(new Event('resize'));
    });

    // Should retain fallback scale 1
    expect(stageCore.style.transform).toBe('scale(1)');
    expect(stageContainer.style.height).toBe('768px');
    expect(stageContainer.style.height).not.toContain('NaN');
  });

  it('verifies explicit scaleFactor prop directly overrides container measurement', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={false}
        scaleFactor={0.5}
      />
    );

    const stageContainer = screen.getByTestId('sandbox-stage');
    const stageCore = screen.getByTestId('sandbox-core');

    expect(stageContainer.style.height).toBe('384px'); // 768 * 0.5
    expect(stageCore.style.transform).toBe('scale(0.5)');
  });

  it('cleans up ResizeObserver and resize listeners upon unmounting', () => {
    const disconnectMock = vi.fn();
    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnectMock;
    }
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={false}
      />
    );

    unmount();
    expect(disconnectMock).toHaveBeenCalled();
    expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('Adversarial Challenge 2: Coordinate Rulers Framing & Responsive Collapse', () => {
  it('mathematically aligns 4 columns to 256px each and 4 rows to 192px each', () => {
    expect(STAGE_WIDTH).toBe(1024);
    expect(STAGE_HEIGHT).toBe(768);
    expect(COLUMN_WIDTH).toBe(256);
    expect(ROW_HEIGHT).toBe(192);
    expect(COLUMN_WIDTH * 4).toBe(STAGE_WIDTH);
    expect(ROW_HEIGHT * 4).toBe(STAGE_HEIGHT);

    render(
      <CoordinateRulers>
        <div data-testid="stage-slot">MOCK STAGE</div>
      </CoordinateRulers>
    );

    // Verify top horizontal ruler contains all 4 column boundaries
    expect(screen.getByText(/COL A \(LEFT: 0–256\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL B \(CENTER-LEFT: 256–512\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL C \(CENTER-RIGHT: 512–768\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL D \(RIGHT: 768–1024\)/i)).toBeInTheDocument();

    // Verify left row ruler contains all 4 rows
    expect(screen.getByText('ROW 1')).toBeInTheDocument();
    expect(screen.getByText('ROW 2')).toBeInTheDocument();
    expect(screen.getByText('ROW 3')).toBeInTheDocument();
    expect(screen.getByText('ROW 4')).toBeInTheDocument();
  });

  it('enforces responsive collapse class "hidden sm:flex" on left row ruler', () => {
    const { container } = render(
      <CoordinateRulers>
        <div>STAGE</div>
      </CoordinateRulers>
    );

    const rowRulerContainer = container.querySelector('.hidden.sm\\:flex');
    expect(rowRulerContainer).toBeInTheDocument();
    expect(rowRulerContainer).toHaveClass('w-16', 'shrink-0', 'border-r-2', 'border-dossier-ink');
  });

  it('gracefully formats custom columns and row identifiers', () => {
    render(
      <CoordinateRulers
        columns={['W', 'X', 'Y', 'Z']}
        rows={['10', '20']}
      >
        <div>CUSTOM RULER CONTENT</div>
      </CoordinateRulers>
    );

    expect(screen.getByText(/COL W/i)).toBeInTheDocument();
    expect(screen.getByText(/COL X/i)).toBeInTheDocument();
    expect(screen.getByText(/COL Y/i)).toBeInTheDocument();
    expect(screen.getByText(/COL Z/i)).toBeInTheDocument();
    expect(screen.getByText('ROW 10')).toBeInTheDocument();
    expect(screen.getByText('ROW 20')).toBeInTheDocument();
  });
});

describe('Adversarial Challenge 3: Anti-Copy & Clipboard Tamper Lockout', () => {
  it('intercepts all 5 prohibited events (copy, cut, paste, dragstart, contextmenu) on sandbox stage', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={false}
      />
    );

    const stage = screen.getByTestId('sandbox-stage');
    const prohibitedEvents = ['copy', 'cut', 'paste', 'dragstart', 'contextmenu'];

    for (const eventName of prohibitedEvents) {
      const evt = new Event(eventName, { bubbles: true, cancelable: true });
      stage.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
    }
  });

  it('verifies deep event bubbling protection from child elements within the sandbox', () => {
    const handleClick = vi.fn();
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={true}
        stageShake={false}
        onElementClick={handleClick}
      />
    );

    // Find deep child targets: Japanese fare button #25, promo button #12, and simulated URL bar
    const greenBtn = screen.getByRole('button', { name: /🍀 ◯ ¥13,870/i });
    const promoBtn = screen.getByRole('button', { name: /今すぐ申し込む（赤ボタン）/i });
    const urlText = screen.getByText(/sandbox:\/\/ekinet-jr-sim\.jp/i);

    const targets = [greenBtn, promoBtn, urlText];
    const prohibitedEvents = ['copy', 'cut', 'paste', 'dragstart', 'contextmenu'];

    for (const target of targets) {
      for (const eventName of prohibitedEvents) {
        const evt = new Event(eventName, { bubbles: true, cancelable: true });
        target.dispatchEvent(evt);
        // The event must bubble up to SandboxStage and have defaultPrevented set to true
        expect(evt.defaultPrevented).toBe(true);
      }
    }
  });

  it('verifies CSS text-selection lockout classes and anti-copy telemetry badge', () => {
    render(
      <SandboxStage
        macroViewId="MV-03"
        microState={CASE_042_INITIAL_MICRO_STATE}
        agentCursor={defaultCursor}
        ghostReplayActive={false}
        somOverlayActive={false}
        stageShake={false}
      />
    );

    const stage = screen.getByTestId('sandbox-stage');
    expect(stage).toHaveClass('select-none', 'no-select');

    const core = screen.getByTestId('sandbox-core');
    expect(core).toHaveClass('no-select');

    expect(screen.getByText(/🔒 TEXT SELECTION LOCKED/i)).toBeInTheDocument();
  });
});

describe('Adversarial Challenge 4: Ghost Replay Redaction Integrity & Zero Plaintext Leakage', () => {
  it('strictly guarantees ZERO plaintext leakage of Japanese characters, fares, or train names in GhostReplay', () => {
    render(
      <GhostReplay
        active={true}
        onToggle={vi.fn()}
        trajectory={CASE_042_GHOST_REPLAY}
      />
    );

    const overlay = screen.getByTestId('ghost-replay-overlay');
    const fullText = overlay.textContent || '';

    // 1. Zero Japanese characters (Hiragana, Katakana, CJK Unified Ideographs)
    const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
    expect(fullText).not.toMatch(japaneseRegex);

    // 2. Zero plain currency or fare amounts
    const fareRegex = /¥|\b13,?870\b|\b14,?520\b|\b14,?720\b|\b2,?400\b|特割/;
    expect(fullText).not.toMatch(fareRegex);

    // 3. Zero train names
    const trainNameRegex = /ひかり|のぞみ|Hikari|Nozomi/i;
    expect(fullText).not.toMatch(trainNameRegex);

    // 4. Zero sensitive Japanese parameters
    const paramRegex = /グリーン車|自由席|普通車指定席|旅行キャンセル保険/;
    expect(fullText).not.toMatch(paramRegex);
  });

  it('renders vector trajectory with 1024x768 viewBox and covers sensitive regions with opaque redaction mask', () => {
    const { container } = render(
      <GhostReplay
        active={true}
        onToggle={vi.fn()}
        trajectory={CASE_042_GHOST_REPLAY}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 1024 768');

    // Verify redaction marker mask exists and contains at least 13 redaction bars
    const mask = container.querySelector('#redaction-marker-mask');
    expect(mask).toBeInTheDocument();
    const redactionRects = mask?.querySelectorAll('rect');
    expect(redactionRects?.length).toBeGreaterThanOrEqual(13);

    // Verify all redaction rects have opaque carbon black fill
    redactionRects?.forEach((rect) => {
      expect(rect).toHaveAttribute('fill', '#050505');
    });

    // Verify vector path is present
    const pathGroup = container.querySelector('#ghost-trajectory-paths');
    expect(pathGroup).toBeInTheDocument();

    // Verify waypoints show generic grid coordinates only
    expect(screen.getByText(/COL D, ROW 3/i)).toBeInTheDocument();
    expect(screen.getByText(/COL D, ROW 4/i)).toBeInTheDocument();
  });

  it('handles toggle dismiss callbacks on buttons and direct overlay clicks without bubbling dismiss on children', () => {
    const toggleFn = vi.fn();

    const { rerender } = render(
      <GhostReplay
        active={true}
        onToggle={toggleFn}
      />
    );

    // Header close button
    const returnBtn = screen.getByRole('button', { name: /RETURN TO DOSSIER/i });
    fireEvent.click(returnBtn);
    expect(toggleFn).toHaveBeenCalledTimes(1);

    // Bottom close button
    const bottomReturnBtn = screen.getByRole('button', { name: /RETURN TO DISPATCH PAD/i });
    fireEvent.click(bottomReturnBtn);
    expect(toggleFn).toHaveBeenCalledTimes(2);

    // Backdrop click directly triggers dismiss
    const overlay = screen.getByTestId('ghost-replay-overlay');
    fireEvent.click(overlay);
    expect(toggleFn).toHaveBeenCalledTimes(3);

    // Inactive renders null
    rerender(
      <GhostReplay
        active={false}
        onToggle={toggleFn}
      />
    );
    expect(screen.queryByTestId('ghost-replay-overlay')).not.toBeInTheDocument();
  });
});

describe('Adversarial Challenge 5: Exhibit Stamp Rotation Mathematics & Scoring Engine Oracles', () => {
  it('mathematically alternates stamp tilts: -4 deg (even index) and +3 deg (odd index)', () => {
    const evaluations = evaluateAllExhibits(CASE_042_EXHIBITS, CASE_042_INITIAL_MICRO_STATE);
    expect(evaluations).toHaveLength(5);

    // Indices 0, 2, 4 must be -4 deg; Indices 1, 3 must be +3 deg
    expect(evaluations[0].rotationDeg).toBe(-4);
    expect(evaluations[1].rotationDeg).toBe(3);
    expect(evaluations[2].rotationDeg).toBe(-4);
    expect(evaluations[3].rotationDeg).toBe(3);
    expect(evaluations[4].rotationDeg).toBe(-4);

    const scoreReport = calculateScoreReport(
      CASE_042_EXHIBITS,
      CASE_042_INITIAL_MICRO_STATE,
      3
    );

    render(
      <ExhibitsPanel
        caseClosed={true}
        scoreReport={scoreReport}
      />
    );

    // Verify stamp classes on DOM
    const stampA = document.querySelector('#exhibit-a-stamp');
    const stampB = document.querySelector('#exhibit-b-stamp');
    const stampC = document.querySelector('#exhibit-c-stamp');
    const stampD = document.querySelector('#exhibit-d-stamp');
    const stampE = document.querySelector('#exhibit-e-stamp');

    expect(stampA).toHaveClass('stamp-rotate');      // -4 deg
    expect(stampB).toHaveClass('stamp-rotate-alt');  // +3 deg
    expect(stampC).toHaveClass('stamp-rotate');      // -4 deg
    expect(stampD).toHaveClass('stamp-rotate-alt');  // +3 deg
    expect(stampE).toHaveClass('stamp-rotate');      // -4 deg
  });

  it('correctly applies green vs. red stamp color classes based on stamp status', () => {
    const customScoreReport: ScoreReport = {
      closenessScore: 60,
      multiplier: 1.6,
      finalScore: 96,
      linesUsed: 3,
      unusedLines: 3,
      exhibitEvaluations: [
        { id: 'exhibit_a', code: 'A', title: 'Route', weight: 25, status: 'VERIFIED', stampText: '[VERIFIED ✓]', rotationDeg: -4 },
        { id: 'exhibit_b', code: 'B', title: 'Time', weight: 20, status: 'CLEAN', stampText: '[CLEAN ✓]', rotationDeg: 3 },
        { id: 'exhibit_c', code: 'C', title: 'Seat', weight: 20, status: 'MISSED', stampText: '[MISSED ✗]', rotationDeg: -4 },
        { id: 'exhibit_d', code: 'D', title: 'Ad Trap', weight: 15, status: 'CONTAMINATED', stampText: '[CONTAMINATED ✗]', rotationDeg: 3 },
        { id: 'exhibit_e', code: 'E', title: 'Confirm', weight: 20, status: 'MISSED', stampText: '[MISSED ✗]', rotationDeg: -4 },
      ],
      shareableClipping: 'Dossier share clipping',
    };

    render(
      <ExhibitsPanel
        caseClosed={true}
        scoreReport={customScoreReport}
      />
    );

    const stampA = document.querySelector('#exhibit-a-stamp');
    const stampB = document.querySelector('#exhibit-b-stamp');
    const stampC = document.querySelector('#exhibit-c-stamp');
    const stampD = document.querySelector('#exhibit-d-stamp');

    // VERIFIED and CLEAN: green
    expect(stampA).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen');
    expect(stampB).toHaveClass('border-dossier-stampGreen', 'text-dossier-stampGreen');

    // MISSED and CONTAMINATED: red
    expect(stampC).toHaveClass('border-dossier-stampRed', 'text-dossier-stampRed');
    expect(stampD).toHaveClass('border-dossier-stampRed', 'text-dossier-stampRed');
  });

  it('stress-tests efficiency multiplier mathematical oracle across all linesUsed (0 to 6)', () => {
    const oracleTable = [
      { linesUsed: 0, expectedUnused: 6, expectedMultiplier: 2.0 },
      { linesUsed: 1, expectedUnused: 5, expectedMultiplier: 2.0 },
      { linesUsed: 2, expectedUnused: 4, expectedMultiplier: 1.8 },
      { linesUsed: 3, expectedUnused: 3, expectedMultiplier: 1.6 },
      { linesUsed: 4, expectedUnused: 2, expectedMultiplier: 1.4 },
      { linesUsed: 5, expectedUnused: 1, expectedMultiplier: 1.2 },
      { linesUsed: 6, expectedUnused: 0, expectedMultiplier: 1.0 },
    ];

    for (const entry of oracleTable) {
      const result = calculateEfficiencyMultiplier(entry.linesUsed);
      expect(result.unusedLines).toBe(entry.expectedUnused);
      expect(result.multiplier).toBe(entry.expectedMultiplier);
    }
  });

  it('validates final score mathematical formula and bounds: round(closeness * multiplier)', () => {
    const testCases = [
      { closeness: 100, multiplier: 2.0, expectedFinal: 200 },
      { closeness: 80, multiplier: 1.6, expectedFinal: 128 },
      { closeness: 60, multiplier: 1.4, expectedFinal: 84 },
      { closeness: 45, multiplier: 1.8, expectedFinal: 81 },
      { closeness: 25, multiplier: 1.2, expectedFinal: 30 },
      { closeness: 0, multiplier: 2.0, expectedFinal: 0 },
    ];

    for (const tc of testCases) {
      expect(calculateFinalScore(tc.closeness, tc.multiplier)).toBe(tc.expectedFinal);
    }

    // Upper and lower boundary clamps [0, 200]
    expect(calculateFinalScore(150, 2.0)).toBe(200);
    expect(calculateFinalScore(-20, 1.5)).toBe(0);
  });

  it('verifies shareable Wordle clipping text formatting and clipboard integration', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const report = calculateScoreReport(
      CASE_042_EXHIBITS,
      {
        ...CASE_042_INITIAL_MICRO_STATE,
        greenCarSelected: true,
        finalConfirmed: true,
      },
      3
    );

    // Verify shareable clipping lines
    const lines = report.shareableClipping.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^THE INSTRUCT DOSSIER #042 🇯🇵 — \d+% × \d\.\dx = \d+ PTS$/);
    expect(lines[1]).toMatch(/^[🟩🟥⬜]{5} \(3\/6 Telegrams Sent\)$/u);
    expect(lines[2]).toBe('https://instruct.game/c/042');

    render(
      <ExhibitsPanel
        caseClosed={true}
        scoreReport={report}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Copy Case Clipping/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith(report.shareableClipping);
    expect(screen.getByText(/✓ DISPATCH CLIPPING COPIED!/i)).toBeInTheDocument();
  });

  it('empirically verifies Enter key with whitespace is rejected without line consumption', () => {
    const testInput = "   \t   ";
    const handleSubmit = vi.fn(() => {
      console.log('SUBMITTED! testInput =', JSON.stringify(testInput), 'length =', testInput.length);
    });
    render(
      <DispatchPad
        telegrams={Array.from({ length: 6 }, (_, i) => ({
          lineNumber: i + 1,
          text: '',
          submitted: false,
          exhibitRedactedStatus: 'SEALED',
        }))}
        activeLineIndex={0}
        currentInput={'   \t   '}
        onInputChange={vi.fn()}
        onSubmitLine={handleSubmit}
        onCloseCase={vi.fn()}
        caseStatus="active"
        currentMultiplier={2.0}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
