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
