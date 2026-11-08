/**
 * tools/lib/offline_compiler.ts
 *
 * Offline puzzle validation and fixture compilation.
 */

import { JSDOM } from 'jsdom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CASE_001_PUZZLE,
  CASE_001_MANIFEST,
  CASE_001_MV03_ELEMENTS,
  CASE_001_MACRO_VIEWS,
} from '../../src/data/puzzles/case_001';
import {
  boxToGrid,
  tupleToBoundingBox,
} from '../../src/utils/coordinate_projector';
import type {
  PuzzleManifest,
  SoMElement,
  BoundingBox,
} from '../../src/types/puzzle';
import {
  validatePuzzleInvariants,
  buildDeclarativeManifest,
} from './manifest_builder';
import {
  sanitizePuzzleHtml,
} from './sanitizer';
import {
  ResourceNotFoundError,
  SchemaInvariantError,
  GeometryViolationError,
  FileSystemIoError,
  type CompilerOptions,
} from './types';

export interface GeneratedManifestBox {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface GeneratedManifestElement {
  box: GeneratedManifestBox;
  key: string;
  mark: number;
}

export interface GeneratedManifestPage {
  elements: GeneratedManifestElement[];
  som: string;
}

export interface GeneratedPuzzleManifest {
  pages: Record<string, GeneratedManifestPage>;
  puzzleId: string;
  stage: {
    h: number;
    w: number;
  };
}

/**
 * Validates `CASE_001_PUZZLE` against `src/data/puzzles/case_001/manifest.generated.json`
 * without launching a browser.
 */
export function validateGeneratedCase001Manifest(
  manifestPath = path.resolve(process.cwd(), 'src/data/puzzles/case_001/manifest.generated.json'),
  publicDir = path.resolve(process.cwd(), 'public')
): void {
  if (!fs.existsSync(manifestPath)) {
    throw new SchemaInvariantError(
      `Generated manifest not found at "${manifestPath}". Run: npx tsx tools/compile_puzzle.ts --case 001`
    );
  }

  let parsed: GeneratedPuzzleManifest;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as GeneratedPuzzleManifest;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SchemaInvariantError(`Failed to parse generated manifest: ${msg}`);
  }

  if (parsed.puzzleId !== '001' || parsed.stage?.w !== 1024 || parsed.stage?.h !== 768) {
    throw new SchemaInvariantError('Generated manifest header is invalid (expected puzzleId "001", stage 1024x768).');
  }

  for (const page of CASE_001_PUZZLE.pages) {
    const pageEntry = parsed.pages?.[page.id];
    if (!pageEntry) {
      throw new SchemaInvariantError(`Generated manifest is missing page "${page.id}".`);
    }

    const somRel = pageEntry.som?.replace(/^\//, '') ?? '';
    const somAbs = path.resolve(publicDir, somRel);
    if (!somRel || !fs.existsSync(somAbs)) {
      throw new SchemaInvariantError(`SoM screenshot missing for page "${page.id}": ${somAbs}`);
    }
    const stat = fs.statSync(somAbs);
    if (stat.size <= 10 * 1024) {
      throw new SchemaInvariantError(
        `SoM screenshot for page "${page.id}" is too small (${stat.size} bytes; expected > 10 KB).`
      );
    }

    for (const regEl of page.elements) {
      const match = pageEntry.elements?.find((e) => e.mark === regEl.mark && e.key === regEl.key);
      if (!match || !match.box) {
        throw new SchemaInvariantError(
          `Generated manifest page "${page.id}" is missing box for element "${regEl.key}" (mark #${regEl.mark}).`
        );
      }
      const { x, y, w, h } = match.box;
      if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 1024 || y + h > 768) {
        throw new GeometryViolationError(
          `Element "${regEl.key}" (#${regEl.mark}) on "${page.id}" box [${x}, ${y}, ${w}, ${h}] lies outside 1024x768.`
        );
      }
    }
  }
}

/**
 * Extracts interactive elements from an HTML template string offline using JSDOM.
 */
