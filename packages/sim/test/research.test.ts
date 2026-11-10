import { beforeEach, describe, expect, it } from 'vitest';
import { advanceTicks, applyCommand, createWorld, deliverMail, firmwareIncidentDue, hasResearch, researchCost } from '../src';
import type { DeviceCatalog, ExperimentTemplate, ResearchNodeDef, World } from '../src';

const catalog: DeviceCatalog = {
  desktop: { id: 'desktop', kind: 'desktop', name: 'Desktop', price: 300, interfaces: [{ name: 'eth0', kind: 'ethernet' }], firmware: 'os 1.0' },
  'router-soho': { id: 'router-soho', kind: 'router-soho', name: 'SOHO Router', price: 80, interfaces: [{ name: 'wan1', kind: 'wan' }, { name: 'eth0', kind: 'ethernet' }], firmware: 'router 7.14' },
  ups: { id: 'ups', kind: 'ups', name: 'UPS', price: 70, interfaces: [], firmware: 'n/a' },
};

/** Mirrors the content layer's ids the engine checks for live effects. */
const NODES: ResearchNodeDef[] = [
  { id: 'sec-hardening', branch: 'security', name: 'Hardening program', era: 'Era 1', insight: 6, cash: 1800, ticks: 12, capability: 'Hardening baselines.' },
  { id: 'sec-ids', branch: 'security', name: 'IDS effectiveness', era: 'Era 2', insight: 12, cash: 4000, ticks: 18, requires: 'sec-hardening', capability: 'IDS effective.' },
  { id: 'obs-predictive', branch: 'observability', name: 'Predictive maintenance', era: 'Era 3', insight: 15, cash: 5500, ticks: 20, capability: 'Flag aging plant.' },
  { id: 'fiber-xgspon', branch: 'fiber', name: 'XGS-PON', era: 'Era 4', insight: 14, cash: 8000, ticks: 24, labPrior: true, capability: '10G tiers.' },
  { id: 'biz-crm', branch: 'business', name: 'CRM depth', era: 'Era 1', insight: 4, cash: 1500, ticks: 8, capability: 'Churn risk.' },
];

let world: World;

/** Starts and runs the real project loop; use for flow tests. */
function runProject(id: string): void {
  const node = NODES.find((n) => n.id === id);
  if (node === undefined) throw new Error(`unknown node ${id}`);
  world.insight = node.insight + 10;
  world.cash = node.cash + 10000;
  applyCommand(world, { type: 'startResearch', nodeId: id });
  advanceTicks(world, node.ticks);
}

beforeEach(() => {
  world = createWorld(1234, catalog);
  world.researchNodes = NODES;
});

