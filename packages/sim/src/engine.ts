import type { Command, Contract, Device, DeviceDef, Endpoint, Event, ExperimentTemplate, Interface as NetInterface, LabRecord, Link, Mail, ModuleDef, PrestigeBreakdown, ReachClass, ResearchNodeDef, SeasonGoalId, Ticket, World } from './types.ts';
import { log, nextId, nextRandom, randomMac } from './state.ts';
import { findDhcpServers, findPath } from './net.ts';
import { isValidIpv4, isValidPrefix } from './ip.ts';
import { allocateAddress } from './protocols/dhcp.ts';

// Re-exports: the client talks to the engine through this module only.
export { createWorld } from './state.ts';
export * from './types.ts';
export { findPath } from './net.ts';

const DEFAULT_INTERFACES: Record<string, { name: string; kind: NetInterface['kind']; role?: 'uplink' }[]> = {
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
    { name: 'sfp0', kind: 'sfp', role: 'uplink' },
  ],
  'router-soho': [
    { name: 'wan1', kind: 'wan', role: 'uplink' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
    { name: 'wifi0', kind: 'wifi' },
  ],
  'router-edge': [
    { name: 'wan1', kind: 'wan', role: 'uplink' },
    { name: 'wan2', kind: 'wan', role: 'uplink' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
    { name: 'sfp0', kind: 'sfp', role: 'uplink' },
  ],
  'access-point': [{ name: 'wifi0', kind: 'wifi' }],
  firewall: [
    { name: 'wan1', kind: 'wan', role: 'uplink' },
    { name: 'eth0', kind: 'ethernet' },
    { name: 'eth1', kind: 'ethernet' },
  ],
  ups: [],
};

/**
 * The interface list a device is born with: the catalog def's own list when it
 * declares one (e.g. the managed-switch port-count variants), otherwise the
 * per-kind default above.
 */
function defaultInterfaces(def: DeviceDef): { name: string; kind: NetInterface['kind']; role?: 'uplink' }[] {
  return def.interfaces && def.interfaces.length > 0 ? def.interfaces : (DEFAULT_INTERFACES[def.kind] ?? []);
}

function isWired(world: World, deviceId: string, interfaceName: string): boolean {
  return world.links.some(
    (link) =>
      (link.a.deviceId === deviceId && link.a.interfaceName === interfaceName) ||
      (link.b.deviceId === deviceId && link.b.interfaceName === interfaceName),
  );
}

/**
 * Can these two interfaces be cabled together? Wi-Fi radios connect only to
 * other Wi-Fi radios; wired ports (ethernet/wan) connect to each other.
 * Returns the human-readable problem, or undefined when the pair is fine.
 */
export function interfaceMediaProblem(
  a: Pick<NetInterface, 'kind'> | undefined,
  b: Pick<NetInterface, 'kind'> | undefined,
): string | undefined {
  if (a === undefined || b === undefined) return 'interface missing';
  const aWifi = a.kind === 'wifi';
  const bWifi = b.kind === 'wifi';
  if (aWifi !== bWifi) {
    return `a ${a.kind} port cannot be cabled to a ${b.kind} port`;
  }
  return undefined;
}

/** Reach limits per optics class, in world units (GDD §11 dB budgets, abstracted). */
export const REACH_LIMITS: Record<ReachClass, number> = { short: 400, long: 1600, xgs: 6400 };
const REACH_RANK: Record<ReachClass, number> = { short: 0, long: 1, xgs: 2 };

/** The optics module installed in an endpoint's slot, if the port is an SFP with one. */
function endpointModule(world: World, endpoint: Endpoint, device: Device | undefined): ModuleDef | undefined {
  const iface = device?.interfaces.find((i) => i.name === endpoint.interfaceName);
  if (iface === undefined || iface.kind !== 'sfp' || device === undefined) return undefined;
  const moduleId = device.modules?.[endpoint.interfaceName];
  if (moduleId === undefined) return undefined;
  return world.modules[moduleId];
}

/**
 * Is a wired link actually compatible end to end? Copper ports auto-negotiate
 * (auto-MDIX era — no crossover friction), so plain ethernet↔ethernet/wan
 * always passes. SFP slots need optics installed on every SFP endpoint, the
 * two modules must share a medium, and the weaker module's reach class must
 * cover the run's length. Phase 1 is warning-only: callers log the problem but
 * still create the link; enforcement lands in Phase 2.
 */
export function linkCompatible(world: World, link: Link): { ok: boolean; reason?: string } {
  const a = world.devices[link.a.deviceId];
  const b = world.devices[link.b.deviceId];
  if (a === undefined || b === undefined) return { ok: true };
  const aIface = a.interfaces.find((i) => i.name === link.a.interfaceName);
  const bIface = b.interfaces.find((i) => i.name === link.b.interfaceName);
  const aSfp = aIface?.kind === 'sfp';
  const bSfp = bIface?.kind === 'sfp';
  if (!aSfp && !bSfp) return { ok: true };
  const aModule = endpointModule(world, link.a, a);
  const bModule = endpointModule(world, link.b, b);
  if (aSfp && aModule === undefined) return { ok: false, reason: `${a.name}:${link.a.interfaceName} has an empty SFP slot — install optics` };
  if (bSfp && bModule === undefined) return { ok: false, reason: `${b.name}:${link.b.interfaceName} has an empty SFP slot — install optics` };
  if (aModule!.medium !== bModule!.medium) return { ok: false, reason: `media mismatch — ${aModule!.name} ends in ${aModule!.medium} but ${bModule!.name} ends in ${bModule!.medium}` };
  const weaker = REACH_RANK[aModule!.reachClass] <= REACH_RANK[bModule!.reachClass] ? aModule! : bModule!;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  const limit = REACH_LIMITS[weaker.reachClass];
  if (distance > limit) {
    return { ok: false, reason: `${weaker.name} covers ${limit} units (${weaker.reachClass} class) but this run is ${Math.round(distance)} — longer reach needed` };
  }
  return { ok: true };
}

/** Log a warning for every wired link on this device whose optics no longer fit. */
function warnIncompatibleLinks(world: World, device: Device): void {
  for (const link of world.links) {
    if (link.a.deviceId !== device.id && link.b.deviceId !== device.id) continue;
    const compat = linkCompatible(world, link);
    if (!compat.ok) log(world, 'warn', 'board', `optics problem on ${link.a.interfaceName} ↔ ${link.b.interfaceName}: ${compat.reason}`);
  }
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
      // The server room only has so many slots; growing it is a purchase.
      if (Object.keys(world.devices).length >= rackSlots(world)) {
        log(world, 'warn', 'shop', `the rack is full (${rackSlots(world)}/${rackSlots(world)}) — upgrade the server room before placing more`);
        break;
      }
      const price = devicePrice(world, def);
      world.cash -= price;
      const device: Device = {
        id: nextId(world, def.kind),
        kind: def.kind,
        name: command.name ?? def.name,
        defId: def.id,
        x: command.x,
        y: command.y,
        interfaces: defaultInterfaces(def).map((iface) => ({
          name: iface.name,
          kind: iface.kind,
          ...(iface.role !== undefined ? { role: iface.role } : {}),
          mac: randomMac(world),
          enabled: true,
        })),
        config: { firewallRules: [], routes: [], dhcpPools: [], dnsRecords: [] },
        uptimeTicks: 0,
        firmware: def.firmware,
      };
      world.devices[device.id] = device;
      log(world, 'info', 'board', `placed ${device.name} (${def.name}, $${price})`);
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
      const aDevice = world.devices[command.a.deviceId];
      const bDevice = world.devices[command.b.deviceId];
      const aIface = aDevice?.interfaces.find((i) => i.name === command.a.interfaceName);
      const bIface = bDevice?.interfaces.find((i) => i.name === command.b.interfaceName);
      const mediaProblem = interfaceMediaProblem(aIface, bIface);
      if (mediaProblem !== undefined) {
        log(world, 'warn', 'board', `cannot wire: ${mediaProblem}`);
        break;
      }
      world.links.push({
        id: nextId(world, 'link'),
        a: command.a,
        b: command.b,
        media: command.media ?? 'copper',
      });
      log(world, 'info', 'board', `wired ${aDevice?.name}:${command.a.interfaceName} ↔ ${bDevice?.name}:${command.b.interfaceName}`);
      // Phase 1 is warning-only: optics problems never block wiring, they just
      // tell the player the run will not hold once enforcement lands (GDD §11).
      const compat = linkCompatible(world, world.links[world.links.length - 1]!);
      if (!compat.ok) log(world, 'warn', 'board', `optics warning: ${compat.reason}`);
      break;
    }

    case 'unwireLink': {
      const link = world.links.find((l) => l.id === command.linkId);
      if (link === undefined) break;
      world.links = world.links.filter((l) => l.id !== command.linkId);
      log(world, 'info', 'board', `removed link ${link.id}`);
      break;
    }

    case 'installModule': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const iface = device.interfaces.find((i) => i.name === command.interfaceName);
      if (iface === undefined || iface.kind !== 'sfp') {
        log(world, 'warn', 'shop', `${device.name}: no SFP slot named ${command.interfaceName}`);
        break;
      }
      const module = world.modules[command.moduleId];
      if (module === undefined) {
        log(world, 'warn', 'shop', `unknown module "${command.moduleId}"`);
        break;
      }
      if (device.modules?.[command.interfaceName] !== undefined) {
        log(world, 'warn', 'shop', `${device.name}:${command.interfaceName} already has a module — remove it first`);
        break;
      }
      if (world.cash < module.price) {
        log(world, 'warn', 'shop', `not enough cash for ${module.name} ($${module.price})`);
        break;
      }
      world.cash -= module.price;
      if (device.modules === undefined) device.modules = {};
      device.modules[command.interfaceName] = module.id;
      log(world, 'info', 'shop', `installed ${module.name} in ${device.name}:${command.interfaceName} ($${module.price})`);
      warnIncompatibleLinks(world, device);
      break;
    }

    case 'removeModule': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      if (device.modules?.[command.interfaceName] === undefined) {
        log(world, 'warn', 'shop', `${device.name}:${command.interfaceName} has no module installed`);
        break;
      }
      delete device.modules[command.interfaceName];
      log(world, 'info', 'shop', `removed the module from ${device.name}:${command.interfaceName} (no refund)`);
      warnIncompatibleLinks(world, device);
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
      if (!isValidIpv4(command.address)) {
        log(world, 'warn', device.name, `${iface.name}: invalid IP configuration — "${command.address}" is not a valid IPv4 address (rejected)`);
        break;
      }
      const prefix = command.prefix ?? iface.ipv4?.prefix ?? 24;
      if (!isValidPrefix(prefix)) {
        log(world, 'warn', device.name, `${iface.name}: invalid IP configuration — prefix /${prefix} is not in 0–32 (rejected)`);
        break;
      }
      if (command.gateway !== undefined && command.gateway !== '' && !isValidIpv4(command.gateway)) {
        log(world, 'warn', device.name, `${iface.name}: invalid IP configuration — gateway "${command.gateway}" is not a valid IPv4 address (rejected)`);
        break;
      }
      iface.ipv4 = { address: command.address, prefix };
      iface.ipv4Source = 'static';
      delete iface.leaseServerDeviceId;
      if (command.gateway !== undefined && command.gateway !== '') {
        iface.ipv4Gateway = command.gateway;
      }
      log(world, 'info', device.name, `${iface.name}: ${iface.ipv4.address}/${iface.ipv4.prefix}${iface.ipv4Gateway !== undefined ? ` gw ${iface.ipv4Gateway}` : ''}`);
      break;
    }

    case 'setInterfaceEnabled': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const iface = device.interfaces.find((i) => i.name === command.interfaceName);
      if (iface === undefined) {
        log(world, 'warn', device.name, `no interface ${command.interfaceName}`);
        break;
      }
      if (iface.enabled === command.enabled) break;
      iface.enabled = command.enabled;
      log(world, 'info', device.name, `${iface.name}: ${command.enabled ? 'UP' : 'DOWN'}`);
      break;
    }

    case 'updateFirmware': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      const version = command.version.trim();
      if (version === '') {
        log(world, 'warn', device.name, 'firmware update refused: empty version');
        break;
      }
      if (device.firmware === version) {
        log(world, 'warn', device.name, `already running ${version}`);
        break;
      }
      const previous = device.firmware;
      device.firmware = version;
      log(world, 'info', device.name, `firmware upgraded: ${previous} → ${version}`);
      // Patching is the remediation path for an exploited box: the CVE the
      // update fixes is the one the compromise used.
      if (device.compromised) {
        device.compromised = false;
        log(world, 'info', device.name, 'patch applied — compromise cleared, service stable again');
      }
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
      } else if (command.kind === 'outdated-firmware') {
        const target = deviceById(world, command.targetDeviceId);
        if (target === undefined) break;
        applyOutdatedFirmwareIncident(world, target, command.latestVersion);
      } else if (command.kind === 'wear-failure') {
        const target = deviceById(world, command.targetDeviceId);
        if (target === undefined) break;
        failDevice(world, target);
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
        if (contractFor(world, ticket.client) !== undefined) {
          deliverMail(world, {
            from: `${ticket.client} <office@${ticket.client.toLowerCase().replaceAll(/[^a-z]+/g, '')}.example>`,
            subject: `Re: Ticket: ${ticket.title}`,
            body: `It is fixed now, but it took too long. We expect faster response next time.\n\n— ${ticket.client}`,
            kind: 'client',
          });
        }
      } else {
        world.cash += ticket.rewardCash;
        world.reputation += 1;
        world.insight += 1;
        log(world, 'info', 'ticket', `${ticket.client}: "${ticket.title}" resolved in SLA — +$${ticket.rewardCash}, +1 rep, +1 insight`);
        if (contractFor(world, ticket.client) !== undefined) {
          deliverMail(world, {
            from: `${ticket.client} <office@${ticket.client.toLowerCase().replaceAll(/[^a-z]+/g, '')}.example>`,
            subject: `Re: Ticket: ${ticket.title}`,
            body: `Thank you, everything is back to normal. This is why we signed the maintenance agreement with you.\n\n— ${ticket.client}`,
            kind: 'client',
          });
        }
      }
      break;
    }

    case 'readMail': {
      const mail = world.mail.find((m) => m.id === command.mailId);
      if (mail !== undefined) mail.read = true;
      break;
    }

    case 'discardMail': {
      // Housekeeping only: letters are never destroyed, so an action the
      // player still needs stays reachable from the discard folder.
      const mail = world.mail.find((m) => m.id === command.mailId);
      if (mail === undefined) break;
      mail.discarded = command.restore !== true;
      if (mail.discarded) mail.read = true;
      log(world, 'debug', 'mail', `${mail.discarded ? 'discarded' : 'restored'} "${mail.subject}"`);
      break;
    }

    case 'mailAction': {
      const mail = world.mail.find((m) => m.id === command.mailId);
      if (mail === undefined || mail.actionTaken !== undefined) break;
      if (!mail.actions.some((action) => action.command === command.command)) break;
      mail.actionTaken = command.command;
      mail.read = true;
      const [verb] = command.command.split(':');
      switch (verb) {
        case 'phish-pay': {
          // The classic outcome: money gone, and the "vendor" is not coming.
          // Reputation bleeds worse every repeat — word of a shop that pays
          // fake invoices spreads through the client network.
          const repLoss = phishPayRepLoss(world.phishPayments);
          world.phishPayments += 1;
          world.cash -= 250;
          world.reputation -= repLoss;
          const spread = repLoss === 1 ? 'nobody has heard yet' : repLoss < 4 ? 'word is spreading' : 'everyone has heard by now';
          log(world, 'alert', 'mail', `payment sent to "${mail.from}" — the account is empty and support does not exist. -$250, -${repLoss} rep (${spread})`);
          // Every contract client hears about it: each payment is a trust
          // strike on all live contracts. Three strikes and they are gone.
          const live = world.contracts.filter((c) => c.active);
          for (const contract of live) {
            strikeContract(world, contract, 'you wired money to a fake vendor');
          }
          const stillTrusting = world.contracts.find((c) => c.active);
          if (stillTrusting !== undefined) {
            deliverMail(world, {
              from: clientAddress(stillTrusting.client),
              subject: 'About the invoice you paid',
              body:
                `Hello,\n\nWord travels fast in this town. We heard you wired money to a fake vendor — ` +
                `if one letter can empty your account, what does that say about the judgment behind the network we trust you to keep safe?\n\n` +
                `Consider this a warning. Another lapse and we will have to reconsider our arrangement.\n\n` +
                `— ${stillTrusting.client}, office manager`,
              kind: 'client',
              actions: [],
            });
          }
          break;
        }
        case 'reportPhish': {
          world.insight += 1;
          log(world, 'info', 'mail', `reported "${mail.subject}" as phishing — spam filter tuned (+1 insight)`);
          break;
        }
        case 'orderReplacement': {
          // "Instant replacement" from the vendor letter = the swap command,
          // pointed at the device the letter names. Same rules as a manual
          // replace: dead unit, same model, trade-in credit, config carried.
          const deviceId = command.command.slice('orderReplacement:'.length);
          const dead = world.devices[deviceId];
          if (dead === undefined || !dead.failed) break;
          applyCommand(world, { type: 'replaceDevice', deviceId });
          const fresh = Object.values(world.devices).find(
            (d) => d.name === dead.name && d.id !== deviceId,
          );
          if (fresh !== undefined) {
            mail.actionTaken = `replaced:${fresh.id}`;
          } else {
            // Nothing swapped (no cash, no catalog entry): the letter stays live.
            delete mail.actionTaken;
          }
          break;
        }
        case 'openReleaseNotes': {
          world.insight += 1;
          log(world, 'info', 'mail', `read the release notes carefully (+1 insight)`);
          break;
        }
        case 'ackContractTicket': {
          // The player confirms receipt. Honesty over generosity: no cash, no
          // rep — the payout still comes from resolving the ticket in SLA.
          const ticketId = command.command.slice('ackContractTicket:'.length);
          const ticket = world.tickets.find((t) => t.id === ticketId && t.status === 'open');
          if (ticket !== undefined) {
            log(world, 'info', 'mail', `acknowledged ${ticket.client}'s report — they are waiting, SLA keeps running`);
          }
          break;
        }
        case 'matchRival': {
          // The poached client's letter: matching the rival's number keeps
          // them — at a permanently cheaper fee. Cheaper than churn.
          const contractId = command.command.slice('matchRival:'.length);
          const contract = world.contracts.find((c) => c.id === contractId && c.active);
          if (contract === undefined) {
            delete mail.actionTaken;
            log(world, 'warn', 'contract', `the rival's offer went stale — that contract is no longer active`);
            break;
          }
          const matchFee = Math.round(contract.feePerDay * (1 - RIVAL_MATCH_DISCOUNT));
          const discount = contract.feePerDay - matchFee;
          contract.feePerDay = matchFee;
          log(world, 'info', 'contract', `${contract.client}: matched ${RIVAL_NAME}'s offer — fee drops $${discount}/day to keep them`);
          break;
        }
        case 'declineRival': {
          // Holding the line keeps the margin but costs trust: the client
          // knows you made them weigh the rival's offer. Same ledger as any
          // other lapse — three strikes and they are gone.
          const contractId = command.command.slice('declineRival:'.length);
          const contract = world.contracts.find((c) => c.id === contractId && c.active);
          if (contract === undefined) {
            delete mail.actionTaken;
            log(world, 'warn', 'contract', `the rival's offer went stale — that contract is no longer active`);
            break;
          }
          strikeContract(world, contract, `they weighed ${RIVAL_NAME}'s offer and stayed anyway`);
          break;
        }
        case 'replaced': {
          const deviceId = command.command.slice('replaced:'.length);
          const device = world.devices[deviceId];
          log(world, 'info', 'mail', `the vendor's field team swapped the box — ${device?.name ?? 'the unit'} is new hardware, wiring untouched`);
          break;
        }
        case 'signContractOffer': {
          // The proposal letter's one-click signing: the contract pins to the
          // client's first device of the kind they asked for. A failed sign
          // keeps the letter actionable so the player can sign later.
          const client = command.command.slice('signContractOffer:'.length);
          // Clients are the roster only; anything else (e.g. a spoofed
          // signContractOffer: injected some other way) is not a client.
          if (!CONTRACT_OFFERS.some((o) => o.client === client)) break;
          const offer = CONTRACT_OFFERS.find((o) => o.client === client);
          const device = offer === undefined ? undefined : Object.values(world.devices).find((d) => d.kind === offer.requiresKind);
          if (contractFor(world, client) !== undefined) {
            delete mail.actionTaken;
            log(world, 'warn', 'contract', `${client} already has an active contract`);
            break;
          }
          if (offer === undefined || device === undefined) {
            delete mail.actionTaken;
            log(world, 'warn', 'contract', `${client}: needs a ${offer?.requiresKind ?? 'matching'} device on the board before signing`);
            break;
          }
          createContract(world, client, device, offer.baseFeePerDay);
          break;
        }
        case 'renewContract': {
          // The renewal offer arrived at term end, so the old contract is
          // inactive already. Renewal signs a fresh term at today's rates.
          const expiredId = command.command.slice('renewContract:'.length);
          const expired = world.contracts.find((c) => c.id === expiredId && !c.active);
          if (expired === undefined) break;
          const device = world.devices[expired.deviceId];
          if (device === undefined) {
            log(world, 'warn', 'contract', `${expired.client}: cannot renew — their device is no longer on the board`);
            break;
          }
          if (contractFor(world, expired.client) !== undefined) {
            log(world, 'warn', 'contract', `${expired.client}: already has an active contract`);
            break;
          }
          const offer = CONTRACT_OFFERS.find((o) => o.client === expired.client);
          const fee = Math.round((offer?.baseFeePerDay ?? expired.feePerDay) * rewardMultiplier(world.reputation) * payFactor(world) * contractFeeMult(world.goal));
          const contract: Contract = {
            id: nextId(world, 'contract'),
            client: expired.client,
            deviceId: expired.deviceId,
            feePerDay: fee,
            startedTick: world.tick,
            endTick: world.tick + CONTRACT_TERM_TICKS,
            breaches: 0,
            active: true,
          };
          world.contracts.push(contract);
          log(world, 'info', 'contract', `${expired.client} renewed their maintenance contract for ${device.name} — $${fee}/day for another ${CONTRACT_TERM_TICKS / 24} days`);
          break;
        }
        default:
          log(world, 'debug', 'mail', `action "${command.command}" on "${mail.subject}" had no effect`);
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
      const buyPrice = devicePrice(world, def);
      world.cash -= buyPrice;
      log(world, 'info', 'shop', `bought ${def.name} for $${buyPrice}`);
      break;
    }

    case 'upgradeRack': {
      const next = RACK_TIERS[world.rackTier + 1];
      if (next === undefined) {
        log(world, 'warn', 'shop', 'the server room is already at its top tier');
        break;
      }
      if (world.cash < next.price) {
        log(world, 'warn', 'shop', `${next.name} costs $${next.price} — you have $${world.cash}`);
        break;
      }
      world.cash -= next.price;
      world.rackTier += 1;
      log(world, 'info', 'shop', `${next.name} installed — the board now holds ${next.slots} devices (-$${next.price})`);
      break;
    }

    case 'startResearch': {
      const node = world.researchNodes.find((n) => n.id === command.nodeId);
      if (node === undefined) {
        log(world, 'warn', 'research', `unknown research node "${command.nodeId}"`);
        break;
      }
      if (world.research.completed.includes(node.id)) {
        log(world, 'warn', 'research', `${node.name} is already researched`);
        break;
      }
      if (node.requires !== undefined && !world.research.completed.includes(node.requires)) {
        log(world, 'warn', 'research', `${node.name} needs its prerequisite researched first`);
        break;
      }
      if (world.research.active !== undefined) {
        log(world, 'warn', 'research', `the lab is busy with another project — one at a time`);
        break;
      }
      const cost = researchCost(node, world.research.labPriorsGranted, world.research.labPriorsUsed);
      if (world.insight < cost.insight) {
        log(world, 'warn', 'research', `${node.name} needs ${cost.insight} insight — you have ${world.insight}`);
        break;
      }
      if (world.cash < cost.cash) {
        log(world, 'warn', 'research', `${node.name} needs $${cost.cash} — you have $${world.cash}`);
        break;
      }
      world.insight -= cost.insight;
      world.cash -= cost.cash;
      world.research.active = { nodeId: node.id, remaining: node.ticks };
      world.research.labPriorsUsed.push(node.id);
      log(world, 'info', 'research', `research started: ${node.name} — ${node.ticks} ticks (-${cost.insight} insight, -$${cost.cash})`);
      break;
    }

    case 'runExperiment': {
      const template = world.experiments.find((t) => t.id === command.templateId);
      if (template === undefined) {
        log(world, 'warn', 'lab', `unknown experiment "${command.templateId}"`);
        break;
      }
      if (!Number.isFinite(command.predicted) || !Number.isFinite(command.tolerance) || command.tolerance <= 0) {
        log(world, 'warn', 'lab', `${template.name}: a hypothesis needs a predicted value and a positive tolerance (V2.2-3.5)`);
        break;
      }
      if (!Number.isInteger(command.repetitions) || command.repetitions < 1 || command.repetitions > 12) {
        log(world, 'warn', 'lab', `${template.name}: repetitions must be between 1 and 12`);
        break;
      }
      const prior = world.lab.records.filter((r) => r.templateId === template.id);
      const known = prior.find((r) => r.conclusive);
      if (known !== undefined) {
        // Duplicate hypothesis class (V2.2-3.5): pays 10% and auto-fills the
        // conclusion from the recorded result — farming identical setups
        // yields almost nothing.
        const reward = Math.max(1, Math.round(template.baseInsight * 0.1));
        world.insight += reward;
        const record: LabRecord = {
          id: nextId(world, 'lab'),
          templateId: template.id,
          classKey: template.id,
          predicted: known.predicted,
          tolerance: known.tolerance,
          repetitions: command.repetitions,
          measurement: known.measurement,
          validity: known.validity,
          conclusive: true,
          rewardInsight: reward,
          duplicate: true,
          tick: world.tick,
        };
        if (known.interpretation !== undefined) record.interpretation = known.interpretation;
        world.lab.records.push(record);
        log(world, 'info', 'lab', `${template.name}: repeat of a known experiment — auto-filled from the notebook (+${reward} insight)`);
        break;
      }
      const latest = prior.at(-1);
      if (latest !== undefined && !latest.conclusive) {
        // Inconclusive results may be rerun once, with more repetitions —
        // repetitions narrow the noise band (V2.2-3.5).
        if (world.lab.reranClasses.includes(template.id)) {
          log(world, 'warn', 'lab', `${template.name}: the inconclusive result was already rerun once — it stands`);
          break;
        }
        if (command.repetitions <= latest.repetitions) {
          log(world, 'warn', 'lab', `${template.name}: a rerun needs more repetitions than the inconclusive attempt (${latest.repetitions})`);
          break;
        }
        world.lab.reranClasses.push(template.id);
      }
      const validity: LabRecord['validity'] = benchValid(world, template) ? 'full' : 'reduced';
      const band = labNoiseBand(template, command.repetitions);
      const spread = (nextRandom(world) % 2000) / 1000 - 1;
      const measurement = Math.round((template.trueValue + spread * band) * 100) / 100;
      const tol = Math.round(command.tolerance * 100) / 100;
      const conclusive = tol >= band;
      const record: LabRecord = {
        id: nextId(world, 'lab'),
        templateId: template.id,
        classKey: template.id,
        predicted: command.predicted,
        tolerance: tol,
        repetitions: command.repetitions,
        measurement,
        validity,
        conclusive,
        tick: world.tick,
      };
      world.lab.records.push(record);
      if (!conclusive) {
        log(world, 'warn', 'lab', `${template.name}: inconclusive — tolerance ±${tol}${template.unit} sits inside the noise band ±${Math.round(band * 100) / 100}${template.unit}; rerun once with more repetitions (reward will be halved)`);
      } else {
        log(world, 'info', 'lab', `${template.name}: measured ${measurement}${template.unit} (predicted ${command.predicted} ±${tol}) — read the result to conclude${validity === 'reduced' ? ' [reduced validity — the bench lacks the right equipment]' : ''}`);
      }
      break;
    }

    case 'interpretExperiment': {
      const record = world.lab.records.find((r) => r.id === command.recordId);
      if (record === undefined) {
        log(world, 'warn', 'lab', 'unknown notebook entry');
        break;
      }
      if (record.rewardInsight !== undefined) {
        log(world, 'warn', 'lab', 'that entry is already concluded');
        break;
      }
      const template = world.experiments.find((t) => t.id === record.templateId);
      if (template === undefined) break;
      // Correct interpretation = the conclusion matches what the measurement
      // actually said, whatever the prediction claimed (V2.2-3.5): a
      // wrong-but-specific hypothesis read correctly still pays full.
      const withinTolerance = Math.abs(record.measurement - record.predicted) <= record.tolerance;
      const correct = (command.conclusion === 'confirmed') === withinTolerance;
      record.interpretation = correct ? 'correct' : 'wrong';
      const validityFactor = record.validity === 'full' ? 1 : 0.5;
      const reward = correct ? Math.round(template.baseInsight * validityFactor) : 0;
      record.rewardInsight = reward;
      world.insight += reward;
      if (correct) {
        if (
          record.validity === 'full' &&
          template.grantsPrior !== undefined &&
          !world.research.labPriorsGranted.includes(template.grantsPrior)
        ) {
          world.research.labPriorsGranted.push(template.grantsPrior);
          log(world, 'info', 'research', `lab prior earned: -20% insight on the adjacent research node (from "${template.name}")`);
        }
        log(world, 'info', 'lab', `${template.name}: conclusion matches the reading — +${reward} insight${record.validity === 'reduced' ? ' (reduced validity ×0.5)' : ''}`);
      } else {
        log(world, 'warn', 'lab', `${template.name}: the conclusion does not match the measurement — a misread pays nothing`);
      }
      break;
    }

    case 'repairDevice': {
      const device = deviceById(world, command.deviceId);
      if (device === undefined) break;
      if (!device.failed) {
        log(world, 'warn', 'shop', `${device.name} does not need repair`);
        break;
      }
      const bill = repairCost(world);
      if (world.cash < bill) {
        log(world, 'warn', 'shop', `repairing ${device.name} costs $${bill} — you have $${world.cash}`);
        break;
      }
      world.cash -= bill;
      device.failed = false;
      device.uptimeTicks = 0; // fresh parts, the wear clock starts over
      log(world, 'info', 'shop', `repaired ${device.name} — back online (-$${bill})`);
      break;
    }

    case 'replaceDevice': {
      const old = deviceById(world, command.deviceId);
      if (old === undefined) break;
      if (!old.failed) {
        log(world, 'warn', 'shop', `${old.name} still works — replacement is for dead hardware`);
        break;
      }
      const def = world.catalog[old.defId];
      if (def === undefined) break;
      const cost = Math.max(0, devicePrice(world, def) - TRADE_IN_CREDIT);
      if (world.cash < cost) {
        log(world, 'warn', 'shop', `replacing ${old.name} costs $${cost} (after the $${TRADE_IN_CREDIT} trade-in) — you have $${world.cash}`);
        break;
      }
      world.cash -= cost;
      // Same chassis slot, same name, same spot: the network topology never
      // notices. Addresses, leases, and device config carry over from the old
      // unit; MACs are new because the hardware is.
      const fresh: Device = {
        id: nextId(world, def.kind),
        kind: def.kind,
        name: old.name,
        defId: def.id,
        x: old.x,
        y: old.y,
        interfaces: defaultInterfaces(def).map((iface) => {
          const previous = old.interfaces.find((i) => i.name === iface.name);
          return {
            name: iface.name,
            kind: iface.kind,
            ...(iface.role !== undefined ? { role: iface.role } : {}),
            mac: randomMac(world),
            enabled: true,
            ...(previous?.ipv4 !== undefined ? { ipv4: { ...previous.ipv4 } } : {}),
            ...(previous?.ipv4Gateway !== undefined ? { ipv4Gateway: previous.ipv4Gateway } : {}),
            ...(previous?.ipv4Source !== undefined ? { ipv4Source: previous.ipv4Source } : {}),
            ...(previous?.leaseServerDeviceId !== undefined ? { leaseServerDeviceId: previous.leaseServerDeviceId } : {}),
          };
        }),
        config: structuredClone(old.config),
        uptimeTicks: 0,
        // Optics are part of the hardware being swapped: whatever sat in the
        // dead unit's slots ships in the new one.
        ...(old.modules !== undefined && Object.keys(old.modules).length > 0 ? { modules: { ...old.modules } } : {}),
        // New stock ships on the current channel firmware when one is known.
        firmware: world.firmwareChannels[def.id] ?? def.firmware,
      };
      delete world.devices[old.id];
      world.devices[fresh.id] = fresh;
      for (const link of world.links) {
        if (link.a.deviceId === old.id) link.a.deviceId = fresh.id;
        if (link.b.deviceId === old.id) link.b.deviceId = fresh.id;
      }
      // The client pays for a working box on their line, whatever sits in it.
      for (const contract of world.contracts) {
        if (contract.deviceId === old.id) contract.deviceId = fresh.id;
      }
      log(world, 'info', 'shop', `replaced ${old.name} with new hardware — wiring and config carried over (-$${cost}, $${TRADE_IN_CREDIT} trade-in for the dead unit)`);
      break;
    }

    case 'goodwill': {
      // Buying back trust costs real money — roughly what a mid-tier ticket
      // would have paid. Diminishing from good standing (GDD §5).
      if (command.action === 'sponsor-lan') {
        const cost = 120;
        if (world.cash < cost) {
          log(world, 'warn', 'shop', `LAN party sponsorship needs $${cost} — you have $${world.cash}`);
          break;
        }
        world.cash -= cost;
        const gain = world.reputation >= 5 ? 0 : 1;
        if (gain > 0) {
          world.reputation += gain;
          log(world, 'info', 'shop', `sponsored the neighborhood LAN party — the local crowd is talking you up (+${gain} rep, -$${cost})`);
        } else {
          log(world, 'info', 'shop', `sponsored the neighborhood LAN party — a fun night, but you are already the talk of the town (-$${cost})`);
        }
      } else if (command.action === 'free-repairs') {
        const cost = 80;
        if (world.cash < cost) {
          log(world, 'warn', 'shop', `a free-repairs weekend needs $${cost} — you have $${world.cash}`);
          break;
        }
        world.cash -= cost;
        const gain = world.reputation >= 5 ? 0 : 1;
        if (gain > 0) {
          world.reputation += gain;
          log(world, 'info', 'shop', `ran a free-repairs weekend for regulars (+${gain} rep, -$${cost})`);
        } else {
          log(world, 'info', 'shop', `ran a free-repairs weekend — generous, but your standing was already spotless (-$${cost})`);
        }
      } else {
        // The win-back campaign: the paid counter to the rival's poaching.
        // The pitch only lands if their box is healthy again — you are
        // selling the service they left over, so it has to be real this
        // time. A client the rival itself holds is a harder sell: the visit
        // costs more, and the rival meets the offer with a deeper discount.
        const client = command.client ?? '';
        const dead = world.contracts.find((c) => !c.active && c.client === client);
        const held = dead === undefined && rivalHolds(world, client);
        if (dead === undefined && !held) {
          log(world, 'warn', 'shop', `no lost client named "${client}" to win back`);
          break;
        }
        if (contractFor(world, client) !== undefined) {
          log(world, 'warn', 'contract', `${client} is already under contract`);
          break;
        }
        const cost = held ? RIVAL_HELD_COST : 150;
        if (world.cash < cost) {
          log(world, 'warn', 'shop', `a win-back campaign for ${client} needs $${cost} — you have $${world.cash}`);
          break;
        }
        let device: Device | undefined;
        let baseFee: number;
        if (dead !== undefined) {
          device = world.devices[dead.deviceId];
          baseFee = CONTRACT_OFFERS.find((o) => o.client === client)?.baseFeePerDay ?? dead.feePerDay;
        } else {
          // A poached proposal never signed, so the pin works like the offer
          // flow: the client's first device of the kind they asked for.
          const offer = CONTRACT_OFFERS.find((o) => o.client === client);
          device = offer === undefined ? undefined : Object.values(world.devices).find((d) => d.kind === offer.requiresKind);
          baseFee = offer?.baseFeePerDay ?? 0;
          if (device === undefined) {
            log(world, 'warn', 'shop', `${client}: needs a ${offer?.requiresKind ?? 'matching'} device on the board before they will listen`);
            break;
          }
        }
        if (device === undefined) {
          log(world, 'warn', 'shop', `${client}: their device is no longer on the board — nothing to campaign around`);
          break;
        }
        world.cash -= cost;
        if (device.failed || device.compromised) {
          log(world, 'alert', 'shop', `win-back campaign with ${client} fell flat — their ${device.name} is still broken (-$${cost})`);
          if (held) log(world, 'info', 'contract', `${RIVAL_NAME} matched your visit — their rep was at ${client}'s office the next morning`);
          deliverMail(world, {
            from: clientAddress(client),
            subject: 'We appreciate the offer',
            body:
              `Hello,\n\nThat was a kind visit, and the gesture did not go unnoticed. But the ${device.name} is still ` +
              `giving us trouble, and ${RIVAL_NAME}'s people answer within the hour. We will stay where we are for now.\n\n` +
              `— ${client}, office manager`,
            kind: 'client',
            actions: [],
          });
          break;
        }
        createContract(world, client, device, baseFee, held ? RIVAL_HELD_EXTRA : 0);
        log(world, 'info', 'shop', `win-back campaign worked — ${client} is back on the books (-$${cost})`);
        deliverMail(world, {
          from: clientAddress(client),
          subject: held ? `Leaving ${RIVAL_NAME} for your shop` : 'Giving your shop another chance',
          body:
            (held
              ? `Hello,\n\nYour team came by, and it meant more than you know. ${RIVAL_NAME}'s reps have been by twice since, ` +
                `but a call you answer is worth more than a discount you have to chase.\n\n`
              : `Hello,\n\nYour team came by, and we appreciated it more than you know. `) +
            `The ${device.name} has been steady since you fixed it, and that is what we are paying for.\n\n` +
            `We have signed again — take care of us like before.\n\n— ${client}, office manager`,
          kind: 'client',
          actions: [],
        });
      }
      break;
    }

    case 'setDifficulty': {
      if (command.difficulty === world.difficulty) break;
      world.difficulty = command.difficulty;
      if (command.difficulty === 'hard') {
        log(world, 'warn', 'clock', `Hard mode engaged — the clock runs faster, payouts shrink ${Math.round((1 - HARD_PAY_FACTOR) * 100)}%, and worn hardware fails sooner`);
      } else {
        log(world, 'info', 'clock', 'Back to standard mode — the clock settles and payouts recover');
      }
      break;
    }

    case 'signContract': {
      const offer = CONTRACT_OFFERS.find((o) => o.client === command.client);
      if (offer === undefined) {
        log(world, 'warn', 'contract', `no such client: "${command.client}"`);
        break;
      }
      if (rivalHolds(world, command.client)) {
        log(world, 'warn', 'contract', `${command.client} signed with ${RIVAL_NAME} — winning them back takes a campaign, not a signature`);
        break;
      }
      if (contractFor(world, command.client) !== undefined) {
        log(world, 'warn', 'contract', `${command.client} already has an active contract`);
        break;
      }
      const device = deviceById(world, command.deviceId);
      if (device === undefined || device.kind !== offer.requiresKind) {
        log(world, 'warn', 'contract', `${command.client} needs a ${offer.requiresKind} on the board to sign`);
        break;
      }
      createContract(world, command.client, device, offer.baseFeePerDay);
      break;
    }

    case 'cancelContract': {
      const contract = world.contracts.find((c) => c.id === command.contractId && c.active);
      if (contract === undefined) break;
      contract.active = false;
      log(world, 'info', 'contract', `${contract.client}: contract cancelled`);
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
    maybeSpawnContractTickets(world);
    maybeSpawnFirmwareIncidents(world);
    maybeWearFailures(world);
    advanceResearch(world);
    payContractFees(world);
    maybeDeliverMail(world);
    maybeDeliverProposals(world);
    maybeRivalPoachProposals(world);
    maybeCloseSeason(world);
  }
  return world.log.slice(before);
}

