#!/usr/bin/env tsx
/**
 * tools/compile_puzzle.ts
 *
 * Command-Line Puzzle Compilation Tool for Kanjion.
 * Captures real 1024x768 Set-of-Mark PNG screenshots and measured [data-el] bounding boxes
 * via Vite + Playwright Chromium, or validates puzzle invariants offline.
 */

import { parseArgs } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import type { PuzzleManifest } from '../src/types/puzzle';
import { CASE_001_PUZZLE, CASE_001_MANIFEST } from '../src/data/puzzles/case_001';

import {
  EXIT_SUCCESS,
  EXIT_INVALID_ARGS,
  EXIT_RESOURCE_NOT_FOUND,
  EXIT_SANITIZATION_FAILED,
  EXIT_GEOMETRY_VIOLATION,
  EXIT_INVARIANT_VIOLATION,
  EXIT_BROWSER_ERROR,
  EXIT_IO_ERROR,
  CompilerError,
  CompilerArgumentError,
  ResourceNotFoundError,
  SanitizationError,
  CompilerValidationError,
  GeometryViolationError,
  SchemaInvariantError,
  BrowserAutomationError,
  FileSystemIoError,
  type CompilerOptions,
  type SomDensity,
} from './lib/types';

import {
  sanitizePuzzleHtml,
  validateHtmlSanitization,
} from './lib/sanitizer';

import {
  validatePuzzleInvariants,
  buildDeclarativeManifest,
} from './lib/manifest_builder';

import {
  compileOfflineCase001,
  compileFixtureOffline,
  extractElementsOffline,
  validateGeneratedCase001Manifest,
  type GeneratedPuzzleManifest,
  type GeneratedManifestElement,
} from './lib/offline_compiler';

import {
  launchCompilerBrowser,
  createCompilerContext,
  prepareCompilerPage,
} from './lib/browser_launcher';

import {
  extractInteractiveElements,
} from './lib/som_extractor';

import {
  captureDualScreenshots,
  generateSvgSomOverlay,
} from './lib/som_annotator';

export {
  EXIT_SUCCESS,
  EXIT_INVALID_ARGS,
  EXIT_RESOURCE_NOT_FOUND,
  EXIT_SANITIZATION_FAILED,
  EXIT_GEOMETRY_VIOLATION,
  EXIT_INVARIANT_VIOLATION,
  EXIT_BROWSER_ERROR,
  EXIT_IO_ERROR,
  CompilerError,
  CompilerArgumentError,
  ResourceNotFoundError,
  SanitizationError,
  CompilerValidationError,
  GeometryViolationError,
  SchemaInvariantError,
  BrowserAutomationError,
  FileSystemIoError,
  validateHtmlSanitization,
  validatePuzzleInvariants,
  buildDeclarativeManifest,
  generateSvgSomOverlay,
  compileOfflineCase001,
  compileFixtureOffline,
  extractElementsOffline,
  sanitizePuzzleHtml,
  validateGeneratedCase001Manifest,
};

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

/**
 * Launches Vite dev server on a free port and Playwright Chromium at 1024x768 (deviceScaleFactor: 1),
 * measures every `[data-el]` box on every page of Case #001, draws SoM badges, captures content-hashed
 * PNGs to `public/puzzles/001/som/<pageId>.<hash8>.png`, and writes byte-stable
 * `src/data/puzzles/case_001/manifest.generated.json`.
 */
