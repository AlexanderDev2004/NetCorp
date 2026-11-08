/**
 * Public API of the simulation. The client imports only from this package root;
 * internal modules (net, protocols) are implementation details.
 */
export { createWorld, log } from './state.ts';
export { applyCommand, advanceTicks } from './engine.ts';
export { findPath } from './net.ts';
export { firstMatch, packetAllowed } from './protocols/firewall.ts';
export { allocateAddress, findPool, poolAddressCount } from './protocols/dhcp.ts';
export { resolveLocal, resolveViaForwarder } from './protocols/dns.ts';
export { cidrContains, ipv4ToInt, prefixToMaskString, sameSubnet } from './ip.ts';
export * from './types.ts';
