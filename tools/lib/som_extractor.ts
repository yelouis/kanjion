/**
 * tools/lib/som_extractor.ts
 *
 * Interactive element discovery, visibility checking, ancestor deduplication,
 * bounding box clamping, centroid calculation, and grid projection (COL A–D, ROW 1–4).
 */

import type { Page } from '@playwright/test';
import {
  pixelToGrid,
  STAGE_WIDTH,
  STAGE_HEIGHT,
} from '../../src/utils/coordinate_projector';
import type { SoMElement, BoundingBox } from '../../src/types/puzzle';
import type { RawDiscoveredElement } from './types';

export const INTERACTIVE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="link"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[tabindex="0"]',
  '[data-som-id]',
  '[data-action]',
].join(', ');

/**
 * Builds a standardized SoMElement from a raw discovered element structure.
 * Calculates centroid (cx, cy) and projects to 4x4 coordinate ruler grid.
 */
export function buildSoMElement(raw: RawDiscoveredElement): SoMElement {
  const { rect } = raw;
  const cx = Math.round(rect.x + rect.width / 2);
  const cy = Math.round(rect.y + rect.height / 2);
  const gridRef = pixelToGrid(cx, cy);

  const boundingBox: BoundingBox = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    xPercent: Number(((rect.x / STAGE_WIDTH) * 100).toFixed(2)),
    yPercent: Number(((rect.y / STAGE_HEIGHT) * 100).toFixed(2)),
  };

  const actionType = raw.actionType || (raw.tag === 'input' && raw.role !== 'checkbox' && raw.role !== 'radio' ? 'TYPE' : 'CLICK');

  return {
    id: raw.somId,
    somId: `#${raw.somId}`,
    elementKey: raw.selector.replace(/^[#.]/, '') || `el_${raw.somId}_${raw.tag}`,
    tag: raw.tag,
    role: raw.role,
    boundingBox,
    gridRef,
    text: raw.text,
    visualAttributes: raw.visualAttributes,
    isTarget: raw.isTarget,
    isTrap: raw.isTrap,
    isInert: raw.isInert,
    actionType,
  };
}

/**
 * Evaluates the page in headless Playwright to extract visible, deduplicated interactive elements.
 */
export async function extractInteractiveElements(page: Page): Promise<SoMElement[]> {
  const rawElements = await page.evaluate(
    ({ selector, stageWidth, stageHeight }) => {
      const candidates = Array.from(document.querySelectorAll(selector));
      const results: Array<{
        somId: number;
        selector: string;
        tag: string;
        role: string;
        text: string;
        rect: { x: number; y: number; width: number; height: number };
        visualAttributes: {
          bgColor: string;
          color: string;
          glyph?: string;
          description?: string;
        };
        isTarget: boolean;
        isTrap: boolean;
        isInert: boolean;
        actionType?: 'CLICK' | 'TYPE';
      }> = [];

      let autoIdCounter = 1;

      for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;

        // 1. Ancestor deduplication: Ignore if an ancestor interactive element is already matched
        const hasInteractiveAncestor = el.parentElement?.closest(selector);
        if (hasInteractiveAncestor && !el.hasAttribute('data-som-id')) {
          continue;
        }

        // 2. Computed Style Visibility Check
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') <= 0 ||
          style.pointerEvents === 'none'
        ) {
          continue;
        }

        // 3. Geometry & Bounding Client Rect Check
        const clientRect = el.getBoundingClientRect();
        const width = Math.round(clientRect.width);
        const height = Math.round(clientRect.height);
        const x = Math.round(clientRect.left);
        const y = Math.round(clientRect.top);

        // Reject zero-area elements
        if (width <= 0 || height <= 0) continue;

        // Reject elements strictly outside stage
        if (x + width <= 0 || y + height <= 0 || x >= stageWidth || y >= stageHeight) {
          continue;
        }

        // 4. Resolve SoM ID (explicit attribute or sequential allocation)
        const explicitSomId = el.getAttribute('data-som-id');
        const parsedId = explicitSomId ? parseInt(explicitSomId.replace(/\D/g, ''), 10) : null;
        const somId = parsedId && !isNaN(parsedId) ? parsedId : autoIdCounter++;

        // 5. Extract Text & Glyphs
        const rawText = el.innerText || el.textContent || '';
        const text = rawText.replace(/\s+/g, ' ').trim();

        let glyph: string | undefined;
        if (text.includes('🍀')) glyph = '🍀';
        else if (text.includes('◯')) glyph = '◯';
        else if (text.includes('△')) glyph = '△';
        else if (text.includes('▶')) glyph = '▶';
        else if (text.includes('◀')) glyph = '◀';

        // 6. Role & Flags
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const isTarget = el.getAttribute('data-is-target') === 'true' || el.hasAttribute('data-target');
        const isTrap = el.getAttribute('data-is-trap') === 'true' || el.hasAttribute('data-trap') || style.backgroundColor.includes('rgb(220, 38, 38)');
        const isInert = el.getAttribute('data-is-inert') === 'true' || el.hasAttribute('data-inert');

        // 7. Clamp bounding box to stage boundaries
        const clampedX = Math.max(0, Math.min(x, stageWidth));
        const clampedY = Math.max(0, Math.min(y, stageHeight));
        const clampedWidth = Math.min(width, stageWidth - clampedX);
        const clampedHeight = Math.min(height, stageHeight - clampedY);

        results.push({
          somId,
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          role,
          text,
          rect: {
            x: clampedX,
            y: clampedY,
            width: clampedWidth,
            height: clampedHeight,
          },
          visualAttributes: {
            bgColor: style.backgroundColor,
            color: style.color,
            glyph,
            description: `${role} element with label "${text.slice(0, 30)}"`,
          },
          isTarget,
          isTrap,
          isInert,
        });
      }

      return results;
    },
    { selector: INTERACTIVE_SELECTOR, stageWidth: STAGE_WIDTH, stageHeight: STAGE_HEIGHT }
  );

  return rawElements.map(buildSoMElement);
}
