/**
 * test/adversarial_normalizer.test.ts
 *
 * Adversarial stress-testing suite for text normalizer, 60-character boundary limits,
 * Japanese IME/Katakana normalization, domain glyph preservation, and state hashing.
 */

import { describe, it, expect } from 'vitest';
import {
  validateInstruction,
  normalizeInstruction,
  fastFnv1a,
  generateStateHash,
  generateCacheKey,
  computeSha256,
  extractColorTokens,
  extractNumericTokens,
  extractGlyphTokens,
  extractPositionalCues,
  extractActionVerbs,
  tokenizeInstruction,
} from '../src/utils/text_normalizer';

describe('Adversarial Challenge 1: 60-Character Hard Cap Enforcement', () => {
  it('enforces exact boundary at 59, 60, and 61 ASCII characters', () => {
    const str59 = 'A'.repeat(59);
    const res59 = validateInstruction(str59);
    expect(res59.valid).toBe(true);
    expect(res59.length).toBe(59);
    expect(res59.remainingChars).toBe(1);
    expect(res59.error).toBeUndefined();

    const str60 = 'A'.repeat(60);
    const res60 = validateInstruction(str60);
    expect(res60.valid).toBe(true);
    expect(res60.length).toBe(60);
    expect(res60.remainingChars).toBe(0);
    expect(res60.error).toBeUndefined();

    const str61 = 'A'.repeat(61);
    const res61 = validateInstruction(str61);
    expect(res61.valid).toBe(false);
    expect(res61.length).toBe(61);
    expect(res61.remainingChars).toBe(-1);
    expect(res61.error).toContain('exceeds maximum length of 60');
  });

  it('enforces boundary at 59, 60, and 61 Japanese full-width characters (Kanji/Kana)', () => {
    const kanji59 = '新'.repeat(59);
    const res59 = validateInstruction(kanji59);
    expect(res59.valid).toBe(true);
    expect(res59.length).toBe(59);
    expect(res59.remainingChars).toBe(1);

    const kanji60 = '新'.repeat(60);
    const res60 = validateInstruction(kanji60);
    expect(res60.valid).toBe(true);
    expect(res60.length).toBe(60);
    expect(res60.remainingChars).toBe(0);

    const kanji61 = '新'.repeat(61);
    const res61 = validateInstruction(kanji61);
    expect(res61.valid).toBe(false);
    expect(res61.length).toBe(61);
    expect(res61.remainingChars).toBe(-1);
  });

  it('handles multi-byte Unicode surrogate pairs (🍀 = 2 UTF-16 code units)', () => {
    // 30 clover emojis = 60 code units
    const clovers30 = '🍀'.repeat(30);
    const res30 = validateInstruction(clovers30);
    expect(res30.valid).toBe(true);
    expect(res30.length).toBe(60);
    expect(res30.remainingChars).toBe(0);

    // 31 clover emojis = 62 code units
    const clovers31 = '🍀'.repeat(31);
    const res31 = validateInstruction(clovers31);
    expect(res31.valid).toBe(false);
    expect(res31.length).toBe(62);
    expect(res31.remainingChars).toBe(-2);

    // 29 clovers (58 units) + 'AB' (2 units) = 60 units
    const mixed60 = '🍀'.repeat(29) + 'AB';
    const resMixed60 = validateInstruction(mixed60);
    expect(resMixed60.valid).toBe(true);
    expect(resMixed60.length).toBe(60);

    // 29 clovers (58 units) + 'ABC' (3 units) = 61 units
    const mixed61 = '🍀'.repeat(29) + 'ABC';
    const resMixed61 = validateInstruction(mixed61);
    expect(resMixed61.valid).toBe(false);
    expect(resMixed61.length).toBe(61);
  });

  it('safely handles surrogate pair truncation across the 60-character boundary without crashing', () => {
    // 59 ASCII chars + '🍀' (length 61): boundary cuts '🍀' right in half (index 59 high surrogate, index 60 low surrogate)
    const cutSurrogate = 'A'.repeat(59) + '🍀';
    expect(cutSurrogate.length).toBe(61);

    const res = validateInstruction(cutSurrogate);
    expect(res.valid).toBe(false);
    expect(res.length).toBe(61);
    expect(res.remainingChars).toBe(-1);
    // Truncated string does not corrupt or throw:
    expect(res.normalized).toBe('a'.repeat(59));
  });

  it('measures length by UTF-16 code units matching HTML input maxLength constraint', () => {
    // Combining character e + acute accent (\u0301) = 2 code units
    const combining = 'e\u0301'.repeat(30); // 60 code units
    expect(combining.length).toBe(60);
    const resCombining = validateInstruction(combining);
    expect(resCombining.valid).toBe(true);

    const combining31 = 'e\u0301'.repeat(31); // 62 code units
    expect(combining31.length).toBe(62);
    const resCombining31 = validateInstruction(combining31);
    expect(resCombining31.valid).toBe(false);
  });

  it('rejects empty and whitespace-only inputs regardless of length', () => {
    expect(validateInstruction('').valid).toBe(false);
    expect(validateInstruction('   ').valid).toBe(false);
    expect(validateInstruction('\t\n\r').valid).toBe(false);
    expect(validateInstruction('　　').valid).toBe(false); // full-width ideographic space
  });

  it('correctly handles inputs whose NFKC form expands beyond 60 characters', () => {
    // The square ligature ㌫ (percent) is 1 code unit, but NFKC expands it to 'パーセント' (5 chars)
    const squareLigature = '㌫'.repeat(50); // 50 code units, valid input
    const res = validateInstruction(squareLigature);
    expect(res.valid).toBe(true);
    expect(res.length).toBe(50);
    // Normalized form expands cleanly without error
    expect(res.normalized.length).toBeGreaterThan(60);
  });
});

