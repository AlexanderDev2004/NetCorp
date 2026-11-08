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
