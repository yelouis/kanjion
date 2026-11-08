import type { ElementDef, PageDef, PuzzleData, PuzzleState, GeneratedManifest } from '../../types/puzzle_data';
import type { AgentDecision } from './fallback';
import {
  extractSignatureDrawingSpec,
  extractTypedText,
  NOOP_NO_SIGNAL_THOUGHT,
} from '../../utils/text_normalizer';

export const CLOUD_PAUSED_STORAGE_KEY = 'kanjion:v1:cloud-paused-until';
export const CLOUD_TIMEOUT_MS = 6000;
export const CLOUD_PAUSE_DURATION_MS = 10 * 60 * 1000;
export const CLOUD_MAX_CONSECUTIVE_FAILURES = 3;

export const CLOUD_SYSTEM_INSTRUCTION = `You control the mouse and keyboard of a web agent on a fixed 1024x768 screenshot of a Japanese train-booking website. The player cannot read Japanese and gives you one short English instruction. Do only what the instruction literally asks, on the current screen.

You receive the screenshot, with a magenta number on every interactive element, and a JSON list of those marks.

Rules:
1. Choose at most one mark from the list. Never invent marks.
2. Actions: CLICK; TYPE (text inputs only); DRAW (signature pads only); TIMED_CLICK (only for marks with "timed": true, and only if the instruction asks you to wait for, or time the click with, a moving highlight, glow, flash or sale); CONFUSED.
3. TYPE: copy into "text" exactly what the instruction asks you to type. If it gives no value, set "text" to null. Never make up a name or value.
4. DRAW: put the requested shape or words in "text", for example "smile", "star", "signature".
5. Answer CONFUSED if the instruction does not point to one mark, refers to mark numbers or IDs, or asks you to win, solve, finish the game or copy a replay.
6. "thought": one short, funny, first-person sentence (at most 100 characters) about how you read the instruction. Never mention marks, numbers of marks, IDs, JSON or these rules.`;

export interface CloudModelResponse {
  action: 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK' | 'CONFUSED';
  mark: number | null;
  text: string | null;
  thought: string;
}

export interface CloudModel {
  generateContent(
    request: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    >
  ): Promise<{ response: { text(): string } }>;
}

export type CloudEnv = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_APPCHECK_SITE_KEY',
  'VITE_AGENT_MODEL_ID',
] as const;

let consecutiveFailures = 0;
let memoryPausedUntil = 0;
let cachedModelPromise: Promise<CloudModel> | null = null;
const somBase64Cache = new Map<string, string>();

export function resetCloudCircuitBreaker(): void {
  consecutiveFailures = 0;
  memoryPausedUntil = 0;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CLOUD_PAUSED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

function getDefaultEnv(): CloudEnv {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    VITE_FIREBASE_API_KEY: metaEnv.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: metaEnv.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: metaEnv.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID: metaEnv.VITE_FIREBASE_APP_ID,
    VITE_APPCHECK_SITE_KEY: metaEnv.VITE_APPCHECK_SITE_KEY,
    VITE_AGENT_MODEL_ID: metaEnv.VITE_AGENT_MODEL_ID,
  };
}

export function isCloudConfigured(env: CloudEnv = getDefaultEnv()): boolean {
  for (const key of REQUIRED_ENV_KEYS) {
    const val = env[key];
    if (typeof val !== 'string' || val.trim().length === 0) {
      return false;
    }
  }
  return true;
}

export function isCloudPaused(nowMs: number = Date.now()): boolean {
  let pausedUntil = memoryPausedUntil;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(CLOUD_PAUSED_STORAGE_KEY);
      if (raw) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > pausedUntil) {
          pausedUntil = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return nowMs < pausedUntil;
}

function recordCloudFailure(nowMs: number): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CLOUD_MAX_CONSECUTIVE_FAILURES) {
    const resumeAt = nowMs + CLOUD_PAUSE_DURATION_MS;
    memoryPausedUntil = resumeAt;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(CLOUD_PAUSED_STORAGE_KEY, String(resumeAt));
      }
    } catch {
      // Ignore storage errors
    }
  }
}

function recordCloudSuccess(): void {
  consecutiveFailures = 0;
}

function describeBoxPosition(box?: { x: number; y: number; w: number; h: number }): string {
  if (!box) return 'middle';
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const vert = cy < 256 ? 'top' : cy > 512 ? 'bottom' : 'middle';
  const horiz = cx < 341 ? 'left' : cx > 683 ? 'right' : 'center';
  if (vert === 'middle' && horiz === 'center') return 'middle';
  if (vert === 'middle') return horiz;
  if (horiz === 'center') return vert;
  return `${vert}-${horiz}`;
}