// ---- Research (GDD §18) ----

/** True when the node is unlocked — capabilities check this to change behavior. */
export function hasResearch(world: World, nodeId: string): boolean {
  return world.research.completed.includes(nodeId);
}

/**
 * What a node costs right now (V2.2-3.5): a lab prior earned by a completed,
 * correctly-read experiment discounts Insight 20%, once per node. The UI
 * renders this; the sim charges it.
 */
export function researchCost(node: ResearchNodeDef, labPriorsGranted: string[], labPriorsUsed: string[]): { insight: number; cash: number } {
  const discounted = node.labPrior === true && labPriorsGranted.includes(node.id) && !labPriorsUsed.includes(node.id);
  return { insight: discounted ? Math.round(node.insight * 0.8) : node.insight, cash: node.cash };
}

/** One project at a time; finishing a project unlocks its capability. */
function advanceResearch(world: World): void {
  const active = world.research.active;
  if (active === undefined) return;
  active.remaining -= 1;
  if (active.remaining > 0) return;
  const node = world.researchNodes.find((n) => n.id === active.nodeId);
  delete world.research.active;
  world.research.completed.push(active.nodeId);
  if (node !== undefined) {
    log(world, 'info', 'research', `${node.name} researched — ${node.capability}`);
  }
}

// ---- Lab experiments (V2.2-3.5) ----

