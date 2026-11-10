# Cisco Packet Tracer Research — Devices, Simulation & Cybersecurity for NetCorp

Status: research report for review (Phase 0). No implementation accompanies it.
Date: 2026-11-10. Evidence tags: **VERIFIED** (read this session from a cited primary source), **SECONDARY** (credible secondary source, cited), **PROPOSED** (NetCorp design recommendation), **ASSUMPTION** (abstraction needing validation), **UNKNOWN** (insufficient evidence).

Companion documents:
- `docs/research/device-catalog-proposal.md` — device catalog audit → recommendation
- `docs/research/network-incident-taxonomy.md` — incident taxonomy
- `docs/research/cybersecurity-simulation-proposal.md` — security simulation grounding
- `docs/architecture/device-and-incident-architecture.md` — architecture proposal
- `docs/roadmap/device-simulation-roadmap.md` — phased roadmap

Raw research notes (session evidence, untracked): `.amp/in/research/pt-devices-and-connections.md`, `.amp/in/research/pt-lifecycle-monitoring.md`, `.amp/in/research/pt-cybersecurity.md`, `.amp/in/research/netcorp-audit.md`.

---

## 1. Executive summary

Cisco Packet Tracer models network education, not network operations — and the difference is exactly where NetCorp's value lies. PT's device model (typed interfaces, module slots, media compatibility rules, link-state indicators), its per-tab configuration UI, and its 9.0 Cyber Observer (rogue-device discovery, model+firmware vulnerability matching) all translate well into NetCorp. Its packet-level Simulation Mode and its PT-vs-real gaps (no GPON/FTTH devices, no throughput modeling, no firmware-upgrade workflow, no maintenance windows) do not — NetCorp's GDD already commits to a flow-level simulation (§6.2) and an operator-economics layer PT never attempts.

Three headline conclusions:

1. **Adopt PT's interface/media model, not its legacy friction.** Typed interfaces, pluggable optics (SFP-style modules = GDD §11's B+/C+/XGS tiers), and media compatibility rules are cheap to simulate and create real purchase decisions. Straight-through-vs-crossover cabling is legacy friction (modern ports auto-MDIX) — skip it.
2. **PT has no FTTH.** Fiber in PT is point-to-point optics between modules; there is no OLT/ONT/splitter device (VERIFIED absence across the device pages). NetCorp's GPON plant — the core of the game — is a NetCorp abstraction built on real optical parameters (GDD v2.2 §V2.2-3.1), not borrowed from PT. PT's Cloud-PT/DSL-modem/Cable-modem devices are nevertheless useful references for modeling *upstream handoff*.
3. **Cyber Observer validates GDD V2.2-4.4's design and adds one cheap mechanic.** PT 9.0's vulnerability matching is purely **device model + firmware version**, with patching auto-clearing the finding (VERIFIED). That is exactly the "advisory feed → affected-asset resolution → patch → clear" loop V2.2-4.4 specifies, minus CVSS. NetCorp should adopt the model+firmware matching loop as the *detection substrate* and keep V2.2-4.4's CVSS-informed prioritization (which deliberately exceeds PT's fidelity) as the *decision layer*. Also adopt ping-based rogue-device discovery as a purchasable monitoring capability.

GDD conflicts found: none material. One naming risk: existing firmware notes cite CVE-style identifiers (`CVE-2026-3312`) for fictional vulnerabilities — GDD v2.2 §F already mandates fictional IDs must not borrow real CVE format/namespace; recommend rebranding in-game advisories (e.g., `NC-ADV-26-3312`). See §8 of the cybersecurity proposal.

---

## 2. Verified Packet Tracer device categories

All categories below are VERIFIED from the PT help pages (sources in §13; details in the devices notes file).

| Category | PT evidence | Named examples (from docs) | NetCorp relevance |
|---|---|---|---|
| Routers | 16 documented models, ISR4321/4331 → 1841/2620XM/2811, generic Router-PT, industrial IR/CGR, cellular 819/829, PT8200 edge | ISR4321, 2911, 819 | Core: yes (SOHO→edge→core arc matches) |
| L2/L3 switches | 2960/2950/3560/3650, industrial IE2000/IE-3400/IE-9320, generic Switch-PT/Bridge-PT; many "does not support add-in modules" | Catalyst 2960, 3560 | Core: yes |
| Hubs/repeaters | Hub-PT, Repeater-PT | — | Skip: obsolete tech, no ISP decision content |
| End devices/servers | PC/Laptop/Server-PT, printer, phone, TV, sniffer | — | Core: CPE + customer devices |
| Wireless APs/controllers | AccessPoint-PT variants, LAP-PT, 3702i, WLC-PT/3504/2504, WRT300N home router | 3702i, WLC-3504 | Core: yes (WISP arc) |
| WAN/ISP-side | **Cloud-PT** (modular uplinks: Ethernet/Fiber/Serial/Modem/Coaxial), DSL-Modem-PT, Cable-Modem-PT, Central Office Server (6 coax ports + 1 FE), Cell Tower | Cloud-PT, CO Server | Reference for upstream handoff modeling; no direct port |
| Security appliances | ASA 5505 (slot "currently not supported"), ASA 5506 fixed-config, ISA-3000 industrial firewall (9.0), Meraki-MX65W (outbound rules only) | ASA 5506-X | Partial: firewall abstraction; no FirePOWER/NGIPS emulation (SECONDARY) |
| IoT | Only MCU-PT/SBC-PT cable mentions | — | UNKNOWN full catalog; skip for ISP scope |
| **GPON/FTTH** | **No OLT, ONT, splitter, or PON device exists in PT** | — | NetCorp abstraction (PROPOSED, §4) |

