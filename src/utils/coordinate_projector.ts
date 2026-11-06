/**
 * src/utils/coordinate_projector.ts
 *
 * Mathematical coordinate projection and geometric spatial utilities mapping
 * between pixel coordinates (1024x768 stage) and the 4x4 coordinate ruler grid (A1-D4).
 */

import { GridColumn, GridRow, GridCoordinate } from '../types/engine';
import { BoundingBox } from '../types/puzzle';

export const STAGE_WIDTH = 1024;
export const STAGE_HEIGHT = 768;
export const COLUMN_WIDTH = 256; // 1024 / 4
export const ROW_HEIGHT = 192;   // 768 / 4

export const GRID_COLUMNS: readonly GridColumn[] = ['A', 'B', 'C', 'D'] as const;
export const GRID_ROWS: readonly GridRow[] = ['1', '2', '3', '4'] as const;

export interface Point {
  x: number;
  y: number;
}

/**
 * Projects absolute pixel coordinates (x, y) on the 1024x768 stage into a GridCoordinate (e.g. 'D3').
 * Coordinates outside [0, 1024] or [0, 768] are clamped to the nearest edge cell.
 */
export function pixelToGrid(x: number, y: number): GridCoordinate {
  const clampedX = Math.max(0, Math.min(x, STAGE_WIDTH));
  const clampedY = Math.max(0, Math.min(y, STAGE_HEIGHT));

  const colIdx = Math.min(Math.floor(clampedX / COLUMN_WIDTH), GRID_COLUMNS.length - 1);
  const rowIdx = Math.min(Math.floor(clampedY / ROW_HEIGHT), GRID_ROWS.length - 1);

  return `${GRID_COLUMNS[colIdx]}${GRID_ROWS[rowIdx]}` as GridCoordinate;
}

/**
 * Returns the exact bounding box covering the specified 4x4 grid cell.
 */
export function gridToBoundingBox(grid: GridCoordinate): BoundingBox {
  const colChar = grid.charAt(0).toUpperCase() as GridColumn;
  const rowChar = grid.charAt(1) as GridRow;

  const colIdx = GRID_COLUMNS.indexOf(colChar);
  const rowIdx = GRID_ROWS.indexOf(rowChar);

  if (colIdx === -1 || rowIdx === -1) {
    throw new Error(`Invalid grid coordinate: "${grid}". Must be A1 through D4.`);
  }

  const x = colIdx * COLUMN_WIDTH;
  const y = rowIdx * ROW_HEIGHT;

  return {
    x,
    y,
    width: COLUMN_WIDTH,
    height: ROW_HEIGHT,
    xPercent: (x / STAGE_WIDTH) * 100,
    yPercent: (y / STAGE_HEIGHT) * 100,
  };
}

/**
 * Returns the center pixel point (x, y) of the specified grid cell.
 * E.g., 'A1' -> (128, 96), 'D3' -> (896, 480), 'D4' -> (896, 672).
 */
export function gridToCenter(grid: GridCoordinate): Point {
  const box = gridToBoundingBox(grid);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Calculates the center point of an arbitrary bounding box.
 */
export function getBoxCenter(box: BoundingBox): Point {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

/**
 * Determines which grid cell contains the center point of an element's bounding box.
 */
export function boxToGrid(box: BoundingBox): GridCoordinate {
  const center = getBoxCenter(box);
  return pixelToGrid(center.x, center.y);
}

/**
 * Checks whether a given point (x, y) is within the boundaries of a bounding box.
 */
export function isPointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

/**
 * Calculates the Euclidean distance between two points in 1024x768 pixel space.
 */
export function distanceBetween(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Converts a raw tuple [x, y, width, height] into a standard BoundingBox object.
 */
export function tupleToBoundingBox(tuple: [number, number, number, number]): BoundingBox {
  const [x, y, width, height] = tuple;
  return {
    x,
    y,
    width,
    height,
    xPercent: Number(((x / STAGE_WIDTH) * 100).toFixed(2)),
    yPercent: Number(((y / STAGE_HEIGHT) * 100).toFixed(2)),
  };
}

/**
 * Converts a BoundingBox object back into a compact [x, y, width, height] tuple.
 */
export function boundingBoxToTuple(box: BoundingBox): [number, number, number, number] {
  return [box.x, box.y, box.width, box.height];
}

/**
 * Extracts and parses a GridCoordinate from natural language strings or instructions.
 * Matches: "D3", "d4", "D 3", "col d row 3", "row 4 col b", "column A, row 2".
 * Returns null if no valid coordinate is found.
 */
export function parseGridCoordinate(text: string): GridCoordinate | null {
  if (!text) return null;

  // 1. Direct compact coordinate (e.g. 'D3', 'b4', 'A 1')
  const directMatch = text.match(/\b([a-d])\s*([1-4])\b/i);
  if (directMatch) {
    const col = directMatch[1].toUpperCase() as GridColumn;
    const row = directMatch[2] as GridRow;
    return `${col}${row}` as GridCoordinate;
  }

  // 2. Col X Row Y natural language phrasing
  const colRowMatch = text.match(/\bcol(?:umn)?\s*([a-d])\b.*?\brow\s*([1-4])\b/i);
  if (colRowMatch) {
    const col = colRowMatch[1].toUpperCase() as GridColumn;
    const row = colRowMatch[2] as GridRow;
    return `${col}${row}` as GridCoordinate;
  }

  // 3. Row Y Col X inverted phrasing
  const rowColMatch = text.match(/\brow\s*([1-4])\b.*?\bcol(?:umn)?\s*([a-d])\b/i);
  if (rowColMatch) {
    const row = rowColMatch[1] as GridRow;
    const col = rowColMatch[2].toUpperCase() as GridColumn;
    return `${col}${row}` as GridCoordinate;
  }

  return null;
}