/** Measurement noise half-band at n repetitions: repetitions narrow it. */
export function labNoiseBand(template: ExperimentTemplate, repetitions: number): number {
  return template.noiseBand / Math.sqrt(Math.max(1, repetitions));
}

/** Does the bench's equipment class cover the tested parameter? */
function benchValid(world: World, template: ExperimentTemplate): boolean {
  if (template.requiresKind === undefined) return true;
  return Object.values(world.devices).some((d) => d.kind === template.requiresKind && !d.failed);
}

// ---- Mail (GDD §8) ----

export interface MailTemplateInput {
  from: string;
  subject: string;
  body: string;
  kind: Mail['kind'];
  actions?: { label: string; command: string }[];
}

/** Deliver a letter. Content lives in the data package; the sim owns timing. */
export function deliverMail(world: World, template: MailTemplateInput): Mail {
  const mail: Mail = {
    id: nextId(world, 'mail'),
    from: template.from,
    subject: template.subject,
    body: template.body,
    kind: template.kind,
    receivedTick: world.tick,
    read: false,
    actions: template.actions ?? [],
  };
  // The tuned spam filter catches phishing on arrival: flagged from insight 3
  // (2 with the IDS effectiveness node, which trains the filter on
  // signatures), and from insight 5 it also reports the letter itself (its
  // actions never pay out). Ticket and client letters are always delivered
  // untouched.
  if (mail.kind === 'phish') {
    mail.quarantined = world.insight >= (hasResearch(world, 'sec-ids') ? 2 : 3);
    if (world.insight >= 5) {
      mail.quarantined = true;
      mail.read = true;
      mail.actionTaken = 'reportPhish';
    }
  }
  world.mail.push(mail);
  log(world, 'info', 'mail', `new mail from ${template.from}: "${template.subject}"`);
  return mail;
}