export function extractElementsOffline(html: string, macroViewId: string): SoMElement[] {
  const dom = new JSDOM(html);
  const doc: any = dom.window.document;

  const elements: SoMElement[] = [];
  const markedElements = doc.querySelectorAll('[data-som-id]');

  if (markedElements.length > 0) {
    for (const el of Array.from(markedElements) as any[]) {
      const explicitId = el.getAttribute('data-som-id') || '0';
      const id = parseInt(explicitId.replace(/\D/g, ''), 10);
      const bboxAttr = el.getAttribute('data-bbox');

      let boundingBox: BoundingBox;
      if (bboxAttr) {
        const parts = bboxAttr.split(',').map((p: string) => parseFloat(p.trim()));
        if (parts.length === 4) {
          boundingBox = tupleToBoundingBox([parts[0], parts[1], parts[2], parts[3]]);
        } else {
          boundingBox = { x: 0, y: 0, width: 100, height: 30 };
        }
      } else {
        boundingBox = { x: 0, y: 0, width: 100, height: 30 };
      }

      const gridRef = boxToGrid(boundingBox);

      elements.push({
        id,
        somId: `#${id}`,
        elementKey: el.id || `el_${id}`,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        boundingBox,
        gridRef,
        text: el.textContent?.trim() || '',
        visualAttributes: {
          description: el.getAttribute('title') || undefined,
          glyph: el.textContent?.includes('🍀') ? '🍀' : undefined,
        },
        isTarget: el.hasAttribute('data-target') || el.getAttribute('data-is-target') === 'true',
        isTrap: el.hasAttribute('data-trap') || el.getAttribute('data-is-trap') === 'true',
        isInert: el.hasAttribute('data-inert') || el.getAttribute('data-is-inert') === 'true',
        actionType: 'CLICK',
      });
    }
    return elements;
  }

  if (macroViewId === 'MV-03' || macroViewId === 'view_03') {
    return CASE_001_MV03_ELEMENTS;
  }

  return [];
}

/**
 * Validates Case File #001 deterministically without launching a browser.
 */
export function compileOfflineCase001(options: CompilerOptions): PuzzleManifest {
  const manifest = CASE_001_MANIFEST;
  const validation = validatePuzzleInvariants(CASE_001_PUZZLE);

  if (!validation.valid) {
    throw new SchemaInvariantError(
      `Puzzle invariant validation failed:\n  - ${validation.errors.join('\n  - ')}`
    );
  }

  if (options.dryRun) {
    return manifest;
  }

  if (options.validate) {
    validateGeneratedCase001Manifest();
  }

  const defaultOutDir = path.resolve(process.cwd(), 'public/puzzles/001');
  if (options.outDir && path.resolve(options.outDir) !== defaultOutDir) {
    try {
      fs.mkdirSync(options.outDir, { recursive: true });
      const declarative = buildDeclarativeManifest(manifest);
      fs.writeFileSync(
        path.join(options.outDir, 'manifest.json'),
        JSON.stringify(declarative, null, 2),
        'utf-8'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new FileSystemIoError(`Failed to write bundle files to "${options.outDir}": ${msg}`);
    }
  }

  return manifest;
}

/**
 * Compiles an authored fixture directory offline.
 */
export function compileFixtureOffline(fixturePath: string, options: CompilerOptions): PuzzleManifest {
  const resolved = path.resolve(process.cwd(), fixturePath);

  if (!fs.existsSync(resolved)) {
    throw new ResourceNotFoundError(`Specified fixture path does not exist: "${resolved}"`);
  }

  const configPath = path.join(resolved, 'puzzle.config.json');
  const manifestPath = path.join(resolved, 'manifest.json');

  let baseManifest: PuzzleManifest;

  if (fs.existsSync(manifestPath)) {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    baseManifest = JSON.parse(raw);
  } else if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    baseManifest = JSON.parse(raw);
  } else {
    const indexPath = fs.statSync(resolved).isDirectory()
      ? path.join(resolved, 'index.html')
      : resolved;

    if (!fs.existsSync(indexPath)) {
      throw new ResourceNotFoundError(`No HTML template or config found at fixture path: "${resolved}"`);
    }

    const rawHtml = fs.readFileSync(indexPath, 'utf-8');
    const { sanitizedHtml } = sanitizePuzzleHtml(rawHtml, {
      baseDir: fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved),
    });

    const elements = extractElementsOffline(sanitizedHtml, 'MV-03');

    baseManifest = {
      ...CASE_001_MANIFEST,
      macroViews: CASE_001_MACRO_VIEWS.map((mv) =>
        mv.id === 'MV-03' ? { ...mv, elements } : mv
      ),
    };
  }

  const validation = validatePuzzleInvariants(baseManifest);
  if (!validation.valid) {
    throw new SchemaInvariantError(
      `Puzzle invariant validation failed:\n  - ${validation.errors.join('\n  - ')}`
    );
  }

  if (!options.dryRun && options.outDir) {
    try {
      fs.mkdirSync(options.outDir, { recursive: true });
      const declarative = buildDeclarativeManifest(baseManifest);
      fs.writeFileSync(
        path.join(options.outDir, 'manifest.json'),
        JSON.stringify(declarative, null, 2),
        'utf-8'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new FileSystemIoError(`Failed to write fixture output: ${msg}`);
    }
  }

  return baseManifest;
}
