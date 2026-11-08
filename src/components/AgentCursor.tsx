import React, { useEffect, useMemo, useRef, useState } from 'react';

const ELEMENT_ID_TO_DOM_SELECTOR: Record<string, string> = {
  '1': '#btn-route-tokaido',
  '#1': '#btn-route-tokaido',
  '2': '#btn-route-tohoku',
  '#2': '#btn-route-tohoku',
  '3': '#btn-route-hokuriku',
  '#3': '#btn-route-hokuriku',
  '4': '#btn-route-points',
  '#4': '#btn-route-points',
  '11': '#btn-logout',
  '#11': '#btn-logout',
  '12': '#btn-promo-insurance',
  '#12': '#btn-promo-insurance',
  '14': '#btn-back-conditions',
  '#14': '#btn-back-conditions',
  '17': '#input-passenger-name',
  '#17': '#input-passenger-name',
  '21': '#btn-hikari-free',
  '#21': '#btn-hikari-free',
  '22': '#btn-hikari-res',
  '#22': '#btn-hikari-res',
  '23': '#btn-nozomi-free',
  '#23': '#btn-nozomi-free',
  '24': '#btn-nozomi-res',
  '#24': '#btn-nozomi-res',
  '25': '#target-green-btn',
  '#25': '#target-green-btn',
  '27': '#signature-canvas',
  '#27': '#signature-canvas',
  '28': '#ins-checkbox',
  '#28': '#ins-checkbox',
  '29': '#btn-cancel-booking',
  '#29': '#btn-cancel-booking',
  '30': '#target-confirm-btn',
  '#30': '#target-confirm-btn',
};

export interface AgentCursorProps {
  /** Left position as a percentage of stage width (0 to 100). */
  xPercent: number;
  /** Top position as a percentage of stage height (0 to 100). */
  yPercent: number;
  /** Optional target element ID (e.g. '#25' or '#30') so the cursor lands directly on the real DOM button. */
  targetElementId?: string | null;
  /** Explanatory field note displayed on the pinned yellow sticky note (max 80 chars). */
  thoughtText?: string;
  /** Alias for thoughtText matching AgentCursorState. */
  thought?: string;
  /** Visual theme variant of the cursor and thought note. */
  variant?: 'idle' | 'executing' | 'confirmed' | 'trap' | 'confused';
  /** Whether decoy trap shake animation class is applied to the cursor. */
  isTrap?: boolean;
  /** Explicit shake control flag. */
  isShaking?: boolean;
  /** Visual pointer icon style: tactical crosshair bullseye vs standard pointer. */
  cursorStyle?: 'crosshair' | 'bullseye' | 'pointer';
  /** Optional custom CSS classes. */
  className?: string;
}