// Ambient letters the engine generates over time. Phishes are gameplay-core,
// so they live here; flavor templates live in the data package.
/** The real Hardware Care letter's evil twin, exported so the client's
 * `?twinmail=1` capture param can deliver it deterministically. */
export const TWIN_REPLACEMENT_PHISH: MailTemplateInput = {
  from: 'Novabit Hardware Care <field@novabit-billing.example>',
  subject: 'Instant replacement available for your equipment',
  body:
    'Our telemetry shows one of your devices has failed. Act fast — replacement stock is limited.\n\n' +
    'Your new unit is reserved and ready to ship the moment the courier fee clears. One click and our field team handles everything.\n\n' +
    'Pay the $95 courier fee within 12 HOURS or your reservation is CANCELLED.\n\n' +
    '— Novabit Hardware Care, Automated Dispatch Desk',
  kind: 'phish',
  actions: [
    { label: 'Pay $95 courier fee', command: 'phish-pay' },
    { label: 'Report as phish', command: 'reportPhish' },
  ],
};

const AMBIENT_MAIL: MailTemplateInput[] = [
  {
    from: 'Novabit Updates',
    subject: 'RouterOS-like 7.16 maintenance release',
    body: 'Routine update. Fixes a UI glitch in the firewall table and shaves boot time. No known issues reported so far.',
    kind: 'vendor',
  },
  {
    from: 'CloudScale Deals <noreply@cloudscale-deals.example>',
    subject: 'MEGA SALE: enterprise switches up to 60% off!!',
    body: 'This week only! Prices so low you will not believe it! Click here! Unsubscribe?',
    kind: 'spam',
  },
  {
    from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
    subject: 'URGENT: unpaid invoice — service suspends in 24h',
    body:
      'Dear customer,\n\nYour payment has FAILED. Click below or your network services will be SUSPENDED in 24 HOURS.\n\n' +
      'Pay now: http://vand0r-updates.example/pay\n\nVandor Billing Dept.',
    kind: 'phish',
    actions: [
      { label: 'Pay now', command: 'phish-pay' },
      { label: 'Report as phish', command: 'reportPhish' },
    ],
  },
  {
    from: 'ByteMill Account Team',
    subject: 'Your trade-in credit is waiting',
    body: 'Trade in any old switch, get $25 off your next ByteMill purchase. Some of what we resell still works, mostly.',
    kind: 'vendor',
  },
  {
    // The real proposal's evil twin: same subject, same shape, one-click
    // "signing". The tells are the sender address and the upfront fee —
    // a client who wants maintenance does not ask for $180 first.
    from: 'PT Garda Jaya Networking <hrd@ptgardajaya-net.example>',
    subject: 'Maintenance contract proposal',
    body:
      'Dear IT Partner,\n\nOur company seeks a trusted network maintenance provider for our office (we run a desktop and a server). ' +
      'We offer $40/day — the best rate in town!\n\nPer company policy, please process the $180 registration deposit via the button below ' +
      'and our contracts department will activate your account within 24 hours.\n\n' +
      'Best regards,\nPT Garda Jaya Networking — Human Resources & Contracts Division',
    kind: 'phish',
    actions: [
      { label: 'Send $180 deposit', command: 'phish-pay' },
      { label: 'Report as phish', command: 'reportPhish' },
    ],
  },
  TWIN_REPLACEMENT_PHISH,
];

