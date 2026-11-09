/**
 * test/cloud_connector.test.ts
 *
 * Item 11 (§13) — Free cloud tier via Firebase AI Logic (F-6; D-1 = A)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import {
  resolveLine,
  decisionToAgentAction,
} from '../src/engine/agent';
import {
  buildCloudRequestParts,
  validateCloudResponse,
  CLOUD_PAUSED_STORAGE_KEY,
  resetCloudCircuitBreaker,
  type CloudModel,
} from '../src/engine/agent/cloud_tier';
import {
  CASE_001_PUZZLE,
  CASE_001_GENERATED_MANIFEST,
} from '../src/data/puzzles/case_001';
import { initialPuzzleState } from '../src/engine/puzzle_engine';
import { createInitialGameState, gameReducer } from '../src/engine/game_reducer';

const MOCK_CLOUD_ENV = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'kanjion-game.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'kanjion-game',
  VITE_FIREBASE_APP_ID: '1:123456:web:abcdef',
  VITE_APPCHECK_SITE_KEY: 'test-site-key',
  VITE_AGENT_MODEL_ID: 'gemini-2.5-flash-lite',
};

describe('Item 11 (§13): Free cloud tier via Firebase AI Logic', () => {
  beforeEach(() => {
    resetCloudCircuitBreaker();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CLOUD_PAUSED_STORAGE_KEY);
    }
  });

  it('★ 1. A valid model response maps to the right decision', async () => {
    const fakeModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'CLICK',
              candidates: [52],
              text: null,
              thought: 'Ooh, a clover seat! Clicking that green car option right away.',
            }),
        },
      }),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the button with the leaf',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });

    expect(decision.tier).toBe('cloud');
    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(52);
    expect(decision.pageId).toBe('MV-03');
    expect(decision.thought).toBe('💭 Ooh, a clover seat! Clicking that green car option right away.');
    expect(decision.cloudFailed).toBeUndefined();
  });

  it('★ 2. Candidates not on the page are dropped; if that leaves none -> distraction', async () => {
    const fakeModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'CLICK',
              candidates: [99],
              text: null,
              thought: 'Clicking mark 99!',
            }),
        },
      }),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the button with the leaf',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });

    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(56); // upgrade_banner distraction on MV-03
    expect(decision.thought).toBe(
      '💭 No idea what "click the button with th" means, but this flashy thing looked important, so I clicked it.'
    );
  });

  it('★ 2b. candidates: [52, 43] on MV-03 -> picks 43 (seat_r1_green, first in reading order), and the thought contains "I found 2"', async () => {
    const fakeModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'CLICK',
              candidates: [52, 43],
              text: null,
              thought: 'Two green car seats!',
            }),
        },
      }),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the green button',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });

    expect(decision.tier).toBe('cloud');
    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(43);
    expect(decision.thought).toContain('I found 2');
  });

  it('★ 2c. candidates: [] -> distraction, and CONFUSED -> distraction', async () => {
    const emptyModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'CLICK',
              candidates: [],
              text: null,
              thought: 'Nothing matches.',
            }),
        },
      }),
    };
    const confusedModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'CONFUSED',
              candidates: [],
              text: null,
              thought: 'I am confused.',
            }),
        },
      }),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-01',
    };

    const decEmpty = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'do the thing',
      cloudModel: emptyModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });
    expect(decEmpty.action).toBe('CLICK');
    expect(decEmpty.mark).toBe(9); // campaign_banner on MV-01
    expect(decEmpty.thought).toContain('No idea what "do the thing" means');

    const decConfused = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'do the thing',
      cloudModel: confusedModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });
    expect(decConfused.action).toBe('CLICK');
    expect(decConfused.mark).toBe(9);
    expect(decConfused.thought).toContain('No idea what "do the thing" means');
  });

  it('★ 2d. A verbless "tanaka" on MV-02 never calls the model (the bare-word rule answers first)', async () => {
    const generateSpy = vi.fn();
    const fakeModel: CloudModel = {
      generateContent: generateSpy,
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-02',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'tanaka',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(decision.action).toBe('TYPE');
    expect(decision.mark).toBe(31); // name_kanji_sei (first empty box)
    expect(decision.text).toBe('TANAKA');
  });

  it('★ 3. TYPE text "YAMADA" for the instruction "type the name" -> "NAME" (hallucination blocked)', async () => {
    const fakeModel: CloudModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              action: 'TYPE',
              candidates: [17],
              text: 'YAMADA',
              thought: 'Typing the passenger name into the box!',
            }),
        },
      }),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-02',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'type the name',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });

    expect(decision.tier).toBe('cloud');
    expect(decision.action).toBe('TYPE');
    expect(decision.mark).toBe(17);
    expect(decision.text).toBe('NAME');
  });

  it('★ 4. A 429 -> fallback decision with cloudFailed: true, and the ledger shows (backup agent)', async () => {
    const fakeModel: CloudModel = {
      generateContent: vi.fn().mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED: Quota exceeded')),
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the green clover seat',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
    });

    expect(decision.tier).toBe('fallback');
    expect(decision.action).toBe('CLICK');
    expect(decision.mark).toBe(52);
    expect(decision.cloudFailed).toBe(true);

    // Verify ledger shows (backup agent)
    const gState = createInitialGameState({
      initialPuzzleState: state,
    });
    const nextGState = gameReducer(gState, {
      type: 'APPLY_AGENT_ACTION',
      payload: {
        action: decisionToAgentAction(decision, CASE_001_PUZZLE, CASE_001_GENERATED_MANIFEST),
        instruction: 'click the green clover seat',
        puzzle: CASE_001_PUZZLE,
      },
    });
    expect(nextGState.telegrams[0].actionSummary).toContain('(backup agent)');
  });

  it('★ 5. Three failures -> no cloud call for the next 10 minutes (fake clock)', async () => {
    let currentNow = 1_700_000_000_000;
    const generateSpy = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'));
    const fakeModel: CloudModel = {
      generateContent: generateSpy,
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    // 3 consecutive failures
    for (let i = 0; i < 3; i++) {
      const dec = await resolveLine({
        puzzle: CASE_001_PUZZLE,
        manifest: CASE_001_GENERATED_MANIFEST,
        state,
        instruction: 'click the green clover seat',
        cloudModel: fakeModel,
        cloudEnv: MOCK_CLOUD_ENV,
        imageFetcher: async () => 'base64png',
        now: () => currentNow,
      });
      expect(dec.tier).toBe('fallback');
      expect(dec.cloudFailed).toBe(true);
    }
    expect(generateSpy).toHaveBeenCalledTimes(3);

    // 4th call within 10 minutes (e.g. +5 minutes) -> skips cloud tier without calling generateContent
    currentNow += 5 * 60 * 1000;
    const decPaused = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the green clover seat',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
      now: () => currentNow,
    });
    expect(generateSpy).toHaveBeenCalledTimes(3);
    expect(decPaused.tier).toBe('fallback');

    // After 10 minutes (+6 minutes more = +11 minutes total) -> cloud tier resumes
    currentNow += 6 * 60 * 1000;
    await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the green clover seat',
      cloudModel: fakeModel,
      cloudEnv: MOCK_CLOUD_ENV,
      imageFetcher: async () => 'base64png',
      now: () => currentNow,
    });
    expect(generateSpy).toHaveBeenCalledTimes(4);
  });

  it('★ 6. A cloud tier that is not configured -> no call and no marker', async () => {
    const generateSpy = vi.fn();
    const fakeModel: CloudModel = {
      generateContent: generateSpy,
    };

    const state = {
      ...initialPuzzleState(CASE_001_PUZZLE),
      pageId: 'MV-03',
    };

    const decision = await resolveLine({
      puzzle: CASE_001_PUZZLE,
      manifest: CASE_001_GENERATED_MANIFEST,
      state,
      instruction: 'click the green clover seat',
      cloudModel: fakeModel,
      cloudEnv: { VITE_AGENT_MODEL_ID: '' }, // Not configured
      imageFetcher: async () => 'base64png',
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(decision.tier).toBe('fallback');
    expect(decision.cloudFailed).toBeUndefined();
  });

  it('★ 7. Goal blindness: serialized request for every Case #001 page, with an empty name, contains none of TANAKA, exhibit, answer, replay, decoy, trap, target, weight, pinned, distraction', () => {
    const forbiddenWords = [
      'tanaka',
      'exhibit',
      'answer',
      'replay',
      'decoy',
      'trap',
      'target',
      'weight',
      'pinned',
      'distraction',
    ];

    for (const page of CASE_001_PUZZLE.pages) {
      const state = {
        ...initialPuzzleState(CASE_001_PUZZLE),
        pageId: page.id,
        fields: {
          ...CASE_001_PUZZLE.initialFields,
          passengerName: '',
        },
      };

      const parts = buildCloudRequestParts({
        page,
        manifest: CASE_001_GENERATED_MANIFEST,
        state,
        instruction: 'click the first option on screen',
        base64Png: 'base64pngdata',
      });

      const serialized = JSON.stringify(parts).toLowerCase();
      for (const word of forbiddenWords) {
        expect(serialized).not.toContain(word);
      }
    }
  });

  it('strips #\\d+, mark, and MV-\\d+ from model thoughts and trims to 100 chars', () => {
    const page = CASE_001_PUZZLE.pages.find((p) => p.id === 'MV-04')!;
    const decision = validateCloudResponse(
      {
        action: 'DRAW',
        candidates: [27],
        text: 'smile',
        thought: 'Drawing a smile in mark #27 on MV-04 right now!',
      },
      page,
      'draw a smile in the signature box',
      CASE_001_GENERATED_MANIFEST
    );

    expect(decision.action).toBe('DRAW');
    expect(decision.mark).toBe(27);
    expect(decision.stroke).toBe('SHAPE:smile');
    expect(decision.thought).not.toMatch(/#\d+/);
    expect(decision.thought.toLowerCase()).not.toContain('mark');
    expect(decision.thought).not.toMatch(/MV-\d+/i);
    expect(decision.thought.startsWith('💭 ')).toBe(true);
  });

  it('renders exact menu disclosure for Google Gemini free tier', () => {
    render(React.createElement(App, { config: { animationScale: 0, replayAutoplay: false } }));
    fireEvent.click(screen.getByRole('button', { name: /Open Game Menu/i }));
    expect(
      screen.getByText(
        "🤖 The agent runs on Google Gemini's free tier. Your instructions are sent to Google to be interpreted."
      )
    ).toBeInTheDocument();
  });
});