describe('research tree (GDD §18)', () => {
  it('starts a project: deducts insight and cash, sets the active node', () => {
    world.insight = 20;
    world.cash = 5000;
    applyCommand(world, { type: 'startResearch', nodeId: 'biz-crm' });
    expect(world.research.active).toEqual({ nodeId: 'biz-crm', remaining: 8 });
    expect(world.insight).toBe(16);
    expect(world.cash).toBe(3500);
    expect(world.research.completed).toHaveLength(0);
  });

  it('refuses a second project while the lab is busy', () => {
    world.insight = 100;
    world.cash = 100000;
    applyCommand(world, { type: 'startResearch', nodeId: 'biz-crm' });
    applyCommand(world, { type: 'startResearch', nodeId: 'sec-hardening' });
    expect(world.research.active?.nodeId).toBe('biz-crm');
    expect(world.log.at(-1)?.level).toBe('warn');
    expect(world.log.at(-1)?.text).toContain('one at a time');
  });

  it('refuses a node whose prerequisite is not researched', () => {
    world.insight = 100;
    world.cash = 100000;
    applyCommand(world, { type: 'startResearch', nodeId: 'sec-ids' });
    expect(world.research.active).toBeUndefined();
    expect(world.log.at(-1)?.text).toContain('prerequisite');
  });

  it('refuses a project the player cannot afford', () => {
    world.insight = 2;
    world.cash = 10;
    applyCommand(world, { type: 'startResearch', nodeId: 'biz-crm' });
    expect(world.research.active).toBeUndefined();
    expect(world.log.at(-1)?.text).toContain('insight');
  });

  it('refuses to repeat a completed project', () => {
    runProject('biz-crm');
    applyCommand(world, { type: 'startResearch', nodeId: 'biz-crm' });
    expect(world.log.at(-1)?.text).toContain('already researched');
  });

  it('completes a project after its ticks and unlocks the capability', () => {
    runProject('sec-hardening');
    expect(world.research.completed).toContain('sec-hardening');
    expect(world.research.active).toBeUndefined();
    expect(hasResearch(world, 'sec-hardening')).toBe(true);
    const line = world.log.find((e) => e.text.includes('Hardening program researched'));
    expect(line?.text).toContain('Hardening baselines');
  });

  it('progresses one tick at a time', () => {
    world.insight = 20;
    world.cash = 5000;
    applyCommand(world, { type: 'startResearch', nodeId: 'biz-crm' });
    advanceTicks(world, 3);
    expect(world.research.active).toEqual({ nodeId: 'biz-crm', remaining: 5 });
    advanceTicks(world, 5);
    expect(world.research.completed).toContain('biz-crm');
  });

  it('applies the lab-prior discount (V2.2-3.5): 14 insight → 11, once', () => {
    const node = NODES.find((n) => n.id === 'fiber-xgspon')!;
    expect(node.labPrior).toBe(true);
    // Without the prior the node costs full price — the discount is earned in the lab, not granted for free.
    expect(researchCost(node, [], []).insight).toBe(14);
    // A prior earned by a lab experiment discounts it by 20%: 14 → 11.
    expect(researchCost(node, ['fiber-xgspon'], []).insight).toBe(11);
    world.research.labPriorsGranted.push('fiber-xgspon');
    world.insight = 11;
    world.cash = 8000;
    applyCommand(world, { type: 'startResearch', nodeId: 'fiber-xgspon' });
    expect(world.insight).toBe(0);
    // The discount is consumed: the same node would cost full price again.
    expect(world.research.labPriorsUsed).toContain('fiber-xgspon');
    expect(researchCost(node, [], world.research.labPriorsUsed).insight).toBe(14);
  });

  it('IDS effectiveness lowers the phish quarantine threshold from insight 3 to 2', () => {
    world.insight = 2;
    const before = deliverMail(world, { from: 'a', subject: 's', body: 'b', kind: 'phish' });
    expect(before.quarantined).toBe(false);
    world.mail = [];
    world.research.completed.push('sec-ids');
    const after = deliverMail(world, { from: 'a', subject: 's', body: 'b', kind: 'phish' });
    expect(after.quarantined).toBe(true);
  });

  it('hardening halves the ambient exploit gate', () => {
    const hardened = createWorld(1, catalog);
    hardened.researchNodes = NODES;
    hardened.research.completed.push('sec-hardening');
    // Find a roll value the unhardened gate (% 4) passes and the hardened
    // gate (% 8) fails — proving the halved hit rate on the same roll.
    for (let s = 1; s < 5000; s++) {
      world.rngState = s;
      hardened.rngState = s;
      if (firmwareIncidentDue(world) && !firmwareIncidentDue(hardened)) return;
    }
    throw new Error('no roll distinguishes the gates in 5000 tries');
  });

  it('predictive maintenance flags aging devices once, before wear kills them', () => {
    world.cash = 10000;
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'pc1', x: 0, y: 0 });
    const pc = Object.values(world.devices)[0]!;
    pc.uptimeTicks = 7 * 24 - 1; // wear onset is day 7; the chance is still 0 there
    world.research.completed.push('obs-predictive');
    world.tick = 47;
    advanceTicks(world, 1); // tick 48 — the daily wear window
    expect(world.research.predictiveFlags).toContain(pc.id);
    expect(world.log.filter((e) => e.text.includes('predictive maintenance flags'))).toHaveLength(1);
    advanceTicks(world, 24);
    expect(world.log.filter((e) => e.text.includes('predictive maintenance flags'))).toHaveLength(1);
    expect(pc.failed ?? false).toBe(false);
  });
});