Model counts are as documented in the help pages' model lists; totals beyond that are not claimed.

## 3. Device specification model (what PT teaches that NetCorp should keep)

- **Chassis = fixed ports + typed slots + drag-and-drop modules**; module swap requires power-off; power cycle reloads startup config and drops unsaved running config (VERIFIED). NetCorp translation (PROPOSED): rack devices accept optics/SFP-class modules; the GDD §11 optics tiers (B+/C+/XGS) become purchasable pluggables with dB budgets, instead of implicit research flags. Module swap while powered = incident risk (V2.2-4.2 hazard model).
- **Typed interfaces with named kinds** (`GigabitEthernet0/0/1`-style naming; ethernet/serial/console/coax/fiber kinds) — NetCorp's 3-way interface kind (ethernet/wifi/wan) is too coarse to price ports or validate media; extend per the catalog proposal.
- **Link-state indicators**: green up, blinking activity, red down, amber STP-block (VERIFIED). NetCorp's board should color links by *computed* state (up/degraded/down) from the path engine — the sim already knows (`hasL2Path` reports the break).
- **Per-tab configuration** (Physical/Config/CLI/Desktop): the insight worth keeping is *splitting hardware from config from diagnostics*, not the tabs. NetCorp already does this (board/inspector/console). PT's documented wart — Config-tab and CLI desync — is the anti-pattern; NetCorp's single config store is correct (notes, §1).
- **What PT does not model** (VERIFIED absence in the read pages): throughput, firmware upgrade workflows, hardware degradation, maintenance windows. NetCorp's wear/MTBF/repair/replace economy (implemented; v2.2 §14.6 extension spec'd) is a deliberate step *beyond* PT — no rollback.

## 4. Connection and interface research

Compatibility rules VERIFIED from connectionsLinks.htm and the module pages:

- Copper straight-through = different OSI layers; cross-over = same layer; both limited to 10/100/1000 copper ports.
- Fiber requires matching mode (single-mode vs multimode) — the key *decision-relevant* rule; PT's SFP modules carry wavelength/reach (GLC-T 100 m copper, GLC-GE-100FX 2 km MMF, GLC-LX-SM-RGD 10 km SMF).
- Serial needs DCE-side clocking or line protocol stays down. Phone⇄modem, coax⇄coax, console parameter-matching. Ethernet cable-length limits are enforced in PT (intro.htm).
- Link lights show physical layer only, not line protocol.

**NetCorp compatibility matrix (PROPOSED)** — full version with per-cell justification in the devices notes file §4:

| Interface kind | Copper | Fiber | Wireless | Coax/DSL handoff |
|---|---|---|---|---|
| Ethernet (copper) | ✅ | — (needs SFP) | — | — |
| SFP slot (optics-tiered) | with GLC-T | ✅ per mode/tier | — | — |
| Wi-Fi radio | — | — | ✅ | — |
| WAN uplink | ✅ | ✅ | ✅ (licensed PtP) | ✅ (upstream handoff) |

Explicit PROPOSED omissions: straight-through vs cross-over (auto-MDIX is universal on modern gear; the distinction teaches nothing an ISP operator uses); DCE/DTR serial clocking (no serial in scope). The one rule worth enforcing: **optics tier vs link length/budget** — a B+ module on a 40 km run fails, which is GDD §11's "dB budget vs price" tradeoff made physical, and the lab bench (V2.2-3.5) can measure it.

## 5. Device lifecycle findings

From PT + operator practice (details in the lifecycle notes):

