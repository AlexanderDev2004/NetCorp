import type { FirewallRule } from '../types.ts';
import { cidrContains } from '../ip.ts';

export interface PacketContext {
  srcAddress: string;
  dstAddress: string;
  dstPort: number;
  protocol: 'tcp' | 'udp' | 'icmp';
}

/**
 * First-match semantics, exactly like production firewalls: the first rule
 * whose matchers all match wins, and a packet matching no rule is allowed.
 * Misordered rules bite here the same way they do on a real box — a broad
 * allow above a specific deny hides the deny forever.
 */
export function firstMatch(rules: FirewallRule[], packet: PacketContext): FirewallRule | undefined {
  for (const rule of rules) {
    if (rule.protocol !== undefined && rule.protocol !== packet.protocol) continue;
    if (rule.dstPort !== undefined && rule.dstPort !== packet.dstPort) continue;
    if (rule.srcCidr !== undefined && !cidrContains(rule.srcCidr, packet.srcAddress)) continue;
    if (rule.dstCidr !== undefined && !cidrContains(rule.dstCidr, packet.dstAddress)) continue;
    return rule;
  }
  return undefined;
}

export function packetAllowed(rules: FirewallRule[], packet: PacketContext): { allowed: boolean; matched?: string } {
  const matched = firstMatch(rules, packet);
  if (matched === undefined) return { allowed: true };
  return { allowed: matched.action === 'allow', matched: matched.id };
}
