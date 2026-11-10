# Device & Incident Architecture Proposal

Status: Phase 0 companion to `cisco-packet-tracer-research.md`. No implementation. Conceptual module design over the **existing** sim core — no rewrite, no second engine.
Tags: VERIFIED (code-audited this session) / PROPOSED / ASSUMPTION.

## 1. Existing architecture (verified — the substrate everything extends)

- `packages/sim`: pure, deterministic, tick-based; `World` state; all player actions are commands in `applyCommand`, consequences are events in `world.log`; seeded PRNG in `world.rngState`; no DOM/IO.
- `packages/data`: `DEVICE_CATALOG`, `FIRMWARE_UPDATES` (per-defId vendor channel), `RESEARCH_TREE`, `EXPERIMENT_TEMPLATES`, mail/proposal/spam templates, scenarios.
- `apps/client`: canvas board + panels; renders state, forwards commands only.
- Existing types that matter here: `DeviceDef`, `Device` (with `uptimeTicks`/`firmware`/`compromised?`/`failed?`), `Interface` (kind, ipv4, enabled), `Link` (media label), `DeviceConfig`, and the incident commands `triggerIncident{rogue-dhcp|outdated-firmware|wear-failure}`.

Principle: **each new module below is a new data schema + one evaluator in the engine — not a new subsystem.**

## 2. Module map (conceptual)

| Proposed module | Home | Shape |
|---|---|---|
| Device Registry / Specs | packages/data (schemas) + types.ts | Extended `DeviceDef`, `ModuleDef`, `InterfaceKind` |
| Hardware Module Registry | packages/data | `MODULES: Record<string, ModuleDef>`; DeviceDef lists slot types |
| Connection Compatibility | packages/sim/net.ts | pure function `linkCompatible(a, b, media) → ok \| reason` |
| Device Lifecycle | packages/sim/engine.ts | new commands (`scheduleMaintenance`, `backupConfig`, `powerCycle`) + per-tick wear (exists) |
| Incident Engine | packages/sim/incidents.ts (new file) | data-driven precondition evaluator |
| Diagnostic Engine | packages/sim (extends net.ts probe paths) | probe tools priced by test-gear ownership |
| Monitoring Engine | packages/sim/monitoring.ts (new file) | telemetry sampling gated by placed monitoring devices |
| Security / Vulnerability Registry / Threat Simulation / Mitigation | packages/data (`ADVISORIES`, `ATTACK_EVENTS`) + engine case handlers | per GDD v2.2 V2.2-4.4; PT grounding per cybersecurity proposal |

There is no "Threat Engine package" and no UI-independent/UI split change — the sim stays UI-free; the client keeps rendering state.

## 3. Data-driven device definitions (schema sketch)

```ts
// packages/sim/src/types.ts — additive
export type InterfaceKind = 'ethernet' | 'wifi' | 'sfp' | 'console'; // 'wan' becomes a role, not a kind
export interface InterfaceSpec { name: string; kind: InterfaceKind; role?: 'uplink'; moduleSlot?: boolean }
export interface ModuleDef {          // SFP-class pluggables (GDD §11 optics tiers)
  id: string; name: string; price: number;
  medium: 'copper' | 'fiber';
  reachClass: 'short' | 'long' | 'xgs';   // maps to B+/C+/XGS dB budgets (data values, not physics claims)
  era?: number;
}
export interface DeviceDef {
  // …existing fields…
  interfaces: InterfaceSpec[];        // was {name, kind}[] — name+kind preserved for migration
  slots?: { accepts: ModuleDef['medium'][] }[];  // typed expansion slots
  powerDrawW?: number;                // balancing value (GDD §11 lists it; sim can ignore at MVP)
}
```

Migration (ASSUMPTION): `wireLink` keeps accepting any-to-any in Phase 1 but emits an `event` when `linkCompatible` fails; enforcement toggles on in Phase 2 once scenarios are updated. Old boards keep working.

## 4. Data-driven incident definitions

