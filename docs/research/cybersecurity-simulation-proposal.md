# Cybersecurity Simulation Proposal

Status: design grounding for review (Phase 0 companion to `cisco-packet-tracer-research.md`). No implementation.
Controlling spec: **GDD v2.2 §V2.2-4.4 stays as written.** This document grounds it in Packet Tracer's verified cybersecurity model, marks what PT adds, and flags one GDD-content discrepancy. It does not replace or extend V2.2-4.4's mechanics.

Evidence tags: VERIFIED / SECONDARY / PROPOSED / ASSUMPTION / UNKNOWN.

## 1. What Packet Tracer actually supports (verified baseline)

From `config_CyberObserver.htm` and `whatsNew.htm` (read in full this session):

- **Cyber Observer** is a physical two-port device managed via web GUI: "managing, monitoring, and configuring supported network devices, as well as simulating network threats and their mitigations" (VERIFIED).
- **Discovery**: after the first discovery process, new devices are auto-detected by pinging, **marked rogue**, and posted to the dashboard. Prerequisite: every device, including switches, must have an IP and be ping-reachable (VERIFIED).
- **Vulnerability Database**: user-authored CVE-like records matched to devices **purely by device model + firmware version**; upgrading firmware auto-clears the dashboard entry (VERIFIED). No CVSS field, no severity scale, no service scanning documented (ASSUMPTION-of-absence, documented as such).
- **Security devices shipped**: ASA 5505 (expansion slot "currently not supported"), ASA 5506 (fixed-config; FirePOWER NGIPS/AMP/URL filtering NOT emulated — SECONDARY), ISA-3000 industrial firewall, Meraki MX65W (outbound rules only). IPS exists only as an ISR-router feature; **no standalone IDS/IPS appliance, no endpoint/EDR, no attack-traffic engine** (VERIFIED/SECONDARY).
- **Threat "simulation"** is a scripted scenario harness on sample files — not a traffic engine (VERIFIED from examples list; interpreted as such).

Conclusion: PT's security model is **inventory + advisory matching + rogue detection + dashboard-as-device**. That is the part worth porting. Attack mechanics are NetCorp's own (V2.2-4.4 §B/C already specifies them at higher fidelity than PT).

## 2. Mapping: PT mechanic → V2.2-4.4 mechanism

| PT mechanic (VERIFIED) | V2.2-4.4 mechanism it grounds | NetCorp proposal (PROPOSED) |
|---|---|---|
| Vulnerability DB matches model + firmware | §A vulnerability records attached to asset + version | `AdvisoryDef` in packages/data: fictional id, affected product + version range, patch availability; asset resolution = world devices whose defId+firmware match. Reuses the existing `firmwareChannels` plumbing (already tracks per-defId versions and `updateFirmware`) |
| Patch auto-clears dashboard entry | §A status lifecycle (Open → Patched) | `updateFirmware` re-resolves affected assets; advisory status recomputed — no manual bookkeeping |
| Discovery ping-sweep, rogue flagging | §D detection sources | **Purchasable capability** on the monitoring server (GDD §14.2): "device discovery" toggle that flags unmanaged/unexpected devices on segments as `suspected` rogue; the existing rogue-DHCP incident becomes a special case that discovery can catch *earlier* |
| Dashboard-as-device (web GUI on a placed box) | §G Security Overview panel | Security Overview renders only when a monitoring server is placed & powered — no omniscient HUD (GDD §14.2 principle) |
| "Threat simulation" scripted scenarios | §C Threat Event Engine | NetCorp goes beyond: seeded deterministic attack events per §C. PT contributes nothing here; adopt nothing |

## 3. CVSS grounding (validates V2.2-4.4 §A)

- NVD assigns CVSS base scores, CWE, CPE to published CVEs (SECONDARY, NIST NVD).
- NIST: "CVSS is not a measure of risk" (SECONDARY, NIST). FIRST CVSS v4.0 User Guide: CVSS-B measures severity, not risk; should not be used alone for patch prioritization; CISA BOD 26-04 (SSVC) is the referenced rubric for prioritization (SECONDARY, FIRST).
- Therefore V2.2-4.4's design — official CVSS-B displayed untouched, prioritization as a separate game calculation (severity + KEV-like exploitation signal + exposure + criticality + controls + cost) — matches the industry position exactly. Keep the `score_type` (CVSS-B/BT/BE/BTE) display rule as spec'd.

## 4. Content rule: fictional advisories (GDD conflict found)

GDD v2.2 §F: "fictional vulnerabilities must not borrow real CVE identifiers."

Current content (`packages/data/src/devices.ts`, `FIRMWARE_UPDATES`) uses real-CVE-format strings for fictional flaws, e.g. notes reading "fixes CVE-2026-3312 (DNS cache poisoning)" and "blocks CVE-2026-1187 (rule bypass)".

- Risk: a player can search a real NVD for "CVE-2026-3312"; even if unassigned today, the format implies real-world lookup validity and invites confusion — and future real CVEs may collide.
- PROPOSED fix (content change, no GDD change): in-game advisories use a clearly fictional namespace, e.g. **`NC-ADV-26-3312`** with an in-game "vendor advisory" framing ("RouterOS-like project advisory"). The Threat Intelligence panel prose already explains fictional identity (§F). Apply when the vulnerability registry lands (Phase 5), not as a standalone patch.

## 5. Detection confidence and the shared resolver (implementation reminders)

- Reuse v2.2 §E: security incidents enter the same incident pipeline as network incidents — one topology resolver, one customer-attribution path, one SLA/postmortem machinery. The taxonomy's security class in `network-incident-taxonomy.md` §6 points here.
- Detection states `observed/suspected/confirmed` (§D) must be tracked from the *source* of detection (discovery sweep = observed for rogue devices; utilization anomaly = suspected until corroborated).
- Attack events need no vulnerability: §C's three exploitation relationships (`exploits_vulnerability`, `abuses_exposure_or_configuration`, `capacity_or_protocol_attack`) map directly onto the incident record fields; the DDoS-without-CVE test (SEC-2) is the acceptance test.

## 6. Scope boundaries (unchanged, restated as commitments)

No real exploit code, payloads, or attack instructions anywhere; attacks are seeded abstract events affecting flow/service/route state. No packet-level DDoS. No offensive player capabilities. Fictional advisories only, fictional namespace. These are GDD v2.2 §I commitments — this proposal adds none.

## 7. Open questions

1. Does "discovery" require ping-reachability for *every* device like PT does (its documented prerequisite), or should NetCorp abstract to segment visibility? PROPOSED: abstract — reachability-from-monitoring-server is the precondition, which is simpler and teaches the same "you can't protect what you can't see" lesson.
2. Should the fictional advisory namespace also replace the two existing CVE-format strings in starter mail, or only new content? PROPOSED: replace all, once, in Phase 5.