describe('Adversarial Challenge 2: Japanese Text & Number Normalization', () => {
  it('normalizes half-width katakana (hankaku) to canonical full-width katakana (zenkaku)', () => {
    expect(normalizeInstruction('ｶﾀｶﾅ')).toBe('カタカナ');
    expect(normalizeInstruction('ｼﾝｶﾝｾﾝ')).toBe('シンカンセン');
    expect(normalizeInstruction('ﾋｶﾘ')).toBe('ヒカリ');
    expect(normalizeInstruction('ﾉｿﾞﾐ')).toBe('ノゾミ');
  });

  it('merges half-width voiced (dakuten) and semi-voiced (handakuten) sound marks', () => {
    // ｶ + ﾞ -> ガ
    expect(normalizeInstruction('ｶﾞ')).toBe('ガ');
    // ﾊ + ﾟ -> パ
    expect(normalizeInstruction('ﾊﾟ')).toBe('パ');
    // ｸﾞﾘｰﾝ車 -> グリーン車
    expect(normalizeInstruction('ｸﾞﾘｰﾝ車')).toBe('グリーン車');
  });

  it('normalizes full-width IME numbers to ASCII digits', () => {
    expect(normalizeInstruction('１３８７０')).toBe('13870');
    expect(normalizeInstruction('１４５２０')).toBe('14520');
    expect(normalizeInstruction('１４７２０')).toBe('14720');
    expect(normalizeInstruction('２４００')).toBe('2400');
    expect(normalizeInstruction('５１５')).toBe('515');
    expect(normalizeInstruction('２４')).toBe('24');
  });

  it('extracts numeric tokens accurately from varied Japanese currency formats', () => {
    expect(extractNumericTokens('１３８７０')).toEqual(['13870']);
    expect(extractNumericTokens('¥13,870')).toEqual(['13870']);
    expect(extractNumericTokens('￥13,870')).toEqual(['13870']);
    expect(extractNumericTokens('13,870円')).toEqual(['13870']);
    expect(extractNumericTokens('１３，８７０円')).toEqual(['13870']);
    expect(extractNumericTokens('13870のグリーン車')).toEqual(['13870']);
    expect(extractNumericTokens('保険料 ２，４００円')).toEqual(['2400']);
  });

  it('strips Japanese punctuation while strictly preserving CJK Kanji and Hiragana', () => {
    const raw = '【東海道新幹線】東京⇒新大阪、「ひかり５１５号」を選択せよ！';
    const normalized = normalizeInstruction(raw);
    expect(normalized).toBe('東海道新幹線東京新大阪ひかり515号を選択せよ');
    expect(normalized).not.toContain('【');
    expect(normalized).not.toContain('】');
    expect(normalized).not.toContain('、');
    expect(normalized).not.toContain('「');
    expect(normalized).not.toContain('」');
    expect(normalized).not.toContain('！');
  });
});

