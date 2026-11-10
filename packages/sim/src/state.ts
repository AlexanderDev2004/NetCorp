import type { DeviceCatalog, World } from './types.ts';

/** Deterministic PRNG state lives in the World, so replays are exact. */
export function nextRandom(world: World): number {
  let t = (world.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function randomMac(world: World): string {
  const bytes = [0x52, 0x54, 0x00, nextRandom(world) & 0xff, nextRandom(world) & 0xff, nextRandom(world) & 0xff];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(':');
}

export function nextId(world: World, prefix: string): string {
  world.nextId += 1;
  return `${prefix}-${world.nextId}`;
}

export function createWorld(seed: number, catalog: DeviceCatalog): World {
  return {
    seed,
    rngState: seed >>> 0,
    tick: 0,
    catalog,
    devices: {},
    links: [],
    modules: {},
    log: [],
    tickets: [],
    mail: [],
    contracts: [],
    cash: 400,
    reputation: 0,
    insight: 0,
    difficulty: 'normal',
    season: 1,
    goal: 'none',
    prestigeHistory: [],
    phishPayments: 0,
    rackTier: 0,
    nextId: 0,
    firmwareChannels: {},
    researchNodes: [],
    research: { completed: [], labPriorsGranted: [], labPriorsUsed: [], predictiveFlags: [] },
    experiments: [],
    lab: { records: [], reranClasses: [] },
  };
}

export function log(world: World, level: 'debug' | 'info' | 'warn' | 'alert', source: string, text: string): void {
  world.log.push({ tick: world.tick, level, source, text });
}