function maybeDeliverMail(world: World): void {
  if (world.tick % 96 !== 0) return;
  const roll = nextRandom(world);
  const template = AMBIENT_MAIL[roll % AMBIENT_MAIL.length];
  if (template !== undefined) deliverMail(world, template);
}

/**
 * Contract proposals: one client writes per day, midday, offering a
 * maintenance contract. Only clients who have never signed with the shop get
 * a proposal — a churned or expired client does not come back this way. A
 * proposal is eligible once the player has a device of the client's required
 * kind on the board, so letters speak to something concrete.
 */
function maybeDeliverProposals(world: World): void {
  if (world.tick % 24 !== 12) return;
  const proposed = (client: string): boolean =>
    world.mail.some((m) => m.actions.some((a) => a.command === `signContractOffer:${client}`));
  const offer = CONTRACT_OFFERS.find((o) => {
    if (world.contracts.some((c) => c.client === o.client)) return false;
    if (proposed(o.client)) return false;
    return Object.values(world.devices).some((d) => d.kind === o.requiresKind);
  });
  if (offer === undefined) return;
  // A rival on the shop's radar makes itself known in every proposal: the
  // client says so plainly, and the signature that follows locks in less.
  const rivalLine = rivalUndercuts(world)
    ? `Fair warning: a rep from ${RIVAL_NAME} came by this week quoting the same service for ${Math.round(RIVAL_MATCH_DISCOUNT * 100)}% less. We are signing with whoever gets closest to their number.\n\n`
    : '';
  deliverMail(world, {
    from: clientAddress(offer.client),
    subject: 'Maintenance contract proposal',
    body:
      `Hello,\n\nWe heard your shop keeps networks alive. We run a ${offer.requiresKind} at our site and would pay ` +
      `$${offer.baseFeePerDay}/day for a maintenance contract — you keep it healthy, we keep paying, every day.\n\n` +
      rivalLine +
      `If the arrangement suits you, accept below and we sign for a ${CONTRACT_TERM_TICKS / 24}-day term.\n\n` +
      `— ${offer.client}, office manager`,
    kind: 'client',
    actions: [{ label: 'Sign contract', command: `signContractOffer:${offer.client}` }],
  });
}

/**
 * The rival's boldest move: while the shop is on SkyLink's radar, a proposal
 * left unsigned for a full day is poached — the client signs with the rival
 * before the player can. The proposal letter collapses to its outcome and a
 * goodbye letter lands; the dead letter's action still matches `proposed()`,
 * so the client never writes again.
 */
function maybeRivalPoachProposals(world: World): void {
  if (world.tick % 24 !== 12) return;
  if (!rivalUndercuts(world)) return;
  for (const mail of world.mail) {
    if (mail.actionTaken !== undefined) continue;
    const action = mail.actions.find((a) => a.command.startsWith('signContractOffer:'));
    if (action === undefined) continue;
    if (world.tick - mail.receivedTick < 24) continue;
    const client = action.command.slice('signContractOffer:'.length);
    mail.actionTaken = 'poachedByRival';
    log(world, 'alert', 'contract', `${RIVAL_NAME} got to ${client} first — they signed with the rival before you could`);
    deliverMail(world, {
      from: clientAddress(client),
      subject: `We went with ${RIVAL_NAME}`,
      body:
        `Hello,\n\nWe did not hear back about the maintenance contract, and ${RIVAL_NAME}'s rep kept calling — ` +
        `their number was hard to argue with. We have signed with them.\n\n` +
        `If things change, we know where your shop is.\n\n` +
        `— ${client}, office manager`,
      kind: 'client',
      actions: [],
    });
  }
}

/**
 * Whether the rival currently holds a client: their proposal was poached and
 * no contract with the shop has replaced it. The poached letter is the
 * record — no extra world state. Held clients are harder to win back: the
 * rival pays for the visit too.
 */
export function rivalHolds(world: World, client: string): boolean {
  return world.mail.some(
    (m) => m.actionTaken === 'poachedByRival' && m.actions.some((a) => a.command === `signContractOffer:${client}`),
  );
}

/** A win-back visit to a client the rival holds costs this much, not the standard rate. */
export const RIVAL_HELD_COST = 250;
/** The rival undercuts the win-back itself: held clients return this much deeper in the hole. */
export const RIVAL_HELD_EXTRA = 0.1;

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

/**
 * Reputation tiers (GDD §5): trusted partners get premium rates, penalized
 * contractors get discounted ones. Applied when a ticket opens; penalties
 * stay unscaled — standing costs you work, not extra fines.
 */
export function rewardMultiplier(reputation: number): number {
  if (reputation >= 5) return 1.25;
  if (reputation <= -5) return 0.7;
  return 1;
}

/**
 * How strongly experience flags a phishing letter, from the player's insight
 * total. Green players see nothing; a few reports tune the eye ('uneasy');
 * veterans recognize the pattern on sight ('trained'). At 'trained' the spam
 * filter also quarantines arriving phishes; at 'expert' (insight 5+) it
 * reports them automatically. The UI renders the hints — the sim owns rules.
 */
export function phishAlertLevel(insight: number): 'none' | 'uneasy' | 'trained' {
  if (insight >= 3) return 'trained';
  if (insight >= 1) return 'uneasy';
  return 'none';
}

