/**
 * test/puzzle_compiler.test.ts
 *
 * Comprehensive automated verification suite for Milestone 4: Puzzle Compilation Tooling.
 * Covers all 7 vectors:
 * 1. CLI Argument Parsing & Option Normalization
 * 2. Bounding Box Calculation & Center Point Math
 * 3. 4x4 Grid Coordinate Projection (A1–D4)
 * 4. HTML/CSS Script Stripping & Security Sanitization
 * 5. Macro-View Bundling & Finite State Machine Invariants
 * 6. Manifest JSON Schema Conformance & Asset Packaging
 * 7. Case File #042 Out-of-the-Box Compilation & Exit Codes
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';

import {
  parseCliArguments,
  validateHtmlSanitization,
  validatePuzzleInvariants,
  compileOfflineCase042,
  compileFixtureOffline,
  extractElementsOffline,
  sanitizePuzzleHtml,
  EXIT_SUCCESS,
  EXIT_INVALID_ARGS,
  EXIT_RESOURCE_NOT_FOUND,
  EXIT_SANITIZATION_FAILED,
  EXIT_GEOMETRY_VIOLATION,
  EXIT_INVARIANT_VIOLATION,
  CompilerArgumentError,
  ResourceNotFoundError,
  SanitizationError,
  SchemaInvariantError,
} from '../tools/compile_puzzle';

import {
  computeBadgeGeometry,
  generateSvgSomOverlay,
} from '../tools/lib/som_annotator';

import {
  buildDeclarativeManifest,
  validatePositiveExhibitsOnly,
  scoreCandidateSiteDifficulty,
} from '../tools/lib/manifest_builder';

import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  boxToGrid,
  getBoxCenter,
  tupleToBoundingBox,
  pixelToGrid,
} from '../src/utils/coordinate_projector';

import {
  CASE_042_MANIFEST,
  CASE_042_MACRO_VIEWS,
  CASE_042_MV03_ELEMENTS,
  CASE_042_EXHIBITS,
} from '../src/data/puzzles/case_042';

import type { PuzzleManifest } from '../src/types/puzzle';

describe('Milestone 4: Puzzle Compilation Tooling Verification Suite', () => {

  // =========================================================================
  // Vector 1: CLI Argument Parsing & Option Normalization
  // =========================================================================
  describe('Vector 1: CLI Argument Parsing & Option Normalization', () => {
    it('parses valid arguments with defaults', () => {
      const args = ['--case', '042', '--offline'];
      const options = parseCliArguments(args);

      expect(options.caseId).toBe('042');
      expect(options.offline).toBe(true);
      expect(options.somDensity).toBe('standard');
      expect(options.dryRun).toBe(false);
      expect(options.validate).toBe(false);
      expect(options.verbose).toBe(false);
      expect(options.outDir).toContain(path.normalize('public/puzzles/042'));
    });

    it('normalizes case ID by stripping leading hash', () => {
      const options = parseCliArguments(['--case', '#042', '--offline']);
      expect(options.caseId).toBe('042');
    });

    it('accepts valid custom som-density flags (sparse, dense)', () => {
      const optSparse = parseCliArguments(['--case', '042', '--som-density', 'sparse']);
      expect(optSparse.somDensity).toBe('sparse');

      const optDense = parseCliArguments(['--case', '042', '--som-density', 'dense']);
      expect(optDense.somDensity).toBe('dense');
    });

    it('handles --dry-run and --verbose flags properly', () => {
      const options = parseCliArguments(['--case', '042', '--dry-run', '--verbose']);
      expect(options.dryRun).toBe(true);
      expect(options.verbose).toBe(true);
    });

    it('rejects invalid --som-density values with CompilerArgumentError (exit code 1)', () => {
      try {
        parseCliArguments(['--case', '042', '--som-density', 'invalid_density']);
        expect.unreachable('Should have thrown CompilerArgumentError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CompilerArgumentError);
        expect(err.exitCode).toBe(EXIT_INVALID_ARGS);
        expect(err.message).toContain('Invalid --som-density');
      }
    });

    it('exits with code 1 when no input source (--case, --fixture, --url) is provided', () => {
      try {
        parseCliArguments(['--offline', '--dry-run']);
        expect.unreachable('Should have thrown CompilerArgumentError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(CompilerArgumentError);
        expect(err.exitCode).toBe(EXIT_INVALID_ARGS);
        expect(err.message).toContain('Must specify an input source');
      }
    });

    it('handles --help flag cleanly', () => {
      const options = parseCliArguments(['--help']);
      expect(options.help).toBe(true);
    });
  });

  // =========================================================================
  // Vector 2: Bounding Box Calculation & Center Point Math
  // =========================================================================
  describe('Vector 2: Bounding Box Calculation & Center Point Math', () => {
    it('converts raw coordinate tuples to BoundingBox objects with percentage coordinates', () => {
      const box = tupleToBoundingBox([790, 450, 190, 36]); // Clover button #25
      expect(box.x).toBe(790);
      expect(box.y).toBe(450);
      expect(box.width).toBe(190);
      expect(box.height).toBe(36);
      expect(box.xPercent).toBeCloseTo(77.15, 1);
      expect(box.yPercent).toBeCloseTo(58.59, 1);
    });

    it('calculates accurate center coordinates (cx, cy) using (x + w/2, y + h/2)', () => {
      const box = tupleToBoundingBox([810, 704, 190, 32]); // Confirm button #30
      const center = getBoxCenter(box);
      expect(center.x).toBe(810 + 190 / 2); // 905
      expect(center.y).toBe(704 + 32 / 2);  // 720
    });

    it('asserts all MV-03 element bounding boxes fit within 1024x768', () => {
      for (const el of CASE_042_MV03_ELEMENTS) {
        const b = el.boundingBox;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(STAGE_WIDTH);
        expect(b.y + b.height).toBeLessThanOrEqual(STAGE_HEIGHT);
      }
    });

    it('clamps badge positioning within viewport safety bounds [2, 1022] x [2, 766]', () => {
      // Element in top-left corner
      const tlBadge = computeBadgeGeometry({ x: 0, y: 0, width: 50, height: 20 }, '#1');
      expect(tlBadge.badgeX).toBeGreaterThanOrEqual(2);
      expect(tlBadge.badgeY).toBeGreaterThanOrEqual(2);

      // Element in bottom-right corner flush against edge
      const brBadge = computeBadgeGeometry({ x: 1000, y: 750, width: 24, height: 18 }, '#99');
      expect(brBadge.badgeX + brBadge.badgeWidth).toBeLessThanOrEqual(STAGE_WIDTH - 2);
      expect(brBadge.badgeY + brBadge.badgeHeight).toBeLessThanOrEqual(STAGE_HEIGHT - 2);
    });
  });

  // =========================================================================
  // Vector 3: 4x4 Grid Coordinate Projection (A1–D4)
  // =========================================================================
  describe('Vector 3: Grid Coordinate Projection (A1–D4)', () => {
    it('projects pixel coordinates across column boundaries (256px steps)', () => {
      expect(pixelToGrid(100, 100)).toBe('A1'); // 0-256 -> A
      expect(pixelToGrid(300, 100)).toBe('B1'); // 256-512 -> B
      expect(pixelToGrid(600, 100)).toBe('C1'); // 512-768 -> C
      expect(pixelToGrid(800, 100)).toBe('D1'); // 768-1024 -> D
    });

    it('projects pixel coordinates across row boundaries (192px steps)', () => {
      expect(pixelToGrid(100, 100)).toBe('A1'); // 0-192 -> 1
      expect(pixelToGrid(100, 250)).toBe('A2'); // 192-384 -> 2
      expect(pixelToGrid(100, 450)).toBe('A3'); // 384-576 -> 3
      expect(pixelToGrid(100, 650)).toBe('A4'); // 576-768 -> 4
    });

    it('handles exact boundary threshold values (256.0, 512.0, 768.0, 192.0, 384.0, 576.0)', () => {
      expect(pixelToGrid(255.99, 100)).toBe('A1');
      expect(pixelToGrid(256.0, 100)).toBe('B1');
      expect(pixelToGrid(511.99, 100)).toBe('B1');
      expect(pixelToGrid(512.0, 100)).toBe('C1');
      expect(pixelToGrid(767.99, 100)).toBe('C1');
      expect(pixelToGrid(768.0, 100)).toBe('D1');

      expect(pixelToGrid(100, 191.99)).toBe('A1');
      expect(pixelToGrid(100, 192.0)).toBe('A2');
      expect(pixelToGrid(100, 383.99)).toBe('A2');
      expect(pixelToGrid(100, 384.0)).toBe('A3');
      expect(pixelToGrid(100, 575.99)).toBe('A3');
      expect(pixelToGrid(100, 576.0)).toBe('A4');
    });

    it('verifies that all 11 elements in CASE_042_MV03 project to their exact assigned gridRef', () => {
      for (const el of CASE_042_MV03_ELEMENTS) {
        const projected = boxToGrid(el.boundingBox);
        expect(projected).toBe(el.gridRef);
      }
    });

    it('verifies centroid projection for wide elements spanning multiple columns (e.g. Checkbox #28 at B4)', () => {
      const el28 = CASE_042_MV03_ELEMENTS.find((e) => e.id === 28)!;
      expect(el28).toBeDefined();
      expect(el28.boundingBox.x).toBe(270);
      expect(el28.boundingBox.width).toBe(260); // 270 + 260 = 530 (spans into Col C)

      const center = getBoxCenter(el28.boundingBox);
      expect(center.x).toBe(400); // 270 + 130 = 400 (firmly inside Col B)
      expect(center.y).toBe(718); // 706 + 12 = 718 (firmly inside Row 4)
      expect(boxToGrid(el28.boundingBox)).toBe('B4');
    });

    it('clamps out-of-bounds coordinates to nearest edge cell', () => {
      expect(pixelToGrid(-50, -50)).toBe('A1');
      expect(pixelToGrid(1500, 1000)).toBe('D4');
      expect(pixelToGrid(-20, 500)).toBe('A3');
      expect(pixelToGrid(900, -20)).toBe('D1');
    });
  });

  // =========================================================================
  // Vector 4: HTML/CSS Script Stripping & Security Sanitization
  // =========================================================================
  describe('Vector 4: HTML/CSS Script Stripping & Security Sanitization', () => {
    it('detects and flags <script> tags and inline script bodies', () => {
      const dirtyHtml = '<div><script>alert("xss")</script><button>Click</button></div>';
      const result = validateHtmlSanitization(dirtyHtml);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Prohibited <script> tag detected');
    });

    it('detects and flags inline event handlers (onclick, onmouseover, onload, onerror)', () => {
      const dirtyHtml = '<button onclick="doAttack()" onmouseover="track()">Submit</button>';
      const result = validateHtmlSanitization(dirtyHtml);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Prohibited inline event handler (onclick, onload, etc.) detected');
    });

    it('detects and flags prohibited <iframe>, <object>, and <embed> tags', () => {
      const dirtyIframe = '<iframe src="https://phishing.com"></iframe>';
      expect(validateHtmlSanitization(dirtyIframe).valid).toBe(false);

      const dirtyObject = '<object data="exploit.swf"></object>';
      expect(validateHtmlSanitization(dirtyObject).valid).toBe(false);

      const dirtyEmbed = '<embed src="exploit.pdf">';
      expect(validateHtmlSanitization(dirtyEmbed).valid).toBe(false);
    });

    it('detects and flags unstylable native <select> elements and date pickers', () => {
      const dirtySelect = '<select><option>Tokyo</option></select>';
      const resultSelect = validateHtmlSanitization(dirtySelect);
      expect(resultSelect.valid).toBe(false);
      expect(resultSelect.violations).toContain('Prohibited native <select> tag detected; custom in-DOM controls required');

      const dirtyDate = '<input type="date" name="departure">';
      const resultDate = validateHtmlSanitization(dirtyDate);
      expect(resultDate.valid).toBe(false);
      expect(resultDate.violations.some((v) => v.includes('input type="date"'))).toBe(true);
    });

    it('passes clean, fully compliant sandbox HTML clones', () => {
      const cleanHtml = `
        <div class="stage-container" style="width: 1024px; height: 768px;">
          <header class="chrome-bar"><span>https://ekinet.jp</span></header>
          <div class="fare-table">
            <button class="seat-btn" data-som-id="25">🍀 ¥13,870</button>
            <button class="confirm-btn" data-som-id="30">Confirm</button>
          </div>
        </div>
      `;
      const result = validateHtmlSanitization(cleanHtml);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('sanitizes dirty HTML by stripping scripts and handlers via sanitizePuzzleHtml', () => {
      const dirtyHtml = `
        <html>
          <head>
            <script>console.log("bad");</script>
            <meta http-equiv="refresh" content="5">
          </head>
          <body>
            <button onclick="badClick()" style="expression(alert(1));">Button</button>
            <a href="javascript:void(0)">Link</a>
          </body>
        </html>
      `;

      const report = sanitizePuzzleHtml(dirtyHtml);
      expect(report.sanitizedHtml).not.toContain('<script');
      expect(report.sanitizedHtml).not.toContain('onclick');
      expect(report.sanitizedHtml).not.toContain('javascript:');
      expect(report.strippedTagsCount).toBeGreaterThan(0);
      expect(report.strippedEventHandlersCount).toBeGreaterThan(0);
    });

    it('throws SanitizationError with exit code 3 when encountering native <select>', () => {
      const htmlWithSelect = '<div><select><option>Option 1</option></select></div>';
      try {
        sanitizePuzzleHtml(htmlWithSelect);
        expect.unreachable('Should have thrown SanitizationError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(SanitizationError);
        expect(err.exitCode).toBe(EXIT_SANITIZATION_FAILED);
        expect(err.message).toContain('Native unstylable control detected: <select>');
      }
    });
  });

  // =========================================================================
  // Vector 5: Macro-View Bundling & Finite State Machine Invariants
  // =========================================================================
  describe('Vector 5: Macro-View Bundling & Invariant Validation', () => {
    it('verifies that Case File #042 defines bounded Macro-Views (8 to 12)', () => {
      expect(CASE_042_MACRO_VIEWS.length).toBeGreaterThanOrEqual(8);
      expect(CASE_042_MACRO_VIEWS.length).toBeLessThanOrEqual(12);
      expect(CASE_042_MACRO_VIEWS).toHaveLength(12);
    });

    it('enforces positive-only exhibits and scores candidate sites with multi-modal difficulty bias', () => {
      const posCheck = validatePositiveExhibitsOnly(CASE_042_EXHIBITS);
      expect(posCheck.valid).toBe(true);
      expect(posCheck.offendingTitles).toHaveLength(0);

      const negCheck = validatePositiveExhibitsOnly([
        ...CASE_042_EXHIBITS,
        {
          title: 'Avoid ¥2,400 Ins. Ad',
          criteria: 'Did not click red trap.',
        },
      ]);
      expect(negCheck.valid).toBe(false);
      expect(negCheck.offendingTitles).toContain('Avoid ¥2,400 Ins. Ad');

      const score = scoreCandidateSiteDifficulty({
        siteUrl: 'https://www.eki-net.com',
        pageCount: CASE_042_MACRO_VIEWS.length,
        hasTypeTask: true,
        hasDrawTask: true,
        hasTimedClickTask: true,
        positiveExhibitsOnly: posCheck.valid,
        solvableByGeminiFlashLite: true,
      });
      expect(score).toBe(100);
    });

    it('verifies all transition destinations resolve to valid macro-view IDs', () => {
      const viewIds = new Set(CASE_042_MACRO_VIEWS.map((v) => v.id));

      for (const view of CASE_042_MACRO_VIEWS) {
        for (const t of view.transitions || []) {
          expect(viewIds.has(t.destinationMacroViewId)).toBe(true);
        }
      }
    });

    it('verifies Exhibit weights sum to exactly 100%', () => {
      const sum = CASE_042_EXHIBITS.reduce((acc, ex) => acc + ex.weight, 0);
      expect(sum).toBe(100);
    });

    it('catches invalid puzzle manifests with view count out of range (< 8 or > 12)', () => {
      const invalidManifest: PuzzleManifest = {
        ...CASE_042_MANIFEST,
        macroViews: CASE_042_MACRO_VIEWS.slice(0, 5), // Only 5 views
      };

      const result = validatePuzzleInvariants(invalidManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Macro-View count violation'))).toBe(true);
    });

    it('catches invalid puzzle manifests with non-100% exhibit weights', () => {
      const invalidManifest: PuzzleManifest = {
        ...CASE_042_MANIFEST,
        exhibits: CASE_042_EXHIBITS.slice(0, 3), // Only 65% weight
      };

      const result = validatePuzzleInvariants(invalidManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Exhibit weight violation'))).toBe(true);
    });
  });

  // =========================================================================
  // Vector 6: Manifest JSON Schema Conformance & Asset Packaging
  // =========================================================================
  describe('Vector 6: Manifest Schema Conformance & Asset Packaging', () => {
    it('verifies all required fields exist on Case File #042 manifest', () => {
      const m = CASE_042_MANIFEST;
      expect(m.caseNumber).toBe('#042');
      expect(m.title).toBe('Tokyo–Osaka Shinkansen');
      expect(m.difficulty).toBe('HARD');
      expect(m.initialMacroViewId).toBe('MV-03');
      expect(m.initialMicroState).toBeDefined();
      expect(m.macroViews).toBeDefined();
      expect(m.exhibits).toBeDefined();
      expect(m.ghostReplay).toBeDefined();
    });

    it('verifies target ghost replay trajectory and waypoints (#25 at D3, #30 at D4)', () => {
      const gr = CASE_042_MANIFEST.ghostReplay!;
      expect(gr.waypoints).toHaveLength(2);
      expect(gr.waypoints[0].gridRef).toBe('D3');
      expect(gr.waypoints[0].x).toBe(885);
      expect(gr.waypoints[0].y).toBe(468);

      expect(gr.waypoints[1].gridRef).toBe('D4');
      expect(gr.waypoints[1].x).toBe(905);
      expect(gr.waypoints[1].y).toBe(720);

      expect(gr.trajectorySvgPath).toContain('M 885');
    });

    it('serializes declarative manifest cleanly without function closures', () => {
      const declarative = buildDeclarativeManifest(CASE_042_MANIFEST);
      const serialized = JSON.stringify(declarative);
      const parsed = JSON.parse(serialized);

      expect(parsed.caseNumber).toBe('#042');
      expect(parsed.exhibits).toHaveLength(5);
      for (const ex of parsed.exhibits) {
        expect(ex.ruleKey).toBeDefined();
        expect(typeof ex.weight).toBe('number');
        expect(ex.evaluate).toBeUndefined(); // function stripped
      }
    });

    it('generates high-contrast magenta Set-of-Mark SVG overlay with drop shadows', () => {
      const svg = generateSvgSomOverlay(CASE_042_MV03_ELEMENTS);
      expect(svg).toContain('<svg');
      expect(svg).toContain('#C026D3'); // Magenta badge & reticle
      expect(svg).toContain('#FFFFFF'); // White text
      expect(svg).toContain('som-badge');
      expect(svg).toContain('#25');
      expect(svg).toContain('#30');
    });

    it('validates dry-run compilation mode without writing to disk', () => {
      const compiled = compileOfflineCase042({
        caseId: '042',
        outDir: '/tmp/instruct_test_dry_run_042',
        somDensity: 'standard',
        offline: true,
        validate: true,
        dryRun: true,
        verbose: false,
      });

      expect(compiled).toBeDefined();
      expect(compiled.caseNumber).toBe('#042');
      expect(compiled.macroViews).toHaveLength(12);
      // Ensure target directory was NOT created
      expect(fs.existsSync('/tmp/instruct_test_dry_run_042')).toBe(false);
    });
  });

  // =========================================================================
  // Vector 7: Case File #042 End-to-End Compilation & Exit Codes
  // =========================================================================
  describe('Vector 7: Case File #042 End-to-End Compilation & Exit Codes', () => {
    it('compiles Case File #042 cleanly in offline mode and validates invariants', () => {
      const result = validatePuzzleInvariants(CASE_042_MANIFEST);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('verifies target elements (#25, #30) and trap elements (#11, #12, #28) in MV-03', () => {
      const mv03 = CASE_042_MACRO_VIEWS.find((v) => v.id === 'MV-03')!;
      const clover = mv03.elements.find((e) => e.id === 25)!;
      const confirm = mv03.elements.find((e) => e.id === 30)!;
      const promoTrap = mv03.elements.find((e) => e.id === 12)!;
      const insCheckbox = mv03.elements.find((e) => e.id === 28)!;
      const logoutTrap = mv03.elements.find((e) => e.id === 11)!;

      expect(clover.isTarget).toBe(true);
      expect(confirm.isTarget).toBe(true);
      expect(promoTrap.isTrap).toBe(true);
      expect(insCheckbox.isTrap).toBe(true);
      expect(logoutTrap.isTrap).toBe(true);
    });

    it('verifies offline element extraction from HTML template with fallback', () => {
      const extracted = extractElementsOffline('<div>fallback</div>', 'MV-03');
      expect(extracted).toHaveLength(11);
      expect(extracted.find((e) => e.id === 25)?.gridRef).toBe('D3');
    });

    it('verifies deterministic exit code mappings', () => {
      expect(EXIT_SUCCESS).toBe(0);
      expect(EXIT_INVALID_ARGS).toBe(1);
      expect(EXIT_RESOURCE_NOT_FOUND).toBe(2);
      expect(EXIT_SANITIZATION_FAILED).toBe(3);
      expect(EXIT_GEOMETRY_VIOLATION).toBe(4);
      expect(EXIT_INVARIANT_VIOLATION).toBe(5);
    });

    it('throws ResourceNotFoundError with exit code 2 when fixture path does not exist', () => {
      try {
        compileFixtureOffline('/path/does/not/exist_test_123', {
          outDir: '/tmp/out',
          somDensity: 'standard',
          offline: true,
          validate: false,
          dryRun: false,
          verbose: false,
        });
        expect.unreachable('Should have thrown ResourceNotFoundError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ResourceNotFoundError);
        expect(err.exitCode).toBe(EXIT_RESOURCE_NOT_FOUND);
      }
    });

    it('throws SchemaInvariantError with exit code 5 when compiling invalid manifest', () => {
      const badManifest: PuzzleManifest = {
        ...CASE_042_MANIFEST,
        exhibits: [], // 0 exhibits
      };

      const val = validatePuzzleInvariants(badManifest);
      expect(val.valid).toBe(false);

      const err = new SchemaInvariantError('Invariant failed');
      expect(err.exitCode).toBe(EXIT_INVARIANT_VIOLATION);
    });
  });
});
