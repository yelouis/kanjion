#!/usr/bin/env tsx
/**
 * tools/compile_puzzle.ts
 *
 * Command-Line Puzzle Compilation Tool for "The Redacted Dossier".
 * Sanitizes HTML/CSS website clones into bounded 8–12 Macro-View bundles,
 * extracts Set-of-Mark manifests and element bounding-box coordinates,
 * and verifies layout invariants via Playwright or deterministic offline JSDOM.
 */

import { parseArgs } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import type { PuzzleManifest } from '../src/types/puzzle';

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
  compileOfflineCase042,
  compileFixtureOffline,
  extractElementsOffline,
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

// Re-export key constants and functions for verification suites and external consumers
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
  compileOfflineCase042,
  compileFixtureOffline,
  extractElementsOffline,
  sanitizePuzzleHtml,
};

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

  const targetId = caseId || '042';
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

  if (options.verbose) {
    console.log(`[compile] Launching headless browser for live URL crawl: ${url}`);
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

    if (options.verbose) {
      console.log(`[compile] Extracted ${elements.length} interactive elements from ${url}`);
    }

    const viewsDir = path.join(options.outDir, 'views');
    if (!options.dryRun) {
      fs.mkdirSync(viewsDir, { recursive: true });
      await captureDualScreenshots(page, elements, {
        cleanPath: path.join(viewsDir, 'clean_view_01.webp'),
        somPath: path.join(viewsDir, 'som_view_01.webp'),
      });
    }

    // Wrap into a minimal single-macro-view puzzle
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
  if (options.caseId === '042' || options.caseId === undefined && !options.fixture && !options.url) {
    // Built-in Case File #042
    return compileOfflineCase042(options);
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
  --case <id>          Compile built-in case file (e.g. 042 or #042)
  --fixture <path>     Path to local directory or HTML puzzle fixture
  --url <url>          Live target website URL to crawl and bundle
  --out <dir>          Output directory (default: public/puzzles/<caseId>)
  --som-density <mode> sparse | standard | dense (default: standard)
  --offline            Run deterministically via JSDOM without launching browser
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

    if (options.verbose) {
      console.log(`[compile] Starting puzzle compilation (offline=${options.offline}, dryRun=${options.dryRun})...`);
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

// Auto-run if executed directly as a Node CLI script
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
