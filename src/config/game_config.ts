export interface GameConfig {
  startOnCover: boolean;    // production: true
  animationScale: number;   // multiplies every choreography delay; production: 1
  replayAutoplay: boolean;  // production: true
  storage: Storage | null;  // production: window.localStorage, or null if access throws
  now: () => Date;          // production: () => new Date()
}

export function productionConfig(): GameConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const rawScale = env?.VITE_ANIMATION_SCALE;
  const parsedScale =
    rawScale !== undefined && rawScale !== '' ? Number(rawScale) : 1;
  const animationScale = Number.isFinite(parsedScale) && parsedScale >= 0 ? parsedScale : 1;

  let storage: Storage | null = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      storage = window.localStorage;
    }
  } catch {
    storage = null;
  }

  return {
    startOnCover: true,
    animationScale,
    replayAutoplay: true,
    storage,
    now: () => new Date(),
  };
}
