/**
 * tools/lib/types.ts
 *
 * Common types, interfaces, error classes, and deterministic exit codes
 * for the Instruct puzzle compiler pipeline.
 */

import type { AgentActionType } from '../../src/types/engine';

// =============================================================================
// Deterministic Exit Codes
// =============================================================================
export const EXIT_SUCCESS = 0;
export const EXIT_INVALID_ARGS = 1;
export const EXIT_RESOURCE_NOT_FOUND = 2;
export const EXIT_SANITIZATION_FAILED = 3;
export const EXIT_GEOMETRY_VIOLATION = 4;
export const EXIT_INVARIANT_VIOLATION = 5;
export const EXIT_BROWSER_ERROR = 6;
export const EXIT_IO_ERROR = 7;

// =============================================================================
// Custom Compiler Error Hierarchy
// =============================================================================
export class CompilerError extends Error {
  public readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'CompilerError';
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CompilerArgumentError extends CompilerError {
  constructor(message: string) {
    super(`[CompilerArgumentError] ${message}`, EXIT_INVALID_ARGS);
    this.name = 'CompilerArgumentError';
  }
}

export class ResourceNotFoundError extends CompilerError {
  constructor(message: string) {
    super(`[ResourceNotFoundError] ${message}`, EXIT_RESOURCE_NOT_FOUND);
    this.name = 'ResourceNotFoundError';
  }
}

export class SanitizationError extends CompilerError {
  constructor(message: string) {
    super(`[SanitizationError] ${message}`, EXIT_SANITIZATION_FAILED);
    this.name = 'SanitizationError';
  }
}

// Backward-compatible alias matching Explorer 1
export const CompilerValidationError = SanitizationError;
export type CompilerValidationError = SanitizationError;

export class GeometryViolationError extends CompilerError {
  constructor(message: string) {
    super(`[GeometryViolationError] ${message}`, EXIT_GEOMETRY_VIOLATION);
    this.name = 'GeometryViolationError';
  }
}

export class SchemaInvariantError extends CompilerError {
  constructor(message: string) {
    super(`[SchemaInvariantError] ${message}`, EXIT_INVARIANT_VIOLATION);
    this.name = 'SchemaInvariantError';
  }
}

export class BrowserAutomationError extends CompilerError {
  constructor(message: string) {
    super(`[BrowserAutomationError] ${message}`, EXIT_BROWSER_ERROR);
    this.name = 'BrowserAutomationError';
  }
}

export class FileSystemIoError extends CompilerError {
  constructor(message: string) {
    super(`[FileSystemIoError] ${message}`, EXIT_IO_ERROR);
    this.name = 'FileSystemIoError';
  }
}

// =============================================================================
// Options & Configuration Interfaces
// =============================================================================
export type SomDensity = 'sparse' | 'standard' | 'dense';

export interface CompilerOptions {
  url?: string;
  fixture?: string;
  caseId?: string;
  outDir: string;
  somDensity: SomDensity;
  offline: boolean;
  validate: boolean;
  dryRun: boolean;
  verbose: boolean;
  help?: boolean;
}

export interface SanitizerOptions {
  baseDir?: string;
  allowInlineStyles?: boolean;
}

export interface SanitizationReport {
  sanitizedHtml: string;
  strippedTagsCount: number;
  strippedEventHandlersCount: number;
  inlinedStylesheetsCount: number;
  detectedControlsCount: number;
}

export interface CompilerLaunchOptions {
  headless?: boolean;
  offline?: boolean;
  executablePath?: string;
}

export interface BadgeGeometry {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  badgeX: number;
  badgeY: number;
  badgeWidth: number;
  badgeHeight: number;
  label: string;
}

export interface RawDiscoveredElement {
  somId: number;
  selector: string;
  tag: string;
  role: string;
  text: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visualAttributes: {
    bgColor: string;
    color: string;
    glyph?: string;
    description?: string;
  };
  isTarget: boolean;
  isTrap: boolean;
  isInert: boolean;
  actionType?: AgentActionType;
}

export interface ScreenshotCaptureOptions {
  cleanPath: string;
  somPath: string;
  stageWidth?: number;
  stageHeight?: number;
  quality?: number;
}
