/**
 * test/coordinate_mapping.test.ts
 *
 * Adversarial stress test suite for spatial coordinate mapping and projection:
 * - src/utils/coordinate_projector.ts
 * - Exact boundary thresholds (x=255.999/256.0, y=191.999/192.0, x=0, y=0, x=1024, y=768)
 * - Out-of-bounds handling (negative values, extreme values >10000, non-finite values)
 * - Natural language coordinate parsing with tricky strings, noise words, false positive hazards
 * - All 11 elements in CASE_001_MV03_ELEMENTS bounding boxes vs assigned gridRef
 * - Spatial grid geometric invariants (full coverage, zero overlap, inverse roundtrip)
 */

import { describe, it, expect } from 'vitest';
import {
  pixelToGrid,
  gridToBoundingBox,
  gridToCenter,
  getBoxCenter,
  boxToGrid,
  isPointInBox,
  tupleToBoundingBox,
  boundingBoxToTuple,
  parseGridCoordinate,
  STAGE_WIDTH,
  STAGE_HEIGHT,
  COLUMN_WIDTH,
  ROW_HEIGHT,
  GRID_COLUMNS,
  GRID_ROWS,
} from '../src/utils/coordinate_projector';
import { CASE_001_MV03_ELEMENTS } from '../src/data/puzzles/case_001';
import { normalizeInstruction } from '../src/utils/text_normalizer';
import { GridCoordinate } from '../src/types/engine';

