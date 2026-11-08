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
} from '../types/engine';
import { SoMElement, MacroView } from '../types/puzzle';
import { CASE_001_MACRO_VIEWS } from '../data/puzzles/case_001';
import { parseGridCoordinate, getBoxCenter, gridToCenter } from '../utils/coordinate_projector';
import {
  normalizeInstruction,
  extractSignatureDrawingSpec,
  extractTypedText,
  isMetaPrompt,
  NOOP_NO_SIGNAL_THOUGHT,
  NOOP_META_PROMPT_THOUGHT,
  NOOP_MARK_ID_THOUGHT,
} from '../utils/text_normalizer';
import { filterPromptSyntheticIds } from './cloud_connector';

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
    customMacroViews: MacroView[] = CASE_001_MACRO_VIEWS,
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
    microState: Record<string, unknown>,
    instruction: string
  ): AgentAction {
    const rawTrimmed = (instruction || '').trim();
    if (!rawTrimmed) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    if (rawTrimmed.length > 60 || (instruction && instruction.length > 60)) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    if (isMetaPrompt(rawTrimmed)) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_META_PROMPT_THOUGHT,
      };
    }

    if (filterPromptSyntheticIds(rawTrimmed).isBlocked) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_MARK_ID_THOUGHT,
      };
    }

    const macroView = this.macroViews.get(macroViewId);
    if (!macroView) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    const lower = rawTrimmed.toLowerCase();

    // Multi-modal Action 1: TYPE into Passenger Name field (#17)
    if (
      (macroViewId === 'MV-02' &&
        (/\b(?:type|enter|input|put|fill\s+in|fill|write|name|passenger|passengers|romaji|box|field|textbox|搭乗者)\b/i.test(
          lower
        ) ||
          /["'“”‘’]/.test(rawTrimmed))) ||
      (macroViewId !== 'MV-04' &&
        /\b(?:type|enter|input|put|fill\s+in|fill|write)\b/i.test(lower) &&
        /\b(?:name|passenger|passengers|romaji|box|field|textbox|搭乗者)\b/i.test(lower))
    ) {
      const typedValue = extractTypedText(rawTrimmed);
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
      (/\b(?:draw|sign|signature|signiture|autograph|scribble|smile|smiley|frown|heart|star|circle|署名|サイン)\b/i.test(
        lower
      ) ||
        (macroViewId === 'MV-04' &&
          !/\b(?:blue|confirm|submit|proceed|cancel|red|back|bottom\s*right)\b/i.test(lower) &&
          /\b(?:line|pad|dashed\s*box|squiggle|squiggly|sqiggly|triangle|square|cat|house|stick|fish|flower|check|cross|zigzag|spiral)\b/i.test(
            lower
          )))
    ) {
      const sigSpec = extractSignatureDrawingSpec(rawTrimmed);
      return {
        action: 'DRAW',
        targetId: '#27',
        gridRef: 'C4',
        targetCoordinate: { x: 490, y: 716 },
        textValue: sigSpec.strokeValue,
        thought: '📌 FIELD NOTE: Signed [自署・サイン欄] at C4',
      };
    }

    // Multi-page Action 3: Route Selection on Page 01 (MV-01) or explicit route keywords
    if (macroViewId === 'MV-01') {
      if (/\b(?:red|promo|insurance|2,?400)\b/i.test(lower)) {
        return {
          action: 'CLICK',
          targetId: '#12',
          gridRef: 'D1',
          targetCoordinate: { x: 900, y: 112 },
          isTrap: true,
          thought: '⚠️ TRAP TRIGGERED: Clicked red ¥2,400 promo insurance banner!',
        };
      }
      if (/\b(?:news|notice|お知らせ|logout|sign\s*out)\b/i.test(lower)) {
        return {
          action: 'CLICK',
          targetId: '#11',
          gridRef: 'D1',
          targetCoordinate: { x: 960, y: 58 },
          isTrap: true,
          thought: '⚠️ TRAP TRIGGERED: Clicked News button!',
        };
      }
      if (
        /\b(?:tohoku|hayabusa|sendai|aomori|hokkaido|top\s*right|second\s*(?:card|box|route|option)|route\s*0?2|page\s*10)\b/i.test(
          lower
        ) ||
        lower.includes('東北')
      ) {
        return {
          action: 'CLICK',
          targetId: '#2',
          gridRef: 'C2',
          targetCoordinate: { x: 750, y: 290 },
          isTrap: true,
          thought: '⚠️ FIELD NOTE: Clicked [東北・北海道新幹線] (Wrong Route MV-10)',
        };
      }
      if (
        /\b(?:hokuriku|joetsu|kanazawa|niigata|bottom\s*left|third\s*(?:card|box|route|option)|route\s*0?3|page\s*11)\b/i.test(
          lower
        ) ||
        lower.includes('北陸')
      ) {
        return {
          action: 'CLICK',
          targetId: '#3',
          gridRef: 'B3',
          targetCoordinate: { x: 265, y: 520 },
          isTrap: true,
          thought: '⚠️ FIELD NOTE: Clicked [北陸・上越新幹線] (Wrong Route MV-11)',
        };
      }
      if (
        /\b(?:point|jre|suica|ic\s*card|bottom\s*right|fourth\s*(?:card|box|route|option)|menu\s*0?4|page\s*12)\b/i.test(
          lower
        )
      ) {
        return {
          action: 'CLICK',
          targetId: '#4',
          gridRef: 'C3',
          targetCoordinate: { x: 750, y: 520 },
          isTrap: true,
          thought: '⚠️ FIELD NOTE: Clicked [かんじおんポイント・ICカード連携] (Wrong Portal MV-12)',
        };
      }
      if (
        /\b(?:tokaido|tokyo|osaka|shin-?osaka|nozomi|top\s*left|first\s*(?:card|box|route|option|green)|green\s*(?:card|box|route|button)|left\s*green|route\s*0?1)\b/i.test(
          lower
        ) ||
        lower.includes('東海道') ||
        lower.includes('新大阪')
      ) {
        return {
          action: 'CLICK',
          targetId: '#1',
          gridRef: 'B1',
          targetCoordinate: { x: 340, y: 42 },
          thought: '📌 FIELD NOTE: Clicked [東海道新幹線 東京⇒新大阪] at B1',
        };
      }
    }

    if (/\b(?:tokaido|tokyo\s*(?:to|->|⇒)\s*(?:shin-?)?osaka|shin-?osaka\s*route|東海道)\b/i.test(lower)) {
      return {
        action: 'CLICK',
        targetId: '#1',
        gridRef: 'B1',
        targetCoordinate: { x: 340, y: 42 },
        thought: '📌 FIELD NOTE: Clicked [東海道新幹線 東京⇒新大阪] at B1',
      };
    }

    // MV-07 Cancel Confirmation Modal (#71 confirm, #72 dismiss)
    if (macroViewId === 'MV-07') {
      if (/\b(?:back|return|dismiss|keep|no|gray|grey)\b/i.test(lower) || lower.includes('戻る')) {
        return {
          action: 'CLICK',
          targetId: '#72',
          gridRef: 'B3',
          targetCoordinate: { x: 460, y: 420 },
          thought: '📌 FIELD NOTE: Clicked [戻る]',
        };
      }
      if (/\b(?:cancel|confirm|yes|red|abort)\b/i.test(lower) || lower.includes('取り消す')) {
        return {
          action: 'CLICK',
          targetId: '#71',
          gridRef: 'C3',
          targetCoordinate: { x: 560, y: 420 },
          thought: '📌 FIELD NOTE: Clicked [取り消す]',
        };
      }
    }

    // MV-08 News Page (#81 back)
    if (macroViewId === 'MV-08') {
      if (/\b(?:back|return|previous)\b/i.test(lower) || lower.includes('戻る') || rawTrimmed.includes('◀')) {
        return {
          action: 'CLICK',
          targetId: '#81',
          gridRef: 'A2',
          targetCoordinate: { x: 100, y: 170 },
          thought: '📌 FIELD NOTE: Clicked [◀ 戻る]',
        };
      }
    }

    // Back button (#14) across multi-page views (MV-02, MV-04, MV-10, MV-11, MV-12)
    if (
      macroViewId !== 'MV-03' &&
      (/\b(?:back|return|previous|路線選択|条件変更|座席表)\b/i.test(lower) || lower.includes('戻る'))
    ) {
      return {
        action: 'CLICK',
        targetId: '#14',
        gridRef: 'A2',
        targetCoordinate: { x: 128, y: 244 },
        thought: '📌 FIELD NOTE: Clicked [◀ 条件変更へ戻る] at A2',
      };
    }

    // Confirm button (#30) or Cancel (#29) or Insurance (#28) on MV-04
    if (macroViewId === 'MV-04') {
      if (/\b(?:blue|confirm|submit|proceed|issue|final|bottom\s*right|確定)\b/i.test(lower) || lower.includes('▶')) {
        return {
          action: 'CLICK',
          targetId: '#30',
          gridRef: 'D4',
          targetCoordinate: { x: 905, y: 720 },
          thought: '📌 FIELD NOTE: Clicked [予約内容を確認・確定へ ▶] at D4',
        };
      }
      if (/\b(?:cancel|取消)\b/i.test(lower)) {
        return {
          action: 'CLICK',
          targetId: '#29',
          gridRef: 'C4',
          targetCoordinate: { x: 706, y: 720 },
          thought: '📌 FIELD NOTE: Clicked [予約を取消] at C4',
        };
      }
    }

    if (!macroView.elements || macroView.elements.length === 0) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    const scores = this.scoreElements(macroView.elements, instruction, microState);
    if (scores.length === 0) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    // Sort descending by total score
    scores.sort((a, b) => b.totalScore - a.totalScore);
    const top = scores[0];

    // Check confidence threshold
    if (top.totalScore < this.confidenceThreshold) {
      return {
        action: 'NOOP',
        targetCoordinate: { x: 512, y: 150 },
        thought: NOOP_NO_SIGNAL_THOUGHT,
      };
    }

    // Check ambiguity tie (top 2 elements have identical score >= threshold)
    if (scores.length > 1) {
      const runnerUp = scores[1];
      if (top.totalScore === runnerUp.totalScore && top.totalScore >= this.confidenceThreshold) {
        return {
          action: 'NOOP',
          targetCoordinate: { x: 512, y: 150 },
          thought: NOOP_NO_SIGNAL_THOUGHT,
        };
      }
    }

    return this.buildAction(top.element, microState, instruction);
  }

  /**
   * Evaluates and scores all interactive elements in the macro-view against the instruction.
   */
  public scoreElements(
    elements: SoMElement[],
    rawInstruction: string,
    _microState: Record<string, unknown>
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
        return (box ? box.y < 192 : false) || el.gridRef.endsWith('1');
      case 'bottom':
      case 'row 4':
        return (box ? box.y > 576 : false) || el.gridRef.endsWith('4');
      case 'left':
      case 'sidebar':
        return (box ? box.x < 512 : false) || el.gridRef.startsWith('A') || el.gridRef.startsWith('B');
      case 'right':
        return (box ? box.x > 512 : false) || el.gridRef.startsWith('C') || el.gridRef.startsWith('D');
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

    // Logout / News button (#11)
    if (el.id === 11) {
      if (
        lower.includes('news') ||
        lower.includes('notice') ||
        lower.includes('お知らせ') ||
        lower.includes('logout') ||
        lower.includes('sign out')
      ) {
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
      if (
        (lower.includes('red') || lower.includes('赤')) &&
        (lower.includes('button') || lower.includes('ボタン'))
      ) {
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
  private buildAction(
    el: SoMElement,
    microState: Record<string, unknown>,
    rawInstruction?: string
  ): AgentAction {
    const center = el.boundingBox ? getBoxCenter(el.boundingBox) : gridToCenter(el.gridRef);
    const targetCoordinate: AgentCoordinate = {
      x: Math.round(center.x),
      y: Math.round(center.y),
    };

    const thought = this.generateFieldNote(el, microState);
    const isTimed = rawInstruction
      ? /\b(?:wait|when|until|timed|timing|flash|sale|glow|highlight|lights\s*up)\b/i.test(
          rawInstruction
        )
      : false;
    const actionKind =
      el.id === 25 ? (isTimed ? 'TIMED_CLICK' : 'CLICK') : el.actionType || 'CLICK';

    return {
      action: actionKind,
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
  private generateFieldNote(el: SoMElement, microState: Record<string, unknown>): string {
    switch (el.id) {
      case 25:
        return '📌 FIELD NOTE: Clicked [🍀 ◯ ¥13,870] at D3'; // 44 chars
      case 30:
        return '📌 FIELD NOTE: Clicked [予約内容を確認・確定へ ▶] at D4'; // 51 chars
      case 12:
        return '📌 FIELD NOTE: Clicked [今すぐ申し込む] at D1'; // 42 chars
      case 28:
        return microState.insuranceAttached || microState.insuranceCheckboxChecked
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
        return '📌 FIELD NOTE: Clicked [お知らせ] at D1'; // 39 chars
      default:
        return `📌 FIELD NOTE: Clicked ${el.somId} at ${el.gridRef}`;
    }
  }
}
