import type { Effect, ElementDef, PageDef, PuzzleState } from '../../types/puzzle_data';
import type { GeneratedManifest } from '../../data/puzzles/case_001';
import { COLOR_DICTIONARY, GLYPH_DICTIONARY } from './dictionaries';
import {
  extractSignatureDrawingSpec,
  extractTypedText,
  isMetaPrompt,
  NOOP_NO_SIGNAL_THOUGHT,
  normalizeInstruction,
} from '../../utils/text_normalizer';
import { hasTimingIntent } from '../flash_clock';
import {
  buildDefaultVisibleTextForPage,
  filterPromptSyntheticIds,
} from './guardrails';

export type AgentDecision = {
  action: 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK' | 'NOOP';
  pageId: string;
  mark: number | null;
  text?: string;
  stroke?: string;
  thought: string;
  tier: 'guardrail' | 'pinned' | 'cloud' | 'fallback';
  cloudFailed?: boolean;
};

export type DistractionReason = 'no_clue' | 'meta' | 'mark_id';

export interface FallbackResolveContext {
  pages: PageDef[];
  manifest: GeneratedManifest;
  state: PuzzleState;
  instruction: string;
}

const BARE_WORD_VERB_REGEX =
  /\b(?:click|press|tap|hit|push|select|choose|pick|open|go|type|enter|write|input|fill|put|draw|sign|scribble|doodle|sketch|paint|wait|check|tick|uncheck|use)\b/i;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSpaced(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s🍀◯○△×▶◀]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function phraseOccurs(haystackSpaced: string, haystackCollapsed: string, phrase: string): boolean {
  const pSpaced = normalizeSpaced(phrase);
  if (!pSpaced) return false;

  const boundaryRegex = new RegExp(`(?<![a-z0-9])${escapeRegExp(pSpaced)}(?![a-z0-9])`, 'i');
  if (boundaryRegex.test(haystackSpaced)) {
    return true;
  }

  const pCollapsed = normalizeInstruction(phrase);
  if (pCollapsed) {
    const collapsedRegex = new RegExp(`(?<![a-z0-9])${escapeRegExp(pCollapsed)}(?![a-z0-9])`, 'i');
    if (collapsedRegex.test(haystackCollapsed)) {
      return true;
    }
  }

  return false;
}

function hasSignatureShapeWord(instruction: string): boolean {
  const raw = (instruction || '').trim();
  const lower = raw.toLowerCase();
  if (
    raw.includes(':)') ||
    raw.includes('😊') ||
    raw.includes(':(') ||
    raw.includes('☹') ||
    raw.includes('<3') ||
    raw.includes('❤') ||
    raw.includes('⭐') ||
    raw.includes('✓')
  ) {
    return true;
  }
  return /\b(?:smile|smiley|happy|grin|frown|sad|unhappy|heart|love|star|asterisk|circle|oval|ring|round|triangle|pyramid|delta|square|rectangle|cube|cat|kitty|meow|kitten|neko|house|home|stick\s*figure|person|human|man|fish|shark|sushi|flower|rose|daisy|tulip|check\s*mark|checkmark|cross|x-?mark|zigzag|zig-zag|lightning|bolt|wave|sine|spiral|swirl|vortex|tornado|straight\s*line|horizontal\s*line|flat\s*line|line)\b/i.test(
    lower
  );
}

const ORDINAL_TO_NUMBER: Record<string, number> = {
  first: 1,
  '1st': 1,
  second: 2,
  '2nd': 2,
  third: 3,
  '3rd': 3,
  fourth: 4,
  '4th': 4,
  fifth: 5,
  '5th': 5,
};

function parseRequestedRows(normSpaced: string, maxRow: number): Set<number> {
  const rows = new Set<number>();
  const ordMatches = normSpaced.matchAll(
    /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top|bottom)\s+row\b/gi
  );
  for (const m of ordMatches) {
    const word = m[1].toLowerCase();
    if (word === 'top') {
      rows.add(1);
    } else if (word === 'last' || word === 'bottom') {
      if (maxRow > 0) rows.add(maxRow);
    } else if (ORDINAL_TO_NUMBER[word]) {
      rows.add(ORDINAL_TO_NUMBER[word]);
    }
  }

  const numMatches = normSpaced.matchAll(/\brow\s*0?([1-9])\b/gi);
  for (const m of numMatches) {
    rows.add(Number.parseInt(m[1], 10));
  }
  return rows;
}

