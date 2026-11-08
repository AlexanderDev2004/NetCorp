/**
 * Vendor personalities (GDD §4.2). Firmware channel strings feed the CVE feed
 * (GDD §10); vendors do not strictly dominate each other.
 */
export interface VendorProfile {
  id: string;
  name: string;
  /** 0–1. Affects future wear/failure rolls. */
  reliability: number;
  /** 0–1. Affects how often firmware updates ship. */
  firmwareCadence: number;
  priceIndex: number;
  blurb: string;
}

export const VENDORS: VendorProfile[] = [
  {
    id: 'novabit',
    name: 'Novabit',
    reliability: 0.8,
    firmwareCadence: 0.7,
    priceIndex: 1.0,
    blurb: 'The safe default. Boring, dependable, occasionally overpriced.',
  },
  {
    id: 'valkynet',
    name: 'ValkyNet',
    reliability: 0.65,
    firmwareCadence: 0.9,
    priceIndex: 0.85,
    blurb: 'Aggressive firmware releases. Their changelogs are adventure stories.',
  },
  {
    id: 'osram-node',
    name: 'Osram Node',
    reliability: 0.55,
    firmwareCadence: 0.15,
    priceIndex: 0.7,
    blurb: 'Great hardware, abandoned firmware. A CVE magnet in year two.',
  },
  {
    id: 'bytemill',
    name: 'ByteMill',
    reliability: 0.5,
    firmwareCadence: 0.5,
    priceIndex: 0.5,
    blurb: 'Dirt cheap. Sometimes it even matters. The used-market favorite.',
  },
];
