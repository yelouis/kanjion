/**
 * src/engine/cloud_connector.ts
 *
 * Cloud Vision LLM Integration Connector for Instruct:
 * - Implements AgentExecutionConnector interface.
 * - Formats Set-of-Mark macro-view images paired with micro-state JSON.
 * - Enforces JSON Schema-constrained output validation (CLICK, TYPE, SCROLL, CONFUSED).
 * - Instruction normalization and edge key-value cache lookup (puzzle_id, state_hash, normalized_instruction).
 * - Enforces Security Guardrails:
 *   1. Goal blindness (prompts strictly blind to target replay and winning checklist).
 *   2. Client DOM sanitization (strips Set-of-Mark numeric IDs from DOM).
 *   3. Prompt filtering (filters raw numeric IDs from user prompts unless visibly rendered in label).
 * - Pluggable mock / HTTP transport with automatic fallback to offline simulator.
 */

import {
  AgentAction,
  AgentActionType,
  AgentExecutionConnector,
  ShinkansenMicroState,
  GridCoordinate,
  LLMDecisionRequest,
  LLMDecisionResponse,
} from '../types/engine';
import { MacroView, SoMElement } from '../types/puzzle';
import { getBoxCenter } from '../utils/coordinate_projector';
import {
  validateInstruction,
  generateStateHash,
  generateCacheKey,
} from '../utils/text_normalizer';

// =========================================================================
// 1. JSON SCHEMA CONTRACT
// =========================================================================

export const AGENT_ACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['CLICK', 'TYPE', 'SCROLL', 'CONFUSED'],
    },
    target_id: {
      type: ['integer', 'null'],
      description: 'The numeric ID of the Set-of-Mark badge targeted. Null if CONFUSED.',
    },
    text_value: {
      type: ['string', 'null'],
      description: 'Value to type if action is TYPE, otherwise null.',
    },
    scroll_direction: {
      type: ['string', 'null'],
      enum: ['up', 'down', null],
    },
    thought: {
      type: 'string',
      maxLength: 80,
      description: 'Brief explanation under 80 characters shown on cursor thought note.',
    },
  },
  required: ['action', 'target_id', 'thought'],
  additionalProperties: false,
} as const;

// =========================================================================
// 2. SECURITY GUARDRAILS
// =========================================================================

/**
 * Guardrail 1: Goal Blindness Sanitizer
 * Strips all winning path indicators, target flags, exhibits, and replay trajectories.
 */
export function sanitizeMicroStateForLLM(microState: ShinkansenMicroState): Record<string, unknown> {
  return {
    macroViewId: microState.macroViewId,
    activeModal: microState.activeModal ?? 'none',
    selectedRoute: microState.selectedRoute,
    departureTime: microState.departureTime,
    trainName: microState.trainName,
    seatClass: microState.seatClass,
    fare: microState.fare,
    greenCarSelected: microState.greenCarSelected,
    insuranceCheckboxChecked: microState.insuranceCheckboxChecked,
  };
}

export function sanitizeVisibleMarks(
  elements: SoMElement[]
): Array<{ id: number; somId: string; region: GridCoordinate; desc: string }> {
  return elements.map((el) => ({
    id: el.id,
    somId: el.somId,
    region: el.gridRef,
    desc: el.visualAttributes?.description || el.text,
    // Note: el.isTarget and el.isTrap are STRICTLY omitted!
  }));
}

/**
 * Asserts that a prompt payload does not contain any goal leakage or winning checklist items.
 */
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
  ];
  for (const pattern of forbiddenPatterns) {
    if (serialized.includes(pattern)) {
      throw new Error(`Security Guardrail Violation: Goal leakage detected in prompt (${pattern})`);
    }
  }
}

/**
 * Guardrail 2: Client DOM Sanitization
 * Strips Set-of-Mark numeric IDs and internal markers from HTML/JSX strings.
 */