/**
 * Reputation cost of paying a phishing invoice: the first slip costs -1, but
 * word spreads — every repeat costs one more, capped at -4. The client uses
 * the same rule to render the outcome line after the payment.
 */
export function phishPayRepLoss(priorPayments: number): number {
  return Math.min(1 + priorPayments, 4);
}

// ---- Contracts (GDD §6): recurring revenue pinned to a client device ----

/**
 * Who signs maintenance contracts and what their site needs. The fee scales
 * with the reputation multiplier at signing time. A client signs with the
 * shop only while a device of the required kind is on their board.
 */
export const CONTRACT_OFFERS: { client: string; requiresKind: Device['kind']; baseFeePerDay: number }[] = [
  { client: 'Café Kopi Dua', requiresKind: 'desktop', baseFeePerDay: 15 },
  { client: 'Klinik Sehat', requiresKind: 'desktop', baseFeePerDay: 25 },
  { client: 'Toko Maju Jaya', requiresKind: 'printer', baseFeePerDay: 10 },
  { client: 'Novabit (partner network)', requiresKind: 'server', baseFeePerDay: 40 },
];

/**
 * Server-room rack tiers (GDD §5.4): how many devices the shop's board can
 * hold. Tier 0 is what a garage starts with; each upgrade is bought once and
 * lasts. Gameplay-core numbers, so they live here like the contract offers.
 */
export const RACK_TIERS: { name: string; slots: number; price: number }[] = [
  { name: 'Starter rack', slots: 8, price: 0 },
  { name: 'Rack expansion', slots: 14, price: 250 },
  { name: 'Server room', slots: 22, price: 550 },
];

/** Device capacity at the world's current rack tier. */
export function rackSlots(world: World): number {
  return RACK_TIERS[world.rackTier]?.slots ?? RACK_TIERS[0]!.slots;
}

function contractFor(world: World, client: string): Contract | undefined {
  return world.contracts.find((c) => c.client === client && c.active);
}

/** Shared signing tail: fee locked at today's reputation rate, fresh term, no strikes. */
function createContract(world: World, client: string, device: Device, baseFeePerDay: number, extraDiscount = 0): Contract {
  // A rival on the shop's radar bids every new signature down: the price they
  // wave in poach letters applies to fresh terms too — and deeper for
  // clients the rival itself holds (win-backs meet its counter-offer).
  const undercut = rivalUndercuts(world);
  const fee = Math.round(baseFeePerDay * rewardMultiplier(world.reputation) * payFactor(world) * contractFeeMult(world.goal) * (undercut ? 1 - RIVAL_MATCH_DISCOUNT - extraDiscount : 1));
  const contract: Contract = {
    id: nextId(world, 'contract'),
    client,
    deviceId: device.id,
    feePerDay: fee,
    startedTick: world.tick,
    endTick: world.tick + CONTRACT_TERM_TICKS,
    breaches: 0,
    active: true,
  };
  world.contracts.push(contract);
  log(world, 'info', 'contract', `${client} signed a maintenance contract for ${device.name} — $${fee}/day${undercut ? ` (undercut by ${RIVAL_NAME}, bidding ${Math.round((RIVAL_MATCH_DISCOUNT + extraDiscount) * 100)}% less)` : ''}`);
  return contract;
}

/**
 * A contract term lasts ten in-game days. At expiry the client renews only
 * with a spotless record; every strike is a reason to walk.
 */
export const CONTRACT_TERM_TICKS = 240;

/** Client email address, shaped like the other office@ senders. */
function clientAddress(client: string): string {
  return `${client} <office@${client.toLowerCase().replaceAll(/[^a-z]+/g, '')}.example>`;
}

/**
 * The mail-from-a-machine voice of the equipment vendor. Two registers: human
 * when the shop is doing well, call-center when it is in trouble. Gameplay-core
 * copy, so it lives in the engine like the client letters.
 */
function vendorVoice(reputation: number): string {
  if (reputation >= 3) {
    return `We know the gear by heart on this side of the counter, and honestly — we would rather you bought from us because you trust us, not because a form letter made you. But the process below is real: our field stock replaces dead units faster than any repair bench can.`;
  }
  if (reputation <= -3) {
    return `Our records (and, frankly, the neighborhood) suggest your hardware spends a lot of time offline. The replacement program below exists for exactly that.`;
  }
  return `Repairs keep old hardware limping along. A brand-new unit, same model, plugs into the same holes — and the dead one is worth $${TRADE_IN_CREDIT} to us for parts.`;
}

/** One trust strike against a live contract. Three before term end and the client leaves early. */
function strikeContract(world: World, contract: Contract, why: string): void {
  contract.breaches += 1;
  log(world, 'warn', 'contract', `${contract.client}: trust strike ${contract.breaches}/3 — ${why}`);
  if (contract.breaches >= 3) {
    contract.active = false;
    world.reputation -= 2;
    deliverMail(world, {
      from: clientAddress(contract.client),
      subject: 'We are ending our contract',
      body:
        `Hello,\n\nWe have given this more than enough chances. ` +
        `The agreement is ended as of today and our equipment will be serviced elsewhere.\n\n` +
        `We will not recommend your shop.\n\n— ${contract.client}, office manager`,
      kind: 'client',
      actions: [],
    });
    log(world, 'alert', 'contract', `${contract.client}: churned after repeated failures — contract ended, -2 reputation`);
    rivalTaunt(world, contract.client);
  }
}

/** Daily roll: pay healthy contracts, withhold for exploited boxes, renew or churn at term end. */
function payContractFees(world: World): void {
  if (world.tick % 24 !== 0) return;
  let total = 0;
  for (const contract of world.contracts) {
    if (!contract.active) continue;
    const device = world.devices[contract.deviceId];
    if (device === undefined) {
      contract.active = false;
      log(world, 'warn', 'contract', `${contract.client}: contract ended — their device left the board`);
      continue;
    }
    if (device.compromised) {
      // A compromised box breaches the trust the contract sells: the client
      // withholds today's fee and remembers. Fixing the box restores income.
      log(world, 'warn', 'contract', `${contract.client}: withholding $${contract.feePerDay} — their ${device.name} is compromised`);
      strikeContract(world, contract, 'their device is compromised');
      continue;
    }
    if (device.failed) {
      // A dead box is worse than a hacked one: same strike, blunter letter.
      log(world, 'warn', 'contract', `${contract.client}: withholding $${contract.feePerDay} — their ${device.name} failed and needs repair`);
      strikeContract(world, contract, 'their device failed');
      continue;
    }
    total += contract.feePerDay;
  }
  if (total > 0) {
    world.cash += total;
    log(world, 'info', 'contract', `daily contract fees collected: +$${total}`);
  }
  decideContractExpiries(world);
}

/**
 * Term-end decision, run once per day after fees. A spotless record earns a
 * renewal offer the player accepts by mail; any strike means the client walks
 * and tells others. Either way the old contract stops paying today.
 */
function decideContractExpiries(world: World): void {
  for (const contract of world.contracts) {
    if (!contract.active || world.tick < contract.endTick) continue;
    contract.active = false;
    const device = world.devices[contract.deviceId];
    const deviceName = device?.name ?? 'the old box';
    if (contract.breaches === 0) {
      deliverMail(world, {
        from: clientAddress(contract.client),
        subject: 'Renewing our contract?',
        body:
          `Hello,\n\nOur maintenance agreement expires today and honestly, it has been smooth. ` +
          `We would like to continue on the same arrangement for ${deviceName} — reply and we sign for another term.\n\n` +
          `— ${contract.client}, office manager`,
        kind: 'client',
        actions: [{ label: 'Renew contract', command: `renewContract:${contract.id}` }],
      });
      log(world, 'info', 'contract', `${contract.client}: term ended with a spotless record — renewal offer sent`);
    } else {
      world.reputation -= 2;
      deliverMail(world, {
        from: clientAddress(contract.client),
        subject: 'We are not renewing',
        body:
          `Hello,\n\nOur maintenance agreement expires today. Given the problems this term, ` +
          `we have decided to take our business elsewhere.\n\n` +
          `People talk, and we will be honest about why we left.\n\n— ${contract.client}, office manager`,
        kind: 'client',
        actions: [],
      });
      log(world, 'alert', 'contract', `${contract.client}: not renewing after ${contract.breaches} strike(s) — -2 reputation`);
      rivalTaunt(world, contract.client);
    }
  }
}

export function openTicket(world: World, template: TicketTemplate): Ticket {
  const repMult = rewardMultiplier(world.reputation);
  const reward = Math.round(template.rewardCash * repMult * payFactor(world) * ticketRewardMult(world.goal));
  const ticket: Ticket = {
    id: nextId(world, 'ticket'),
    client: template.client,
    title: template.title,
    symptom: template.symptom,
    openedTick: world.tick,
    slaTicks: template.slaTicks,
    status: 'open',
    breached: false,
    rewardCash: reward,
    penaltyCash: template.penaltyCash,
  };
  world.tickets.push(ticket);
  const rateNote = repMult > 1 ? ' (premium partner rates)' : repMult < 1 ? ' (penalized contractor rates)' : '';
  log(world, 'alert', 'ticket', `${template.client}: ${template.title} (SLA ${template.slaTicks} ticks, +$${reward} / -$${template.penaltyCash})${rateNote}`);
  // Contract clients follow up in writing: the letter restates the complaint
  // and carries an acknowledge action keyed to the ticket id.
  if (contractFor(world, template.client) !== undefined) {
    deliverMail(world, {
      from: clientAddress(template.client),
      subject: `Ticket: ${template.title}`,
      body:
        `Hello,\n\nWe are writing about: ${template.symptom}\n\n` +
        `Our support agreement says you will look at this quickly. ` +
        `Please keep us posted.\n\n— ${template.client}, office manager`,
      kind: 'client',
      actions: [{ label: 'Acknowledge receipt', command: `ackContractTicket:${ticket.id}` }],
    });
  }
  return ticket;
}

/**
 * The outdated-firmware exploit, shared by the explicit triggerIncident
 * command and the ambient roll. A patched box has nothing to exploit; an
 * exploited one is compromised and the client reports symptoms, not causes.
 */
function applyOutdatedFirmwareIncident(world: World, target: Device, latestVersion: string): void {
  if (target.firmware === latestVersion) {
    log(world, 'warn', 'incident', `${target.name} already runs ${latestVersion} — nothing to exploit`);
    return;
  }
  target.compromised = true;
  log(world, 'alert', 'incident', `${target.name} running outdated ${target.firmware} was just exploited — service misbehaving`);
  // The exploited box's own contract client reports it when one exists;
  // otherwise the symptom ticket lands under the partner-network client.
  const contract = world.contracts.find((c) => c.active && c.deviceId === target.id);
  openTicket(world, {
    client: contract?.client ?? 'Novabit (partner network)',
    title: 'Strange traffic from your side',
    symptom: 'Our monitoring sees odd requests originating from one of your devices, and some lookups come back wrong. Can you take a look?',
    slaTicks: 180,
    rewardCash: 180,
    penaltyCash: 140,
  });
}

