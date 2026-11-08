import type { ElementDef, PageDef } from '../../types/puzzle_data';

export interface SyntheticIdFilterResult {
  isBlocked: boolean;
  filteredInstruction: string;
  reason?: string;
  flaggedId?: number;
}

export function preprocessInstructionForGuardrails(instruction: string): string {
  // 1. Strip zero-width and invisible control characters prior to URI decoding
  let preprocessed = (instruction || '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Safe URI percent-decoding to resolve %2325, mark%2025, %32%35, etc.
  try {
    preprocessed = decodeURIComponent(preprocessed);
  } catch {
    preprocessed = preprocessed.replace(/%([0-9a-fA-F]{2})/g, (match, hex) => {
      try {
        return decodeURIComponent(`%${hex}`);
      } catch {
        return match;
      }
    });
  }

  // 3. Strip zero-width characters again in case URI decode unpacked any percent-encoded zero-width characters (%E2%80%8B)
  preprocessed = preprocessed.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 4. Normalize Unicode forms (NFKC: fullwidth ＃２５ -> #25, circled ㉕ -> 25)
  // and collapse comma-separated digits (e.g. 14,520 -> 14520)
  return preprocessed.normalize('NFKC').replace(/(?<=\d),(?=\d)/g, '');
}

export function buildDefaultVisibleTextForPage(page?: PageDef): string {
  if (!page) return '';
  const parts: string[] = [page.title];
  for (const el of page.elements) {
    parts.push(el.label);
    if (el.aliases) {
      for (const a of el.aliases) {
        if (/\d/.test(a)) parts.push(a);
      }
    }
  }
  if (page.id === 'MV-01') {
    parts.push('01 02 03 04 1 2 3 4');
  } else if (page.id === 'MV-03') {
    parts.push('515 14:12 24 14:30');
  }
  return parts.join(' ');
}

export function extractDigitRuns(text: string): Set<string> {
  const cleaned = (text || '').normalize('NFKC').replace(/(?<=\d),(?=\d)/g, '');
  const runs = cleaned.match(/\d+/g) ?? [];
  const result = new Set<string>();
  for (const r of runs) {
    result.add(r);
    const asNum = Number.parseInt(r, 10);
    if (Number.isFinite(asNum)) {
      result.add(String(asNum));
    }
  }
  return result;
}

export function filterPromptSyntheticIds(
  instruction: string,
  visibleElements: readonly unknown[] = [],
  visibleText?: string
): SyntheticIdFilterResult {
  const normalizedInstruction = preprocessInstructionForGuardrails(instruction);

  // 1. Explicit mark-ID syntax: /#\s*\d+/ or /\b(?:id|mark|badge|tag|som)\s*#?\s*\d+/i
  const explicitMatch =
    /#\s*(\d+)/.exec(normalizedInstruction) ||
    /\b(?:id|mark|badge|tag|som)[-_\s]*#?\s*(\d+)/i.exec(normalizedInstruction);

  if (explicitMatch) {
    const candidateId = Number.parseInt(explicitMatch[1], 10);
    return {
      isBlocked: true,
      flaggedId: candidateId,
      filteredInstruction: normalizedInstruction.replace(explicitMatch[0], '[FILTERED_ID]'),
      reason: `Prompt explicitly references synthetic mark ID #${candidateId} which is not visible on screen.`,
    };
  }

  // 2. Bare number N that equals a mark on the current page while N is not among the digit runs of visibleText (commas removed)
  const pageMarks = new Set<number>();
  const fallbackVisibleParts: string[] = [];

  for (const item of visibleElements) {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const m = typeof rec.mark === 'number' ? rec.mark : typeof rec.id === 'number' ? rec.id : null;
      if (m !== null && rec.key !== 'page_title' && rec.somId !== 'page_title') {
        pageMarks.add(m);
      }
      if (typeof rec.label === 'string') fallbackVisibleParts.push(rec.label);
      if (typeof rec.text === 'string') fallbackVisibleParts.push(rec.text);
      if (Array.isArray(rec.aliases)) {
        for (const a of rec.aliases) {
          if (typeof a === 'string' && /\d/.test(a)) fallbackVisibleParts.push(a);
        }
      }
      if (rec.id === 21 || rec.mark === 21 || rec.id === 23 || rec.mark === 23) {
        fallbackVisibleParts.push('515 14:12 24 14:30');
      }
      if (rec.id === 1 || rec.mark === 1) {
        fallbackVisibleParts.push('01 02 03 04 1 2 3 4');
      }
    }
  }

  if (pageMarks.size > 0) {
    const effectiveVisibleText =
      visibleText && visibleText.trim().length > 0
        ? visibleText
        : fallbackVisibleParts.join(' ');
    const visibleDigits = extractDigitRuns(effectiveVisibleText);

    const numberMatches = normalizedInstruction.matchAll(/\b(\d+)\b/g);
    for (const match of numberMatches) {
      const rawNum = match[1];
      const numVal = Number.parseInt(rawNum, 10);
      const matchIdx = match.index ?? 0;
      const prefix = normalizedInstruction.slice(0, matchIdx);
      // Do not treat structural qualifiers like "row 1", "row 2", "column 3", "card 1", "route 1", "menu 4" as bare mark IDs
      if (/\b(?:row|col|column|card|route|menu|step|page)\s*$/i.test(prefix)) {
        continue;
      }
      if (
        pageMarks.has(numVal) &&
        !visibleDigits.has(String(numVal)) &&
        !visibleDigits.has(rawNum)
      ) {
        return {
          isBlocked: true,
          flaggedId: numVal,
          filteredInstruction: normalizedInstruction.replace(rawNum, '[FILTERED_ID]'),
          reason: `Prompt references ungrounded mark number ${numVal} which is not visible on screen.`,
        };
      }
    }
  }

  return {
    isBlocked: false,
    filteredInstruction: instruction,
  };
}

export function sanitizeDomForClient(html: string): string {
  if (!html) return '';
  return html
    .replace(/\s+(?:data-som-id|som-id|data-element-id)\s*=\s*(?:["'][^"']*["']|[^\s"'=<>`]+)/gi, '')
    .replace(/\s+(?:data-target|data-is-trap)\s*=\s*(?:["'][^"']*["']|[^\s"'=<>`]+)/gi, '')
    .replace(/<!--[\s\S]*?(?:som|mark|#\d+)[\s\S]*?-->/gi, '')
    .replace(/<span\s+[^>]*class=["'][^"']*som-badge[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
}

export function assertGoalBlindness(payload: unknown): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbiddenPatterns = [
    'exhibit_a',
    'exhibit_b',
    'exhibit_c',
    'exhibit_d',
    'exhibit_e',
    'winningpath',
    'targetwaypoint',
    'istarget":true',
    'istrap":true',
    'rubberstamp',
    'answerkey',
  ];
  for (const pattern of forbiddenPatterns) {
    if (serialized.includes(pattern)) {
      throw new Error(`Security Guardrail Violation: Goal leakage detected in prompt (${pattern})`);
    }
  }
}

export function isElementBareMarkBlocked(
  instruction: string,
  pageElements: readonly ElementDef[],
  visibleText: string
): boolean {
  return filterPromptSyntheticIds(instruction, pageElements, visibleText).isBlocked;
}