export function sanitizeDomForClient(html: string): string {
  if (!html) return '';
  return html
    .replace(/\s+(?:data-som-id|som-id|data-element-id)\s*=\s*(?:["'][^"']*["']|[^\s"'=<>`]+)/gi, '')
    .replace(/\s+(?:data-target|data-is-trap)\s*=\s*(?:["'][^"']*["']|[^\s"'=<>`]+)/gi, '')
    .replace(/<!--[\s\S]*?(?:som|mark|#\d+)[\s\S]*?-->/gi, '')
    .replace(/<span\s+[^>]*class=["'][^"']*som-badge[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
}

/**
 * Guardrail 3: Synthetic ID Prompt Filtering
 */
export interface SyntheticIdFilterResult {
  isBlocked: boolean;
  filteredInstruction: string;
  reason?: string;
  flaggedId?: number;
}

export function filterPromptSyntheticIds(
  instruction: string,
  visibleElements: SoMElement[]
): SyntheticIdFilterResult {
  // 1. Strip zero-width and invisible control characters prior to URI decoding
  let preprocessed = (instruction || '').replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 2. Safe URI percent-decoding to resolve %2325, mark%2025, %32%35, etc.
  try {
    preprocessed = decodeURIComponent(preprocessed);
  } catch {
    // If global decodeURIComponent throws on malformed escapes (e.g. lone % in "100% discount"),
    // decode individual valid %XX hexadecimal sequences
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
  // and collapse comma-separated digits (e.g. 14,520 -> 14520) to prevent commas
  // from splitting visible currency amounts into synthetic ID collisions
  const normalizedInstruction = preprocessed
    .normalize('NFKC')
    .replace(/(?<=\d),(?=\d)/g, '');

  // Aggregate all visible text from elements and visual descriptions in the active macro-view, stripped of commas
  const sanitizedVisibleText = visibleElements
    .map((e) => `${e.text} ${e.visualAttributes?.description || ''}`)
    .join(' ')
    .normalize('NFKC')
    .replace(/,/g, '');

  // 1. Explicit mark tags: #25, # 25, mark 25, badge 25, id 25
  const explicitPattern = /(?:#\s*|\b(?:mark|badge|id|tag|som)[_\s]*#?\s*)(\d+)/gi;
  let match: RegExpExecArray | null;

  while ((match = explicitPattern.exec(normalizedInstruction)) !== null) {
    const candidateId = parseInt(match[1], 10);
    const element = visibleElements.find((e) => e.id === candidateId);
    if (element) {
      const idStr = String(candidateId);
      if (!new RegExp('\\b' + idStr + '\\b').test(sanitizedVisibleText)) {
        return {
          isBlocked: true,
          flaggedId: candidateId,
          filteredInstruction: normalizedInstruction.replace(match[0], '[FILTERED_ID]'),
          reason: `Prompt explicitly references synthetic mark ID #${candidateId} which is not visible on screen.`,
        };
      }
    }
  }

  // 2. Standalone numbers matching synthetic element IDs
  const standalonePattern = /\b(\d+)\b/g;
  while ((match = standalonePattern.exec(normalizedInstruction)) !== null) {
    const candidateId = parseInt(match[1], 10);
    const element = visibleElements.find((e) => e.id === candidateId);
    if (element) {
      const idStr = String(candidateId);
      if (!new RegExp('\\b' + idStr + '\\b').test(sanitizedVisibleText)) {
        return {
          isBlocked: true,
          flaggedId: candidateId,
          filteredInstruction: normalizedInstruction.replace(new RegExp(`\\b${idStr}\\b`, 'g'), '[FILTERED_ID]'),
          reason: `Prompt targets synthetic element ID ${candidateId} without visual grounding.`,
        };
      }
    }
  }

  return {
    isBlocked: false,
    filteredInstruction: instruction,
  };
}

// =========================================================================
// 3. MULTIMODAL PROMPT GENERATION & OUTPUT VALIDATION
// =========================================================================

export interface MultimodalPromptBundle {
  systemPrompt: string;
  userPrompt: string;
  contextJson: Record<string, unknown>;
  somImageUrl: string;
}

export function buildMultimodalPrompt(
  macroView: MacroView,
  microState: ShinkansenMicroState,
  sanitizedInstruction: string
): MultimodalPromptBundle {
  const sanitizedState = sanitizeMicroStateForLLM(microState);
  const visibleMarks = sanitizeVisibleMarks(macroView.elements);

  const contextJson = {
    macroViewId: macroView.id,
    viewName: macroView.name,
    simulatedUrl: macroView.simulatedUrl,
    microState: sanitizedState,
    visibleMarks,
  };

  // Enforce Goal Blindness assertion
  assertGoalBlindness(contextJson);

  const systemPrompt = [
    'You are an autonomous web navigation agent operating on a coordinate-framed sandboxed Japanese web application.',
    'The application is rendered at 1024x768 resolution, framed by columns A-D (left-to-right) and rows 1-4 (top-to-bottom).',
    'Interactive elements on screen are tagged with numbered magenta Set-of-Mark (SoM) badges.',
    '',
    'YOUR OBJECTIVE:',
    "Execute the user's single instruction literally by identifying the corresponding interactive element on screen.",
    '',
    'RULES & CONSTRAINTS:',
    "1. You have NO knowledge of the puzzle's ultimate winning configuration or winning path. Follow ONLY the literal instruction.",
    '2. Use visual attributes (coordinates like D3, colors like green/red/blue, icons like 🍀, prices like 13870, or Japanese labels) to locate the matching mark ID.',
    '3. If the instruction is ambiguous, invalid, ungrounded, or cannot be safely mapped to a visible element, output action="CONFUSED" with target_id=null.',
    '4. Output MUST strictly adhere to the required JSON Schema. Output ONLY valid JSON, with no markdown code fences or conversational text.',
  ].join('\n');

  const userPrompt = [
    `USER INSTRUCTION: "${sanitizedInstruction}"`,
    '',
    'SCREEN CONTEXT:',
    JSON.stringify(contextJson, null, 2),
    '',
    'Identify the target mark ID and return the structured action JSON.',
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
    contextJson,
    somImageUrl: macroView.somImagePath || `/som/${macroView.id.toLowerCase()}.webp`,
  };
}

export function validateLLMOutput(rawResponse: unknown): LLMDecisionResponse {
  let parsed: unknown = rawResponse;

  if (typeof rawResponse === 'string') {
    let clean = rawResponse.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
      parsed = JSON.parse(clean);
    } catch {
      return {
        action: 'CONFUSED',
        target_id: null,
        text_value: null,
        scroll_direction: null,
        thought: '📌 FIELD NOTE: Agent output could not be parsed as valid JSON.',
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      action: 'CONFUSED',
      target_id: null,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Agent returned non-object response.',
    };
  }

  const obj = parsed as Record<string, unknown>;

  const validActions: AgentActionType[] = [
    'CLICK',
    'TYPE',
    'DRAW',
    'TIMED_CLICK',
    'SCROLL',
    'CONFUSED',
  ];
  const action: AgentActionType =
    typeof obj.action === 'string' && validActions.includes(obj.action as AgentActionType)
      ? (obj.action as AgentActionType)
      : 'CONFUSED';

  let targetId: number | null = null;
  if (typeof obj.target_id === 'number' && Number.isInteger(obj.target_id)) {
    targetId = obj.target_id;
  } else if (typeof obj.target_id === 'string' && /^\d+$/.test(obj.target_id)) {
    targetId = parseInt(obj.target_id, 10);
  }

  let thought =
    typeof obj.thought === 'string' && obj.thought.trim().length > 0
      ? obj.thought.trim()
      : action === 'CONFUSED'
      ? '📌 FIELD NOTE: Instruction unclear. Target could not be identified.'
      : `Executing ${action}`;

  if (thought.length > 80) {
    thought = thought.slice(0, 77) + '...';
  }

  const textValue = typeof obj.text_value === 'string' ? obj.text_value : null;
  const scrollDir =
    obj.scroll_direction === 'up' || obj.scroll_direction === 'down'
      ? (obj.scroll_direction as 'up' | 'down')
      : null;

  return {
    action,
    target_id: action === 'CONFUSED' ? null : targetId,
    text_value: textValue,
    scroll_direction: scrollDir,
    thought,
  };
}

// =========================================================================
// 4. EDGE KEY-VALUE CACHE
// =========================================================================

export interface EdgeKVCache {
  get(key: string): Promise<LLMDecisionResponse | null> | (LLMDecisionResponse | null);
  set(key: string, value: LLMDecisionResponse, ttlSeconds?: number): Promise<void> | void;
  has(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
  size(): number;
}

export class MemoryKVCache implements EdgeKVCache {
  private cache = new Map<string, { value: LLMDecisionResponse; expiresAt?: number }>();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get(key: string): LLMDecisionResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: LLMDecisionResponse, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// =========================================================================
// 5. PLUGGABLE TRANSPORTS (MOCK & HTTP)
// =========================================================================

export interface VisionLLMTransport {
  requestDecision(request: LLMDecisionRequest): Promise<LLMDecisionResponse>;
}

export interface MockVisionLLMTransportConfig {
  cannedResponses?: Record<string, LLMDecisionResponse>;
  defaultResponse?: LLMDecisionResponse;
  delayMs?: number;
  simulateError?: boolean;
  errorMessage?: string;
}

export class MockVisionLLMTransport implements VisionLLMTransport {
  private cannedResponses: Map<string, LLMDecisionResponse>;
  private defaultResponse: LLMDecisionResponse;
  private delayMs: number;
  private simulateError: boolean;
  private errorMessage: string;
  public recordedRequests: LLMDecisionRequest[] = [];

  constructor(config: MockVisionLLMTransportConfig = {}) {
    this.cannedResponses = new Map(Object.entries(config.cannedResponses || {}));
    this.defaultResponse = config.defaultResponse || {
      action: 'CONFUSED',
      target_id: null,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Mock agent received unhandled instruction.',
    };
    this.delayMs = config.delayMs || 0;
    this.simulateError = config.simulateError || false;
    this.errorMessage = config.errorMessage || 'Simulated vision LLM network failure';
  }

  setResponse(normalizedInstruction: string, response: LLMDecisionResponse): void {
    this.cannedResponses.set(normalizedInstruction, response);
  }

  setSimulateError(simulate: boolean, message?: string): void {
    this.simulateError = simulate;
    if (message) this.errorMessage = message;
  }

  clearRecordedRequests(): void {
    this.recordedRequests = [];
  }

  async requestDecision(request: LLMDecisionRequest): Promise<LLMDecisionResponse> {
    this.recordedRequests.push(request);

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.simulateError) {
      throw new Error(this.errorMessage);
    }

    const match = this.cannedResponses.get(request.normalizedInstruction);
    if (match) {
      return { ...match };
    }

    return { ...this.defaultResponse };
  }
}

export interface HttpVisionLLMTransportConfig {
  endpointUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  customFetch?: typeof fetch;
}

export class HttpVisionLLMTransport implements VisionLLMTransport {
  private endpointUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private maxRetries: number;
  private headers: Record<string, string>;
  private fetchFn: typeof fetch;

  constructor(config: HttpVisionLLMTransportConfig) {
    this.endpointUrl = config.endpointUrl;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 10000;
    this.maxRetries = config.maxRetries ?? 1;
    this.headers = config.headers || {};
    this.fetchFn =
      config.customFetch ||
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : globalThis.fetch);
  }

  async requestDecision(request: LLMDecisionRequest): Promise<LLMDecisionResponse> {
    let lastError: Error | null = null;
    const attempts = 1 + this.maxRetries;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const reqHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Kanjion-Client': 'kanjion-web-v1',
          ...this.headers,
        };
        if (this.apiKey) {
          reqHeaders['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const res = await this.fetchFn(this.endpointUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify({
            request,
            schema: AGENT_ACTION_JSON_SCHEMA,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        return validateLLMOutput(data);
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (controller.signal.aborted) {
          lastError = new Error(`Request timed out after ${this.timeoutMs}ms`);
        }
        if (attempt === attempts) break;
      }
    }

    throw lastError || new Error('HTTP Vision LLM Transport request failed');
  }
}

// =========================================================================
// 6. CLOUD VISION CONNECTOR IMPLEMENTATION
// =========================================================================

export interface CloudVisionConnectorConfig {
  puzzleId: string;
  macroViews: MacroView[];
  transport: VisionLLMTransport;
  cache?: EdgeKVCache;
  fallbackEngine?: AgentExecutionConnector;
  enableGuardrails?: boolean;
  somBaseUrl?: string;
  logger?: (msg: string, data?: unknown) => void;
}

export class CloudVisionConnector implements AgentExecutionConnector {
  public readonly puzzleId: string;
  private macroViews: Map<string, MacroView>;
  private transport: VisionLLMTransport;
  private cache: EdgeKVCache;
  private fallbackEngine?: AgentExecutionConnector;
  private enableGuardrails: boolean;
  private somBaseUrl: string;
  private logger?: (msg: string, data?: unknown) => void;

  constructor(config: CloudVisionConnectorConfig) {
    this.puzzleId = config.puzzleId;
    this.macroViews = new Map(config.macroViews.map((mv) => [mv.id, mv]));
    this.transport = config.transport;
    this.cache = config.cache || new MemoryKVCache();
    this.fallbackEngine = config.fallbackEngine;
    this.enableGuardrails = config.enableGuardrails !== false;
    this.somBaseUrl = config.somBaseUrl || '';
    this.logger = config.logger;
  }

  async resolveInstruction(
    macroViewId: string,
    microState: ShinkansenMicroState,
    instruction: string
  ): Promise<AgentAction> {
    // 1. Validate instruction length and non-empty constraint
    const validation = validateInstruction(instruction);
    if (!validation.valid) {
      return {
        action: 'CONFUSED',
        thought: validation.error ? `📌 FIELD NOTE: ${validation.error}` : '📌 FIELD NOTE: Invalid instruction.',
      };
    }

    const normalized = validation.normalized;
    const currentView = this.macroViews.get(macroViewId);
    if (!currentView) {
      return {
        action: 'CONFUSED',
        thought: `📌 FIELD NOTE: Macro-View ${macroViewId} not found in manifest.`,
      };
    }

    // 2. Security Guardrail 3: Prompt Filtering (Synthetic ID Injection)
    if (this.enableGuardrails) {
      const filterResult = filterPromptSyntheticIds(instruction, currentView.elements);
      if (filterResult.isBlocked) {
        this.logger?.('Guardrail blocked synthetic ID reference', filterResult);
        return {
          action: 'CONFUSED',
          thought: '📌 FIELD NOTE: Synthetic mark IDs cannot be targeted directly.',
        };
      }
    }

    // 3. Edge KV Cache Lookup
    const stateHash = generateStateHash(macroViewId, microState as unknown as Record<string, unknown>);
    const cacheKey = generateCacheKey(this.puzzleId, stateHash, normalized);

    const cachedResponse = await this.cache.get(cacheKey);
    if (cachedResponse) {
      this.logger?.(`Cache hit for key: ${cacheKey}`);
      return this.mapDecisionToAgentAction(cachedResponse, currentView);
    }

    // 4. Assemble Multimodal Prompt (Guardrail 1: Goal Blindness enforced)
    const promptBundle = buildMultimodalPrompt(currentView, microState, instruction);

    const llmRequest: LLMDecisionRequest = {
      puzzleId: this.puzzleId,
      macroViewId,
      instruction,
      normalizedInstruction: normalized,
      microState: promptBundle.contextJson.microState as ShinkansenMicroState,
      somImageUrl: `${this.somBaseUrl}${promptBundle.somImageUrl}`,
      visibleMarks: promptBundle.contextJson.visibleMarks as LLMDecisionRequest['visibleMarks'],
    };

    // 5. Query Vision LLM Transport with Fallback Recovery
    let decision: LLMDecisionResponse;
    try {
      decision = await this.transport.requestDecision(llmRequest);
    } catch (err: unknown) {
      this.logger?.('Vision LLM transport error', err);

      if (this.fallbackEngine) {
        this.logger?.('Falling back to offline simulation engine');
        const fallbackAction = await this.fallbackEngine.resolveInstruction(macroViewId, microState, instruction);
        const suffix = ' (Offline Fallback)';
        const maxBaseLength = 80 - suffix.length; // 61 characters
        let baseThought = (fallbackAction.thought || '').trim();
        if (baseThought.length > maxBaseLength) {
          baseThought = baseThought.slice(0, maxBaseLength - 3) + '...';
        }
        return {
          ...fallbackAction,
          thought: `${baseThought}${suffix}`,
        };
      }

      return {
        action: 'CONFUSED',
        thought: '📌 FIELD NOTE: Cloud vision service unavailable.',
      };
    }

    // 6. Validate and store in Edge KV Cache
    const validatedDecision = validateLLMOutput(decision);
    await this.cache.set(cacheKey, validatedDecision);

    // 7. Map to concrete AgentAction
    return this.mapDecisionToAgentAction(validatedDecision, currentView);
  }

  private mapDecisionToAgentAction(decision: LLMDecisionResponse, macroView: MacroView): AgentAction {
    if (decision.action === 'CONFUSED' || decision.target_id === null) {
      return {
        action: 'CONFUSED',
        thought: decision.thought || '📌 FIELD NOTE: Instruction unclear.',
      };
    }

    const matchedElement =
      macroView.elements.find((e) => e.id === decision.target_id) ||
      (macroView.elements.length === 0
        ? Array.from(this.macroViews.values())
            .flatMap((v) => v.elements)
            .find((e) => e.id === decision.target_id)
        : undefined);
    if (!matchedElement) {
      // Multi-page / multi-modal elements (#1 Tokaido route, #2 Tohoku route, #17 Passenger input, #27 Signature canvas)
      if (decision.target_id === 1) {
        return {
          action: 'CLICK',
          targetId: '#1',
          targetCoordinate: { x: 265, y: 290 },
          gridRef: 'B2',
          thought: decision.thought || '📌 FIELD NOTE: Clicked [東海道新幹線 東京⇒新大阪] at B2',
        };
      }
      if (decision.target_id === 2) {
        return {
          action: 'CLICK',
          targetId: '#2',
          targetCoordinate: { x: 750, y: 290 },
          gridRef: 'C2',
          thought: decision.thought || '⚠️ FIELD NOTE: Clicked [東北・北海道新幹線] (Wrong Route)',
          isTrap: true,
        };
      }
      if (decision.target_id === 3) {
        return {
          action: 'CLICK',
          targetId: '#3',
          targetCoordinate: { x: 265, y: 520 },
          gridRef: 'B3',
          thought: decision.thought || '⚠️ FIELD NOTE: Clicked [北陸・上越新幹線] (Wrong Route MV-11)',
          isTrap: true,
        };
      }
      if (decision.target_id === 4) {
        return {
          action: 'CLICK',
          targetId: '#4',
          targetCoordinate: { x: 750, y: 520 },
          gridRef: 'C3',
          thought: decision.thought || '⚠️ FIELD NOTE: Clicked [JRE POINT・Suica連携] (Wrong Portal MV-12)',
          isTrap: true,
        };
      }
      if (decision.target_id === 17) {
        return {
          action: 'TYPE',
          targetId: '#17',
          targetCoordinate: { x: 480, y: 395 },
          gridRef: 'B3',
          textValue: decision.text_value || 'TANAKA',
          thought:
            decision.thought ||
            `📌 FIELD NOTE: Typed [${(decision.text_value || 'TANAKA').toUpperCase()}] into [搭乗者名]`,
        };
      }
      if (decision.target_id === 27) {
        return {
          action: 'DRAW',
          targetId: '#27',
          targetCoordinate: { x: 512, y: 405 },
          gridRef: 'C3',
          textValue: decision.text_value || 'T. Tanaka',
          thought: decision.thought || '📌 FIELD NOTE: Signed [自署・サイン欄]',
        };
      }

      return {
        action: 'CONFUSED',
        thought: `📌 FIELD NOTE: Mark #${decision.target_id} not found on screen.`,
      };
    }

    const center = getBoxCenter(matchedElement.boundingBox);

    return {
      action: decision.action,
      targetId: matchedElement.somId,
      targetCoordinate: {
        x: Math.round(center.x),
        y: Math.round(center.y),
      },
      gridRef: matchedElement.gridRef,
      textValue: decision.text_value || undefined,
      scrollDirection: decision.scroll_direction || undefined,
      thought: decision.thought,
      isTrap: Boolean(matchedElement.isTrap),
    };
  }
}
