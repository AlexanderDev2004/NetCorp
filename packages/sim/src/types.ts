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
  /** 0–1. Older hardware fails more often; lower fails sooner (GDD §7.1). */
  reliability?: number;
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
  /** Set when an exploit landed (outdated firmware); patching clears it. */
  compromised?: boolean;
  /** Set when a wear roll kills the hardware; a paid repair brings it back. */
  failed?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'alert';

/** Game mode. 'normal' is the standard pace; 'hard' squeezes pay and hardware. */
export type Difficulty = 'normal' | 'hard';

/** Per-season prestige scorecard: the points the shop earned in one season. */
export interface PrestigeBreakdown {
  /** Banked cash, $50 per point (debt clamps at zero — the region rounds down, not under). */
  cashPoints: number;
  /** Standing with the community, 25 per point. */
  reputationPoints: number;
  /** Hard-won experience, 15 per point. */
  insightPoints: number;
  /** Recurring client base at season close, 40 per live contract. */
  contractPoints: number;
  /** Infrastructure built, 5 per device on the board. */
  networkPoints: number;
  /** Service record, 10 per resolved ticket. */
  servicePoints: number;
  /** The hard-mode risk premium on everything above. */
  hardBonus: number;
  total: number;
}

/** One closed season, as the region remembers it: score plus the frozen card. */
export interface PrestigeSeasonRecord {
  season: number;
  score: number;
  breakdown: PrestigeBreakdown;
}

/**
 * Season theme declared by the ISP association (GDD-inspired season goals).
 * Each theme bends one economy dial for the whole season; 'none' is the
 * quiet baseline. Themes rotate in a fixed order across seasons.
 */
export type SeasonGoalId = 'none' | 'contract-boom' | 'hardware-shortage' | 'maintenance-season' | 'ticket-surge';

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

/** A maintenance contract: the client pays daily while their device stays healthy. */
export interface Contract {
  id: string;
  client: string;
  /** The client's device on the board; the contract pays while it is healthy. */
  deviceId: string;
  /** Cash per day (24 ticks), locked at signing with the reputation multiplier. */
  feePerDay: number;
  startedTick: number;
  /** Tick the current term ends; the daily roll then offers renewal or churns. */
  endTick: number;
  /** Trust strikes this term: SLA breaches and withheld fees. Any strike at term end means churn. */
  breaches: number;
  active: boolean;
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
  /**
   * Set by the sim when the spam filter is sharp enough to catch the letter
   * on arrival: it lands already flagged (and, once the filter is veteran,
   * already reported — no payout possible). The UI renders the flag.
   */
  quarantined?: boolean;
  /** The player moved the letter to the discard folder; it stays retrievable. */
  discarded?: boolean;
}

export interface World {
  seed: number;
  rngState: number;
  tick: number;
  /** Game mode: hard pays 20% less, wears hardware out half again as fast, and the client clock runs faster. */
  difficulty: Difficulty;
  /** Season number, 1-based. Each season runs 30 days; prestige accumulates across them. */
  season: number;
  /** The association's declared theme for the current season; bends one economy dial. */
  goal: SeasonGoalId;
  /** One record per closed season: the score and the scorecard frozen at its close. */
  prestigeHistory: PrestigeSeasonRecord[];
  catalog: DeviceCatalog;
  devices: Record<string, Device>;
  links: Link[];
  log: LogEntry[];
  tickets: Ticket[];
  mail: Mail[];
  /** Active maintenance contracts: the shop's recurring revenue (GDD §6). */
  contracts: Contract[];
  cash: number;
  reputation: number;
  insight: number;
  /** How many times the player has paid a phishing "invoice". Feeds the escalating reputation cost. */
  phishPayments: number;
  /** Server-room tier index into RACK_TIERS: how many devices the board can hold. */
  rackTier: number;
  /**
   * Tick the current season's scorecard last closed, once it does. The client
   * shows the scorecard overlay for exactly this closing (see prestigeHistory).
   */
  endgameTick?: number;
  nextId: number;
  /**
   * Latest known firmware version per def id, supplied by the content layer
   * (the sim stays content-free). Devices behind their channel are eligible
   * for the ambient outdated-firmware incident.
   */
  firmwareChannels: Record<string, string>;
}

export type Command =
  | { type: 'placeDevice'; defId: string; name?: string; x: number; y: number }
  | { type: 'deleteDevice'; deviceId: string }
  | { type: 'moveDevice'; deviceId: string; x: number; y: number }
  | { type: 'wireLink'; a: Endpoint; b: Endpoint; media?: Link['media'] }
  | { type: 'unwireLink'; linkId: string }
  | { type: 'setIpv4'; deviceId: string; interfaceName: string; address?: string; prefix?: number; gateway?: string }
  /** Brings an interface UP (true) or DOWN (false); a down endpoint blocks its links. */
  | { type: 'setInterfaceEnabled'; deviceId: string; interfaceName: string; enabled: boolean }
| { type: 'updateFirmware'; deviceId: string; version: string }
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
| { type: 'triggerIncident'; kind: 'outdated-firmware'; targetDeviceId: string; latestVersion: string }
  /** Wear injection: marks the device failed as if a wear roll had landed. */
  | { type: 'triggerIncident'; kind: 'wear-failure'; targetDeviceId: string }
  /** The player marks a ticket fixed. The sim pays out per SLA state. */
  | { type: 'resolveTicket'; ticketId: string }
  /** Opens a letter (marks it read). */
  | { type: 'readMail'; mailId: string }
  /** Moves a letter to or out of the discard folder; the letter is never destroyed. */
  | { type: 'discardMail'; mailId: string; restore?: boolean }
  /**
   * Uses an action button on a letter. The command string is the template's
   * action payload, e.g. 'phish-pay:8841', 'reportPhish', 'openReleaseNotes'.
   */
  | { type: 'mailAction'; mailId: string; command: string }
  | { type: 'ping'; fromDevice: string; toAddress: string }
  /** Cash leaves the wallet; delivery to the board is a later command. */
  | { type: 'buy'; defId: string }
  /** Buys the next server-room rack tier, raising the board's device capacity. */
  | { type: 'upgradeRack' }
  /** Pays to bring a failed (worn-out) device back online. */
  | { type: 'repairDevice'; deviceId: string }
  /** Swaps a failed device for brand-new hardware of the same model, in place. */
  | { type: 'replaceDevice'; deviceId: string }
  /**
   * Community work: sponsor a local LAN party or offer free fixes. Costs
   * cash, earns reputation — the way back from a breach spiral (GDD §5).
   */
  | { type: 'goodwill'; action: 'sponsor-lan' | 'free-repairs' }
  /** Flips the game mode; the client picks its clock speed up from this. */
  | { type: 'setDifficulty'; difficulty: Difficulty }
  /** Signs a maintenance contract with a client, pinned to their device. */
  | { type: 'signContract'; client: string; deviceId: string }
  /** Ends a contract; the client stops paying at the next daily roll. */
  | { type: 'cancelContract'; contractId: string };
