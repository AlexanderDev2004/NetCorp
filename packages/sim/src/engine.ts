import type { Command, Device, Endpoint, Event, Interface as NetInterface, Ticket, World } from './types.ts';
import { log, nextId, nextRandom, randomMac } from './state.ts';
import { findDhcpServers, findPath } from './net.ts';
import { allocateAddress } from './protocols/dhcp.ts';

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

    case 'moveDevice': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      device.x = command.x;
      device.y = command.y;
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
        delete iface.ipv4Gateway;
        delete iface.ipv4Source;
        delete iface.leaseServerDeviceId;
        log(world, 'info', device.name, `${iface.name}: IPv4 cleared`);
        break;
      }
      iface.ipv4 = {
        address: command.address,
        prefix: command.prefix ?? iface.ipv4?.prefix ?? 24,
      };
      iface.ipv4Source = 'static';
      delete iface.leaseServerDeviceId;
      if (command.gateway !== undefined) {
        iface.ipv4Gateway = command.gateway;
      }
      log(world, 'info', device.name, `${iface.name}: ${iface.ipv4.address}/${iface.ipv4.prefix}${iface.ipv4Gateway !== undefined ? ` gw ${iface.ipv4Gateway}` : ''}`);
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

    case 'addDhcpPool': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const pool = {
        interfaceName: command.pool.interfaceName,
        network: command.pool.network,
        prefix: command.pool.prefix,
        rangeStart: command.pool.rangeStart,
        rangeEnd: command.pool.rangeEnd,
        leaseMinutes: command.pool.leaseMinutes ?? 120,
      };
      const iface = device.interfaces.find((i) => i.name === pool.interfaceName);
      if (iface === undefined) {
        log(world, 'warn', device.name, `cannot add DHCP pool: no interface ${pool.interfaceName}`);
        break;
      }
      device.config.dhcpPools = device.config.dhcpPools.filter((p) => p.interfaceName !== pool.interfaceName);
      device.config.dhcpPools.push(pool);
      log(world, 'info', device.name, `DHCP pool on ${pool.interfaceName}: ${pool.network}/${pool.prefix} (${pool.rangeStart} – ${pool.rangeEnd})`);
      break;
    }

    case 'removeDhcpPool': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      device.config.dhcpPools = device.config.dhcpPools.filter((p) => p.interfaceName !== command.interfaceName);
      log(world, 'info', device.name, `DHCP pool removed from ${command.interfaceName}`);
      break;
    }

    case 'dhcpDiscover': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const iface =
        command.interfaceName === undefined
          ? (device.interfaces.find((i) => i.kind !== 'wan' && i.ipv4 === undefined) ??
            device.interfaces.find((i) => i.kind !== 'wan'))
          : device.interfaces.find((i) => i.name === command.interfaceName);
      if (iface === undefined) {
        log(world, 'warn', device.name, 'DHCP: no interface available to request a lease');
        break;
      }

      const servers = findDhcpServers(world, device.id, iface.name);
      if (servers.length === 0) {
        log(world, 'warn', device.name, `DHCP discover on ${iface.name}: no offers received`);
        break;
      }
      // All offers arrive nearly together; a dedicated consumer box answers
      // faster than a router serving DHCP as a side task, so an injected
      // rogue wins the offer race. The client just takes the first offer —
      // it has no way to tell a rogue from the real one (GDD §5.1, §7.1).
      const winner =
        servers.find((server) => server.incident === true) ??
        [...servers].sort((a, b) => a.id.localeCompare(b.id))[0];
      if (winner === undefined) break;
      const servingInterface = winner.interfaces.find(
        (i) => winner.config.dhcpPools.some((p) => p.interfaceName === i.name) && isWired(world, winner.id, i.name),
      );
      const pool = winner.config.dhcpPools.find((p) => p.interfaceName === servingInterface?.name);
      if (pool === undefined) {
        log(world, 'warn', device.name, `DHCP: offer from ${winner.name} could not be honored`);
        break;
      }

      // Lowest free address wins; addresses already in use anywhere on the
      // network (static or leased) are off-limits.
      const taken = new Set<string>();
      for (const other of Object.values(world.devices)) {
        for (const otherIface of other.interfaces) {
          if (otherIface.ipv4 !== undefined) taken.add(otherIface.ipv4.address);
        }
      }
      const address = allocateAddress(pool, taken);
      if (address === undefined) {
        log(world, 'alert', device.name, `DHCP: pool on ${winner.name} is exhausted — no lease available`);
        break;
      }

      iface.ipv4 = { address, prefix: pool.prefix };
      iface.ipv4Source = 'dhcp';
      iface.leaseServerDeviceId = winner.id;
      // The server's own address on the serving interface is the natural gateway.
      if (servingInterface?.ipv4 !== undefined) {
        iface.ipv4Gateway = servingInterface.ipv4.address;
      } else {
        delete iface.ipv4Gateway;
      }
      const suspect = servers.length > 1 ? ` (of ${servers.length} offers)` : '';
      log(world, 'info', device.name, `DHCP lease from ${winner.name}: ${address}/${pool.prefix}${suspect}`);
      break;
    }

    case 'triggerIncident': {
      if (command.kind === 'rogue-dhcp') {
        const target = deviceById(world, command.targetDeviceId);
        if (target === undefined) break;
        // The intern's consumer router: it pays for itself, plugs into the
        // first free port it can find, and serves 192.168.1.0/24 out of the
        // box — the classic rogue DHCP (GDD §7.1).
        const device: Device = {
          id: nextId(world, 'router-soho'),
          kind: 'router-soho',
          name: 'mystery-router',
          defId: 'router-soho',
          x: target.x + 140,
          y: target.y + 60,
          interfaces: (DEFAULT_INTERFACES['router-soho'] ?? []).map((iface) => ({
            name: iface.name,
            kind: iface.kind,
            mac: randomMac(world),
            enabled: true,
          })),
          config: { firewallRules: [], routes: [], dhcpPools: [], dnsRecords: [] },
          uptimeTicks: 0,
          firmware: 'RouterOS-like 7.14',
          incident: true,
        };
        const lanPort = device.interfaces.find((i) => i.name === 'eth0');
        const targetPort = target.interfaces.find((i) => i.kind !== 'wan' && !isWired(world, target.id, i.name));
        if (lanPort === undefined || targetPort === undefined) {
          log(world, 'warn', 'incident', `rogue DHCP: no free port on ${target.name} to plug into`);
          break;
        }
        world.devices[device.id] = device;
        world.links.push({
          id: nextId(world, 'link'),
          a: { deviceId: device.id, interfaceName: lanPort.name },
          b: { deviceId: target.id, interfaceName: targetPort.name },
          media: 'copper',
        });
        device.config.dhcpPools.push({
          interfaceName: lanPort.name,
          network: '192.168.1.0',
          prefix: 24,
          rangeStart: '192.168.1.100',
          rangeEnd: '192.168.1.200',
          leaseMinutes: 120,
        });
        // Consumer boxes ship with themselves as LAN gateway, out of the box.
        lanPort.ipv4 = { address: '192.168.1.1', prefix: 24 };
        lanPort.ipv4Source = 'static';
        log(world, 'alert', 'incident', `rogue DHCP: an unmanaged consumer router just appeared next to ${target.name}`);
        // The incident surfaces to the player as a symptom, never the cause
        // (GDD §2). What the client sees: some device is down.
        openTicket(world, {
          client: 'Café Kopi Dua',
          title: 'The card machine is down again',
          symptom: 'Everything was fine until this morning. The terminal says "no network". Cash only for now — please hurry.',
          slaTicks: 200,
          rewardCash: 150,
          penaltyCash: 120,
        });
      }
      break;
    }

    case 'resolveTicket': {
      const ticket = world.tickets.find((t) => t.id === command.ticketId);
      if (ticket === undefined || ticket.status !== 'open') break;
      ticket.status = 'resolved';
      ticket.resolvedTick = world.tick;
      if (ticket.breached) {
        // Late but done: half pay, no reputation gain, no further penalty.
        const pay = Math.floor(ticket.rewardCash / 2);
        world.cash += pay;
        log(world, 'info', 'ticket', `${ticket.client}: "${ticket.title}" resolved late — +$${pay} (SLA was breached)`);
      } else {
        world.cash += ticket.rewardCash;
        world.reputation += 1;
        world.insight += 1;
        log(world, 'info', 'ticket', `${ticket.client}: "${ticket.title}" resolved in SLA — +$${ticket.rewardCash}, +1 rep, +1 insight`);
      }
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
    checkSlaBreaches(world);
    maybeSpawnTickets(world);
  }
  return world.log.slice(before);
}

