/**
 * src/data/puzzles/case_001.ts
 *
 * Adapter module re-exporting Case File #001 from `src/data/puzzles/case_001/puzzle.ts`.
 * No bounding boxes live in case data; element coordinates are measured from the live DOM
 * at runtime or via the capture pipeline.
 */

import { GridCoordinate, AgentActionType } from '../../types/engine';
import {
  PuzzleManifest,
  MacroView,
  SoMElement,
  ExhibitDefinition,
  TargetGhostReplayDefinition,
} from '../../types/puzzle';
import { ElementDef, FieldValue } from '../../types/puzzle_data';
import { evaluateExhibitDef, elementsOnPage } from '../../engine/puzzle_engine';
import { CASE_001_PUZZLE } from './case_001/puzzle';
import CASE_001_GENERATED_MANIFEST from './case_001/manifest.generated.json';

export { CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST };

/**
 * Initial state fields for Case File #001 at Macro-View 1 (route_select).
 */
export const CASE_001_INITIAL_MICRO_STATE: Record<string, FieldValue> = {
  macroViewId: CASE_001_PUZZLE.initialPageId,
  ...CASE_001_PUZZLE.initialFields,
};

function inferGridRef(el: ElementDef): GridCoordinate {
  switch (el.mark) {
    case 1:
      return 'B2';
    case 2:
      return 'C2';
    case 3:
      return 'B3';
    case 4:
      return 'C3';
    case 11:
      return 'D1';
    case 12:
      return 'D1';
    case 14:
      return 'A2';
    case 17:
      return 'B2';
    case 21:
      return 'B2';
    case 22:
      return 'C2';
    case 23:
      return 'B3';
    case 24:
      return 'C3';
    case 25:
      return 'D3';
    case 27:
      return 'C3';
    case 28:
      return 'B4';
    case 29:
      return 'C4';
    case 30:
      return 'D4';
    case 71:
      return 'C3';
    case 72:
      return 'B3';
    case 81:
      return 'A2';
    default:
      return 'B2';
  }
}

function toSoMElement(el: ElementDef): SoMElement {
  const actionType = (Object.keys(el.effects)[0] as AgentActionType | undefined) ?? 'CLICK';
  const colorMap: Record<string, { bgColor?: string; color?: string }> = {
    green: { bgColor: '#059669', color: '#FFFFFF' },
    red: { bgColor: '#DC2626', color: '#FFFFFF' },
    blue: { bgColor: '#2563EB', color: '#FFFFFF' },
    white: { bgColor: '#FFFFFF', color: '#111111' },
    gray: { bgColor: '#F5F5F5', color: '#111111' },
  };
  const colors = el.visual?.color ? colorMap[el.visual.color] ?? {} : {};

  return {
    id: el.mark,
    somId: `#${el.mark}`,
    elementKey: el.key,
    tag: el.role === 'input' || el.role === 'checkbox' ? 'input' : el.role === 'heading' ? 'h2' : 'button',
    role: el.role,
    gridRef: inferGridRef(el),
    text: el.label,
    visualAttributes: {
      ...colors,
      glyph: el.visual?.glyphs?.[0],
      description: el.label,
    },
    isTarget: el.mark === 1 || el.mark === 17 || el.mark === 25 || el.mark === 27 || el.mark === 30,
    isTrap: el.mark === 11 || el.mark === 12 || el.mark === 28,
    actionType,
  };
}

/**
 * Interactive elements used by legacy offline simulator scoring on MV-03/MV-04.
 * Page gating in `applyDecision` strictly enforces `elementsOnPage(CASE_001_PUZZLE, state.pageId)`.
 */
export const CASE_001_MV03_ELEMENTS: SoMElement[] = [
  ...elementsOnPage(CASE_001_PUZZLE, 'MV-03').filter((e) => e.mark !== 90).map(toSoMElement),
  ...elementsOnPage(CASE_001_PUZZLE, 'MV-04')
    .filter((e) => e.mark === 28 || e.mark === 29 || e.mark === 30)
    .map(toSoMElement),
];

/**
 * All 10 discrete pages for Case File #001 derived from `CASE_001_PUZZLE`.
 */
export const CASE_001_MACRO_VIEWS: MacroView[] = CASE_001_PUZZLE.pages.map((page) => {
  const transitions: Array<{ targetElementId: number; destinationMacroViewId: string }> = [];
  for (const el of page.elements) {
    for (const effList of Object.values(el.effects)) {
      for (const eff of effList ?? []) {
        if (eff.op === 'navigate' && eff.pageId !== '$previous') {
          transitions.push({
            targetElementId: el.mark,
            destinationMacroViewId: eff.pageId,
          });
        }
      }
    }
  }

  return {
    id: page.id,
    name: page.slug,
    description: page.title,
    simulatedUrl: `sandbox://kanjion-rail.example/reserve/${page.slug}`,
    elements: page.id === 'MV-03' ? CASE_001_MV03_ELEMENTS : page.elements.map(toSoMElement),
    transitions,
  };
});

/**
 * The 5 Required Exhibits summing to 100% base closeness, derived from `CASE_001_PUZZLE.exhibits`.
 */
export const CASE_001_EXHIBITS: ExhibitDefinition[] = CASE_001_PUZZLE.exhibits.map((ex, idx) => ({
  id: ex.id,
  code: ex.id,
  title: ex.title,
  weight: ex.weight,
  criteria: ex.criteria,
  evaluate: (state: Record<string, FieldValue>) => {
    const res = evaluateExhibitDef(ex, state, idx);
    return {
      status: res.status,
      awardedPoints: res.awardedPoints ?? 0,
      stampText: res.stampText,
    };
  },
}));

export const CASE_001_GHOST_REPLAY: TargetGhostReplayDefinition = {
  waypoints: [
    {
      stepNumber: 1,
      timestamp: '0:03',
      gridRef: 'D3',
      x: 885,
      y: 468,
      radius: 22,
      label: 'TARGET CLICK @ 0:03 (COL D, ROW 3)',
    },
    {
      stepNumber: 2,
      timestamp: '0:05',
      gridRef: 'D4',
      x: 905,
      y: 720,
      radius: 18,
      label: 'TARGET CLICK @ 0:05 (COL D, ROW 4)',
    },
  ],
  trajectorySvgPath: 'M 885 490 Q 915 605 905 702',
};

export const CASE_001_MANIFEST: PuzzleManifest = {
  caseNumber: CASE_001_PUZZLE.caseNumber,
  title: CASE_001_PUZZLE.title,
  difficulty: 'HARD',
  themeBadge: '🇯🇵 HARD MODE: TOKYO–OSAKA SHINKANSEN',
  initialMacroViewId: CASE_001_PUZZLE.initialPageId,
  initialMicroState: CASE_001_INITIAL_MICRO_STATE,
  macroViews: CASE_001_MACRO_VIEWS,
  exhibits: CASE_001_EXHIBITS,
  ghostReplay: CASE_001_GHOST_REPLAY,
};
