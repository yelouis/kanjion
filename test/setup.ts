import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  try {
    window.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
  } catch {
    // Ignore storage clear errors in restricted environments
  }
});

// Mock Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock window.scrollTo
window.scrollTo = vi.fn();

// Mock Navigator Clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
});
