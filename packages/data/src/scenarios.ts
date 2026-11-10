/** Scenarios (GDD §11 sandboxes + career start). Data, not code. */
export interface Scenario {
  id: string;
  name: string;
  brief: string;
  /** Seed for the deterministic sim. */
  seed: number;
  startingCash: number;
}

export const CAREER_START: Scenario = {
  id: 'career-garage',
  name: 'The Garage',
  brief:
    'You have $400, a desk, and a dial-up ISP account. Build the first LAN, keep it up, and answer your first ticket.',
  seed: 1337,
  startingCash: 400,
};

export const SANDBOXES: Scenario[] = [
  {
    id: 'sandbox-subnetting',
    name: 'Sandbox: Subnetting',
    brief: 'Split one /24 into two office subnets so the guest Wi-Fi stops seeing the file server.',
    seed: 2024,
    startingCash: 1000,
  },
];

/**
 * Board Prototype v0.1: the sample topology PC-A → Switch-A → Router-A →
 * Server-A. Router and Server are pre-configured; PC-A boots unconfigured —
 * the player's first job is to give it an address and make the first ping
 * succeed. Pure data: the client maps this to place/wire/configure commands.
 */
export interface StarterIfaceConfig {
  interfaceName: string;
  address: string;
  prefix: number;
  gateway?: string;
}

export interface StarterDevice {
  defId: string;
  name: string;
  x: number;
  y: number;
  interfaces?: StarterIfaceConfig[];
  routes?: { destinationCidr: string; gateway?: string; metric: number }[];
}

export interface StarterLink {
  /** Device *name* + interface name on each end; ids are assigned by the sim. */
  a: { deviceName: string; interfaceName: string };
  b: { deviceName: string; interfaceName: string };
}

export interface ScenarioTopology {
  devices: StarterDevice[];
  links: StarterLink[];
}

export const BOARD_PROTOTYPE: Scenario = {
  id: 'board-prototype',
  name: 'Board Prototype: First Ping',
  brief:
    'Inspect the wired topology, configure PC-A (192.168.10.10/24, gateway 192.168.10.1), then ping the server at 10.20.0.100. Break it on purpose — disable an interface, mistype a mask — and watch the diagnostics explain why.',
  seed: 4242,
  startingCash: 1500,
};

export const BOARD_PROTOTYPE_TOPOLOGY: ScenarioTopology = {
  devices: [
    { defId: 'desktop', name: 'PC-A', x: 110, y: 330 },
    { defId: 'switch-unmanaged', name: 'Switch-A', x: 300, y: 330 },
    {
      defId: 'router-soho',
      name: 'Router-A',
      x: 500,
      y: 330,
      interfaces: [
        { interfaceName: 'eth0', address: '192.168.10.1', prefix: 24 },
        { interfaceName: 'eth1', address: '10.20.0.1', prefix: 24 },
      ],
      routes: [{ destinationCidr: '0.0.0.0/0', metric: 1 }],
    },
    {
      defId: 'server',
      name: 'Server-A',
      x: 620,
      y: 330,
      interfaces: [{ interfaceName: 'eth0', address: '10.20.0.100', prefix: 24, gateway: '10.20.0.1' }],
    },
  ],
  links: [
    { a: { deviceName: 'PC-A', interfaceName: 'eth0' }, b: { deviceName: 'Switch-A', interfaceName: 'eth0' } },
    { a: { deviceName: 'Switch-A', interfaceName: 'eth1' }, b: { deviceName: 'Router-A', interfaceName: 'eth0' } },
    { a: { deviceName: 'Router-A', interfaceName: 'eth1' }, b: { deviceName: 'Server-A', interfaceName: 'eth0' } },
  ],
};
