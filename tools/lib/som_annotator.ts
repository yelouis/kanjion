/**
 * tools/lib/som_annotator.ts
 *
 * Set-of-Mark (SoM) badge overlay injection, boundary clamping,
 * SVG overlay generation, and dual screenshot capture (clean vs marked).
 */

import type { Page } from '@playwright/test';
import type { BoundingBox, SoMElement } from '../../src/types/puzzle';
import {
  STAGE_WIDTH,
  STAGE_HEIGHT,
  gridToBoundingBox,
} from '../../src/utils/coordinate_projector';
import type { BadgeGeometry, ScreenshotCaptureOptions } from './types';

/**
 * Computes exact pixel coordinates and dimensions for a numbered Set-of-Mark badge.
 * Defaults to top-right corner with auto-flip to top-left when flush against right margin.
 * Strictly clamps within [2, stage - 2].
 */
export function computeBadgeGeometry(
  box: BoundingBox,
  somId: string,
  stageWidth = STAGE_WIDTH,
  stageHeight = STAGE_HEIGHT
): BadgeGeometry {
  const digitCount = somId.replace(/\D/g, '').length;
  const badgeWidth = digitCount >= 3 ? 36 : 28;
  const badgeHeight = 18;

  // Default Anchor: Top-Right of element, offset by 6px horizontally and 8px vertically
  let badgeX = box.x + box.width - 6;
  let badgeY = box.y - 8;

  // If element is flush with right boundary, flip anchor to Top-Left
  if (box.x + box.width > stageWidth - 10) {
    badgeX = box.x - 2;
  }

  // Strict boundary clamping within [2, stage - badge - 2]
  badgeX = Math.max(2, Math.min(badgeX, stageWidth - badgeWidth - 2));
  badgeY = Math.max(2, Math.min(badgeY, stageHeight - badgeHeight - 2));

  return {
    boxX: box.x,
    boxY: box.y,
    boxWidth: box.width,
    boxHeight: box.height,
    badgeX,
    badgeY,
    badgeWidth,
    badgeHeight,
    label: somId.startsWith('#') ? somId : `#${somId}`,
  };
}

/**
 * Generates an SVG string representation of the Set-of-Mark overlay layer.
 * Includes reticles, fuchsia badge pills (#C026D3), white text, and drop shadows.
 */