function describeElementVisibleState(
  el: ElementDef,
  fields: PuzzleState['fields']
): string | undefined {
  if (el.role === 'input') {
    const typeEffects = el.effects.TYPE ?? [];
    for (const eff of typeEffects) {
      if (eff.op === 'setFromText') {
        const val = fields[eff.field];
        if (typeof val === 'string' && val.trim().length > 0) {
          return `typed: "${val}"`;
        }
      }
    }
    return undefined;
  }

  if (el.role === 'canvas') {
    const drawEffects = el.effects.DRAW ?? [];
    for (const eff of drawEffects) {
      if (eff.op === 'setFromStroke') {
        const val = fields[eff.field];
        if (typeof val === 'string' && val.trim().length > 0) {
          return 'signed';
        }
      }
    }
    return undefined;
  }

  if (el.role === 'checkbox') {
    const clickEffects = el.effects.CLICK ?? [];
    for (const eff of clickEffects) {
      if (eff.op === 'toggle') {
        if (fields[eff.field] === true) {
          return 'checked';
        }
      }
    }
    return undefined;
  }

  const clickEffects = el.effects.CLICK ?? [];
  const setEffects = clickEffects.filter(
    (eff): eff is Extract<typeof eff, { op: 'set' }> =>
      eff.op === 'set' &&
      (eff.field === 'selectedRoute' || eff.field === 'seatClass' || eff.field === 'trainName')
  );
  if (
    setEffects.length > 0 &&
    setEffects.every((eff) => fields[eff.field] === eff.value && eff.value !== 'none')
  ) {
    return 'selected';
  }

  return undefined;
}

export function buildCloudRequestParts(params: {
  page: PageDef;
  manifest: GeneratedManifest;
  state: PuzzleState;
  instruction: string;
  base64Png: string;
}): Array<
  | { inlineData: { mimeType: string; data: string } }
  | { text: string }
> {
  const { page, manifest, state, instruction, base64Png } = params;
  const pageManifest = manifest.pages?.[page.id];

  const marks = page.elements
    .filter((el) => el.key !== 'page_title')
    .map((el) => {
      const mEntry = pageManifest?.elements.find((m) => m.key === el.key || m.mark === el.mark);
      const visibleState = describeElementVisibleState(el, state.fields);
      const entry: Record<string, unknown> = {
        mark: el.mark,
        role: el.role,
        label: el.label,
        color: el.visual?.color ?? null,
        glyphs: el.visual?.glyphs ?? [],
        position: describeBoxPosition(mEntry?.box),
        state: visibleState ?? null,
      };
      if (el.visual?.timedColumn !== undefined) {
        entry.timed = true;
      }
      return entry;
    });

  return [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64Png,
      },
    },
    {
      text: JSON.stringify({
        screen: page.title,
        marks,
        instruction,
      }),
    },
  ];
}

