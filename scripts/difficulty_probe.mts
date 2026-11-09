// scripts/difficulty_probe.mts
//
// How forgiving is the agent? Runs deliberately lazy prompts through the shipped pipeline
// (resolveLine -> applyDecision) with the cloud tier off — the deterministic fallback every
// player gets when the cloud model is unavailable. Reproduces F-21 and F-22 in
// ongoing_general_errors.md.
//
// Run:  npx tsx scripts/difficulty_probe.mts
//
// 2026-11-08 baseline: 15/28 lazy prompts reproduce the replay step, and the laziest run
// ["green", "name tanaka", "sale", "draw a dragon", "blue"] scores 100% x 1.2 = 120 PTS.
// Not part of `npm test`. Item 8 of agent_execution_guide.md deletes this file once
// test/difficulty.test.ts covers every scenario below.

const { resolveLine } = await import('../src/engine/agent/index.ts');
const { applyDecision, createInitialPuzzleState, evaluateExhibits } = await import('../src/engine/puzzle_engine.ts');
const { CASE_001_PUZZLE: P, CASE_001_GENERATED_MANIFEST: M } = await import('../src/data/puzzles/case_001.ts');

type S = ReturnType<typeof createInitialPuzzleState>;
const keyOf = (pageId: string, mark: number | null) =>
  P.pages.find((p: any) => p.id === pageId)?.elements.find((e: any) => e.mark === mark)?.key ?? '(none)';
const resolve = (state: S, instruction: string) =>
  resolveLine({ puzzle: P, manifest: M, state, instruction, visibleText: '' });
const apply = (state: S, d: any) =>
  applyDecision(P, state, { action: d.action, pageId: d.pageId, mark: d.mark, text: d.text, stroke: d.stroke }).next;

// The state at the start of each replay step
const states: S[] = [];
let s = createInitialPuzzleState(P);
for (const step of P.replay) {
  states.push(s);
  const el = P.pages.find((p: any) => p.id === step.pageId).elements.find((e: any) => e.key === step.key);
  s = apply(s, { action: step.action, pageId: step.pageId, mark: el.mark, text: step.text, stroke: step.stroke });
}

const battery: string[][] = [
  ['green', 'blue', 'top left', 'top right', 'the card', 'first one', 'tokyo'],
  ['tanaka', 'name tanaka', 'type tanaka', 'type the name', 'type tanaka in the name box'],
  ['green', 'clover', '13870', 'the green one', 'wait then green', 'sale'],
  ['draw a dragon', 'draw a potato', 'sign', 'scribble', 'draw'],
  ['blue', 'confirm', 'bottom right', 'the big button', 'next'],
];

let hits = 0;
let total = 0;
for (let i = 0; i < P.replay.length; i++) {
  const target = P.replay[i];
  console.log(`\nStep ${i + 1} on ${target.pageId} — replay: ${target.action} ${target.key}${target.text ? ` "${target.text}"` : ''}${target.stroke ? ` (${target.stroke})` : ''}`);
  for (const prompt of battery[i] ?? []) {
    const d = await resolve(states[i], prompt);
    const key = keyOf(d.pageId, d.mark);
    const after = apply(states[i], d);
    const same =
      key === target.key &&
      d.action === target.action &&
      (target.text ? d.text === target.text : true) &&
      (target.stroke ? d.stroke === target.stroke : true);
    total++;
    if (same) hits++;
    const extra = d.action === 'DRAW' ? ` stroke=${d.stroke}` : d.action === 'TYPE' ? ` text=${d.text}` : ` fare=${after.fields.fare}`;
    console.log(`  ${same ? 'MATCH ' : 'miss  '} "${prompt}" -> ${d.action} ${key}${extra} -> ${after.pageId}`);
  }
}
console.log(`\nLazy prompts that reproduce the replay step: ${hits}/${total}`);

const lazy = ['green', 'name tanaka', 'sale', 'draw a dragon', 'blue'];
let g = createInitialPuzzleState(P);
for (const line of lazy) g = apply(g, await resolve(g, line));
const ev = evaluateExhibits(P, g);
const closeness = ev.reduce((a: number, e: any) => a + (e.status === 'VERIFIED' ? e.weight : 0), 0);
console.log(`Laziest run ${JSON.stringify(lazy)} -> ${ev.map((e: any) => `${e.id}:${e.status}`).join(' ')} = ${closeness}%`);