/** Flat repair bill: parts and an afternoon, regardless of model. */
export const REPAIR_COST = 60;

/** Trade-in credit the vendor pays for the dead unit when replacing it. */
export const TRADE_IN_CREDIT = 25;

/**
 * Hard mode (GDD §3): every payout shrinks by this factor and worn hardware
 * fails this much faster. The client also runs its clock faster in hard mode —
 * the same tick rules simply land twice as often in real time.
 */
export const HARD_PAY_FACTOR = 0.8;
export const HARD_WEAR_FACTOR = 1.5;

/** Payout scale for the current game mode. */
function payFactor(world: World): number {
  return world.difficulty === 'hard' ? HARD_PAY_FACTOR : 1;
}

/** Days of uptime before wear rolls start biting (GDD §7.1). */
const WEAR_ONSET_TICKS = 7 * 24;

/**
 * Per-day failure chance for a worn device: grows with age, scaled by how
 * unreliable the model is (catalog `reliability`, default 0.7). Pure and
 * exported so tests can pin the curve.
 */
export function wearFailureChance(device: Device, reliability: number | undefined): number {
  const days = device.uptimeTicks / 24;
  if (days <= WEAR_ONSET_TICKS / 24) return 0;
  return Math.min(0.35, (days - WEAR_ONSET_TICKS / 24) * 0.05 * (1.1 - (reliability ?? 0.7)));
}

/** The chance actually rolled each day: the wear curve, scaled by game mode. */
export function dailyWearChance(world: World, device: Device): number {
  return wearFailureChance(device, world.catalog[device.defId]?.reliability) * (world.difficulty === 'hard' ? HARD_WEAR_FACTOR : 1);
}

// ---- Prestige (day-30 endgame, per season) ----

/** A season runs thirty in-game days; the scorecard closes at each season's day 30. */
export const PRESTIGE_DAY_TICKS = 30 * 24;

/** Hard mode is riskier play, so the same season is worth a quarter more. */
const PRESTIGE_HARD_BONUS = 0.25;

/**
 * Season-end loyalty bonus: a live contract with a spotless term pays this
 * many days' fee when the season closes. Struck contracts earn nothing —
 * the same trust rule the renewal roll uses.
 */
const SEASON_BONUS_DAYS = 2;

// ---- Season goal modifiers ----

/**
 * The association's declared themes, in rotation. Season 1 always opens on
 * 'none'; every close deals the next theme off this list. Each theme bends
 * exactly one economy dial for its whole season.
 */
export const SEASON_GOALS: Record<SeasonGoalId, { name: string; description: string }> = {
  none: { name: 'Quiet season', description: 'No declared theme — the market sits still.' },
  'contract-boom': { name: 'Infrastructure boom', description: 'New contract fees sign 25% higher all season.' },
  'hardware-shortage': { name: 'Import tariffs', description: 'Every device costs 20% more all season.' },
  'maintenance-season': { name: 'Maintenance season', description: 'Repairs cost half all season.' },
  'ticket-surge': { name: 'Service surge', description: 'Ticket rewards pay 25% more all season.' },
};

const GOAL_ROTATION: SeasonGoalId[] = ['contract-boom', 'hardware-shortage', 'maintenance-season', 'ticket-surge'];

/** The theme of the season after `season`, dealt from the fixed rotation. */
export function nextSeasonGoal(season: number): SeasonGoalId {
  // Season 1 runs quiet; season N (N ≥ 2) takes rotation slot (N-2) % len.
  return GOAL_ROTATION[(season - 1) % GOAL_ROTATION.length] ?? 'none';
}

/** How much a new contract fee is scaled this season (boom pays more). */
export function contractFeeMult(goal: SeasonGoalId): number {
  return goal === 'contract-boom' ? 1.25 : 1;
}

/** How much hardware costs this season (tariffs inflate everything). */
export function devicePriceMult(goal: SeasonGoalId): number {
  return goal === 'hardware-shortage' ? 1.2 : 1;
}

/** What a repair bill looks like this season (maintenance halves it). */
export function repairCostMult(goal: SeasonGoalId): number {
  return goal === 'maintenance-season' ? 0.5 : 1;
}

/** How much ticket rewards pay this season (surge boosts them). */
export function ticketRewardMult(goal: SeasonGoalId): number {
  return goal === 'ticket-surge' ? 1.25 : 1;
}

/** The price tag on a device under the current season's theme. */
export function devicePrice(world: World, def: DeviceDef): number {
  return Math.round(def.price * devicePriceMult(world.goal));
}

/** The current season's repair bill. */
export function repairCost(world: World): number {
  return Math.round(REPAIR_COST * repairCostMult(world.goal));
}

function paySeasonBonuses(world: World): number {
  let total = 0;
  for (const contract of world.contracts) {
    if (!contract.active || contract.breaches > 0) continue;
    const bonus = contract.feePerDay * SEASON_BONUS_DAYS;
    world.cash += bonus;
    total += bonus;
    log(world, 'info', 'contract', `${contract.client}: season-end loyalty bonus +$${bonus} for a spotless term`);
  }
  return total;
}

/** Pure scorecard: every point the shop earned this season, from live world state. */
export function prestigeBreakdown(world: World): PrestigeBreakdown {
  const cashPoints = Math.floor(Math.max(0, world.cash) / 50);
  const reputationPoints = world.reputation * 25;
  const insightPoints = world.insight * 15;
  const contractPoints = world.contracts.filter((c) => c.active).length * 40;
  const networkPoints = Object.keys(world.devices).length * 5;
  const servicePoints = world.tickets.filter((t) => t.status === 'resolved').length * 10;
  const base = cashPoints + reputationPoints + insightPoints + contractPoints + networkPoints + servicePoints;
  const hardBonus = world.difficulty === 'hard' ? Math.round(base * PRESTIGE_HARD_BONUS) : 0;
  return { cashPoints, reputationPoints, insightPoints, contractPoints, networkPoints, servicePoints, hardBonus, total: base + hardBonus };
}

/** Career prestige: every point the shop has ever earned, across all seasons. */
export function careerPrestige(world: World): number {
  return world.prestigeHistory.reduce((sum, record) => sum + record.score, 0);
}

/**
 * The rival ISP. It reads the same scorecards the association publishes: a
 * quiet shop is invisible, but a season that closes strong puts the rival's
 * office straight onto the shop's book of business.
 */
export const RIVAL_NAME = 'SkyLink Broadband';
export const RIVAL_POACH_SCORE = 150;
export const RIVAL_MATCH_DISCOUNT = 0.15;

/**
 * The rival's reaction to a strong season close: a poaching attempt on the
 * live contract with the highest daily fee. Deterministic — the score alone
 * decides. Matching the offer keeps the client at a permanently cheaper fee
 * (the 'matchRival' letter action); declining costs a trust strike.
 */
export function maybeRivalPoach(world: World, seasonScore: number): Mail | undefined {
  if (seasonScore < RIVAL_POACH_SCORE) return undefined;
  const target = world.contracts
    .filter((c) => c.active)
    .reduce<Contract | undefined>((best, c) => (best === undefined || c.feePerDay > best.feePerDay ? c : best), undefined);
  if (target === undefined) return undefined;
  const matchFee = Math.round(target.feePerDay * (1 - RIVAL_MATCH_DISCOUNT));
  const discount = Math.round(RIVAL_MATCH_DISCOUNT * 100);
  log(world, 'alert', 'contract', `${RIVAL_NAME} is courting ${target.client} — your season score got noticed`);
  return deliverMail(world, {
    from: clientAddress(target.client),
    subject: `${RIVAL_NAME} offered us a better deal`,
    body:
      `Hello,\n\n` +
      `A rep from ${RIVAL_NAME} came by this morning with a laminated folder and a very good coffee. ` +
      `They are offering the same service for ${discount}% less than we pay you now, starting next week.\n\n` +
      `We like your shop — you answer when we call. But we run a business, so we have to ask plainly: can you match their number?\n\n` +
      `— ${target.client}, office manager`,
    kind: 'client',
    actions: [
      { label: `Match their deal — drop our fee to $${matchFee}/day`, command: `matchRival:${target.id}` },
      { label: 'Hold the line — keep the fee as is', command: `declineRival:${target.id}` },
    ],
  });
}

/**
 * Once a season closes at the rival's attention threshold, SkyLink knows the
 * shop's numbers — and undercuts every new contract the shop tries to sign.
 * The discount is the same 15% they dangle in poach letters: the rival bids
 * one price, everywhere.
 */
export function rivalUndercuts(world: World): boolean {
  return careerPrestige(world) >= RIVAL_POACH_SCORE;
}

/**
 * The day-30 endgame, per season: the season closes, its scorecard freezes
 * into prestigeHistory, the season letter lands, and the next season begins.
 * The board keeps running — seasons roll on, prestige accumulates.
 */
