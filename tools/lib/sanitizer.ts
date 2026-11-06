/**
 * tools/lib/sanitizer.ts
 *
 * Two-tier defense-in-depth HTML/CSS sanitization pipeline for Instruct puzzle sandboxes.
 * Ensures templates are inert, self-contained, script-stripped, and use custom in-DOM controls.
 */

import { JSDOM } from 'jsdom';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SanitizationError,
  type SanitizerOptions,
  type SanitizationReport,
} from './types';

export const FORBIDDEN_TAGS = new Set([
  'script',
  'noscript',
  'iframe',
  'object',
  'embed',
  'applet',
  'base',
  'frame',
  'frameset',
]);

export const FORBIDDEN_INPUT_TYPES = new Set([
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'color',
]);

/**
 * Validates a raw HTML string against security and sandbox invariants without altering it.
 * Used by CLI validation flags and automated test assertions.
 */
export function validateHtmlSanitization(html: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // 1. Script tags
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(html) || /<script\b/gi.test(html)) {
    violations.push('Prohibited <script> tag detected');
  }

  // 2. Embedded frames and objects
  if (/<iframe\b/gi.test(html)) {
    violations.push('Prohibited <iframe> tag detected');
  }
  if (/<object\b/gi.test(html)) {
    violations.push('Prohibited <object> tag detected');
  }
  if (/<embed\b/gi.test(html)) {
    violations.push('Prohibited <embed> tag detected');
  }

  // 3. Inline event handlers (onclick, onload, etc.)
  if (/\bon[a-z0-9_-]+\s*=/gi.test(html)) {
    violations.push('Prohibited inline event handler (onclick, onload, etc.) detected');
  }

  // 4. Executable URIs in links
  if (/href\s*=\s*['"]\s*javascript:/gi.test(html) || /javascript\s*:/gi.test(html)) {
    violations.push('Prohibited javascript: URI detected');
  }

  // 5. Native unstylable select controls
  if (/<select\b/gi.test(html)) {
    violations.push('Prohibited native <select> tag detected; custom in-DOM controls required');
  }

  // 6. Native unstylable input types (date pickers, etc.)
  const inputMatches = html.matchAll(/<input\b[^>]*\btype\s*=\s*['"]?([a-z-]+)['"]?/gi);
  for (const match of inputMatches) {
    const type = match[1].toLowerCase();
    if (FORBIDDEN_INPUT_TYPES.has(type)) {
      violations.push(`Prohibited native <input type="${type}"> detected; custom in-DOM controls required`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Sanitizes a raw HTML template into an inert, self-contained sandbox string.
 * Strips scripts, event handlers, and inlines local stylesheets while rejecting native <select>.
 */
export function sanitizePuzzleHtml(
  rawHtml: string,
  options: SanitizerOptions = {}
): SanitizationReport {
  const dom = new JSDOM(rawHtml);
  const doc: any = dom.window.document;

  let strippedTagsCount = 0;
  let strippedEventHandlersCount = 0;
  let inlinedStylesheetsCount = 0;

  // 1. Tag Stripping: Remove all forbidden executable/embedding tags
  for (const tag of FORBIDDEN_TAGS) {
    const elements = Array.from(doc.querySelectorAll(tag)) as any[];
    for (const el of elements) {
      el.remove();
      strippedTagsCount++;
    }
  }

  // Remove meta http-equiv tags
  const metaHttpEquiv = Array.from(doc.querySelectorAll('meta[http-equiv]')) as any[];
  for (const meta of metaHttpEquiv) {
    meta.remove();
    strippedTagsCount++;
  }

  // Remove HTML imports if any
  const htmlImports = Array.from(doc.querySelectorAll('link[rel="import"]')) as any[];
  for (const imp of htmlImports) {
    imp.remove();
    strippedTagsCount++;
  }

  // 2. Custom in-DOM Controls Validation
  // Rule: Reject native <select> controls (Concept Brief Constraint 4)
  const nativeSelects = doc.querySelectorAll('select');
  if (nativeSelects.length > 0) {
    throw new SanitizationError(
      `Native unstylable control detected: <select> (${nativeSelects.length} found). ` +
      `Puzzle sandboxes must use custom in-DOM dropdowns (div/button combinations) so each option ` +
      `possesses a distinct Set-of-Mark ID and can be targeted by the agent cursor.`
    );
  }

  // Rule: Reject native calendar/time pickers
  const nativeInputs = doc.querySelectorAll('input');
  for (const input of Array.from(nativeInputs) as any[]) {
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (FORBIDDEN_INPUT_TYPES.has(type)) {
      throw new SanitizationError(
        `Native unstylable input control detected: <input type="${type}">. ` +
        `Puzzle sandboxes must use custom in-DOM calendar or stepper controls.`
      );
    }
  }

  // 3. Attribute Sanitization: Strip inline event handlers & javascript: URIs
  const allElements = doc.querySelectorAll('*');
  for (const el of Array.from(allElements) as any[]) {
    const attrs = Array.from(el.attributes) as any[];
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();

      // Inline event handlers: onclick, onload, onerror, onmouseover, etc.
      if (/^on[a-z0-9_-]/i.test(name)) {
        el.removeAttribute(attr.name);
        strippedEventHandlersCount++;
        continue;
      }

      // Scripting URIs in href, src, formaction, action
      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
        if (/^(javascript|vbscript|data:text\/html)/i.test(val)) {
          el.removeAttribute(attr.name);
          strippedEventHandlersCount++;
          continue;
        }
      }

      // Remove dangerous CSS expressions in inline style
      if (name === 'style') {
        const cleanStyle = attr.value
          .replace(/expression\s*\(.*?\)/gi, '')
          .replace(/behavior\s*:\s*url\(.*?\)/gi, '')
          .replace(/-moz-binding\s*:\s*url\(.*?\)/gi, '');
        if (cleanStyle !== attr.value) {
          el.setAttribute('style', cleanStyle);
        }
      }
    }
  }

  // 4. Stylesheet Inlining
  const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')) as any[];
  for (const link of linkTags) {
    const href = link.getAttribute('href');
    if (!href) continue;

    if (/^https?:\/\//i.test(href)) {
      throw new SanitizationError(
        `External CDN stylesheet not permitted: "${href}". All stylesheets must be bundled locally.`
      );
    }

    if (options.baseDir) {
      const resolvedPath = path.resolve(options.baseDir, href);
      if (fs.existsSync(resolvedPath)) {
        const cssContent = fs.readFileSync(resolvedPath, 'utf-8');
        // Sanitize CSS: remove @import
        const sanitizedCss = cssContent.replace(/@import\s+[^;]+;/gi, '/* stripped @import */');

        const styleEl = doc.createElement('style');
        styleEl.setAttribute('data-inlined-from', href);
        styleEl.textContent = sanitizedCss;
        link.replaceWith(styleEl);
        inlinedStylesheetsCount++;
      } else {
        throw new SanitizationError(`Referenced stylesheet not found on disk: "${resolvedPath}"`);
      }
    }
  }

  // 5. Serialize DOM
  const serialized = dom.serialize();

  // 6. Tier 2 Post-Serialization Regex Verification
  const postVerificationChecks: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /<script\b/i, description: 'Surviving <script> tag' },
    { pattern: /<\/?(noscript|iframe|object|embed)\b/i, description: 'Surviving embedded object/iframe' },
    { pattern: /\s+on[a-z0-9_-]+\s*=/i, description: 'Surviving inline event handler attribute' },
    { pattern: /href\s*=\s*['"]\s*javascript:/i, description: 'Surviving javascript: link URI' },
  ];

  for (const check of postVerificationChecks) {
    if (check.pattern.test(serialized)) {
      throw new SanitizationError(`Sanitization bypass detected: ${check.description}`);
    }
  }

  return {
    sanitizedHtml: serialized,
    strippedTagsCount,
    strippedEventHandlersCount,
    inlinedStylesheetsCount,
    detectedControlsCount: doc.querySelectorAll('button, a, input, [role="button"]').length,
  };
}