export function generateSvgSomOverlay(
  elements: SoMElement[],
  width = STAGE_WIDTH,
  height = STAGE_HEIGHT
): string {
  const reticles: string[] = [];
  const badges: string[] = [];

  for (const el of elements) {
    const box = el.boundingBox ?? (el.gridRef ? gridToBoundingBox(el.gridRef) : { x: 0, y: 0, width: 100, height: 30 });
    const geo = computeBadgeGeometry(box, el.somId, width, height);

    // Reticle
    reticles.push(
      `  <rect x="${geo.boxX}" y="${geo.boxY}" width="${geo.boxWidth}" height="${geo.boxHeight}" ` +
      `fill="none" stroke="#C026D3" stroke-width="2" rx="2" />`
    );

    // Badge Group (Background rect + Monospace bold text)
    const textX = geo.badgeX + geo.badgeWidth / 2;
    const textY = geo.badgeY + geo.badgeHeight / 2 + 4; // Baseline centering

    badges.push(
      `  <g class="som-badge" data-som-id="${el.somId}">\n` +
      `    <rect x="${geo.badgeX}" y="${geo.badgeY}" width="${geo.badgeWidth}" height="${geo.badgeHeight}" ` +
      `fill="#C026D3" stroke="#FFFFFF" stroke-width="1" rx="2" filter="url(#drop-shadow)" />\n` +
      `    <text x="${textX}" y="${textY}" fill="#FFFFFF" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace" ` +
      `font-size="12" font-weight="bold" text-anchor="middle">${geo.label}</text>\n` +
      `  </g>`
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="pointer-events:none;">`,
    `  <defs>`,
    `    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">`,
    `      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.45" />`,
    `    </filter>`,
    `  </defs>`,
    `  <!-- Bounding Reticles -->`,
    ...reticles,
    `  <!-- Set-of-Mark Badges -->`,
    ...badges,
    `</svg>`,
  ].join('\n');
}

/**
 * Injects a standalone, non-intrusive DOM overlay containing reticles and badges
 * into the page inside Playwright.
 */
export async function injectDomSomOverlay(
  page: Page,
  elements: SoMElement[],
  stageWidth = STAGE_WIDTH,
  stageHeight = STAGE_HEIGHT
): Promise<void> {
  await page.evaluate(
    ({ els, w, h }) => {
      document.getElementById('som-overlay-layer')?.remove();

      const container = document.createElement('div');
      container.id = 'som-overlay-layer';
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${w}px;
        height: ${h}px;
        pointer-events: none;
        z-index: 999999;
        overflow: hidden;
      `;

      for (const el of els) {
        const box = el.boundingBox ?? { x: 0, y: 0, width: 100, height: 30 };
        const digitCount = el.somId.replace(/\D/g, '').length;
        const bw = digitCount >= 3 ? 36 : 28;
        const bh = 18;
        let bx = box.x + box.width - 6;
        let by = box.y - 8;
        if (box.x + box.width > w - 10) bx = box.x - 2;
        bx = Math.max(2, Math.min(bx, w - bw - 2));
        by = Math.max(2, Math.min(by, h - bh - 2));

        const reticle = document.createElement('div');
        reticle.className = 'som-reticle';
        reticle.style.cssText = `
          position: absolute;
          left: ${box.x}px;
          top: ${box.y}px;
          width: ${box.width}px;
          height: ${box.height}px;
          border: 2px solid #C026D3;
          border-radius: 2px;
          box-sizing: border-box;
          pointer-events: none;
        `;

        const badge = document.createElement('span');
        badge.className = 'som-badge';
        badge.innerText = el.somId;
        badge.style.cssText = `
          position: absolute;
          left: ${bx}px;
          top: ${by}px;
          width: ${bw}px;
          height: ${bh}px;
          background-color: #C026D3;
          color: #FFFFFF;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          font-weight: 700;
          line-height: ${bh - 2}px;
          text-align: center;
          border: 1px solid #FFFFFF;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
          box-sizing: border-box;
          pointer-events: none;
          z-index: 1000000;
        `;

        container.appendChild(reticle);
        container.appendChild(badge);
      }

      document.body.appendChild(container);
    },
    { els: elements, w: stageWidth, h: stageHeight }
  );
}

/**
 * Removes the injected DOM overlay from the page.
 */
export async function removeDomSomOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('som-overlay-layer')?.remove();
  });
}

/**
 * Captures clean and Set-of-Mark screenshots with pixel-perfect registration.
 */
export async function captureDualScreenshots(
  page: Page,
  elements: SoMElement[],
  options: ScreenshotCaptureOptions
): Promise<{ cleanPath: string; somPath: string }> {
  const {
    cleanPath,
    somPath,
    stageWidth = STAGE_WIDTH,
    stageHeight = STAGE_HEIGHT,
    quality = 90,
  } = options;

  const clipRegion = { x: 0, y: 0, width: stageWidth, height: stageHeight };

  // 1. Ensure fonts are fully rasterized
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  // 2. Capture Clean Stage Screenshot (without any badges)
  await page.screenshot({
    path: cleanPath,
    type: 'webp',
    quality,
    clip: clipRegion,
  });

  // 3. Inject DOM Set-of-Mark Overlay
  await injectDomSomOverlay(page, elements, stageWidth, stageHeight);

  // 4. Capture Marked Stage Screenshot (with injected SoM badges)
  await page.screenshot({
    path: somPath,
    type: 'webp',
    quality,
    clip: clipRegion,
  });

  // 5. Cleanup injected DOM overlay
  await removeDomSomOverlay(page);

  return { cleanPath, somPath };
}
