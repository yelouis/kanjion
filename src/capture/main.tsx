import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-jp/900.css';
import '../index.css';
import { CASE_001_PUZZLE } from '../data/puzzles/case_001/puzzle';
import { Sandbox } from '../data/puzzles/case_001/Sandbox';
import type { FieldValue, PuzzleState } from '../types/puzzle_data';

const PAGE_SLUGS: Record<string, string> = {
  'MV-01': 'route-select',
  'MV-02': 'passenger',
  'MV-03': 'seats',
  'MV-04': 'confirm',
  'MV-05': 'ticket',
  'MV-07': 'cancel',
  'MV-08': 'news',
  'MV-10': 'tohoku',
  'MV-11': 'hokuriku',
  'MV-12': 'points',
};

const params = new URLSearchParams(window.location.search);
const pageId = params.get('page') || CASE_001_PUZZLE.initialPageId;
const preset = CASE_001_PUZZLE.capturePresets?.[pageId] ?? {};

const state: PuzzleState = {
  pageId,
  previousPageId: 'MV-01',
  fields: {
    ...CASE_001_PUZZLE.initialFields,
    ...preset,
  } as Record<string, FieldValue>,
};

const pageSlug = PAGE_SLUGS[pageId] ?? 'route-select';
const stageUrl = `sandbox://kanjion-rail.example/reserve/${pageSlug}`;

const CaptureApp: React.FC = () => {
  return (
    <div
      id="sandbox-core"
      data-testid="sandbox-core"
      className="bg-white text-neutral-900 no-select relative overflow-hidden flex flex-col justify-between"
      style={{
        width: '1024px',
        height: '768px',
      }}
    >
      {/* Simulated Browser Chrome Bar (matches SandboxStage.tsx 1:1) */}
      <div className="bg-neutral-200 border-b border-neutral-400 px-3 py-1 flex items-center justify-between text-xs text-neutral-700 font-mono-clean h-[32px] select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-neutral-400">
            <span className="cursor-not-allowed text-xs font-bold px-1 bg-neutral-300 rounded" title="Back">
              ◀
            </span>
            <span className="cursor-not-allowed text-xs font-bold px-1 bg-neutral-300 rounded" title="Forward">
              ▶
            </span>
            <span
              className="cursor-pointer text-xs font-bold px-1 bg-neutral-300 hover:bg-neutral-400 rounded text-neutral-700"
              title="Refresh"
            >
              ↻
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-neutral-300 px-2 py-0.5 rounded text-neutral-800 text-[11px]">
            <span className="text-neutral-500">🔒</span>
            <span className="font-mono-clean truncate max-w-[500px]">{stageUrl}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 font-bold text-red-700 text-[11px] uppercase tracking-wider">
          <span>🔒 TEXT SELECTION LOCKED</span>
        </div>
      </div>

      {/* 1024x736 Interactive Content Region */}
      <div className="w-full h-[736px] overflow-hidden flex-1">
        <Sandbox state={state} activeFlashColumn={2} />
      </div>
    </div>
  );
};

const rootEl = document.getElementById('capture-root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<CaptureApp />);
}
