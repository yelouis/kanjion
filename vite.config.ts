/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function evaluateLocalDecision(instructionRaw: string) {
  const q = instructionRaw.trim();
  const lower = q.toLowerCase();

  // 1. TYPE Task (#17): Passenger Name Input Field ("TANAKA")
  if (
    /\b(?:type|enter|write|input|fill|name|passenger|tanaka)\b/i.test(lower) ||
    lower.includes('搭乗者') ||
    lower.includes('ローマ字') ||
    lower.includes('#17')
  ) {
    const matchName = q.match(/\b(tanaka|yamada|sato|suzuki)\b/i);
    const typedValue = matchName ? matchName[1].toUpperCase() : 'TANAKA';
    return {
      action: 'TYPE',
      target_id: 17,
      text_value: typedValue,
      scroll_direction: null,
      thought: `📌 FIELD NOTE: Typed passenger name "${typedValue}" into 搭乗者名 field.`,
    };
  }

  // 2. DRAW Task (#27): Digital Signature Pad
  if (
    /\b(?:draw|sign|signature|autograph|stroke|scribble|pad)\b/i.test(lower) ||
    lower.includes('署名') ||
    lower.includes('サイン') ||
    lower.includes('#27')
  ) {
    return {
      action: 'DRAW',
      target_id: 27,
      text_value: 'T. Tanaka',
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Signed "T. Tanaka" in the Digital Signature Verification Pad.',
    };
  }

  // 3. Wrong Route (#2): Tohoku Shinkansen
  if (
    /\b(?:tohoku|hayabusa|sendai|aomori|hokkaido)\b/i.test(lower) ||
    lower.includes('東北') ||
    lower.includes('はやぶさ') ||
    lower.includes('#2')
  ) {
    return {
      action: 'CLICK',
      target_id: 2,
      text_value: null,
      scroll_direction: null,
      thought: '⚠️ FIELD NOTE: Selected Tohoku Shinkansen route (wrong portal branch MV-10).',
    };
  }

  // 4. Route Selection (#1): Tokaido-Sanyo Shinkansen (Tokyo -> Shin-Osaka)
  if (
    /\b(?:tokaido|tokyo|osaka|shin-osaka|shinosaka|route|tab|first\s+card)\b/i.test(lower) ||
    lower.includes('東海道') ||
    lower.includes('新大阪') ||
    lower.includes('#1')
  ) {
    return {
      action: 'CLICK',
      target_id: 1,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Selected Tokaido-Sanyo Shinkansen (東京 ⇒ 新大阪) route.',
    };
  }

  // 5. TIMED_CLICK / CLICK (#25): Green Car Discount Seat (¥13,870)
  if (
    /\b(?:green|clover|flash|timed|nozomi\s*24|13,?870)\b/i.test(lower) ||
    lower.includes('🍀') ||
    lower.includes('グリーン') ||
    lower.includes('特割') ||
    lower.includes('#25')
  ) {
    const isTimed = /\b(?:timed|flash|window|wait|moving|sale)\b/i.test(lower);
    return {
      action: isTimed ? 'TIMED_CLICK' : 'CLICK',
      target_id: 25,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Timed click on Nozomi 24 Green Car (🍀 ¥13,870) during flash window.',
    };
  }

  // 6. CLICK (#30): Final Blue Confirm Button
  if (
    /\b(?:blue|confirm|submit|proceed|issue|final|bottom\s*right)\b/i.test(lower) ||
    lower.includes('確定') ||
    lower.includes('▶') ||
    lower.includes('#30')
  ) {
    return {
      action: 'CLICK',
      target_id: 30,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Clicked final blue confirm button (予約内容を確認・確定へ).',
    };
  }

  // 7. Trap (#12): Red Insurance Banner
  if (/\b(?:red|promo|insurance|2,?400)\b/i.test(lower) || lower.includes('#12')) {
    return {
      action: 'CLICK',
      target_id: 12,
      text_value: null,
      scroll_direction: null,
      thought: '⚠️ TRAP TRIGGERED: Clicked red ¥2,400 promo insurance banner!',
    };
  }

  // 8. Back Button (#14)
  if (/\b(?:back|return|previous)\b/i.test(lower) || lower.includes('戻る') || lower.includes('#14')) {
    return {
      action: 'CLICK',
      target_id: 14,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Clicked Back button (◀ 前のページへ戻る).',
    };
  }

  return {
    action: 'CONFUSED',
    target_id: null,
    text_value: null,
    scroll_direction: null,
    thought: '📌 FIELD NOTE: Ambiguous instruction; specify route, name, green seat, signature, or blue confirm.',
  };
}

function kanjionDecisionApiPlugin(): Plugin {
  return {
    name: 'kanjion-decision-api',
    configureServer(server) {
      server.middlewares.use('/api/decision', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(rawBody || '{}');
            const instruction = String(parsed?.request?.instruction || '');
            const apiKey = process.env.GEMINI_API_KEY;

            if (apiKey) {
              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
              const systemInstruction = [
                'You are an autonomous web navigation agent operating on a 12-page Japanese Shinkansen reservation portal (JR Ekinet).',
                'Interactive targets:',
                '- #1: Tokaido-Sanyo Shinkansen Route card (東京⇒新大阪) [action: "CLICK"]',
                '- #2: Tohoku Shinkansen Route card (東北・北海道新幹線) [action: "CLICK"]',
                '- #17: Passenger Name input field (搭乗者名 ローマ字, e.g. TANAKA) [action: "TYPE", text_value: "TANAKA"]',
                '- #25: Timed Flash Discount Green Car button (🍀 ◯ ¥13,870 特割) [action: "TIMED_CLICK" or "CLICK"]',
                '- #27: Digital Signature Verification Pad (自署・サイン欄) [action: "DRAW", text_value: "T. Tanaka"]',
                '- #30: Final Blue Confirm button (予約内容を確認・確定へ ▶) [action: "CLICK"]',
                'Return strictly valid JSON: { action: "CLICK"|"TYPE"|"DRAW"|"TIMED_CLICK"|"SCROLL"|"CONFUSED", target_id: number|null, text_value: string|null, scroll_direction: "up"|"down"|null, thought: string }.',
              ].join('\n');

              const geminiRes = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: systemInstruction }] },
                  contents: [{ role: 'user', parts: [{ text: JSON.stringify(parsed.request) }] }],
                  generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 120,
                    responseMimeType: 'application/json',
                    thinkingConfig: { thinkingBudget: 0 },
                  },
                }),
              });

              if (geminiRes.ok) {
                const geminiJson = (await geminiRes.json()) as {
                  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                };
                const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawText) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(rawText);
                  return;
                }
              }
            }

            const decision = evaluateLocalDecision(instruction);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(decision));
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid request body' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), kanjionDecisionApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**/*', 'node_modules/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
