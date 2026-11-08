/**
 * test/challenger_m4_empirical.test.ts
 *
 * Empirical Adversarial Challenge Test Suite for Milestone 4: Puzzle Compilation Tooling.
 * Authored by Challenger 1 (chal_m4_1).
 *
 * Stress-tests:
 * 1. Adversarial HTML/CSS Sanitization: malformed tags, disguised event handlers,
 *    protocol variations, SVG vectors, CSS @import/expressions, and native controls.
 * 2. Deterministic CLI Exit Code Conformance across exit codes 0 through 7.
 * 3. Coordinate & Viewport Geometry Invariants and Set-of-Mark Badge Clamping.
 * 4. Manifest Schema Invariants and Declarative Serialization Integrity.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  validateHtmlSanitization,
  validatePuzzleInvariants,
  sanitizePuzzleHtml,
  EXIT_SUCCESS,
  EXIT_INVALID_ARGS,
  EXIT_RESOURCE_NOT_FOUND,
  EXIT_SANITIZATION_FAILED,
  EXIT_GEOMETRY_VIOLATION,
  EXIT_INVARIANT_VIOLATION,
  EXIT_BROWSER_ERROR,
  EXIT_IO_ERROR,
  SanitizationError,
  GeometryViolationError,
} from '../tools/compile_puzzle';

import {
  prepareCompilerPage,
  STAGE_WIDTH,
  STAGE_HEIGHT,
} from '../tools/lib/browser_launcher';

import {
  computeBadgeGeometry,
} from '../tools/lib/som_annotator';

import {
  buildDeclarativeManifest,
} from '../tools/lib/manifest_builder';

import {
  pixelToGrid,
  boxToGrid,
  gridToBoundingBox,
} from '../src/utils/coordinate_projector';

import {
  CASE_001_MANIFEST,
  CASE_001_MACRO_VIEWS,
  CASE_001_MV03_ELEMENTS,
} from '../src/data/puzzles/case_001';

import type { PuzzleManifest } from '../src/types/puzzle';

const COMPILE_CLI_PATH = path.resolve(__dirname, '../tools/compile_puzzle.ts');

/**
 * Helper to invoke tools/compile_puzzle.ts synchronously in a subprocess.
 */
