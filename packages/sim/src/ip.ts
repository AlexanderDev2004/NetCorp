/** Small IP/CIDR helpers. IPv4 only for the MVP. */

/** Strict dotted-quad check: four numeric octets 0–255, no empty parts. */
export function isValidIpv4(address: string): boolean {
  const parts = address.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return false;
  }
  return true;
}

export function ipv4ToInt(address: string): number {
  if (!isValidIpv4(address)) throw new Error(`bad ipv4: ${address}`);
  let value = 0;
  for (const part of address.split('.')) {
    value = (value << 8) | Number(part);
  }
  return value >>> 0;
}

export function isValidPrefix(prefix: number): boolean {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

export function maskForPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function cidrContains(cidr: string, address: string): boolean {
  const [network, prefixText] = cidr.split('/');
  if (network === undefined || prefixText === undefined) throw new Error(`bad cidr: ${cidr}`);
  const prefix = Number(prefixText);
  const mask = maskForPrefix(prefix);
  return ((ipv4ToInt(network) & mask) >>> 0) === ((ipv4ToInt(address) & mask) >>> 0);
}

export function sameSubnet(a: { address: string; prefix: number }, address: string): boolean {
  return cidrContains(`${a.address}/${a.prefix}`, address);
}

export function prefixToMaskString(prefix: number): string {
  const m = maskForPrefix(prefix);
  return [24, 16, 8, 0].map((shift) => String((m >>> shift) & 0xff)).join('.');
}