// ---- Tickets (GDD §6.2) ----

interface TicketTemplate {
  client: string;
  title: string;
  symptom: string;
  slaTicks: number;
  rewardCash: number;
  penaltyCash: number;
}

/** Symptom, never cause. The player diagnoses; the ticket only complains. */
const TICKET_TEMPLATES: TicketTemplate[] = [
  {
    client: 'Café Kopi Dua',
    title: "Card machine can't reach the payment server",
    symptom: 'The card terminal at the register stopped working. Everything else seems fine? Please help quickly, lunch rush is coming.',
    slaTicks: 240,
    rewardCash: 120,
    penaltyCash: 80,
  },
  {
    client: 'Klinik Sehat',
    title: 'Wi-Fi drops for a minute every hour or so',
    symptom: 'Front desk tablets lose connection periodically. It comes back on its own, but reception says it is getting worse.',
    slaTicks: 320,
    rewardCash: 150,
    penaltyCash: 100,
  },
  {
    client: 'Toko Maju Jaya',
    title: 'The printer in the back office prints garbage',
    symptom: 'Since someone moved desks, the invoice printer spits out one blank page per job. The other printer works.',
    slaTicks: 400,
    rewardCash: 60,
    penaltyCash: 40,
  },
  {
    client: 'Klinik Sehat',
    title: 'New wing cannot open patient records',
    symptom: 'Computers in the new wing say the file server cannot be found. The old wing is fine.',
    slaTicks: 200,
    rewardCash: 180,
    penaltyCash: 140,
  },
];