describe('Adversarial Challenge 3: Glyph Preservation & Token Extraction', () => {
  it('strictly preserves all 6 required domain symbols under normalizeInstruction', () => {
    const glyphs = ['🍀', '◯', '○', '△', '×', '▶'];
    for (const g of glyphs) {
      expect(normalizeInstruction(g)).toBe(g);
    }

    const composite = 'click 🍀 ◯ ○ △ × ▶ confirm';
    expect(normalizeInstruction(composite)).toBe('click 🍀 ◯ ○ △ × ▶ confirm');
  });

  it('preserves glyphs when intimately adjacent to alphanumeric and CJK characters', () => {
    expect(normalizeInstruction('🍀¥13,870')).toBe('🍀13870');
    expect(normalizeInstruction('◯指定席')).toBe('◯指定席');
    expect(normalizeInstruction('△¥14,520')).toBe('△14520');
    expect(normalizeInstruction('確定へ▶')).toBe('確定へ▶');
  });

  it('extracts canonical glyph tokens when actual symbols are used', () => {
    expect(extractGlyphTokens('🍀')).toEqual(['clover']);
    expect(extractGlyphTokens('◯')).toEqual(['circle']);
    expect(extractGlyphTokens('○')).toEqual(['circle']);
    expect(extractGlyphTokens('△')).toEqual(['triangle']);
    expect(extractGlyphTokens('×')).toEqual(['cross']);
    expect(extractGlyphTokens('▶')).toEqual(['arrow']);
  });

  it('documents case-sensitivity vulnerability in extractGlyphTokens keyword matching', () => {
    // When lowercase keyword is used, it matches:
    expect(extractGlyphTokens('click clover')).toEqual(['clover']);
    expect(extractGlyphTokens('select circle')).toEqual(['circle']);

    // EMPIRICAL BUG FINDING: When uppercase or titlecase keyword is used,
    // extractGlyphTokens fails because it directly calls text.includes(pattern) without lowercasing!
    expect(extractGlyphTokens('CLICK CLOVER')).toEqual([]);
    expect(extractGlyphTokens('Click Clover')).toEqual([]);
    expect(extractGlyphTokens('SELECT CIRCLE')).toEqual([]);

    // When tokenizeInstruction is called with uppercase words:
    const tokenizedUpper = tokenizeInstruction('CLICK CLOVER AT D3');
    expect(tokenizedUpper.verbs).toContain('click');
    expect(tokenizedUpper.gridCoordinate).toBe('D3');
    // But glyphs is empty due to the un-lowercased check!
    expect(tokenizedUpper.glyphs).toEqual([]);
  });

  it('filters out non-domain symbols while keeping domain symbols safe', () => {
    const nonDomain = '★ ☆ ◆ ◇ ♠ ♣ ♥ ♦ ⭕ ❌ ◀';
    expect(normalizeInstruction(nonDomain)).toBe('');
  });
});