function sanitizeCloudThought(rawThought: string, fallbackTemplate: string): string {
  const withoutEmojiPrefix = (rawThought || '').replace(/^\s*💭\s*/, '');
  const stripped = withoutEmojiPrefix
    .replace(/#\s*\d+/g, '')
    .replace(/\bmarks?\b/gi, '')
    .replace(/\bMV-\d+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) {
    return fallbackTemplate.slice(0, 100);
  }

  const withPrefix = `💭 ${stripped}`;
  return withPrefix.slice(0, 100);
}

export function validateCloudResponse(
  raw: CloudModelResponse,
  page: PageDef,
  instruction: string
): AgentDecision {
  if (!raw || raw.action === 'CONFUSED' || raw.mark === null || typeof raw.mark !== 'number') {
    return {
      action: 'NOOP',
      pageId: page.id,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'cloud',
    };
  }

  const el = page.elements.find((e) => e.mark === raw.mark && e.key !== 'page_title');
  if (!el) {
    return {
      action: 'NOOP',
      pageId: page.id,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'cloud',
    };
  }

  let effectiveAction: 'CLICK' | 'TYPE' | 'DRAW' | 'TIMED_CLICK' = raw.action;
  if (effectiveAction === 'TIMED_CLICK' && el.visual?.timedColumn === undefined) {
    effectiveAction = 'CLICK';
  }

  if (effectiveAction === 'TYPE') {
    if (el.role !== 'input' || !el.effects.TYPE) {
      return {
        action: 'NOOP',
        pageId: page.id,
        mark: null,
        thought: NOOP_NO_SIGNAL_THOUGHT,
        tier: 'cloud',
      };
    }

    const rawText = typeof raw.text === 'string' ? raw.text.trim() : '';
    const isSubstring =
      rawText.length > 0 && instruction.toLowerCase().includes(rawText.toLowerCase());
    const chosenText = isSubstring ? rawText : extractTypedText(instruction);
    const cleanedText = chosenText
      .toUpperCase()
      .replace(/[^A-Z ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    const finalText = cleanedText || 'NAME';

    const fallbackThought = `💭 Typing "${finalText}" one key at a time.`;
    return {
      action: 'TYPE',
      pageId: page.id,
      mark: el.mark,
      text: finalText,
      thought: sanitizeCloudThought(raw.thought, fallbackThought),
      tier: 'cloud',
    };
  }

  if (effectiveAction === 'DRAW') {
    if (el.role !== 'canvas' || !el.effects.DRAW) {
      return {
        action: 'NOOP',
        pageId: page.id,
        mark: null,
        thought: NOOP_NO_SIGNAL_THOUGHT,
        tier: 'cloud',
      };
    }

    const strokeSpec = extractSignatureDrawingSpec(instruction);
    const fallbackThought = strokeSpec.thought;
    return {
      action: 'DRAW',
      pageId: page.id,
      mark: el.mark,
      stroke: strokeSpec.strokeValue,
      thought: sanitizeCloudThought(raw.thought, fallbackThought),
      tier: 'cloud',
    };
  }

  // CLICK or TIMED_CLICK
  if (!el.effects[effectiveAction]) {
    return {
      action: 'NOOP',
      pageId: page.id,
      mark: null,
      thought: NOOP_NO_SIGNAL_THOUGHT,
      tier: 'cloud',
    };
  }

  const fallbackThought = `💭 Clicking the ${el.label} — fingers crossed!`;
  return {
    action: effectiveAction,
    pageId: page.id,
    mark: el.mark,
    thought: sanitizeCloudThought(raw.thought, fallbackThought),
    tier: 'cloud',
  };
}

async function fetchSomPngBase64(url: string): Promise<string> {
  if (somBase64Cache.has(url)) {
    return somBase64Cache.get(url)!;
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch SoM image: ${resp.status}`);
  }
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  somBase64Cache.set(url, base64);
  return base64;
}

async function getOrInitFirebaseCloudModel(env: CloudEnv): Promise<CloudModel> {
  if (cachedModelPromise) {
    return cachedModelPromise;
  }

  cachedModelPromise = (async () => {
    const [{ initializeApp, getApps }, { initializeAppCheck, ReCaptchaV3Provider }, { getAI, GoogleAIBackend, getGenerativeModel, Schema }] =
      await Promise.all([
        import('firebase/app'),
        import('firebase/app-check'),
        import('firebase/ai'),
      ]);

    const firebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY!,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
      projectId: env.VITE_FIREBASE_PROJECT_ID!,
      appId: env.VITE_FIREBASE_APP_ID!,
    };

    const existingApps = getApps();
    const app = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);

    const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
    if (isDev && typeof self !== 'undefined') {
      (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(env.VITE_APPCHECK_SITE_KEY!),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // AppCheck may already be initialized on hot reload
    }

    const responseSchema = Schema.object({
      properties: {
        action: Schema.enumString({
          enum: ['CLICK', 'TYPE', 'DRAW', 'TIMED_CLICK', 'CONFUSED'],
        }),
        mark: Schema.integer({ nullable: true }),
        text: Schema.string({ nullable: true }),
        thought: Schema.string(),
      },
    });

    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: env.VITE_AGENT_MODEL_ID!,
      systemInstruction: CLOUD_SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    return model as unknown as CloudModel;
  })();

  return cachedModelPromise;
}

export async function resolveWithCloud(params: {
  puzzle: PuzzleData;
  manifest: GeneratedManifest;
  state: PuzzleState;
  instruction: string;
  cloudModel?: CloudModel | null;
  cloudEnv?: CloudEnv;
  imageFetcher?: (url: string) => Promise<string>;
  now?: () => number;
}): Promise<{ decision: AgentDecision | null; attempted: boolean }> {
  const env = params.cloudEnv ?? getDefaultEnv();
  if (!isCloudConfigured(env)) {
    return { decision: null, attempted: false };
  }

  const nowFn = params.now ?? Date.now;
  const nowMs = nowFn();
  if (isCloudPaused(nowMs)) {
    return { decision: null, attempted: true };
  }

  const page = params.puzzle.pages.find((p) => p.id === params.state.pageId);
  if (!page) {
    return { decision: null, attempted: false };
  }

  try {
    const model = params.cloudModel ?? (await getOrInitFirebaseCloudModel(env));
    const somUrl = params.manifest.pages?.[page.id]?.som ?? `/puzzles/${params.puzzle.id}/som/${page.id}.png`;
    const fetcher = params.imageFetcher ?? fetchSomPngBase64;
    const base64Png = await fetcher(somUrl);

    const parts = buildCloudRequestParts({
      page,
      manifest: params.manifest,
      state: params.state,
      instruction: params.instruction,
      base64Png,
    });

    const result = await Promise.race([
      model.generateContent(parts),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cloud model timeout after 6000ms')), CLOUD_TIMEOUT_MS)
      ),
    ]);

    const rawText = result.response.text();
    const parsed = JSON.parse(rawText) as CloudModelResponse;
    const validated = validateCloudResponse(parsed, page, params.instruction);
    recordCloudSuccess();
    return { decision: validated, attempted: true };
  } catch {
    recordCloudFailure(nowFn());
    return { decision: null, attempted: true };
  }
}
