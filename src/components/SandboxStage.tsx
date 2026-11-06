import React, { useRef, useState, useLayoutEffect } from 'react';
import type { SandboxStageProps } from '../types/ui';
import ShinkansenSandbox from './ShinkansenSandbox';
import GhostReplay from './GhostReplay';
import AgentCursor from './AgentCursor';
import { CASE_042_GHOST_REPLAY } from '../data/puzzles/case_042';

export const SandboxStage: React.FC<SandboxStageProps & { children?: React.ReactNode }> = ({
  macroViewId = 'MV-03',
  microState,
  agentCursor,
  ghostReplayActive,
  somOverlayActive,
  stageShake,
  scaleFactor: externalScale,
  somElements,
  ghostReplay,
  onElementClick,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalScale, setInternalScale] = useState<number>(1);

  // Responsive scale calculation via ResizeObserver
  useLayoutEffect(() => {
    if (externalScale !== undefined) {
      setInternalScale(externalScale);
      return;
    }

    const updateScale = () => {
      if (containerRef.current) {
        const measuredWidth = containerRef.current.clientWidth;
        if (measuredWidth > 0) {
          const s = Math.min(measuredWidth / 1024, 1);
          setInternalScale(s);
        }
      }
    };

    updateScale();

    // ResizeObserver for dynamic container resizes
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        updateScale();
      });
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateScale);
    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', updateScale);
    };
  }, [externalScale]);

  // Anti-copy event handlers preventing clipboard inspection of Japanese text
  const handleCopyProtection = (e: React.SyntheticEvent) => {
    e.preventDefault();
  };

  const currentMacroViewNum = macroViewId.replace(/^[A-Za-z_-]+/, '') || '3';

  return (
    <div
      ref={containerRef}
      id="sandbox-stage"
      data-testid="sandbox-stage"
      className="w-full relative overflow-hidden bg-neutral-100 border-2 border-dossier-ink select-none no-select"
      style={{
        height: `${Math.round(768 * internalScale)}px`,
      }}
      onCopy={handleCopyProtection}
      onCut={handleCopyProtection}
      onPaste={handleCopyProtection}
      onContextMenu={handleCopyProtection}
      onDragStart={handleCopyProtection}
    >
      {/* Fixed 1024x768 Coordinate Canvas with Uniform CSS Scale Transform */}
      <div
        id="sandbox-core"
        data-testid="sandbox-core"
        className={`bg-white text-neutral-900 no-select relative overflow-hidden flex flex-col justify-between ${
          stageShake ? 'shake-anim' : ''
        }`}
        style={{
          width: '1024px',
          height: '768px',
          transform: `scale(${internalScale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Simulated Browser Chrome Bar */}
        <div className="bg-neutral-200 border-b border-neutral-400 px-3 py-1 flex items-center justify-between text-xs text-neutral-700 font-mono-clean h-[32px] select-none shrink-0">
          {/* Simulated Browser Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-neutral-400">
              <span className="cursor-not-allowed text-xs font-bold px-1 bg-neutral-300 rounded" title="Back">◀</span>
              <span className="cursor-not-allowed text-xs font-bold px-1 bg-neutral-300 rounded" title="Forward">▶</span>
              <span className="cursor-pointer text-xs font-bold px-1 bg-neutral-300 hover:bg-neutral-400 rounded text-neutral-700" title="Refresh">↻</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-neutral-300 px-2 py-0.5 rounded text-neutral-800 text-[11px]">
              <span className="text-neutral-500">🔒</span>
              <span className="font-mono-clean truncate max-w-[500px]">
                sandbox://ekinet-jr-sim.jp/reserve/seat-matrix (Macro-View {currentMacroViewNum} of 9)
              </span>
            </div>
          </div>

          {/* Anti-Copy Text Lock Status Indicator */}
          <div className="flex items-center gap-1 font-bold text-red-700 text-[11px] uppercase tracking-wider">
            <span>🔒 TEXT SELECTION LOCKED</span>
          </div>
        </div>

        {/* 1024x736 Interactive Content Region */}
        <div className="relative w-full h-[736px] overflow-hidden flex-1">
          {children ? (
            children
          ) : (
            <>
              {/* Default Sandbox DOM clone */}
              <ShinkansenSandbox
                microState={microState}
                somOverlayActive={somOverlayActive}
                onElementClick={onElementClick}
                somElements={somElements}
              />

              {/* Default Ghost Replay Overlay */}
              <GhostReplay
                active={ghostReplayActive}
                onToggle={() => {}}
                trajectory={ghostReplay ?? CASE_042_GHOST_REPLAY}
              />

              {/* Default Agent Cursor */}
              {agentCursor && (
                <AgentCursor
                  xPercent={agentCursor.xPercent}
                  yPercent={agentCursor.yPercent}
                  thoughtText={agentCursor.thought}
                  variant={agentCursor.variant}
                  isTrap={agentCursor.variant === 'trap'}
                  isShaking={agentCursor.isShaking}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SandboxStage;
