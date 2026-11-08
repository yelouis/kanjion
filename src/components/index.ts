/**
 * src/components/index.ts
 *
 * Barrel export for all "The Redacted Dossier" presentation components.
 */

export { MastheadHeader } from './MastheadHeader';
export type { ExtendedMastheadProps } from './MastheadHeader';

export { SandboxStage } from './SandboxStage';

export { Sandbox, ShinkansenSandbox } from '../data/puzzles/case_001/Sandbox';
export type { SandboxProps, ShinkansenSandboxProps } from '../data/puzzles/case_001/Sandbox';

export { AgentCursor } from './AgentCursor';
export type { AgentCursorProps } from './AgentCursor';

export { LoopedTargetReplay } from './LoopedTargetReplay';
export type { LoopedTargetReplayProps } from './LoopedTargetReplay';

export { NewspaperFrontCover } from './NewspaperFrontCover';
export type { NewspaperFrontCoverProps } from './NewspaperFrontCover';

export { DispatchPad } from './DispatchPad';

export { ExhibitsPanel } from './ExhibitsPanel';
