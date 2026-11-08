import type { ElementDef, PageDef, PuzzleState } from '../../types/puzzle_data';
import type { GeneratedManifest } from '../../data/puzzles/case_001';
import { COLOR_DICTIONARY, GLYPH_DICTIONARY } from './dictionaries';
import {
  extractSignatureDrawingSpec,
  extractTypedText,
  NOOP_NO_SIGNAL_THOUGHT,
  normalizeInstruction,
} from '../../utils/text_normalizer';
import { hasTimingIntent } from '../flash_clock';

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

export interface FallbackResolveContext {
  pages: PageDef[];
  manifest: GeneratedManifest;
  state: PuzzleState;
  instruction: string;
}

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

export function scoreElementOnPage(
  el: ElementDef,
  boxCenter: { cx: number; cy: number } | null,
  instruction: string
): number {
  const normSpaced = normalizeSpaced(instruction);
  const normCollapsed = normalizeInstruction(instruction);
  let score = 0;

  // 1. Alias (+40)
  if (el.aliases && el.aliases.length > 0) {
    const asksReservedOnly =
      /\breserved\b/i.test(normSpaced) &&
      !/\b(?:unreserved|non\s+reserved)\b/i.test(normSpaced);
    const isUnreservedSeat = el.aliases.includes('unreserved');

    for (const alias of el.aliases) {
      if (asksReservedOnly && isUnreservedSeat && (alias === 'nozomi' || alias === 'hikari')) {
        continue;
      }
      if (alias === 'reserved' && /\b(?:unreserved|non\s+reserved)\b/i.test(normSpaced)) {
        continue;
      }
      if (phraseOccurs(normSpaced, normCollapsed, alias)) {
        score += 40;
        break;
      }
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

  // 5. Position (+20)
  let posMatched = false;
  const wantRow1 = /\b(?:first\s+row|1st\s+row|row\s*0?1|top\s+row|hikari|515|14\s*12)\b/i.test(normSpaced);
  const wantRow2 = /\b(?:second\s+row|2nd\s+row|row\s*0?2|bottom\s+row|nozomi|24|14\s*30)\b/i.test(normSpaced);
  const wantCol1 = /\b(?:first\s+col(?:umn)?|1st\s+col(?:umn)?|col(?:umn)?\s*0?1|left\s+col(?:umn)?)\b/i.test(normSpaced);
  const wantCol2 = /\b(?:second\s+col(?:umn)?|2nd\s+col(?:umn)?|col(?:umn)?\s*0?2|middle\s+col(?:umn)?)\b/i.test(normSpaced);
  const wantCol3 = /\b(?:last\s+col(?:umn)?|third\s+col(?:umn)?|3rd\s+col(?:umn)?|col(?:umn)?\s*0?3|right\s+col(?:umn)?)\b/i.test(normSpaced);

  if (
    (wantRow1 && el.visual?.row === 1) ||
    (wantRow2 && el.visual?.row === 2) ||
    (wantCol1 && el.visual?.column === 1) ||
    (wantCol2 && el.visual?.column === 2) ||
    (wantCol3 && el.visual?.column === 3)
  ) {
    posMatched = true;
  }

  if (!posMatched && boxCenter) {
    const { cx, cy } = boxCenter;
    const wantLeft = /\bleft\b/i.test(normSpaced) && !/\bleft\s+(?:arrow|col)/i.test(normSpaced);
    const wantRight = /\bright\b/i.test(normSpaced) && !/\bright\s+(?:arrow|col)/i.test(normSpaced);
    const wantTop = /\btop\b/i.test(normSpaced) && !/\btop\s+row\b/i.test(normSpaced);
    const wantBottom = /\bbottom\b/i.test(normSpaced) && !/\bbottom\s+row\b/i.test(normSpaced);
    const wantMiddle = /\b(?:middle|center|centre)\b/i.test(normSpaced);

    const contradicted =
      (wantLeft && cx > 683) ||
      (wantRight && cx < 341) ||
      (wantTop && cy > 512) ||
      (wantBottom && cy < 256);

    if (
      !contradicted &&
      ((wantLeft && cx < 341) ||
        (wantRight && cx > 683) ||
        (wantTop && cy < 256) ||
        (wantBottom && cy > 512) ||
        (wantMiddle && ((cx >= 341 && cx <= 683) || (cy >= 256 && cy <= 512))))
    ) {
      posMatched = true;
    }
  }

  if (posMatched) {
    score += 20;
  }

  // 6. Role word (+15)
  if (
    (el.role === 'input' && /\b(?:box|field|input|textbox)\b/i.test(normSpaced)) ||
    (el.role === 'canvas' && /\b(?:pad|box|canvas)\b/i.test(normSpaced)) ||
    (el.role === 'checkbox' && /\b(?:checkbox|tick|check\s+box|check)\b/i.test(normSpaced)) ||
    (el.role === 'card' && /\bcard\b/i.test(normSpaced)) ||
    (el.key === 'promo_insurance' && /\b(?:banner|ad|advert)\b/i.test(normSpaced))
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
    (/\b(?:draw|sign|signature|signiture|autograph|scribble|doodle|squiggle|squiggly|sqiggly)\b/i.test(normSpaced) ||
      hasSignatureShapeWord(instruction))
  ) {
    score += 30;
  }

  return score;
}

export function fallbackResolve(ctx: FallbackResolveContext): AgentDecision {
  const { pages, manifest, state, instruction } = ctx;
  const page = pages.find((p) => p.id === state.pageId);
  if (!page) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'fallback',
    };
  }

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

    const score = scoreElementOnPage(el, mEntry ? boxCenter : null, instruction);
    return { el, score, cx: boxCenter.cx, cy: boxCenter.cy };
  });

  let maxScore = 0;
  for (const item of scored) {
    if (item.score > maxScore) {
      maxScore = item.score;
    }
  }

  if (maxScore < 30) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'fallback',
    };
  }

  const tied = scored
    .filter((item) => item.score === maxScore)
    .sort((a, b) => (a.cy !== b.cy ? a.cy - b.cy : a.cx - b.cx));

  const winner = tied[0].el;
  const isTie = tied.length > 1;

  if (winner.role === 'input') {
    const text = extractTypedText(instruction);
    const thought = isTie
      ? '💭 Two things matched — I went with the first one.'
      : winner.thought || `💭 Typing "${text}" one key at a time.`;
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
    const thought = isTie
      ? '💭 Two things matched — I went with the first one.'
      : strokeSpec.strokeValue !== 'SHAPE:signature'
      ? strokeSpec.thought
      : winner.thought || strokeSpec.thought;
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

  const thought = isTie
    ? '💭 Two things matched — I went with the first one.'
    : winner.thought || `💭 Clicking the ${winner.label} — fingers crossed!`;

  return {
    action,
    pageId: state.pageId,
    mark: winner.mark,
    thought,
    tier: 'fallback',
  };
}
