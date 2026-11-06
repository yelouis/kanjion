/**
 * tools/lib/browser_launcher.ts
 *
 * Playwright browser automation management for the Instruct puzzle compiler.
 * Configures fixed 1024x768 viewport, disables animations, settles fonts,
 * and handles smart executable path discovery with graceful JSDOM fallback.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  BrowserAutomationError,
  GeometryViolationError,
  type CompilerLaunchOptions,
} from './types';

export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 768;

/**
 * Standard browser launch arguments guaranteeing deterministic headless layout.
 */
export const CHROMIUM_COMPILER_ARGS: readonly string[] = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--font-render-hinting=none',
  '--force-color-profile=srgb',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--no-default-browser-check',
  '--no-first-run',
] as const;

/**
 * Probes candidate paths for pre-cached Playwright or Chromium executables.
 */
export function resolveChromiumExecutable(): string | undefined {
  // 1. Explicit environment variable override
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
      return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
  }

  // 2. Playwright built-in resolved executable if present
  try {
    const defaultPath = chromium.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) {
      return defaultPath;
    }
  } catch {
    // Ignore and proceed to directory probing
  }

  // 3. User cache directories (macOS and Linux)
  const home = os.homedir();
  const cacheCandidates = [
    path.join(home, 'Library/Caches/ms-playwright'), // macOS
    path.join(home, '.cache/ms-playwright'),         // Linux
  ];

  for (const cacheBase of cacheCandidates) {
    if (!fs.existsSync(cacheBase)) continue;

    const entries = fs.readdirSync(cacheBase);

    // 3a. Prefer chromium_headless_shell
    const shellDirs = entries.filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
    for (const dir of shellDirs) {
      // macOS ARM64 / x64
      const macCandidate = path.join(cacheBase, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      if (fs.existsSync(macCandidate)) return macCandidate;

      const macX64 = path.join(cacheBase, dir, 'chrome-headless-shell-mac-x64/chrome-headless-shell');
      if (fs.existsSync(macX64)) return macX64;

      // Linux
      const linuxCandidate = path.join(cacheBase, dir, 'chrome-headless-shell-linux/chrome-headless-shell');
      if (fs.existsSync(linuxCandidate)) return linuxCandidate;
    }

    // 3b. Fall back to standard chromium
    const chromeDirs = entries.filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const dir of chromeDirs) {
      // macOS
      const macChrome = path.join(cacheBase, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (fs.existsSync(macChrome)) return macChrome;

      const macChromeX64 = path.join(cacheBase, dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
      if (fs.existsSync(macChromeX64)) return macChromeX64;

      // Linux
      const linuxChrome = path.join(cacheBase, dir, 'chrome-linux/chrome');
      if (fs.existsSync(linuxChrome)) return linuxChrome;
    }
  }

  return undefined;
}

/**
 * Launches the headless browser instance with compiler geometry.
 */
export async function launchCompilerBrowser(options: CompilerLaunchOptions = {}): Promise<Browser> {
  const execPath = options.executablePath || resolveChromiumExecutable();

  try {
    return await chromium.launch({
      headless: options.headless ?? true,
      executablePath: execPath,
      args: [...CHROMIUM_COMPILER_ARGS],
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new BrowserAutomationError(
      `Failed to launch headless browser: ${errorMsg}. ` +
      `Ensure Playwright browsers are installed ('npx playwright install chromium') ` +
      `or run with the '--offline' flag for deterministic compilation without a browser.`
    );
  }
}

/**
 * Creates an isolated browser context strictly clamped to 1024x768 viewport
 * with external HTTP/HTTPS network requests blocked.
 */
export async function createCompilerContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
    },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    userAgent: 'Instruct-Compiler/1.0 (Headless Chromium 1024x768)',
    reducedMotion: 'reduce',
  });

  // Block external network access during compilation for repeatability & security
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('about:')) {
      route.continue();
    } else {
      route.abort('blockedbyclient');
    }
  });

  return context;
}

/**
 * Immutable CSS reset disabling user-agent margin offsets, scrollbars,
 * and animations to ensure reproducible bounding-box measurements.
 */
export const COMPILER_IMMUTABLE_RESET_CSS = `
  /* Instruct Sandbox Normalization Reset */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 1024px !important;
    height: 768px !important;
    max-width: 1024px !important;
    max-height: 768px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    -webkit-font-smoothing: antialiased !important;
    text-rendering: geometricPrecision !important;
  }

  /* Freeze all transitions and animations for deterministic snapshotting */
  *, *::before, *::after {
    animation-delay: -1ms !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

/**
 * Sets HTML content on a page, injects immutable reset styles, awaits web fonts,
 * and asserts viewport boundary invariants.
 */
export async function prepareCompilerPage(page: Page, htmlContent: string): Promise<void> {
  // 1. Set HTML content
  await page.setContent(htmlContent, { waitUntil: 'load' });

  // 2. Inject immutable layout reset
  await page.addStyleTag({ content: COMPILER_IMMUTABLE_RESET_CSS });

  // 3. Await web fonts ready
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  });

  // 4. Assert viewport geometry invariants
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));

  if (dimensions.innerWidth !== STAGE_WIDTH || dimensions.innerHeight !== STAGE_HEIGHT) {
    throw new GeometryViolationError(
      `Viewport boundary violation: Expected ${STAGE_WIDTH}x${STAGE_HEIGHT}, got ${dimensions.innerWidth}x${dimensions.innerHeight}`
    );
  }
}
