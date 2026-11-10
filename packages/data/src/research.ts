import type { ResearchNodeDef } from '@netcorp/sim';

/**
 * The research and technology tree (GDD v2 §18). Nodes gate capabilities,
 * not stats: every description is a new decision the player didn't have
 * before. Branch subtitles are §18's strategic choices.
 *
 * Node ids that the engine checks for live effects: `sec-hardening`
 * (outdated-firmware exploits land half as often), `sec-ids` (the spam
 * filter quarantines phish from insight 2 instead of 3), `obs-predictive`
 * (aging devices are flagged before wear kills them). The remaining nodes
 * reserve their capability until those systems arrive in later eras.
 */
export interface ResearchBranch {
  key: string;
  name: string;
  /** The strategic choice §18 assigns to this branch. */
  choice: string;
  nodes: ResearchNodeDef[];
}

export const RESEARCH_TREE: ResearchBranch[] = [
  {
    key: 'fiber',
    name: 'Fiber optics',
    choice: 'Depth of FTTH vs earlier wireless reach',
    nodes: [
      { id: 'fiber-cplus', branch: 'fiber', name: 'C+ optics', era: 'Era 2', insight: 6, cash: 2400, ticks: 12, capability: 'Buy Class C+ optics — 32 dB budgets on long runs, so you can sell reach tiers rivals cannot.', resource: 'https://en.wikipedia.org/wiki/Passive_optical_network' },
      { id: 'fiber-xgspon', branch: 'fiber', name: 'XGS-PON', era: 'Era 4', insight: 14, cash: 8000, ticks: 24, requires: 'fiber-cplus', labPrior: true, capability: 'Upgrade OLTs to XGS-PON — offer 10G residential tiers over the fiber you already laid.', resource: 'https://en.wikipedia.org/wiki/10G-PON' },
      { id: 'fiber-wdm', branch: 'fiber', name: 'WDM coexistence', era: 'Era 5', insight: 22, cash: 15000, ticks: 36, requires: 'fiber-xgspon', capability: 'Run GPON and XGS-PON on one fiber — split the plant without rebuilding it.', resource: 'https://en.wikipedia.org/wiki/Wavelength-division_multiplexing' },
    ],
  },
  {
    key: 'wireless',
    name: 'Wireless',
    choice: 'Spectrum strategy',
    nodes: [
      { id: 'wifi-gps', branch: 'wireless', name: 'GPS sync', era: 'Era 1', insight: 4, cash: 1200, ticks: 10, capability: 'Deploy GPS-synced radios — tight spectrum reuse on crowded towers.', resource: 'https://en.wikipedia.org/wiki/Time_domain_synchronized_OFDM' },
      { id: 'wifi-licensed', branch: 'wireless', name: 'Licensed backhaul', era: 'Era 3', insight: 12, cash: 6500, ticks: 20, requires: 'wifi-gps', capability: 'Bid for licensed backhaul links — guaranteed capacity to remote towers.', resource: 'https://en.wikipedia.org/wiki/Microwave_transmission' },
      { id: 'wifi-sectors', branch: 'wireless', name: 'High-capacity sectors', era: 'Era 4', insight: 18, cash: 11000, ticks: 28, requires: 'wifi-licensed', capability: 'Fit high-capacity sectors — serve 3× the subscribers per tower.', resource: 'https://en.wikipedia.org/wiki/Sector_antenna' },
    ],
  },
  {
    key: 'core',
    name: 'Core routing',
    choice: 'Independence from upstreams',
    nodes: [
      { id: 'core-te', branch: 'core', name: 'Traffic engineering', era: 'Era 2', insight: 8, cash: 3000, ticks: 14, capability: 'Steer transit traffic per-prefix — shift load before links saturate.', resource: 'https://en.wikipedia.org/wiki/Traffic_engineering_(telecommunications)' },
      { id: 'core-ixp', branch: 'core', name: 'IXP peering', era: 'Era 4', insight: 16, cash: 9000, ticks: 24, requires: 'core-te', capability: 'Settle at the IXP — local traffic leaves your upstream bills.', resource: 'https://en.wikipedia.org/wiki/Internet_exchange_point' },
      { id: 'core-bgp', branch: 'core', name: 'BGP multi-homing', era: 'Era 5', insight: 24, cash: 14000, ticks: 32, requires: 'core-ixp', capability: 'Run two upstreams with live failover — sell SLA-grade uptime.', resource: 'https://en.wikipedia.org/wiki/Multihoming' },
    ],
  },
  {
    key: 'addressing',
    name: 'Addressing',
    choice: 'Escape CGNAT; enterprise eligibility',
    nodes: [
      { id: 'addr-prefix', branch: 'addressing', name: 'Prefix planning', era: 'Era 1', insight: 4, cash: 900, ticks: 8, capability: 'Plan address space deliberately instead of renting scraps.', resource: 'https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing' },
      { id: 'addr-ipv6', branch: 'addressing', name: 'IPv6 dual-stack program', era: 'Era 3', insight: 20, cash: 7500, ticks: 30, requires: 'addr-prefix', capability: 'Light IPv6 dual-stack across the network — escape CGNAT and qualify for enterprise deals.', resource: 'https://en.wikipedia.org/wiki/IPv6_deployment' },
    ],
  },
  {
    key: 'automation',
    name: 'Automation',
    choice: 'Ops scalability vs hands-on control',
    nodes: [
      { id: 'auto-templates', branch: 'automation', name: 'Config templates', era: 'Era 1', insight: 5, cash: 1000, ticks: 10, capability: 'Push templated configs to managed devices — stop hand-typing VLANs.', resource: 'https://en.wikipedia.org/wiki/Configuration_management' },
      { id: 'auto-fleet', branch: 'automation', name: 'Fleet push', era: 'Era 2', insight: 10, cash: 3200, ticks: 16, requires: 'auto-templates', capability: 'Schedule firmware and config rolls across the fleet from one queue.', resource: 'https://en.wikipedia.org/wiki/Over-the-air_update' },
      { id: 'auto-runbooks', branch: 'automation', name: 'Self-healing runbooks', era: 'Era 3', insight: 18, cash: 6000, ticks: 24, requires: 'auto-fleet', capability: 'Encode repair playbooks that fire on alarms before tickets open.', resource: 'https://en.wikipedia.org/wiki/Runbook' },
    ],
  },
  {
    key: 'observability',
    name: 'Observability',
    choice: 'Fewer surprises, better SLAs',
    nodes: [
      { id: 'obs-flows', branch: 'observability', name: 'Flow analysis', era: 'Era 2', insight: 7, cash: 2200, ticks: 12, capability: 'See per-conversation flows — diagnose inside encrypted-looking noise.', resource: 'https://en.wikipedia.org/wiki/NetFlow' },
      { id: 'obs-predictive', branch: 'observability', name: 'Predictive maintenance', era: 'Era 3', insight: 15, cash: 5500, ticks: 20, requires: 'obs-flows', capability: 'Score wear on aging plant — replace it before it fails at 2 AM.', resource: 'https://en.wikipedia.org/wiki/Predictive_maintenance' },
    ],
  },
  {
    key: 'security',
    name: 'Security',
    choice: 'Risk posture',
    nodes: [
      { id: 'sec-hardening', branch: 'security', name: 'Hardening program', era: 'Era 1', insight: 6, cash: 1800, ticks: 12, capability: 'Roll hardening baselines to every router and server — outdated-firmware exploits land half as often.', resource: 'https://en.wikipedia.org/wiki/Hardening_(computing)' },
      { id: 'sec-ids', branch: 'security', name: 'IDS effectiveness', era: 'Era 2', insight: 12, cash: 4000, ticks: 18, requires: 'sec-hardening', capability: 'The catalog-purchased IDS becomes effective — the spam filter quarantines phish from insight 2 (V2.2-4.4).', resource: 'https://en.wikipedia.org/wiki/Intrusion_detection_system' },
      { id: 'sec-scrubbing', branch: 'security', name: 'Scrubbing partnerships', era: 'Era 4', insight: 20, cash: 10000, ticks: 26, requires: 'sec-ids', capability: 'Contract DDoS scrubbing — volumetric attacks stop at the scrubbing center.', resource: 'https://en.wikipedia.org/wiki/DDoS_mitigation' },
    ],
  },
  {
    key: 'business',
    name: 'Business',
    choice: 'Margin levers',
    nodes: [
      { id: 'biz-crm', branch: 'business', name: 'CRM depth', era: 'Era 1', insight: 4, cash: 1500, ticks: 8, capability: 'Track every lead to install — see churn risk before renewal.', resource: 'https://en.wikipedia.org/wiki/Customer_relationship_management' },
      { id: 'biz-pricing', branch: 'business', name: 'Dynamic pricing', era: 'Era 2', insight: 10, cash: 3000, ticks: 14, requires: 'biz-crm', capability: 'Reprice packages per cluster, weekly.', resource: 'https://en.wikipedia.org/wiki/Dynamic_pricing' },
      { id: 'biz-wholesale', branch: 'business', name: 'Wholesale products', era: 'Era 3', insight: 16, cash: 6500, ticks: 20, requires: 'biz-pricing', capability: 'Sell wholesale transit to small ISPs.', resource: 'https://en.wikipedia.org/wiki/Internet_transit' },
    ],
  },
];

/** The tree flattened to nodes, for injection into the World (sim rule source). */
export function researchNodesAsList(): ResearchNodeDef[] {
  return RESEARCH_TREE.flatMap((branch) => branch.nodes);
}
