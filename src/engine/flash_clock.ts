export const FLASH_PERIOD_MS = 950;

export function currentColumn(nowMs: number = performance.now()): 0 | 1 | 2 {
  const safeNow = Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0;
  return (Math.floor(safeNow / FLASH_PERIOD_MS) % 3) as 0 | 1 | 2;
}

export function msUntilNextColumn(nowMs: number = performance.now()): number {
  const safeNow = Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : 0;
  const remainder = safeNow % FLASH_PERIOD_MS;
  return Math.max(1, Math.ceil(FLASH_PERIOD_MS - remainder));
}

export function waitForColumn(
  col: 0 | 1 | 2,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted || currentColumn() === col) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startMs = performance.now();
    const maxWaitMs = FLASH_PERIOD_MS * 3;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const tick = () => {
      if (signal?.aborted || currentColumn() === col || performance.now() - startMs >= maxWaitMs) {
        cleanup();
        resolve();
        return;
      }
      const delay = Math.min(msUntilNextColumn(), maxWaitMs - (performance.now() - startMs));
      timer = setTimeout(tick, Math.max(1, delay));
    };

    timer = setTimeout(tick, msUntilNextColumn());
  });
}

export function waitForColumnNot(
  col: 0 | 1 | 2,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted || currentColumn() !== col) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startMs = performance.now();
    const maxWaitMs = FLASH_PERIOD_MS;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const tick = () => {
      if (signal?.aborted || currentColumn() !== col || performance.now() - startMs >= maxWaitMs) {
        cleanup();
        resolve();
        return;
      }
      const delay = Math.min(msUntilNextColumn(), maxWaitMs - (performance.now() - startMs));
      timer = setTimeout(tick, Math.max(1, delay));
    };

    timer = setTimeout(tick, msUntilNextColumn());
  });
}
