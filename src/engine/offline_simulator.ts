/**
 * src/engine/offline_simulator.ts
 *
 * Standalone offline deterministic simulation engine implementing AgentExecutionConnector.
 * Resolves natural language telegram instructions against DOM elements using
 * a weighted multi-token heuristic rubric without external API dependencies.
 */

import {
  AgentExecutionConnector,
  AgentAction,
  AgentCoordinate,
  ShinkansenMicroState,
} from '../types/engine';
import { SoMElement, MacroView } from '../types/puzzle';
import { CASE_042_MACRO_VIEWS } from '../data/puzzles/case_042';
import { parseGridCoordinate, getBoxCenter } from '../utils/coordinate_projector';
import { normalizeInstruction } from '../utils/text_normalizer';

export interface ScoringWeights {
  coord: number;
  glyph: number;
  color: number;
  num: number;
  pos: number;
  label: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  coord: 50,
  glyph: 35,
  color: 30,
  num: 25,
  pos: 20,
  label: 15,
};

export const CONFIDENCE_THRESHOLD = 25;

export interface ElementMatchScore {
  element: SoMElement;
  totalScore: number;
  breakdown: {
    coord: number;
    glyph: number;
    color: number;
    num: number;
    pos: number;
    label: number;
  };
}

/**
 * Case-insensitive glyph mapping with symbol & keyword representations.
 */
const GLYPH_DICTIONARY: Record<string, string[]> = {
  '🍀': ['clover', '🍀', 'クローバー'],
  '◯': ['circle', '◯', '○', 'maru', 'まる'],
  '△': ['triangle', '△', 'sankaku', 'さんかく'],
  '×': ['cross', '×', 'batsu', 'ばつ'],
  '▶': ['arrow', '▶', 'right arrow', '確定へ'],
  '◀': ['left arrow', '◀', 'back arrow', '戻る'],
};

/**
 * Color dictionary mapping canonical colors to English, Romaji, and Japanese tokens.
 */
const COLOR_DICTIONARY: Record<string, string[]> = {
  green: ['green', 'emerald', 'midori', 'みどり', '緑', '#059669', 'グリーン'],
  red: ['red', 'aka', 'あか', '赤', '赤ボタン', '#dc2626'],
  blue: ['blue', 'ao', 'あお', '青', '#2563eb'],
  white: ['white', 'shiro', '白', '#ffffff'],
  gray: ['gray', 'grey', 'haiiro', 'グレー', '灰', '#f5f5f5', '#d4d4d4'],
};

export class OfflineSimulationEngine implements AgentExecutionConnector {
  private macroViews: Map<string, MacroView>;
  private weights: ScoringWeights;
  private confidenceThreshold: number;

  constructor(
    customMacroViews: MacroView[] = CASE_042_MACRO_VIEWS,
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    confidenceThreshold: number = CONFIDENCE_THRESHOLD
  ) {
    this.macroViews = new Map(customMacroViews.map((mv) => [mv.id, mv]));
    this.weights = weights;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Resolves a player telegram instruction deterministically against the current micro-state.
   */
  public resolveInstruction(
    macroViewId: string,
    microState: ShinkansenMicroState,
    instruction: string
  ): AgentAction {
    const rawTrimmed = (instruction || '').trim();
    if (!rawTrimmed) {
      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Empty instruction received.',
      };
    }

    if (rawTrimmed.length > 60 || (instruction && instruction.length > 60)) {
      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Instruction exceeds maximum length of 60 characters.',
      };
    }