describe('Adversarial Coordinate Mapping & Projection Stress Suite', () => {

  describe('1. Exact Boundary Thresholds & Floating Point Precision', () => {
    it('projects origin (0, 0) strictly to A1', () => {
      expect(pixelToGrid(0, 0)).toBe('A1');
    });

    it('projects max extents (1024, 768) strictly to D4', () => {
      expect(pixelToGrid(1024, 768)).toBe('D4');
      expect(pixelToGrid(STAGE_WIDTH, STAGE_HEIGHT)).toBe('D4');
    });

    it('evaluates Column A vs Column B boundary at 256px', () => {
      // Just inside Column A
      expect(pixelToGrid(255.0, 100)).toBe('A1');
      expect(pixelToGrid(255.999, 100)).toBe('A1');
      expect(pixelToGrid(255.999999, 100)).toBe('A1');

      // Exact boundary threshold transitions to Column B
      expect(pixelToGrid(256.0, 100)).toBe('B1');
      expect(pixelToGrid(256.000001, 100)).toBe('B1');
    });

    it('evaluates Column B vs Column C boundary at 512px', () => {
      expect(pixelToGrid(511.999, 100)).toBe('B1');
      expect(pixelToGrid(512.0, 100)).toBe('C1');
      expect(pixelToGrid(512.001, 100)).toBe('C1');
    });

    it('evaluates Column C vs Column D boundary at 768px', () => {
      expect(pixelToGrid(767.999, 100)).toBe('C1');
      expect(pixelToGrid(768.0, 100)).toBe('D1');
      expect(pixelToGrid(768.001, 100)).toBe('D1');
    });

    it('evaluates Row 1 vs Row 2 boundary at 192px', () => {
      expect(pixelToGrid(100, 191.0)).toBe('A1');
      expect(pixelToGrid(100, 191.999)).toBe('A1');
      expect(pixelToGrid(100, 191.999999)).toBe('A1');

      expect(pixelToGrid(100, 192.0)).toBe('A2');
      expect(pixelToGrid(100, 192.000001)).toBe('A2');
    });

    it('evaluates Row 2 vs Row 3 boundary at 384px', () => {
      expect(pixelToGrid(100, 383.999)).toBe('A2');
      expect(pixelToGrid(100, 384.0)).toBe('A3');
      expect(pixelToGrid(100, 384.001)).toBe('A3');
    });

    it('evaluates Row 3 vs Row 4 boundary at 576px', () => {
      expect(pixelToGrid(100, 575.999)).toBe('A3');
      expect(pixelToGrid(100, 576.0)).toBe('A4');
      expect(pixelToGrid(100, 576.001)).toBe('A4');
    });

    it('verifies all 16 cell interior midpoint coordinates', () => {
      const expectedMidpoints: Record<GridCoordinate, [number, number]> = {
        A1: [128, 96],
        B1: [384, 96],
        C1: [640, 96],
        D1: [896, 96],
        A2: [128, 288],
        B2: [384, 288],
        C2: [640, 288],
        D2: [896, 288],
        A3: [128, 480],
        B3: [384, 480],
        C3: [640, 480],
        D3: [896, 480],
        A4: [128, 672],
        B4: [384, 672],
        C4: [640, 672],
        D4: [896, 672],
      };

      for (const [coord, [x, y]] of Object.entries(expectedMidpoints)) {
        expect(pixelToGrid(x, y)).toBe(coord);
        const center = gridToCenter(coord as GridCoordinate);
        expect(center).toEqual({ x, y });
      }
    });
  });

  describe('2. Out-of-Bounds & Extreme Values Stress Test', () => {
    it('clamps negative x and negative y to A1', () => {
      expect(pixelToGrid(-0.00001, -0.00001)).toBe('A1');
      expect(pixelToGrid(-1, -1)).toBe('A1');
      expect(pixelToGrid(-500, -200)).toBe('A1');
      expect(pixelToGrid(-10000, -10000)).toBe('A1');
      expect(pixelToGrid(-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER)).toBe('A1');
      expect(pixelToGrid(-Infinity, -Infinity)).toBe('A1');
    });

    it('clamps extreme positive x and y to D4', () => {
      expect(pixelToGrid(1024.00001, 768.00001)).toBe('D4');
      expect(pixelToGrid(1025, 769)).toBe('D4');
      expect(pixelToGrid(5000, 3000)).toBe('D4');
      expect(pixelToGrid(10000, 10000)).toBe('D4');
      expect(pixelToGrid(999999, 999999)).toBe('D4');
      expect(pixelToGrid(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe('D4');
      expect(pixelToGrid(Infinity, Infinity)).toBe('D4');
    });

    it('clamps cross-axis extremes to respective edge cells', () => {
      // Top-right extreme: (10000, -500) -> D1
      expect(pixelToGrid(10000, -500)).toBe('D1');
      // Bottom-left extreme: (-500, 10000) -> A4
      expect(pixelToGrid(-500, 10000)).toBe('A4');
      // Mid-Y negative X: (-100, 400) -> A3
      expect(pixelToGrid(-100, 400)).toBe('A3');
      // Mid-X extreme Y: (600, 10000) -> C4
      expect(pixelToGrid(600, 10000)).toBe('C4');
      // Mid-X negative Y: (300, -100) -> B1
      expect(pixelToGrid(300, -100)).toBe('B1');
    });

    it('documents NaN behavior in pixelToGrid', () => {
      // Testing robustness under NaN inputs
      // Math.max(0, Math.min(NaN, 1024)) results in NaN in JS, producing undefined in lookup
      const nanResult = pixelToGrid(NaN, NaN);
      expect(nanResult).toBe('undefinedundefined');
    });
  });

  describe('3. Natural Language Coordinate Parsing Stress Test', () => {
    it('parses standard compact coordinates case-insensitively', () => {
      expect(parseGridCoordinate('A1')).toBe('A1');
      expect(parseGridCoordinate('a1')).toBe('A1');
      expect(parseGridCoordinate('b2')).toBe('B2');
      expect(parseGridCoordinate('B2')).toBe('B2');
      expect(parseGridCoordinate('c3')).toBe('C3');
      expect(parseGridCoordinate('C3')).toBe('C3');
      expect(parseGridCoordinate('d4')).toBe('D4');
      expect(parseGridCoordinate('D4')).toBe('D4');
    });

    it('parses spaced coordinates ("D 4", "d 4", "A  1")', () => {
      expect(parseGridCoordinate('D 4')).toBe('D4');
      expect(parseGridCoordinate('d 4')).toBe('D4');
      expect(parseGridCoordinate('d  4')).toBe('D4');
      expect(parseGridCoordinate('a 1')).toBe('A1');
      expect(parseGridCoordinate('B 3')).toBe('B3');
    });

    it('parses "column X row Y" phrasing with varying spacing and words', () => {
      expect(parseGridCoordinate('column d row 4')).toBe('D4');
      expect(parseGridCoordinate('Column D Row 4')).toBe('D4');
      expect(parseGridCoordinate('COLUMN D ROW 4')).toBe('D4');
      expect(parseGridCoordinate('col d row 4')).toBe('D4');
      expect(parseGridCoordinate('col a row 1')).toBe('A1');
      expect(parseGridCoordinate('column b, row 2')).toBe('B2');
      expect(parseGridCoordinate('col c and row 3')).toBe('C3');
      expect(parseGridCoordinate('select at column D row 4 please')).toBe('D4');
    });

    it('parses inverted "row Y col X" phrasing', () => {
      expect(parseGridCoordinate('row 4 col d')).toBe('D4');
      expect(parseGridCoordinate('Row 4 Column D')).toBe('D4');
      expect(parseGridCoordinate('ROW 1 COL A')).toBe('A1');
      expect(parseGridCoordinate('row 2, col b')).toBe('B2');
      expect(parseGridCoordinate('row 3 column c')).toBe('C3');
      expect(parseGridCoordinate('look at row 4 and column d')).toBe('D4');
    });

    it('parses prefixed phrases ("grid D4", "cell D4", "pos D4")', () => {
      expect(parseGridCoordinate('grid D4')).toBe('D4');
      expect(parseGridCoordinate('GRID D4')).toBe('D4');
      expect(parseGridCoordinate('grid d4')).toBe('D4');
      expect(parseGridCoordinate('cell D4')).toBe('D4');
      expect(parseGridCoordinate('cell b2')).toBe('B2');
      expect(parseGridCoordinate('at grid c3')).toBe('C3');
    });

    it('handles embedded coordinates in complex noisy telegram sentences', () => {
      expect(parseGridCoordinate('AGENT: please move to D4 and confirm booking')).toBe('D4');
      expect(parseGridCoordinate('click green clover button at d3 immediately')).toBe('D3');
      expect(parseGridCoordinate('avoid red banner at d1 at all costs')).toBe('D1');
      expect(parseGridCoordinate('select non-reserved seat B2 on hikari 515')).toBe('B2');
    });

    it('rejects invalid or non-coordinate strings', () => {
      expect(parseGridCoordinate('')).toBeNull();
      expect(parseGridCoordinate('   ')).toBeNull();
      expect(parseGridCoordinate('click the blue button')).toBeNull();
      expect(parseGridCoordinate('Hikari 515')).toBeNull();
      expect(parseGridCoordinate('Nozomi 24')).toBeNull();
      expect(parseGridCoordinate('¥13,870')).toBeNull();
      expect(parseGridCoordinate('¥2,400')).toBeNull();
      expect(parseGridCoordinate('cancel booking')).toBeNull();
      expect(parseGridCoordinate('logout now')).toBeNull();
      expect(parseGridCoordinate('confirm booking')).toBeNull();
    });

    it('rejects coordinates with out-of-grid letters or numbers', () => {
      // Columns E-Z are outside the 4x4 grid
      expect(parseGridCoordinate('E1')).toBeNull();
      expect(parseGridCoordinate('E4')).toBeNull();
      expect(parseGridCoordinate('F2')).toBeNull();
      expect(parseGridCoordinate('Z9')).toBeNull();

      // Rows 0 or 5-9 are outside the 4x4 grid
      expect(parseGridCoordinate('A0')).toBeNull();
      expect(parseGridCoordinate('D5')).toBeNull();
      expect(parseGridCoordinate('B6')).toBeNull();
      expect(parseGridCoordinate('C9')).toBeNull();
      expect(parseGridCoordinate('col d row 5')).toBeNull();
      expect(parseGridCoordinate('row 0 col a')).toBeNull();
    });

    it('rejects multi-digit numbers like D300 or B12 due to word boundaries', () => {
      expect(parseGridCoordinate('D300')).toBeNull();
      expect(parseGridCoordinate('B12')).toBeNull();
      expect(parseGridCoordinate('A40')).toBeNull();
      expect(parseGridCoordinate('C25')).toBeNull();
    });

    it('detects potential edge case: "a 1" in common English phrases', () => {
      // In natural language "I have a 1 year old", "a 1" matches the single letter 'a' + '1'
      // This is an empirical observation of regex /\b([a-d])\s*([1-4])\b/i
      const phraseMatch = parseGridCoordinate('I have a 1 year old child');
      expect(phraseMatch).toBe('A1'); // Demonstrating empirical edge case
    });

    it('evaluates full-width / IME character behavior in coordinate parsing', () => {
      // Raw full-width characters without NFKC normalization
      expect(parseGridCoordinate('Ｄ４')).toBeNull(); // Raw full-width is not matched by ASCII [a-d][1-4]

      // When passed through normalizeInstruction first, it normalizes to ASCII 'd4'
      const normalized = normalizeInstruction('Ｄ４');
      expect(normalized).toBe('d4');
      expect(parseGridCoordinate(normalized)).toBe('D4');
    });
  });

  describe('4. Verification of All 11 Elements in CASE_001_MV03_ELEMENTS', () => {
    it('verifies that exactly 11 elements exist in MV-03', () => {
      expect(CASE_001_MV03_ELEMENTS).toHaveLength(11);
    });

    it('verifies bounding box, center, and gridRef projection for every element', () => {
      for (const el of CASE_001_MV03_ELEMENTS) {
        const box = el.boundingBox;

        // 1. Box dimensions must be strictly positive and fit stage
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.x + box.width).toBeLessThanOrEqual(STAGE_WIDTH);
        expect(box.y + box.height).toBeLessThanOrEqual(STAGE_HEIGHT);

        // 2. Percentages must be mathematically consistent
        expect(box.xPercent).toBeCloseTo((box.x / STAGE_WIDTH) * 100, 1);
        expect(box.yPercent).toBeCloseTo((box.y / STAGE_HEIGHT) * 100, 1);

        // 3. Center point calculation
        const center = getBoxCenter(box);
        expect(center.x).toBe(box.x + box.width / 2);
        expect(center.y).toBe(box.y + box.height / 2);

        // 4. Center point must be inside the element's bounding box
        expect(isPointInBox(center, box)).toBe(true);

        // 5. Projected grid cell from center must match assigned gridRef
        const projectedGrid = boxToGrid(box);
        expect(projectedGrid).toBe(el.gridRef);
      }
    });

    it('verifies specific coordinates for key target elements', () => {
      // Target #25: Green car discount button
      const el25 = CASE_001_MV03_ELEMENTS.find((el) => el.id === 25);
      expect(el25).toBeDefined();
      expect(el25!.gridRef).toBe('D3');
      expect(el25!.boundingBox.x).toBe(790);
      expect(el25!.boundingBox.y).toBe(450);
      expect(el25!.boundingBox.width).toBe(190);
      expect(el25!.boundingBox.height).toBe(36);
      const center25 = getBoxCenter(el25!.boundingBox);
      expect(center25).toEqual({ x: 885, y: 468 });
      expect(pixelToGrid(center25.x, center25.y)).toBe('D3');

      // Target #30: Final confirmation button
      const el30 = CASE_001_MV03_ELEMENTS.find((el) => el.id === 30);
      expect(el30).toBeDefined();
      expect(el30!.gridRef).toBe('D4');
      expect(el30!.boundingBox.x).toBe(810);
      expect(el30!.boundingBox.y).toBe(704);
      expect(el30!.boundingBox.width).toBe(190);
      expect(el30!.boundingBox.height).toBe(32);
      const center30 = getBoxCenter(el30!.boundingBox);
      expect(center30).toEqual({ x: 905, y: 720 });
      expect(pixelToGrid(center30.x, center30.y)).toBe('D4');
    });

    it('analyzes boundary span for wide elements (e.g. Checkbox #28)', () => {
      // Element #28: [270, 706, 260, 24]
      const el28 = CASE_001_MV03_ELEMENTS.find((el) => el.id === 28);
      expect(el28).toBeDefined();
      expect(el28!.gridRef).toBe('B4');

      // Left edge is at x=270 (in Column B: 256..512)
      expect(pixelToGrid(el28!.boundingBox.x, el28!.boundingBox.y)).toBe('B4');

      // Center is at x=400 (in Column B)
      const center28 = getBoxCenter(el28!.boundingBox);
      expect(center28.x).toBe(400);
      expect(pixelToGrid(center28.x, center28.y)).toBe('B4');

      // Right edge is at x=530 (crosses into Column C: 512..768)
      const rightX = el28!.boundingBox.x + el28!.boundingBox.width;
      expect(rightX).toBe(530);
      expect(pixelToGrid(rightX, center28.y)).toBe('C4');

      // Demonstrates that boxToGrid uses centroid projection to resolve multi-cell elements deterministically
      expect(boxToGrid(el28!.boundingBox)).toBe('B4');
    });
  });

  describe('5. Spatial Grid Geometric Invariants & Roundtrip Consistency', () => {
    it('verifies that the 16 grid cells partition the 1024x768 stage with zero gaps and zero overlap', () => {
      let totalArea = 0;
      const allCells: GridCoordinate[] = [];

      for (const col of GRID_COLUMNS) {
        for (const row of GRID_ROWS) {
          const coord = `${col}${row}` as GridCoordinate;
          allCells.push(coord);
          const box = gridToBoundingBox(coord);

          expect(box.width).toBe(COLUMN_WIDTH);
          expect(box.height).toBe(ROW_HEIGHT);
          totalArea += box.width * box.height;
        }
      }

      expect(allCells).toHaveLength(16);
      expect(totalArea).toBe(STAGE_WIDTH * STAGE_HEIGHT); // 1024 * 768 = 786,432
    });

    it('verifies roundtrip: grid -> boundingBox -> boxToGrid preserves identity', () => {
      for (const col of GRID_COLUMNS) {
        for (const row of GRID_ROWS) {
          const coord = `${col}${row}` as GridCoordinate;
          const box = gridToBoundingBox(coord);
          const roundtrip = boxToGrid(box);
          expect(roundtrip).toBe(coord);
        }
      }
    });

    it('verifies roundtrip: grid -> center -> pixelToGrid preserves identity', () => {
      for (const col of GRID_COLUMNS) {
        for (const row of GRID_ROWS) {
          const coord = `${col}${row}` as GridCoordinate;
          const center = gridToCenter(coord);
          const roundtrip = pixelToGrid(center.x, center.y);
          expect(roundtrip).toBe(coord);
        }
      }
    });

    it('verifies tuple conversion roundtrip integrity', () => {
      const originalTuple: [number, number, number, number] = [100, 200, 300, 400];
      const box = tupleToBoundingBox(originalTuple);
      expect(box.x).toBe(100);
      expect(box.y).toBe(200);
      expect(box.width).toBe(300);
      expect(box.height).toBe(400);

      const restoredTuple = boundingBoxToTuple(box);
      expect(restoredTuple).toEqual(originalTuple);
    });

    it('throws expected error when gridToBoundingBox receives invalid coordinate', () => {
      // @ts-expect-error Testing invalid runtime input
      expect(() => gridToBoundingBox('E5')).toThrow(/Invalid grid coordinate/i);
      // @ts-expect-error Testing invalid runtime input
      expect(() => gridToBoundingBox('Z9')).toThrow(/Invalid grid coordinate/i);
      // @ts-expect-error Testing invalid runtime input
      expect(() => gridToBoundingBox('A0')).toThrow(/Invalid grid coordinate/i);
    });
  });
});
