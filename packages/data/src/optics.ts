import type { ModuleDef } from '@netcorp/sim';

/**
 * Pluggable optics catalog (GDD §11, device-and-incident-architecture §5):
 * SFP modules keyed to the reach tiers the research tree sells. Reach limits
 * live in the sim (REACH_LIMITS); here it's the shopping list — price, medium,
 * and how far the class covers on the board.
 *
 * Era gating: 'era' marks when the class becomes purchasable. The client
 * checks the era-research node via the sim's hasResearch() before offering a
 * module; the engine's installModule re-checks nothing era-related (the
 * purchase price is the gate), but the client hides gated modules until the
 * node is owned.
 */
export const MODULE_CATALOG: Record<string, ModuleDef> = {
  'optics-bplus': {
    id: 'optics-bplus',
    name: 'B+ optics (short reach)',
    price: 180,
    medium: 'fiber',
    reachClass: 'short',
  },
  'optics-cplus': {
    id: 'optics-cplus',
    name: 'C+ optics (long reach)',
    price: 480,
    medium: 'fiber',
    reachClass: 'long',
  },
  'optics-xgs': {
    id: 'optics-xgs',
    name: 'XGS optics (metro reach)',
    price: 1200,
    medium: 'fiber',
    reachClass: 'xgs',
  },
  'optics-copper': {
    id: 'optics-copper',
    name: 'Copper SFP (1G RJ45)',
    price: 60,
    medium: 'copper',
    reachClass: 'short',
  },
};
