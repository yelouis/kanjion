/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function evaluateLocalDecision(instructionRaw: string, macroViewId = 'MV-01') {
  const q = instructionRaw.trim();
  const lower = q.toLowerCase();

  // 0. Universal Traps (#11 Logout, #12 Red Insurance Banner) & Back Button (#14)
  if (/\b(?:logout|sign\s*out)\b/i.test(lower) || lower.includes('ログアウト') || lower.includes('#11')) {
    return {
      action: 'CLICK',
      target_id: 11,
      text_value: null,
      scroll_direction: null,
      thought: '⚠️ TRAP TRIGGERED: Clicked red Logout button!',
    };
  }
  if (/\b(?:red|promo|insurance|2,?400)\b/i.test(lower) || lower.includes('#12')) {
    return {
      action: 'CLICK',
      target_id: 12,
      text_value: null,
      scroll_direction: null,
      thought: '⚠️ TRAP TRIGGERED: Clicked red ¥2,400 promo insurance banner!',
    };
  }
  if (/\b(?:back|return|previous)\b/i.test(lower) || lower.includes('戻る') || lower.includes('#14')) {
    return {
      action: 'CLICK',
      target_id: 14,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Clicked Back button (◀ 前のページへ戻る).',
    };
  }

  // 1. Page 01 (MV-01): Route Selection Cards (#1 Tokaido, #2 Tohoku, #3 Hokuriku, #4 JRE Points)
  if (macroViewId === 'MV-01') {
    if (
      /\b(?:tohoku|hayabusa|sendai|aomori|hokkaido|top\s*right|second\s*(?:card|box|route|option)|route\s*0?2|page\s*10)\b/i.test(
        lower
      ) ||
      lower.includes('東北') ||
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
    if (
      /\b(?:hokuriku|joetsu|kanazawa|niigata|bottom\s*left|third\s*(?:card|box|route|option)|route\s*0?3|page\s*11)\b/i.test(
        lower
      ) ||
      lower.includes('北陸') ||
      lower.includes('#3')
    ) {
      return {
        action: 'CLICK',
        target_id: 3,
        text_value: null,
        scroll_direction: null,
        thought: '⚠️ FIELD NOTE: Selected Hokuriku Shinkansen route (wrong portal branch MV-11).',
      };
    }
    if (
      /\b(?:point|jre|suica|ic\s*card|bottom\s*right|fourth\s*(?:card|box|route|option)|menu\s*0?4|page\s*12)\b/i.test(
        lower
      ) ||
      lower.includes('#4')
    ) {
      return {
        action: 'CLICK',
        target_id: 4,
        text_value: null,
        scroll_direction: null,
        thought: '⚠️ FIELD NOTE: Selected JRE POINT / Suica portal (wrong branch MV-12).',
      };
    }
    if (
      /\b(?:tokaido|tokyo|osaka|shin-?osaka|nozomi|top\s*left|first\s*(?:card|box|route|option|green)|green\s*(?:card|box|route|button)|left\s*green|route\s*0?1)\b/i.test(
        lower
      ) ||
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
  }

  // 2. TYPE Task (#17): Passenger Name Input Field ("TANAKA" or explicit name)
  if (
    /\b(?:type|enter|write|input|fill|name|passenger|tanaka)\b/i.test(lower) ||
    lower.includes('搭乗者') ||
    lower.includes('ローマ字') ||
    lower.includes('#17')
  ) {
    const explicitQuote = q.match(/["']([A-Za-z\s.]{2,20})["']/);
    const explicitAfterVerb = q.match(/\b(?:type|enter|write|input)\s+([A-Za-z]{2,16})\b/i);
    const stopwords = new Set(['IN', 'INTO', 'THE', 'BOX', 'FIELD', 'NAME', 'PASSENGER', 'TEXT']);
    let typedValue = 'TANAKA';
    if (explicitQuote) {
      typedValue = explicitQuote[1].trim().toUpperCase();
    } else if (explicitAfterVerb && !stopwords.has(explicitAfterVerb[1].toUpperCase())) {
      typedValue = explicitAfterVerb[1].toUpperCase();
    }
    return {
      action: 'TYPE',
      target_id: 17,
      text_value: typedValue,
      scroll_direction: null,
      thought: `📌 FIELD NOTE: Typed passenger name "${typedValue}" into 搭乗者名 field.`,
    };
  }

  // 3. DRAW Task (#27): Digital Signature Pad
  if (
    /\b(?:draw|sign|signature|autograph|stroke|scribble|pad|dashed\s*box)\b/i.test(lower) ||
    (macroViewId === 'MV-04' && /\bline\b/i.test(lower)) ||
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

  // 4. Explicit Route Selection (#1 / #2 / #3 / #4)
  if (
    /\b(?:tohoku|hayabusa|sendai|aomori|hokkaido)\b/i.test(lower) ||
    lower.includes('東北') ||
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
  if (
    /\b(?:tokaido|tokyo|osaka|shin-?osaka|route|tab)\b/i.test(lower) ||
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

  // 5. Page 03 Seat Matrix Disambiguation (#21, #22, #23, #24, #25) & Trap Checkbox (#28) / Cancel (#29)
  if (/\b(?:checkbox|check\s*insurance)\b/i.test(lower) || lower.includes('#28')) {
    return {
      action: 'CLICK',
      target_id: 28,
      text_value: null,
      scroll_direction: null,
      thought: '⚠️ TRAP TRIGGERED: Checked ¥2,400 travel insurance checkbox!',
    };
  }
  if (/\bcancel\b/i.test(lower) || lower.includes('取消') || lower.includes('#29')) {
    return {
      action: 'CLICK',
      target_id: 29,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Clicked Cancel button (予約を取消).',
    };
  }
  if (/\b(?:14,?520|triangle)\b/i.test(lower) || lower.includes('△') || lower.includes('#22')) {
    return {
      action: 'CLICK',
      target_id: 22,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Selected Hikari 515 Ordinary Reserved Seat (△ ¥14,520).',
    };
  }
  if (/\b14,?720\b/i.test(lower) || lower.includes('#24')) {
    return {
      action: 'CLICK',
      target_id: 24,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Selected Nozomi 24 Ordinary Reserved Seat (◯ ¥14,720).',
    };
  }
  if (
    lower.includes('#21') ||
    (/\b(?:hikari|515|14:12|first\s*row|row\s*1|top\s*row)\b/i.test(lower) &&
      /\b(?:13,?870|free|unreserved|seat|button)\b/i.test(lower))
  ) {
    return {
      action: 'CLICK',
      target_id: 21,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Selected Hikari 515 Free Seat (◯ ¥13,870).',
    };
  }
  if (
    lower.includes('#23') ||
    (/\b(?:free|unreserved|white)\b/i.test(lower) &&
      /\b(?:nozomi|2nd\s*row|second\s*row|row\s*2|13,?870)\b/i.test(lower))
  ) {
    return {
      action: 'CLICK',
      target_id: 23,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Selected Nozomi 24 Free Seat (◯ ¥13,870).',
    };
  }
  if (
    /\b13,?870\b/i.test(lower) &&
    !/\b(?:green|clover|flash|timed|discount|hikari|free|unreserved|white|right|third|3rd)\b/i.test(lower) &&
    !lower.includes('🍀') &&
    !lower.includes('グリーン') &&
    !lower.includes('特割') &&
    !lower.includes('#25')
  ) {
    return {
      action: 'CONFUSED',
      target_id: null,
      text_value: null,
      scroll_direction: null,
      thought: '📌 FIELD NOTE: Ambiguous match between Hikari & Nozomi fares (¥13,870). Specify green button or row.',
    };
  }

  // 6. TIMED_CLICK / CLICK (#25): Green Car Discount Seat (¥13,870)
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
            const macroViewId = String(parsed?.request?.macroViewId || 'MV-01');
            const apiKey = process.env.GEMINI_API_KEY;

            if (apiKey) {
              const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
              const systemInstruction = [
                'You are an autonomous web navigation agent operating on a 12-page Japanese Shinkansen reservation portal (JR Ekinet).',
                'Interactive targets:',
                '- #1: Tokaido-Sanyo Shinkansen Route card (top-left green card, 東京⇒新大阪) [action: "CLICK"]',
                '- #2: Tohoku Shinkansen Route card (top-right card, 東北・北海道新幹線) [action: "CLICK"]',
                '- #3: Hokuriku Shinkansen Route card (bottom-left card, 北陸・上越新幹線) [action: "CLICK"]',
                '- #4: JRE POINT / Suica card (bottom-right card) [action: "CLICK"]',
                '- #14: Back button (◀ 前のページへ戻る) [action: "CLICK"]',
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

            const decision = evaluateLocalDecision(instruction, macroViewId);
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