export const AgentCursor: React.FC<AgentCursorProps> = ({
  xPercent,
  yPercent,
  targetElementId = null,
  thoughtText,
  thought,
  variant = 'idle',
  isTrap = false,
  isShaking = false,
  cursorStyle = 'crosshair',
  className = '',
}) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [measuredCoords, setMeasuredCoords] = useState<{ x: number; y: number } | null>(null);

  // Measure actual DOM button center when running in a real browser (stageRect.width > 0)
  useEffect(() => {
    if (!targetElementId) {
      setMeasuredCoords(null);
      return;
    }

    const selector = ELEMENT_ID_TO_DOM_SELECTOR[String(targetElementId).trim()];
    if (!selector || !cursorRef.current) {
      setMeasuredCoords(null);
      return;
    }

    const stageEl = cursorRef.current.closest('#sandbox-core') as HTMLElement | null;
    if (!stageEl) {
      setMeasuredCoords(null);
      return;
    }

    const stageRect = stageEl.getBoundingClientRect();
    // In JSDOM unit tests, getBoundingClientRect().width is 0, so we preserve fallback xPercent/yPercent
    if (stageRect.width <= 0 || stageRect.height <= 0) {
      setMeasuredCoords(null);
      return;
    }

    const targetEl = stageEl.querySelector(selector) as HTMLElement | null;
    if (!targetEl) {
      setMeasuredCoords(null);
      return;
    }

    const targetRect = targetEl.getBoundingClientRect();
    if (targetRect.width <= 0 || targetRect.height <= 0) {
      setMeasuredCoords(null);
      return;
    }

    const exactX = ((targetRect.left + targetRect.width / 2 - stageRect.left) / stageRect.width) * 100;
    const exactY = ((targetRect.top + targetRect.height / 2 - stageRect.top) / stageRect.height) * 100;
    setMeasuredCoords({
      x: Number(exactX.toFixed(2)),
      y: Number(exactY.toFixed(2)),
    });
  }, [targetElementId, xPercent, yPercent]);

  // 1. Resolve active text and enforce strict 80-character limit
  const rawText = thought ?? thoughtText ?? '📌 FIELD AGENT: Awaiting instruction...';
  const sanitizedThought = useMemo(() => {
    const trimmed = rawText.trim();
    return trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed;
  }, [rawText]);

  // Strip any trailing " at D3" / " at D4" grid suffix
  const visibleThought = useMemo(() => {
    const match = sanitizedThought.match(/^(.*?)(\s+at\s+[A-D][1-4])$/i);
    return match ? match[1] : sanitizedThought;
  }, [sanitizedThought]);

  // 2. Resolve active theme variant
  const activeVariant = useMemo(() => {
    if (isTrap || variant === 'trap') return 'trap';
    if (variant === 'confused') return 'confused';
    if (variant === 'confirmed') return 'confirmed';
    if (variant === 'executing') return 'executing';
    return 'idle';
  }, [isTrap, variant]);

  // 3. Coordinate clamping within stage margins
  const effectiveX = measuredCoords ? measuredCoords.x : xPercent;
  const effectiveY = measuredCoords ? measuredCoords.y : yPercent;
  const clampedX = Math.max(2, Math.min(effectiveX, 96));
  const clampedY = Math.max(2, Math.min(effectiveY, 96));

  // 4. Edge-flipping logic: flip note to left if cursor is near right border
  const isFlippedLeft = clampedX > 72;
  const noteAlignmentClass = isFlippedLeft
    ? 'right-full mr-3 -top-2'
    : 'left-full ml-3 -top-2';

  // 5. Theme token configurations
  const themeStyles = useMemo(() => {
    switch (activeVariant) {
      case 'trap':
        return {
          noteBg: 'bg-[#FACC15] text-[#111111] border-[#111111]',
          badgeText: '[ACTION EXECUTED]',
          badgeClass: 'bg-[#111111] text-[#FACC15] border-black',
          reticleColor: '#FACC15',
          tapeColor: 'bg-amber-200/80 border-amber-300',
          rippleBorder: 'border-amber-400',
          rippleBg: 'bg-amber-400/35',
        };
      case 'confused':
        return {
          noteBg: 'bg-[#FEF08A] text-[#111111] border-[#111111]',
          badgeText: '[💭 AGENT THOUGHT]',
          badgeClass: 'bg-[#111111] text-[#FACC15] border-black',
          reticleColor: '#FACC15',
          tapeColor: 'bg-amber-200/80 border-amber-300',
          rippleBorder: 'border-amber-400',
          rippleBg: 'bg-amber-400/20',
        };
      case 'confirmed':
        return {
          noteBg: 'bg-[#111111] text-[#FACC15] border-[#FACC15]',
          badgeText: '[✓ CONFIRMED STEP]',
          badgeClass: 'bg-[#FACC15] text-[#111111] border-black',
          reticleColor: '#2563EB',
          tapeColor: 'bg-amber-100/70 border-amber-300',
          rippleBorder: 'border-amber-400',
          rippleBg: 'bg-amber-400/35',
        };
      case 'executing':
        return {
          noteBg: 'bg-[#FACC15] text-[#111111] border-[#111111]',
          badgeText: '[ACTION EXECUTED]',
          badgeClass: 'bg-[#111111] text-[#FACC15] border-black',
          reticleColor: '#FACC15',
          tapeColor: 'bg-amber-200/80 border-amber-300',
          rippleBorder: 'border-amber-400',
          rippleBg: 'bg-amber-400/35',
        };
      case 'idle':
      default:
        return {
          noteBg: 'bg-[#FEF08A] text-[#111111] border-[#111111]',
          badgeText: '[TELEGRAM READY]',
          badgeClass: 'bg-[#111111] text-white border-black',
          reticleColor: '#FACC15',
          tapeColor: 'bg-amber-200/80 border-amber-300',
          rippleBorder: 'border-amber-300',
          rippleBg: 'bg-amber-300/20',
        };
    }
  }, [activeVariant]);

  const shouldShake = isTrap || isShaking || activeVariant === 'trap' || activeVariant === 'confused';
  const showClickGlow = activeVariant === 'executing' || activeVariant === 'confirmed' || activeVariant === 'trap';

  return (
    <div
      ref={cursorRef}
      id="agent-cursor"
      data-testid="agent-cursor"
      className={`cursor-glide pointer-events-none absolute z-30 ${className}`}
      style={{
        left: `${clampedX}%`,
        top: `${clampedY}%`,
        transform: 'translate(-14px, -14px)', // Center reticle over coordinate
      }}
    >
      <div className={`relative ${shouldShake ? 'shake-anim' : ''}`}>
        {/* CLICK GLOW RIPPLE OVER THE TARGET BUTTON */}
        {showClickGlow && (
          <>
            <div
              aria-hidden="true"
              className={`absolute -inset-4 rounded-full border-4 ${themeStyles.rippleBorder} ${themeStyles.rippleBg} animate-ping pointer-events-none`}
            />
            <div
              aria-hidden="true"
              className={`absolute -inset-2.5 rounded-full border-2 ${themeStyles.rippleBorder} bg-amber-300/25 shadow-[0_0_18px_rgba(250,204,21,0.9)] pointer-events-none`}
            />
          </>
        )}

        {/* TACTICAL SVG CROSSHAIR / BULLSEYE CURSOR */}
        {cursorStyle === 'crosshair' || cursorStyle === 'bullseye' ? (
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-10"
          >
            {/* Outer Target Crosshair Ring */}
            <circle
              cx="14"
              cy="14"
              r="10"
              stroke="#111111"
              strokeWidth="2.5"
              fill="rgba(17,17,17,0.3)"
            />
            <circle
              cx="14"
              cy="14"
              r="10"
              stroke={themeStyles.reticleColor}
              strokeWidth="1.5"
              strokeDasharray="4 2"
              fill="none"
            />
            {/* Precision Crosshair Ticks */}
            <line x1="14" y1="1" x2="14" y2="7" stroke="#111111" strokeWidth="2.5" />
            <line x1="14" y1="1" x2="14" y2="7" stroke={themeStyles.reticleColor} strokeWidth="1.5" />
            <line x1="14" y1="21" x2="14" y2="27" stroke="#111111" strokeWidth="2.5" />
            <line x1="14" y1="21" x2="14" y2="27" stroke={themeStyles.reticleColor} strokeWidth="1.5" />
            <line x1="1" y1="14" x2="7" y2="14" stroke="#111111" strokeWidth="2.5" />
            <line x1="1" y1="14" x2="7" y2="14" stroke={themeStyles.reticleColor} strokeWidth="1.5" />
            <line x1="21" y1="14" x2="27" y2="14" stroke="#111111" strokeWidth="2.5" />
            <line x1="21" y1="14" x2="27" y2="14" stroke={themeStyles.reticleColor} strokeWidth="1.5" />
            {/* Center Bullseye Dot */}
            <circle cx="14" cy="14" r="3.5" fill="#111111" />
            <circle cx="14" cy="14" r="2" fill={themeStyles.reticleColor} />
          </svg>
        ) : (
          /* Classical Pointer Arrow */
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-10"
          >
            <path
              d="M4 2L20 11L13 13L16 21L13 22L10 14L4 19V2Z"
              fill="#111111"
              stroke={themeStyles.reticleColor}
              strokeWidth="2"
            />
          </svg>
        )}

        {/* PINNED YELLOW STICKY THOUGHT NOTE (No confusing percentage readout) */}
        <div
          id="agent-note"
          data-testid="agent-note"
          className={`absolute ${noteAlignmentClass} max-w-[280px] sm:max-w-[340px] px-3 py-1.5 border-2 shadow-ink-sm font-mono-clean text-xs font-bold whitespace-nowrap select-none transition-colors duration-200 ${themeStyles.noteBg}`}
        >
          {/* VINTAGE TRANSLUCENT SCOTCH TAPE GRAPHIC */}
          <div
            aria-hidden="true"
            className={`absolute -top-2.5 left-1/2 -translate-x-1/2 w-8 h-2.5 border-t border-b shadow-xs -rotate-2 pointer-events-none opacity-85 ${themeStyles.tapeColor}`}
          />

          {/* Note Content Header Pill */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-[9px] uppercase tracking-wider px-1 py-0.2 border font-black ${themeStyles.badgeClass}`}
            >
              {themeStyles.badgeText}
            </span>
          </div>

          {/* Thought Text (Strictly clamped to <= 80 characters) */}
          <div className="truncate text-xs font-mono tracking-tight leading-snug">
            <span>{visibleThought}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCursor;
