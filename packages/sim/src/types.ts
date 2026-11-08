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
  /** Gateway for traffic leaving this subnet (static or learned via DHCP). */
  ipv4Gateway?: string;
  /** How the address got here: typed by hand, or leased from a DHCP server. */
  ipv4Source?: 'static' | 'dhcp';
  /** Device id of the DHCP server that granted the lease (ipv4Source 'dhcp'). */
  leaseServerDeviceId?: string;
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
  /** Set when an incident injection created this device (GDD §7). */
  incident?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'alert';

export interface LogEntry {
  tick: number;
  level: LogLevel;
  source: string;
  text: string;
}

/**
 * A client-reported symptom (GDD §2, §6.2). Tickets never state the cause —
 * the title says what hurts, the symptom text is flavor, the diagnosis is the
 * player's job.
 */
export interface Ticket {
  id: string;
  client: string;
  title: string;
  symptom: string;
  openedTick: number;
  /** Ticks from opening until the SLA expires. */
  slaTicks: number;
  status: 'open' | 'resolved';
  breached: boolean;
  resolvedTick?: number;
  rewardCash: number;
  penaltyCash: number;
}

/** Events are facts produced by the sim. The UI never invents them. */
export type Event = LogEntry;

/**
 * One letter in the Inbox (GDD §8). Senders have personalities; phishes look
 * like real mail and their actions carry real consequences.
 */
export interface Mail {
  id: string;
  from: string;
  subject: string;
  body: string;
  kind: 'mentor' | 'vendor' | 'client' | 'invoice' | 'spam' | 'phish' | 'regulator';
  receivedTick: number;
  read: boolean;
  /** Action buttons shown under the letter; each carries a sim command string. */
  actions: { label: string; command: string }[];
  /** Set once an action button is used; the mail collapses to its outcome. */
  actionTaken?: string;
}

export interface World {
  seed: number;
  rngState: number;
  tick: number;
  catalog: DeviceCatalog;
  devices: Record<string, Device>;
  links: Link[];
  log: LogEntry[];
  tickets: Ticket[];
  mail: Mail[];
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
  | { type: 'setIpv4'; deviceId: string; interfaceName: string; address?: string; prefix?: number; gateway?: string }
  | { type: 'addFirewallRule'; deviceId: string; rule: Omit<FirewallRule, 'id'> }
  | { type: 'removeFirewallRule'; deviceId: string; ruleId: string }
  | { type: 'addRoute'; deviceId: string; route: Route }
  | { type: 'setDnsForwarder'; deviceId: string; address?: string }
  | { type: 'addDhcpPool'; deviceId: string; pool: Omit<DhcpPool, 'leaseMinutes'> & { leaseMinutes?: number } }
  | { type: 'removeDhcpPool'; deviceId: string; interfaceName: string }
  /** A client interface asks the network for a DHCP lease. */
  | { type: 'dhcpDiscover'; deviceId: string; interfaceName?: string }
  /** Incident injection (GDD §7). More kinds arrive with each era. */
  | { type: 'triggerIncident'; kind: 'rogue-dhcp'; targetDeviceId: string }
  /** The player marks a ticket fixed. The sim pays out per SLA state. */
  | { type: 'resolveTicket'; ticketId: string }
  /** Opens a letter (marks it read). */
  | { type: 'readMail'; mailId: string }
  /**
   * Uses an action button on a letter. The command string is the template's
   * action payload, e.g. 'phish-pay:8841', 'reportPhish', 'openReleaseNotes'.
   */
  | { type: 'mailAction'; mailId: string; command: string }
  | { type: 'ping'; fromDevice: string; toAddress: string }
  /** Cash leaves the wallet; delivery to the board is a later command. */
  | { type: 'buy'; defId: string };
