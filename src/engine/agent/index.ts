import type { PuzzleData, PuzzleState } from '../../types/puzzle_data';
import type { GeneratedManifest } from '../../data/puzzles/case_001';
import type { AgentAction } from '../../types/engine';
import {
  extractSignatureDrawingSpec,
  isMetaPrompt,
  NOOP_MARK_ID_THOUGHT,
  NOOP_META_PROMPT_THOUGHT,
  NOOP_NO_SIGNAL_THOUGHT,
  normalizeInstruction,
  validateInstruction,
} from '../../utils/text_normalizer';
import {
  buildDefaultVisibleTextForPage,
  filterPromptSyntheticIds,
} from './guardrails';
import * as fallbackModule from './fallback';
import type { AgentDecision } from './fallback';

export type { AgentDecision, FallbackResolveContext } from './fallback';
export { fallbackResolve, scoreElementOnPage } from './fallback';
export { COLOR_DICTIONARY, GLYPH_DICTIONARY } from './dictionaries';
export {
  assertGoalBlindness,
  buildDefaultVisibleTextForPage,
  extractDigitRuns,
  filterPromptSyntheticIds,
  isElementBareMarkBlocked,
  preprocessInstructionForGuardrails,
  sanitizeDomForClient,
} from './guardrails';
export type { SyntheticIdFilterResult } from './guardrails';

export interface ResolveLineContext {
  puzzle: PuzzleData;
  manifest: GeneratedManifest;
  state: PuzzleState;
  instruction: string;
  visibleText?: string;
  disablePinned?: boolean;
  cloudResolver?: () => Promise<AgentDecision | null>;
}

export async function resolveLine(ctx: ResolveLineContext): Promise<AgentDecision> {
  const { puzzle, manifest, state, instruction, visibleText, disablePinned } = ctx;
  const page = puzzle.pages.find((p) => p.id === state.pageId);

  // 1. Validation
  const validation = validateInstruction(instruction);
  if (!validation.valid) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'guardrail',
    };
  }

  // 2. Guardrails
  if (isMetaPrompt(instruction)) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_META_PROMPT_THOUGHT,
      tier: 'guardrail',
    };
  }

  const effectiveVisibleText =
    visibleText && visibleText.trim().length > 0
      ? visibleText
      : buildDefaultVisibleTextForPage(page);

  const markCheck = filterPromptSyntheticIds(
    instruction,
    page?.elements ?? [],
    effectiveVisibleText
  );
  if (markCheck.isBlocked) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_MARK_ID_THOUGHT,
      tier: 'guardrail',
    };
  }

  if (!page) {
    return {
      action: 'NOOP',
      pageId: state.pageId,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'guardrail',
    };
  }

  // 3. Pinned — answerKey[i] pairs with replay[i]
  if (!disablePinned) {
    const normInst = normalizeInstruction(instruction);
    const pairCount = Math.min(puzzle.answerKey.length, puzzle.replay.length);
    for (let i = 0; i < pairCount; i++) {
      const step = puzzle.replay[i];
      if (
        state.pageId === step.pageId &&
        normalizeInstruction(puzzle.answerKey[i]) === normInst
      ) {
        const el = page.elements.find((e) => e.key === step.key);
        let thought = el?.thought || `💭 Clicking the ${el?.label ?? step.key} — fingers crossed!`;
        if (step.action === 'TYPE') {
          thought = `💭 Typing "${step.text ?? ''}" one key at a time.`;
        } else if (step.action === 'DRAW') {
          thought = el?.thought || extractSignatureDrawingSpec(instruction).thought;
        }
        return {
          action: step.action,
          pageId: step.pageId,
          mark: el?.mark ?? null,
          text: step.text,
          stroke: step.stroke,
          thought,
          tier: 'pinned',
        };
      }
    }
  }

  // 4. Cloud — item 11 (or injected cloudResolver)
  let cloudFailed = false;
  if (ctx.cloudResolver) {
    try {
      const cloudDecision = await ctx.cloudResolver();
      if (cloudDecision) {
        return cloudDecision;
      }
      cloudFailed = true;
    } catch {
      cloudFailed = true;
    }
  }

  // 5. Fallback
  const fallbackDecision = fallbackModule.fallbackResolve({
    pages: puzzle.pages,
    manifest,
    state,
    instruction,
  });
  return cloudFailed ? { ...fallbackDecision, cloudFailed: true } : fallbackDecision;
}

export function decisionToAgentAction(
  decision: AgentDecision,
  puzzle: PuzzleData,
  manifest: GeneratedManifest
): AgentAction {
  const page = puzzle.pages.find((p) => p.id === decision.pageId);
  const el =
    decision.mark !== null
      ? page?.elements.find((e) => e.mark === decision.mark)
      : undefined;
  const pageManifest = manifest.pages?.[decision.pageId];
  const mEntry =
    decision.mark !== null
      ? pageManifest?.elements.find((m) => m.mark === decision.mark)
      : pageManifest?.elements.find((m) => m.key === 'page_title');

  const targetCoordinate = mEntry
    ? {
        x: Math.round(mEntry.box.x + mEntry.box.w / 2),
        y: Math.round(mEntry.box.y + mEntry.box.h / 2),
      }
    : { x: 512, y: 150 };

  const isTrap = Boolean(
    el?.effects[decision.action as 'CLICK']?.some((eff) => eff.op === 'shake') ||
      el?.key === 'promo_insurance' ||
      el?.key === 'insurance_checkbox'
  );

  return {
    action: decision.action,
    targetId: decision.mark !== null ? `#${decision.mark}` : undefined,
    targetCoordinate,
    textValue: decision.text ?? decision.stroke,
    thought: decision.thought,
    isTrap,
    cloudFailed: decision.cloudFailed,
  };
}
