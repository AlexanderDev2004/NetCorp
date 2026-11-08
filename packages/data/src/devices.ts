import type { DeviceDef } from '@netcorp/sim';

/**
 * The MVP "Garage" catalog (GDD §14). Prices are game dollars. Every device is
 * a workload fit, not a tier: the dumb switch is the *right* buy for two desks.
 */
export const DEVICE_CATALOG: DeviceDef[] = [
  { id: 'desktop', kind: 'desktop', name: 'Office Desktop', price: 300, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'OsWorks 1.0' },
  { id: 'server', kind: 'server', name: 'Rack Server', price: 900, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'OsWorks Server 1.0' },
  { id: 'printer', kind: 'printer', name: 'Laser Printer', price: 120, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'printfw 3.2' },
  { id: 'switch-unmanaged', kind: 'switch-unmanaged', name: 'Dumb Switch (4p)', price: 15, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'eth2', kind: 'ethernet' }, { name: 'eth3', kind: 'ethernet' }], firmware: 'n/a' },
  { id: 'switch-managed', kind: 'switch-managed', name: 'Managed Switch (6p)', price: 140, interfaces: [{ name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'eth2', kind: 'ethernet' }, { name: 'eth3', kind: 'ethernet' }, { name: 'eth4', kind: 'ethernet' }, { name: 'eth5', kind: 'ethernet' }], firmware: 'SwitchOS 2.1' },
  { id: 'router-soho', kind: 'router-soho', name: 'SOHO Router', price: 80, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }, { name: 'wifi0', kind: 'wifi' }], firmware: 'RouterOS-like 7.14' },
  { id: 'router-edge', kind: 'router-edge', name: 'Edge Router (dual WAN)', price: 420, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'wan2', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'RouterOS-like 7.14' },
  { id: 'access-point', kind: 'access-point', name: 'Wi-Fi Access Point', price: 90, interfaces: [{ name: 'wifi0', kind: 'wifi' }], firmware: 'AirOS 4.0' },
  { id: 'firewall', kind: 'firewall', name: 'Firewall Appliance', price: 350, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }, { name: 'eth1', kind: 'ethernet' }], firmware: 'pfWall 2.7' },
  { id: 'ups', kind: 'ups', name: 'UPS 600VA', price: 70, interfaces: [], firmware: 'n/a' },
];

export function catalogAsRecord(): Record<string, DeviceDef> {
  return Object.fromEntries(DEVICE_CATALOG.map((def) => [def.id, def]));
}
