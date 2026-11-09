import type {
  ActionKind,
  ElementDef,
  ExhibitDef,
  FieldValue,
  Predicate,
  PuzzleData,
  PuzzleState,
} from '../types/puzzle_data';
import type { ExhibitEvaluation, StampStatus } from '../types/game';
import { resolveSignatureDrawingSpec } from '../utils/text_normalizer';

export interface DecisionInput {
  action: ActionKind | 'NOOP' | 'CONFUSED' | 'SCROLL';
  pageId?: string;
  mark?: number | null;
  key?: string;
  text?: string;
  stroke?: string;
  thought?: string;
}

export function createInitialPuzzleState(puzzle: PuzzleData): PuzzleState {
  return {
    pageId: puzzle.initialPageId,
    previousPageId: null,
    fields: { ...puzzle.initialFields },
  };
}

export function elementsOnPage(puzzle: PuzzleData, pageId: string): ElementDef[] {
  const page = puzzle.pages.find((p) => p.id === pageId);
  return page ? page.elements : [];
}

export function applyDecision(
  puzzle: PuzzleData,
  state: PuzzleState,
  decision: DecisionInput
): {
  next: PuzzleState;
  summary: string;
  shake: boolean;
} {
  const baseNext: PuzzleState = {
    pageId: state.pageId,
    previousPageId: state.previousPageId,
    fields: { ...state.fields },
  };

  if (
    decision.action === 'NOOP' ||
    decision.action === 'CONFUSED' ||
    decision.action === 'SCROLL'
  ) {
    return {
      next: baseNext,
      summary: decision.thought || 'Agent was confused; no target identified',
      shake: false,
    };
  }

  const targetPageId = decision.pageId ?? state.pageId;
  if (targetPageId !== state.pageId) {
    return {
      next: baseNext,
      summary: "📌 FIELD NOTE: That isn't on this page.",
      shake: false,
    };
  }

  const pageElements = elementsOnPage(puzzle, state.pageId);
  const el = pageElements.find((e) =>
    decision.mark != null ? e.mark === decision.mark : decision.key ? e.key === decision.key : false
  );

  if (!el) {
    return {
      next: baseNext,
      summary: "📌 FIELD NOTE: That isn't on this page.",
      shake: false,
    };
  }

  const effects = el.effects[decision.action];
  if (!effects || effects.length === 0) {
    return {
      next: baseNext,
      summary: decision.thought || `Agent clicked [${el.label}]`,
      shake: false,
    };
  }

  let nextFields: Record<string, FieldValue> = { ...state.fields };
  let nextPageId = state.pageId;
  let nextPrevPageId = state.previousPageId;
  let shake = false;
  let toggledField: string | null = null;
  let typedField: string | null = null;
  let strokeField: string | null = null;

  for (const eff of effects) {
    switch (eff.op) {
      case 'set':
        nextFields[eff.field] = eff.value;
        break;
      case 'setFromText': {
        const val = (decision.text || 'PASSENGER NAME').toUpperCase();
        nextFields[eff.field] = val;
        typedField = eff.field;
        break;
      }
      case 'setFromStroke': {
        const val = decision.stroke || decision.text || 'SHAPE:signature';
        nextFields[eff.field] = val;
        strokeField = eff.field;
        break;
      }
      case 'toggle':
        nextFields[eff.field] = !nextFields[eff.field];
        toggledField = eff.field;
        break;
      case 'copy':
        nextFields[eff.to] = nextFields[eff.from];
        break;
      case 'resetFields':
        nextFields = { ...puzzle.initialFields };
        break;
      case 'navigate': {
        const dest =
          eff.pageId === '$previous' ? state.previousPageId ?? state.pageId : eff.pageId;
        if (dest !== state.pageId) {
          nextPrevPageId = state.pageId;
          nextPageId = dest;
        }
        break;
      }
      case 'shake':
        shake = true;
        break;
    }
  }

  let summary = `Agent clicked [${el.label}]`;
  if (decision.action === 'TYPE' && typedField) {
    summary = `Agent typed [${nextFields[typedField]}] into [${el.label}]`;
  } else if (decision.action === 'DRAW' && strokeField) {
    const sigSpec = resolveSignatureDrawingSpec(String(nextFields[strokeField] || ''));
    summary = sigSpec.displayLabel
      ? `Agent signed [${el.label}] (${sigSpec.displayLabel})`
      : `Agent signed [${el.label}]`;
  } else if (el.role === 'checkbox' && toggledField) {
    summary = nextFields[toggledField]
      ? `Agent checked [${el.label}]`
      : `Agent unchecked [${el.label}]`;
  }

  return {
    next: {
      pageId: nextPageId,
      previousPageId: nextPrevPageId,
      fields: nextFields,
    },
    summary,
    shake,
  };
}

