# Device Catalog Proposal — audit of current catalog vs Packet Tracer research

Status: Phase 0 companion to `cisco-packet-tracer-research.md`. No implementation.
Tags: VERIFIED / SECONDARY / PROPOSED / ASSUMPTION / UNKNOWN.

## 1. Current NetCorp catalog (audited, `packages/data/src/devices.ts`)

10 kinds: desktop, server, printer, switch-unmanaged, switch-managed, router-soho, router-edge, access-point, firewall, ups. Each `DeviceDef`: id, kind, name, price, `interfaces: {name, kind}[]` (kind ∈ ethernet|wifi|wan), firmware string, optional reliability. Switches are pre-populated with fixed port counts (4p/6p); routers carry wan1/wan2 + eth ports; the UPS has no interfaces. Interface names are cosmetic (`eth0…`), kinds drive the path engine (wan = uplink semantics, wifi = association), and any-to-any wiring of free ports succeeds with no media validation.

## 2. What the Packet Tracer research says (summary; details in notes file §1–3)

- PT separates **device category → model → chassis → typed slots → modules → interfaces**. Modules carry connector/medium semantics and reach/wavelength; swap requires power-off (all VERIFIED).
- PT models **link state** with distinct physical-up vs line-protocol-down; NetCorp's per-interface enabled flag + path-break reporting already covers the same ground for a management game.
- PT has **no GPON/FTTH devices** (VERIFIED absence) — NetCorp's OLT/ONT/splitter plant is original abstraction grounded in GDD §7 and v2.2 §V2.2-3.1, which is the hardest constraint on any catalog extension: optical numbers come from the GDD, not invention.
- PT's ISP-side references (Cloud-PT with modular coax/fiber/ethernet uplinks, DSL/Cable modems) suggest modeling **upstream handoff** as a device-with-uplink-ports rather than an abstract toggle.

## 3. Recommended catalog extensions (PROPOSED, all data-driven)

Priority order; each is an additive `DeviceDef` change unless noted:

1. **Typed interface kinds.** Extend `Interface.kind` from `ethernet|wifi|wan` to include `sfp` (optics slot) and keep `wan` as an uplink *role* flag rather than a medium. Cheap, unblocks everything below.
2. **Optics as modules (SFP pluggables).** New `ModuleDef`: id, name, price, medium (copper/fiber), mode (single/multi — PROPOSED to keep single-mode only for scope), dB budget/reach class. Three tiers per GDD §11: B+ (default), C+ (research-gated purchase), XGS (research-gated). A link is valid only if both endpoints' modules cover the path class; budget mismatch = link down with an explanatory path-break reason. This makes the lab bench (V2.2-3.5) measurable against real links.
3. **Port-count variants per switch kind** (8p/16p/24p managed) rather than new kinds — price scales with ports; PoE budget deferred until towers need it (GDD §11 PoE row).
4. **OLT/ONT/splitter kinds** (the FTTH plant): currently *not in the sim at all* — the board prototype is an enterprise LAN. These are the catalog's biggest gap, and they are NetCorp-native (no PT reference). Requires the PON-tree model from GDD §7 to be simulated before it earns catalog slots — sequence behind Phase 1.
5. **Upstream handoff device** (NID/handoff terminal): where the transit provider's fiber terminates; the upstream-outage and BGP incidents from the taxonomy attach here.
6. **Test gear** (GDD §11: power meter, OTDR, spectrum analyzer): not placeable network nodes but *tool purchases* that unlock/cheapen specific diagnostics from the taxonomy. No PT equivalent worth porting — PT's diagnosis is free, which is wrong for an operator-economics game.

## 4. Explicitly rejected (with reasons)

- **Hub/repeater kinds** (PT ships them): obsolete, no decision content; a dumb switch already covers "shared medium" lessons.
- **Straight-through vs cross-over cables** (PT's signature friction): modern ports auto-MDIX (SECONDARY, industry-standard behavior); teaches nothing an ISP operator uses.
- **Serial/DCE clocking**: out of ISP scope.
- **Device-count parity with PT**: the goal is decision density, not catalog size — brief's own closing line.

## 5. DeviceDef schema extension (sketch; full schema in architecture doc)

```ts
// additive to types.ts — existing fields unchanged
kind: DeviceKind & ('olt' | 'ont' | 'splitter' | 'handoff' | 'test-gear')
interfaces: { name: string; kind: InterfaceKind; role?: 'uplink'; moduleSlot?: boolean }[]
modules?: ModuleDef[]        // what can plug in
```

Migration risk (ASSUMPTION): existing scenarios/place flows assume free-port wiring; compatibility validation must start as a *warning* in the inspector (Phase 1) before becoming a wire-time rule, so old boards don't break.

## 6. Alignment with GDD §11

The proposal *is* §11's catalog row set (OLT→chassis, splitters, optics tiers, router arc, switch tiers, wireless tiers, power, test gear, splicing) expressed as sim data. Nothing here contradicts the GDD; the one judgment call is deferring PoE and splitter physics until the FTTH plant is simulated.
