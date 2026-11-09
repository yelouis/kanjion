export type FieldValue = string | number | boolean;
export type ActionKind = 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK';
export type Effect =
  | { op: 'set'; field: string; value: FieldValue }
  | { op: 'setFromText'; field: string }        // TYPE text (from extractTypedText)
  | { op: 'setFromStroke'; field: string }      // DRAW stroke spec, e.g. 'SHAPE:smile'
  | { op: 'toggle'; field: string }
  | { op: 'copy'; from: string; to: string }
  | { op: 'resetFields' }                       // every field back to initialFields
  | { op: 'navigate'; pageId: string }          // '$previous' = previousPageId
  | { op: 'shake' };
export interface ElementDef {
  mark: number;                 // SoM badge number, unique within its page
  key: string;                  // rendered as data-el="<key>"
  role: 'button' | 'card' | 'input' | 'canvas' | 'checkbox' | 'heading' | 'banner' | 'link' | 'tab';
  label: string;                // visible text exactly as rendered
  visual?: { color?: string; glyphs?: string[]; row?: number; column?: number; timedColumn?: 0 | 1 | 2 };
  effects: Partial<Record<ActionKind, Effect[]>>; // an action with no entry is a harmless no-op
  aliases?: string[];           // English phrases; deterministic fallback only (item 10)
  thought?: string;             // witty first-person line for the fallback (item 10)
}
export interface PageDef { id: string; slug: string; title: string; distractionKey?: string; elements: ElementDef[] }
export type Predicate =
  | { field: string; eq?: FieldValue; nonEmpty?: true }
  | { all: Predicate[] }
  | { any: Predicate[] };
export interface ExhibitDef {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string; weight: number; criteria: string;
  verified: Predicate; contaminated?: Predicate; contaminatedNote?: string;
}
export interface ReplayStep { pageId: string; key: string; action: ActionKind; text?: string; stroke?: string }
export interface PuzzleData {
  id: string; caseNumber: string; title: string;
  initialPageId: string; initialFields: Record<string, FieldValue>;
  pages: PageDef[]; exhibits: ExhibitDef[];
  replay: ReplayStep[];     // filled in item 8
  answerKey: string[];      // exact English lines shown in the report
  capturePresets?: Record<string, Partial<Record<string, FieldValue>>>; // item 9
}
export interface PuzzleState { pageId: string; previousPageId?: string | null; fields: Record<string, FieldValue> }
export interface GeneratedManifestElement {
  mark: number;
  key: string;
  box: { x: number; y: number; w: number; h: number };
}
export interface GeneratedManifest {
  puzzleId: string;
  stage: { w: number; h: number };
  pages: Record<string, { som: string; elements: GeneratedManifestElement[] }>;
}
