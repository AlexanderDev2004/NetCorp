import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, createWorld, findPath } from '../src';
import type { DeviceCatalog, Device, World } from '../src';

const catalog: DeviceCatalog = {
  desktop: { id: 'desktop', kind: 'desktop', name: 'Desktop', price: 300, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  server: { id: 'server', kind: 'server', name: 'Server', price: 900, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  'switch-unmanaged': { id: 'switch-unmanaged', kind: 'switch-unmanaged', name: 'Dumb Switch', price: 15, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'n/a' },
  'router-soho': { id: 'router-soho', kind: 'router-soho', name: 'SOHO Router', price: 80, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }], firmware: 'router 7.14' },
};

let world: World;

beforeEach(() => {
  world = createWorld(1234, catalog);
  world.cash = 100000; // funded world; the cash-gating test overrides this
});

function byKind(kind: string): Device {
  const device = Object.values(world.devices).find((d) => d.kind === kind);
  if (device === undefined) throw new Error(`no ${kind} placed`);
  return device;
}

function buildSimpleLan(): void {
  applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
  applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 100, y: 0 });
  applyCommand(world, { type: 'placeDevice', defId: 'server', name: 'srv1', x: 200, y: 0 });
  const pc = byKind('desktop');
  const sw = byKind('switch-unmanaged');
  const srv = byKind('server');
  applyCommand(world, { type: 'wireLink', a: { deviceId: pc.id, interfaceName: 'eth0' }, b: { deviceId: sw.id, interfaceName: 'eth0' } });
  applyCommand(world, { type: 'wireLink', a: { deviceId: srv.id, interfaceName: 'eth0' }, b: { deviceId: sw.id, interfaceName: 'eth1' } });
  applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.10', prefix: 24 });
  applyCommand(world, { type: 'setIpv4', deviceId: srv.id, interfaceName: 'eth0', address: '10.0.0.20', prefix: 24 });
}

describe('NetCorp sim', () => {
  it('determinism: same seed and commands produce the same world', () => {
    const a = createWorld(42, catalog);
    const b = createWorld(42, catalog);
    for (const w of [a, b]) {
      applyCommand(w, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
    }
    expect(a.devices).toEqual(b.devices);
    expect(a.cash).toBe(b.cash);
  });

  it('cannot place a device without cash', () => {
    world.cash = 0;
    applyCommand(world, { type: 'placeDevice', defId: 'server', x: 0, y: 0 });
    expect(Object.keys(world.devices)).toHaveLength(0);
    expect(world.log.at(-1)?.level).toBe('warn');
  });

  it('same-subnet ping through a switch succeeds', () => {
    buildSimpleLan();
    applyCommand(world, { type: 'ping', fromDevice: byKind('desktop').id, toAddress: '10.0.0.20' });
    expect(world.log.at(-1)?.text).toContain('reply from 10.0.0.20');
  });

  it('ping fails with a useful reason when the destination has no address', () => {
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
    const pc = byKind('desktop');
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.10', prefix: 24 });
    applyCommand(world, { type: 'ping', fromDevice: pc.id, toAddress: '10.0.0.99' });
    expect(world.log.at(-1)?.text).toContain('no route to host');
  });

  it('cross-subnet ping fails without a route on the router', () => {
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
    applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 100, y: 0 });
    applyCommand(world, { type: 'placeDevice', defId: 'server', name: 'srv1', x: 200, y: 0 });
    const pc = byKind('desktop');
    const r1 = byKind('router-soho');
    const srv = byKind('server');
    applyCommand(world, { type: 'wireLink', a: { deviceId: pc.id, interfaceName: 'eth0' }, b: { deviceId: r1.id, interfaceName: 'eth0' } });
    applyCommand(world, { type: 'wireLink', a: { deviceId: r1.id, interfaceName: 'wan1' }, b: { deviceId: srv.id, interfaceName: 'eth0' } });
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.10', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: r1.id, interfaceName: 'eth0', address: '10.0.0.1', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: r1.id, interfaceName: 'wan1', address: '192.168.2.1', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: srv.id, interfaceName: 'eth0', address: '192.168.2.20', prefix: 24 });

    const result = findPath(world, pc.id, '192.168.2.20');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(r1.id);
    expect(result.blockedAt?.reason).toContain('no route');
  });

  it('a destination firewall rule blocks the packet with a clear reason', () => {
    buildSimpleLan();
    const srv = byKind('server');
    const pc = byKind('desktop');
    applyCommand(world, { type: 'addFirewallRule', deviceId: srv.id, rule: { action: 'deny', srcCidr: '10.0.0.0/24', comment: 'scaffold deny test' } });

    const result = findPath(world, pc.id, '10.0.0.20');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.reason).toContain('blocked by firewall rule');
  });

  it('first-match semantics: a broad allow above a deny hides the deny', () => {
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
    applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 100, y: 0 });
    applyCommand(world, { type: 'placeDevice', defId: 'server', name: 'srv1', x: 200, y: 0 });
    const pc = byKind('desktop');
    const srv = byKind('server');
    applyCommand(world, { type: 'wireLink', a: { deviceId: pc.id, interfaceName: 'eth0' }, b: { deviceId: byKind('switch-unmanaged').id, interfaceName: 'eth0' } });
    applyCommand(world, { type: 'wireLink', a: { deviceId: srv.id, interfaceName: 'eth0' }, b: { deviceId: byKind('switch-unmanaged').id, interfaceName: 'eth1' } });
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.10', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: srv.id, interfaceName: 'eth0', address: '10.0.0.20', prefix: 24 });
    // Misordered on purpose: the allow-all sits above the deny (GDD §5.3).
    applyCommand(world, { type: 'addFirewallRule', deviceId: srv.id, rule: { action: 'allow' } });
    applyCommand(world, { type: 'addFirewallRule', deviceId: srv.id, rule: { action: 'deny', srcCidr: '10.0.0.0/24' } });

    expect(findPath(world, pc.id, '10.0.0.20').ok).toBe(true);
  });
});
