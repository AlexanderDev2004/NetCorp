import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, createWorld, findPath } from '../src';
import { isValidIpv4, isValidPrefix } from '../src/ip';
import type { Device, DeviceCatalog, World } from '../src';

const catalog: DeviceCatalog = {
  desktop: { id: 'desktop', kind: 'desktop', name: 'Desktop', price: 300, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  server: { id: 'server', kind: 'server', name: 'Server', price: 900, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  'switch-unmanaged': { id: 'switch-unmanaged', kind: 'switch-unmanaged', name: 'Dumb Switch', price: 15, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'n/a' },
  'router-soho': { id: 'router-soho', kind: 'router-soho', name: 'SOHO Router', price: 80, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'wifi0', kind: 'wifi' }], firmware: 'router 7.14' },
  'access-point': { id: 'access-point', kind: 'access-point', name: 'AP', price: 90, interfaces: [{ name: 'wifi0', kind: 'wifi' }], firmware: 'air 4.0' },
};

let world: World;

beforeEach(() => {
  world = createWorld(4242, catalog);
  world.cash = 100000;
});

function byName(name: string): Device {
  const device = Object.values(world.devices).find((d) => d.name === name);
  if (device === undefined) throw new Error(`no ${name} placed`);
  return device;
}

/**
 * The Board Prototype sample topology: PC-A → Switch-A → Router-A → Server-A.
 * Router-A routes both subnets; Server-A is pre-configured; PC-A is left
 * unconfigured for the caller to set up.
 */
function buildPrototypeChain(): void {
  applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'PC-A', x: 0, y: 0 });
  applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'Switch-A', x: 100, y: 0 });
  applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'Router-A', x: 200, y: 0 });
  applyCommand(world, { type: 'placeDevice', defId: 'server', name: 'Server-A', x: 300, y: 0 });
  applyCommand(world, { type: 'wireLink', a: { deviceId: byName('PC-A').id, interfaceName: 'eth0' }, b: { deviceId: byName('Switch-A').id, interfaceName: 'eth0' } });
  applyCommand(world, { type: 'wireLink', a: { deviceId: byName('Switch-A').id, interfaceName: 'eth1' }, b: { deviceId: byName('Router-A').id, interfaceName: 'eth0' } });
  applyCommand(world, { type: 'wireLink', a: { deviceId: byName('Router-A').id, interfaceName: 'eth1' }, b: { deviceId: byName('Server-A').id, interfaceName: 'eth0' } });
  applyCommand(world, { type: 'setIpv4', deviceId: byName('Router-A').id, interfaceName: 'eth0', address: '192.168.10.1', prefix: 24 });
  applyCommand(world, { type: 'setIpv4', deviceId: byName('Router-A').id, interfaceName: 'eth1', address: '10.20.0.1', prefix: 24 });
  applyCommand(world, { type: 'addRoute', deviceId: byName('Router-A').id, route: { destinationCidr: '0.0.0.0/0', metric: 1 } });
  applyCommand(world, { type: 'setIpv4', deviceId: byName('Server-A').id, interfaceName: 'eth0', address: '10.20.0.100', prefix: 24, gateway: '10.20.0.1' });
}

function configurePcA(): void {
  applyCommand(world, { type: 'setIpv4', deviceId: byName('PC-A').id, interfaceName: 'eth0', address: '192.168.10.10', prefix: 24, gateway: '192.168.10.1' });
}

describe('IPv4 validation', () => {
  it('accepts well-formed dotted quads', () => {
    expect(isValidIpv4('10.20.0.100')).toBe(true);
    expect(isValidIpv4('0.0.0.0')).toBe(true);
    expect(isValidIpv4('255.255.255.255')).toBe(true);
  });

  it('rejects empty, non-numeric, and out-of-range octets', () => {
    expect(isValidIpv4('10.0.0.')).toBe(false); // the old Number('') === 0 bug
    expect(isValidIpv4('10.0.0')).toBe(false);
    expect(isValidIpv4('10.0.0.256')).toBe(false);
    expect(isValidIpv4('10.a.0.1')).toBe(false);
    expect(isValidIpv4('')).toBe(false);
    expect(isValidIpv4('10.0.0.-1')).toBe(false);
  });

  it('rejects out-of-range prefixes', () => {
    expect(isValidPrefix(24)).toBe(true);
    expect(isValidPrefix(0)).toBe(true);
    expect(isValidPrefix(32)).toBe(true);
    expect(isValidPrefix(33)).toBe(false);
    expect(isValidPrefix(-1)).toBe(false);
    expect(isValidPrefix(2.5)).toBe(false);
  });

  it('setIpv4 rejects an invalid address without touching the interface', () => {
    buildPrototypeChain();
    const pc = byName('PC-A');
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '192.168.10.' });
    expect(pc.interfaces[0]?.ipv4).toBeUndefined();
    expect(world.log.at(-1)?.level).toBe('warn');
    expect(world.log.at(-1)?.text).toContain('invalid IP configuration');
  });

  it('setIpv4 rejects an invalid gateway atomically', () => {
    buildPrototypeChain();
    const pc = byName('PC-A');
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '192.168.10.10', prefix: 24, gateway: '192.168.10.999' });
    expect(pc.interfaces[0]?.ipv4).toBeUndefined();
    expect(world.log.at(-1)?.level).toBe('warn');
    expect(world.log.at(-1)?.text).toContain('gateway');
  });
});

