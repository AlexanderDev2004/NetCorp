import type { Device } from '../types.ts';

/**
 * DNS resolver behavior (GDD §5.1). Failure modes to implement as the sim grows:
 * dead forwarder, cache poisoning (CVE-driven event), split-horizon zones.
 */

/** Resolve a local A record against the device's authoritative zone. */
export function resolveLocal(device: Device, name: string): string | undefined {
  const record = device.config.dnsRecords.find((r) => r.type === 'A' && r.name === name);
  return record?.value;
}

/**
 * Resolve through the device's configured forwarder. The forwarder address must
 * belong to a device on the network — wiring mistakes surface as timeouts, not
 * error dialogs. `resolvers` maps address -> device id for this lookup.
 */
export function resolveViaForwarder(
  forwarder: string,
  name: string,
  resolvers: Map<string, Device>,
): string | undefined {
  const device = resolvers.get(forwarder);
  if (device === undefined) return undefined; // dead or misconfigured forwarder
  return resolveLocal(device, name);
}