export function openTicket(world: World, template: TicketTemplate): Ticket {
  const ticket: Ticket = {
    id: nextId(world, 'ticket'),
    client: template.client,
    title: template.title,
    symptom: template.symptom,
    openedTick: world.tick,
    slaTicks: template.slaTicks,
    status: 'open',
    breached: false,
    rewardCash: template.rewardCash,
    penaltyCash: template.penaltyCash,
  };
  world.tickets.push(ticket);
  log(world, 'alert', 'ticket', `${template.client}: ${template.title} (SLA ${template.slaTicks} ticks, +$${template.rewardCash} / -$${template.penaltyCash})`);
  return ticket;
}

function checkSlaBreaches(world: World): void {
  for (const ticket of world.tickets) {
    if (ticket.status === 'open' && !ticket.breached && world.tick > ticket.openedTick + ticket.slaTicks) {
      ticket.breached = true;
      world.cash -= ticket.penaltyCash;
      world.reputation -= 1;
      log(world, 'alert', 'sla', `${ticket.client}: SLA breached on "${ticket.title}" — -$${ticket.penaltyCash}, reputation hit`);
    }
  }
}

function maybeSpawnTickets(world: World): void {
  // Slow ambient drip: at most one open ticket per client, up to 3 open.
  const openCount = world.tickets.filter((t) => t.status === 'open').length;
  if (openCount >= 3 || world.tick % 48 !== 0) return;
  const clientsWithOpen = new Set(world.tickets.filter((t) => t.status === 'open').map((t) => t.client));
  const options = TICKET_TEMPLATES.filter((template) => !clientsWithOpen.has(template.client));
  if (options.length === 0) return;
  const roll = nextRandom(world);
  const template = options[roll % options.length];
  if (template !== undefined) openTicket(world, template);
}