describe('Interface UP/DOWN', () => {
  beforeEach(buildPrototypeChain);

  it('pings successfully after the player configures PC-A', () => {
    configurePcA();
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('reply from 10.20.0.100');
  });

  it('pings fail with an interface-down reason when the source interface is shut', () => {
    configurePcA();
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('PC-A').id, interfaceName: 'eth0', enabled: false });
    const result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(byName('PC-A').id);
    expect(result.blockedAt?.reason).toContain('interface eth0 is down');
  });

  it('pings fail at the destination when the server interface is shut', () => {
    configurePcA();
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Server-A').id, interfaceName: 'eth0', enabled: false });
    const result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(byName('Server-A').id);
    expect(result.blockedAt?.reason).toContain('destination interface eth0 is down');
  });

  it('pings fail at an intermediate device when a switch port is shut — and recover when it comes back', () => {
    configurePcA();
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Switch-A').id, interfaceName: 'eth1', enabled: false });
    let result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(byName('Switch-A').id);
    expect(result.blockedAt?.reason).toContain('interface eth1 is down');

    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Switch-A').id, interfaceName: 'eth1', enabled: true });
    result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(true);
  });

  it('pings fail when the gateway interface is shut', () => {
    configurePcA();
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Router-A').id, interfaceName: 'eth0', enabled: false });
    const result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.reason).toContain('gateway 192.168.10.1 is unreachable');
  });
});

describe('Connections', () => {
  beforeEach(buildPrototypeChain);

  it('wiring a wifi port to an ethernet port is rejected with a clear reason', () => {
    applyCommand(world, { type: 'placeDevice', defId: 'access-point', name: 'AP-1', x: 400, y: 0 });
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'PC-B', x: 500, y: 0 });
    const router = byName('Router-A');
    const pcB = byName('PC-B');
    applyCommand(world, { type: 'wireLink', a: { deviceId: router.id, interfaceName: 'wifi0' }, b: { deviceId: pcB.id, interfaceName: 'eth0' } });
    expect(world.log.at(-1)?.level).toBe('warn');
    expect(world.log.at(-1)?.text).toContain('cannot wire');
    expect(world.log.at(-1)?.text).toContain('wifi');
    // And a wifi↔wifi pair is fine:
    const ap = byName('AP-1');
    applyCommand(world, { type: 'wireLink', a: { deviceId: router.id, interfaceName: 'wifi0' }, b: { deviceId: ap.id, interfaceName: 'wifi0' } });
    expect(world.log.at(-1)?.level).toBe('info');
    expect(world.links).toHaveLength(4);
  });

  it('a removed link makes the destination unreachable', () => {
    configurePcA();
    const link = world.links.find(
      (l) => l.a.deviceId === byName('Switch-A').id || l.b.deviceId === byName('Switch-A').id,
    );
    expect(link).toBeDefined();
    applyCommand(world, { type: 'unwireLink', linkId: link!.id });
    const result = findPath(world, byName('PC-A').id, '10.20.0.100');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.reason).toContain('no path');
  });
});

describe('Ping diagnostics', () => {
  it('reports invalid IP configuration for a malformed target', () => {
    buildPrototypeChain();
    configurePcA();
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.' });
    expect(world.log.at(-1)?.text).toContain('invalid IP configuration');
  });

  it('reports a missing gateway when PC-A has an address but no gateway', () => {
    buildPrototypeChain();
    applyCommand(world, { type: 'setIpv4', deviceId: byName('PC-A').id, interfaceName: 'eth0', address: '192.168.10.10', prefix: 24 });
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('no gateway configured');
  });
});

describe('Board Prototype end-to-end loop', () => {
  it('configure → ping success → break → diagnose → fix → ping success', () => {
    buildPrototypeChain();

    // 1. Ping before configuring PC-A: no IPv4 configured.
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('no IPv4 configured');

    // 2. Configure PC-A and ping: success.
    configurePcA();
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('reply from 10.20.0.100');

    // 3. Break it: shut the switch port toward the router.
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Switch-A').id, interfaceName: 'eth1', enabled: false });
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('timeout');
    expect(world.log.at(-1)?.text).toContain('interface eth1 is down');

    // 4. Fix it: bring the port back up and ping again.
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: byName('Switch-A').id, interfaceName: 'eth1', enabled: true });
    applyCommand(world, { type: 'ping', fromDevice: byName('PC-A').id, toAddress: '10.20.0.100' });
    expect(world.log.at(-1)?.text).toContain('reply from 10.20.0.100');
  });
});
