# Device Simulation Roadmap

Status: Phase 0 companion to `cisco-packet-tracer-research.md` — for review, not implementation. Adjusts the brief's suggested phases to what the repository actually contains (audit in research notes; current head: waves 1–36, 155 tests green).
Tags: VERIFIED / PROPOSED / ASSUMPTION.

Ordering principle: every phase extends the existing command/event sim core; each phase's DoD is testable in `packages/sim/test/` and visible on the existing board UI. Complexity: S/M/L/XL.

---

## Phase 0 — Research & audit (this document set)

- Scope: PT documentation research, repo audit, feature matrix, architecture proposal, taxonomy, roadmap.
- Deliverables: the six docs in `docs/research/`, `docs/architecture/`, `docs/roadmap/`.
- DoD: reviewed and accepted by you; conflicts reported (research report §14) resolved or deferred explicitly.
- Complexity: S (done — awaiting review).

## Phase 1 — Device Registry (interfaces, modules, compatibility)

- Scope: `InterfaceKind` extension (`sfp` slot kind, `role: 'uplink'`), `ModuleDef` (optics tiers B+/C+/XGS as data), `linkCompatible` evaluator, catalog additions (switch port-count variants first). Compatibility is **warning-only** on the inspector this phase.
- Deliverables: types + data + `wireLink` event warnings; inspector shows slot state; board renders link media color from endpoints' modules.
- Dependencies: none beyond current types.
- Test requirements: `linkCompatible` truth table (per matrix row in the research report §4); module purchase/install commands; determinism of compatibility evaluation.
- DoD: placing a C+ module on one end and B+ on the other of a "long" link produces a warning event; typecheck+tests+build green.
- Complexity: M.
- Gameplay value: optics tiers become physical purchases (GDD §11's dB-budget tradeoff made real).

## Phase 2 — Device Lifecycle (windows, backup, patch risk)

- Scope: maintenance windows (schedule → reduced SLA penalty + allowed disruption), config backup as purchasable practice + rollback verb, firmware patch failure risk inside `updateFirmware`, power-cycle verb (clears transient state, unsaved-config rule if adopted), warm-spare pre-staging.
- Deliverables: `scheduleMaintenance`, `backupConfig`, `powerCycle` commands; hazard-model hook for "preventive maintenance reduces failure probability for a window" (v2.2 §V2.2-4.2 maintenance types — corrective exists, preventive joins).
- Dependencies: Phase 1 for chassis/module swap actions.
- Test requirements: window scheduling math (penalty reduction), backup→failure→restore flow, patch-failure roll determinism (seeded), preventive-maintenance hazard reduction.
- DoD: the v2.2 §V2.2-4.2 "PM ROI" story is playable: skip PM → failure; buy PM → the failure that didn't happen shows in incident correlation.
- Complexity: M.
- Note (rule 10/11): existing repair/replace/trade-in economy untouched — windows wrap it.

## Phase 3 — Network Incidents (data-driven engine)

- Scope: `IncidentDef` engine (architecture doc §4) with the taxonomy's first tranche: physical class (fiber cut, splice degradation, port failure) + network class (subnet misconfig, DHCP pool exhaustion, missing route, upstream session failure) + service class (DNS resolver failure). Existing 3 incident kinds migrate to `IncidentDef` records.
- Deliverables: `packages/sim/incidents.ts`, `INCIDENT_DEFS` in packages/data, ticket symptom-language generation (existing ticket system reused).
- Dependencies: Phase 1 (media/link state for physical causes); test-gear purchases gate diagnosis speed.
- Test requirements: each incident def: qualifier-only firing (no precondition → never fires), deterministic timing under seed, symptom emission, repair clears state, customer attribution matches topology.
- DoD: a fiber cut on the board prototype produces tickets for every customer on the tree, OTDR (if owned) localizes it, repair restores, postmortem grants insight (existing flow §15.3).
- Complexity: L.

## Phase 4 — Monitoring (telemetry, alerts, correlation)

- Scope: monitoring server device (purchasable, placed, powered — GDD §14.2 "build, not a HUD"); telemetry toggles per device (health poll + trap-like events: link-down, reboot, auth-failure); syslog-ish event channel into the existing console; threshold config; silence-detection for dead devices.
- Deliverables: `monitoring.ts` evaluator + `MONITORING_DEFS`; NOC alert feed sourced *only* from player's own stack.
- Dependencies: Phase 3 (alerts reference incidents); benefits from Phase 2 (degradation signals).
- Test requirements: blind-spot rules (no server/telemetry off → no alert), trap vs silence distinction, per-tick sampling stays within GDD §6.4 budget.
- DoD: with no monitoring, the Phase 3 fiber cut is discovered by customer tickets; with monitoring, an alert precedes the first ticket by N ticks.
- Complexity: M.

## Phase 5 — Cybersecurity (per GDD v2.2 V2.2-4.4)

- Scope: advisory registry with fictional `NC-ADV-*` namespace (and rename of the two existing CVE-format strings in `FIRMWARE_UPDATES`/starter mail), model+firmware asset resolution + auto-clear on patch (PT Cyber Observer loop, VERIFIED), rogue-device discovery as monitoring capability, threat event engine per v2.2 §C, response controls table per §D, security panels per §G.
- Deliverables: `ADVISORIES`, `ATTACK_EVENTS` in packages/data; engine cases; Security Overview / Vulnerability Registry panels.
- Dependencies: Phase 4 (detection sources), Phase 2 (patch maintenance windows), existing research nodes (sec-* branch — v2.2 §F resolves branch identity).
- Test requirements: v2.2 §H test cases SEC-1…SEC-10 translated to vitest where engine-side (SEC-2/3/4/9 are the core four); advisory resolution truth table; fictional-namespace lint (no `/^CVE-/` in content).
- DoD: SEC-1 through SEC-4 pass as simulations; V2.2-4.4 §I scope fences hold.
- Complexity: XL (largest phase; spec'd in GDD, so engineering-only).

## Phase 6 — ISP Integration (business consequences)

- Scope: incidents' financial/SLA/reputation effects unified through the existing attribution (affected-customer-hours, v2 §15.5); contract-break/churn hooks for security breaches (already exist for phish — verified); season-goal modifiers referencing incident classes.
- Deliverables: wiring, no new systems.
- Dependencies: Phases 3–5.
- Test requirements: no-double-count attribution (v2.2 §E), SLA penalty rules per v2.2 §V2.2-4.5.
- DoD: each taxonomy class produces its intended impact profile (taxonomy doc's impact column) on the board prototype.
- Complexity: M.

---

## Sequencing summary

1 → 2 → 3 → 4 → 5 → 6, with Phase 1 the only prerequisite chain; Phases 2/3 could start in parallel once 1 lands (different files, same engine — coordinate per command table). Total estimated complexity: ~L+M+L+M+XL+M — comparable to the work already shipped in waves 1–36, spread over the same one-"Next:"-command-per-wave cadence you've been driving.

## Scenario walkthroughs (brief §Part 9)

Each maps to the phases above; full step-throughs live in `network-incident-taxonomy.md` (cause columns) + v2.2 §H test cases:

1. **Fiber cut, multi-customer** (Phase 3): preconditions = corridor route + weather/dig event; symptoms = mass "no lights" tickets; investigation = OTDR localization (owned gear → fast); decisions = splice crew vs reroute; financial = SLA credits + repair cost; reputation scales with customer-hours; recovery = splice + verify by power-meter margin.
2. **Router hardware failure** (Phase 2): wear roll kills an edge router; symptoms = tree-wide outage or degraded; decisions = warm spare swap (fast, needs inventory) vs dispatch repair (slow, cheap); lesson = spares/MTTR (v2.2 §V2.2-4.2).
3. **Upstream provider outage** (Phase 3 ISP class): provider reliability event; symptoms = full internet down, network fine; decisions = failover to second upstream (multi-homing payoff) vs wait for credits; financial = credits owed *to* you vs customer credits owed *by* you.
4. **DDoS on POP/service** (Phase 5): capacity attack per v2.2 §B1; SEC-2 (no CVE), SEC-3 (local firewall can't fix upstream saturation), SEC-4 (scrubbing contract works); decisions = scrubbing fee vs RTBH collateral vs ride it out.
5. **Vulnerable firmware on edge router** (Phase 5): advisory arrives via threat-intel feed; asset resolution flags the router; decisions = patch in maintenance window (SEC-9, failure risk) vs mitigate with ACL vs accept risk with review date; consequences per v2.2 §E.

Difficulty progression: era-gated precondition-chain length and ambiguity per the taxonomy §7 — never bigger dice (v2 §15.2).
