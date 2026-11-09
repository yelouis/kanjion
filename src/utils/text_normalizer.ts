/**
 * src/utils/text_normalizer.ts
 *
 * Natural language instruction normalization, 60-character validation,
 * deterministic edge caching key generation, and token extraction for offline heuristic matching.
 */

import { GridCoordinate } from '../types/engine';
import { parseGridCoordinate } from './coordinate_projector';

export const MAX_INSTRUCTION_LENGTH = 60;

/**
 * Result of validating an instruction string.
 */
export interface InstructionValidationResult {
  valid: boolean;
  length: number;
  remainingChars: number;
  normalized: string;
  error?: string;
}

/**
 * Validates a raw player telegram instruction against game constraints.
 */
export function validateInstruction(raw: string): InstructionValidationResult {
  const trimmed = raw.trim();
  const length = raw.length;
  const remainingChars = MAX_INSTRUCTION_LENGTH - length;

  if (trimmed.length === 0) {
    return {
      valid: false,
      length,
      remainingChars,
      normalized: '',
      error: 'Instruction cannot be empty or whitespace only.',
    };
  }

  if (length > MAX_INSTRUCTION_LENGTH) {
    return {
      valid: false,
      length,
      remainingChars,
      normalized: normalizeInstruction(raw.slice(0, MAX_INSTRUCTION_LENGTH)),
      error: `Instruction exceeds maximum length of ${MAX_INSTRUCTION_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    length,
    remainingChars,
    normalized: normalizeInstruction(raw),
  };
}

/**
 * Canonical instruction normalizer.
 * Applies NFKC unicode normalization, lowercases, preserves letters/digits/core game glyphs,
 * collapses internal whitespace, and trims edges.
 */
export function normalizeInstruction(raw: string): string {
  if (!raw) return '';

  return raw
    .normalize('NFKC')
    .toLowerCase()
    // Retain letters, digits, whitespace, and key symbols: 🍀, ◯, ○, △, ×, ▶
    .replace(/[^\p{L}\p{N}\s🍀◯○△×▶]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Synchronous, deterministic 32-bit FNV-1a hash formatted as an 8-character hex string.
 * Used for fast synchronous cache lookup and state hashing in client-side tests.
 */
export function fastFnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Deterministic hash of micro-state properties relevant to view rendering.
 * Serializes sorted key-value pairs into a compact string hash.
 */
export function generateStateHash(macroViewId: string, state: Record<string, unknown>): string {
  const relevantKeys = [
    'selectedRoute',
    'route',
    'departureTime',
    'departureSlot',
    'trainName',
    'selectedTrain',
    'seatClass',
    'seatType',
    'fare',
    'fareAmount',
    'greenCarSelected',
    'insuranceTrapHit',
    'insuranceTrapTriggered',
    'insuranceCheckboxChecked',
    'insuranceSelected',
    'finalConfirmed',
    'activeModal',
  ];

  const pairs: string[] = [`mv=${macroViewId}`];

  for (const key of relevantKeys.sort()) {
    if (key in state && state[key] !== undefined) {
      pairs.push(`${key}=${String(state[key])}`);
    }
  }

  return fastFnv1a(pairs.join('&'));
}

/**
 * Generates an edge key-value cache key for the instruction and current state.
 * Format: `${puzzleId}:${stateHash}:${normalizedInstruction}`
 */
export function generateCacheKey(
  puzzleId: string,
  stateHash: string,
  normalizedInstruction: string
): string {
  return `${puzzleId}:${stateHash}:${normalizedInstruction}`;
}

/**
 * Cryptographic SHA-256 hash using the Web Crypto API (browser & Node 18+).
 * Produces a 64-character hexadecimal digest.
 */
export async function computeSha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for non-subtle environments
  return fastFnv1a(text).repeat(8).slice(0, 64);
}

// =========================================================================
// TOKEN & HEURISTIC EXTRACTION UTILITIES (For Offline Matcher)
// =========================================================================

export interface InstructionTokens {
  raw: string;
  normalized: string;
  gridCoordinate: GridCoordinate | null;
  colors: string[];
  numbers: string[];
  glyphs: string[];
  positionalCues: string[];
  verbs: string[];
}

const COLOR_MAP: Record<string, string> = {
  green: 'green',
  emerald: 'green',
  midori: 'green',
  red: 'red',
  aka: 'red',
  blue: 'blue',
  ao: 'blue',
  white: 'white',
  shiro: 'white',
  gray: 'gray',
  grey: 'gray',
  haiiro: 'gray',
};

const GLYPH_MAP: Record<string, string> = {
  '🍀': 'clover',
  clover: 'clover',
  '◯': 'circle',
  '○': 'circle',
  circle: 'circle',
  maru: 'circle',
  '△': 'triangle',
  triangle: 'triangle',
  sankaku: 'triangle',
  '×': 'cross',
  cross: 'cross',
  batsu: 'cross',
  '▶': 'arrow',
  arrow: 'arrow',
};

/**
 * Extracts recognized color tokens from instruction.
 */
export function extractColorTokens(text: string): string[] {
  const normalized = normalizeInstruction(text);
  const found = new Set<string>();
  const words = normalized.split(' ');

  for (const word of words) {
    if (COLOR_MAP[word]) {
      found.add(COLOR_MAP[word]);
    }
  }

  return Array.from(found);
}

/**
 * Extracts numbers and price literals (e.g. 13870, 14520, 14720, 2400, 515, 24).
 */
export function extractNumericTokens(text: string): string[] {
  const normalized = text.normalize('NFKC').replace(/,/g, '');
  const matches = normalized.match(/\b(13870|14520|14720|2400|515|24|1412|1430)\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Extracts recognized glyphs or symbol keywords (e.g. 🍀, clover, ◯, ▶).
 */
export function extractGlyphTokens(text: string): string[] {
  const found = new Set<string>();
  for (const [pattern, canonical] of Object.entries(GLYPH_MAP)) {
    if (text.includes(pattern)) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

/**
 * Extracts relative positional cues (e.g. 1st, 2nd, top, bottom, row, sidebar).
 */
export function extractPositionalCues(text: string): string[] {
  const normalized = normalizeInstruction(text);
  const cues = ['1st', 'first', '2nd', 'second', 'top', 'bottom', 'left', 'right', 'row', 'banner', 'sidebar'];
  return cues.filter((cue) => normalized.includes(cue));
}

/**
 * Extracts action verbs (e.g. click, select, confirm, cancel, check).
 */
export function extractActionVerbs(text: string): string[] {
  const normalized = normalizeInstruction(text);
  const verbs = ['click', 'press', 'select', 'choose', 'hit', 'push', 'pick', 'check', 'confirm', 'cancel'];
  return verbs.filter((v) => new RegExp(`\\b${v}\\b`).test(normalized));
}

/**
 * Complete tokenization of an instruction into structured feature sets.
 */
export function tokenizeInstruction(instruction: string): InstructionTokens {
  const normalized = normalizeInstruction(instruction);
  return {
    raw: instruction,
    normalized,
    gridCoordinate: parseGridCoordinate(instruction),
    colors: extractColorTokens(instruction),
    numbers: extractNumericTokens(instruction),
    glyphs: extractGlyphTokens(instruction),
    positionalCues: extractPositionalCues(instruction),
    verbs: extractActionVerbs(instruction),
  };
}

// =========================================================================
// OPEN-ENDED SIGNATURE & SHAPE DRAWING SYNTHESIZER (#27 Digital Pad)
// =========================================================================

export interface SignatureDrawingSpec {
  /** Stored in state.signatureStroke (e.g. 'SHAPE:smile', 'SHAPE:heart', 'TEXT:BOB', 'SHAPE:signature') */
  strokeValue: string;
  /** Short human label shown in badge/summary (e.g. '😊 Smile', '❤️ Heart', '') */
  displayLabel: string;
  /** Witty, human-friendly model thought reacting to the specific drawing request */
  thought: string;
  /** SVG path(s) in a 260x60 viewBox for rendering inside #signature-canvas */
  svgPaths: string[];
  /** Optional handwritten text rendered above the flourish when the user writes a specific word/name */
  customText?: string;
}

const SIGNATURE_SHAPES: Record<string, Omit<SignatureDrawingSpec, 'strokeValue'>> = {
  smile: {
    displayLabel: '😊 Smile',
    thought: '💭 Channeling my inner Picasso — drawing a big happy smiley-face signature in the box! 😊',
    svgPaths: [
      'M 102 15 A 3.5 3.5 0 1 1 101.9 15',
      'M 158 15 A 3.5 3.5 0 1 1 157.9 15',
      'M 76 25 Q 130 58 184 25',
    ],
  },
  frown: {
    displayLabel: '☹️ Frown',
    thought: '💭 Drawing a dramatic sad frown in the signature box — train forms make me emotional too!',
    svgPaths: [
      'M 102 15 A 3.5 3.5 0 1 1 101.9 15',
      'M 158 15 A 3.5 3.5 0 1 1 157.9 15',
      'M 80 46 Q 130 18 180 46',
    ],
  },
  heart: {
    displayLabel: '❤️ Heart',
    thought: '💭 Signing with love! Drawing a big heart right in the middle of the authorization pad!',
    svgPaths: [
      'M 130 52 C 95 34, 82 12, 108 8 C 122 8, 130 22, 130 22 C 130 22, 138 8, 152 8 C 178 12, 165 34, 130 52 Z',
    ],
  },
  star: {
    displayLabel: '⭐ Star',
    thought: '💭 Giving ourselves a 5-star review — drawing a star in the signature box! ⭐',
    svgPaths: [
      'M 130 5 L 140 23 L 160 23 L 144 35 L 150 53 L 130 41 L 110 53 L 116 35 L 100 23 L 120 23 Z',
    ],
  },
  circle: {
    displayLabel: '⭕ Circle',
    thought: '💭 Drawing a near-perfect circle in the signature pad — geometry class finally paid off!',
    svgPaths: ['M 130 6 A 22 22 0 1 1 129.9 6'],
  },
  triangle: {
    displayLabel: '🔺 Triangle',
    thought: '💭 Three sharp corners coming right up — drawing a triangle in the signature box!',
    svgPaths: ['M 130 6 L 166 50 L 94 50 Z'],
  },
  square: {
    displayLabel: '⬜ Square',
    thought: '💭 Drawing a crisp four-cornered square inside the signature box!',
    svgPaths: ['M 96 8 L 164 8 L 164 50 L 96 50 Z'],
  },
  cat: {
    displayLabel: '🐱 Cat',
    thought: '💭 Meow! Drawing an adorable cat with pointy ears and whiskers as our official signature!',
    svgPaths: [
      'M 98 22 L 94 6 L 112 16 L 148 16 L 166 6 L 162 22 C 170 36, 160 52, 130 52 C 100 52, 90 36, 98 22 Z',
      'M 115 28 A 2 2 0 1 1 114.9 28 M 145 28 A 2 2 0 1 1 144.9 28 M 122 38 Q 130 44 138 38 M 74 30 L 96 32 M 74 38 L 96 37 M 164 32 L 186 30 M 164 37 L 186 38',
    ],
  },
  house: {
    displayLabel: '🏠 House',
    thought: '💭 Drawing a cozy little house with a pitched roof and front door in the signature pad!',
    svgPaths: [
      'M 96 26 L 130 6 L 164 26 L 156 26 L 156 52 L 104 52 L 104 26 Z M 123 52 L 123 36 L 137 36 L 137 52',
    ],
  },
  stickfigure: {
    displayLabel: '🧍 Stick Figure',
    thought: '💭 Drawing a classic stick figure — peak digital art right in the authorization box!',
    svgPaths: [
      'M 130 6 A 7 7 0 1 1 129.9 6 M 130 20 L 130 38 M 110 26 L 150 26 M 130 38 L 114 54 M 130 38 L 146 54',
    ],
  },
  fish: {
    displayLabel: '🐟 Fish',
    thought: '💭 Swimming right through authorization — drawing a little fish in the signature box!',
    svgPaths: [
      'M 76 30 C 106 8, 154 8, 182 30 L 206 14 L 206 46 L 182 30 C 154 52, 106 52, 76 30 Z M 98 26 A 2 2 0 1 1 97.9 26',
    ],
  },
  flower: {
    displayLabel: '🌸 Flower',
    thought: '💭 Adding a floral touch — drawing a blooming flower in the signature box!',
    svgPaths: [
      'M 130 20 A 6 6 0 1 1 129.9 20 M 130 8 A 6 6 0 1 1 129.9 8 M 142 20 A 6 6 0 1 1 141.9 20 M 118 20 A 6 6 0 1 1 117.9 20 M 130 32 A 6 6 0 1 1 129.9 32 M 130 38 L 130 56',
    ],
  },
  check: {
    displayLabel: '✓ Checkmark',
    thought: '💭 Swoosh! Drawing a bold checkmark in the signature box!',
    svgPaths: ['M 92 30 L 118 50 L 174 10'],
  },
  cross: {
    displayLabel: '✗ X-Mark',
    thought: '💭 Signing with an old-school X mark right in the authorization box!',
    svgPaths: ['M 98 10 L 162 50 M 162 10 L 98 50'],
  },
  zigzag: {
    displayLabel: '⚡ Zigzag',
    thought: '💭 Zapping a sharp lightning zigzag across the signature pad!',
    svgPaths: ['M 30 44 L 70 12 L 110 44 L 150 12 L 190 44 L 230 12'],
  },
  spiral: {
    displayLabel: '🌀 Spiral',
    thought: '💭 Getting hypnotic — drawing a swirl spiral in the signature box!',
    svgPaths: [
      'M 130 30 C 136 24, 144 30, 138 38 C 128 48, 112 38, 118 22 C 126 8, 152 12, 154 32 C 156 52, 118 56, 104 36',
    ],
  },
  line: {
    displayLabel: '━ Straight Line',
    thought: '💭 Keeping it minimalist — drawing a clean straight line across the signature pad!',
    svgPaths: ['M 35 30 L 225 30'],
  },
};

export const NOOP_NO_SIGNAL_THOUGHT =
  '💭 I have no idea what that means, so I poked the page title. Describe what to click?';
export const NOOP_META_PROMPT_THOUGHT =
  '💭 Win? Solve? I only see buttons, not goals. I tapped the title while you rephrase.';
export const NOOP_MARK_ID_THOUGHT =
  "💭 I don't see numbers like that on the page — describe the thing instead.";

const META_PROMPT_REGEX =
  /\b(win|winning|solve|solution|cheat|answer key|complete the (task|puzzle|game|level|case)|beat the (game|level|puzzle)|(do|copy|repeat) what the (replay|video|demo) (did|does|shows)|copy the (replay|video|demo))\b/i;

export function isMetaPrompt(instruction: string): boolean {
  return META_PROMPT_REGEX.test(instruction || '');
}

const TYPED_TEXT_DROP_WORDS = new Set([
  'the',
  'a',
  'an',
  'in',
  'into',
  'on',
  'at',
  'to',
  'box',
  'field',
  'textbox',
  'input',
  'name',
  'passenger',
  'passengers',
  'please',
  'his',
  'her',
  'their',
  'my',
  'as',
  'for',
  'romaji',
  'roman',
  'kanji',
  'katakana',
  'kana',
  'english',
  'letters',
  'alphabet',
  'surname',
  'family',
  'first',
  'last',
  'given',
  'left',
  'right',
  'top',
  'bottom',
  'middle',
  'center',
  'centre',
  'row',
  'col',
  'column',
  'second',
  'third',
  'fourth',
  'fifth',
  'phone',
  'telephone',
  'number',
]);

export function extractTypedText(instruction: string): string {
  const raw = instruction || '';
  const formatOutput = (s: string): string =>
    s
      .toUpperCase()
      .replace(/[^A-Z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16)
      .trim();

  // 1. If the instruction contains straight- or curly-quoted text, take the first quoted run.
  const quotedMatch = raw.match(/"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?:^|[^A-Za-z])'([^']+)'(?=[^A-Za-z]|$)/);
  if (quotedMatch) {
    const quoted = quotedMatch[1] ?? quotedMatch[2] ?? quotedMatch[3] ?? quotedMatch[4] ?? '';
    const formatted = formatOutput(quoted);
    if (formatted) return formatted;
  }

  // 2. Otherwise take the words after the first verb from: type, enter, write, input, put, fill in, fill.
  const verbRegex = /\b(fill\s+in|type|enter|write|input|put|fill)\b/i;
  const verbMatch = verbRegex.exec(raw);
  const afterVerb = verbMatch ? raw.slice(verbMatch.index + verbMatch[0].length) : raw;
  const words = afterVerb.match(/[A-Za-z]+/g) ?? [];

  const remaining: string[] = [];
  const droppedPassengerName: string[] = [];

  for (const w of words) {
    const lower = w.toLowerCase();
    if (TYPED_TEXT_DROP_WORDS.has(lower)) {
      if (lower === 'passenger' || lower === 'name') {
        droppedPassengerName.push(lower);
      }
    } else {
      remaining.push(w);
    }
  }

  const chosenWords = remaining.slice(0, 2);
  let candidate: string;
  if (chosenWords.length > 0) {
    candidate = chosenWords.join(' ');
  } else if (droppedPassengerName.length > 0) {
    candidate = droppedPassengerName.join(' ');
  } else {
    const fallbackMatches = (raw.match(/\b(passenger|name)\b/gi) ?? []).map((w) => w.toLowerCase());
    candidate = fallbackMatches.length > 0 ? fallbackMatches.join(' ') : 'name';
  }

  return formatOutput(candidate) || 'NAME';
}

const DEFAULT_SQUIGGLE_SPEC: SignatureDrawingSpec = {
  strokeValue: 'SHAPE:signature',
  displayLabel: '',
  thought: "💭 Channeling my inner doctor's handwriting — one very fancy squiggle, coming up!",
  svgPaths: [
    'M 24 42 C 42 12, 58 46, 78 24 C 95 10, 110 44, 132 28 C 152 14, 170 42, 196 22 C 212 12, 226 36, 240 26',
  ],
};

const ATTEMPT_SKIP_WORDS = new Set([
  'a',
  'an',
  'the',
  'some',
  'my',
  'me',
  'us',
  'one',
  'two',
  'three',
  'big',
  'small',
  'little',
  'tiny',
  'huge',
  'cute',
  'funny',
  'scary',
  'nice',
  'quick',
  'simple',
]);

const ATTEMPT_SQUIGGLE_WORDS = new Set([
  'signature',
  'sign',
  'line',
  'something',
  'anything',
  'it',
  'this',
  'that',
  'here',
  'there',
  'box',
  'pad',
  'in',
  'on',
]);

function buildAttemptDrawingSpec(rawWord: string): SignatureDrawingSpec {
  const word = rawWord.replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 16) || 'thing';
  return {
    strokeValue: `ATTEMPT:${word}`,
    displayLabel: `${word} (attempt)`,
    thought: `💭 I can't draw a ${word}. Here's a very long worm with ambition.`,
    svgPaths: [
      'M 30 38 C 55 18, 75 56, 100 36 S 145 18, 170 38 S 205 54, 222 34',
      'M 216 34 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
    ],
  };
}

/**
 * Parses a natural-language drawing/signing instruction into a concrete SignatureDrawingSpec.
 */
export function extractSignatureDrawingSpec(instruction: string): SignatureDrawingSpec {
  const raw = (instruction || '').trim();
  const lower = raw.toLowerCase();

  if (/\b(?:smile|smiley|happy|grin)\b/i.test(lower) || raw.includes(':)') || raw.includes('😊')) {
    return { strokeValue: 'SHAPE:smile', ...SIGNATURE_SHAPES.smile };
  }
  if (/\b(?:frown|sad|unhappy)\b/i.test(lower) || raw.includes(':(') || raw.includes('☹')) {
    return { strokeValue: 'SHAPE:frown', ...SIGNATURE_SHAPES.frown };
  }
  if (/\b(?:heart|love)\b/i.test(lower) || raw.includes('<3') || raw.includes('❤')) {
    return { strokeValue: 'SHAPE:heart', ...SIGNATURE_SHAPES.heart };
  }
  if (/\b(?:star|asterisk)\b/i.test(lower) || raw.includes('⭐')) {
    return { strokeValue: 'SHAPE:star', ...SIGNATURE_SHAPES.star };
  }
  if (/\b(?:circle|oval|ring|round)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:circle', ...SIGNATURE_SHAPES.circle };
  }
  if (/\b(?:triangle|pyramid|delta)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:triangle', ...SIGNATURE_SHAPES.triangle };
  }
  if (/\b(?:square|rectangle|cube)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:square', ...SIGNATURE_SHAPES.square };
  }
  if (/\b(?:cat|kitty|meow|kitten|neko)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:cat', ...SIGNATURE_SHAPES.cat };
  }
  if (/\b(?:house|home)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:house', ...SIGNATURE_SHAPES.house };
  }
  if (/\b(?:stick\s*figure|person|human|man)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:stickfigure', ...SIGNATURE_SHAPES.stickfigure };
  }
  if (/\b(?:fish|shark|sushi)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:fish', ...SIGNATURE_SHAPES.fish };
  }
  if (/\b(?:flower|rose|daisy|tulip)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:flower', ...SIGNATURE_SHAPES.flower };
  }
  if (/\b(?:check\s*mark|checkmark|tick)\b/i.test(lower) || raw.includes('✓')) {
    return { strokeValue: 'SHAPE:check', ...SIGNATURE_SHAPES.check };
  }
  if (/\b(?:cross|x-?mark|an\s+x|letter\s+x)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:cross', ...SIGNATURE_SHAPES.cross };
  }
  if (/\b(?:zigzag|zig-zag|lightning|bolt|wave|sine)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:zigzag', ...SIGNATURE_SHAPES.zigzag };
  }
  if (/\b(?:spiral|swirl|vortex|tornado)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:spiral', ...SIGNATURE_SHAPES.spiral };
  }
  if (/\b(?:straight\s*line|horizontal\s*line|flat\s*line)\b/i.test(lower)) {
    return { strokeValue: 'SHAPE:line', ...SIGNATURE_SHAPES.line };
  }

  // Check if user requested writing/signing a specific name or quoted text
  const quoted = raw.match(/["']([A-Za-z0-9\s.!?:)-]{1,22})["']/);
  const afterWriteOrSign = raw.match(/\b(?:write|sign|type)\s+([A-Za-z0-9.]{2,18})\b/i);
  const ignoreWords = new Set([
    'A',
    'AN',
    'THE',
    'IN',
    'ON',
    'INTO',
    'BOX',
    'PAD',
    'FIELD',
    'HERE',
    'LINE',
    'SIGNATURE',
    'SIGNITURE',
    'NAME',
    'YOUR',
    'MY',
    'IT',
    'SOMETHING',
    'SQUIGGLE',
    'SQUIGGLY',
    'SQIGGLY',
  ]);
  const candidate = quoted
    ? quoted[1].trim()
    : afterWriteOrSign && !ignoreWords.has(afterWriteOrSign[1].toUpperCase())
    ? afterWriteOrSign[1].trim()
    : null;

  if (candidate && !ignoreWords.has(candidate.toUpperCase())) {
    return {
      strokeValue: `TEXT:${candidate}`,
      displayLabel: candidate,
      thought: `💭 Signing "${candidate}" in my fanciest cursive handwriting with an underline flourish!`,
      svgPaths: ['M 45 48 Q 130 56 215 44'],
      customText: candidate,
    };
  }

  const drawVerbMatch = /\b(?:draw|sketch|doodle|paint)\b/i.exec(raw);
  if (drawVerbMatch) {
    const afterVerb = raw.slice(drawVerbMatch.index + drawVerbMatch[0].length);
    const words = (afterVerb.match(/[A-Za-z]+/g) ?? []).map((w) => w.toLowerCase());
    let idx = 0;
    while (idx < words.length && ATTEMPT_SKIP_WORDS.has(words[idx])) {
      idx++;
    }
    const nextWord = words[idx] ? words[idx].slice(0, 16) : '';
    if (!nextWord || ATTEMPT_SQUIGGLE_WORDS.has(nextWord)) {
      return DEFAULT_SQUIGGLE_SPEC;
    }
    return buildAttemptDrawingSpec(nextWord);
  }

  return DEFAULT_SQUIGGLE_SPEC;
}

/**
 * Resolves a stored state.signatureStroke value (e.g. 'SHAPE:smile', 'TEXT:Bob', 'SHAPE:signature')
 * back to its SVG rendering specification for ShinkansenSandbox.
 */
export function resolveSignatureDrawingSpec(strokeValue?: string): SignatureDrawingSpec {
  if (!strokeValue || strokeValue === 'SHAPE:signature') {
    return DEFAULT_SQUIGGLE_SPEC;
  }
  if (strokeValue.startsWith('ATTEMPT:')) {
    const word = strokeValue.slice('ATTEMPT:'.length);
    return buildAttemptDrawingSpec(word);
  }
  if (strokeValue.startsWith('SHAPE:')) {
    const key = strokeValue.slice('SHAPE:'.length).toLowerCase();
    if (SIGNATURE_SHAPES[key]) {
      return { strokeValue, ...SIGNATURE_SHAPES[key] };
    }
  }
  if (strokeValue.startsWith('TEXT:')) {
    const customText = strokeValue.slice('TEXT:'.length);
    return {
      strokeValue,
      displayLabel: customText,
      thought: `💭 Signed "${customText}"!`,
      svgPaths: ['M 45 48 Q 130 56 215 44'],
      customText,
    };
  }
  // If raw text or prompt was stored directly, parse it
  return extractSignatureDrawingSpec(strokeValue);
}
