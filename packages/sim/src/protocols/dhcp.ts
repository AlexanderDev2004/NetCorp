import type { Device, DhcpPool } from '../types.ts';
import { ipv4ToInt, prefixToMaskString } from '../ip.ts';

/**
 * DHCP server behavior (GDD §5.1). Failure modes to implement as the sim grows:
 * pool exhaustion, rogue DHCP server on the same segment, relay (ip helper).
 */

export interface Lease {
  mac: string;
  address: string;
  expiresTick: number;
}

export function poolAddressCount(pool: DhcpPool): number {
  const start = ipv4ToInt(pool.rangeStart);
  const end = ipv4ToInt(pool.rangeEnd);
  return end >= start ? end - start + 1 : 0;
}

export function findPool(device: Device, interfaceName: string): DhcpPool | undefined {
  return device.config.dhcpPools.find((p) => p.interfaceName === interfaceName);
}

export function poolNetworkString(pool: DhcpPool): string {
  return `${pool.network}/${pool.prefix} (${prefixToMaskString(pool.prefix)})`;
}

/**
 * Allocate the first free address in the pool range, skipping taken ones.
 * Deterministic: lowest address first, like most real implementations.
 */
export function allocateAddress(pool: DhcpPool, taken: Set<string>): string | undefined {
  const start = ipv4ToInt(pool.rangeStart);
  const end = ipv4ToInt(pool.rangeEnd);
  for (let value = start; value <= end; value++) {
    const address = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.');
    if (!taken.has(address)) return address;
  }
  return undefined;
}
