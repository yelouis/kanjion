import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const ALLOWED_ORIGINS = [
  'https://kanjion-game.web.app',
  'https://kanjion-game.firebaseapp.com',
];

const ALLOWED_PUZZLE_IDS = new Set(['case_042']);
const ALLOWED_MACRO_VIEWS = new Set(['MV-01', 'MV-02', 'MV-03', 'MV-04']);
const REQUIRED_CLIENT_HEADER = 'kanjion-web-v1';
const MAX_BODY_BYTES = 8192; // 8 KB hard cap to prevent token-stuffing payloads
const MAX_VISIBLE_MARKS = 30;

interface DecisionPayload {
  request?: {
    puzzleId?: string;
    macroViewId?: string;
    instruction?: string;
    normalizedInstruction?: string;
    microState?: Record<string, unknown>;
    somImageUrl?: string;
    visibleMarks?: Array<{
      id: number;
      somId: string;
      region: string;
      desc: string;
    }>;
  };
}

interface LLMDecisionResponse {
  action: 'CLICK' | 'TYPE' | 'SCROLL' | 'CONFUSED';
  target_id: number | null;
  text_value: string | null;
  scroll_direction: 'up' | 'down' | null;
  thought: string;
}

// ============================================================================
// 1. BOUNDED 24-HOUR SERVER DECISION CACHE (Zero LLM spend on repeated inputs)
// ============================================================================
const decisionCache = new Map<string, { value: LLMDecisionResponse; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const MAX_CACHE_ENTRIES = 2000;

function getCachedDecision(key: string): LLMDecisionResponse | null {
  const entry = decisionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    decisionCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedDecision(key: string, value: LLMDecisionResponse): void {
  if (decisionCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = decisionCache.keys().next().value;
    if (oldestKey) decisionCache.delete(oldestKey);
  }
  decisionCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================================================
// 2. THREE-TIER RATE LIMITER & HARD GLOBAL DAILY SPEND CIRCUIT BREAKER
//    - Tier 1 (Per-IP): Max 12 uncached calls per 10 minutes (2 full 6-line games)
//    - Tier 2 (Global Burst): Max 25 uncached calls per minute across all users
//    - Tier 3 (Global Daily Hard Cap): Max 1,000 uncached calls per UTC day
//      (~$0.15/day worst-case ceiling on gemini-2.5-flash-lite)
// ============================================================================
const ipRateWindows = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 1000 * 60 * 10; // 10 minutes
const MAX_CALLS_PER_IP_WINDOW = 12;
const MAX_IP_ENTRIES = 5000;

let globalMinuteWindow = { count: 0, resetAt: 0 };
const MAX_GLOBAL_CALLS_PER_MINUTE = 25;

let globalDayWindow = { count: 0, utcDay: '' };
const DEFAULT_MAX_DAILY_LLM_CALLS = 1000;

function checkPerIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateWindows.get(ip);
  if (!entry || now > entry.resetAt) {
    if (!entry && ipRateWindows.size >= MAX_IP_ENTRIES) {
      const oldestIp = ipRateWindows.keys().next().value;
      if (oldestIp) ipRateWindows.delete(oldestIp);
    }
    ipRateWindows.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_CALLS_PER_IP_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

function checkAndIncrementGlobalBudget(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const utcDay = new Date(now).toISOString().slice(0, 10);
  const maxDailyCalls = Number(process.env.MAX_DAILY_LLM_CALLS) || DEFAULT_MAX_DAILY_LLM_CALLS;

  if (globalDayWindow.utcDay !== utcDay) {
    globalDayWindow = { count: 0, utcDay };
  }
  if (globalDayWindow.count >= maxDailyCalls) {
    return { allowed: false, reason: 'Global daily LLM budget cap reached.' };
  }

  if (now > globalMinuteWindow.resetAt) {
    globalMinuteWindow = { count: 0, resetAt: now + 60_000 };
  }
  if (globalMinuteWindow.count >= MAX_GLOBAL_CALLS_PER_MINUTE) {
    return { allowed: false, reason: 'Global per-minute burst limit reached.' };
  }

  globalMinuteWindow.count += 1;
  globalDayWindow.count += 1;
  return { allowed: true };
}

// ============================================================================
// 3. PAYLOAD SANITIZER (Prevents prompt-token stuffing attacks)
// ============================================================================
function sanitizeMicroState(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const allowedKeys = [
    'macroViewId',
    'activeModal',
    'selectedRoute',
    'departureTime',
    'trainName',
    'seatClass',
    'fare',
    'greenCarSelected',
    'insuranceCheckboxChecked',
  ];
  const out: Record<string, string | number | boolean> = {};
  const obj = raw as Record<string, unknown>;
  for (const key of allowedKeys) {
    const val = obj[key];
    if (typeof val === 'boolean' || typeof val === 'number') {
      out[key] = val;
    } else if (typeof val === 'string') {
      out[key] = val.slice(0, 64);
    }
  }
  return out;
}

function sanitizeMarks(
  rawMarks: unknown
): Array<{ id: number; somId: string; region: string; desc: string }> {
  if (!Array.isArray(rawMarks)) return [];
  return rawMarks.slice(0, MAX_VISIBLE_MARKS).flatMap((m) => {
    if (!m || typeof m !== 'object') return [];
    const item = m as Record<string, unknown>;
    const id = typeof item.id === 'number' && Number.isInteger(item.id) ? item.id : null;
    if (id === null || id < 1 || id > 999) return [];
    const somId = typeof item.somId === 'string' ? item.somId.slice(0, 8) : `#${id}`;
    const region =
      typeof item.region === 'string' && /^[A-D][1-4]$/.test(item.region) ? item.region : 'A1';
    const desc = typeof item.desc === 'string' ? item.desc.slice(0, 120) : '';
    return [{ id, somId, region, desc }];
  });
}

// ============================================================================
// 4. CLOUD FUNCTION ENDPOINT (Locked to maxInstances: 1)
// ============================================================================
export const decision = onRequest(
  {
    cors: ALLOWED_ORIGINS,
    memory: '256MiB',
    cpu: 1,
    concurrency: 10,
    timeoutSeconds: 10,
    maxInstances: 1, // Hard cap: never scale beyond 1 container instance
    secrets: [geminiApiKey],
  },
  async (req, res) => {
    // 1. Emergency Kill Switch
    if (process.env.LLM_KILL_SWITCH === 'true') {
      res.status(503).json({ error: 'Cloud LLM temporarily disabled by administrator.' });
      return;
    }

    // 2. Method Enforcement
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // 3. Origin & Custom Client Header Enforcement (Blocks cross-site abuse & raw bot scripts)
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    const origin = (req.headers.origin || '').trim();
    const rawClientHeader = req.headers['x-kanjion-client'];
    const clientHeader = (typeof rawClientHeader === 'string' ? rawClientHeader : '').trim();

    if (!isEmulator) {
      if (!ALLOWED_ORIGINS.includes(origin) || clientHeader !== REQUIRED_CLIENT_HEADER) {
        res.status(403).json({ error: 'Forbidden origin or client signature' });
        return;
      }
    }

    // 4. Hard Payload Size Check (Blocks token-stuffing requests)
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_BODY_BYTES) {
      res.status(413).json({ error: 'Payload Too Large' });
      return;
    }

    // 5. Validate Request Schema & Whitelisted Puzzle/View IDs
    const body = (req.body || {}) as DecisionPayload;
    const llmReq = body.request;
    if (!llmReq || typeof llmReq.instruction !== 'string' || llmReq.instruction.trim().length === 0) {
      res.status(400).json({ error: 'Missing valid request.instruction' });
      return;
    }

    const puzzleId = ALLOWED_PUZZLE_IDS.has(llmReq.puzzleId || '') ? llmReq.puzzleId! : 'case_042';
    const macroViewId = ALLOWED_MACRO_VIEWS.has(llmReq.macroViewId || '') ? llmReq.macroViewId! : 'MV-03';
    const instruction = llmReq.instruction.trim().slice(0, 60);
    const normalized = (llmReq.normalizedInstruction || instruction.toLowerCase()).trim().slice(0, 60);
    const sanitizedState = sanitizeMicroState(llmReq.microState);
    const sanitizedMarks = sanitizeMarks(llmReq.visibleMarks);

    // 6. Check 24-Hour Server Cache BEFORE Rate-Limiting or Calling Gemini
    const stateKey = JSON.stringify(sanitizedState);
    const cacheKey = `${puzzleId}:${macroViewId}:${stateKey}:${normalized}`;
    const cached = getCachedDecision(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    // 7. Enforce Per-IP Rate Limit (12 uncached calls / 10 min)
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!checkPerIpRateLimit(clientIp)) {
      res.status(429).json({ error: 'Per-IP rate limit exceeded. Falling back to offline engine.' });
      return;
    }

    // 8. Enforce Global Burst & Daily Hard Budget Circuit Breaker
    const globalCheck = checkAndIncrementGlobalBudget();
    if (!globalCheck.allowed) {
      logger.warn('Global LLM spend circuit breaker tripped', { reason: globalCheck.reason });
      res.status(429).json({ error: globalCheck.reason });
      return;
    }

    // 9. Verify Secret Availability
    const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY is not configured; triggering client offline fallback.');
      res.status(503).json({
        error: 'GEMINI_API_KEY not configured on server; client will use offline fallback.',
      });
      return;
    }

    const systemInstruction = [
      'You are an autonomous web navigation agent operating on a coordinate-framed sandboxed Japanese web application.',
      'The application is rendered at 1024x768 resolution, framed by columns A-D (left-to-right) and rows 1-4 (top-to-bottom).',
      'Interactive elements on screen are listed in visibleMarks with their numeric id, grid region (e.g. D3), and visual/text description.',
      'Follow ONLY the literal user instruction. Never guess a winning goal if the instruction is ambiguous.',
      'Return strictly valid JSON matching { action: "CLICK"|"TYPE"|"SCROLL"|"CONFUSED", target_id: number|null, text_value: string|null, scroll_direction: "up"|"down"|null, thought: string (<=80 chars) }.',
    ].join('\n');

    const userText = JSON.stringify({
      instruction,
      macroViewId,
      microState: sanitizedState,
      visibleMarks: sanitizedMarks,
    }).slice(0, 4000);

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 120,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0, // Never spend extra reasoning tokens
            },
          },
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        logger.error('Gemini API HTTP error', { status: geminiRes.status, errText });
        res.status(502).json({ error: `Upstream Gemini error: ${geminiRes.status}` });
        return;
      }

      const geminiJson = (await geminiRes.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText) as Partial<LLMDecisionResponse>;

      const decisionResult: LLMDecisionResponse = {
        action:
          parsed.action === 'CLICK' || parsed.action === 'TYPE' || parsed.action === 'SCROLL'
            ? parsed.action
            : 'CONFUSED',
        target_id: typeof parsed.target_id === 'number' ? parsed.target_id : null,
        text_value: typeof parsed.text_value === 'string' ? parsed.text_value.slice(0, 60) : null,
        scroll_direction:
          parsed.scroll_direction === 'up' || parsed.scroll_direction === 'down'
            ? parsed.scroll_direction
            : null,
        thought:
          typeof parsed.thought === 'string' && parsed.thought.trim().length > 0
            ? parsed.thought.trim().slice(0, 80)
            : '📌 FIELD NOTE: Executed instruction.',
      };

      setCachedDecision(cacheKey, decisionResult);
      res.status(200).json(decisionResult);
    } catch (err) {
      logger.error('Failed to call Gemini API', err);
      res.status(500).json({ error: 'Failed to evaluate instruction' });
    }
  }
);