describe('Adversarial Challenge 4: Cache Key Determinism & Collision Resistance', () => {
  it('guarantees 0 collisions across all 6,912 valid combinatorial game states in Case #042', () => {
    const macroViews = ['MV-01', 'MV-02', 'MV-03', 'MV-04', 'MV-05', 'MV-06', 'MV-07', 'MV-08', 'MV-09'];
    const trainNames = ['none', 'Hikari 515', 'Nozomi 24'];
    const seatClasses = ['none', 'ordinary_free', 'ordinary_reserved', 'green_car'];
    const fares = [0, 13870, 14520, 14720];
    const booleans = [false, true];

    const hashes = new Set<string>();
    let totalStates = 0;

    for (const mv of macroViews) {
      for (const train of trainNames) {
        for (const seat of seatClasses) {
          for (const fare of fares) {
            for (const green of booleans) {
              for (const trap of booleans) {
                for (const ins of booleans) {
                  for (const confirmed of booleans) {
                    totalStates++;
                    const state = {
                      selectedRoute: 'tokyo_osaka',
                      departureTime: '14:30',
                      trainName: train,
                      seatClass: seat,
                      fare,
                      greenCarSelected: green,
                      insuranceTrapHit: trap,
                      insuranceCheckboxChecked: ins,
                      finalConfirmed: confirmed,
                    };
                    const hash = generateStateHash(mv, state);
                    hashes.add(hash);
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(totalStates).toBe(6912);
    // Every single state produces a unique hash (0 collisions)
    expect(hashes.size).toBe(6912);
  });

  it('guarantees state hash determinism regardless of property insertion order in state', () => {
    const stateOrder1 = {
      selectedRoute: 'tokyo_osaka',
      departureTime: '14:30',
      trainName: 'Nozomi 24',
      seatClass: 'green_car',
      fare: 13870,
      greenCarSelected: true,
      insuranceTrapHit: false,
      insuranceCheckboxChecked: false,
      finalConfirmed: true,
    };

    // Completely reversed / shuffled property definition
    const stateOrder2 = {
      finalConfirmed: true,
      fare: 13870,
      seatClass: 'green_car',
      insuranceTrapHit: false,
      trainName: 'Nozomi 24',
      greenCarSelected: true,
      selectedRoute: 'tokyo_osaka',
      insuranceCheckboxChecked: false,
      departureTime: '14:30',
    };

    const hash1 = generateStateHash('MV-03', stateOrder1);
    const hash2 = generateStateHash('MV-03', stateOrder2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(8);
  });

  it('generates consistent, parseable cache keys for edge KV storage', () => {
    const stateHash = generateStateHash('MV-03', { fare: 13870 });
    const key = generateCacheKey('case_042', stateHash, 'click green clover');

    expect(key).toBe(`case_042:${stateHash}:click green clover`);
    const parts = key.split(':');
    expect(parts[0]).toBe('case_042');
    expect(parts[1]).toBe(stateHash);
    expect(parts[2]).toBe('click green clover');
  });

  it('computes deterministic SHA-256 digests matching standard hex format', async () => {
    const digest1 = await computeSha256('click green clover at D3');
    const digest2 = await computeSha256('click green clover at D3');
    const digest3 = await computeSha256('different instruction');

    expect(digest1).toBe(digest2);
    expect(digest1).not.toBe(digest3);
    expect(digest1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies fastFnv1a 32-bit hash consistency across invocations', () => {
    const hashA = fastFnv1a('mv=MV-03&fare=13870');
    const hashB = fastFnv1a('mv=MV-03&fare=13870');
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{8}$/);
  });

  it('verifies token extraction for colors, positional cues, and verbs', () => {
    expect(extractColorTokens('select the green and red buttons')).toEqual(
      expect.arrayContaining(['green', 'red'])
    );
    expect(extractPositionalCues('look at top row, 1st option on the left banner')).toEqual(
      expect.arrayContaining(['top', 'row', '1st', 'left', 'banner'])
    );
    expect(extractActionVerbs('please click and confirm the seat')).toEqual(
      expect.arrayContaining(['click', 'confirm'])
    );
  });
});