export function evaluatePredicate(
  pred: Predicate,
  fields: Record<string, FieldValue>
): boolean {
  if ('all' in pred) {
    return pred.all.every((p) => evaluatePredicate(p, fields));
  }
  if ('any' in pred) {
    return pred.any.some((p) => evaluatePredicate(p, fields));
  }
  const val = fields[pred.field];
  if (pred.nonEmpty) {
    return typeof val === 'string' ? val.trim().length > 0 : Boolean(val);
  }
  if ('eq' in pred && pred.eq !== undefined) {
    return val === pred.eq;
  }
  return Boolean(val);
}

export function extractFields(
  state: PuzzleState | Record<string, FieldValue>
): Record<string, FieldValue> {
  if (
    state &&
    typeof state === 'object' &&
    'fields' in state &&
    typeof (state as PuzzleState).fields === 'object' &&
    (state as PuzzleState).fields !== null
  ) {
    return (state as PuzzleState).fields;
  }
  return state as Record<string, FieldValue>;
}

export function evaluateExhibitDef(
  ex: ExhibitDef,
  state: PuzzleState | Record<string, FieldValue>,
  index: number = 0
): ExhibitEvaluation {
  const fields = extractFields(state);
  let status: StampStatus = 'MISSED';
  if (ex.contaminated && evaluatePredicate(ex.contaminated, fields)) {
    status = 'CONTAMINATED';
  } else if (evaluatePredicate(ex.verified, fields)) {
    status = 'VERIFIED';
  }

  const stampText =
    status === 'VERIFIED'
      ? `[VERIFIED ✓ +${ex.weight}%]`
      : status === 'CONTAMINATED'
      ? '[CONTAMINATED ✗ +0%]'
      : '[MISSED ✗ +0%]';

  const rotationDeg = index % 2 === 0 ? -4 : 3;

  return {
    id: ex.id,
    code: ex.id,
    title: ex.title,
    weight: ex.weight,
    status,
    stampText,
    rotationDeg,
    awardedPoints: status === 'VERIFIED' ? ex.weight : 0,
    contaminatedNote: status === 'CONTAMINATED' ? ex.contaminatedNote : undefined,
  };
}

export function evaluateExhibits(
  puzzle: PuzzleData,
  state: PuzzleState | Record<string, FieldValue>
): ExhibitEvaluation[] {
  return puzzle.exhibits.map((ex, index) => evaluateExhibitDef(ex, state, index));
}

export function satisfiedCount(
  puzzle: PuzzleData,
  state: PuzzleState | Record<string, FieldValue>
): number {
  return evaluateExhibits(puzzle, state).filter((ex) => ex.status === 'VERIFIED').length;
}

export const initialPuzzleState = createInitialPuzzleState;

export function evaluatePuzzle(
  puzzle: PuzzleData,
  state: PuzzleState | Record<string, FieldValue>
): {
  closeness: number;
  results: ExhibitEvaluation[];
} {
  const results = evaluateExhibits(puzzle, state);
  const rawCloseness = results.reduce((sum, r) => sum + (r.awardedPoints ?? 0), 0);
  const closeness = Math.max(0, Math.min(100, rawCloseness));
  return { closeness, results };
}