function parseRequestedColumns(normSpaced: string, maxCol: number): Set<number> {
  const cols = new Set<number>();
  const ordMatches = normSpaced.matchAll(
    /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|left|middle|center|centre|right)\s+col(?:umn)?\b/gi
  );
  for (const m of ordMatches) {
    const word = m[1].toLowerCase();
    if (word === 'left') {
      cols.add(1);
    } else if (word === 'middle' || word === 'center' || word === 'centre') {
      cols.add(2);
    } else if (word === 'last' || word === 'right') {
      if (maxCol > 0) cols.add(maxCol);
    } else if (ORDINAL_TO_NUMBER[word]) {
      cols.add(ORDINAL_TO_NUMBER[word]);
    }
  }

  const numMatches = normSpaced.matchAll(/\bcol(?:umn)?\s*0?([1-9])\b/gi);
  for (const m of numMatches) {
    cols.add(Number.parseInt(m[1], 10));
  }
  return cols;
}

export function scoreElementOnPage(
  el: ElementDef,
  boxCenter: { cx: number; cy: number } | null,
  instruction: string,
  pageElements?: readonly ElementDef[]
): number {
  const normSpaced = normalizeSpaced(instruction);
  const normCollapsed = normalizeInstruction(instruction);
  let score = 0;

  // 1. Aliases: +40 for the first distinct alias phrase that occurs, then +15 for each further
  // distinct alias, capped at +70 in total. If one matched alias contains another, count only the longer one.
  if (el.aliases && el.aliases.length > 0) {
    const asksReservedOnly =
      /\breserved\b/i.test(normSpaced) &&
      !/\b(?:unreserved|non\s+reserved)\b/i.test(normSpaced);
    const isUnreservedSeat = el.aliases.includes('unreserved');

    const matchedAliases: string[] = [];
    const seenNormalized = new Set<string>();

    for (const alias of el.aliases) {
      if (
        asksReservedOnly &&
        isUnreservedSeat &&
        (alias === 'nozomi' || alias === 'hikari' || alias === 'kodama')
      ) {
        continue;
      }
      if (alias === 'reserved' && /\b(?:unreserved|non\s+reserved)\b/i.test(normSpaced)) {
        continue;
      }
      if (phraseOccurs(normSpaced, normCollapsed, alias)) {
        const normAlias = normalizeSpaced(alias);
        if (normAlias && !seenNormalized.has(normAlias)) {
          seenNormalized.add(normAlias);
          matchedAliases.push(normAlias);
        }
      }
    }

    // If a compound alias contains 2+ shorter matched aliases that do not contain each other,
    // keep the separate component aliases instead of collapsing 2+ matches into 1.
    const withoutRedundantCompounds = matchedAliases.filter((b) => {
      const containedInB = matchedAliases.filter(
        (a) =>
          a !== b &&
          b.length > a.length &&
          (b.includes(a) || normalizeInstruction(b).includes(normalizeInstruction(a)))
      );
      if (containedInB.length < 2) return true;
      // Check if there are at least 2 aliases in containedInB where neither contains the other
      for (let i = 0; i < containedInB.length; i++) {
        for (let j = i + 1; j < containedInB.length; j++) {
          const x = containedInB[i];
          const y = containedInB[j];
          if (!x.includes(y) && !y.includes(x)) {
            return false;
          }
        }
      }
      return true;
    });

    const distinctNonContained = withoutRedundantCompounds.filter(
      (a) =>
        !withoutRedundantCompounds.some(
          (b) =>
            b !== a &&
            b.length > a.length &&
            (b.includes(a) || normalizeInstruction(b).includes(normalizeInstruction(a)))
        )
    );

    if (distinctNonContained.length > 0) {
      score += Math.min(70, 40 + 15 * (distinctNonContained.length - 1));
    }
  }

  // 2. Colour (+30)
  if (el.visual?.color) {
    const colorKey = el.visual.color.toLowerCase();
    const synonyms = COLOR_DICTIONARY[colorKey] ?? [colorKey];
    for (const syn of synonyms) {
      if (phraseOccurs(normSpaced, normCollapsed, syn)) {
        score += 30;
        break;
      }
    }
  }

  // 3. Glyph (+35)
  if (el.visual?.glyphs && el.visual.glyphs.length > 0) {
    let glyphMatched = false;
    for (const g of el.visual.glyphs) {
      const tokens = GLYPH_DICTIONARY[g] ?? [g];
      for (const tok of tokens) {
        if (instruction.includes(tok) || phraseOccurs(normSpaced, normCollapsed, tok)) {
          glyphMatched = true;
          break;
        }
      }
      if (glyphMatched) break;
    }
    if (glyphMatched) {
      score += 35;
    }
  }

  // 4. Number (+25): any number in the instruction (commas removed) appears in the label's digits
  const instNumbers =
    instruction
      .normalize('NFKC')
      .replace(/(?<=\d),(?=\d)/g, '')
      .match(/\b\d+\b/g) ?? [];
  const labelDigits =
    el.label
      .normalize('NFKC')
      .replace(/(?<=\d),(?=\d)/g, '')
      .match(/\d+/g) ?? [];
  if (instNumbers.length > 0 && labelDigits.length > 0) {
    const labelSet = new Set<string>();
    for (const d of labelDigits) {
      labelSet.add(d);
      labelSet.add(String(Number.parseInt(d, 10)));
    }
    for (const n of instNumbers) {
      if (labelSet.has(n) || labelSet.has(String(Number.parseInt(n, 10)))) {
        score += 25;
        break;
      }
    }
  }

  // 5a. Rows and columns (+20 for matching visual.row, +20 for matching visual.column)
  const maxRow =
    pageElements && pageElements.length > 0
      ? Math.max(0, ...pageElements.map((e) => e.visual?.row ?? 0))
      : Math.max(2, el.visual?.row ?? 0);
  const maxCol =
    pageElements && pageElements.length > 0
      ? Math.max(0, ...pageElements.map((e) => e.visual?.column ?? 0))
      : Math.max(3, el.visual?.column ?? 0);

  if (el.visual?.row !== undefined) {
    const wantedRows = parseRequestedRows(normSpaced, maxRow);
    if (wantedRows.has(el.visual.row)) {
      score += 20;
    }
  }

  if (el.visual?.column !== undefined) {
    const wantedCols = parseRequestedColumns(normSpaced, maxCol);
    if (wantedCols.has(el.visual.column)) {
      score += 20;
    }
  }

  // 5b. Position words (+20 for each matched word in {left, right, top, bottom, middle/center}, capped at +40)
  if (boxCenter) {
    const { cx, cy } = boxCenter;
    const wantLeft = /\bleft\b/i.test(normSpaced) && !/\bleft\s+(?:arrow|col)/i.test(normSpaced);
    const wantRight = /\bright\b/i.test(normSpaced) && !/\bright\s+(?:arrow|col)/i.test(normSpaced);
    const wantTop = /\btop\b/i.test(normSpaced) && !/\btop\s+row\b/i.test(normSpaced);
    const wantBottom = /\bbottom\b/i.test(normSpaced) && !/\bbottom\s+row\b/i.test(normSpaced);
    const wantMiddle =
      /\b(?:middle|center|centre)\b/i.test(normSpaced) &&
      !/\b(?:middle|center|centre)\s+col/i.test(normSpaced);

    const contradicted =
      (wantLeft && cx > 683) ||
      (wantRight && cx < 341) ||
      (wantTop && cy > 512) ||
      (wantBottom && cy < 256);

    if (!contradicted) {
      let posMatches = 0;
      if (wantLeft && cx < 341) posMatches++;
      if (wantRight && cx > 683) posMatches++;
      if (wantTop && cy < 256) posMatches++;
      if (wantBottom && cy > 512) posMatches++;
      if (wantMiddle && ((cx >= 341 && cx <= 683) || (cy >= 256 && cy <= 512))) posMatches++;
      score += Math.min(40, posMatches * 20);
    }
  }

  // 6. Role word (+15)
  if (
    (el.role === 'input' && /\b(?:box|field|input|textbox)\b/i.test(normSpaced)) ||
    (el.role === 'canvas' && /\b(?:pad|box|canvas)\b/i.test(normSpaced)) ||
    (el.role === 'checkbox' && /\b(?:checkbox|tick|check\s+box|check)\b/i.test(normSpaced)) ||
    (el.role === 'card' && /\bcard\b/i.test(normSpaced)) ||
    (el.role === 'banner' && /\b(?:banner|ad|advert|campaign)\b/i.test(normSpaced)) ||
    (el.role === 'tab' && /\btab\b/i.test(normSpaced)) ||
    (el.role === 'link' && /\blink\b/i.test(normSpaced))
  ) {
    score += 15;
  }

  // 7. TYPE intent (+30 to input elements)
  if (
    el.role === 'input' &&
    (/\b(?:type|enter|write|input|fill)\b/i.test(normSpaced) ||
      /["'“”‘’][^"'“”‘’]+["'“”‘’]/.test(instruction))
  ) {
    score += 30;
  }

  // 8. DRAW intent (+30 to canvas elements)
  if (
    el.role === 'canvas' &&
    (/\b(?:draw|sign|signature|signiture|autograph|scribble|doodle|sketch|paint|squiggle|squiggly|sqiggly)\b/i.test(
      normSpaced
    ) ||
      hasSignatureShapeWord(instruction))
  ) {
    score += 30;
  }

  return score;
}

