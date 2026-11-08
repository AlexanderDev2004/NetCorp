import type { Device, Link, World } from './types.ts';
import { sameSubnet } from './ip.ts';
import { packetAllowed, type PacketContext } from './protocols/firewall.ts';

/**
 * Connectivity checks. The default sim is flow-level (GDD §15, realism dial):
 * this module answers "can A reach B, and if not, where and why" without
 * simulating individual packets. Simulation mode replaces this later with a
 * hop-by-hop packet view.
 */

export interface Hop {
  deviceId: string;
  /** Why traffic can pass through this device: 'host' | 'switch' | 'router' | 'firewall'. */
  role: string;
}

export interface PathResult {
  ok: boolean;
  hops: Hop[];
  /** Set when ok === false: the device where the path broke and why. */
  blockedAt?: { deviceId: string; reason: string };
}

function linkEndpoints(link: Link, deviceId: string): string | undefined {
  if (link.a.deviceId === deviceId) return link.b.deviceId;
  if (link.b.deviceId === deviceId) return link.a.deviceId;
  return undefined;
}

function deviceRole(device: Device): Hop['role'] {
  if (device.kind === 'router-soho' || device.kind === 'router-edge') return 'router';
  if (device.kind === 'firewall') return 'firewall';
  if (device.kind.startsWith('switch') || device.kind === 'access-point') return 'switch';
  return 'host';
}

/** Does this router know where to send traffic for `address`? (Default route counts.) */
function routerCanForward(device: Device, dstAddress: string): boolean {
  return device.config.routes.some(
    (route) => route.destinationCidr === '0.0.0.0/0' || routeMatches(route.destinationCidr, dstAddress),
  );
}

function routeMatches(cidr: string, address: string): boolean {
  const [network, prefixText] = cidr.split('/');
  if (network === undefined || prefixText === undefined) return false;
  return sameSubnet({ address: network, prefix: Number(prefixText) }, address);
}

/**
 * Find an L3 path from `from` to the device owning `dstAddress`.
 *
 * Same-subnet traffic follows L2 adjacency: switches/APs pass, the destination
 * firewall evaluates first-match rules. Cross-subnet traffic requires the
 * source interface to know a gateway, and the gateway device to hold a route
 * (specific or default) toward the destination — exactly the two failure
 * points a real misconfigured network hits.
 */
export function findPath(world: World, fromDeviceId: string, dstAddress: string): PathResult {
  const source = world.devices[fromDeviceId];
  if (source === undefined) {
    return { ok: false, hops: [], blockedAt: { deviceId: fromDeviceId, reason: 'no such device' } };
  }

  const target = Object.values(world.devices).find((device) =>
    device.interfaces.some((iface) => iface.ipv4?.address === dstAddress),
  );
  if (target === undefined) {
    return { ok: false, hops: [], blockedAt: { deviceId: fromDeviceId, reason: `no route to host ${dstAddress}` } };
  }

  const sourceIface = source.interfaces.find((iface) => iface.ipv4 !== undefined);
  const srcAddress = sourceIface?.ipv4?.address;
  if (srcAddress === undefined || sourceIface === undefined || sourceIface.ipv4 === undefined) {
    return { ok: false, hops: [], blockedAt: { deviceId: source.id, reason: 'source device has no IPv4 configured' } };
  }

  if (!sameSubnet(sourceIface.ipv4, dstAddress)) {
    const gatewayAddress = sourceIface.ipv4Gateway;
    if (gatewayAddress === undefined) {
      return {
        ok: false,
        hops: [],
        blockedAt: {
          deviceId: source.id,
          reason: `no gateway configured: ${dstAddress} is outside ${sourceIface.ipv4.address}/${sourceIface.ipv4.prefix}`,
        },
      };
    }
    const gatewayDevice = Object.values(world.devices).find((device) =>
      device.interfaces.some((iface) => iface.ipv4?.address === gatewayAddress),
    );
    if (gatewayDevice === undefined) {
      return { ok: false, hops: [], blockedAt: { deviceId: source.id, reason: `gateway ${gatewayAddress} is unreachable` } };
    }
    if (!routerCanForward(gatewayDevice, dstAddress)) {
      return { ok: false, hops: [{ deviceId: gatewayDevice.id, role: deviceRole(gatewayDevice) }], blockedAt: { deviceId: gatewayDevice.id, reason: `no route to ${dstAddress}` } };
    }
    return { ok: true, hops: [{ deviceId: gatewayDevice.id, role: deviceRole(gatewayDevice) }] };
  }

  // BFS over links.
  const visited = new Set<string>([source.id]);
  const queue: { deviceId: string; hops: Hop[] }[] = [{ deviceId: source.id, hops: [] }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const link of world.links) {
      const neighborId = linkEndpoints(link, current.deviceId);
      if (neighborId === undefined || visited.has(neighborId)) continue;
      const neighbor = world.devices[neighborId];
      if (neighbor === undefined) continue;
      visited.add(neighborId);

      const hops = [...current.hops, { deviceId: neighborId, role: deviceRole(neighbor) } as Hop];

      if (neighborId === target.id) {
        const ctx: PacketContext = { srcAddress, dstAddress, dstPort: 0, protocol: 'icmp' };
        const verdict = packetAllowed(target.config.firewallRules, ctx);
        if (!verdict.allowed) {
          return {
            ok: false,
            hops,
            blockedAt: { deviceId: neighbor.id, reason: `blocked by firewall rule ${verdict.matched ?? '?'}` },
          };
        }
        return { ok: true, hops };
      }

      const role = deviceRole(neighbor);
      if (role === 'router' && !routerCanForward(neighbor, dstAddress)) {
        return { ok: false, hops, blockedAt: { deviceId: neighbor.id, reason: `no route to ${dstAddress}` } };
      }
      if (role === 'firewall' && !packetAllowed(neighbor.config.firewallRules, { srcAddress, dstAddress, dstPort: 0, protocol: 'icmp' }).allowed) {
        return { ok: false, hops, blockedAt: { deviceId: neighbor.id, reason: 'blocked by firewall' } };
      }
      queue.push({ deviceId: neighborId, hops });
    }
  }

  return { ok: false, hops: [], blockedAt: { deviceId: source.id, reason: 'destination unreachable: no path' } };
}