The engine today has three hardcoded incident kinds. The taxonomy (companion doc) needs ~20 causes; hardcoding each as a command would be 20 switch branches — instead, one command + data:

```ts
export interface IncidentDef {
  id: string;                        // 'fiber-cut-dig', 'olt-card-failure', 'dns-poisoning', …
  class: 'physical' | 'datalink' | 'network' | 'service' | 'isp' | 'security';
  preconditions: PreconditionExpr[]; // evaluated against World; roll selects timing among qualifiers only (GDD §15.2)
  onset: {                           // deterministic state mutations given the qualifier set
    mutate: EffectSpec[];            // e.g. setInterfaceDown(link), setFailed(device), addMaliciousLoad(flow)
  };
  symptoms: SymptomSpec[];           // which tickets/probe failures it produces (symptom-language only)
  diagnosisHints: { probe: string; requiresGear?: string }[];   // OTDR etc. from the catalog proposal
  repairs: RepairSpec[];             // commands that clear it + cost/time/spares
}
```

`PreconditionExpr` is a small typed predicate DSL (`deviceFailed`, `utilizationAbove`, `weatherOverRoute`, `firmwareOutdated`, `noBackupPower`, …) — each predicate is itself a pure function over `World`, unit-testable in isolation (GDD §6.3 testability rule). Randomness enters only at *timing* selection over qualifiers, preserving replay determinism.

The three existing `triggerIncident` kinds become the first three `IncidentDef` entries — same behavior, new representation (verified against current engine behavior during implementation).

Security attacks reuse the same record shape with the v2.2 §E extension fields (`attack_class`, `exploitation_relationship`, …) — **one resolver, one attribution path**, no parallel system.

## 5. Monitoring & advisory data (sketch)

```ts
// packages/data — advisories per cybersecurity proposal §2 (fictional namespace)
export interface AdvisoryDef {
  id: string;                        // 'NC-ADV-26-3312' — never a real CVE format
  affected: { defIds: string[]; firmwareVersions: string[] };  // PT Cyber Observer's model+firmware matching, VERIFIED
  severity: { score: number; band: 'low'|'medium'|'high'|'critical' }; // CVSS-B-like display value
  knownExploited?: boolean;          // KEV-like signal
  patch?: { version: string; notes: string };
}
```

Asset resolution is a pure query: devices whose `defId`+`firmware` match → affected set; `updateFirmware` re-resolves and clears (the PT loop). Priority is computed at display time from exposure (topology-derived) per V2.2-4.4 §A — never stored as a CVSS replacement.

## 6. Engine integration points (verified locations)

- Wear/failure: `dailyWearChance`/`wearFailureChance` (engine) — maintenance windows modify the hazard window; no new wear system.
- Firmware: `firmwareChannels` + `updateFirmware` — advisories read these; patch-failure risk adds a roll *inside the existing command*, not a new command.
- Path/probe: `hasL2Path`/`findPath` already report break location+reason — diagnostics price/limit probes by test gear at the client call site.
- Attribution: existing per-device→customer mapping used by tickets/reputation — incidents must reuse it (v2.2 §E no-double-count rule).

## 7. Complexity & risk register

| Risk | Mitigation |
|---|---|
| Precondition DSL grows into a scripting language | Keep to a fixed predicate set; new predicate = new PR with unit test |
| Interface-kind migration breaks saved scenarios | Warning-only Phase 1; enforcement behind scenarios update |
| Monitoring engine per-tick cost | Sample per tick into buckets (GDD §6.4 already budgets this); no per-packet anything |
| Security incidents duplicating incident logic | One record type; §E fields optional |
| Balance data invented | All rates/thresholds marked balancing values in packages/data, per GDD §26 reality-check discipline |

## 8. What we are NOT doing (scope fences)

No packet simulation (GDD §6.2). No per-port error statistics (PT deliberately skips them; degradation surfaces via monitoring). No new packages/workspaces. No UI framework changes. No GDD edits — conflicts are reported in the research report §14 instead.