- PT teaches: config persistence (running vs startup, lost on reboot), power-cycle vs reset, ROMMON recovery. PT is silent on upgrades, backup workflows, maintenance windows, degradation (VERIFIED absence).
- Real operator practice (SECONDARY, Cisco docs): pre-upgrade checklists with 2–3 h windows and rollback images; config archive + `configure replace`-style rollback; change-audit logs; SMU/ISSU on modern platforms.
- NetCorp mapping (PROPOSED): config backup as a purchasable practice (ransomware recovery prerequisite — v2 §15.4 already says "backups are a purchasable, testable practice"); firmware patch = maintenance-window action with failure risk (V2.2-4.4 §SEC-9 already specifies this); power-cycling as a cheap "reboot-until-quiet" player verb whose recurrence is the lesson (v2 §15.1 R1's twin).
- Already implemented in NetCorp and confirmed against this research: wear/failure rolls keyed to uptime+reliability, repair vs replace economy with trade-in credit, vendor firmware channels, predictive-maintenance research flagging aging devices.

## 6. Network incident taxonomy

See `docs/research/network-incident-taxonomy.md` for the full 5-class taxonomy (physical, data link, network, transport/application, ISP-specific) with per-cause precondition chains, symptoms, diagnosis, repair, and impact profiles, plus an era-based difficulty progression. Design rules carried from GDD §15.2: precondition chains, not dice; flow-level; symptom-language tickets; one shared resolver with security incidents.

## 7. Cybersecurity findings

Summary here; full grounding in `docs/research/cybersecurity-simulation-proposal.md`.

- **Cyber Observer (PT 9.0)**: a physical device with a web-GUI dashboard "displaying all detected network vulnerabilities and network issues"; ping-based **Discovery** that auto-flags new devices as **rogue**; a user-authored **Vulnerability Database** matching devices by **model + firmware version**, where upgrading firmware auto-clears the entry (all VERIFIED from config_CyberObserver.htm). No CVSS, no scanning, no signatures documented.
- **Security devices**: ASA 5505/5506, ISA-3000, Meraki MX65W (outbound rules only); IPS exists only as an ISR-router feature; no standalone IDS/IPS appliance, no endpoint tooling, no attack-traffic engine (VERIFIED/SECONDARY).
- **CVE/CVSS**: NVD enriches CVEs with CVSS base scores, CWE, CPE; NIST and FIRST explicitly document that base scores are severity, not risk, and must not alone drive patch prioritization (SECONDARY, NIST/FIRST). This validates V2.2-4.4's separation of CVSS-B from game-side prioritization.
- **NetCorp verdict**: V2.2-4.4 is the controlling spec and exceeds PT's fidelity. From PT, adopt: (1) the model+firmware advisory-matching loop as the detection substrate; (2) ping-based rogue-device discovery as a purchasable monitoring capability (extends the existing rogue-DHCP incident into a general mechanic); (3) dashboard-as-device (security posture comes from a *purchased, placed* server, per GDD §14.2 "monitoring as a build, not a HUD"). Everything else — seeded attack events, CVSS-informed prioritization, KEV-like exploitation signal, response-control table — stays as V2.2-4.4 already specifies.

## 8. NetCorp feature comparison

Audit of the current code (details in `netcorp-audit.md` and `device-catalog-proposal.md`):

| Feature | Cisco Packet Tracer | NetCorp current (audit) | Proposed NetCorp (recommendation) |
|---|---|---|---|
| Device catalog | 60+ educational models across 9+ categories | 10 kinds, data-driven DeviceDef | Extend DeviceDef: typed interface kinds, module slots, optics tiers; keep catalog data-driven (Phase 1) |
| Interface model | Typed kinds, names, speeds, per-module connectors | 3-way kind, no speeds | Extend kind enum + per-kind pricing/compat; speeds only where gameplay-relevant |
| Hardware modules | Typed slots, drag-drop, power-off swap | None | SFP/optics pluggables tied to GDD §11 tiers; swap = maintenance action |
| Fiber connectivity | P2P optics only; no GPON | `media:'fiber'` label, no budget check | Optical budget validation (optics tier vs path length); GPON stays NetCorp-native (GDD §7) |
| Wireless behavior | Auto-association by nearest AP; no interference sim |wifi kind, no association model | Defer: GDD §8 WISP model (LoS/Fresnel) already supersedes PT; interference incident joins taxonomy |
| Device lifecycle | Config persistence, power cycle, ROMMON | install/repair/replace/firmware/compromise | Add maintenance windows, config backup practice, patch-failure risk (V2.2-4.2/4.4) |
| Network incidents | Fault-injection via cross-over/cable games; no incident engine | 3 incident kinds, precondition-gated | Data-driven incident engine over the 5-class taxonomy (Phase 3) |
| Troubleshooting | Link lights → interface state → ping/traceroute → simulation mode | ping probe + break-cause reporting (better than PT here for a management game) | Escalating-cost diagnostics + test gear (OTDR etc., GDD §11); no packet mode |
| Vulnerability database | Cyber Observer: model+firmware matching, patch auto-clear | firmware channel strings + outdated-firmware incident | Advisory feed with fictional IDs; model+firmware asset resolution; CVSS-informed priority per V2.2-4.4 |
| Rogue device detection | Cyber Observer ping discovery | rogue-DHCP incident only | Discovery capability on monitoring server; generalizes rogue-DHCP |
| DDoS mitigation | Not supported | research unlock only | V2.2-4.4 §B/§D as spec'd (flow-level, upstream scrubbing) |
| Network monitoring | Link lights + Cyber Observer dashboard | events log only | Monitoring stack: syslog-ish events → SNMP-ish health polls → top-talker flow view (Phase 4) |

## 9. Proposed architecture

See `docs/architecture/device-and-incident-architecture.md` for module boundaries, TypeScript schemas, and the data-driven representation of device and incident definitions. Headlines: everything extends the existing command/event sim core (no second engine); `DeviceDef`/`ModuleDef`/`IncidentDef`/`AdvisoryDef` live in packages/data; the incident engine is a precondition evaluator over world state, not per-incident code paths; the vulnerability registry reuses the firmware-channel plumbing that already exists.

## 10. Gameplay scenarios

Five detailed scenarios (fiber cut, router hardware failure, upstream outage, DDoS, vulnerable firmware) are specified in `docs/roadmap/device-simulation-roadmap.md` §6, each with initial state, trigger, symptoms, player investigation path, decisions, financial/reputation consequences, and recovery conditions — all grounded in the taxonomy and V2.2-4.4's test cases (SEC-1…10).

## 11. Implementation roadmap

Phased roadmap with scope/deliverables/DoD/complexity per phase: `docs/roadmap/device-simulation-roadmap.md`. Order: device registry (interfaces/modules/compatibility) → lifecycle (windows, backup, patch risk) → incident engine (data-driven precondition chains) → monitoring stack → security integration per V2.2-4.4 → ISP business integration (customer attribution already exists — reuse, don't duplicate).

## 12. Open questions and uncertainties

1. **PT IoT catalog**: UNKNOWN beyond MCU/SBC mentions — out of scope regardless.
2. **PT wireless association/interference details**: the docs cover association only; NetCorp's WISP interference model follows GDD §8, not PT.
3. **Interface speed simulation**: keep abstract (Gbps capacity numbers on the flow model) vs per-interface rates — PROPOSED abstract; per-port speed only matters when it gates a purchase decision.
4. **Chained-cause incidents** (dig damage revealing degraded splice): worth engine complexity? Deferred to Era 4+ decision.
5. **Duplex/crossover legacy friction**: PROPOSED skip (auto-MDIX); revisit only if the teaching value is ever demonstrated.
6. **The reference video** (youtube An09pZUSoVE): not watched — no transcript tooling available this session. Everything cited above comes from the written documentation.

## 13. Source references

Primary (read in full this session; all 12 brief URLs except the video):
- tutorials.ptnetacad.net/help/default/intro.htm — simulation model, link lights, cable limits
- …/devicesAndModules.htm, _routers.htm, _switches.htm, _endDevices.htm, _others.htm — categories, models, slots/modules
- …/connectionsLinks.htm — cable types, compatibility rules
- …/configuringDevices.htm — Config/CLI tabs, boot sequence
- …/config_CyberObserver.htm — Cyber Observer (discovery, rogue devices, vulnerability database)
- …/whatsNew.htm — PT 9.0 additions
- …/faqTroubleShoot.htm — troubleshooting (partial fetch recovered via targeted re-read; noted)
- …/usesForPT.htm — intended uses

Secondary (cited in the notes files): Cisco IOS SNMP/Syslog/NetFlow/NTP/config-archive documentation, Cisco NMS best practices (maintenance windows), packettracernetwork.com (PT 9.0 features, firewall emulation status), Cisco NetAcad 9.0 deck (Cyber Vision lineage), NIST NVD (CVE/CVSS process), FIRST CVSS v3.1/v4.0 specs and user guide (severity≠risk), MITRE ATT&CK T1498/T1499 (DDoS taxonomy anchor — cited by GDD v2.2 §B, re-verified).

Unavailable: the reference video (no transcript). No other source failed.

## 14. GDD conflicts found (rule 14 reporting)

1. **Fictional CVE identifiers**: current firmware notes use real-CVE-format strings for fictional flaws. GDD v2.2 §F itself mandates the separation — the *content* lags the GDD. Fix in content, not in GDD.
2. **PT has no GPON** — not a conflict (GDD never claims PT has it), but it confirms FTTH is uncharted abstraction territory where the brief's "do not invent specs" rule binds hardest: optical numbers must come from v2.2 §V2.2-3.1 and ITU-T references already in the GDD.
3. No other conflicts between this research and GDD v2/v2.1/v2.2 as spec'd.
