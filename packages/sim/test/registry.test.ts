import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, linkCompatible, REACH_LIMITS } from '../src';
import type { DeviceCatalog, ModuleDef, World } from '../src';

// A minimal registry-focused catalog: an SFP-capable switch plus desktops to
// hang off it at various distances.
const catalog: DeviceCatalog = {
  'switch-sfp': {
    id: 'switch-sfp',
    kind: 'switch-managed',
    name: 'SFP Switch',
    price: 200,
    interfaces: [
      { name: 'eth0', kind: 'ethernet' },
      { name: 'eth1', kind: 'ethernet' },
      { name: 'sfp0', kind: 'sfp', role: 'uplink' },
    ],
    firmware: 'SwitchOS 2.1',
  },
  desktop: {
    id: 'desktop',
    kind: 'desktop',
    name: 'Desktop',
    price: 300,
    interfaces: [{ name: 'eth0', kind: 'ethernet' }],
    firmware: 'OsWorks 1.0',
  },
};

const modules: Record<string, ModuleDef> = {
  'optics-bplus': { id: 'optics-bplus', name: 'B+ optics', price: 180, medium: 'fiber', reachClass: 'short' },
  'optics-cplus': { id: 'optics-cplus', name: 'C+ optics', price: 480, medium: 'fiber', reachClass: 'long' },
  'optics-copper': { id: 'optics-copper', name: 'Copper SFP', price: 60, medium: 'copper', reachClass: 'short' },
};

function freshWorld(seed = 42): World {
  const world = createWorld(seed, catalog);
  world.cash = 10000;
  world.modules = modules;
  return world;
}

function place(world: World, defId: string, name: string, x: number, y: number): string {
  applyCommand(world, { type: 'placeDevice', defId, name, x, y });
  // Placement cost is not what these tests measure: re-fund after placing.
  world.cash = 10000;
  const id = Object.keys(world.devices).find((key) => world.devices[key]?.name === name);
  if (id === undefined) throw new Error(`placement of ${name} failed`);
  return id;
}

function lastLog(world: World): { level: string; text: string } {
  const entry = world.log[world.log.length - 1];
  if (entry === undefined) throw new Error('log is empty');
  return { level: entry.level, text: entry.text };
}

describe('device registry: module install', () => {
  it('installs optics into an SFP slot and deducts the price', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    expect(world.devices[sw]?.modules?.sfp0).toBe('optics-bplus');
    expect(world.cash).toBe(10000 - 180);
    expect(lastLog(world).level).toBe('info');
  });

  it('refuses a module into a non-SFP interface', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'eth0', moduleId: 'optics-bplus' });
    expect(world.cash).toBe(10000);
    expect(lastLog(world).text).toContain('no SFP slot');
  });

  it('refuses an occupied slot', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    expect(world.devices[sw]?.modules?.sfp0).toBe('optics-bplus');
    expect(world.cash).toBe(10000 - 180);
    expect(lastLog(world).text).toContain('already has a module');
  });

  it('refuses an unknown module id', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-ghost' });
    expect(world.devices[sw]?.modules?.sfp0).toBeUndefined();
    expect(lastLog(world).text).toContain('unknown module');
  });

  it('refuses when cash is short', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    world.cash = 100;
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    expect(world.devices[sw]?.modules?.sfp0).toBeUndefined();
    expect(world.cash).toBe(100);
    expect(lastLog(world).text).toContain('not enough cash');
  });

  it('removes a module, freeing the slot for a new one', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    applyCommand(world, { type: 'removeModule', deviceId: sw, interfaceName: 'sfp0' });
    expect(world.devices[sw]?.modules?.sfp0).toBeUndefined();
    expect(lastLog(world).text).toContain('removed the module');
    applyCommand(world, { type: 'installModule', deviceId: sw, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    expect(world.devices[sw]?.modules?.sfp0).toBe('optics-cplus');
  });
});