/** The device a DHCP client would reach as gateway: first router on the same subnet. */
export function findGateway(world: World, device: Device, address: string): Device | undefined {
  return Object.values(world.devices).find(
    (candidate) =>
      candidate.id !== device.id &&
      (candidate.kind === 'router-soho' || candidate.kind === 'router-edge' || candidate.kind === 'firewall') &&
      candidate.interfaces.some(
        (iface) => iface.ipv4 !== undefined && sameSubnet(iface.ipv4, address),
      ),
  );
}

/**
 * DHCP servers reachable from a client interface's L2 segment (GDD §5.1).
 * A broadcast never crosses a router, so traversal walks links through
 * switches/APs only and stops at routers/firewalls — but a router attached to
 * the segment can itself serve DHCP on the interface it uses to attach.
 * A server candidate must have a pool bound to the interface it connects with.
 */
export function findDhcpServers(world: World, deviceId: string, interfaceName: string): Device[] {
  const client = world.devices[deviceId];
  if (client === undefined) return [];

  const attached = (device: Device, viaInterface: string): boolean =>
    device.config.dhcpPools.some((pool) => pool.interfaceName === viaInterface);

  const candidates: Device[] = [];
  const visited = new Set<string>([deviceId]);
  // (deviceId, the interface that device uses on this segment)
  const queue: { deviceId: string; interfaceName: string }[] = [{ deviceId, interfaceName }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const link of world.links) {
      const other = linkEndpointsById(link, current.deviceId);
      if (other === undefined) continue;
      const neighbor = world.devices[other.deviceId];
      if (neighbor === undefined || visited.has(neighbor.id)) continue;
      visited.add(neighbor.id);

      if (attached(neighbor, other.interfaceName)) candidates.push(neighbor);
      if (deviceRole(neighbor) === 'switch') {
        // L2 passthrough: the segment continues on the neighbor's other ports.
        for (const iface of neighbor.interfaces) {
          if (iface.name !== other.interfaceName && isInterfaceWired(world, neighbor.id, iface.name)) {
            queue.push({ deviceId: neighbor.id, interfaceName: iface.name });
          }
        }
      }
    }
  }
  return candidates;
}

function linkEndpointsById(link: Link, deviceId: string): { deviceId: string; interfaceName: string } | undefined {
  if (link.a.deviceId === deviceId) return { deviceId: link.b.deviceId, interfaceName: link.b.interfaceName };
  if (link.b.deviceId === deviceId) return { deviceId: link.a.deviceId, interfaceName: link.a.interfaceName };
  return undefined;
}

function isInterfaceWired(world: World, deviceId: string, interfaceName: string): boolean {
  return world.links.some(
    (link) =>
      (link.a.deviceId === deviceId && link.a.interfaceName === interfaceName) ||
      (link.b.deviceId === deviceId && link.b.interfaceName === interfaceName),
  );
}