/** Places a real device of the given kind on the board so the bench covers it. */
function placeDevice(kind: keyof DeviceCatalog & string): string {
  world.cash = 100000;
  applyCommand(world, { type: 'placeDevice', defId: kind, name: `bench-${kind}`, x: 0, y: 0 });
  const device = Object.values(world.devices).at(-1);
  if (device === undefined) throw new Error(`device of kind ${kind} was not placed`);
  return device.id;
}

const TEMPLATES: ExperimentTemplate[] = [
  {
    id: 'exp-optics',
    name: '1:32 split at 4 km',
    metric: 'Rx power',
    unit: ' dBm',
    baseInsight: 12,
    trueValue: -27.2,
    noiseBand: 0.5,
    grantsPrior: 'fiber-xgspon',
  },
  {
    id: 'exp-bench-only',
    name: 'UPS transfer time',
    metric: 'Switch-over time',
    unit: ' ms',
    baseInsight: 7,
    requiresKind: 'ups',
    trueValue: 8,
    noiseBand: 1.5,
    grantsPrior: 'fiber-xgspon',
  },
];

describe('lab experiments (V2.2-3.5)', () => {
  beforeEach(() => {
    world.experiments = TEMPLATES;
  });

  function run(templateId: string, predicted: number, tolerance: number, repetitions: number): void {
    applyCommand(world, { type: 'runExperiment', templateId, predicted, tolerance, repetitions });
  }

  it('rejects a vague hypothesis — tolerance must be positive', () => {
    run('exp-optics', -27, 0, 3);
    expect(world.lab.records).toHaveLength(0);
    expect(world.log.at(-1)?.level).toBe('warn');
    expect(world.log.at(-1)?.text).toContain('tolerance');
  });

  it('rejects unknown templates and out-of-range repetitions', () => {
    run('no-such-template', -27, 0.5, 3);
    expect(world.lab.records).toHaveLength(0);
    run('exp-optics', -27, 0.5, 0);
    expect(world.lab.records).toHaveLength(0);
    run('exp-optics', -27, 0.5, 13);
    expect(world.lab.records).toHaveLength(0);
    expect(world.log.at(-1)?.text).toContain('repetitions');
  });

  it('marks a run reduced validity when the bench lacks the right equipment', () => {
    // No ups on the board yet: the run still happens, but the reading is soft.
    run('exp-bench-only', 8, 2, 6);
    const record = world.lab.records[0]!;
    expect(record.validity).toBe('reduced');
    expect(world.log.at(-1)?.text).toContain('bench');
    // Reading a reduced-validity result correctly pays half the base reward.
    applyCommand(world, { type: 'interpretExperiment', recordId: record.id, conclusion: 'confirmed' });
    expect(record.interpretation).toBe('correct');
    expect(record.rewardInsight).toBe(4); // round(7 × 0.5)
  });

  it('accepts a run once a device of the required kind sits on the board', () => {
    placeDevice('ups');
    run('exp-bench-only', 8, 2, 4);
    expect(world.lab.records).toHaveLength(1);
    expect(world.lab.records[0]!.validity).toBe('full');
  });

  it('pays full insight for a correct reading, half on reduced validity', () => {
    placeDevice('ups');
    run('exp-bench-only', 8, 2, 6);
    const record = world.lab.records[0]!;
    expect(record.validity).toBe('full');
    expect(record.conclusive).toBe(true);
    applyCommand(world, { type: 'interpretExperiment', recordId: record.id, conclusion: 'confirmed' });
    expect(record.interpretation).toBe('correct');
    expect(record.rewardInsight).toBe(7);
    expect(world.insight).toBe(7);
  });

  it('pays nothing for misreading a conclusive result', () => {
    placeDevice('ups');
    run('exp-bench-only', 8, 2, 6);
    const record = world.lab.records[0]!;
    applyCommand(world, { type: 'interpretExperiment', recordId: record.id, conclusion: 'refuted' });
    expect(record.interpretation).toBe('wrong');
    expect(record.rewardInsight).toBe(0);
    expect(world.insight).toBe(0);
  });

  it('an inconclusive run must be rerun once with more repetitions', () => {
    placeDevice('ups');
    // 1 repetition keeps the band wide relative to the tolerance, so a rerun is forced.
    run('exp-bench-only', 8, 0.5, 1);
    const first = world.lab.records[0]!;
    expect(first.conclusive).toBe(false);
    expect(first.rewardInsight).toBeUndefined();
    // Rerunning with the same (or fewer) repetitions is refused.
    applyCommand(world, { type: 'runExperiment', templateId: 'exp-bench-only', predicted: 8, tolerance: 0.5, repetitions: 1 });
    expect(world.lab.records).toHaveLength(1);
    expect(world.log.at(-1)?.text).toContain('rerun');
    // 9 repetitions narrows the band to ±0.5 ms, exactly meeting the tolerance.
    applyCommand(world, { type: 'runExperiment', templateId: 'exp-bench-only', predicted: 8, tolerance: 0.5, repetitions: 9 });
    expect(world.lab.records).toHaveLength(2);
    expect(world.lab.records[1]!.conclusive).toBe(true);
  });

  it('a correct full-validity run grants the lab prior once', () => {
    placeDevice('ups');
    run('exp-bench-only', 8, 2, 6);
    const record = world.lab.records[0]!;
    applyCommand(world, { type: 'interpretExperiment', recordId: record.id, conclusion: 'confirmed' });
    expect(world.research.labPriorsGranted).toContain('fiber-xgspon');
    // A rerun of the same template may only pay insight — the prior is already banked.
    applyCommand(world, { type: 'runExperiment', templateId: 'exp-bench-only', predicted: 8, tolerance: 2, repetitions: 6 });
    const second = world.lab.records[1]!;
    expect(second.duplicate).toBe(true);
  });

  it('a duplicate pays 10% of the base reward instead of full price', () => {
    placeDevice('ups');
    run('exp-bench-only', 8, 2, 6);
    const first = world.lab.records[0]!;
    applyCommand(world, { type: 'interpretExperiment', recordId: first.id, conclusion: 'confirmed' });
    expect(world.insight).toBe(7);
    // The template class is already known conclusive, so a second run auto-resolves
    // as a duplicate: concluded on arrival at the 10% reward, no reading needed.
    applyCommand(world, { type: 'runExperiment', templateId: 'exp-bench-only', predicted: 8, tolerance: 2, repetitions: 6 });
    const dup = world.lab.records[1]!;
    expect(dup.duplicate).toBe(true);
    expect(dup.rewardInsight).toBe(1);
    expect(world.insight).toBe(8);
  });

  it('the interpretation is graded against the measurement, not the ground truth', () => {
    placeDevice('ups');
    // Predict far off but within a wide tolerance: confirming is still "correct".
    run('exp-bench-only', 12, 5, 9);
    const record = world.lab.records[0]!;
    expect(record.conclusive).toBe(true);
    expect(Math.abs(record.measurement - 12)).toBeLessThanOrEqual(5);
    applyCommand(world, { type: 'interpretExperiment', recordId: record.id, conclusion: 'confirmed' });
    expect(record.interpretation).toBe('correct');
    expect(record.rewardInsight).toBe(7);
  });
});
