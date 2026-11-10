import type { DeviceKind, ExperimentTemplate } from '@netcorp/sim';

export type ExperimentTemplateDef = ExperimentTemplate;

/**
 * Bench experiment templates (GDD v2.2 §V2.2-3.5). The player states a falsifiable
 * hypothesis — a predicted value with a tolerance — and the sim measures around
 * `trueValue` with a noise band narrowed by repetitions. Reading the result
 * correctly pays full insight whether or not the prediction was right; a correct,
 * full-validity run of a template with `grantsPrior` earns a −20% Insight discount
 * on that research node (once per node, EARNED here — not free at start).
 */
export const EXPERIMENT_TEMPLATES: ExperimentTemplate[] = [
  {
    id: 'exp-split-loss',
    name: '1:32 split at 4 km',
    metric: 'Rx power at the far end of a 1:32 split, 4 km of fiber',
    unit: ' dBm',
    baseInsight: 12,
    requiresKind: 'server',
    trueValue: -27.2,
    noiseBand: 0.5,
    grantsPrior: 'fiber-xgspon',
  },
  {
    id: 'exp-gps-skew',
    name: 'GPS sync skew across a tower',
    metric: 'Timing offset between sector radios',
    unit: ' µs',
    baseInsight: 8,
    requiresKind: 'access-point',
    trueValue: 1.8,
    noiseBand: 0.4,
  },
  {
    id: 'exp-queue-depth',
    name: 'Router queue depth at peak',
    metric: 'P99 queue occupancy on the edge router',
    unit: ' packets',
    baseInsight: 10,
    requiresKind: 'router-edge',
    trueValue: 42,
    noiseBand: 6,
    grantsPrior: 'core-te',
  },
  {
    id: 'exp-dns-cold',
    name: 'Resolver cold-cache latency',
    metric: 'Cold-cache resolve time through the lab resolver',
    unit: ' ms',
    baseInsight: 8,
    requiresKind: 'server',
    trueValue: 23,
    noiseBand: 4,
  },
  {
    id: 'exp-ups-transfer',
    name: 'UPS transfer time on mains failure',
    metric: 'Inverter switch-over time',
    unit: ' ms',
    baseInsight: 7,
    requiresKind: 'ups',
    trueValue: 8,
    noiseBand: 1.5,
  },
];