function maybeCloseSeason(world: World): void {
  const seasonEnd = PRESTIGE_DAY_TICKS * world.season;
  if (world.tick < seasonEnd) return;
  // Loyalty bonuses land first: they are season earnings, so the scorecard
  // below counts them in its banked-cash points.
  const bonusTotal = paySeasonBonuses(world);
  const score = prestigeBreakdown(world);
  world.prestigeHistory.push({ season: world.season, score: score.total, breakdown: score });
  world.endgameTick = world.tick;
  const career = careerPrestige(world);
  const nextGoal = nextSeasonGoal(world.season);
  const nextTheme = SEASON_GOALS[nextGoal];
  if (nextTheme === undefined) return;
  world.goal = nextGoal;
  const goalLine = nextGoal === 'none' ? '' : `Season theme: ${nextTheme.name} — ${nextTheme.description}\n\n`;
  log(world, 'alert', 'clock', `Season ${world.season} closes — ${score.total} prestige this season, ${career} career points`);
  if (nextGoal !== 'none') {
    log(world, 'info', 'clock', `Season ${world.season + 1} theme: ${nextTheme.name} — ${nextTheme.description}`);
  }
  // The rival reads the same scorecards: a strong close puts its office on
  // your book of business. The poach letter lands just before the report.
  maybeRivalPoach(world, score.total);
  const rivalLine =
    score.total >= RIVAL_POACH_SCORE
      ? `${RIVAL_NAME} has noticed your climb — expect them to come after your clients.\n\n`
      : '';
  deliverMail(world, {
    from: 'Nusantara ISP Association <scores@nispa.example>',
    subject: `Season ${world.season} report — ${score.total} prestige this season`,
    body:
      (world.season === 1 ? 'Thirty days ago you opened shop. Here is how the region scores your first season.\n\n' : `Another thirty days in the books — season ${world.season} is scored.\n\n`) +
      `Prestige score: ${score.total}\n\n` +
      `  Banked cash ........ ${score.cashPoints}\n` +
      `  Reputation ......... ${score.reputationPoints}\n` +
      `  Insight ............ ${score.insightPoints}\n` +
      `  Live contracts ..... ${score.contractPoints}\n` +
      `  Network built ...... ${score.networkPoints}\n` +
      `  Tickets resolved ... ${score.servicePoints}\n` +
      (bonusTotal > 0 ? `  Loyalty bonuses .... +$${bonusTotal}\n` : '') +
      (score.hardBonus > 0 ? `  Hard-mode bonus .... ${score.hardBonus}\n` : '') +
      `\nCareer prestige: ${career}\n\n` +
      rivalLine +
      goalLine +
      'Season ' + (world.season + 1) + ' begins today. The clock keeps running — the career total is what the region remembers.\n\n' +
      '— Nusantara ISP Association, Season Office',
    kind: 'regulator',
    actions: [{ label: 'View final scorecard', command: 'openPrestige' }],
  });
  world.season += 1;
}

/**
 * SkyLink gloats. Every client the shop loses while the rival is on its
 * radar earns a line in the events log — word of your losses is their
 * advertising. The pick is deterministic: the tick chooses the jab.
 */
const RIVAL_TAUNTS: ((client: string) => string)[] = [
  (client) => `${RIVAL_NAME} (overheard at the coffee shop): "${client} just signed with us — fewer outages, friendlier invoice."`,
  (client) => `${RIVAL_NAME}'s billboard on the main road now reads: "Even ${client} switched."`,
  (client) => `${RIVAL_NAME}'s rep, door to door: "We keep hearing your name next to ${client}'s — in past tense."`,
  (client) => `${RIVAL_NAME} circled ${client}'s address in their prospect book — in green, the color of closed deals.`,
];

/** Fires the gloat, if the rival is watching and there is something to gloat about. */
function rivalTaunt(world: World, client: string): void {
  if (!rivalUndercuts(world)) return;
  const taunt = RIVAL_TAUNTS[world.tick % RIVAL_TAUNTS.length]!(client);
  log(world, 'info', 'contract', taunt);
}

/** Mark a device dead: hardware gave out, traffic stops until repaired. */
function failDevice(world: World, target: Device): void {
  if (target.failed) {
    log(world, 'warn', 'incident', `${target.name} has already failed`);
    return;
  }
  target.failed = true;
  log(world, 'alert', 'incident', `${target.name} failed — the hardware gave out and needs repair`);
  const def: DeviceDef | undefined = world.catalog[target.defId];
  if (def !== undefined && def.price >= 0) {
    const replaceCost = Math.max(0, devicePrice(world, def) - TRADE_IN_CREDIT);
    deliverMail(world, {
      from: 'Novabit Hardware Care <field@novabit.example>',
      subject: `Instant replacement available for your ${def.name}`,
      body:
        `Our telemetry shows the ${def.name} at your shop just went dark. Hardware happens.\n\n` +
        `${vendorVoice(world.reputation)}\n\n` +
        `The swap is one click: a brand-new ${def.name} takes the old unit's place — same name, same wiring, same configuration. ` +
        `Nothing on the network has to be re-typed. Cost: $${replaceCost} after the $${TRADE_IN_CREDIT} trade-in for the dead unit. ` +
        `A repair ($${REPAIR_COST}) keeps the old hardware running instead, at least until wear catches up again.\n\n` +
        `— Novabit Hardware Care`,
      kind: 'vendor',
      actions: [{ label: `Order replacement ($${replaceCost})`, command: `orderReplacement:${target.id}` }],
    });
  }
  const contract = world.contracts.find((c) => c.active && c.deviceId === target.id);
  openTicket(world, {
    client: contract?.client ?? 'Novabit (partner network)',
    title: 'Everything went dark',
    symptom: 'Whatever box of yours sits on our line seems dead — nothing responds since an hour ago. Please send someone.',
    slaTicks: 160,
    rewardCash: 170,
    penaltyCash: 130,
  });
}

/**
 * Daily wear roll: devices older than a week can die of old age, one at most
 * per day. Pressure to replace or repair aging hardware (GDD §7.1).
 */
function maybeWearFailures(world: World): void {
  if (world.tick % 24 !== 0) return;
  const eligible = Object.values(world.devices).filter(
    (device) => !device.failed && !device.incident && !device.compromised && device.uptimeTicks >= WEAR_ONSET_TICKS,
  );
  if (eligible.length === 0) return;
  for (const device of eligible) {
    const chance = dailyWearChance(world, device);
    // Predictive maintenance (Observability branch): aging plant is flagged
    // once, a day before the wear rolls can kill it — replace early or roll
    // the dice, the player's call.
    if (
      hasResearch(world, 'obs-predictive') &&
      !world.research.predictiveFlags.includes(device.id)
    ) {
      world.research.predictiveFlags.push(device.id);
      log(world, 'warn', 'research', `predictive maintenance flags ${device.name} — aging hardware, consider replacing it`);
    }
    if (chance > 0 && nextRandom(world) % 1000 < chance * 1000) {
      failDevice(world, device);
      break; // one failure per day keeps incidents readable
    }
  }
}

function checkSlaBreaches(world: World): void {
  for (const ticket of world.tickets) {
    if (ticket.status === 'open' && !ticket.breached && world.tick > ticket.openedTick + ticket.slaTicks) {
      ticket.breached = true;
      world.cash -= ticket.penaltyCash;
      world.reputation -= 1;
      log(world, 'alert', 'sla', `${ticket.client}: SLA breached on "${ticket.title}" — -$${ticket.penaltyCash}, reputation hit`);
      // A missed SLA is also a trust strike on the client's contract.
      const contract = contractFor(world, ticket.client);
      if (contract !== undefined) strikeContract(world, contract, `SLA breached on "${ticket.title}"`);
    }
  }
}

/**
 * Ambient incidents: once a day (after a three-day grace period), if any
 * device lags its firmware channel, is not already compromised, and the
 * player isn't already handling one of these tickets, roll for an exploit.
 * Pressure to keep fleet software current (GDD §10) without pile-ups.
 */
function maybeSpawnFirmwareIncidents(world: World): void {
  if (world.tick < 72 || world.tick % 24 !== 0 || Object.keys(world.firmwareChannels).length === 0) return;
  const busy = world.tickets.some((t) => t.client === 'Novabit (partner network)' && t.status === 'open');
  if (busy) return;
  const eligible = Object.values(world.devices).filter(
    (device) => !device.compromised && !device.failed && world.firmwareChannels[device.defId] !== undefined && device.firmware !== world.firmwareChannels[device.defId],
  );
  if (eligible.length === 0) return;
  if (!firmwareIncidentDue(world)) return;
  const target = eligible[nextRandom(world) % eligible.length];
  if (target !== undefined) applyOutdatedFirmwareIncident(world, target, world.firmwareChannels[target.defId] ?? '');
}

/**
 * The daily ambient-exploit gate. Hardening program (Security branch):
 * patched baselines make exploits land half as often — the pressure stays,
 * the bleed slows.
 */
export function firmwareIncidentDue(world: World): boolean {
  return nextRandom(world) % (hasResearch(world, 'sec-hardening') ? 8 : 4) === 0;
}

/**
 * Contract clients watch their own device and file tickets when it misbehaves.
 * Two honest signals: a compromised box (security) and a wired device whose
 * every linked interface is administratively down (outage). These bypass the
 * ambient queue cap — a signed agreement is an obligation, not drip content —
 * but the one-open-ticket-per-client rule still holds.
 */
const CONTRACT_SECURITY_TICKET: Omit<TicketTemplate, 'client'> = {
  title: 'Our machines are acting strange',
  symptom: 'Files open slowly and one computer is busy at night when nobody is here. We pay for peace of mind — please check our equipment.',
  slaTicks: 160,
  rewardCash: 140,
  penaltyCash: 110,
};

const CONTRACT_OUTAGE_TICKET: Omit<TicketTemplate, 'client'> = {
  title: 'The whole site is offline',
  symptom: 'Nothing connects since this morning and we did not touch anything on our end. Please restore our service.',
  slaTicks: 200,
  rewardCash: 90,
  penaltyCash: 70,
};

function maybeSpawnContractTickets(world: World): void {
  for (const contract of world.contracts) {
    if (!contract.active) continue;
    const device = world.devices[contract.deviceId];
    if (device === undefined) continue;
    const hasOpen = world.tickets.some((t) => t.status === 'open' && t.client === contract.client);
    if (hasOpen) continue;
    if (device.compromised) {
      openTicket(world, { client: contract.client, ...CONTRACT_SECURITY_TICKET });
      continue;
    }
    const linkedIfaces = world.links
      .filter((l) => l.a.deviceId === device.id || l.b.deviceId === device.id)
      .map((l) => (l.a.deviceId === device.id ? l.a.interfaceName : l.b.interfaceName));
    if (linkedIfaces.length > 0) {
      const allDown = linkedIfaces.every(
        (name) => device.interfaces.find((i) => i.name === name)?.enabled === false,
      );
      if (allDown) openTicket(world, { client: contract.client, ...CONTRACT_OUTAGE_TICKET });
    }
  }
}

function maybeSpawnTickets(world: World): void {
  // Slow ambient drip: at most one open ticket per client. The queue widens
  // with reputation (more clients trust the shop) and narrows when it is bad.
  const cap = world.reputation >= 5 ? 4 : world.reputation <= -3 ? 2 : 3;
  const openCount = world.tickets.filter((t) => t.status === 'open').length;
  if (openCount >= cap || world.tick % 48 !== 0) return;
  const clientsWithOpen = new Set(world.tickets.filter((t) => t.status === 'open').map((t) => t.client));
  const options = TICKET_TEMPLATES.filter((template) => !clientsWithOpen.has(template.client));
  if (options.length === 0) return;
  const roll = nextRandom(world);
  const template = options[roll % options.length];
  if (template !== undefined) openTicket(world, template);
}
