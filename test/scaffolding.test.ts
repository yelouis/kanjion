import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import App from '../src/App';
import {
  pixelToGrid,
  gridToBoundingBox,
  gridToCenter,
  boxToGrid,
  parseGridCoordinate,
  distanceBetween,
  isPointInBox,
} from '../src/utils/coordinate_projector';
import {
  validateInstruction,
  normalizeInstruction,
  generateStateHash,
  generateCacheKey,
  fastFnv1a,
  computeSha256,
  tokenizeInstruction,
  extractColorTokens,
  extractNumericTokens,
  extractGlyphTokens,
} from '../src/utils/text_normalizer';
import {
  CASE_042_INITIAL_MICRO_STATE,
  CASE_042_MV03_ELEMENTS,
  CASE_042_MACRO_VIEWS,
  CASE_042_EXHIBITS,
  CASE_042_GHOST_REPLAY,
  CASE_042_MANIFEST,
} from '../src/data/puzzles/case_042';
import type { ShinkansenMicroState } from '../src/types/engine';
import type { StampStatus } from '../src/types/game';

describe('1. Broadsheet App Shell & Scaffolding', () => {
  it('mounts the broadsheet layout with masthead header and metadata', () => {
    render(React.createElement(App));
    expect(screen.getByText(/THE INSTRUCT DOSSIER/i)).toBeInTheDocument();
    expect(screen.getByText(/CASE FILE #042/i)).toBeInTheDocument();
    expect(screen.getByText(/6-LINE WESTERN UNION DISPATCH PAD/i)).toBeInTheDocument();
  });

  it('renders the 1024x768 coordinate rulers framing the stage', () => {
    render(React.createElement(App));
    expect(screen.getByText(/COL A \(LEFT: 0–256\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL B \(CENTER-LEFT: 256–512\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL C \(CENTER-RIGHT: 512–768\)/i)).toBeInTheDocument();
    expect(screen.getByText(/COL D \(RIGHT: 768–1024\)/i)).toBeInTheDocument();
    expect(screen.getByText('ROW 1')).toBeInTheDocument();
    expect(screen.getByText('ROW 4')).toBeInTheDocument();
  });

  it('renders initial telegram ledger lines and displays active line input', () => {
    render(React.createElement(App));
    expect(screen.getByText(/select tokyo to shin-osaka tab/i)).toBeInTheDocument();
    expect(screen.getByText(/set departure dropdown to 14:30/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/click green clover 13870 button in 2nd row/i)).toBeInTheDocument();
    expect(screen.getAllByText(/KEEP BLANK FOR \+20% EFFICIENCY MULTIPLIER/i).length).toBeGreaterThan(0);
  });

  it('unseals the 5 declassified exhibits with rubber ink stamps upon closing the case file', () => {
    render(React.createElement(App));
    // Exhibits are sealed initially
    expect(screen.getByText(/██ SEALED UNTIL CASE CLOSED ██/i)).toBeInTheDocument();
    expect(screen.queryByText(/FORENSIC AUDIT REPORT/i)).not.toBeInTheDocument();

    // Click Close Case File
    const closeBtn = screen.getByRole('button', { name: /CLOSE CASE FILE/i });
    fireEvent.click(closeBtn);

    // Exhibits are now unsealed
    expect(screen.getByText(/🔓 UNSEALED \(CASE CLOSED\)/i)).toBeInTheDocument();
    expect(screen.getByText(/FORENSIC AUDIT REPORT • CASE #042/i)).toBeInTheDocument();
    expect(screen.getByText(/Route: 東京 ⇒ 新大阪/i)).toBeInTheDocument();
    expect(screen.getByText(/14:30 Departure Slot/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 2: 🍀 ¥13,870 Seat/i)).toBeInTheDocument();
    expect(screen.getByText(/Avoid ¥2,400 Ins. Ad/i)).toBeInTheDocument();
    expect(screen.getByText(/Final Blue Confirm/i)).toBeInTheDocument();
    expect(screen.getByText(/\[VERIFIED ✓ \+25%\]/i)).toBeInTheDocument();
  });
});

describe('2. Coordinate Projector & Spatial Geometry Utilities', () => {
  it('correctly projects pixels to 4x4 grid cells', () => {
    expect(pixelToGrid(885, 468)).toBe('D3'); // Clover button #25
    expect(pixelToGrid(905, 720)).toBe('D4'); // Confirm button #30
    expect(pixelToGrid(128, 244)).toBe('A2'); // Back button #14
    expect(pixelToGrid(425, 276)).toBe('B2'); // Hikari free #21
    expect(pixelToGrid(635, 276)).toBe('C2'); // Hikari res #22
    expect(pixelToGrid(0, 0)).toBe('A1');
    expect(pixelToGrid(1024, 768)).toBe('D4');
  });

  it('clamps coordinates outside 1024x768 to edge grid cells', () => {
    expect(pixelToGrid(-50, -20)).toBe('A1');
    expect(pixelToGrid(1500, 900)).toBe('D4');
  });

  it('calculates accurate bounding boxes and centers for grid cells', () => {
    const d3Box = gridToBoundingBox('D3');
    expect(d3Box).toEqual({
      x: 768,
      y: 384,
      width: 256,
      height: 192,
      xPercent: 75,
      yPercent: 50,
    });

    const d3Center = gridToCenter('D3');
    expect(d3Center).toEqual({ x: 896, y: 480 });

    const a1Center = gridToCenter('A1');
    expect(a1Center).toEqual({ x: 128, y: 96 });
  });

  it('computes point containment and Euclidean distance', () => {
    const box = { x: 100, y: 100, width: 200, height: 150 };
    expect(isPointInBox({ x: 150, y: 150 }, box)).toBe(true);
    expect(isPointInBox({ x: 50, y: 150 }, box)).toBe(false);

    const dist = distanceBetween({ x: 0, y: 0 }, { x: 300, y: 400 });
    expect(dist).toBe(500);
  });

  it('extracts grid coordinates from varied natural language phrases', () => {
    expect(parseGridCoordinate('click button at d3')).toBe('D3');
    expect(parseGridCoordinate('press D 3 button')).toBe('D3');
    expect(parseGridCoordinate('select at column D row 4 please')).toBe('D4');
    expect(parseGridCoordinate('look at row 2, col a')).toBe('A2');
    expect(parseGridCoordinate('no coordinates mentioned')).toBeNull();
  });
});

describe('3. Text Normalizer & Cache Key Generator', () => {
  it('enforces 60-character limit and non-empty constraint', () => {
    const emptyResult = validateInstruction('   ');
    expect(emptyResult.valid).toBe(false);
    expect(emptyResult.error).toMatch(/cannot be empty/i);

    const valid60 = 'A'.repeat(60);
    const validResult = validateInstruction(valid60);
    expect(validResult.valid).toBe(true);
    expect(validResult.remainingChars).toBe(0);

    const over60 = 'A'.repeat(65);
    const overResult = validateInstruction(over60);
    expect(overResult.valid).toBe(false);
    expect(overResult.error).toMatch(/exceeds maximum length of 60/i);
  });

  it('normalizes full-width IME characters and strips unnecessary punctuation', () => {
    const raw = '１３８７０のグリーン車をクリック！！';
    const normalized = normalizeInstruction(raw);
    expect(normalized).toContain('13870');
    expect(normalized).not.toContain('！');
  });

  it('strictly preserves vital gameplay glyphs (🍀, ◯, ○, △, ×, ▶)', () => {
    const instruction = 'click 🍀 ◯ 13870 ▶ confirm!';
    const normalized = normalizeInstruction(instruction);
    expect(normalized).toBe('click 🍀 ◯ 13870 ▶ confirm');
  });

  it('generates deterministic state hashes and edge cache keys', () => {
    const stateA = {
      selectedRoute: 'tokyo_osaka',
      departureTime: '14:30',
      trainName: 'Nozomi 24',
      greenCarSelected: true,
      fare: 13870,
    };
    const stateB = { ...stateA };

    const hashA = generateStateHash('MV-03', stateA);
    const hashB = generateStateHash('MV-03', stateB);
    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(8);

    const key = generateCacheKey('case_042', hashA, 'click green clover');
    expect(key).toBe(`case_042:${hashA}:click green clover`);
  });

  it('computes FNV-1a and SHA-256 hashes properly', async () => {
    const fnv = fastFnv1a('test-string');
    expect(fnv).toMatch(/^[0-9a-f]{8}$/);

    const sha = await computeSha256('test-string');
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tokenizes natural language instructions into colors, numbers, glyphs, and verbs', () => {
    const tokens = tokenizeInstruction('click green clover 🍀 at D3 for 13870 yen confirm');
    expect(tokens.gridCoordinate).toBe('D3');
    expect(tokens.colors).toContain('green');
    expect(tokens.numbers).toContain('13870');
    expect(tokens.glyphs).toContain('clover');
    expect(tokens.verbs).toContain('click');
    expect(tokens.verbs).toContain('confirm');

    expect(extractColorTokens('select the red and blue buttons')).toEqual(
      expect.arrayContaining(['red', 'blue'])
    );
    expect(extractNumericTokens('fares 13870 and 14520')).toEqual(
      expect.arrayContaining(['13870', '14520'])
    );
    expect(extractGlyphTokens('choose 🍀 or ▶')).toEqual(
      expect.arrayContaining(['clover', 'arrow'])
    );
  });
});

describe('4. Case File #042 Data Integrity & Checkpoint Evaluation', () => {
  it('contains all 9 discrete macro-views', () => {
    expect(CASE_042_MACRO_VIEWS).toHaveLength(9);
    const ids = CASE_042_MACRO_VIEWS.map((v) => v.id);
    expect(ids).toEqual(['MV-01', 'MV-02', 'MV-03', 'MV-04', 'MV-05', 'MV-06', 'MV-07', 'MV-08', 'MV-09']);
  });

  it('defines exactly 11 interactive elements in Macro-View 3 (seat_matrix)', () => {
    expect(CASE_042_MV03_ELEMENTS).toHaveLength(11);
    const somIds = CASE_042_MV03_ELEMENTS.map((e) => e.id);
    expect(somIds).toEqual([11, 12, 14, 21, 22, 23, 24, 25, 28, 29, 30]);
  });

  it('verifies that each MV-03 element bounding box projects to its assigned gridRef', () => {
    for (const el of CASE_042_MV03_ELEMENTS) {
      const calculatedGrid = boxToGrid(el.boundingBox);
      expect(calculatedGrid).toBe(el.gridRef);
    }
  });

  it('identifies key targets (#25, #30) and traps (#11, #12, #28)', () => {
    const clover = CASE_042_MV03_ELEMENTS.find((e) => e.id === 25);
    expect(clover?.isTarget).toBe(true);
    expect(clover?.gridRef).toBe('D3');
    expect(clover?.text).toContain('🍀');

    const confirm = CASE_042_MV03_ELEMENTS.find((e) => e.id === 30);
    expect(confirm?.isTarget).toBe(true);
    expect(confirm?.gridRef).toBe('D4');

    const promoTrap = CASE_042_MV03_ELEMENTS.find((e) => e.id === 12);
    expect(promoTrap?.isTrap).toBe(true);
    expect(promoTrap?.gridRef).toBe('D1');

    const insCheckbox = CASE_042_MV03_ELEMENTS.find((e) => e.id === 28);
    expect(insCheckbox?.isTrap).toBe(true);
    expect(insCheckbox?.gridRef).toBe('B4');
  });

  it('defines 5 Required Exhibits whose weights sum to exactly 100%', () => {
    expect(CASE_042_EXHIBITS).toHaveLength(5);
    const totalWeight = CASE_042_EXHIBITS.reduce((sum, ex) => sum + ex.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it('evaluates initial micro-state to 60% closeness (A verified: 25, B verified: 20, D clean: 15, C/E missed)', () => {
    const evals = CASE_042_EXHIBITS.map((ex) => ex.evaluate(CASE_042_INITIAL_MICRO_STATE));
    const statuses = evals.map((e) => e.status as StampStatus);
    expect(statuses).toEqual(['VERIFIED', 'VERIFIED', 'MISSED', 'CLEAN', 'MISSED']);

    const awardedTotal = evals.reduce((sum, e) => sum + e.awardedPoints, 0);
    expect(awardedTotal).toBe(60); // 25 + 20 + 0 + 15 + 0 = 60
  });

  it('evaluates winning micro-state to 100% closeness', () => {
    const winningState: ShinkansenMicroState = {
      ...CASE_042_INITIAL_MICRO_STATE,
      trainName: 'Nozomi 24',
      seatClass: 'green_car',
      fare: 13870,
      greenCarSelected: true,
      insuranceTrapHit: false,
      insuranceCheckboxChecked: false,
      finalConfirmed: true,
    };

    const evals = CASE_042_EXHIBITS.map((ex) => ex.evaluate(winningState));
    const statuses = evals.map((e) => e.status as StampStatus);
    expect(statuses).toEqual(['VERIFIED', 'VERIFIED', 'VERIFIED', 'CLEAN', 'VERIFIED']);

    const awardedTotal = evals.reduce((sum, e) => sum + e.awardedPoints, 0);
    expect(awardedTotal).toBe(100);
  });

  it('evaluates contaminated decoy trap state properly', () => {
    const trapState: ShinkansenMicroState = {
      ...CASE_042_INITIAL_MICRO_STATE,
      insuranceTrapHit: true,
    };

    const exhibitD = CASE_042_EXHIBITS.find((e) => e.id === 'exhibit_d');
    const result = exhibitD?.evaluate(trapState);
    expect(result?.status).toBe('CONTAMINATED');
    expect(result?.awardedPoints).toBe(0);
    expect(result?.stampText).toContain('[CONTAMINATED ✗');
  });

  it('verifies target ghost replay waypoints and trajectory definition', () => {
    expect(CASE_042_GHOST_REPLAY.waypoints).toHaveLength(2);
    const [wp1, wp2] = CASE_042_GHOST_REPLAY.waypoints;
    expect(wp1.gridRef).toBe('D3');
    expect(wp1.x).toBe(885);
    expect(wp1.y).toBe(468);

    expect(wp2.gridRef).toBe('D4');
    expect(wp2.x).toBe(905);
    expect(wp2.y).toBe(720);

    expect(CASE_042_GHOST_REPLAY.trajectorySvgPath).toContain('M 885');
  });

  it('verifies top-level puzzle manifest', () => {
    expect(CASE_042_MANIFEST.caseNumber).toBe('#042');
    expect(CASE_042_MANIFEST.difficulty).toBe('HARD');
    expect(CASE_042_MANIFEST.initialMacroViewId).toBe('MV-03');
    expect(CASE_042_MANIFEST.macroViews).toHaveLength(9);
    expect(CASE_042_MANIFEST.exhibits).toHaveLength(5);
  });
});
