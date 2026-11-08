import type { Command, Device, Endpoint, Event, Interface as NetInterface, World } from './types.ts';
import { log, nextId, nextRandom, randomMac } from './state.ts';
import { findPath } from './net.ts';

// Re-exports: the client talks to the engine through this module only.
export { createWorld } from './state.ts';
export * from './types.ts';
export { findPath } from './net.ts';

const DEFAULT_INTERFACES: Record<string, { name: string; kind: NetInterface['kind'] }[]> = {
  desktop: [{ name: 'eth0', kind: 'ethernet' }],
  server: [
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
  ],
  printer: [{ name: 'eth0', kind: 'ethernet' }],
  'switch-unmanaged': [
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
    { name: 'eth2', kind: 'ethernet' },
    { name: 'eth3', kind: 'ethernet' },
  ],
  'switch-managed': [
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
    { name: 'eth2', kind: 'ethernet' },
    { name: 'eth3', kind: 'ethernet' },
    { name: 'eth4', kind: 'ethernet' },
    { name: 'eth5', kind: 'ethernet' },
  ],
  'router-soho': [
    { name: 'wan1', kind: 'wan' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
    { name: 'wifi0', kind: 'wifi' },
  ],
  'router-edge': [
    { name: 'wan1', kind: 'wan' },
    { name: 'wan2', kind: 'wan' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
  ],
  'access-point': [{ name: 'wifi0', kind: 'wifi' }],
  firewall: [
    { name: 'wan1', kind: 'wan' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
  ],
  ups: [],
};

function isWired(world: World, deviceId: string, interfaceName: string): boolean {
  return world.links.some(
    (link) =>
      (link.a.deviceId === deviceId && link.a.interfaceName === interfaceName) ||
      (link.b.deviceId === deviceId && link.b.interfaceName === interfaceName),
  );
}

function endpointIsFree(world: World, endpoint: Endpoint): string | undefined {
  const device = world.devices[endpoint.deviceId];
  if (device === undefined) return `no device ${endpoint.deviceId}`;
  if (device.interfaces.every((iface) => iface.name !== endpoint.interfaceName)) {
    return `${device.name} has no interface ${endpoint.interfaceName}`;
  }
  if (isWired(world, endpoint.deviceId, endpoint.interfaceName)) {
    return `${device.name}:${endpoint.interfaceName} is already wired`;
  }
  return undefined;
}

function deviceById(world: World, deviceId: string): Device | undefined {
  return world.devices[deviceId];
}

/**
 * Apply one command in place; returns the events it produced. Mutating by
 * design: the World is the authoritative state; clients snapshot it for saves.
 */
export function applyCommand(world: World, command: Command): Event[] {
  const before = world.log.length;
  switch (command.type) {
    case 'placeDevice': {
      const def = world.catalog[command.defId];
      if (def === undefined) {
        log(world, 'warn', 'shop', `unknown device "${command.defId}"`);
        break;
      }
      if (world.cash < def.price) {
        log(world, 'warn', 'shop', `not enough cash for ${def.name} ($${def.price})`);
        break;
      }
      world.cash -= def.price;
      const device: Device = {
        id: nextId(world, def.kind),
        kind: def.kind,
        name: command.name ?? def.name,
        defId: def.id,
        x: command.x,
        y: command.y,
        interfaces: (DEFAULT_INTERFACES[def.kind] ?? []).map((iface) => ({
          name: iface.name,
          kind: iface.kind,
          mac: randomMac(world),
          enabled: true,
        })),
        config: { firewallRules: [], routes: [], dhcpPools: [], dnsRecords: [] },
        uptimeTicks: 0,
        firmware: def.firmware,
      };
      world.devices[device.id] = device;
      log(world, 'info', 'board', `placed ${device.name} (${def.name}, $${def.price})`);
      break;
    }

    case 'deleteDevice': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      world.links = world.links.filter(
        (link) => link.a.deviceId !== device.id && link.b.deviceId !== device.id,
      );
      delete world.devices[device.id];
      log(world, 'info', 'board', `removed ${device.name}`);
      break;
    }

    case 'wireLink': {
      const problem = endpointIsFree(world, command.a) ?? endpointIsFree(world, command.b);
      if (problem !== undefined) {
        log(world, 'warn', 'board', `cannot wire: ${problem}`);
        break;
      }
      world.links.push({
        id: nextId(world, 'link'),
        a: command.a,
        b: command.b,
        media: command.media ?? 'copper',
      });
      const a = world.devices[command.a.deviceId];
      const b = world.devices[command.b.deviceId];
      log(world, 'info', 'board', `wired ${a?.name}:${command.a.interfaceName} ↔ ${b?.name}:${command.b.interfaceName}`);
      break;
    }

    case 'unwireLink': {
      const link = world.links.find((l) => l.id === command.linkId);
      if (link === undefined) break;
      world.links = world.links.filter((l) => l.id !== command.linkId);
      log(world, 'info', 'board', `removed link ${link.id}`);
      break;
    }

    case 'setIpv4': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const iface = device.interfaces.find((i) => i.name === command.interfaceName);
      if (iface === undefined) {
        log(world, 'warn', device.name, `no interface ${command.interfaceName}`);
        break;
      }
      if (command.address === undefined) {
        delete iface.ipv4;
        log(world, 'info', device.name, `${iface.name}: IPv4 cleared`);
        break;
      }
      iface.ipv4 = {
        address: command.address,
        prefix: command.prefix ?? iface.ipv4?.prefix ?? 24,
      };
      log(world, 'info', device.name, `${iface.name}: ${iface.ipv4.address}/${iface.ipv4.prefix}`);
      break;
    }

    case 'addFirewallRule': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const rule = { ...command.rule, id: nextId(world, 'rule') };
      device.config.firewallRules.push(rule);
      log(world, 'info', device.name, `firewall rule added: ${rule.action} ${rule.srcCidr ?? '*'} → ${rule.dstCidr ?? '*'}${rule.dstPort !== undefined ? `:${rule.dstPort}` : ''}`);
      break;
    }

    case 'removeFirewallRule': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      device.config.firewallRules = device.config.firewallRules.filter((r) => r.id !== command.ruleId);
      break;
    }

    case 'addRoute': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      device.config.routes.push(command.route);
      log(world, 'info', device.name, `route added: ${command.route.destinationCidr}`);
      break;
    }

    case 'setDnsForwarder': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      if (command.address === undefined) {
        delete device.config.dnsForwarder;
      } else {
        device.config.dnsForwarder = command.address;
      }
      log(world, 'info', device.name, `DNS forwarder: ${device.config.dnsForwarder ?? 'none'}`);
      break;
    }

    case 'ping': {
      const from = deviceById(world, command.fromDevice);
      if (from === undefined) break;
      const result = findPath(world, command.fromDevice, command.toAddress);
      if (result.ok) {
        log(world, 'info', from.name, `ping ${command.toAddress}: reply from ${command.toAddress} (${result.hops.length} hops)`);
      } else {
        const blocked = result.blockedAt;
        const where = blocked !== undefined ? (world.devices[blocked.deviceId]?.name ?? blocked.deviceId) : 'unknown';
        log(world, 'warn', from.name, `ping ${command.toAddress}: timeout — ${blocked?.reason ?? 'unreachable'} (at ${where})`);
      }
      break;
    }

    case 'buy': {
      const def = world.catalog[command.defId];
      if (def === undefined) {
        log(world, 'warn', 'shop', `unknown item "${command.defId}"`);
        break;
      }
      if (world.cash < def.price) {
        log(world, 'warn', 'shop', `cannot afford ${def.name}: $${world.cash} < $${def.price}`);
        break;
      }
      world.cash -= def.price;
      log(world, 'info', 'shop', `bought ${def.name} for $${def.price}`);
      break;
    }
  }
  return world.log.slice(before);
}

/** Advance simulated time. Lease expiry, wear rolls, and incidents land here. */
export function advanceTicks(world: World, count: number): Event[] {
  const before = world.log.length;
  for (let i = 0; i < count; i++) {
    world.tick += 1;
    for (const device of Object.values(world.devices)) {
      device.uptimeTicks += 1;
    }
    if (world.tick % 24 === 0) {
      // Placeholder for the daily contract payout (GDD §6.2).
      void nextRandom(world);
    }
  }
  return world.log.slice(before);
}
