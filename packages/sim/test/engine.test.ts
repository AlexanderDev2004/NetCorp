import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand, advanceTicks, CONTRACT_OFFERS, createWorld, dailyWearChance, deliverMail, devicePrice, findDhcpServers, findPath, HARD_WEAR_FACTOR, openTicket, phishAlertLevel, phishPayRepLoss, PRESTIGE_DAY_TICKS, prestigeBreakdown, RACK_TIERS, rackSlots, rivalHolds, RIVAL_POACH_SCORE, repairCost, REPAIR_COST, TRADE_IN_CREDIT, wearFailureChance } from '../src';
import type { DeviceCatalog, Device, Mail, World } from '../src';

const catalog: DeviceCatalog = {
  desktop: { id: 'desktop', kind: 'desktop', name: 'Desktop', price: 300, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  server: { id: 'server', kind: 'server', name: 'Server', price: 900, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'os 1.0' },
  'switch-unmanaged': { id: 'switch-unmanaged', kind: 'switch-unmanaged', name: 'Dumb Switch', price: 15, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'eth2', kind: 'ethernet' }, { name: 'eth3', kind: 'ethernet' }], firmware: 'n/a' },
  'router-soho': { id: 'router-soho', kind: 'router-soho', name: 'SOHO Router', price: 80, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'wifi0', kind: 'wifi' }], firmware: 'router 7.14' },
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
    applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.10', prefix: 24, gateway: '10.0.0.1' });
    applyCommand(world, { type: 'setIpv4', deviceId: r1.id, interfaceName: 'eth0', address: '10.0.0.1', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: r1.id, interfaceName: 'wan1', address: '192.168.2.1', prefix: 24 });
    applyCommand(world, { type: 'setIpv4', deviceId: srv.id, interfaceName: 'eth0', address: '192.168.2.20', prefix: 24 });

    const result = findPath(world, pc.id, '192.168.2.20');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(r1.id);
    expect(result.blockedAt?.reason).toContain('no route');
  });

  it('cross-subnet ping fails at the source without a gateway configured', () => {
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
    applyCommand(world, { type: 'setIpv4', deviceId: srv.id, interfaceName: 'eth0', address: '192.168.2.20', prefix: 24 });

    const result = findPath(world, pc.id, '192.168.2.20');
    expect(result.ok).toBe(false);
    expect(result.blockedAt?.deviceId).toBe(pc.id);
    expect(result.blockedAt?.reason).toContain('no gateway configured');
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

  describe('DHCP', () => {
    function buildLanWithRouter(): { pc: Device; r1: Device; sw: Device } {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 100, y: 0 });
      applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 100, y: 150 });
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 300 });
      const r1 = byKind('router-soho');
      const sw = byKind('switch-unmanaged');
      const pc = byKind('desktop');
      applyCommand(world, { type: 'wireLink', a: { deviceId: r1.id, interfaceName: 'eth0' }, b: { deviceId: sw.id, interfaceName: 'eth0' } });
      applyCommand(world, { type: 'wireLink', a: { deviceId: sw.id, interfaceName: 'eth1' }, b: { deviceId: pc.id, interfaceName: 'eth0' } });
      applyCommand(world, { type: 'setIpv4', deviceId: r1.id, interfaceName: 'eth0', address: '10.0.0.1', prefix: 24 });
      applyCommand(world, {
        type: 'addDhcpPool',
        deviceId: r1.id,
        pool: { interfaceName: 'eth0', network: '10.0.0.0', prefix: 24, rangeStart: '10.0.0.100', rangeEnd: '10.0.0.110' },
      });
      return { pc, r1, sw };
    }

    it('no server on the segment: discover fails with "no offers"', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
      const pc = byKind('desktop');
      applyCommand(world, { type: 'dhcpDiscover', deviceId: pc.id });
      expect(world.log.at(-1)?.text).toContain('no offers');
      expect(pc.interfaces[0]?.ipv4).toBeUndefined();
    });

    it('single server: lease allocated from the pool, source recorded', () => {
      const { pc } = buildLanWithRouter();
      applyCommand(world, { type: 'dhcpDiscover', deviceId: pc.id });
      const iface = pc.interfaces[0];
      expect(iface?.ipv4?.address).toBe('10.0.0.100'); // lowest free address first
      expect(iface?.ipv4Source).toBe('dhcp');
      expect(iface?.leaseServerDeviceId).toBe(byKind('router-soho').id);
      expect(world.log.at(-1)?.text).toContain('DHCP lease from r1');
    });

    it('pool allocation skips addresses already in use', () => {
      const { pc } = buildLanWithRouter();
      applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '10.0.0.100', prefix: 24 });
      applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0' }); // clear, keep .100 taken
      // .100 was released, but another device now holds it: re-add via a server desktop
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc2', x: -100, y: 300 });
      const pc2 = Object.values(world.devices).find((d) => d.name === 'pc2');
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'wireLink', a: { deviceId: sw.id, interfaceName: 'eth2' }, b: { deviceId: pc2?.id ?? '', interfaceName: 'eth0' } });
      applyCommand(world, { type: 'setIpv4', deviceId: pc2?.id ?? '', interfaceName: 'eth0', address: '10.0.0.100', prefix: 24 });
      applyCommand(world, { type: 'dhcpDiscover', deviceId: pc.id });
      expect(pc.interfaces[0]?.ipv4?.address).toBe('10.0.0.101');
    });

    it('rogue-DHCP incident: the consumer router wins the offer race and poisons the client', () => {
      const { pc, sw } = buildLanWithRouter();
      applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: sw.id });
      const rogue = Object.values(world.devices).find((d) => d.name === 'mystery-router');
      expect(rogue).toBeDefined();
      expect(world.links.some((l) => l.a.deviceId === rogue?.id || l.b.deviceId === rogue?.id)).toBe(true);

      applyCommand(world, { type: 'dhcpDiscover', deviceId: pc.id });
      const iface = pc.interfaces[0];
      expect(iface?.ipv4?.address).toBe('192.168.1.100'); // wrong subnet — the classic symptom
      expect(iface?.leaseServerDeviceId).toBe(rogue?.id);
      expect(world.log.at(-1)?.text).toContain('DHCP lease from mystery-router');
      expect(world.log.at(-1)?.text).toContain('of 2 offers');

      // The poisoned client can no longer reach the real router.
      const result = findPath(world, pc.id, '10.0.0.1');
      expect(result.ok).toBe(false);
    });

    it('removing the rogue device restores correct leases', () => {
      const { pc, sw } = buildLanWithRouter();
      applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: sw.id });
      const rogue = Object.values(world.devices).find((d) => d.name === 'mystery-router');
      applyCommand(world, { type: 'deleteDevice', deviceId: rogue?.id ?? '' });
      applyCommand(world, { type: 'dhcpDiscover', deviceId: pc.id });
      expect(pc.interfaces[0]?.ipv4?.address).toBe('10.0.0.100');
    });

    it('the rogue-DHCP incident opens a ticket that complains about symptoms, not causes', () => {
      const { sw } = buildLanWithRouter();
      applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: sw.id });
      const ticket = world.tickets.at(-1);
      expect(ticket?.status).toBe('open');
      expect(ticket?.title.toLowerCase()).not.toContain('dhcp');
      expect(ticket?.title.toLowerCase()).not.toContain('router');
    });
  });

  describe('Tickets', () => {
    it('resolving in SLA pays the full reward', () => {
      applyCommand(world, { type: 'resolveTicket', ticketId: 'ticket-1' });
      expect(world.tickets).toHaveLength(0); // nothing to resolve yet
      const cash = world.cash;
      applyCommand(world, { type: 'ping', fromDevice: 'nope', toAddress: '1.2.3.4' }); // advance nothing
      // Open one via the incident path.
      applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 0, y: 0 });
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: sw.id });
      const ticket = world.tickets.at(-1);
      expect(ticket).toBeDefined();
      const cashBefore = world.cash;
      applyCommand(world, { type: 'resolveTicket', ticketId: ticket?.id ?? '' });
      expect(world.cash).toBe(cashBefore + (ticket?.rewardCash ?? 0));
      expect(world.reputation).toBe(1);
      expect(world.insight).toBe(1);
      void cash;
    });

    it('SLA breach applies the penalty once; late resolution pays half', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 0, y: 0 });
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: sw.id });
      const ticket = world.tickets.at(-1);
      expect(ticket).toBeDefined();
      const cashBefore = world.cash;
      advanceTicks(world, (ticket?.slaTicks ?? 0) + 2);
      expect(world.cash).toBe(cashBefore - (ticket?.penaltyCash ?? 0));
      expect(world.reputation).toBe(-1);
      expect(world.log.some((entry) => entry.source === 'sla')).toBe(true);

      const lateResolveCash = world.cash;
      applyCommand(world, { type: 'resolveTicket', ticketId: ticket?.id ?? '' });
      expect(world.cash).toBe(lateResolveCash + Math.floor((ticket?.rewardCash ?? 0) / 2));
      expect(world.reputation).toBe(-1); // no rep for late work
    });

    it('ambient tickets spawn over time, at most three open', () => {
      advanceTicks(world, 48 * 6);
      const open = world.tickets.filter((t) => t.status === 'open');
      expect(open.length).toBeGreaterThan(0);
      expect(open.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Mail', () => {
    it('falling for a phish costs cash and reputation, once', () => {
      deliverMail(world, {
        from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
        subject: 'URGENT: unpaid invoice',
        body: 'Pay now.',
        kind: 'phish',
        actions: [{ label: 'Pay now', command: 'phish-pay' }],
      });
      const mail = world.mail.at(-1);
      expect(mail).toBeDefined();
      const cashBefore = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: mail?.id ?? '', command: 'phish-pay' });
      expect(world.cash).toBe(cashBefore - 250);
      expect(world.reputation).toBe(-1);
      // A second press does nothing: the outcome happens once.
      applyCommand(world, { type: 'mailAction', mailId: mail?.id ?? '', command: 'phish-pay' });
      expect(world.cash).toBe(cashBefore - 250);
    });

    it('reporting a phish pays insight instead', () => {
      deliverMail(world, {
        from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
        subject: 'URGENT: unpaid invoice',
        body: 'Pay now.',
        kind: 'phish',
        actions: [
          { label: 'Pay now', command: 'phish-pay' },
          { label: 'Report as phish', command: 'reportPhish' },
        ],
      });
      const mail = world.mail.at(-1);
      const insightBefore = world.insight;
      const cashBefore = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: mail?.id ?? '', command: 'reportPhish' });
      expect(world.insight).toBe(insightBefore + 1);
      expect(world.cash).toBe(cashBefore);
    });

    it('readMail marks the letter read', () => {
      deliverMail(world, { from: 'Dr. Paula Reboot', subject: 'Hello', body: 'Hi.', kind: 'mentor' });
      const mail = world.mail.at(-1);
      expect(mail?.read).toBe(false);
      applyCommand(world, { type: 'readMail', mailId: mail?.id ?? '' });
      expect(mail?.read).toBe(true);
    });

    it('ambient mail arrives over time', () => {
      advanceTicks(world, 96 * 3);
      expect(world.mail.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Firmware updates', () => {
    it('upgrade changes the firmware version and logs the move', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      expect(r1.firmware).toBe('router 7.14');
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: 'router 7.15' });
      expect(r1.firmware).toBe('router 7.15');
      const entry = world.log.at(-1);
      expect(entry?.text).toContain('router 7.14 → router 7.15');
    });

    it('updating to the running version is refused', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: 'router 7.14' });
      expect(r1.firmware).toBe('router 7.14');
      const entry = world.log.at(-1);
      expect(entry?.level).toBe('warn');
    });

    it('empty version is refused', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: '   ' });
      expect(r1.firmware).toBe('router 7.14');
      const entry = world.log.at(-1);
      expect(entry?.level).toBe('warn');
    });
  });

  describe('Outdated-firmware incident', () => {
    it('exploits an outdated device: compromised flag, alert, symptom ticket', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      const before = world.tickets.length;
      applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: r1.id, latestVersion: 'router 7.15' });
      expect(r1.compromised).toBe(true);
      const alert = world.log.at(-2);
      expect(alert?.level).toBe('alert');
      expect(world.tickets.length).toBe(before + 1);
      const ticket = world.tickets.at(-1);
      expect(ticket?.symptom.toLowerCase()).not.toContain('firmware');
      expect(ticket?.symptom.toLowerCase()).not.toContain('patch');
      expect(ticket?.symptom.toLowerCase()).not.toContain('outdated');
    });

    it('a fully patched device cannot be exploited', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: 'router 7.15' });
      applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: r1.id, latestVersion: 'router 7.15' });
      expect(r1.compromised).toBeFalsy();
      const entry = world.log.at(-1);
      expect(entry?.level).toBe('warn');
      expect(world.tickets.some((t) => t.client === 'Novabit (partner network)')).toBe(false);
    });

    it('patching an exploited device clears the compromise', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: r1.id, latestVersion: 'router 7.15' });
      expect(r1.compromised).toBe(true);
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: 'router 7.15' });
      expect(r1.compromised).toBe(false);
      const entry = world.log.at(-1);
      expect(entry?.text).toContain('compromise cleared');
    });
  });

  describe('Ambient firmware incidents', () => {
    it('eventually exploits an unpatched device while the clock runs', () => {
      world.firmwareChannels['router-soho'] = 'router 7.15';
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      advanceTicks(world, 24 * 14); // two weeks: p≈1/3 per day
      expect(r1.compromised).toBe(true);
      expect(world.tickets.some((t) => t.client === 'Novabit (partner network)')).toBe(true);
    });

    it('never strikes a fully patched fleet', () => {
      world.firmwareChannels['router-soho'] = 'router 7.15';
      world.firmwareChannels['desktop'] = 'os 1.1';
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 100, y: 0 });
      const pc1 = byKind('desktop');
      applyCommand(world, { type: 'updateFirmware', deviceId: r1.id, version: 'router 7.15' });
      applyCommand(world, { type: 'updateFirmware', deviceId: pc1.id, version: 'os 1.1' });
      advanceTicks(world, 24 * 14);
      expect(r1.compromised).toBeFalsy();
      expect(pc1.compromised).toBeFalsy();
      expect(world.tickets.some((t) => t.client === 'Novabit (partner network)')).toBe(false);
    });

    it('an already-compromised device is not struck twice', () => {
      world.firmwareChannels['router-soho'] = 'router 7.15';
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: r1.id, latestVersion: 'router 7.15' });
      const ticketsBefore = world.tickets.length;
      advanceTicks(world, 24 * 14);
      expect(world.tickets.filter((t) => t.client === 'Novabit (partner network)').length).toBe(1);
    });
  });

  describe('Reputation effects', () => {
    it('premium partner: new tickets pay 25% more and say so', () => {
      world.reputation = 5;
      const ticket = openTicket(world, { client: 'Test Client', title: 't', symptom: 's', slaTicks: 100, rewardCash: 200, penaltyCash: 50 });
      expect(ticket.rewardCash).toBe(250);
      expect(ticket.penaltyCash).toBe(50);
      expect(world.log.at(-1)?.text).toContain('premium partner rates');
    });

    it('penalized contractor: new tickets pay 70% and say so', () => {
      world.reputation = -5;
      const ticket = openTicket(world, { client: 'Test Client', title: 't', symptom: 's', slaTicks: 100, rewardCash: 200, penaltyCash: 50 });
      expect(ticket.rewardCash).toBe(140);
      expect(world.log.at(-1)?.text).toContain('penalized contractor rates');
    });

    it('neutral standing: standard rates, no rate note', () => {
      world.reputation = 0;
      const ticket = openTicket(world, { client: 'Test Client', title: 't', symptom: 's', slaTicks: 100, rewardCash: 200, penaltyCash: 50 });
      expect(ticket.rewardCash).toBe(200);
      expect(world.log.at(-1)?.text).not.toContain('rates');
    });

    it('reward locks at open time: later breaches do not reprice open tickets', () => {
      world.reputation = 5;
      const ticket = openTicket(world, { client: 'Test Client', title: 't', symptom: 's', slaTicks: 100, rewardCash: 200, penaltyCash: 50 });
      world.reputation = -10;
      applyCommand(world, { type: 'resolveTicket', ticketId: ticket.id });
      expect(world.cash).toBe(100000 + 250);
    });

    it('a distrusted shop is offered fewer concurrent tickets', () => {
      world.reputation = -3;
      advanceTicks(world, 24 * 14);
      const open = world.tickets.filter((t) => t.status === 'open').length;
      expect(open).toBeLessThanOrEqual(2);
    });

    it('a premium partner can hold a wider queue', () => {
      world.reputation = 5;
      advanceTicks(world, 24 * 21); // three weeks: enough for the wider cap to matter
      const open = world.tickets.filter((t) => t.status === 'open').length;
      expect(open).toBeLessThanOrEqual(4);
    });
  });

  describe('Server room rack', () => {
    function fillRack(): void {
      while (Object.keys(world.devices).length < rackSlots(world)) {
        applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
      }
    }

    it('refuses to place beyond rack capacity and charges nothing', () => {
      fillRack();
      const before = world.cash;
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 999, y: 0 });
      expect(Object.keys(world.devices)).toHaveLength(rackSlots(world));
      expect(world.cash).toBe(before);
      expect(world.log.at(-1)?.level).toBe('warn');
      expect(world.log.at(-1)?.text).toContain('rack is full');
    });

    it('removing a device frees its slot', () => {
      fillRack();
      const last = Object.values(world.devices).at(-1)!;
      applyCommand(world, { type: 'deleteDevice', deviceId: last.id });
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
      expect(Object.keys(world.devices)).toHaveLength(rackSlots(world));
      expect(world.log.at(-1)?.level).toBe('info');
    });

    it('upgrading the rack costs cash and raises capacity', () => {
      fillRack();
      const before = world.cash;
      applyCommand(world, { type: 'upgradeRack' });
      expect(world.rackTier).toBe(1);
      expect(world.cash).toBe(before - 250);
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
      expect(Object.keys(world.devices)).toHaveLength(9);
    });

    it('cannot upgrade without cash or beyond the top tier', () => {
      world.cash = 10;
      applyCommand(world, { type: 'upgradeRack' });
      expect(world.rackTier).toBe(0);
      expect(world.log.at(-1)?.level).toBe('warn');
      world.rackTier = RACK_TIERS.length - 1;
      world.cash = 100000;
      applyCommand(world, { type: 'upgradeRack' });
      expect(world.rackTier).toBe(RACK_TIERS.length - 1);
      expect(world.log.at(-1)?.text).toContain('top tier');
    });
  });

  describe('Wear and failure', () => {
    it('the failure chance curve: zero young, grows with age, scales with reliability, capped', () => {
      const young = { uptimeTicks: 7 * 24 } as Device;
      expect(wearFailureChance(young, 0.5)).toBe(0);
      const old = { uptimeTicks: 14 * 24 } as Device;
      const reliable = wearFailureChance(old, 0.9);
      const flaky = wearFailureChance(old, 0.5);
      expect(reliable).toBeCloseTo(7 * 0.05 * 0.2);
      expect(flaky).toBeCloseTo(7 * 0.05 * 0.6);
      expect(flaky).toBeGreaterThan(reliable);
      const ancient = { uptimeTicks: 400 * 24 } as Device;
      expect(wearFailureChance(ancient, 0.1)).toBe(0.35);
      expect(wearFailureChance({ uptimeTicks: 100 * 24 } as Device, undefined)).toBe(0.35); // capped
    });

    it('a forced wear failure marks the device, opens a ticket, and blocks traffic through it', () => {
      buildSimpleLan();
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: sw.id });
      expect(sw.failed).toBe(true);
      expect(world.tickets.some((t) => t.title === 'Everything went dark')).toBe(true);

      const pc = byKind('desktop');
      applyCommand(world, { type: 'ping', fromDevice: pc.id, toAddress: '10.0.0.20' });
      expect(world.log.at(-1)?.text).toContain('failed');
    });

    it('a failed device serves no DHCP', () => {
      buildSimpleLan();
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: sw.id });
      const pc = byKind('desktop');
      expect(findDhcpServers(world, pc.id, 'eth0')).toHaveLength(0);
    });

    it('repairing costs cash, clears the failure, and restarts the wear clock', () => {
      buildSimpleLan();
      const sw = byKind('switch-unmanaged');
      sw.uptimeTicks = 30 * 24;
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: sw.id });
      const before = world.cash;
      applyCommand(world, { type: 'repairDevice', deviceId: sw.id });
      expect(sw.failed).toBe(false);
      expect(sw.uptimeTicks).toBe(0);
      expect(world.cash).toBe(before - REPAIR_COST);
      expect(world.log.at(-1)?.text).toContain('back online');

      const pc = byKind('desktop');
      applyCommand(world, { type: 'ping', fromDevice: pc.id, toAddress: '10.0.0.20' });
      expect(world.log.at(-1)?.text).toContain('reply from 10.0.0.20');
    });

    it('repair refuses when the device is healthy or the shop is broke', () => {
      buildSimpleLan();
      const sw = byKind('switch-unmanaged');
      applyCommand(world, { type: 'repairDevice', deviceId: sw.id });
      expect(world.log.at(-1)?.level).toBe('warn');
      expect(world.log.at(-1)?.text).toContain('does not need repair');

      sw.failed = true;
      world.cash = 10;
      const before = world.cash;
      applyCommand(world, { type: 'repairDevice', deviceId: sw.id });
      expect(world.cash).toBe(before);
      expect(sw.failed).toBe(true);
      expect(world.log.at(-1)?.text).toContain('you have $10');
    });

    it('an old fleet eventually loses a device to wear while the clock runs', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc-old', x: 0, y: 0 });
      advanceTicks(world, 24 * 60); // 60 days: per-day chance reaches the cap long before
      expect(Object.values(world.devices).some((d) => d.failed === true)).toBe(true);
    });

    it('a failed contract device withholds its fee and takes a strike', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: pc.id });
      pc.failed = true;
      const before = world.cash;
      advanceTicks(world, 24);
      expect(world.cash).toBe(before);
      expect(world.log.some((e) => e.text.includes('their pc1 failed'))).toBe(true);
      expect(world.contracts[0]!.breaches).toBe(1);
    });

    it('the ambient firmware exploit skips devices that are already dead', () => {
      world.firmwareChannels['router-soho'] = 'router 7.15';
      applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'r1', x: 0, y: 0 });
      const r1 = byKind('router-soho');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: r1.id });
      advanceTicks(world, 24 * 14);
      expect(r1.compromised).toBeFalsy();
    });
  });

  describe('Device replacement', () => {
    it('swaps a dead unit for new hardware at price minus trade-in, same name and spot', () => {
      buildSimpleLan();
      const srv = byKind('server');
      srv.failed = true;
      const before = world.cash;
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });
      const fresh = Object.values(world.devices).find((d) => d.kind === 'server')!;
      expect(fresh.id).not.toBe(srv.id);
      expect(fresh.name).toBe(srv.name);
      expect(fresh.x).toBe(srv.x);
      expect(fresh.failed).toBeFalsy();
      expect(fresh.uptimeTicks).toBe(0);
      expect(world.devices[srv.id]).toBeUndefined();
      expect(world.cash).toBe(before - (900 - TRADE_IN_CREDIT));
      expect(world.log.at(-1)?.text).toContain('trade-in');
    });

    it('carries wiring, addresses, and config over so service resumes untouched', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'addFirewallRule', deviceId: srv.id, rule: { action: 'deny', srcCidr: '192.168.99.0/24', comment: 'guest vlan' } });
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: srv.id });
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });

      const fresh = Object.values(world.devices).find((d) => d.kind === 'server')!;
      expect(fresh.interfaces[0]!.ipv4?.address).toBe('10.0.0.20');
      expect(fresh.config.firewallRules).toHaveLength(1);
      expect(fresh.config.firewallRules[0]!.comment).toBe('guest vlan');
      expect(world.links.every((l) => l.a.deviceId !== srv.id && l.b.deviceId !== srv.id)).toBe(true);

      const pc = byKind('desktop');
      applyCommand(world, { type: 'ping', fromDevice: pc.id, toAddress: '10.0.0.20' });
      expect(world.log.at(-1)?.text).toContain('reply from 10.0.0.20');
    });

    it('new hardware ships on the current channel firmware', () => {
      buildSimpleLan();
      world.firmwareChannels['server'] = 'os 1.1';
      const srv = byKind('server');
      srv.failed = true;
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });
      expect(Object.values(world.devices).find((d) => d.kind === 'server')!.firmware).toBe('os 1.1');
    });

    it('re-pins the pinned contract so the client keeps paying the new chassis', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'signContract', client: 'Novabit (partner network)', deviceId: srv.id });
      srv.failed = true;
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });
      const fresh = Object.values(world.devices).find((d) => d.kind === 'server')!;
      expect(world.contracts[0]!.deviceId).toBe(fresh.id);
      const before = world.cash;
      advanceTicks(world, 24);
      expect(world.cash).toBe(before + world.contracts[0]!.feePerDay);
    });

    it('a replacement is a swap: it works even with the rack full', () => {
      while (Object.keys(world.devices).length < rackSlots(world)) {
        applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
      }
      const last = Object.values(world.devices).at(-1)!;
      last.failed = true;
      applyCommand(world, { type: 'replaceDevice', deviceId: last.id });
      expect(Object.keys(world.devices)).toHaveLength(rackSlots(world));
      expect(world.log.at(-1)?.level).toBe('info');
    });

    it('refuses to replace a working box or a dead one the shop cannot afford', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });
      expect(world.log.at(-1)?.level).toBe('warn');
      expect(world.log.at(-1)?.text).toContain('still works');

      srv.failed = true;
      world.cash = 10;
      const before = world.cash;
      applyCommand(world, { type: 'replaceDevice', deviceId: srv.id });
      expect(world.cash).toBe(before);
      expect(world.devices[srv.id]).toBeDefined();
      expect(world.log.at(-1)?.text).toContain('you have $10');
    });
  });

  describe('Vendor replacement mail', () => {
    it('every hardware failure draws a vendor letter naming the dead unit with a one-click order', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: srv.id });
      const letter = world.mail.find((m) => m.subject === 'Instant replacement available for your Server');
      expect(letter).toBeDefined();
      expect(letter!.kind).toBe('vendor');
      expect(letter!.body).toContain('$875'); // 900 price, 25 trade-in
      const action = letter!.actions[0]!;
      expect(action.command).toBe(`orderReplacement:${srv.id}`);
    });

    it('the letter quotes a different tone depending on the shop\u2019s reputation', () => {
      const fail = (deviceId: string): Mail => {
        applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: deviceId });
        return [...world.mail].reverse().find((m) => m.subject.startsWith('Instant replacement'))!;
      };
      buildSimpleLan();
      world.reputation = 4;
      const first = byKind('desktop');
      expect(fail(first.id).body).toContain('we would rather you bought from us because you trust us');
      world.reputation = -4;
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc2', x: 400, y: 0 });
      const second = world.devices[Object.keys(world.devices).at(-1)!]!;
      expect(fail(second.id).body).toContain('spends a lot of time offline');
    });

    it('taking the letter\u2019s order performs the same swap as a manual replace', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: srv.id });
      const letter = world.mail.find((m) => m.subject.startsWith('Instant replacement'))!;
      const before = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: letter.id, command: `orderReplacement:${srv.id}` });

      const fresh = Object.values(world.devices).find((d) => d.kind === 'server')!;
      expect(fresh.id).not.toBe(srv.id);
      expect(fresh.name).toBe(srv.name);
      expect(world.cash).toBe(before - (900 - TRADE_IN_CREDIT));
      expect(letter.actionTaken).toBe(`replaced:${fresh.id}`);
      expect(world.log.some((e) => e.text.includes('with new hardware — wiring and config carried over'))).toBe(true);
    });

    it('an order the shop cannot afford leaves the letter actionable for later', () => {
      buildSimpleLan();
      const srv = byKind('server');
      applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: srv.id });
      const letter = world.mail.find((m) => m.subject.startsWith('Instant replacement'))!;
      world.cash = 10;
      applyCommand(world, { type: 'mailAction', mailId: letter.id, command: `orderReplacement:${srv.id}` });
      expect(world.devices[srv.id]).toBeDefined();
      expect(letter.actionTaken).toBeUndefined();
      expect(letter.actions).toHaveLength(1); // the button is still there
    });

    it('the replacement-phish twin arrives from the wrong domain and asks for money up front', () => {
      buildSimpleLan();
      // Chunked wait: the ambient roll picks templates from the RNG stream.
      let guard = 0;
      while (!world.mail.some((m) => m.kind === 'phish' && m.subject.startsWith('Instant replacement')) && guard < 60) {
        advanceTicks(world, 96);
        guard += 1;
      }
      const twin = world.mail.find((m) => m.kind === 'phish' && m.subject.startsWith('Instant replacement'))!;
      expect(twin.from).toContain('field@novabit-billing.example'); // not field@novabit.example
      expect(twin.from).not.toBe('Novabit Hardware Care <field@novabit.example>');
      expect(twin.body).toContain('courier fee'); // the tell: the real vendor pays you
      expect(twin.actions.map((a) => a.command)).toContain('phish-pay');
      expect(twin.actions.map((a) => a.command)).not.toContain('orderReplacement');
    });

    it('paying the replacement-phish costs cash and strikes contracts like any other phish', () => {
      // Wait for the twin FIRST — signing before the wait would let ambient
      // contract SLA breaches churn the contract before the payment lands.
      let guard = 0;
      while (!world.mail.some((m) => m.kind === 'phish' && m.subject.startsWith('Instant replacement')) && guard < 60) {
        advanceTicks(world, 96);
        guard += 1;
      }
      const twin = world.mail.find((m) => m.kind === 'phish' && m.subject.startsWith('Instant replacement'))!;
      buildSimpleLan();
      const pc = byKind('desktop');
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: pc.id });
      const rep = world.reputation;
      const cash = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: twin.id, command: 'phish-pay' });
      expect(world.cash).toBe(cash - 250); // the real letter never charges anything here
      expect(world.reputation).toBeLessThan(rep);
      expect(world.phishPayments).toBe(1);
      // The trust strike still lands on every live contract; the strike text
      // 'wired money to a fake vendor' is the direct fingerprint of the payment.
      const live = world.contracts.filter((c) => c.active);
      expect(live.every((c) => c.breaches >= 1)).toBe(true);
      expect(world.log.some((e) => e.text.includes('wired money to a fake vendor'))).toBe(true);
    });
  });

  describe('Goodwill actions', () => {
    it('sponsoring a LAN party costs $120 and earns +1 rep when standing is bad', () => {
      world.reputation = -3;
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'sponsor-lan' });
      expect(world.cash).toBe(before - 120);
      expect(world.reputation).toBe(-2);
      expect(world.log.at(-1)?.text).toContain('+1 rep');
    });

    it('free repairs cost $80 and earn +1 rep when standing is bad', () => {
      world.reputation = -3;
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'free-repairs' });
      expect(world.cash).toBe(before - 80);
      expect(world.reputation).toBe(-2);
    });

    it('cannot afford goodwill: nothing changes, warn logged', () => {
      world.cash = 50;
      world.reputation = -3;
      applyCommand(world, { type: 'goodwill', action: 'sponsor-lan' });
      expect(world.cash).toBe(50);
      expect(world.reputation).toBe(-3);
      expect(world.log.at(-1)?.level).toBe('warn');
    });

    it('no rep gain from premium standing: money spent, nothing earned', () => {
      world.reputation = 5;
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'free-repairs' });
      expect(world.cash).toBe(before - 80);
      expect(world.reputation).toBe(5);
      expect(world.log.at(-1)?.text).toContain('already');
    });
  });

  describe('Hard mode', () => {
    it('engages through a command, logs the switch, and ignores no-op flips', () => {
      applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
      expect(world.difficulty).toBe('hard');
      expect(world.log.at(-1)?.text).toContain('Hard mode engaged');
      applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
      expect(world.log.filter((e) => e.text.includes('Hard mode engaged'))).toHaveLength(1);
      applyCommand(world, { type: 'setDifficulty', difficulty: 'normal' });
      expect(world.difficulty).toBe('normal');
    });

    it('hard mode pays 20% less on ticket rewards and locked contract fees', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: pc.id });
      expect(world.contracts[0]?.feePerDay).toBe(25); // standard-mode baseline
      applyCommand(world, { type: 'cancelContract', contractId: world.contracts[0]!.id });
      applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: pc.id });
      expect(world.contracts[1]?.feePerDay).toBe(20); // Math.round(25 * 0.8)
      const ticket = openTicket(world, { client: 'Test Client', title: 't', symptom: 's', slaTicks: 100, rewardCash: 150, penaltyCash: 100 });
      expect(ticket.rewardCash).toBe(120); // Math.round(150 * 0.8)
    });

    it('hard mode wears hardware out half again as fast', () => {
      buildSimpleLan();
      const sw = byKind('switch-unmanaged');
      sw.uptimeTicks = 14 * 24; // past the 7-day wear onset
      const normal = dailyWearChance(world, sw);
      expect(normal).toBeGreaterThan(0);
      applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
      expect(dailyWearChance(world, sw)).toBeCloseTo(normal * HARD_WEAR_FACTOR, 10);
    });
  });

  describe('Day-30 endgame', () => {
    it('closes season 1 at day 30 and rolls straight into season 2', () => {
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.endgameTick).toBe(PRESTIGE_DAY_TICKS);
      expect(world.season).toBe(2);
      expect(world.prestigeHistory).toHaveLength(1);
      expect(world.prestigeHistory[0]?.season).toBe(1);
      expect(world.log.some((e) => e.text.includes('Season 1 closes'))).toBe(true);
      const report = world.mail.find((m) => m.subject.includes('Season 1 report'));
      expect(report).toBeDefined();
      expect(report?.kind).toBe('regulator');
      expect(report?.actions.map((a) => a.command)).toContain('openPrestige');
      expect(report?.body).toContain('Prestige score:');
      expect(report?.body).toContain('Season 2 begins today');
      // The board keeps running; season 2 closes on its own day 30.
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.prestigeHistory).toHaveLength(2);
      expect(world.prestigeHistory[1]?.season).toBe(2);
      expect(world.season).toBe(3);
      expect(world.mail.filter((m) => m.subject.includes('Season 1 report'))).toHaveLength(1);
      expect(world.mail.filter((m) => m.subject.includes('Season 2 report'))).toHaveLength(1);
    });

    it('carries prestige across seasons: the letter reports the running career total', () => {
      advanceTicks(world, PRESTIGE_DAY_TICKS); // season 1 closes
      advanceTicks(world, PRESTIGE_DAY_TICKS); // season 2 closes
      const career = world.prestigeHistory.reduce((sum, record) => sum + record.score, 0);
      const s2 = world.mail.find((m) => m.subject.includes('Season 2 report'))!;
      expect(s2.body).toContain(`Career prestige: ${career}`);
      expect(s2.body).not.toBe(undefined);
      expect(career).toBeGreaterThan(0);
    });

    it('pays a season-end loyalty bonus to spotless contracts and nothing to struck ones', () => {
      // Sign just before the close: holding the contract all season would let
      // ambient contract tickets breach SLA and strike it (by design).
      advanceTicks(world, PRESTIGE_DAY_TICKS - 1);
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      const before = world.cash;
      advanceTicks(world, 1); // season closes
      expect(world.log.some((e) => e.text.includes('season-end loyalty bonus +$50'))).toBe(true); // 2 × $25
      expect(world.cash).toBe(before + 75); // the close lands on a day boundary: daily $25 fee + $50 bonus
      const report = world.mail.find((m) => m.subject.includes('Season 1 report'))!;
      expect(report.body).toContain('Loyalty bonuses .... +$50');
    });

    it('withholds the loyalty bonus from a contract with a strike this term', () => {
      advanceTicks(world, PRESTIGE_DAY_TICKS - 20);
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      const ticket = openTicket(world, { client: 'Klinik Sehat', title: 'down', symptom: 's', slaTicks: 5, rewardCash: 100, penaltyCash: 80 });
      advanceTicks(world, 20); // the ticket breaches SLA → one strike, then the season closes
      const contract = world.contracts.find((c) => c.client === 'Klinik Sehat')!;
      expect(contract.breaches).toBeGreaterThanOrEqual(1);
      expect(world.log.some((e) => e.text.includes('season-end loyalty bonus'))).toBe(false);
      const report = world.mail.find((m) => m.subject.includes('Season 1 report'))!;
      expect(report.body).not.toContain('Loyalty bonuses');
      expect(ticket.breached).toBe(true);
    });

    it('scores the season from live world state, with debt clamped and a hard bonus', () => {
      world.cash = 1234; // 24 points
      world.reputation = 3; // 75 points
      world.insight = 2; // 30 points
      expect(prestigeBreakdown(world)).toMatchObject({
        cashPoints: 24,
        reputationPoints: 75,
        insightPoints: 30,
        contractPoints: 0,
        networkPoints: 0,
        servicePoints: 0,
        hardBonus: 0,
        total: 129,
      });
      world.cash = -500; // debt does not score
      expect(prestigeBreakdown(world).cashPoints).toBe(0);
      applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
      expect(prestigeBreakdown(world).hardBonus).toBe(26); // Math.round(105 * 0.25)
      expect(prestigeBreakdown(world).total).toBe(131);
    });

    it('counts live contracts, devices, and resolved tickets into the score', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      const ticket = openTicket(world, { client: 'Walk-in', title: 'down', symptom: 's', slaTicks: 100, rewardCash: 100, penaltyCash: 10 });
      applyCommand(world, { type: 'resolveTicket', ticketId: ticket.id });
      const score = prestigeBreakdown(world);
      expect(score.contractPoints).toBe(40);
      expect(score.networkPoints).toBe(15); // pc1, sw1, srv1
      expect(score.servicePoints).toBe(10);
    });

    it('deals season themes off a fixed rotation and announces each in the letter', () => {
      expect(world.goal).toBe('none'); // season 1 opens quiet
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.goal).toBe('contract-boom');
      const s1 = world.mail.find((m) => m.subject.includes('Season 1 report'))!;
      expect(s1.body).toContain('Season theme: Infrastructure boom');
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.goal).toBe('hardware-shortage');
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.goal).toBe('maintenance-season');
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.goal).toBe('ticket-surge');
      advanceTicks(world, PRESTIGE_DAY_TICKS);
      expect(world.goal).toBe('contract-boom'); // the rotation wraps
    });

    it('bends the economy dial: boom signs fees higher, tariffs inflate hardware', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      expect(world.contracts[0]?.feePerDay).toBe(25); // quiet-season baseline
      world.goal = 'contract-boom';
      applyCommand(world, { type: 'signContract', client: 'Café Kopi Dua', deviceId: byKind('desktop').id });
      expect(world.contracts[1]?.feePerDay).toBe(19); // Math.round(15 * 1.25)
      world.goal = 'hardware-shortage';
      const before = world.cash;
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 0, y: 0 });
      expect(before - world.cash).toBe(360); // 300 * 1.2
      expect(devicePrice(world, world.catalog.desktop!)).toBe(360);
    });

    it('bends the economy dial: maintenance halves repairs, surge boosts ticket pay', () => {
      buildSimpleLan();
      world.goal = 'ticket-surge';
      const ticket = openTicket(world, { client: 'Walk-in', title: 'down', symptom: 's', slaTicks: 100, rewardCash: 100, penaltyCash: 10 });
      expect(ticket.rewardCash).toBe(125); // 100 * 1.25
      world.goal = 'maintenance-season';
      expect(repairCost(world)).toBe(30); // REPAIR_COST halved
      const sw = byKind('switch-unmanaged');
      sw.failed = true;
      const before = world.cash;
      applyCommand(world, { type: 'repairDevice', deviceId: sw.id });
      expect(before - world.cash).toBe(30);
      expect(sw.failed).toBe(false);
    });

    it('a rival ISP poaches the highest-fee contract when a season closes strong', () => {
      // Sign just before the close (the established pattern) and lift the
      // score above the poach threshold with reputation points.
      advanceTicks(world, PRESTIGE_DAY_TICKS - 1);
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      applyCommand(world, { type: 'signContract', client: 'Novabit (partner network)', deviceId: byKind('server').id });
      world.reputation = 4; // 100 points, plus 80 contract and 15 network
      advanceTicks(world, 1); // season closes
      const top = [...world.contracts].sort((a, b) => b.feePerDay - a.feePerDay)[0]!;
      const poach = world.mail.find((m) => m.actions.some((a) => a.command === `matchRival:${top.id}`));
      expect(poach).toBeDefined();
      expect(poach?.subject).toBe('SkyLink Broadband offered us a better deal');
      const fee = top.feePerDay;
      applyCommand(world, { type: 'mailAction', mailId: poach!.id, command: `matchRival:${top.id}` });
      expect(top.active).toBe(true);
      expect(top.feePerDay).toBe(Math.round(fee * 0.85)); // the price of staying
      const report = world.mail.find((m) => m.subject.includes('Season 1 report'))!;
      expect(report.body).toContain('SkyLink Broadband has noticed your climb');
    });

    it('declining a poach keeps the fee but costs a trust strike', () => {
      advanceTicks(world, PRESTIGE_DAY_TICKS - 1);
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      world.reputation = 4; // 155 points: above the poach threshold
      advanceTicks(world, 1); // season closes
      const contract = world.contracts[0]!;
      const poach = world.mail.find((m) => m.actions.some((a) => a.command === `declineRival:${contract.id}`))!;
      applyCommand(world, { type: 'mailAction', mailId: poach.id, command: `declineRival:${contract.id}` });
      expect(contract.active).toBe(true);
      expect(contract.breaches).toBe(1); // one strike from 3 — churn at term end now looms
      expect(contract.feePerDay).toBe(25); // the margin held
    });

    it('a quiet season draws no rival attention', () => {
      world.cash = 0; // the shared world is funded; empty shop scores ~0
      advanceTicks(world, PRESTIGE_DAY_TICKS); // far below the poach threshold
      expect(world.mail.some((m) => m.subject.includes('SkyLink Broadband offered us a better deal'))).toBe(false);
      const report = world.mail.find((m) => m.subject.includes('Season 1 report'))!;
      expect(report.body).not.toContain('SkyLink Broadband');
    });

    it('a high career prestige undercuts every new signing by the rival discount', () => {
      // A closed strong season puts the shop on SkyLink's radar; the record
      // here stands in for running the whole season.
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      expect(world.contracts[0]?.feePerDay).toBe(21); // Math.round(25 * 0.85)
      expect(world.log.some((e) => e.text.includes('undercut by SkyLink Broadband'))).toBe(true);
    });

    it('new signings pay full rate while the rival is not watching', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      expect(world.contracts[0]?.feePerDay).toBe(25); // untouched baseline
    });

    it('proposal letters name the rival bid and sign at the undercut rate', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      advanceTicks(world, 12); // the midday proposal roll
      const proposal = world.mail.find((m) => m.actions.some((a) => a.command.startsWith('signContractOffer:')));
      expect(proposal?.body).toContain('a rep from SkyLink Broadband came by this week');
      applyCommand(world, { type: 'mailAction', mailId: proposal!.id, command: proposal!.actions[0]!.command });
      expect(world.contracts[0]?.feePerDay).toBe(13); // Café Kopi Dua: Math.round(15 * 0.85)
    });

    it('the rival poaches a proposal left unsigned for a full day', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      advanceTicks(world, 12); // Café Kopi Dua's proposal arrives midday
      const proposal = world.mail.find((m) => m.actions.some((a) => a.command === 'signContractOffer:Café Kopi Dua'))!;
      advanceTicks(world, 24); // a full day passes without signing
      expect(proposal.actionTaken).toBe('poachedByRival');
      expect(world.mail.some((m) => m.subject === 'We went with SkyLink Broadband')).toBe(true);
      expect(world.log.some((e) => e.text.includes('got to Café Kopi Dua first'))).toBe(true);
      // Signing the ghost does nothing: the letter is spent.
      applyCommand(world, { type: 'mailAction', mailId: proposal.id, command: 'signContractOffer:Café Kopi Dua' });
      expect(world.contracts).toHaveLength(0);
    });

    it('proposals sit safely while the rival is not watching', () => {
      buildSimpleLan();
      advanceTicks(world, 12);
      const proposal = world.mail.find((m) => m.actions.some((a) => a.command.startsWith('signContractOffer:')))!;
      advanceTicks(world, 24);
      expect(proposal.actionTaken).toBeUndefined();
    });

    it('a fresh proposal is not poached on the day it arrives', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      advanceTicks(world, 12);
      const proposal = world.mail.find((m) => m.actions.some((a) => a.command.startsWith('signContractOffer:')))!;
      expect(proposal.actionTaken).toBeUndefined();
    });

    it('a lost client earns a rival taunt in the events log while the rival watches', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      byKind('desktop').failed = true; // three daily rolls, three strikes → churn
      advanceTicks(world, 72);
      expect(world.log.some((e) => e.text.includes('churned after repeated failures'))).toBe(true);
      expect(world.log.some((e) => e.text.includes('SkyLink Broadband') && e.text.includes('Klinik Sehat'))).toBe(true);
    });

    it('a lost client walks quietly while the rival is not watching', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      byKind('desktop').failed = true;
      advanceTicks(world, 72);
      expect(world.log.some((e) => e.text.includes('churned after repeated failures'))).toBe(true);
      expect(world.log.every((e) => !(e.text.includes('switched') || e.text.includes('prospect book')))).toBe(true);
    });

    it('a win-back campaign brings a churned client home at the rival price', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      byKind('desktop').failed = true;
      advanceTicks(world, 72); // three daily strikes → churn
      expect(world.contracts[0]!.active).toBe(false);
      byKind('desktop').failed = false; // the box is fixed before the visit
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'win-back', client: 'Klinik Sehat' });
      expect(before - world.cash).toBe(150);
      expect(world.contracts).toHaveLength(2);
      expect(world.contracts[1]!.active).toBe(true);
      expect(world.contracts[1]!.feePerDay).toBe(21); // coming back costs the rival's rate: 25 × 0.85
      expect(world.mail.some((m) => m.subject === 'Giving your shop another chance')).toBe(true);
    });

    it('a win-back campaign falls flat while the client\'s box is still broken', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      byKind('desktop').failed = true;
      advanceTicks(world, 72); // churn; the box stays broken
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'win-back', client: 'Klinik Sehat' });
      expect(before - world.cash).toBe(150);
      expect(world.contracts.every((c) => !c.active)).toBe(true);
      expect(world.mail.some((m) => m.subject === 'We appreciate the offer')).toBe(true);
    });

    it('a win-back below the rival radar signs at the full rate', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'signContract', client: 'Klinik Sehat', deviceId: byKind('desktop').id });
      byKind('desktop').failed = true;
      advanceTicks(world, 72);
      byKind('desktop').failed = false;
      applyCommand(world, { type: 'goodwill', action: 'win-back', client: 'Klinik Sehat' });
      expect(world.contracts[1]!.feePerDay).toBe(25); // no rival, no discount
    });

    it('a rival-held client costs more to win back and signs at the deeper discount', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      advanceTicks(world, 12); // Café Kopi Dua's proposal arrives
      advanceTicks(world, 24); // SkyLink poaches it
      expect(rivalHolds(world, 'Café Kopi Dua')).toBe(true);
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'win-back', client: 'Café Kopi Dua' });
      expect(before - world.cash).toBe(250); // the rival makes the visit expensive
      expect(world.contracts).toHaveLength(1);
      expect(world.contracts[0]!.feePerDay).toBe(11); // 15 at 25% off: the rival met the offer
      expect(world.mail.some((m) => m.subject === 'Leaving SkyLink Broadband for your shop')).toBe(true);
    });

    it('a rival-held client stays put while their device is broken', () => {
      world.prestigeHistory.push({ season: 1, score: RIVAL_POACH_SCORE, breakdown: { cashPoints: 0, reputationPoints: 0, insightPoints: 0, contractPoints: 0, networkPoints: 0, servicePoints: 0, hardBonus: 0, total: RIVAL_POACH_SCORE } });
      buildSimpleLan();
      advanceTicks(world, 36); // proposal arrives midday, then the rival poaches
      byKind('desktop').failed = true;
      const before = world.cash;
      applyCommand(world, { type: 'goodwill', action: 'win-back', client: 'Café Kopi Dua' });
      expect(before - world.cash).toBe(250);
      expect(world.contracts).toHaveLength(0);
      expect(world.mail.some((m) => m.subject === 'We appreciate the offer')).toBe(true);
      expect(world.log.some((e) => e.text.includes('matched your visit'))).toBe(true);
    });
  });

  describe('Contracts', () => {
    function signWith(device: Device, client = 'Klinik Sehat'): void {
      applyCommand(world, { type: 'signContract', client, deviceId: device.id });
    }

    it('signs a contract with a matching device and pays daily', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      expect(world.contracts).toHaveLength(1);
      expect(world.contracts[0]?.active).toBe(true);
      expect(world.contracts[0]?.feePerDay).toBe(25); // base fee, neutral rep

      const before = world.cash;
      advanceTicks(world, 24);
      expect(world.cash).toBe(before + 25);
      expect(world.log.at(-1)?.text).toContain('daily contract fees collected: +$25');
    });

    it('premium reputation locks a higher fee at signing', () => {
      world.reputation = 5;
      buildSimpleLan();
      signWith(byKind('desktop'));
      expect(world.contracts[0]?.feePerDay).toBe(31); // round(25 * 1.25)
    });

    it('refuses a second contract for the same client and mismatched device kind', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      signWith(pc);
      expect(world.contracts).toHaveLength(1);
      expect(world.log.at(-1)?.text).toContain('already has an active contract');

      applyCommand(world, { type: 'signContract', client: 'Novabit (partner network)', deviceId: pc.id });
      expect(world.contracts).toHaveLength(1);
      expect(world.log.at(-1)?.text).toContain('needs a server');
    });

    it('withholds payment while the client device is compromised', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      const before = world.cash;
      pc.compromised = true;
      advanceTicks(world, 24);
      expect(world.cash).toBe(before);
      expect(world.log.some((e) => e.text.includes('withholding $25'))).toBe(true);
      expect(world.log.some((e) => e.text.includes('trust strike 1/3'))).toBe(true);
    });

    it('ends the contract when the client device leaves the board', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      applyCommand(world, { type: 'deleteDevice', deviceId: pc.id });
      const contract = world.contracts[0];
      advanceTicks(world, 24);
      expect(contract?.active).toBe(false);
      expect(world.log.some((e) => e.text.includes('left the board'))).toBe(true);
    });

    it('cancelContract stops the income', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      const contract = world.contracts[0];
      applyCommand(world, { type: 'cancelContract', contractId: contract!.id });
      const before = world.cash;
      advanceTicks(world, 24);
      expect(world.cash).toBe(before);
      expect(world.log.some((e) => e.text.includes('contract cancelled'))).toBe(true);
    });

    it('a compromised contract device makes its client file a security ticket', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true;
      advanceTicks(world, 1);
      const ticket = world.tickets.find((t) => t.client === 'Klinik Sehat');
      expect(ticket?.status).toBe('open');
      expect(ticket?.title).toBe('Our machines are acting strange');
    });

    it('a contract device with every linked interface shut makes its client file an outage ticket', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      applyCommand(world, { type: 'setInterfaceEnabled', deviceId: pc.id, interfaceName: 'eth0', enabled: false });
      advanceTicks(world, 1);
      const ticket = world.tickets.find((t) => t.client === 'Klinik Sehat');
      expect(ticket?.title).toBe('The whole site is offline');
    });

    it('keeps one open ticket per contract client even while the problem persists', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true;
      advanceTicks(world, 3);
      const open = world.tickets.filter((t) => t.client === 'Klinik Sehat' && t.status === 'open');
      expect(open).toHaveLength(1);
    });

    it('the outdated-firmware incident files under the contract client, not Novabit', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: pc.id, latestVersion: 'os 2.0' });
      const ticket = world.tickets.find((t) => t.title === 'Strange traffic from your side');
      expect(ticket?.client).toBe('Klinik Sehat');
    });

    it('a contract client mails a follow-up letter when their ticket opens, with an acknowledge action', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true;
      advanceTicks(world, 1);
      const ticket = world.tickets.find((t) => t.client === 'Klinik Sehat');
      const letter = world.mail.find((m) => m.subject.includes(ticket!.title));
      expect(letter?.kind).toBe('client');
      expect(letter?.body).toContain(ticket!.symptom);
      expect(letter?.actions[0]?.command).toBe(`ackContractTicket:${ticket!.id}`);
    });

    it('non-contract tickets produce no client mail', () => {
      const before = world.mail.length;
      openTicket(world, { client: 'Random Walk-In', title: 'router blinking', symptom: 'lights are orange', slaTicks: 100, rewardCash: 50, penaltyCash: 20 });
      expect(world.mail).toHaveLength(before);
    });

    it('acknowledging the letter logs receipt but pays nothing', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true;
      advanceTicks(world, 1);
      const letter = world.mail.find((m) => m.kind === 'client');
      const cash = world.cash;
      const rep = world.reputation;
      applyCommand(world, { type: 'mailAction', mailId: letter!.id, command: letter!.actions[0]!.command });
      expect(world.cash).toBe(cash);
      expect(world.reputation).toBe(rep);
      expect(world.log.at(-1)?.text).toContain("acknowledged Klinik Sehat's report");
    });

    it('resolving a contract client ticket in SLA delivers a thank-you letter; a breach gets a cold one', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true;
      advanceTicks(world, 1);
      const ticket = world.tickets.find((t) => t.client === 'Klinik Sehat')!;
      applyCommand(world, { type: 'resolveTicket', ticketId: ticket.id });
      const thanks = world.mail.filter((m) => m.subject.startsWith('Re: Ticket:')).at(-1);
      expect(thanks?.body).toContain('Thank you');

      // Breach path: let the next contract ticket (re-filed, box still
      // compromised) run out of SLA, then resolve it late.
      advanceTicks(world, 2);
      const second = world.tickets.filter((t) => t.client === 'Klinik Sehat' && t.status === 'open').at(-1)!;
      second.openedTick = world.tick - second.slaTicks - 1;
      advanceTicks(world, 1); // breach fires
      applyCommand(world, { type: 'resolveTicket', ticketId: second.id });
      const cold = world.mail.filter((m) => m.subject.startsWith('Re: Ticket:')).at(-1);
      expect(cold?.body).toContain('took too long');
    });

    it('a spotless term ends with a renewal offer the player accepts by mail', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      const contract = world.contracts[0]!;
      expect(contract.endTick).toBe(world.tick + 240);
      advanceTicks(world, 240); // ten clean days
      expect(contract.active).toBe(false);
      const offer = world.mail.find((m) => m.subject === 'Renewing our contract?');
      expect(offer?.actions[0]?.command).toBe(`renewContract:${contract.id}`);

      const before = world.contracts.length;
      applyCommand(world, { type: 'mailAction', mailId: offer!.id, command: offer!.actions[0]!.command });
      const renewed = world.contracts.at(-1)!;
      expect(world.contracts).toHaveLength(before + 1);
      expect(renewed.active).toBe(true);
      expect(renewed.client).toBe('Klinik Sehat');
      expect(renewed.deviceId).toBe(contract.deviceId);
      expect(renewed.breaches).toBe(0);
      expect(renewed.endTick).toBe(world.tick + 240);
    });

    it('a term with any strike ends in churn: no renewal offer, the client tells others', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true; // strike 1 on the first daily roll
      advanceTicks(world, 24);
      pc.compromised = false; // repaired, but the strike stands
      advanceTicks(world, 240 - 24);
      const contract = world.contracts[0]!;
      expect(contract.active).toBe(false);
      expect(contract.breaches).toBeGreaterThanOrEqual(1);
      expect(world.mail.some((m) => m.subject === 'We are not renewing')).toBe(true);
      expect(world.mail.some((m) => m.subject === 'Renewing our contract?')).toBe(false);
      expect(world.log.some((e) => e.text.includes('not renewing'))).toBe(true);
    });

    it('three strikes inside the term churn the client early', () => {
      buildSimpleLan();
      const pc = byKind('desktop');
      signWith(pc);
      pc.compromised = true; // each daily roll withholds a fee and lands a strike
      advanceTicks(world, 72);
      const contract = world.contracts[0]!;
      expect(contract.active).toBe(false);
      expect(contract.breaches).toBe(3);
      expect(world.log.some((e) => e.text.includes('churned after repeated failures'))).toBe(true);
      expect(world.mail.some((m) => m.subject === 'We are ending our contract')).toBe(true);
    });

    it('contract proposals arrive by mail, one client per day, and sign from the letter', () => {
      buildSimpleLan();
      advanceTicks(world, 12); // midday of day 1: the first eligible client writes
      const proposals = world.mail.filter((m) => m.subject === 'Maintenance contract proposal');
      expect(proposals).toHaveLength(1);
      const proposal = proposals[0]!;
      expect(proposal.kind).toBe('client');
      expect(proposal.body).toContain('maintenance contract');
      const clientName = proposal.actions[0]!.command.slice('signContractOffer:'.length);
      const offer = CONTRACT_OFFERS.find((o) => o.client === clientName)!;

      const before = world.contracts.length;
      applyCommand(world, { type: 'mailAction', mailId: proposal.id, command: proposal.actions[0]!.command });
      expect(world.contracts).toHaveLength(before + 1);
      const signed = world.contracts.at(-1)!;
      expect(signed.active).toBe(true);
      expect(signed.feePerDay).toBe(offer.baseFeePerDay); // neutral rep
      expect(world.devices[signed.deviceId]?.kind).toBe(offer.requiresKind);
    });

    it('signing a proposal without the required device warns and keeps the letter actionable', () => {
      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
      advanceTicks(world, 12); // a desktop-only board draws the desktop clients
      const proposal = world.mail.find((m) => m.actions.some((a) => a.command.startsWith('signContractOffer:')))!;
      applyCommand(world, { type: 'deleteDevice', deviceId: byKind('desktop').id });

      const contractsBefore = world.contracts.length;
      applyCommand(world, { type: 'mailAction', mailId: proposal.id, command: proposal.actions[0]!.command });
      expect(world.contracts).toHaveLength(contractsBefore);
      expect(world.log.at(-1)?.level).toBe('warn');
      expect(proposal.actionTaken).toBeUndefined(); // the letter is still live

      applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc2', x: 50, y: 50 });
      applyCommand(world, { type: 'mailAction', mailId: proposal.id, command: proposal.actions[0]!.command });
      expect(world.contracts).toHaveLength(contractsBefore + 1);
    });

    it('a client who ever signed does not receive another proposal', () => {
      buildSimpleLan();
      signWith(byKind('desktop')); // Klinik Sehat signs before any proposal
      advanceTicks(world, 48); // two proposal days
      const proposers = world.mail
        .filter((m) => m.subject === 'Maintenance contract proposal')
        .map((m) => m.actions[0]!.command.slice('signContractOffer:'.length));
      expect(proposers).toHaveLength(2); // the other desktop client, then the server client
      expect(proposers.every((name) => name !== 'Klinik Sehat')).toBe(true);
    });

    it('insight sharpens the eye: alert level rises at 1 and 3 reports', () => {
      expect(phishAlertLevel(0)).toBe('none');
      expect(phishAlertLevel(1)).toBe('uneasy');
      expect(phishAlertLevel(2)).toBe('uneasy');
      expect(phishAlertLevel(3)).toBe('trained');
      expect(phishAlertLevel(9)).toBe('trained');
    });

    it('the spam filter quarantines arriving phishes from insight 3 and reports them itself from insight 5', () => {
      const deliver = (): Mail => {
        const before = world.mail.length;
        deliverMail(world, {
          from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
          subject: 'URGENT: unpaid invoice',
          body: 'Pay now.',
          kind: 'phish',
          actions: [
            { label: 'Pay now', command: 'phish-pay' },
            { label: 'Report as phish', command: 'reportPhish' },
          ],
        });
        return world.mail[before]!;
      };

      world.insight = 2;
      const green = deliver();
      expect(green.quarantined).toBeFalsy();
      expect(green.actionTaken).toBeUndefined();

      world.insight = 3;
      const flagged = deliver();
      expect(flagged.quarantined).toBe(true);
      expect(flagged.actionTaken).toBeUndefined(); // the player still decides

      world.insight = 5;
      const caught = deliver();
      expect(caught.quarantined).toBe(true);
      expect(caught.actionTaken).toBe('reportPhish'); // filter reported it: no buttons to press
      const cash = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: caught.id, command: 'phish-pay' });
      expect(world.cash).toBe(cash); // the action did nothing

      // Client letters are never touched by the filter.
      world.insight = 9;
      const client = deliverMail(world, { from: 'Klinik Sehat <office@kliniksehat.example>', subject: 'Ticket: down', body: 'Hi', kind: 'client' });
      expect(client.quarantined).toBeFalsy();
      expect(client.actionTaken).toBeUndefined();
    });

    it('paying phishing invoices costs escalating reputation: -1, then -2, capped at -4', () => {
      buildSimpleLan();
      while (world.mail.filter((m) => m.kind === 'phish').length < 3) advanceTicks(world, 96);
      const phishes = world.mail.filter((m) => m.kind === 'phish');
      expect(phishes.length).toBeGreaterThanOrEqual(3);

      const pay = (i: number, expectedRepLoss: number): void => {
        const rep = world.reputation;
        const cash = world.cash;
        const phish = phishes[i]!;
        applyCommand(world, { type: 'mailAction', mailId: phish.id, command: 'phish-pay' });
        expect(world.reputation).toBe(rep - expectedRepLoss);
        expect(world.cash).toBe(cash - 250);
        expect(world.phishPayments).toBe(i + 1);
        expect(world.log.at(-1)?.text).toContain(`-${expectedRepLoss} rep`);
      };
      pay(0, 1); // first slip: nobody has heard yet
      pay(1, 2); // word is spreading
      pay(2, 3); // repeat customers of scams talk
      expect(phishPayRepLoss(99)).toBe(4); // the cap
    });

    it('paying a phish puts a trust strike on every contract and draws a warning letter', () => {
      buildSimpleLan();
      applyCommand(world, { type: 'placeDevice', defId: 'server', name: 'srv2', x: 300, y: 0 });
      while (!world.mail.some((m) => m.kind === 'phish')) advanceTicks(world, 96); // deterministic chunked wait
      signWith(byKind('desktop')); // Klinik Sehat
      signWith(byKind('server'), 'Novabit (partner network)');
      const phish = world.mail.find((m) => m.kind === 'phish')!;

      applyCommand(world, { type: 'mailAction', mailId: phish.id, command: 'phish-pay' });
      const active = world.contracts.filter((c) => c.active);
      expect(active).toHaveLength(2);
      expect(active.every((c) => c.breaches === 1)).toBe(true);
      const warning = world.mail.find((m) => m.subject === 'About the invoice you paid');
      expect(warning?.body).toContain('fake vendor');
      expect(warning?.body).toContain('warning');
    });

    it('a third phish payment churns the remaining contract clients', () => {
      buildSimpleLan();
      while (world.mail.filter((m) => m.kind === 'phish').length < 3) advanceTicks(world, 96);
      signWith(byKind('desktop'));
      const phishes = world.mail.filter((m) => m.kind === 'phish').slice(0, 3);
      expect(phishes).toHaveLength(3);
      for (const phish of phishes) {
        applyCommand(world, { type: 'mailAction', mailId: phish.id, command: 'phish-pay' });
      }
      expect(world.contracts[0]!.active).toBe(false);
      expect(world.contracts[0]!.breaches).toBe(3);
      expect(world.log.some((e) => e.text.includes('churned after repeated failures'))).toBe(true);
      expect(world.mail.some((m) => m.subject === 'We are ending our contract')).toBe(true);
      // Payments 1 and 2 each draw a warning from the still-trusting client;
      // payment 3 churns them instead, so the ending letter replaces the third.
      expect(world.mail.filter((m) => m.subject === 'About the invoice you paid')).toHaveLength(2);
    });

    it('discarding moves a letter out of the inbox without destroying it, and restoring brings it back', () => {
      const letter = deliverMail(world, { from: 'Mentor', subject: 'Check your routes', body: 'Routing table first.', kind: 'mentor' });
      expect(letter.discarded).toBeFalsy();

      applyCommand(world, { type: 'discardMail', mailId: letter.id });
      expect(letter.discarded).toBe(true);
      expect(letter.read).toBe(true); // discarding implies seen

      // The letter survives: its actions still fire from the discard folder.
      const actionable = deliverMail(world, {
        from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
        subject: 'URGENT: unpaid invoice',
        body: 'Pay now.',
        kind: 'phish',
        actions: [{ label: 'Report as phish', command: 'reportPhish' }],
      });
      applyCommand(world, { type: 'discardMail', mailId: actionable.id });
      const cash = world.cash;
      applyCommand(world, { type: 'mailAction', mailId: actionable.id, command: 'reportPhish' });
      expect(world.cash).toBe(cash); // reportPhish has no cash effect; just prove it ran
      expect(actionable.actionTaken).toBe('reportPhish');

      applyCommand(world, { type: 'discardMail', mailId: letter.id, restore: true });
      expect(letter.discarded).toBe(false);
    });

    it('the fake contract-proposal phish pays the deposit and fools nobody who reports it', () => {
      buildSimpleLan();
      const before = world.mail.length;
      // Chunked wait: the ambient roll's template depends on the RNG stream,
      // so loop instead of assuming a fixed number of ticks.
      let guard = 0;
      while (!world.mail.slice(before).some((m) => m.subject === 'Maintenance contract proposal' && m.kind === 'phish') && guard < 50) {
        advanceTicks(world, 96);
        guard += 1;
      }
      const phish = world.mail
        .slice(before)
        .find((m) => m.subject === 'Maintenance contract proposal' && m.kind === 'phish');
      expect(phish).toBeDefined();
      expect(phish!.from).not.toContain('office@'); // real clients send from office@
      expect(phish!.body).toContain('deposit'); // the tell: real clients never ask for money

      const cash = world.cash;
      const rep = world.reputation;
      applyCommand(world, { type: 'mailAction', mailId: phish!.id, command: 'phish-pay' });
      expect(world.cash).toBe(cash - 250); // the deposit, doubled by the payment page
      expect(world.reputation).toBe(rep - 1);
      expect(world.contracts.every((c) => c.client !== 'PT Garda Jaya Networking')).toBe(true);
    });
  });
});