function invokeCompilerCli(args: string[], extraEnv: Record<string, string> = {}): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', COMPILE_CLI_PATH, ...args], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...extraEnv,
    },
    timeout: 15000,
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('Challenger M4: Empirical Adversarial Challenge Suite', () => {

  // =========================================================================
  // Challenge 1: Adversarial HTML/CSS Sanitization Probes
  // =========================================================================
  describe('Challenge 1: Adversarial HTML/CSS Sanitization & Control Defense', () => {

    it('neutralizes malformed and recursive script tag evasion vectors', () => {
      const evasions = [
        '<scr<script>ipt>alert("nested")</script>',
        '<script/x>alert("slash-x")</script>',
        '<SCRIPT>alert("uppercase")</SCRIPT>',
        '<<SCRIPT>script>alert("double-angle")</SCRIPT>',
        '<script  type="text/javascript">alert("spaces")</script>',
        '<script\ntype="text/javascript">alert("newline")</script>',
        '<script\ttype="text/javascript">alert("tab")</script>',
      ];

      for (const payload of evasions) {
        // validateHtmlSanitization must flag prohibited script
        const validation = validateHtmlSanitization(payload);
        expect(validation.valid).toBe(false);
        expect(validation.violations.some((v) => v.toLowerCase().includes('script'))).toBe(true);

        // sanitizePuzzleHtml must either clean or throw SanitizationError
        try {
          const report = sanitizePuzzleHtml(payload);
          expect(report.sanitizedHtml).not.toMatch(/<script\b/i);
        } catch (err: any) {
          expect(err).toBeInstanceOf(SanitizationError);
          expect(err.exitCode).toBe(EXIT_SANITIZATION_FAILED);
        }
      }
    });

    it('neutralizes disguised and whitespace-padded inline event handlers', () => {
      const handlerPayloads = [
        '<button onclick = "doAttack()">Click</button>',
        '<button ONCLICK="doAttack()">Click</button>',
        '<button onClick="doAttack()">Click</button>',
        '<button\tonclick="doAttack()">Click</button>',
        '<button\nonclick="doAttack()">Click</button>',
        '<div onfocusin="doAttack()">Div</div>',
        '<div onanimationstart="doAttack()">Div</div>',
        '<button onpointerdown="doAttack()">Button</button>',
        '<img src="missing.jpg" onerror="doAttack()">',
        '<body onload="doAttack()">Content</body>',
      ];

      for (const payload of handlerPayloads) {
        const validation = validateHtmlSanitization(payload);
        expect(validation.valid).toBe(false);
        expect(validation.violations.some((v) => v.toLowerCase().includes('event handler'))).toBe(true);

        const report = sanitizePuzzleHtml(payload);
        expect(report.sanitizedHtml).not.toMatch(/\bon[a-z0-9_-]+\s*=/i);
        expect(report.strippedEventHandlersCount).toBeGreaterThan(0);
      }
    });

    it('neutralizes SVG executable vectors and inline event handlers', () => {
      const svgVectors = [
        '<svg onload="alert(1)"><circle r="10"/></svg>',
        '<svg><circle onload="alert(1)" r="10"/></svg>',
        '<svg><animate onbegin="alert(1)"/></svg>',
        '<svg><script>alert(1)</script></svg>',
        '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>',
      ];

      for (const svg of svgVectors) {
        const validation = validateHtmlSanitization(svg);
        expect(validation.valid).toBe(false);

        const report = sanitizePuzzleHtml(svg);
        expect(report.sanitizedHtml).not.toMatch(/\bon[a-z0-9_-]+\s*=/i);
        expect(report.sanitizedHtml).not.toMatch(/<script\b/i);
        expect(report.sanitizedHtml).not.toMatch(/href\s*=\s*['"]javascript:/i);
      }
    });

    it('identifies vulnerability: SVG <set attributeName="href" to="javascript:..."> evasion in DOM traversal', () => {
      // Adversarial payload: SVG set animation injecting javascript: URI via the 'to' attribute
      const svgSetPayload = '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>';

      // Tier 1 DOM validator flags it via global regex
      const validation = validateHtmlSanitization(svgSetPayload);
      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain('Prohibited javascript: URI detected');

      // However, sanitizePuzzleHtml only inspects 'href'/'src' attribute names, not 'to'
      const report = sanitizePuzzleHtml(svgSetPayload);
      // Documenting empirical finding: attribute 'to' is retained by DOM traversal
      expect(report.sanitizedHtml).toContain('to="javascript:alert(1)"');
    });

    it('neutralizes standard and case-variant executable link protocols (JAVASCRIPT:, vbscript:, data:text/html)', () => {
      const protocols = [
        '<a href="JAVASCRIPT:alert(1)">Link 1</a>',
        '<a href="javascript: alert(1)">Link 2</a>',
        '<a href="javascript:\talert(1)">Link 3</a>',
        '<a href="data:text/html,<script>alert(1)</script>">Link 4</a>',
        '<a href="DATA:TEXT/HTML;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Link 5</a>',
        '<a href="vbscript:msgbox(1)">Link 6</a>',
        '<form action="javascript:alert(1)"><button>Submit</button></form>',
        '<button formaction="javascript:alert(1)">Submit</button>',
      ];

      for (const p of protocols) {
        const report = sanitizePuzzleHtml(p);
        expect(report.sanitizedHtml).not.toMatch(/href\s*=\s*['"]\s*javascript:/i);
        expect(report.sanitizedHtml).not.toMatch(/href\s*=\s*['"]\s*vbscript:/i);
        expect(report.sanitizedHtml).not.toMatch(/href\s*=\s*['"]\s*data:text\/html/i);
        expect(report.sanitizedHtml).not.toMatch(/action\s*=\s*['"]\s*javascript:/i);
        expect(report.sanitizedHtml).not.toMatch(/formaction\s*=\s*['"]\s*javascript:/i);
      }
    });

    it('identifies vulnerability: whitespace-split protocol evasion (java\\nscript:) bypassing naive attribute regex', () => {
      // In browsers conforming to WHATWG URL parsing, whitespace within protocol schemes is stripped,
      // meaning "java\nscript:" resolves as executable "javascript:".
      const newlinePayload = '<a href="java\nscript:alert(1)">Sneaky</a>';

      // validateHtmlSanitization currently misses whitespace-broken protocols
      const validation = validateHtmlSanitization(newlinePayload);
      expect(validation.valid).toBe(true); // Finding: bypassed validator

      // sanitizePuzzleHtml does not normalize inner whitespace before regex check
      const report = sanitizePuzzleHtml(newlinePayload);
      expect(report.sanitizedHtml).toContain('java\nscript:alert(1)'); // Finding: bypassed sanitizer
    });

    it('strips inline style expressions and behavior bindings', () => {
      const inlineStylePayloads = [
        '<div style="color: red; expression(alert(1));">Text</div>',
        '<div style="behavior: url(xss.htc); width: 100px;">Text</div>',
        '<div style="-moz-binding: url(xss.xml); display: block;">Text</div>',
      ];

      for (const p of inlineStylePayloads) {
        const report = sanitizePuzzleHtml(p);
        expect(report.sanitizedHtml).not.toContain('expression(');
        expect(report.sanitizedHtml).not.toContain('behavior:');
        expect(report.sanitizedHtml).not.toContain('-moz-binding');
      }
    });

    it('identifies vulnerability: <style> block @import and expressions are uninspected in rawHtml templates', () => {
      // <style> blocks inside template HTML without <link> tags
      const styleBlockPayload = '<style>@import url("https://evil.com/leak.css"); body { background: expression(alert(1)); }</style>';

      const validation = validateHtmlSanitization(styleBlockPayload);
      expect(validation.valid).toBe(true); // Finding: validator ignores <style> block imports

      const report = sanitizePuzzleHtml(styleBlockPayload);
      expect(report.sanitizedHtml).toContain('@import'); // Finding: sanitizer does not strip <style> blocks
      expect(report.sanitizedHtml).toContain('expression(alert(1))');
    });

    it('strictly rejects native <select> and forbidden <input> types with Exit Code 3', () => {
      const nativeControls = [
        '<select><option>Option 1</option></select>',
        '<SELECT><option>Option 1</option></SELECT>',
        '<select name="dropdown"><option>1</option></select>',
        '<input type="date">',
        '<input type="DATE">',
        '<input type="time">',
        '<input type="color">',
        '<input type="datetime-local">',
        '<input type="month">',
        '<input type="week">',
        '<input type = "date">',
      ];

      for (const ctrl of nativeControls) {
        const validation = validateHtmlSanitization(ctrl);
        expect(validation.valid).toBe(false);

        expect(() => sanitizePuzzleHtml(ctrl)).toThrow(SanitizationError);
        try {
          sanitizePuzzleHtml(ctrl);
        } catch (err: any) {
          expect(err.exitCode).toBe(EXIT_SANITIZATION_FAILED);
          expect(err.exitCode).toBe(3);
        }
      }
    });

    it('identifies template element encapsulation bypass: <template><select> escapes JSDOM doc.querySelectorAll', () => {
      const templateSelect = '<template><select><option>Hidden</option></select></template>';

      // Global regex flags it
      const validation = validateHtmlSanitization(templateSelect);
      expect(validation.valid).toBe(false);

      // DOM traversal does not recurse into HTMLTemplateElement.content DocumentFragment
      const report = sanitizePuzzleHtml(templateSelect);
      expect(report.sanitizedHtml).toContain('<select>');
    });
  });

  // =========================================================================
  // Challenge 2: CLI Exit Code Conformance (0 through 7)
  // =========================================================================
  describe('Challenge 2: Deterministic CLI Exit Code Conformance (0 through 7)', () => {

    it('exits with code 0 (EXIT_SUCCESS) on successful compilation of Case File #001', () => {
      const res = invokeCompilerCli(['--case', '001', '--offline', '--validate']);
      expect(res.status).toBe(EXIT_SUCCESS);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('SUCCESS: Puzzle #001 compiled cleanly.');
    });

    it('exits with code 1 (EXIT_INVALID_ARGS) when CLI arguments are missing or invalid', () => {
      // 1a. Missing any input target
      const resBare = invokeCompilerCli([]);
      expect(resBare.status).toBe(EXIT_INVALID_ARGS);
      expect(resBare.status).toBe(1);
      expect(resBare.stderr).toContain('Must specify an input source');

      // 1b. Invalid --som-density value
      const resDensity = invokeCompilerCli(['--case', '001', '--som-density', 'super_dense']);
      expect(resDensity.status).toBe(EXIT_INVALID_ARGS);
      expect(resDensity.status).toBe(1);
      expect(resDensity.stderr).toContain('Invalid --som-density');

      // 1c. Mutually exclusive --url and --offline
      const resConflict = invokeCompilerCli(['--url', 'http://127.0.0.1', '--offline']);
      expect(resConflict.status).toBe(EXIT_INVALID_ARGS);
      expect(resConflict.status).toBe(1);
      expect(resConflict.stderr).toContain('Cannot specify --url and --offline simultaneously');

      // 1d. Unknown case ID
      const resBadCase = invokeCompilerCli(['--case', 'nonexistent_999', '--offline']);
      expect(resBadCase.status).toBe(EXIT_INVALID_ARGS);
      expect(resBadCase.status).toBe(1);
      expect(resBadCase.stderr).toContain('No valid compilation target specified');
    });

    it('exits with code 2 (EXIT_RESOURCE_NOT_FOUND) when specified fixture does not exist or is empty', () => {
      // 2a. Non-existent path
      const resMissing = invokeCompilerCli(['--fixture', '/tmp/nonexistent_path_challenger_12345']);
      expect(resMissing.status).toBe(EXIT_RESOURCE_NOT_FOUND);
      expect(resMissing.status).toBe(2);
      expect(resMissing.stderr).toContain('[ResourceNotFoundError] Specified fixture path does not exist');

      // 2b. Empty directory without index.html or manifest.json
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instruct_empty_fixture_'));
      try {
        const resEmpty = invokeCompilerCli(['--fixture', emptyDir, '--offline']);
        expect(resEmpty.status).toBe(EXIT_RESOURCE_NOT_FOUND);
        expect(resEmpty.status).toBe(2);
        expect(resEmpty.stderr).toContain('No HTML template or config found at fixture path');
      } finally {
        fs.rmdirSync(emptyDir);
      }
    });

    it('exits with code 3 (EXIT_SANITIZATION_FAILED) when fixture contains prohibited controls or dirty assets', () => {
      const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instruct_dirty_fixture_'));

      try {
        // 3a. Native select tag
        fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<select><option>A</option></select>');
        const resSelect = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resSelect.status).toBe(EXIT_SANITIZATION_FAILED);
        expect(resSelect.status).toBe(3);
        expect(resSelect.stderr).toContain('[SanitizationError] Native unstylable control detected: <select>');

        // 3b. External stylesheet
        fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<link rel="stylesheet" href="https://evil.cdn/style.css">');
        const resCdn = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resCdn.status).toBe(EXIT_SANITIZATION_FAILED);
        expect(resCdn.status).toBe(3);
        expect(resCdn.stderr).toContain('[SanitizationError] External CDN stylesheet not permitted');

        // 3c. Missing referenced stylesheet
        fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<link rel="stylesheet" href="missing_local.css">');
        const resMissingCss = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resMissingCss.status).toBe(EXIT_SANITIZATION_FAILED);
        expect(resMissingCss.status).toBe(3);
        expect(resMissingCss.stderr).toContain('[SanitizationError] Referenced stylesheet not found on disk');

        // 3d. Native date picker
        fs.writeFileSync(path.join(fixtureDir, 'index.html'), '<input type="date">');
        const resDate = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resDate.status).toBe(EXIT_SANITIZATION_FAILED);
        expect(resDate.status).toBe(3);
        expect(resDate.stderr).toContain('[SanitizationError] Native unstylable input control detected: <input type="date">');
      } finally {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    it('verifies GeometryViolationError exitCode (4) and reports invariant mapping architectural finding', async () => {
      // Direct verification: GeometryViolationError carries exit code 4
      const geomErr = new GeometryViolationError('Viewport mismatch');
      expect(geomErr.exitCode).toBe(EXIT_GEOMETRY_VIOLATION);
      expect(geomErr.exitCode).toBe(4);

      // Verify prepareCompilerPage enforces fixed 1024x768 and throws GeometryViolationError
      const distortedPage: any = {
        setContent: async () => {},
        addStyleTag: async () => {},
        evaluate: async () => ({ innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 }),
      };

      await expect(prepareCompilerPage(distortedPage, '<div>stage</div>')).rejects.toThrow(GeometryViolationError);

      // ARCHITECTURAL FINDING: In offline fixture compilation, element geometry overflow
      // is reported by validatePuzzleInvariants as a SchemaInvariantError (exit code 5)
      // rather than GeometryViolationError (exit code 4).
      const overflowDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instruct_overflow_geom_'));
      try {
        const manifestWithOverflow: PuzzleManifest = {
          ...CASE_001_MANIFEST,
          macroViews: [
            {
              id: 'MV-01',
              name: 'overflow_view',
              elements: [
                {
                  id: 99,
                  somId: '#99',
                  elementKey: 'btn_99',
                  boundingBox: { x: 950, y: 700, width: 200, height: 100 }, // overflows 1024x768
                  gridRef: 'D4',
                  tag: 'button',
                  role: 'button',
                  text: 'Overflow',
                  visualAttributes: {},
                  isTarget: false,
                  isTrap: false,
                  isInert: false,
                  actionType: 'CLICK',
                },
              ],
              transitions: [],
            },
            ...CASE_001_MACRO_VIEWS.slice(1),
          ],
        };

        fs.writeFileSync(path.join(overflowDir, 'manifest.json'), JSON.stringify(manifestWithOverflow));
        const resGeom = invokeCompilerCli(['--fixture', overflowDir, '--offline']);
        // Document empirical result: exits with code 5 (SchemaInvariantError)
        expect(resGeom.status).toBe(EXIT_INVARIANT_VIOLATION);
        expect(resGeom.status).toBe(5);
        expect(resGeom.stderr).toContain('overflows stage');
      } finally {
        fs.rmSync(overflowDir, { recursive: true, force: true });
      }
    });

    it('exits with code 5 (EXIT_INVARIANT_VIOLATION) when puzzle schema or invariants are violated', () => {
      const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instruct_invariant_fixture_'));

      try {
        // 5a. Too few macro-views (less than 8)
        const badViewsManifest = {
          ...CASE_001_MANIFEST,
          macroViews: CASE_001_MACRO_VIEWS.slice(0, 4), // Only 4 views
        };
        fs.writeFileSync(path.join(fixtureDir, 'manifest.json'), JSON.stringify(badViewsManifest));
        const resViews = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resViews.status).toBe(EXIT_INVARIANT_VIOLATION);
        expect(resViews.status).toBe(5);
        expect(resViews.stderr).toContain('Macro-View count violation: expected 8 to 12 views');

        // 5b. Exhibit weights sum to != 100%
        const badWeightsManifest = {
          ...CASE_001_MANIFEST,
          exhibits: [
            { id: 'ex1', title: 'Ex 1', weight: 40 },
            { id: 'ex2', title: 'Ex 2', weight: 30 }, // Sum = 70%
          ],
        };
        fs.writeFileSync(path.join(fixtureDir, 'manifest.json'), JSON.stringify(badWeightsManifest));
        const resWeights = invokeCompilerCli(['--fixture', fixtureDir, '--offline']);
        expect(resWeights.status).toBe(EXIT_INVARIANT_VIOLATION);
        expect(resWeights.status).toBe(5);
        expect(resWeights.stderr).toContain('Exhibit weight violation: weights must sum to 100%');
      } finally {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    it('exits with code 6 (EXIT_BROWSER_ERROR) when browser launch fails', () => {
      // Point PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a non-browser executable (/bin/echo)
      const resBrowser = invokeCompilerCli(['--url', 'http://127.0.0.1:54321'], {
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/bin/echo',
      });

      expect(resBrowser.status).toBe(EXIT_BROWSER_ERROR);
      expect(resBrowser.status).toBe(6);
      expect(resBrowser.stderr).toContain('[BrowserAutomationError] Failed to launch headless browser');
    });

    it('exits with code 7 (EXIT_IO_ERROR) when output directory write fails due to permissions or invalid path', () => {
      // Target an impossible directory path where /dev/null is treated as a folder
      const impossibleOut = '/dev/null/forbidden_output_directory';
      const resIo = invokeCompilerCli(['--case', '001', '--offline', '--out', impossibleOut]);

      expect(resIo.status).toBe(EXIT_IO_ERROR);
      expect(resIo.status).toBe(7);
      expect(resIo.stderr).toContain('[FileSystemIoError] Failed to write bundle files');
    });
  });

  // =========================================================================
  // Challenge 3: Geometry & Set-of-Mark Badge Clamping Invariant Stress Tests
  // =========================================================================
  describe('Challenge 3: Geometry & Set-of-Mark Badge Clamping Invariants', () => {

    it('stress-tests grid projection boundary values across all column intervals [0, 256, 512, 768, 1024]', () => {
      expect(pixelToGrid(0, 0)).toBe('A1');
      expect(pixelToGrid(255.999, 0)).toBe('A1');
      expect(pixelToGrid(256.0, 0)).toBe('B1');
      expect(pixelToGrid(511.999, 0)).toBe('B1');
      expect(pixelToGrid(512.0, 0)).toBe('C1');
      expect(pixelToGrid(767.999, 0)).toBe('C1');
      expect(pixelToGrid(768.0, 0)).toBe('D1');
      expect(pixelToGrid(1023.999, 0)).toBe('D1');
      expect(pixelToGrid(1024.0, 0)).toBe('D1');
    });

    it('stress-tests grid projection boundary values across all row intervals [0, 192, 384, 576, 768]', () => {
      expect(pixelToGrid(0, 0)).toBe('A1');
      expect(pixelToGrid(0, 191.999)).toBe('A1');
      expect(pixelToGrid(0, 192.0)).toBe('A2');
      expect(pixelToGrid(0, 383.999)).toBe('A2');
      expect(pixelToGrid(0, 384.0)).toBe('A3');
      expect(pixelToGrid(0, 575.999)).toBe('A3');
      expect(pixelToGrid(0, 576.0)).toBe('A4');
      expect(pixelToGrid(0, 767.999)).toBe('A4');
      expect(pixelToGrid(0, 768.0)).toBe('A4');
    });

    it('clamps extreme out-of-bounds pixel coordinates to bounding grid cells without throwing NaN', () => {
      expect(pixelToGrid(-9999, -9999)).toBe('A1');
      expect(pixelToGrid(9999, 9999)).toBe('D4');
      expect(pixelToGrid(-500, 300)).toBe('A2');
      expect(pixelToGrid(800, -200)).toBe('D1');
    });

    it('guarantees badge coordinates stay strictly within stage boundary safety box [2, 1022] x [2, 766]', () => {
      // Case A: Element at top-left corner (0, 0)
      const tl = computeBadgeGeometry({ x: 0, y: 0, width: 20, height: 20 }, '#1');
      expect(tl.badgeX).toBeGreaterThanOrEqual(2);
      expect(tl.badgeY).toBeGreaterThanOrEqual(2);

      // Case B: Element at bottom-right corner flush against (1024, 768)
      const br = computeBadgeGeometry({ x: 1010, y: 760, width: 14, height: 8 }, '#999');
      expect(br.badgeX + br.badgeWidth).toBeLessThanOrEqual(STAGE_WIDTH - 2);
      expect(br.badgeY + br.badgeHeight).toBeLessThanOrEqual(STAGE_HEIGHT - 2);

      // Case C: Element near right edge auto-flips badge to left side
      const rightEdge = computeBadgeGeometry({ x: 1000, y: 100, width: 24, height: 20 }, '#25');
      // Should flip to x - 2 = 998 clamped within stage
      expect(rightEdge.badgeX).toBeLessThan(1024 - rightEdge.badgeWidth);
    });

    it('confirms Case File #001 MV-03 elements strictly adhere to coordinate grid mappings', () => {
      for (const el of CASE_001_MV03_ELEMENTS) {
        const box = el.boundingBox ?? gridToBoundingBox(el.gridRef);
        const computedGrid = boxToGrid(box);
        expect(computedGrid).toBe(el.gridRef);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Manifest Schema Invariants & Declarative Serialization
  // =========================================================================
  describe('Challenge 4: Manifest Schema Invariants & Serialization', () => {

    it('validates canonical Case File #001 manifest against all compiler invariants', () => {
      const validation = validatePuzzleInvariants(CASE_001_MANIFEST);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('rejects manifest with disconnected transition destinations', () => {
      const badTransitionManifest: PuzzleManifest = {
        ...CASE_001_MANIFEST,
        macroViews: CASE_001_MACRO_VIEWS.map((v) =>
          v.id === 'MV-01'
            ? {
                ...v,
                transitions: [{ targetElementId: 1, actionType: 'CLICK', destinationMacroViewId: 'NONEXISTENT_VIEW_99' }],
              }
            : v
        ),
      };

      const validation = validatePuzzleInvariants(badTransitionManifest);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('NONEXISTENT_VIEW_99'))).toBe(true);
    });

    it('rejects manifest missing ghost replay waypoints or trajectory SVG path', () => {
      const badGhostManifest: PuzzleManifest = {
        ...CASE_001_MANIFEST,
        ghostReplay: {
          waypoints: [],
          trajectorySvgPath: '',
        },
      };

      const validation = validatePuzzleInvariants(badGhostManifest);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('Ghost replay'))).toBe(true);
    });

    it('serializes declarative manifest with inferred ruleKeys and clean JSON structure', () => {
      const declarative = buildDeclarativeManifest(CASE_001_MANIFEST);
      expect(declarative.caseNumber).toBe('#001');
      expect(declarative.stage).toEqual({
        width: 1024,
        height: 768,
        rulers: {
          cols: ['A', 'B', 'C', 'D'],
          rows: ['1', '2', '3', '4'],
        },
      });

      const exhibits = declarative.exhibits as any[];
      expect(exhibits).toHaveLength(5);
      const ruleKeys = exhibits.map((e) => e.ruleKey);
      expect(ruleKeys).toContain('route_match');
      expect(ruleKeys).toContain('departure_match');
      expect(ruleKeys).toContain('seat_selected');
      expect(ruleKeys).toContain('trap_avoided');
      expect(ruleKeys).toContain('order_confirmed');
    });
  });
});
