/** Small IP/CIDR helpers. IPv4 only for the MVP. */

export function ipv4ToInt(address: string): number {
  const parts = address.split('.');
  if (parts.length !== 4) throw new Error(`bad ipv4: ${address}`);
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new Error(`bad ipv4: ${address}`);
    }
    value = (value << 8) | octet;
  }
  return value >>> 0;
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
