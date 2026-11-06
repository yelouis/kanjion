/**
 * tools/lib/manifest_builder.ts
 *
 * Manifest construction, serialization, and invariant validation for puzzle bundles.
 * Enforces the 8–12 Macro-View FSA rule, 100% exhibit weight sum, stage geometry,
 * and grid alignment.
 */

import type {
  PuzzleManifest,
  ExhibitDefinition,
  PuzzleExhibitDefinition,
} from '../../src/types/puzzle';
import {
  boxToGrid,
  STAGE_WIDTH,
  STAGE_HEIGHT,
  GRID_COLUMNS,
  GRID_ROWS,
} from '../../src/utils/coordinate_projector';

export interface InvariantValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates all structural, geometric, and game-design invariants of a PuzzleManifest.
 */
export function validatePuzzleInvariants(manifest: PuzzleManifest): InvariantValidationResult {
  const errors: string[] = [];

  // Invariant 1: Macro-View Count (strictly 8 to 12)
  if (!manifest.macroViews || !Array.isArray(manifest.macroViews)) {
    errors.push('Macro-views collection is missing or not an array');
  } else {
    const viewCount = manifest.macroViews.length;
    if (viewCount < 8 || viewCount > 12) {
      errors.push(`Macro-View count violation: expected 8 to 12 views, got ${viewCount}`);
    }
  }

  // Invariant 2: Exhibit Weight Sum (must equal exactly 100%)
  if (!manifest.exhibits || !Array.isArray(manifest.exhibits) || manifest.exhibits.length === 0) {
    errors.push('No exhibits defined in puzzle manifest');
  } else {
    const totalWeight = manifest.exhibits.reduce((sum, ex) => sum + (ex.weight || 0), 0);
    if (totalWeight !== 100) {
      errors.push(`Exhibit weight violation: weights must sum to 100%, got ${totalWeight}%`);
    }
  }

  // Invariant 3: Macro-View Graph Integrity
  if (manifest.macroViews && Array.isArray(manifest.macroViews)) {
    const viewIds = new Set(manifest.macroViews.map((v) => v.id));

    if (manifest.initialMacroViewId && !viewIds.has(manifest.initialMacroViewId)) {
      errors.push(`Initial macro-view "${manifest.initialMacroViewId}" does not exist in macroViews list`);
    }

    for (const view of manifest.macroViews) {
      if (!view.id) {
        errors.push(`Macro-view missing id: ${view.name || 'unnamed'}`);
      }

      for (const t of view.transitions || []) {
        if (!viewIds.has(t.destinationMacroViewId)) {
          errors.push(
            `Transition from ${view.id} references non-existent destination "${t.destinationMacroViewId}"`
          );
        }
      }

      // Invariant 4: Element Geometry & Grid Alignment
      for (const el of view.elements || []) {
        const b = el.boundingBox;
        if (!b) {
          errors.push(`Element #${el.id} in view ${view.id} has no boundingBox`);
          continue;
        }

        if (b.x < 0 || b.y < 0 || b.x + b.width > STAGE_WIDTH || b.y + b.height > STAGE_HEIGHT) {
          errors.push(
            `Element #${el.id} in view ${view.id} overflows stage: [${b.x}, ${b.y}, ${b.width}, ${b.height}]`
          );
        }

        if (b.width <= 0 || b.height <= 0) {
          errors.push(`Element #${el.id} in view ${view.id} has non-positive dimensions: ${b.width}x${b.height}`);
        }

        const computedGrid = boxToGrid(b);
        if (computedGrid !== el.gridRef) {
          errors.push(
            `Element #${el.id} gridRef mismatch: assigned ${el.gridRef}, computed ${computedGrid}`
          );
        }
      }
    }
  }

  // Invariant 5: Target Ghost Replay
  if (manifest.ghostReplay) {
    if (!manifest.ghostReplay.waypoints || manifest.ghostReplay.waypoints.length === 0) {
      errors.push('Ghost replay defines no waypoints');
    }
    if (!manifest.ghostReplay.trajectorySvgPath) {
      errors.push('Ghost replay missing trajectorySvgPath');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Maps known exhibit codes or IDs to deterministic declarative ruleKeys.
 */
function inferExhibitRuleKey(ex: ExhibitDefinition | PuzzleExhibitDefinition): string {
  if ('ruleKey' in ex && ex.ruleKey) return ex.ruleKey;
  const idLower = ex.id.toLowerCase();
  if (idLower.includes('route') || idLower.includes('exhibit_a')) return 'route_match';
  if (idLower.includes('departure') || idLower.includes('exhibit_b')) return 'departure_match';
  if (idLower.includes('seat') || idLower.includes('green') || idLower.includes('exhibit_c')) return 'seat_selected';
  if (idLower.includes('ins') || idLower.includes('trap') || idLower.includes('exhibit_d')) return 'trap_avoided';
  if (idLower.includes('confirm') || idLower.includes('order') || idLower.includes('exhibit_e')) return 'order_confirmed';
  return 'custom_rule';
}

/**
 * Builds a JSON-serializable declarative representation of the puzzle manifest.
 * Strips function closures and enriches stage geometry metadata.
 */
export function buildDeclarativeManifest(manifest: PuzzleManifest): Record<string, unknown> {
  const declarativeExhibits = manifest.exhibits.map((ex) => {
    return {
      id: ex.id,
      code: 'code' in ex && typeof (ex as any).code === 'string'
        ? String((ex as any).code)
        : ex.id.slice(-1).toUpperCase(),
      title: ex.title,
      weight: ex.weight,
      criteria: 'criteria' in ex ? ex.criteria : '',
      ruleKey: inferExhibitRuleKey(ex),
      targetValue: 'targetValue' in ex ? ex.targetValue : true,
    };
  });

  return {
    caseNumber: manifest.caseNumber || '#042',
    id: manifest.id || (manifest.caseNumber ? manifest.caseNumber.replace(/^#/, '') : '042'),
    slug: manifest.slug || 'case_042_shinkansen',
    title: manifest.title,
    difficulty: manifest.difficulty,
    locale: manifest.locale || 'ja',
    themeBadge: manifest.themeBadge,
    stage: {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      rulers: {
        cols: [...GRID_COLUMNS],
        rows: [...GRID_ROWS],
      },
    },
    initialMacroViewId: manifest.initialMacroViewId || 'MV-03',
    initialMicroState: manifest.initialMicroState,
    macroViews: manifest.macroViews.map((view) => ({
      id: view.id,
      name: view.name,
      description: view.description,
      simulatedUrl: view.simulatedUrl,
      cleanScreenshotUrl: view.cleanScreenshotUrl || `views/clean_${view.id.toLowerCase().replace('-', '_')}.webp`,
      somScreenshotUrl: view.somScreenshotUrl || view.somImagePath || `views/som_${view.id.toLowerCase().replace('-', '_')}.webp`,
      elements: view.elements,
      transitions: view.transitions || [],
    })),
    exhibits: declarativeExhibits,
    ghostReplay: manifest.ghostReplay,
  };
}
