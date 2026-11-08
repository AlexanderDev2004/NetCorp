/**
 * World, device, and command types. Everything here is plain JSON-serializable
 * data: saves, replays, and (later) co-op sync all ride on this property.
 *
 * Vocabulary: see CONTEXT.md at the repo root.
 */

export type DeviceKind =
  | 'desktop'
  | 'server'
  | 'printer'
  | 'switch-unmanaged'
  | 'switch-managed'
  | 'router-soho'
  | 'router-edge'
  | 'access-point'
  | 'firewall'
  | 'ups';

/** A static catalog entry (packages/data). The sim is decoupled from content. */
export interface DeviceDef {
  id: string;
  kind: DeviceKind;
  name: string;
  price: number;
  interfaces: { name: string; kind: Interface['kind'] }[];
  /** Vendor firmware channel string, e.g. "RouterOS-like 7.14" (GDD §10). */
  firmware: string;
}

export type DeviceCatalog = Record<string, DeviceDef>;

export interface Ipv4 {
  address: string;
  prefix: number;
}

export interface Interface {
  name: string;
  mac: string;
  kind: 'ethernet' | 'wifi' | 'wan';
  ipv4?: Ipv4;
  enabled: boolean;
}

export interface Endpoint {
  deviceId: string;
  interfaceName: string;
}

export interface Link {
  id: string;
  a: Endpoint;
  b: Endpoint;
  media: 'copper' | 'fiber' | 'wireless';
}

export interface FirewallRule {
  id: string;
  action: 'allow' | 'deny';
  comment?: string;
  srcCidr?: string;
  dstCidr?: string;
  dstPort?: number;
  protocol?: 'tcp' | 'udp' | 'icmp';
}

export interface Route {
  destinationCidr: string;
  gateway?: string;
  interfaceName?: string;
  metric: number;
}

export interface DhcpPool {
  interfaceName: string;
  network: string;
  prefix: number;
  rangeStart: string;
  rangeEnd: string;
  leaseMinutes: number;
}

export interface DnsRecord {
  name: string;
  type: 'A' | 'CNAME' | 'MX';
  value: string;
}

export interface DeviceConfig {
  firewallRules: FirewallRule[];
  routes: Route[];
  dhcpPools: DhcpPool[];
  dnsRecords: DnsRecord[];
  dnsForwarder?: string;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  defId: string;
  x: number;
  y: number;
  interfaces: Interface[];
  config: DeviceConfig;
  /** Ticks since placement; wear/failure rolls key off this later (GDD §7.1). */
  uptimeTicks: number;
  firmware: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'alert';

export interface LogEntry {
  tick: number;
  level: LogLevel;
  source: string;
  text: string;
}

/** Events are facts produced by the sim. The UI never invents them. */
export type Event = LogEntry;

export interface World {
  seed: number;
  rngState: number;
  tick: number;
  catalog: DeviceCatalog;
  devices: Record<string, Device>;
  links: Link[];
  log: LogEntry[];
  cash: number;
  reputation: number;
  insight: number;
  nextId: number;
}

export type Command =
  | { type: 'placeDevice'; defId: string; name?: string; x: number; y: number }
  | { type: 'deleteDevice'; deviceId: string }
  | { type: 'moveDevice'; deviceId: string; x: number; y: number }
  | { type: 'wireLink'; a: Endpoint; b: Endpoint; media?: Link['media'] }
  | { type: 'unwireLink'; linkId: string }
  | { type: 'setIpv4'; deviceId: string; interfaceName: string; address?: string; prefix?: number }
  | { type: 'addFirewallRule'; deviceId: string; rule: Omit<FirewallRule, 'id'> }
  | { type: 'removeFirewallRule'; deviceId: string; ruleId: string }
  | { type: 'addRoute'; deviceId: string; route: Route }
  | { type: 'setDnsForwarder'; deviceId: string; address?: string }
  | { type: 'ping'; fromDevice: string; toAddress: string }
  /** Cash leaves the wallet; delivery to the board is a later command. */
  | { type: 'buy'; defId: string };