export function buildTieThought(count: number): string {
  return `💭 I found ${count} that fit, so I took the first one — reading left to right, top to bottom, like a professional.`;
}

export function resolveDistraction(
  page: PageDef | undefined,
  pageId: string,
  instruction: string,
  reason: DistractionReason,
  tier: AgentDecision['tier']
): AgentDecision {
  const distractionEl = page?.distractionKey
    ? page.elements.find((el) => el.key === page.distractionKey)
    : undefined;

  if (!distractionEl) {
    return {
      action: 'NOOP',
      pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier,
    };
  }

  let thought: string;
  if (reason === 'meta') {
    thought = '💭 "Win"? I can\'t find a win button. I clicked the shiniest thing instead.';
  } else if (reason === 'mark_id') {
    thought = "💭 I don't see numbers like that on the page, so I clicked the shiniest thing instead.";
  } else {
    const snippet = instruction.trim().slice(0, 24);
    thought = `💭 No idea what "${snippet}" means, but this flashy thing looked important, so I clicked it.`;
  }

  return {
    action: 'CLICK',
    pageId: page!.id,
    mark: distractionEl.mark,
    thought,
    tier,
  };
}

export function resolveBareWordsRule(
  page: PageDef,
  manifest: GeneratedManifest,
  state: PuzzleState,
  instruction: string,
  tier: AgentDecision['tier'] = 'fallback'
): AgentDecision | null {
  const normSpaced = normalizeSpaced(instruction);
  if (BARE_WORD_VERB_REGEX.test(normSpaced)) {
    return null;
  }

  const pageManifest = manifest.pages?.[state.pageId];
  const candidates = page.elements.filter((el) => el.key !== 'page_title');

  const withCoords = candidates.map((el, index) => {
    const mEntry = pageManifest?.elements.find((m) => m.key === el.key || m.mark === el.mark);
    const boxCenter = mEntry
      ? {
          cx: mEntry.box.x + mEntry.box.w / 2,
          cy: mEntry.box.y + mEntry.box.h / 2,
        }
      : { cx: index * 100, cy: index * 100 };

    const score = scoreElementOnPage(el, mEntry ? boxCenter : null, instruction, page.elements);
    return { el, score, cx: boxCenter.cx, cy: boxCenter.cy };
  });

  if (withCoords.some((item) => item.el.role !== 'input' && item.score >= 30)) {
    return null;
  }

  const emptyInputs = withCoords
    .filter((item) => {
      if (item.el.role !== 'input') return false;
      const setFromTextEff = item.el.effects.TYPE?.find(
        (eff): eff is Extract<Effect, { op: 'setFromText' }> => eff.op === 'setFromText'
      );
      if (!setFromTextEff) return false;
      return (state.fields[setFromTextEff.field] ?? '') === '';
    })
    .sort((a, b) => (a.cy !== b.cy ? a.cy - b.cy : a.cx - b.cx));

  if (emptyInputs.length === 0) {
    return null;
  }

  const text = instruction
    .toUpperCase()
    .replace(/[^A-Z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
    .trim();

  if (!text) {
    return resolveDistraction(page, state.pageId, instruction, 'no_clue', tier);
  }

  return {
    action: 'TYPE',
    pageId: state.pageId,
    mark: emptyInputs[0].el.mark,
    text,
    thought: `💭 You didn't say what to do with "${text}", so I typed it into the first empty box I saw.`,
    tier,
  };
}

export function fallbackResolve(ctx: FallbackResolveContext): AgentDecision {
  const { pages, manifest, state, instruction } = ctx;
  const page = pages.find((p) => p.id === state.pageId);
  if (!page || !instruction || instruction.trim().length === 0) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'fallback',
    };
  }

  // 1. Guardrails (meta-prompt or mark ID) -> distraction (rule 5)
  if (isMetaPrompt(instruction)) {
    return resolveDistraction(page, state.pageId, instruction, 'meta', 'fallback');
  }

  const markCheck = filterPromptSyntheticIds(
    instruction,
    page.elements,
    buildDefaultVisibleTextForPage(page)
  );
  if (markCheck.isBlocked) {
    return resolveDistraction(page, state.pageId, instruction, 'mark_id', 'fallback');
  }

  // 2. Bare words
  const bareDecision = resolveBareWordsRule(page, manifest, state, instruction, 'fallback');
  if (bareDecision) {
    return bareDecision;
  }

  // 3. Score every element except page_title
  const pageManifest = manifest.pages?.[state.pageId];
  const candidates = page.elements.filter((el) => el.key !== 'page_title');

  const scored = candidates.map((el, index) => {
    const mEntry = pageManifest?.elements.find((m) => m.key === el.key || m.mark === el.mark);
    const boxCenter = mEntry
      ? {
          cx: mEntry.box.x + mEntry.box.w / 2,
          cy: mEntry.box.y + mEntry.box.h / 2,
        }
      : { cx: index * 100, cy: index * 100 };

    const score = scoreElementOnPage(el, mEntry ? boxCenter : null, instruction, page.elements);
    return { el, score, cx: boxCenter.cx, cy: boxCenter.cy };
  });

  let maxScore = 0;
  for (const item of scored) {
    if (item.score > maxScore) {
      maxScore = item.score;
    }
  }

  if (maxScore < 30) {
    return resolveDistraction(page, state.pageId, instruction, 'no_clue', 'fallback');
  }

  // 4. Ties: first in reading order (box center y, then x)
  const tied = scored
    .filter((item) => item.score === maxScore)
    .sort((a, b) => (a.cy !== b.cy ? a.cy - b.cy : a.cx - b.cx));

  const winner = tied[0].el;
  const isTie = tied.length > 1;
  const tieThought = isTie ? buildTieThought(tied.length) : null;

  if (winner.role === 'input') {
    const text = extractTypedText(instruction);
    const thought =
      tieThought ?? winner.thought ?? `💭 Typing "${text}" one key at a time.`;
    return {
      action: 'TYPE',
      pageId: state.pageId,
      mark: winner.mark,
      text,
      thought,
      tier: 'fallback',
    };
  }

  if (winner.role === 'canvas') {
    const strokeSpec = extractSignatureDrawingSpec(instruction);
    const thought =
      tieThought ??
      (strokeSpec.strokeValue !== 'SHAPE:signature'
        ? strokeSpec.thought
        : winner.thought || strokeSpec.thought);
    return {
      action: 'DRAW',
      pageId: state.pageId,
      mark: winner.mark,
      stroke: strokeSpec.strokeValue,
      thought,
      tier: 'fallback',
    };
  }

  const action: AgentDecision['action'] =
    winner.visual?.timedColumn !== undefined && hasTimingIntent(instruction)
      ? 'TIMED_CLICK'
      : 'CLICK';

  const thought =
    tieThought ?? winner.thought ?? `💭 Clicking the ${winner.label} — fingers crossed!`;

  return {
    action,
    pageId: state.pageId,
    mark: winner.mark,
    thought,
    tier: 'fallback',
  };
}