describe('device registry: link compatibility (warning-only)', () => {
  it('passes plain copper runs without warnings', () => {
    const world = freshWorld();
    const sw = place(world, 'switch-sfp', 'sw1', 0, 0);
    const pc = place(world, 'desktop', 'pc1', 300, 0);
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw, interfaceName: 'eth0' }, b: { deviceId: pc, interfaceName: 'eth0' } });
    expect(lastLog(world).level).toBe('info');
    const link = world.links[0]!;
    expect(linkCompatible(world, link).ok).toBe(true);
  });

  it('warns when an SFP endpoint has no optics installed', () => {
    const world = freshWorld();
    const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
    const sw2 = place(world, 'switch-sfp', 'sw2', 200, 0);
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
    expect(lastLog(world).level).toBe('warn');
    expect(lastLog(world).text).toContain('empty SFP slot');
    // Warning-only: the link still exists.
    expect(world.links).toHaveLength(1);
  });

  it('warns on a media mismatch (copper SFP vs fiber optics)', () => {
    const world = freshWorld();
    const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
    const sw2 = place(world, 'switch-sfp', 'sw2', 200, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw1, interfaceName: 'sfp0', moduleId: 'optics-copper' });
    applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
    expect(lastLog(world).level).toBe('warn');
    expect(lastLog(world).text).toContain('media mismatch');
  });

  it('warns when the optics cannot cover the run (the DoD case: C+ vs B+ over a long link)', () => {
    const world = freshWorld();
    // 1000 world units: beyond B+ short reach (400), within C+ long reach (1600).
    const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
    const sw2 = place(world, 'switch-sfp', 'sw2', 1000, 0);
    // One end upgraded to C+, the other left on B+: the weaker side caps the budget.
    applyCommand(world, { type: 'installModule', deviceId: sw1, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
    expect(lastLog(world).level).toBe('warn');
    expect(lastLog(world).text).toContain('B+ optics');
    expect(lastLog(world).text).toContain(String(REACH_LIMITS.short));
    expect(world.links).toHaveLength(1);
  });

  it('accepts a fiber run whose reach covers the distance', () => {
    const world = freshWorld();
    const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
    const sw2 = place(world, 'switch-sfp', 'sw2', 1000, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw1, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
    expect(lastLog(world).level).toBe('info');
    expect(lastLog(world).text).toContain('wired');
  });

  it('emits a warning when installing optics that leave an existing link under-budgeted', () => {
    const world = freshWorld();
    const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
    const sw2 = place(world, 'switch-sfp', 'sw2', 1000, 0);
    applyCommand(world, { type: 'installModule', deviceId: sw1, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
    expect(lastLog(world).level).toBe('info');
    // Swap the far end down to B+: the run is now 1000 units on short optics.
    applyCommand(world, { type: 'removeModule', deviceId: sw2, interfaceName: 'sfp0' });
    applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
    expect(lastLog(world).level).toBe('warn');
    expect(lastLog(world).text).toContain('optics problem');
  });
});

describe('device registry: determinism', () => {
  it('produces identical device and link state for identical command streams', () => {
    const run = (seed: number) => {
      const world = freshWorld(seed);
      const sw1 = place(world, 'switch-sfp', 'sw1', 0, 0);
      const sw2 = place(world, 'switch-sfp', 'sw2', 1000, 0);
      applyCommand(world, { type: 'installModule', deviceId: sw1, interfaceName: 'sfp0', moduleId: 'optics-cplus' });
      applyCommand(world, { type: 'installModule', deviceId: sw2, interfaceName: 'sfp0', moduleId: 'optics-bplus' });
      applyCommand(world, { type: 'wireLink', a: { deviceId: sw1, interfaceName: 'sfp0' }, b: { deviceId: sw2, interfaceName: 'sfp0' } });
      return JSON.stringify({ devices: world.devices, links: world.links, log: world.log });
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});