    const macroView = this.macroViews.get(macroViewId);
    if (!macroView || !macroView.elements || macroView.elements.length === 0) {
      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: No interactive elements available in view.',
      };
    }

    const lower = rawTrimmed.toLowerCase();

    // Multi-modal Action 1: TYPE into Passenger Name field (#17)
    if (
      /\btanaka\b/i.test(rawTrimmed) ||
      (/\b(?:type|enter|input|fill)\b/i.test(lower) &&
        /\b(?:name|passenger|romaji|搭乗者)\b/i.test(lower))
    ) {
      const nameMatch = rawTrimmed.match(/["']([A-Za-z\s.]{2,20})["']/) || rawTrimmed.match(/\b(tanaka)\b/i);
      const typedValue = (nameMatch ? nameMatch[1].trim() : 'TANAKA').toUpperCase();
      return {
        action: 'TYPE',
        targetId: '#17',
        gridRef: 'A2',
        targetCoordinate: { x: 128, y: 210 },
        textValue: typedValue,
        thought: `📌 FIELD NOTE: Typed [${typedValue}] into [搭乗者名] at A2`,
      };
    }

    // Multi-modal Action 2: DRAW signature in Digital Authorization Pad (#27)
    if (
      !lower.includes('sign out') &&
      /\b(?:draw|sign|signature|autograph|署名|サイン)\b/i.test(lower)
    ) {
      return {
        action: 'DRAW',
        targetId: '#27',
        gridRef: 'C4',
        targetCoordinate: { x: 490, y: 716 },
        textValue: 'T. Tanaka',
        thought: '📌 FIELD NOTE: Signed [自署・サイン欄] at C4',
      };
    }

    // Multi-page Action 3: Route Selection (Tokaido-Sanyo Tokyo -> Shin-Osaka #1)
    if (/\b(?:tokaido|tokyo\s*(?:to|->|⇒)\s*(?:shin-?)?osaka|shin-?osaka\s*route|東海道)\b/i.test(lower)) {
      return {
        action: 'CLICK',
        targetId: '#1',
        gridRef: 'B1',
        targetCoordinate: { x: 340, y: 42 },
        thought: '📌 FIELD NOTE: Clicked [東海道新幹線 東京⇒新大阪] at B1',
      };
    }

    const scores = this.scoreElements(macroView.elements, instruction, microState);
    if (scores.length === 0) {
      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Instruction unclear. Target could not be identified.',
      };
    }

    // Sort descending by total score
    scores.sort((a, b) => b.totalScore - a.totalScore);
    const top = scores[0];

    // Check confidence threshold
    if (top.totalScore < this.confidenceThreshold) {
      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Instruction unclear. Target could not be identified.',
      };
    }

    // Check ambiguity tie (top 2 elements have identical score >= threshold)
    if (scores.length > 1) {
      const runnerUp = scores[1];
      if (top.totalScore === runnerUp.totalScore && top.totalScore >= this.confidenceThreshold) {
        // Special diagnostic thought for fare ties (e.g. 13870)
        if (instruction.includes('13870') || instruction.includes('13,870')) {
          return {
            action: 'CONFUSED',
            thought: '📌 FIELD NOTE: Ambiguous match between Hikari & Nozomi fares (¥13,870).',
          };
        }
        return {
          action: 'CONFUSED',
          thought: '📌 FIELD NOTE: Ambiguous match. Multiple matching elements detected.',
        };
      }
    }

    return this.buildAction(top.element, microState);
  }

  /**
   * Evaluates and scores all interactive elements in the macro-view against the instruction.
   */
  public scoreElements(
    elements: SoMElement[],
    rawInstruction: string,
    _microState: ShinkansenMicroState
  ): ElementMatchScore[] {
    const lower = rawInstruction.toLowerCase();
    const normalized = normalizeInstruction(rawInstruction);
    const parsedCoord = parseGridCoordinate(rawInstruction);

    return elements.map((element) => {
      let coordScore = 0;
      let glyphScore = 0;
      let colorScore = 0;
      let numScore = 0;
      let posScore = 0;
      let labelScore = 0;

      // 1. Coordinate Match (Weight: 50)
      if (parsedCoord && element.gridRef.toUpperCase() === parsedCoord.toUpperCase()) {
        coordScore = this.weights.coord;
      }

      // 2. Glyph / Icon Match (Weight: 35) — Case-insensitive keyword & symbol matching
      if (element.visualAttributes.glyph) {
        const canonical = element.visualAttributes.glyph;
        const aliases = GLYPH_DICTIONARY[canonical] || [canonical];
        const hasGlyphMatch = aliases.some(
          (alias) => lower.includes(alias.toLowerCase()) || rawInstruction.includes(alias)
        );
        if (hasGlyphMatch) {
          glyphScore = this.weights.glyph;
        }
      }

      // 3. Color Match (Weight: 30)
      const elBg = (element.visualAttributes.bgColor || '').toLowerCase();
      const elDesc = (element.visualAttributes.description || '').toLowerCase();
      const elText = element.text.toLowerCase();

      for (const [colorName, tokens] of Object.entries(COLOR_DICTIONARY)) {
        const matchesQuery = tokens.some((tok) => lower.includes(tok));
        if (matchesQuery) {
          const elementHasColor =
            tokens.some((tok) => elBg.includes(tok)) ||
            elDesc.includes(colorName) ||
            elText.includes(colorName) ||
            (colorName === 'red' && elText.includes('赤ボタン')) ||
            (colorName === 'green' && elText.includes('グリーン車'));
          if (elementHasColor) {
            colorScore = this.weights.color;
            break;
          }
        }
      }

      // 4. Numerals & Prices Match (Weight: 25)
      const numericMatches = rawInstruction
        .normalize('NFKC')
        .replace(/,/g, '')
        .match(/\b(13870|14520|14720|2400|515|24|1412|1430)\b/g);

      if (numericMatches) {
        const fullElementText = `${element.text} ${element.visualAttributes.description || ''}`
          .normalize('NFKC')
          .replace(/,/g, '');
        const hasNumMatch = numericMatches.some((num) => fullElementText.includes(num));
        if (hasNumMatch) {
          numScore = this.weights.num;
        }
      }

      // 5. Positional Cues Match (Weight: 20)
      const posCues = [
        'top',
        'bottom',
        'left',
        'right',
        'header',
        'banner',
        'sidebar',
        '1st row',
        'first row',
        '2nd row',
        'second row',
        'row 1',
        'row 2',
        'row 3',
        'row 4',
        'col a',
        'col b',
        'col c',
        'col d',
      ];
      for (const cue of posCues) {
        if (lower.includes(cue)) {
          if (this.elementMatchesPosition(element, cue)) {
            posScore = this.weights.pos;
            break;
          }
        }
      }

      // 6. Labels, Verbs & Semantic Keywords (Weight: 15 per matched semantic token)
      labelScore = this.calculateSemanticScore(element, lower, normalized, rawInstruction);

      const totalScore = coordScore + glyphScore + colorScore + numScore + posScore + labelScore;

      return {
        element,
        totalScore,
        breakdown: {
          coord: coordScore,
          glyph: glyphScore,
          color: colorScore,
          num: numScore,
          pos: posScore,
          label: labelScore,
        },
      };
    });
  }

  /**
   * Helper evaluating positional keywords against element geometry & role.
   */
  private elementMatchesPosition(el: SoMElement, cue: string): boolean {
    const box = el.boundingBox;
    switch (cue) {
      case 'top':
      case 'header':
      case 'banner':
      case 'row 1':
        return box.y < 192 || el.gridRef.endsWith('1');
      case 'bottom':
      case 'row 4':
        return box.y > 576 || el.gridRef.endsWith('4');
      case 'left':
      case 'sidebar':
        return box.x < 512 || el.gridRef.startsWith('A') || el.gridRef.startsWith('B');
      case 'right':
        return box.x > 512 || el.gridRef.startsWith('C') || el.gridRef.startsWith('D');
      case '1st row':
      case 'first row':
        return el.id === 21 || el.id === 22; // Hikari 515 row
      case '2nd row':
      case 'second row':
        return el.id === 23 || el.id === 24 || el.id === 25; // Nozomi 24 row
      case 'row 2':
        return el.gridRef.endsWith('2') || el.id === 23 || el.id === 24 || el.id === 25;
      case 'row 3':
        return el.gridRef.endsWith('3');
      case 'col a':
        return el.gridRef.startsWith('A');
      case 'col b':
        return el.gridRef.startsWith('B');
      case 'col c':
        return el.gridRef.startsWith('C');
      case 'col d':
        return el.gridRef.startsWith('D');
      default:
        return false;
    }
  }

  /**
   * Calculates accumulated semantic score based on domain verbs, nouns, and actions.
   */
  private calculateSemanticScore(
    el: SoMElement,
    lower: string,
    _normalized: string,
    rawInstruction: string
  ): number {
    let score = 0;
    const text = el.text.toLowerCase();

    // Confirm button (#30)
    if (el.id === 30) {
      if (
        lower.includes('confirm') ||
        lower.includes('確定') ||
        lower.includes('proceed') ||
        lower.includes('submit') ||
        lower.includes('next') ||
        rawInstruction.includes('▶')
      ) {
        score += this.weights.label;
      }
      if (lower.includes('booking') || lower.includes('reservation') || lower.includes('予約')) {
        score += this.weights.label;
      }
    }

    // Cancel button (#29)
    if (el.id === 29) {
      if (lower.includes('cancel') || lower.includes('取消') || lower.includes('abort')) {
        score += this.weights.label;
      }
      if (lower.includes('booking') || lower.includes('reservation') || lower.includes('予約')) {
        score += this.weights.label;
      }
    }

    // Back button (#14)
    if (el.id === 14) {
      if (
        lower.includes('back') ||
        lower.includes('戻る') ||
        lower.includes('return') ||
        rawInstruction.includes('◀')
      ) {
        score += this.weights.label;
      }
      if (
        lower.includes('condition') ||
        lower.includes('条件') ||
        lower.includes('search') ||
        lower.includes('filter')
      ) {
        score += this.weights.label;
      }
    }

    // Logout button (#11)
    if (el.id === 11) {
      if (lower.includes('logout') || lower.includes('ログアウト') || lower.includes('sign out')) {
        score += this.weights.label * 2; // Direct high-affinity action command (30)
      }
    }

    // Promotional Insurance Banner red button (#12)
    if (el.id === 12) {
      if (lower.includes('insurance') || lower.includes('保険') || lower.includes('promo')) {
        score += this.weights.label;
      }
      if (
        lower.includes('apply') ||
        lower.includes('申し込む') ||
        lower.includes('banner') ||
        lower.includes('ad')
      ) {
        score += this.weights.label;
      }
      // Matches button where text has 赤ボタン
      if (text.includes('赤ボタン') && (lower.includes('button') || lower.includes('ボタン'))) {
        score += this.weights.label;
      }
    }

    // Insurance Checkbox (#28)
    if (el.id === 28) {
      if (lower.includes('insurance') || lower.includes('保険')) {
        score += this.weights.label;
      }
      if (lower.includes('checkbox') || lower.includes('check') || lower.includes('box')) {
        score += this.weights.label;
      }
    }

    // Seat elements (#21 - #25)
    if (el.id >= 21 && el.id <= 25) {
      // Train names: Hikari vs Nozomi
      if (lower.includes('hikari') || lower.includes('ひかり')) {
        if (el.id === 21 || el.id === 22) score += this.weights.label;
      }
      if (lower.includes('nozomi') || lower.includes('のぞみ')) {
        if (el.id === 23 || el.id === 24 || el.id === 25) score += this.weights.label;
      }

      // Seat class: green vs unreserved vs reserved
      const hasUnreserved =
        lower.includes('unreserved') ||
        lower.includes('non-reserved') ||
        lower.includes('free') ||
        lower.includes('自由');
      const hasReserved = !hasUnreserved && (lower.includes('reserved') || lower.includes('指定'));

      if (hasUnreserved && (el.id === 21 || el.id === 23)) {
        score += this.weights.label;
      }
      if (hasReserved && (el.id === 22 || el.id === 24)) {
        score += this.weights.label;
      }
      if (
        el.id === 25 &&
        (lower.includes('green') ||
          lower.includes('グリーン') ||
          lower.includes('clover') ||
          rawInstruction.includes('🍀') ||
          lower.includes('特割'))
      ) {
        score += this.weights.label;
      }

      // Generic seat/car keyword
      if (lower.includes('seat') || lower.includes('席') || lower.includes('car')) {
        score += this.weights.label;
      }
    }

    return score;
  }

  /**
   * Constructs the concrete AgentAction with exact center coordinates and thought note.
   */
  private buildAction(el: SoMElement, microState: ShinkansenMicroState): AgentAction {
    const center = getBoxCenter(el.boundingBox);
    const targetCoordinate: AgentCoordinate = {
      x: Math.round(center.x),
      y: Math.round(center.y),
    };

    const thought = this.generateFieldNote(el, microState);

    return {
      action: el.actionType || 'CLICK',
      targetId: el.somId,
      gridRef: el.gridRef,
      targetCoordinate,
      isTrap: Boolean(el.isTrap),
      thought,
    };
  }

  /**
   * Formats concise, informative field notes strictly under 80 characters.
   */
  private generateFieldNote(el: SoMElement, microState: ShinkansenMicroState): string {
    switch (el.id) {
      case 25:
        return '📌 FIELD NOTE: Clicked [🍀 ◯ ¥13,870] at D3'; // 44 chars
      case 30:
        return '📌 FIELD NOTE: Clicked [予約内容を確認・確定へ ▶] at D4'; // 51 chars
      case 12:
        return '📌 FIELD NOTE: Clicked [今すぐ申し込む] at D1'; // 42 chars
      case 28:
        return microState.insuranceCheckboxChecked
          ? '📌 FIELD NOTE: Unchecked [旅行キャンセル保険を追加] at B4' // 53 chars
          : '📌 FIELD NOTE: Checked [旅行キャンセル保険を追加] at B4'; // 51 chars
      case 14:
        return '📌 FIELD NOTE: Clicked [◀ 条件変更へ戻る] at A2'; // 46 chars
      case 21:
        return '📌 FIELD NOTE: Clicked [◯ ¥13,870 (ひかり自由席)] at B2'; // 51 chars
      case 22:
        return '📌 FIELD NOTE: Clicked [△ ¥14,520 (ひかり指定席)] at C2'; // 51 chars
      case 23:
        return '📌 FIELD NOTE: Clicked [◯ ¥13,870 (のぞみ自由席)] at B3'; // 51 chars
      case 24:
        return '📌 FIELD NOTE: Clicked [◯ ¥14,720 (のぞみ指定席)] at C3'; // 51 chars
      case 29:
        return '📌 FIELD NOTE: Clicked [予約を取消] at C4'; // 41 chars
      case 11:
        return '📌 FIELD NOTE: Clicked [ログアウト] at D1'; // 40 chars
      default:
        return `📌 FIELD NOTE: Clicked ${el.somId} at ${el.gridRef}`;
    }
  }
}