export async function captureCase001(opts: {
  writeFiles?: boolean;
  verbose?: boolean;
  somOutDir?: string;
  manifestOutPath?: string;
} = {}): Promise<GeneratedPuzzleManifest> {
  const writeFiles = opts.writeFiles ?? true;
  const somOutDir = opts.somOutDir ?? path.resolve(process.cwd(), 'public/puzzles/001/som');
  const manifestOutPath =
    opts.manifestOutPath ??
    path.resolve(process.cwd(), 'src/data/puzzles/case_001/manifest.generated.json');

  const { createServer } = await import('vite');
  const server = await createServer({
    root: process.cwd(),
    server: { port: 0, strictPort: false },
    logLevel: 'silent',
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;

  const browser = await launchCompilerBrowser();

  try {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    if (writeFiles) {
      try {
        fs.mkdirSync(somOutDir, { recursive: true });
        fs.mkdirSync(path.dirname(manifestOutPath), { recursive: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new FileSystemIoError(`Failed to create output directories: ${msg}`);
      }
    }

    const pagesRecord: Record<string, { elements: GeneratedManifestElement[]; som: string }> = {};
    const writtenFiles = new Set<string>();

    const sortedPages = [...CASE_001_PUZZLE.pages].sort((a, b) => a.id.localeCompare(b.id));

    for (const pageDef of sortedPages) {
      const url = `http://127.0.0.1:${port}/capture.html?case=001&page=${encodeURIComponent(pageDef.id)}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      const registryEls = [...pageDef.elements].sort((a, b) => a.mark - b.mark);

      // Measure every [data-el] box relative to #sandbox-core and inject SoM badges
      const measuredElements = await page.evaluate(
        ({ regEls }) => {
          const stage = document.getElementById('sandbox-core') || document.body;
          const sr = stage.getBoundingClientRect();
          const out: Array<{ mark: number; key: string; box: { x: number; y: number; w: number; h: number } }> = [];

          document.getElementById('som-capture-overlay')?.remove();
          const overlay = document.createElement('div');
          overlay.id = 'som-capture-overlay';
          overlay.style.cssText =
            'position:absolute;top:0;left:0;width:1024px;height:768px;pointer-events:none;z-index:999999;overflow:hidden;';
          stage.appendChild(overlay);

          for (const item of regEls) {
            const domEl = stage.querySelector<HTMLElement>(`[data-el="${item.key}"]`);
            if (!domEl) {
              throw new Error(`Missing [data-el="${item.key}"] on page`);
            }
            const r = domEl.getBoundingClientRect();
            const rawX = Math.round(r.left - sr.left);
            const rawY = Math.round(r.top - sr.top);
            const rawW = Math.round(r.width);
            const rawH = Math.round(r.height);

            const x = Math.max(0, Math.min(1023, rawX));
            const y = Math.max(0, Math.min(767, rawY));
            const w = Math.max(1, Math.min(1024 - x, rawW));
            const h = Math.max(1, Math.min(768 - y, rawH));

            out.push({
              mark: item.mark,
              key: item.key,
              box: { x, y, w, h },
            });

            // Draw SoM badge at top-left corner offset by (-4, -10), clamped inside the stage
            const badge = document.createElement('span');
            badge.textContent = String(item.mark);
            badge.style.cssText = [
              'position:absolute',
              'background:#C026D3',
              'color:#FFFFFF',
              'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
              'font-size:14px',
              'font-weight:700',
              'line-height:1',
              'border:1px solid #FFFFFF',
              'padding:1px 4px',
              'box-sizing:border-box',
              'pointer-events:none',
              'white-space:nowrap',
            ].join(';');
            overlay.appendChild(badge);
            const br = badge.getBoundingClientRect();
            const bw = Math.ceil(br.width) || 24;
            const bh = Math.ceil(br.height) || 18;
            const bx = Math.max(0, Math.min(1024 - bw, x - 4));
            const by = Math.max(0, Math.min(768 - bh, y - 10));
            badge.style.left = `${bx}px`;
            badge.style.top = `${by}px`;
          }

          return out;
        },
        { regEls: registryEls.map((e) => ({ mark: e.mark, key: e.key })) }
      );

      const pngBuffer = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1024, height: 768 },
      });

      const hash8 = crypto.createHash('sha256').update(pngBuffer).digest('hex').slice(0, 8);
      const fileName = `${pageDef.id}.${hash8}.png`;
      writtenFiles.add(fileName);

      if (writeFiles) {
        fs.writeFileSync(path.join(somOutDir, fileName), pngBuffer);
      }

      pagesRecord[pageDef.id] = {
        som: `/puzzles/001/som/${fileName}`,
        elements: measuredElements,
      };
    }

    const generated: GeneratedPuzzleManifest = {
      puzzleId: '001',
      stage: { w: 1024, h: 768 },
      pages: pagesRecord,
    };

    if (writeFiles) {
      // Delete stale PNGs in public/puzzles/001/som/
      for (const existing of fs.readdirSync(somOutDir)) {
        if (existing.endsWith('.png') && !writtenFiles.has(existing)) {
          fs.unlinkSync(path.join(somOutDir, existing));
        }
      }

      const serialized = JSON.stringify(sortKeysDeep(generated), null, 2) + '\n';
      fs.writeFileSync(manifestOutPath, serialized, 'utf-8');
    }

    return generated;
  } finally {
    await browser.close();
    await server.close();
  }
}

/**
 * Parses and validates raw command-line arguments using node:util parseArgs.
 */
export function parseCliArguments(rawArgs: string[]): CompilerOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: rawArgs,
      options: {
        url: { type: 'string' },
        fixture: { type: 'string' },
        case: { type: 'string' },
        out: { type: 'string' },
        'som-density': { type: 'string', default: 'standard' },
        offline: { type: 'boolean', default: false },
        validate: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CompilerArgumentError(`Failed to parse CLI arguments: ${msg}`);
  }

  const { values } = parsed;

  if (values.help) {
    return {
      outDir: '',
      somDensity: 'standard',
      offline: false,
      validate: false,
      dryRun: false,
      verbose: false,
      help: true,
    };
  }

  const caseId = values.case ? values.case.replace(/^#/, '') : undefined;
  const url = values.url;
  const fixture = values.fixture;

  if (!url && !fixture && !caseId) {
    throw new CompilerArgumentError(
      'Must specify an input source via --case <id>, --fixture <path>, or --url <url>.'
    );
  }

  const somDensity = values['som-density'] as string;
  if (!['sparse', 'standard', 'dense'].includes(somDensity)) {
    throw new CompilerArgumentError(
      `Invalid --som-density "${somDensity}". Allowed values are: sparse, standard, dense.`
    );
  }

  const targetId = caseId || '001';
  const outDir = values.out
    ? path.resolve(process.cwd(), values.out)
    : path.resolve(process.cwd(), 'public/puzzles', targetId);

  return {
    url,
    fixture,
    caseId,
    outDir,
    somDensity: somDensity as SomDensity,
    offline: Boolean(values.offline),
    validate: Boolean(values.validate),
    dryRun: Boolean(values['dry-run']),
    verbose: Boolean(values.verbose),
    help: false,
  };
}

/**
 * Compiles a live URL by crawling with Playwright and capturing dual screenshots.
 */
export async function compileLiveUrl(url: string, options: CompilerOptions): Promise<PuzzleManifest> {
  if (options.offline) {
    throw new CompilerArgumentError('Cannot specify --url and --offline simultaneously.');
  }

  const browser = await launchCompilerBrowser();

  try {
    const context = await createCompilerContext(browser);
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const rawHtml = await page.content();
    const { sanitizedHtml } = sanitizePuzzleHtml(rawHtml);

    await prepareCompilerPage(page, sanitizedHtml);

    const elements = await extractInteractiveElements(page);

    const viewsDir = path.join(options.outDir, 'views');
    if (!options.dryRun) {
      fs.mkdirSync(viewsDir, { recursive: true });
      await captureDualScreenshots(page, elements, {
        cleanPath: path.join(viewsDir, 'clean_view_01.webp'),
        somPath: path.join(viewsDir, 'som_view_01.webp'),
      });
    }

    const manifest: PuzzleManifest = {
      caseNumber: `#${options.caseId || '999'}`,
      title: `Live Crawl: ${url}`,
      difficulty: 'MEDIUM',
      initialMacroViewId: 'MV-01',
      macroViews: [
        {
          id: 'MV-01',
          name: 'live_crawl_root',
          simulatedUrl: url,
          elements,
          transitions: [],
        },
      ],
      exhibits: [],
    };

    return manifest;
  } finally {
    await browser.close();
  }
}

/**
 * Central compiler dispatcher.
 */
export async function runCompiler(options: CompilerOptions): Promise<PuzzleManifest> {
  if (options.caseId === '001' || (options.caseId === undefined && !options.fixture && !options.url)) {
    if (options.offline || options.validate || options.dryRun) {
      return compileOfflineCase001(options);
    }
    await captureCase001({
      writeFiles: !options.dryRun,
      verbose: options.verbose,
    });
    return CASE_001_MANIFEST;
  }

  if (options.fixture) {
    return compileFixtureOffline(options.fixture, options);
  }

  if (options.url) {
    return await compileLiveUrl(options.url, options);
  }

  throw new CompilerArgumentError('No valid compilation target specified.');
}

/**
 * Prints CLI usage instructions.
 */
export function printHelp(): void {
  console.log(`
Instruct Puzzle Compiler (tools/compile_puzzle.ts)
=================================================
Usage:
  npx tsx tools/compile_puzzle.ts [options]

Options:
  --case <id>          Compile built-in case file (e.g. 001 or #001)
  --fixture <path>     Path to local directory or HTML puzzle fixture
  --url <url>          Live target website URL to crawl and bundle
  --out <dir>          Output directory (default: public/puzzles/<caseId>)
  --som-density <mode> sparse | standard | dense (default: standard)
  --offline            Run deterministically without launching browser
  --validate           Strict schema and invariant verification (halts on error)
  --dry-run            Execute extraction and validation without writing files
  --verbose            Emit detailed diagnostics and bounding box telemetry
  --help               Display this help text

Exit Codes:
  0 - Success
  1 - Invalid CLI Arguments
  2 - Fixture / URL Resource Not Found
  3 - HTML/CSS Sanitization Failure
  4 - Viewport Boundary Violation
  5 - Puzzle Schema Invariant Violation
  6 - Playwright Automation / Browser Failure
  7 - File System I/O Failure
`);
}

/**
 * Main executable entry point with deterministic exit code handling.
 */
export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  try {
    const options = parseCliArguments(args);

    if (options.help) {
      printHelp();
      process.exit(EXIT_SUCCESS);
    }

    const manifest = await runCompiler(options);

    if (options.validate) {
      const validation = validatePuzzleInvariants(manifest);
      if (!validation.valid) {
        throw new SchemaInvariantError(
          `Validation failed:\n  - ${validation.errors.join('\n  - ')}`
        );
      }
    }

    console.log(`[compile] SUCCESS: Puzzle ${manifest.caseNumber || options.caseId || ''} compiled cleanly.`);
    process.exit(EXIT_SUCCESS);
  } catch (err: unknown) {
    let exitCode = EXIT_INVALID_ARGS;

    if (err instanceof CompilerError) {
      exitCode = err.exitCode;
    }

    console.error(`[compile:error] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(exitCode);
  }
}

const isDirectExecution = (): boolean => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const selfUrl = import.meta.url;
    const executedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    return selfUrl === executedUrl;
  } catch {
    return false;
  }
};

if (isDirectExecution()) {
  main().catch((err) => {
    console.error('[compile:fatal]', err);
    process.exit(EXIT_BROWSER_ERROR);
  });
}
