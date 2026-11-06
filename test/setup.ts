import '@testing-library/jest-dom';
import { vi } from 'vitest';

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
