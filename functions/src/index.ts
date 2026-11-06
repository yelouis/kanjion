import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

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
  schema?: Record<string, unknown>;
}

interface LLMDecisionResponse {
  action: 'CLICK' | 'TYPE' | 'SCROLL' | 'CONFUSED';
  target_id: number | null;
  text_value: string | null;
  scroll_direction: 'up' | 'down' | null;
  thought: string;
}

// 1. Server-side Normalized Instruction Cache (keyed by puzzleId:macroViewId:normalizedInstruction)
const decisionCache = new Map<string, { value: LLMDecisionResponse; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// 2. Per-IP Sliding Window Rate Limiter (Max 30 calls per 10 minutes per IP)
const ipRateWindows = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 1000 * 60 * 10;
const MAX_CALLS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateWindows.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateWindows.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_CALLS_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

export const decision = onRequest(
  {
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 15,
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: 'Daily rate limit exceeded. Please try again later.' });
      return;
    }

    const body = (req.body || {}) as DecisionPayload;
    const llmReq = body.request;
    if (!llmReq || typeof llmReq.instruction !== 'string' || llmReq.instruction.trim().length === 0) {
      res.status(400).json({ error: 'Missing valid request.instruction' });
      return;
    }

    const instruction = llmReq.instruction.slice(0, 60);
    const normalized = (llmReq.normalizedInstruction || instruction.toLowerCase().trim()).slice(0, 60);
    const cacheKey = `${llmReq.puzzleId || 'case_042'}:${llmReq.macroViewId || 'MV-03'}:${normalized}`;

    // Check Server Cache
    const cached = decisionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      res.status(200).json(cached.value);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn('GEMINI_API_KEY is not set in Cloud Function environment.');
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
      macroViewId: llmReq.macroViewId,
      microState: llmReq.microState,
      visibleMarks: llmReq.visibleMarks || [],
    });

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
            maxOutputTokens: 150,
            responseMimeType: 'application/json',
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
        text_value: typeof parsed.text_value === 'string' ? parsed.text_value : null,
        scroll_direction:
          parsed.scroll_direction === 'up' || parsed.scroll_direction === 'down'
            ? parsed.scroll_direction
            : null,
        thought:
          typeof parsed.thought === 'string' && parsed.thought.trim().length > 0
            ? parsed.thought.trim().slice(0, 80)
            : '📌 FIELD NOTE: Executed instruction.',
      };

      decisionCache.set(cacheKey, { value: decisionResult, expiresAt: Date.now() + CACHE_TTL_MS });
      res.status(200).json(decisionResult);
    } catch (err) {
      logger.error('Failed to call Gemini API', err);
      res.status(500).json({ error: 'Failed to evaluate instruction' });
    }
  }
);
