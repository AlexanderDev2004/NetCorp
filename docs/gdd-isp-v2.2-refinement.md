# NetCorp GDD V2.2 — Technical Consistency, USD Economy & ISP Operations Expansion

**Version:** 2.2 (controlled refinement of GDD v2 + v2.1) · **Date:** {{date:2026-11-09}} · **Status:** Draft for development planning
**Source documents:** GDD v2 (source of truth), GDD v2.1 (first refinement — partially superseded by this document, per the audit below)

> **What this document is.** A technical-consistency and operations-expansion pass. It makes five changes: (1) the economy becomes **USD-only**, replacing v2.1's IDR decision; (2) five technical inconsistencies in v2.1 are corrected with explicit definitions and test cases; (3) four ISP business systems are expanded — Competitor Intelligence, Maintenance & Asset Lifecycle, Upstream/Transit/Peering, and **Cybersecurity & Network Resilience (V2.2-4.4)**; (4) the roadmap is re-phased. Everything else in v2/v2.1 stands. All references cited below were verified to exist and support the specific mechanic named; two references proposed in the brief could not be verified and were replaced (noted in §V2.2-6).

---

## V2.2-1. Change Audit (V2 ↔ V2.1)

| System | V2 section | V2.1 section | Status after V2.1 | Conflict | Resolution in V2.2 |
| --- | --- | --- | --- | --- | --- |
| Simulation core / flow model | §6.1–6.4 | — | **Complete** | None | Unchanged |
| Optical physics | §7.2 | — | **Conflicting** — v2 used "−27 dBm floor" loosely; v2.1 repeated it; Rx sensitivity, overload, and operating thresholds were treated as one number | Sensitivity ≠ overload ≠ warning threshold | Corrected in V2.2-3.1 |
| WISP physics | §8.2 | — | **Complete** (tiered SNR→MCS, event-class weather) | None | Unchanged |
| Bottleneck marker | §19 (marker) | §6.6 (USE method) | **Conflicting** — v2's "single weakest point" and v2.1's "earliest stressed resource" are both wrong for shared-capacity paths; neither handles multiple simultaneous constraints | Earliest-stressed ≠ throughput-limiting | Redesigned in V2.2-3.3 |
| Metrics catalog | §6.5 (v2.1) | **Complete** as catalog; **Partial** on computation tie-in | Threshold classes stand | Optical rows corrected per V2.2-3.1 |
| Customer acquisition | §13.3 | §13.4–13.8 | **Partial** — funnel exists; campaign math undefined (units unspecified, no overlap/exposure model) | Formula units ambiguous | Completed in V2.2-3.2 |
| Analytics & forecasting | §14.1 | §14.4 | **Partial** — before/after windows named; sampling/forecast rules unspecified | Linear forecast presented without limits | Specified in V2.2-3.4 |
| Thresholds | §14.2 | §14.5 | **Complete** (4-class taxonomy + hysteresis) | Optical thresholds corrected per V2.2-3.1 |
| Research lab | §18 (tree) | §18.1 | **Partial** — reward rule stated; evaluation criteria undefined; farming loopholes open | "Wrong hypothesis pays" needs precise rules | Completed in V2.2-3.5 |
| Economy | §12, §19 | §12.6, §19 (IDR) | **Conflicting** — v2 USD vs v2.1 IDR-primary; the brief for v2.1 requested IDR and this brief supersedes it | Currency | Resolved: USD-only in V2.2-2; v2.1 §19.1 market *tiers* (non-currency localization) retained |
| Competitors | §10.4 | — | **Missing** — archetypes named, no profiles, actions, reaction model, or customer choice model | — | New §10.5 (V2.2-4.1) |
| Maintenance / assets | §14.3 (maintenance windows, wear), §11 (MTBF field) | — | **Partial** — wear and windows exist; no asset registry, no work orders, no maintenance taxonomy | — | New §14.6 + §10.6 (V2.2-4.2), reusing v2's wear model |
| Upstream/peering | §9.1–9.4 | — | **Partial** — transit pricing, peering policy, IXP exist at concept level; no provider profiles, billing model detail, multi-homing diversity rule, or routing-security loop | Peering ≠ free internet (v2 said this; mechanics absent) | New §9.5 (V2.2-4.3), reusing v2's BGP-policy layer |
| Regulatory | §17 | — | **Complete** (Komtel ladder; PM Komdigi 15/2025-anchored) | None | Unchanged |
| Security & resilience | §15.4 (cyberattack table), §7.3 (alerts), §18 (Security branch), §15.2 (incident preconditions) | — | **Partial** — v2 had an attack table, alert severities, and the "security tooling is built, not a HUD" rule, but no vulnerability model, no threat-event engine, no detection-confidence model, and no costed control set | v2 §15.4's flat attack list vs a managed taxonomy with severity/exposure separation | New §V2.2-4.4 absorbs §15.4 (each v2 row maps to a class in the new taxonomy: DNS poisoning → DNS attacks; rogue device → misconfiguration/compromise; brute force/DDoS/ransomware/phishing → their named classes). §7.3 alerts and the R1 precondition rule are unchanged and reused |
| MVP | §24.1 | V2.1 Part D | **Complete** concept | Phasing extended per V2.2-7 |

---

## V2.2-2. USD Economy Revision (supersedes v2.1 §19 currency decision)

### V2.2-2.1 Currency policy

The entire player-facing economy is denominated in **USD ($)**: every price, salary, fee, loan, tax, dashboard, contract, tooltip, and report. There is no currency switching, no dual display, no FX gameplay. The setting keeps its fictional Indonesian-inspired identity (geography, segments, regulator, market structure) — v2.1's §19.1 **market tiers survive intact** because they localize *demand and cost structure*, not currency. Imported and locally sourced goods are both recorded in USD.

Where published Indonesian market data informs a value, the original source and methodology are preserved in the reference notes and the value is converted at a **documented historical planning rate: Rp 16,500 = US$1** (a game assumption, not a forecast). Converted values are labeled *Published source converted* and remain estimates, not claims about USD-denominated prices anywhere.

### V2.2-2.2 Currency audit table

Classification key: **[P-c]** published source converted to USD · **[E]** historical market estimate · **[B]** game-balancing assumption · **[D]** derived value · **[F]** fictional gameplay value.

| Section (v2/v2.1) | Existing value | Required action | Final USD value | Class |
| --- | --- | --- | --- | --- |
| §19 (v2) Starting capital | $25,000 | Keep | **$25,000** | [B] |
| §19.2 (v2.1) Residential entry 10–20 Mbps | Rp 100,000–200,000 | Convert published band | **$6–12/mo** | [P-c] (APJII home-Wi-Fi band, lower half) |
| §19.2 (v2.1) Residential standard 50–100 Mbps | Rp 150,000–350,000 | Convert | **$9–21/mo** | [P-c] (APJII band core) |
| §19.2 (v2.1) Residential premium 300 Mbps | Rp 300,000–500,000 | Convert | **$18–30/mo** | [P-c] (APJII band upper) |
| §19.2 (v2.1) Small business w/ static IP | Rp 400,000–800,000 | Convert (estimate) | **$24–48/mo** | [E] |
| §19.2 (v2.1) Dedicated business 1:1 SLA | Rp 2–6 jt | Convert (estimate) | **$120–360/mo** | [E] |
| §19.2 (v2.1) Enterprise/SLA contract | ≥ Rp 10 jt | Convert (estimate) | **≥ $600/mo** | [E] |
| §19.2 (v2.1) Install fee (residential) | Rp 150,000–500,000 | Convert (estimate) | **$9–30** | [E] |
| §19.2 (v2.1) CPE rental | Rp 25,000–75,000/mo | Convert (estimate) | **$1.5–4.5/mo** | [E] |
| §19.3 (v2.1) Fiber build, aerial | Rp 65k–115k/m | Convert v2 range | **$4–7/m** | [B] (v2 USD range is authoritative) |
| §19.3 (v2.1) Fiber build, underground | Rp 200k–330k/m | Convert v2 range | **$12–20/m** | [B] |
| §19.3 (v2.1) GPON OLT (8p) + optics | Rp 100 jt | Convert v2 range | **$6,000** | [B] |
| §19.3 (v2.1) 30 m tower built | Rp 300–500 jt | Convert v2 range | **$18,000–30,000** | [B] |
| §19.3 (v2.1) 5 GHz sector + mount | Rp 15 jt | Convert v2 range | **$900** | [B] |
| §19.3 (v2.1) CPE installed | Rp 2–3 jt | Convert v2 range | **$120–180** | [B] |
| §19.3 (v2.1) Field tech salary | Rp 4–6 jt/mo | Convert (estimate) | **$240–360/mo** | [E] |
| §19.3 (v2.1) Electricity | Rp 1,450/kWh | Convert (estimate) | **$0.09/kWh** | [E] |
| §19.3 (v2.1) Transit (Era 1) | US$1.20/Mbps/mo | Keep (was already USD) | **$1.20/Mbps/mo** | [B] |
| §19 (v2) Resale margin | 15–25% | Keep | **15–25%** | [B] |
| §19 (v2) Peak activity / concurrency | 30–50% / 40–60% | Keep | unchanged | [B] |
| §19 (v2) Fiber payback | 18–36 months | Recompute with USD prices | **18–36 months** | [D] — holds: e.g. $5/m × 300 m to a 16-home street ≈ $1,500 build ÷ ($15 ARPU × 50% take × 16 homes × ~55% gross margin) ≈ 23 months |
| §12.4 (v2) Rural grant | 30–50% of project | Keep | unchanged | [B] |
| §18.1 (v2.1) Lab bench equipment | (priceless in v2.1) | Price from catalog | $200 (power meter) – $8,000 (OTDR) | [B] |
| Dependent formulas | §12.6 unit economics; §13.6 campaign CAC; §12.5 loop | Recompute in USD | all USD | [D] |

**Sanity check (required by the brief, not symbol-swapping):** at $15 ARPU and $0.50/subscriber/month transit cost (≈ 8 Mbps average busy-hour draw × $1.20... wait, at 60% concurrency a 20 Mbps-average subscriber draws ~5 Mbps busy-hour; the model's per-subscriber transit cost at $1.20/Mbps ≈ $6/mo — that leaves $9 gross on a $15 sub, consistent with the 55–60% gross-margin target and with §12.5's loop tightening as transit usage grows. Residential entry at $6 ARPU is deliberately thin against that transit cost — the entry tier is a land-grab product, which is the historical WISP pattern the game teaches.

### V2.2-2.3 Affected sections

Modified: v2.1 §19 (rewritten back to USD; market tiers §19.1 kept, currency removed), v2.1 §12.6 (unit economics in USD), v2.1 §13.6 (CAC in USD), v2.1 §19.2 anchors (kept as converted-[P-c] with original IDR bands preserved in the reference note), §21 dashboard copy ("all values USD" is a stated convention). Removed: the Rp 16,500 FX-planning mechanic as *player-visible*; the rate survives only as a documentation note for converted published values.

---

## V2.2-3. Technical Consistency Corrections

### V2.2-3.1 FTTH optical parameters — sensitivity, overload, and thresholds are different things

**Problem.** v2 §7.2 and v2.1 §6.5 used "Rx floor −27 dBm" as a single number for sync/no-sync. A receiver has a **sensitivity** (weakest usable signal) and an **overload** (strongest usable signal) — and neither is an *operating target*. Verified reference values (vendor datasheets implementing ITU-T G.984.2 classes; Cisco GPON SFP datasheet, FS GPON OLT datasheet, Precision Optical B+ OLT datasheet):

| Parameter | Class B+ OLT | Class B+ ONU | Class C+ OLT | Source class |
| --- | --- | --- | --- | --- |
| Tx output power | +1.5 … +5 dBm | +0.5 … +5 dBm | +3 … +7 dBm | Standard-defined range |
| Rx sensitivity | −28 dBm | −27 dBm | −30/−31/−32 dBm (vendor-dependent) | Standard defines the class; exact figure varies by vendor |
| Rx overload | −8 dBm | −8 dBm | −12 dBm | Vendor datasheets, consistent |

**Definitions the whole game now uses (planner, ONT panel, alarms, lab — one vocabulary):**

- **Tx power** — what the transmit end launches. From the optics class. Below-spec Tx is a hardware fault event.
- **Rx sensitivity** — weakest signal the receiver demodulates at target BER. Receiving *below* sensitivity = **no sync** (hard outage).
- **Rx overload** — strongest signal the receiver tolerates. Receiving *above* overload = **sync instability/BER errors**. Gameplay consequence: a C+ OLT feeding a customer 40 m down the road is *too hot* — the fix is an attenuator or a lower-class optic, which is a real ISP support-ticket classic.
- **Optical path loss** — the sum of fiber, splitter, connector, and splice losses on the path (v2 §7.2 tables; unchanged).
- **Optical power budget** — `Tx_min − Rx_sensitivity` (≈ 28 dB for B+, ≈ 33–37 dB for C+ depending on vendor figures). This is capacity for loss, not a target.
- **Engineering margin** — `budget − actual path loss`. Not physics; a *planning practice*. Industry rule of thumb, labeled as such: design ≥ 3 dB margin for aging (splice degradation, water ingress, connector dirt — all modeled events).
- **Operational warning threshold** — the player-configurable alarm point (§14.5 class "operational recommendation"): warn when measured margin < 3 dB, critical < 1 dB. Defaults are balancing values, not standards.

**Effect-of-exceeding table (one behavior per limit, testable):**

| Limit exceeded | Sim behavior |
| --- | --- |
| Rx < sensitivity | No sync — ONT offline, availability clock starts |
| Rx > overload | Sync flaps, BER errors — intermittent complaints, no clean alarm unless monitored |
| Margin < warning threshold | Alarm (player-configurable); degradation events now *become* outages instead of near-misses |
| Margin < 0 | Rx below sensitivity → no sync (same as row 1, cause visible in budget breakdown) |

**Consistency fix applied:** v2 §7.2's budget rows now cite the class table above; v2.1 §6.5 "Rx floor" rows are re-worded to sensitivity/overload/margin; the FTTH lab (v2.1 §18.1) experiments measure against these same definitions. **Test case TC-1:** build a path with 27.5 dB loss on B+ optics (16-way split at 13.8 dB + 3 km feeder + drops): syncs, margin 0.5 dB → no warning if thresholds are defaults-turned-off; a splice-degradation event of +0.7 dB drops Rx below −28 → no sync on one ONT. With monitoring thresholds on, the same network alarms six game-weeks earlier. This is the "margin is a hidden difficulty slider" lesson made mechanical.

### V2.2-3.2 Marketing campaign formula — units, overlap, exposure, and determinism

**Problem.** v2.1's `reach = budget × channel_efficiency × cluster_density_factor` left units undefined and had no exposure model, no channel overlap, and no reconcile between aggregate expectation and individual outcomes.

**Definitions.**

- **Budget** is total campaign spend, drawn evenly per game-day over the campaign duration `T` (days).
- **Reach** is a count of **unique addressed households** (or business sites), not impressions. A household is *addressed* by a channel-day if it is in the channel's audience for that cluster.
- **Audience model:** each channel has an `audience_fraction(cluster)` — the share of cluster households a per-day spend of `budget/T` addresses. Channel efficiency is folded into audience_fraction (valid range 0–1 by construction).
- **Cluster density factor** `ρ(cluster) ∈ [0.5, 1.5]` — urban media are cheaper per household addressed (documented as a balancing abstraction of media economics).
- **Exposure and saturation:** a household accumulates *exposure points* `e` during the campaign. Awareness converts with diminishing returns: `p_awake(e) = p_max × (1 − e^(−e/2))` — first exposure does most of the work; bombardment wastes money. This is the repeated-exposure answer: the formula penalizes over-budgeting a tiny audience naturally.
- **Overlap between channels:** awareness is tracked **per household**, so channels targeting the same household add exposure points to the same accumulator — overlap is handled exactly, not via a fudge factor. Two cheap channels with 60% audience overlap are worse than their sums suggest; the pre-commit panel shows predicted overlap.
- **Competitor share:** reachable non-customer pool = `households × (1 − competitor_share − player_share)`; already-served households are addressed only for *switch* messaging at half conversion strength.
- **Leads over time:** per addressed household per day, `p_lead = p_awake(e) × base_conversion(channel, segment) × interest_factor(cluster)`. Expected leads per day is the deterministic aggregate; individual conversions are drawn with the **world RNG seeded as `hash(world.seed, campaign_id, day, household_id)`** — same world seed + same commands ⇒ same leads (deterministic-replay compatible). The aggregate shown pre-commit is the expectation with a ±1σ band from the binomial spread; **the player is never promised exact outcomes** (v2.1's confidence bands, now with the mechanism).
- **Lead expiry and backlog:** a lead waits in the install queue; if wait > `patience_days` (segment-dependent, balancing value, default 14), it expires with an interest penalty. Backlog therefore enters conversion *through the queue*, not through a campaign modifier — one mechanism, no double-count.

**Funnel mathematics (each stage: input population → probability → modifiers → output → decay):**

| Stage | Input | Conversion | Modifiers | Output | Decay/failure |
| --- | --- | --- | --- | --- | --- |
| Awareness | Cluster households | `p_awake(e)` | exposure, overlap | Aware households | awareness decays −50%/30d after campaign end |
| Prospect | Aware households | interest gate | interest_factor, competitor promo | Prospects | competitor poach |
| Lead | Prospects | per-day `p_lead` | channel, segment, satisfaction (referrals) | Leads | expire after patience_days |
| Coverage verification | Leads | 1 or 0 | **network state only** | Verified leads | fail = lost lead + interest penalty |
| Offer | Verified | 0.4–0.8 | price vs wealth, contract length | Registrations | rejected offer → small interest penalty |
| Registration→Install | Registrations | queue-based | technician hours, skill | Installed | backlog expiry (patience) |
| Active | Installed | 1 | onboarding quality | Subscribers | churn loop (§12.2) |

**Test case TC-2:** identical $2,000 campaign in cluster A (600 households, 100% covered, empty install queue) and cluster B (600 households, 40% covered, 3-week technician backlog): A yields ≈ expected 38 leads → 31 verified → 24 installs; B yields ≈ 38 leads → 16 verified, and of 22 installs-eligible only 12 install before patience expires, 6 expiring with interest penalties. Same spend, one-third the yield — the coverage/backlog coupling from v2.1 §13.7 now falls out of the math instead of being asserted.

### V2.2-3.3 Bottleneck identification — redesigned around the flow model

**Problem.** "Earliest stressed resource" (v2.1 §6.6 step 4) is wrong: on a shared path, the binding constraint is where the flow's *allocated share* is smallest, which need not be the first stressed hop; and a single scalar hid co-occurring faults.

**A. Throughput constraint (per flow, per path).** For a customer's path, enumerate the serial shared resources (PON port, sector, backhaul, aggregation link, core link, transit, peering egress). Each resource `r` has capacity `C_r`, current carried load `L_r` (from *other* traffic), and this flow's demand `d`. Allocation rule (the flow model's multiplexing policy): competing flows share fairly — the flow gets `a_r = min(d, (C_r − L_r) × d / (d + L_r_competing_demand))`, computed simply as: **the flow's delivered rate through r is `min(d, C_r − L_r)`** when the flow's own demand is included in L_r proportionally. End-to-end delivered throughput = `min over r of allocated_r`. **The bottleneck is the arg-min resource.** This is a minimum-capacity calculation, valid here because the flow model already defines load sharing per resource (documented: no TCP-window or queueing dynamics are simulated; min-capacity over allocation shares is exact *within this model*).

**B. Non-throughput constraints** are evaluated separately as **fault flags**, never merged into the throughput scalar: optical no-sync (path dead — throughput undefined), Rx overload flapping, wireless LoS/Fresnel failure, packet loss above threshold, latency above QoE threshold, routing failure (no path), device resource exhaustion (sessions, CPU), upstream outage, configuration faults. A customer can have a fault flag *and* a throughput bottleneck; both are reported.

**C. Player-facing diagnosis** (per affected customer or aggregate): **primary limiting resource** (the arg-min, with its constraint type from v2.1 §6.6's classification), **contributing constraints** (any other resource within 20% of the min — "your sector *and* your backhaul are both nearly binding"), **fault flags** if any, **affected customers** (topology-derived), **affected services**, **estimated revenue at risk** (sum of MRR of affected subscribers), and **evidence** (the measurements: utilization samples, Rx power, SNR, probe results — attachable to tickets/postmortems per v2.1 §14.4). The UI distinguishes **confirmed** (measured saturation or hard flag) from **suspected** (threshold-crossing without saturation evidence).

**D. Fleet aggregation.** Each customer is attributed to **exactly one** primary binding constraint (the arg-min of their path) — revenue never double-counts. A customer with multiple constraints counts once, under the arg-min. Shared infrastructure affecting different clusters accumulates normally. Customers with multiple services (internet + SLA voice) count their *highest-value* affected service. **Incidents vs persistent limits** are tracked separately: incident windows (temporarily binding, e.g. rain fade) roll into incident analytics; persistent capacity constraints roll into the §19-era bottleneck marker. The dashboard marker = `Σ MRR(customer)` over customers whose *persistent* arg-min is that resource (v2.1's revenue-weighting, now with non-double-counting and incident/persistent separation). USE triad (v2.1) remains the *detector*: utilization/saturation/errors flag candidate resources for path evaluation; arg-min decides the binding one. **Test case TC-3:** customer on a 1:16 tree whose PON port has 400 Mbps free of 2,488 and a backhaul with 500 Mbps free: throughput demand 300 Mbps → PON allocated 400 ≥ 300 OK, backhaul 500 ≥ 300 OK, but with 4 neighbors also pulling, backhaul competing load leaves allocated 260 < 300 → **backhaul is the bottleneck** even though the PON port is the more-utilized resource in percentage terms — the earliest-stressed rule of v2.1 would have misidentified it.

### V2.2-3.4 Forecasting and before/after comparison — specified

- **Sampling:** every game-tick (1 h default) writes a sample per metric per resource; heavy clients aggregate to 5-min-equivalent only for the current day's live view.
- **Aggregation:** hourly samples → daily stats (mean, max, **busy-hour p95** = 95th percentile of that day's hourly utilization samples) → weekly/monthly rollups.
- **Peak/off-peak:** peak = busy-hour window (per-cluster diurnal mode: residential evening, business day); off-peak = the complement. Both labeled.
- **Forecasting:** minimum **30 days** of history; linear least-squares trend on busy-hour p95; horizon capped at **2× the history length, max 90 days**; seasonal demand (school terms, holidays) is handled by fitting on the trailing window of the *same seasonality class*; when trend fit R² < 0.5 the panel says "no stable trend" instead of drawing a line.
- **Labels** (mandatory in UI): **Observed** (measured), **Estimated** (computed from model, e.g. revenue-at-risk), **Forecast** (projection), with an uncertainty band; forecasts are never rendered as fact.
- **Upgrade re-baselining:** a config/topology change stamps the telemetry stream; before/after windows (v2.1 §14.4) compare trailing-14-day windows on either side of the stamp; the *forecast* series is re-fit from post-change data only — pre-change history is kept for comparison but excluded from extrapolation. **Test case TC-4:** a sector upgrade on day 100: forecast made on day 99 says saturation in 45 days; the day-130 re-fit (30 post-upgrade days) shows the new trend — the UI shows both, the old one marked superseded.

### V2.2-3.5 Research Laboratory rewards — evaluation rules, no farming

- **Falsifiable hypothesis** = a numeric prediction with a stated tolerance on a defined measurement ("1:32 split at 4 km loses sync below −27.2 dBm Rx ±0.5"), not a topic ("test splitters"). The UI enforces: hypothesis, metric, predicted value, tolerance.
- **Valid setup** = the bench's equipment class covers the tested parameter (testing C+ budgets requires C+ optics — v2.1's wrong-optics trap becomes an explicit *validity flag* on the experiment record).
- **Wrong-but-specific hypotheses pay.** Reward = `Insight_base × validity × interpretation`, where interpretation rewards *correctly reading the results* (did the conclusion match the sim's actual behavior, whatever the prediction said). A specific, valid, correctly-read experiment pays full reward **whether or not the prediction was right** — surprise is learning (v2.1 principle, now mechanical).
- **Insufficient equipment:** the experiment runs; the record is stamped *reduced validity* (×0.5 reward); the report says what the bench couldn't control.
- **Inconclusive results** (prediction tolerance overlaps the measurement noise band): ×0.5 reward, and the experiment may be **rerun once** with more repetitions — repetitions narrow the noise band; this is the game teaching measurement discipline, not a pun.
- **Duplicates:** first instance of a hypothesis *class* (same experiment template + same parameter values) pays full; repeats pay 10% and auto-fill from the recorded result — farming identical experiments yields nothing.
- **Records:** every experiment writes a lab-notebook entry (setup, prediction, measurements, conclusion, validity stamps) — reusable as evidence in tickets/postmortems and as *prior* for the research tree's related unlock (a completed, correctly-read experiment grants a 20% Insight discount on the adjacent research node — once).
- **No-loop check:** Insight sources remain bounded by content (hypothesis classes are finite per lab domain) and by validity gating. **Test case TC-5:** running "1:16 vs 1:32 at 3 km" with a falsifiable prediction and valid bench pays 12 Insight; repeating it pays 1.2; running it with B+ optics where C+ was required pays 6 and stamps reduced validity; running with a vague hypothesis ("splitters are lossy") is rejected at setup.

### V2.2-3.6 Corrections summary

| Issue | Original v2.1 behavior | Problem | Revised rule | Affected sections | Test case |
| --- | --- | --- | --- | --- | --- |
| Optical limits | Single "−27 dBm floor" | Sensitivity/overload/warning conflated | Parameter table (V2.2-3.1); one vocabulary everywhere | v2 §7.2, v2.1 §6.5, §14.5, §18.1 | TC-1 |
| Campaign math | Underdefined formula | Units, overlap, exposure unspecified | Household-level exposure accumulators + seeded draws (V2.2-3.2) | v2.1 §13.4–13.8 | TC-2 |
| Bottleneck | Earliest stressed resource | Wrong for shared paths; single scalar hides faults | Arg-min of allocated share + separate fault flags (V2.2-3.3) | v2.1 §6.6, §14.4, v2 §19 | TC-3 |
| Forecasting | "Linear trend" unspec'd | No sampling/horizon/seasonality rules | V2.2-3.4 spec with mandatory labels | v2.1 §14.4 | TC-4 |
| Lab rewards | "Wrong hypothesis pays" asserted | Evaluation criteria undefined; loops open | Reward = base × validity × interpretation + dedup (V2.2-3.5) | v2.1 §18.1 | TC-5 |

---

## V2.2-4. Four ISP Business Systems Expanded

### V2.2-4.1 Competitor Intelligence & Market Response (new §10.5; expands v2 §10.4)

**Competitor profiles** (data-driven, 2–5 per region per v2 §10.4): company size and treasury depth; access technology mix (FTTH/WISP/hybrid); coverage footprint (cluster list); spare capacity; package prices and tiers; delivered-quality stats; brand reputation per segment; expansion appetite; marketing budget; operational staff depth; **risk tolerance** (how much margin loss a price war can absorb before the board flinches). Profiles are asymmetric and *observable in parts* — see intelligence tools below.

**Competitive actions** (each with cash/ops cost and a lead time; competitors are companies with balance sheets, not event spigots): price cuts on a named package; new speed tier; free-install promos; time-boxed campaigns; FTTH build into a cluster; new tower/sector; backhaul upgrade; upstream change; targeting underserved clusters; pursuing business/institutional contracts; support-staff hiring (their ticket response times actually improve).

**Reaction model** (no omniscience, no instant response): competitors observe **public signals only** — player prices (public), coverage built (visible on the map), marketed campaigns (visible), public churn (their own sales data), local demand growth (market survey equivalent). Decision cadence: monthly board-style review per competitor, staggered across months; reaction delay 1–3 months after the signal; larger strategic moves (market entry, overbuild) cost more and need treasury headroom, so capital-constrained rivals *can't* answer everything. Competitors misread sometimes: a noise term can make them answer a player's promo with an over-reaction into the wrong cluster (documented abstraction; keeps the AI from feeling like a chess engine).

**Customer choice model** (how customers evaluate ISPs — a cheaper provider does not automatically win): each prospect/subscriber weighs `price (weight by segment) + advertised speed + *delivered* speed (evidence: their own experience, neighbor word-of-mouth) + reliability record + install wait + support quality + reputation`. Segment weights differ: residential leans price/speed-per-dollar; small business leans reliability/support; institutional leans SLA track record and compliance standing. A cheap rival with a congested network loses to a mid-price rival that delivers — the player's own §6.5 delivered-vs-advertised metric is thus also a *marketing weapon*.

**Player intelligence tools** (public vs paid, per the observability asymmetry): competitor coverage map and public package comparison — free (their ads and builds are visible); market-share estimates per cluster — free but lagged and coarse; competitor expansion reports / sales intelligence — paid (in-game "market research" purchases with per-cluster accuracy); customer surveys — paid, reveal *satisfaction with rivals* in a cluster; competitor service-quality reports — expensive, partial (sampled speed tests, not their internal stats). Nothing reveals a rival's treasury — their *behavior* (stopping expansions mid-build) is the tell.

**Tradeoffs enforced:** price wars buy share and burn margin on both sides (competitors have risk tolerance and will sue for peace via market-splitting sometimes); overbuild protects share and wrecks CAPEX ratios; quality-first supports premium pricing but is slow; a rival's outage window is an acquisition opportunity that *their* recovery marketing will try to close; aggressive expansion strains both companies — and the AI can go broke, triggering a §20-era acquisition event.

**References.** APJII's operator survey (verified) grounds the competitor mix and constraints (infrastructure cost, rural reach, competition itself as top growth barriers). Boik & Takahashi 2020, *AEJ: Micro* 12(1):156–87 (verified): competition reshaped an incumbent cable firm's price-quality menu — incumbents introduced additional medium/high-quality offerings under entry; this grounds "competitors respond to entry with *product changes*, not just price cuts." Hogue & Rennhoff 2026, *Information Economics and Policy* 73, art. 101173 (verified): Google Fiber's Nashville entry drove incumbents' *heterogeneous, technology-constrained* responses (AT&T built FTTP where exposed; Comcast upgraded DOCSIS everywhere) — this grounds archetype-differentiated reactions and the rule that a rival's response depends on *their* installed base. All three inform *structure*; the reaction delays, noise, and weights are game abstractions (documented).

### V2.2-4.2 Infrastructure Maintenance & Asset Lifecycle (new §14.6 + §10.6; expands v2 §11, §14.3, §15, §16)

**Asset registry (§14.6).** Every *tracked-class* asset gets a record: unique ID, type, location, install date, cost, spec, state, connected infrastructure, maintenance history. Tracked classes: fiber segments, poles/ducts, splice closures, splitters, OLTs, routers/switches, sectors/antennas, towers, power systems (UPS/battery/genset), POP facilities. **Not tracked per-unit at MVP:** ONTs and CPEs (tracked as a count per tree/sector with a fleet-age histogram — v2's wear model continues on the aggregate). This is the "do not require full asset-level tracking in MVP" rule, made concrete: full per-unit tracking unlocks with the v0.5 registry screen.

**Condition & degradation (extends v2's wear model with asset-family physics).** Passive fiber (closures, splitters): degrades via *events* (water ingress, splice degradation, dig damage) — no aging clock, because passive optics don't wear in the simulated horizon (documented: real fiber has finite life; the game's 6-year arc doesn't need it). Active electronics (OLTs, routers, sectors): MTBF-hazard curves modified by thermal stress, power instability, dust/heat environment. Outdoor wireless: alignment drift after wind events, weather-seal wear. Power systems: battery cycle aging, genset exercise requirements. Poor installation quality (v2 §13.3 workmanship) seeds *permanent* condition penalties — a sloppy splice is a silent +0.4 dB on the path until the OTDR finds it.

**Maintenance types** (each with cost, duration, staff, tools, service impact): **corrective** (after failure — the default), **preventive** (scheduled against the hazard curve — reduces failure probability for a window, per ITU-T M.3370's preventive-maintenance task model: entity classification, triggering rules, work orders, execution, verification), **condition-based** (triggered by observed condition: rising error counters, declining margin, water-detection alarms — the OTDR and monitoring stack from §11/§14.2 are the sensors), **emergency** (urgent response premium: faster mobilization cost ×1.5–2, overtime), **replacement/upgrade** (asset EOL or capacity). Work orders join the same technician queue as installs and incidents (§16.3) — one workforce, three demand streams; priority rules decide who rolls.

**Maintenance planning:** schedules, backlog, work orders (modeled on M.3370's work-order generation: plan, priority, scope, time, resources), tools/spares requirements, travel time (v2 §16), priority, and **planned outage windows** — advance customer notification reduces SLA penalties (v2 §14.3's mechanism, generalized).

**Reliability metrics** (each defined): **MTBF** — observed mean time between failures per asset class (the sim uses hazard rates internally; MTBF is the *reported statistic* — the game explicitly does **not** use MTBF as a deterministic countdown; failures are stochastic draws against condition). **MTTR** — mean time to repair, from incident history (a *result* of staffing, spares, travel — not a setting). **Failure rate**, **asset availability** (uptime/total per asset), **repeat-incident rate** (same asset twice in 30 days — a quality signal), **maintenance cost per asset**, **PM completion rate**, **spares fill rate**.

**Spares & inventory (lightweight):** stock lines per consumable class (SFPs, splitters, drop cable, patch cords, batteries); min-stock and reorder point per line; procurement lead time (instant local / days for import); emergency procurement premium; stockout = the repair waits for the part; warehouse holding cost is deliberately *not* modeled at MVP (working-capital cost is implicit in the purchase — documented simplification).

**Tradeoffs:** PM spends money before any failure (its ROI is invisible until the failure that *didn't* happen — the analytics §14.4 incident-correlation view is how the player sees it); skipping maintenance on a justified-condition asset is a real gamble (R1: the hazard curve decides, not a dice-flavored event); emergency repair is fast and expensive; poor documentation (never writing the maintenance history) makes the *next* tech slower (troubleshooting time penalty — the registry pays for itself); spares stock cuts MTTR and ties up cash; planned windows cost brief availability but prevent bigger outages.

**References.** ITU-T M.3370 (03/2025) (verified): preventive-maintenance task overview — entity classification, triggering rules, work orders, execution/verification — grounds the PM/work-order workflow. ITU-T G.650.3 (08/2017) (verified): test methods for installed fiber links (attenuation via LSPM, OTDR trace/splice analysis) — grounds condition-based maintenance and the OTDR's diagnostic role. ITU-T L.315 (verified): water detection in underground closures — grounds the water-sensor/condition-alarm mechanic. These references support *workflows and methods*; all maintenance costs, hazard rates, and thresholds are balancing values.

### V2.2-4.3 ISP Upstream, Transit & Peering Business (new §9.5; expands v2 §9, §12, §18, §19)

**Connectivity arrangements** (building on v2 §9.1–9.3, which stay): single IP transit; multiple transit providers; public peering at the IXP; private peering (PNI); regional/local upstream; content caching arrangements (a content network installs a cache box in your POP — reduces transit volume, free but rack/power/courtesy-peering strings). **The transit/peering distinction is explicit in-game and in the field guide:** *transit* is paid reachability to the whole default-free zone; *peering* is settlement-free (usually) exchange of *each other's and each other's customers'* traffic only. **Peering never replaces transit** — someone must carry the rest of the internet — and peering is not free: ports, cross-connects, transport to the exchange, and the route-server relationship all cost (Internet Society's cost-of-peering study, verified, found port fees average ~44% of total peering cost — the rest is the cross-connects, transport, and ops nobody itemizes).

**Transit provider profiles** (data-driven balancing values, per the brief's "not invented industry facts"): coverage/POPs, available capacity tiers, price model (flat-rate commit, committed + burst, 95th-percentile), SLA class (availability + latency targets with credits), reliability history (their actual outage record, generated), contract duration, install/cross-connect cost, **upgrade lead time** (raising your commit takes weeks — capacity planning must lead demand, feeding §14.4 forecasting).

**Transit billing models:** MVP ships **flat-rate capacity** and **committed bandwidth (+overage)**; **95th-percentile** billing lands in v1.0 with the analytics depth (busy-hour p95 is already the forecast metric — the billing model and the NOC finally share a number, which is the whole pedagogical point). Model choice changes player decisions: flat-rate rewards predictable over-provisioning; 95th-percentile rewards traffic engineering and off-peak scheduling (a real ISP behavior the game otherwise couldn't teach).

**Public peering / IXP** (v2 §9.3 mechanics, now costed): membership fee, port speed (1/10 G), monthly port fee, cross-connect cost, route-server participation (multilateral peering without per-peer sessions — ISOC policy brief, verified), available peer set (content networks, other ISPs — each with their own peering policy per v2 §9.3), **local traffic ratio** (the fraction of your traffic that has a local peer — the IXP's whole value; the ISOC IXP policy brief, verified, grounds "keeping local traffic local" reducing transit dependence, latency, and cost, and strengthening resilience to submarine-cable disruption — which the game models as geopolitical/upstream disruption events). Limits stated plainly: not all networks will peer with you; not all destinations are reachable via the IXP; IXPs have real costs; peering policy conflicts (a content network demanding private peering ratios before public) are events.

**Private peering (PNI):** bilateral agreement + cross-connect + port capacity; worth it when traffic ratios to one network are high (the cache/CDN case); MVP keeps it to "meet-me-room, two ports, one decision."

**Multi-homing & redundancy:** v2 §9.2's policy layer extended with **path diversity**: two upstreams riding the *same physical fiber* share a failure domain — the sim knows, and a digger will prove it. Meaningful diversity = different providers × different physical paths × different POP entry. Failover (primary/backup via local-pref, v2), capacity distribution (load-split ratios), provider-outage events, added recurring cost, and configuration complexity (route-policy mistakes are now *reachable* by the player — the v2 route-leak incident class gets its enabler).

**Routing & operational requirements** — the MANRS loop (verified references): when the player owns an ASN (v2 §9.2), the game tracks four operational practices modeled on MANRS's actions: **filtering** (announce only what you legitimately hold; validate customer announcements — sloppy filtering enables the route-leak incident), **anti-spoofing** (source validation at the edge — reduces the DDoS-reflection exposure from §15.4), **coordination** (maintaining contact/policy records — speeds incident resolution when *you* are the victim), and **global validation** (IRR/RPKI registration — other networks' route-validation events can *drop* your prefixes if you don't; a real operational failure mode, grounded in MANRS-003.01's actions and the implementation guide's IRR/RPKI workflow). These are decisions with costs (ops time, registration effort) and consequences (incidents prevented or caused) — not checkboxes.

**Economic & customer impact** — the comparison the player can actually run (§12.6 + §14.4): cost per Mbps, transit cost per subscriber, peak utilization, latency to local vs international destinations, packet loss, availability, revenue at risk, gross margin. Strategy compare (all viable, none dominant — enforced by region data: a low-IXP-participation region makes peering weak; a distant-from-content region makes latency dominates): cheap single upstream / premium single upstream / dual transit / transit + public peering / multi-homed + local peering + caches.

**Research hooks** (existing tree only, v2 §18 "Core routing" branch — no duplicates): BGP fundamentals → multi-homing → route policy → IXP operations → **RPKI & routing security** (new node, grounds the MANRS loop) → traffic engineering.

**Test case TC-6:** Region with 55% local-content traffic ratio and a functioning IXP: single-transit strategy at $1.20/Mbps on 1 Gbps commit costs $1,200/mo; transit(500 M) + IXP port(1 G) + cross-connect costs $600 + $250/mo and offloads 45% of peak traffic → effective $0.90/Mbps all-in, lower latency to local content, and one more failure domain — but two new incident classes (IXP route leak, peering dispute). The strategy compare panel shows exactly this ledger from §12.6 data.

### V2.2-4.4 Cybersecurity & Network Resilience

*(New system; integrates v2 §9, §14, §15, §16, §18, §21 and §23)*

#### Design principle

Cybersecurity is an operational capability integrated into network operations, incident management, asset management, routing, and business risk. It is not a separate minigame.

The player operates an ISP whose infrastructure can be exposed to malicious traffic, vulnerable firmware, routing manipulation, compromised credentials, and service disruption. Security decisions affect availability, delivered quality, SLA performance, customer trust, revenue, and operating costs.

The system has two related but distinct domains:

- **Vulnerability management:** identifies and prioritizes weaknesses in hardware, firmware, software, and configuration.
- **Threat and incident management:** models malicious activity, its detection, its impact on infrastructure, and the player's response.

A vulnerability can enable an attack, but an attack does not necessarily require a vulnerability. For example, a volumetric DDoS attack can saturate an upstream link even when the targeted router has no known CVE.

The simulation remains deterministic, tick-based, and flow-level. It does not simulate individual malicious packets, real exploit payloads, or executable malware.

#### A. Vulnerability Management

**Standards and identifiers.** The system uses the following terminology:

- **CVE:** identifier for a publicly documented vulnerability.
- **CVSS:** Common Vulnerability Scoring System, a standardized vulnerability severity scoring framework.
- **CWE:** classification of the weakness type behind a vulnerability.
- **CISA KEV:** a catalog of vulnerabilities with evidence of exploitation in the wild; used as a threat-priority signal, not as a severity score.
- **Vendor advisory:** information about affected products, firmware versions, patches, and mitigations.

CVSS v4.0 is the default scoring reference (verified against FIRST's specification: metric groups Base/Threat/Environmental/Supplemental; nomenclature CVSS-B/BT/BE/BTE; Table 22 severity scale). The UI must identify which metric groups are represented by a displayed score:

- CVSS-B: Base metrics.
- CVSS-BT: Base + Threat.
- CVSS-BE: Base + Environmental.
- CVSS-BTE: Base + Threat + Environmental.

CVSS Base measures vulnerability severity, not the complete business risk — the CVSS v4.0 User Guide states this explicitly, and the game follows it. The game must not present a CVSS number as the probability of an attack or the financial impact of an incident.

**Severity bands (CVSS v4.0, Table 22)**

| Score | Severity |
|---:|---|
| 0.0 | None |
| 0.1–3.9 | Low |
| 4.0–6.9 | Medium |
| 7.0–8.9 | High |
| 9.0–10.0 | Critical |

**Vulnerability record.** Every vulnerability record contains:

- `vulnerability_id` — CVE identifier or internal fictional ID.
- `cwe_id` — weakness classification, if applicable.
- `title` and `description`.
- `affected_vendor`, `affected_product`, `affected_versions`.
- `cvss_version`, `cvss_score`, `cvss_severity`, `cvss_vector`.
- `score_type` — CVSS-B, CVSS-BT, CVSS-BE, or CVSS-BTE.
- `known_exploited` — whether the vulnerability appears in the simulated KEV intelligence feed.
- `patch_available`, `mitigation_available`.
- `disclosed_at`, `advisory_at`, `patch_released_at`.
- `affected_asset_ids`.
- `status` — Open, Mitigated, Patched, Accepted Risk, or Not Affected.

A vulnerability is attached to a specific asset and software/firmware version. It must not automatically affect every device of the same broad category.

**Asset exposure.** The game derives exposure from the asset's actual topology and configuration:

- Publicly reachable management interface.
- Management interface reachable only from internal networks.
- Isolated management plane.
- Customer-facing service.
- Upstream-facing routing device.
- Administrative access protected by MFA or other controls.
- Existing firewall, ACL, and network segmentation rules.

Exposure is a game-side risk attribute. It does not silently modify the official CVSS Base Score.

**Risk prioritization.** The remediation priority is a separate game calculation informed by:

1. CVSS severity.
2. Active exploitation intelligence (KEV-like signal).
3. Asset exposure and reachability.
4. Asset criticality and dependent customers/services.
5. Existing compensating controls.
6. Patch or mitigation availability.
7. Operational cost and maintenance-window constraints.

The output is a priority class — Informational, Low, Medium, High, or Critical — with a visible explanation of the factors. It is not labeled as an official CVSS score.

A critical CVE on an isolated lab device may be less urgent than a high-severity vulnerability on an internet-facing core router. A DDoS attack may be urgent even when no vulnerability is present.

**Player actions**

- Apply vendor firmware/software patch.
- Schedule a maintenance window.
- Apply temporary ACL or firewall mitigation.
- Restrict management-plane reachability.
- Enable MFA or strengthen administrative access.
- Isolate an affected asset.
- Replace unsupported equipment.
- Accept the risk temporarily, with a recorded reason and review date.

Patching may require a maintenance window, configuration backup, compatibility check, staff time, and a possible service interruption. A failed upgrade can create a separate operational incident.

#### B. Threat and Attack Taxonomy

The game uses a controlled attack taxonomy based on real network-security references. Each attack is represented as a simulation event, not as a packet generator.

**1. Denial of Service (DoS) and Distributed Denial of Service (DDoS)** — taxonomy anchored to MITRE ATT&CK T1498 (Network DoS: direct flood, reflection/amplification) and T1499 (Endpoint DoS: service/OS resource exhaustion *without* saturating the access network).

| Attack class | Real-world behavior | Simulated target and effect |
|---|---|---|
| Volumetric flood | Malicious traffic consumes network bandwidth | Transit, upstream, aggregation, or target link saturation |
| Protocol/state exhaustion | Network or transport protocol processing resources are exhausted | Router/firewall session capacity, connection tracking, or service state exhaustion |
| Application/service exhaustion | Requests consume application or server resources | DNS, customer portal, billing, authentication, or other hosted service degradation |
| Reflection/amplification | Third-party services reflect or amplify traffic toward a victim | High inbound traffic volume and difficulty filtering legitimate-looking traffic |

The simulation tracks: attack traffic volume (Gbps/Mbps), targeted link or service, available network capacity, device CPU/session capacity where relevant, legitimate traffic displaced by malicious traffic, detection delay and mitigation delay, customers and services affected, attack duration and recovery time.

A volumetric attack exceeding the upstream access capacity cannot be solved solely by an on-premises firewall (the CISA/FBI/MS-ISAC DDoS guide's core mitigation lesson: filtering must happen upstream of the constrained link). The player may need upstream filtering, a DDoS scrubbing provider, traffic diversion, or an upstream provider's assistance. Protocol and application attacks use resource-exhaustion abstractions; they do not require packet-level TCP or HTTP simulation.

**2. Routing and interconnection attacks**

| Attack | Real-world behavior | Game consequence |
|---|---|---|
| BGP prefix hijacking | Unauthorized or incorrect origin announcement | Traffic diversion, reachability loss, or service outage |
| BGP route leak | Routes propagate beyond intended routing policy | Unexpected path, congestion, or reachability degradation |
| IP spoofing | Source address is forged | Increased exposure to reflection attacks and attribution difficulty |
| Misconfigured route filters | Invalid announcements are accepted or propagated | Accidental routing incident |
| RPKI origin-validation failure | Invalid or incorrectly registered origin information affects route acceptance | Prefix rejection or loss of reachability, depending on external policy |

These attacks and misconfigurations directly integrate with V2.2-4.3's upstream, peering, ASN, BGP policy, and MANRS practice loop.

**3. DNS and service attacks**

| Attack/event | Target | Game consequence |
|---|---|---|
| DNS query flood | Recursive or authoritative DNS | High query load, slow resolution, or DNS outage |
| DNS cache poisoning | Resolver/cache integrity | Incorrect destination resolution |
| DNS infrastructure failure | DNS service or upstream dependency | Customers cannot resolve domain names |
| Service exhaustion | Portal, billing, authentication | Service unavailable despite network connectivity |

The game distinguishes DNS service failure from general internet connectivity failure: a customer may have an operational access link and still be unable to resolve domains.

**4. Internal infrastructure compromise**

| Threat | Target | Game consequence |
|---|---|---|
| Credential compromise | NOC, router, VPN, or administrator account | Unauthorized administrative access |
| Brute-force attempts | Exposed management service | Account lockouts, CPU/session load, or compromise if controls are weak |
| Malware/ransomware | OSS/BSS, billing, internal servers | Service disruption, recovery cost, data-integrity risk |
| Phishing | Employees | Credential compromise or unauthorized access |
| Exploitation of vulnerable service | Router management, DNS, portal, or server | Asset compromise, service outage, or lateral impact |

These threats are introduced gradually as the workforce, management plane, customer portal, and business systems become more developed.

#### C. Attack Event Model

An attack is generated by the deterministic Threat Event Engine.

**Attack event inputs:** world seed and event ID; attack class and target class; threat intensity and duration; attack source distribution (abstracted); target asset and topology; asset exposure; known vulnerability relationship, if any; existing security controls; detection capability and response readiness. The engine does not generate real attack traffic — it generates an abstract demand or resource-pressure value consumed by the existing flow and resource simulation.

**Attack resolution**

- Network-targeting attacks: `effective_load = legitimate_load + malicious_load`; `available_capacity = max(0, resource_capacity − effective_load)`; the existing flow model then determines delivered capacity for legitimate traffic.
- Service-targeting attacks: `service_load = legitimate_requests + malicious_request_pressure`; the service's abstract processing capacity determines queueing, latency, errors, and availability state.
- Routing attacks: the engine modifies the simulated route state or route validity, then the existing routing and topology logic calculates affected paths.

These are game abstractions, not exact packet-level behavior.

**Vulnerability exploitation relationship** — an attack event has one of three relationships:

- `exploits_vulnerability`: an identified vulnerability is required for the simulated compromise.
- `abuses_exposure_or_configuration`: the attack takes advantage of a reachable service or weak configuration.
- `capacity_or_protocol_attack`: the attack targets finite network or service capacity without requiring a CVE.

This distinction prevents the game from incorrectly associating every DDoS incident with a vulnerability record.

#### D. Detection, Security Operations, and Response

Detection sources (all existing NOC instruments): interface utilization and traffic anomalies; packet-loss and latency measurements; router/firewall CPU and session utilization; DNS query rate and resolver health; BGP route changes and prefix-validation state; authentication failures and unusual administrative access; vulnerability advisories and patch status; IDS/IPS alerts and upstream provider notifications.

Detection quality depends on: monitoring coverage, sensor placement, threshold configuration (§14.5 classes), telemetry availability, staff skills and staffing levels (§16), detection tooling and service contracts. The game distinguishes `observed` (directly measured or reported), `suspected` (inferred from incomplete evidence), and `confirmed` (supported by sufficient measurements or correlated alerts) — the same confidence vocabulary as V2.2-3.3's diagnosis. An attack may begin before detection; detection delay therefore matters to customer impact.

**Response capabilities**

| Control | Gameplay function | Cost/limitation |
|---|---|---|
| ACL/firewall filtering | Blocks selected traffic classes | Can block legitimate traffic if poorly configured |
| Rate limiting | Limits request or traffic rates | May reduce legitimate peak throughput |
| IDS | Detects suspicious behavior | Does not automatically block attacks |
| IPS | Detects and blocks selected attack patterns | Processing capacity and false-positive risk |
| Upstream DDoS scrubbing | Filters traffic before it reaches constrained links | Service fee, capacity tier, activation delay |
| RTBH | Drops traffic toward a targeted destination | Can make the destination unreachable |
| BGP FlowSpec | Distributes traffic filtering rules | Requires provider and routing support; misconfiguration risk |
| Source Address Validation/uRPF | Reduces spoofed-source traffic | Deployment and topology considerations |
| RPKI/ROV | Validates route origin information | Requires correct ROA and routing-policy management |
| Network segmentation | Limits lateral reachability | Configuration and operational complexity |
| MFA | Strengthens administrative access | Staff and management overhead |
| Backup and recovery | Restores systems after compromise | Backup cost, restore time, and testing requirements |

Controls must be available only when their required infrastructure, provider support, research, or operational capability exists.

**False positives and tradeoffs:** aggressive filtering may block legitimate customers; RTBH may protect the rest of the network but blackhole the attacked destination; FlowSpec requires compatible upstream support; scrubbing costs money and adds path complexity; patching reduces exposure but creates maintenance downtime; MFA and segmentation require staff time and operational discipline. No single control dominates every scenario.

#### E. Incident and Business Impact Integration

Security incidents use the existing incident model (v2 §15) and extend its record with: `security_event_id`, `attack_class`, `attack_vector_class`, `target_asset_ids`, `related_vulnerability_ids`, `exploitation_relationship`, `detection_source`, `detection_confidence`, `mitigation_actions`, `false_positive_state`, `data_integrity_impact`, `confidentiality_impact`, `availability_impact`, `recovery_actions`, `postmortem_reference`.

Pipeline: `Threat Event → Asset/Topology Resolution → Resource/Service Impact → Detection → NOC Incident → Response → Recovery → Postmortem`. The incident resolver uses the same topology and customer attribution logic as existing network incidents — it must not independently invent affected-customer counts.

Business impact: affected subscribers and business customers; revenue at risk and SLA credits; service availability and delivered-quality changes; churn and reputation impact; incident response labor; upstream mitigation and scrubbing fees; replacement, patching, and recovery costs; data restoration and business-system downtime where applicable. Revenue attribution reuses V2.2-3.3's non-double-counting customer attribution rules.

#### F. Threat Intelligence and Security Research

The Threat Intelligence panel presents: new vulnerability advisories; affected product and firmware versions; CVSS score and vector (with score_type nomenclature); active exploitation indicator; known mitigation or patch; affected player assets; recommended priority and reasoning.

The game may use real-world CVE/CVSS examples as educational references, but the main campaign content uses fictionalized vendor and product identities. Real CVE scores must not be fabricated or altered while retaining the original CVE identifier; fictional vulnerabilities must not borrow real CVE identifiers.

Research: the listed security nodes join v2 §18's existing **Security branch** (v2 had "Hardening programs, scrubbing partnerships"; conflict resolved: the branch keeps its identity and gains these nodes) — network security fundamentals; firewall and ACL operations; IDS/IPS operations; DDoS detection and mitigation; source address validation and uRPF; RPKI and route origin validation (joins the node V2.2-4.3 already added — one node, two consumers); BGP filtering and routing security; DNS resilience; incident response and disaster recovery. Research unlocks capabilities and improves operational efficiency; it does not automatically patch assets or prevent attacks.

#### G. UI and Player Information

Panels extending the existing NOC and incident UI (no separate game mode): **Security Overview** (posture, open vulnerabilities by severity, exposed critical assets, active/recent security incidents, detection/response status, security OPEX); **Vulnerability Registry** (ID/CVE, CVSS score/vector, affected assets and versions, exposure and criticality, patch availability, remediation priority and status); **Threat Intelligence** (advisory feed, exploitation status, affected products, recommended actions, related incidents); **Security Incident Detail** (attack class and target; timeline: started/detected/mitigated/recovered; network and service impact; evidence and confidence; response actions and side effects; customer and financial impact); **Security Policy/Controls** (firewall and ACL policies, IDS/IPS coverage, DDoS mitigation contracts, RPKI/ROV status, source validation status, administrative access controls, backup and recovery readiness).

#### H. Security Test Cases

| Test | Setup | Expected result |
|---|---|---|
| SEC-1: CVSS vs risk | Critical CVE on isolated lab device; High CVE on exposed core router | UI preserves official CVSS values but prioritizes the exposed critical asset based on context |
| SEC-2: DDoS without CVE | Volumetric attack exceeds transit capacity; target has no known vulnerability | Legitimate traffic loses capacity; incident occurs without a vulnerability relationship |
| SEC-3: Local filtering limitation | Attack volume exceeds upstream link capacity; player enables only local firewall | Upstream link remains saturated; local filtering cannot restore capacity already consumed before the firewall |
| SEC-4: Upstream scrubbing | Same attack; player has compatible upstream scrubbing contract | Malicious load is filtered before the constrained link, subject to scrubbing capacity and activation delay |
| SEC-5: False positive | Player configures an overly strict ACL | Some legitimate traffic is blocked; the incident may be partially self-inflicted |
| SEC-6: BGP route hijack | Player lacks RPKI/ROV and appropriate prefix filtering | Affected routes may be accepted; traffic is diverted or becomes unreachable according to the simulated routing policy |
| SEC-7: RPKI deployment | Player has valid ROAs and upstream origin validation | Invalid-origin route is rejected by participating validation policy; valid routes remain usable |
| SEC-8: Credential compromise | Publicly exposed management service with weak access controls | Unauthorized access event may occur; impact depends on permissions, segmentation, and response |
| SEC-9: Patch maintenance | Critical vulnerable router receives a firmware patch | Patch closes the modeled vulnerability after a maintenance operation; upgrade failure remains a possible separate incident |
| SEC-10: Business attribution | DDoS affects a shared upstream serving several clusters | Affected customers, services, revenue at risk, and SLA impacts are derived from the actual topology without double-counting |

#### I. Scope and Simplifications

- No packet-level DDoS simulation.
- No real exploit execution, malware execution, or exploit payloads.
- No player-controlled botnet or offensive cyber operations.
- No real-world network scanning.
- No assumption that every CVE is exploitable on every device.
- No automatic use of a CVSS score as an attack probability.
- No automatic assumption that an IDS alert is a confirmed attack.
- No automatic assumption that every attack causes a network outage.

The system teaches defensive ISP operations: exposure management, vulnerability prioritization, capacity planning, routing security, detection, mitigation, recovery, and business continuity.

---

## V2.2-5. Cross-System Dependency Matrix

| System ↓ affects → | Cust. Acquisition | Analytics | Lab | Competitors | Maintenance | Upstream/Peering | Economy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Customer Acquisition** | — | funnel metrics, per-channel CAC | campaign experiments | visible player moves trigger reaction model | install queue competes for techs | — | CAC→MRR, promo price anchors |
| **Analytics** | leak-stage flags; campaign measurement | — | measurement validity; forecast re-baseline | market-share estimates; delivered-speed weapon | condition signals (error trends) drive CBM | transit utilization; forecast→capacity lead | revenue-at-risk; margin impact |
| **Lab** | — | before/after methodology source | — | (no direct) | maintenance-strategy pilots | upstream-strategy pilots | CAPEX/OPEX scenario pilots |
| **Competitors** | poach leads; counter-promos; choice model | public signals feed dashboards | — | — | (no direct) | (no direct) | price pressure; ARPU; churn |
| **Maintenance** | install wait times (shared queue) | MTBF/MTTR/availability stats | PM experiments | rival quality comparisons | — | POP power maintenance | OPEX lines; spares cash |
| **Upstream/Peering** | deliverable speeds (quality promise) | latency/loss paths; p95 billing data | strategy experiments | rival upstream quality | physical-path diversity checks | — | biggest OPEX line; margin |
| **Economy** | budget for campaigns | — | lab funding | competitor treasury actions | maintenance budget | transit contracts | — |

Interaction verification (the brief's ten checks): (1) competitor expansion → market opportunities & acquisition — via choice model reachable-pool ✓ (2) competitor promos → churn & campaign performance — via choice weights & counter-promo event ✓ (3) maintenance → condition, availability, OPEX ✓ (4) asset failures → incidents & work orders — one failure path, two consumers (ticket stream + WO) ✓ (5) maintenance backlog → MTTR → availability ✓ (6) upstream outage → customer experience → SLA ✓ (7) peering → routing path & transit share — local-traffic-ratio model ✓ (8) upstream cost → gross margin → package profitability ✓ (9) lab tests maintenance/upstream strategies pre-production (`applyLabConfig`, v2.1 §18.1 unchanged) ✓ (10) analytics identifies maintenance needs, competitor capacity pressure, upstream bottlenecks — all through §6.5/§6.6 instruments ✓. Shared calculations are single-source: delivered speed (flow model), revenue-at-risk (§6.6 arg-min attribution), busy-hour p95 (one sampler feeding forecasting *and* billing).

### V2.2-5.1 Cross-System Dependency Matrix — Cybersecurity Addendum

Add the following rows and columns to the existing matrix. Existing relationships remain unchanged.

| System ↓ affects → | Vulnerability Management | Threat/Incident Engine | NOC & Analytics | Maintenance | Upstream/Peering | Economy |
|---|---|---|---|---|---|---|
| Vulnerability Management | — | Exploitable asset state and attack relationship | Exposure and patch-status alerts | Patch work orders and maintenance windows | Router/BGP firmware and routing exposure | Patch, replacement, and mitigation costs |
| Threat/Incident Engine | May exploit a known vulnerability | — | Detection, alert, and incident timeline | Compromise recovery and asset inspection | Transit saturation, route manipulation, provider escalation | Revenue at risk, SLA credits, response costs |
| NOC & Analytics | Exposure and vulnerability evidence | Detection confidence and mitigation measurement | — | Condition and incident evidence | Traffic anomalies, route changes, upstream utilization | Incident cost and service-quality impact |
| Maintenance | Patch and replacement execution | Recovery work orders | Asset health and recovery verification | — | Router and POP maintenance | Labor, spare parts, downtime |
| Upstream/Peering | Routing software and policy exposure | DDoS, route leak, hijack, provider incidents | External telemetry and provider notifications | Physical path and device dependency | — | Transit, scrubbing, peering, SLA and recovery costs |
| Economy | Security investment budget | Financial impact of attacks | Security posture and risk reporting | Remediation and replacement budget | Redundancy and mitigation contracts | — |

**Security integration checks** (each must hold in implementation):

1. A vulnerable internet-facing router can produce a vulnerability alert and remediation work order.
2. A DDoS event can saturate an upstream resource without requiring a CVE.
3. An upstream scrubbing service can mitigate a network attack only if the provider, contract, capacity, and activation requirements are met.
4. RPKI/ROV and prefix filtering must affect the existing BGP route-resolution layer.
5. Security incidents must use the existing topology-based affected-customer calculation.
6. Patch installation must use the existing maintenance and technician queue.
7. Security response costs must enter the existing USD financial ledger.
8. IDS/IPS detections must distinguish suspected from confirmed incidents.
9. A false-positive control action may itself create service degradation.
10. Postmortem records must feed the existing analytics and research systems.

---

## V2.2-6. Real-World References (Quorum-#43 style; all URLs verified this session)

| System | Real-world behavior | Game implementation | Simplification | Gameplay reason | Real-world references |
| --- | --- | --- | --- | --- | --- |
| Optical parameters (V2.2-3.1) | GPON optics classes define Tx power ranges; receivers have sensitivity and overload specs at target BER | Class table (B+/C+ Tx/sensitivity/overload); budget = Tx_min − sensitivity; margin & warning thresholds separate | Per-vendor variance collapsed to class table; C+ sensitivity shown as vendor range | Margin-vs-limit decisions need three distinct numbers, not one | Cisco GPON SFP datasheet (B+/C+ optical tables) — https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/datasheet-c78-736392.html · FS GPON OLT B+ datasheet — https://resource.fs.com/mall/doc/20220927141612d9ln0j.pdf · ITU-T G.984.2 (class definitions) — https://www.itu.int/rec/T-REC-G.984.2/en |
| Fiber condition testing (V2.2-4.2) | Installed links are characterized by insertion loss and OTDR (splice loss/location, trace analysis); OTDR bidirectional analysis distinguishes splice loss from macrobending | OTDR tool localizes cuts and degraded splices; condition-based maintenance alarms from measured state | BOTDA/quasi-bidirectional methods omitted | CBM needs a *measurement* source, not a countdown | ITU-T G.650.3 (08/2017), test methods for installed SM fibre links — https://www.itu.int/epublications/ar/publication/itu-t-g-650-3-2017-08-test-methods-for-installed-single-mode-optical-fibre-cable-links/en |
| Water ingress (V2.2-4.2) | Water in splice closures degrades fibers/connectors; detection methodology and OTDR-based monitoring exist | Closure water-sensor accessory → condition alarm → work order | Sensor hardware abstracted to one catalog item | Gives passive plant a *sensorable* failure mode | ITU-T L.315, water detection in underground closures — https://www.itu.int/ITU-T/recommendations/rec.aspx?lang=en&rec=13568 |
| Preventive maintenance (V2.2-4.2) | PM task model: entity classification, triggering rules, monitoring, work orders, execution, verification | PM scheduling, triggering rules from condition, work-order pipeline (§14.6) | AI/sensor/drone tooling from the recommendation not modeled | Work orders competing with installs/incidents is the gameplay | ITU-T M.3370 (03/2025), telecommunication preventive maintenance task — overview — https://www.itu.int/epublications/ru/publication/itu-t-m-3370-2025-03-telecommunication-preventive-maintenance-task-overview/en |
| Competitor response (V2.2-4.1) | Entry reshapes incumbents' price-quality menus; incumbents add mid/high-quality offerings; responses differ by installed technology | Competitor actions include product-tier changes; reaction model is archetype- and installed-base-constrained | Reaction delays/noise are game abstractions | Competitors as constrained companies, not event spigots | Boik & Takahashi (2020), AEJ: Micro 12(1):156–87 — https://www.aeaweb.org/articles?id=10.1257/mic.20180303 · Hogue & Rennhoff (2026), Inf. Econ. & Policy 73:101173 — https://doi.org/10.1016/j.infoecopol.2026.101173 |
| ISP market structure (V2.2-4.1, §19) | Operator-reported segments, growth constraints, service/promotion practice | Segment weights; competitor mix; constraint-driven difficulty | Operator survey ≠ consumer conversion (stated) | Market structure from the operators' own reports | APJII, Survei Profil Industri dan Riset Pasar ISP — https://web.apjii.or.id/berita/d/apjii-rilis-survei-profil-industri-dan-riset-pasar-isp |
| Peering economics (V2.2-4.3) | Peering is cheaper than transit on average; port fees ≈ 44% of peering cost; benefits scale with peering intensity | IXP costing (port + cross-connect + transport); local-traffic-ratio model | Bilateral negotiation dynamics abstracted to policies | Peering as a computed strategy, not a free win | Internet Society, *Dissecting the Cost of Peering* (2026) — https://www.internetsociety.org/resources/doc/2026/dissecting-the-cost-of-peering/ |
| IXP role (V2.2-4.3) | IXPs keep local traffic local: lower transit dependence, latency, cost; resilience to international disruption (e.g., cable cuts); route servers enable multilateral peering | IXP mechanics + local-traffic ratio + resilience events (v2 §9.3 extended) | Per-peer policy negotiation simplified | The "why peer" lesson with its real limits | Internet Society, Policy Brief: IXPs and Local Interconnection Ecosystems (2026 update) — https://www.internetsociety.org/resources/policybriefs/2026/ixps-and-local-interconnection-ecosystems/ |
| Routing security (V2.2-4.3) | Operator norms: prefix filtering, anti-spoofing (uRPF/BCP38), IRR/RPKI documentation, incident coordination | MANRS-style practice loop with costs and incident consequences | Per-implementation detail (uRPF modes) abstracted to enabled/disabled practices | Security as operations, not a firewall checkbox | MANRS Actions for Network Operators (MANRS-003.01) — https://manrs.org/specifications/MANRS-003/01/ · MANRS Implementation Guide — https://manrs.org/netops/guide/ |
| Throughput method (V2.2-3.4, lab) | TCP throughput testing is a methodology (throughput vs offered load, buffer-delay variation) | Lab measurement discipline; delivered-vs-advertised metric | Methodology → flow-model sampling | "Did it work?" needs method, not vibes | IETF RFC 6349 — https://www.rfc-editor.org/rfc/rfc6349 |
| Bottleneck diagnosis (V2.2-3.3) | USE: check utilization, saturation, errors per resource | Detector layer of the redesigned algorithm | Triad from flow aggregates | Teaches the real habit | Brendan Gregg, The USE Method — https://www.brendangregg.com/usemethod.html |
| Regulatory (§17, unchanged) | Risk-based telecom licensing standards (PBBR), updated 2025 | Komtel ladder | Fictionalized procedure | Real regulatory shape | PM Komdigi No. 15/2025 — https://jdih.komdigi.go.id/produk_hukum/view/id/985/t/peraturan+menteri+komunikasi+dan+digital+nomor+15+tahun+2025 |
| Fixed-broadband price anchors (§19.2, converted) | Home-Wi-Fi spend bands (Rp 100–300k core band) | Residential USD ranges [P-c] | Subscriber bands ≠ WTP ceilings | Recognizable prices | APJII via Indonesia Baik — https://indonesiabaik.id/infografis/biaya-internet-an-orang-indonesia |
| Penetration context (§19.1, unchanged) | 72.78% internet access; ~1% fixed-line households | Market-tier growth frontier | National aggregates | Grounds the growth premise | BPS, Statistik Telekomunikasi Indonesia 2024 — https://www.bps.go.id/id/publication/2025/08/29/beaa2be400eda6ce6c636ef8/statistik-telekomunikasi-indonesia-2024 |
| Vulnerability severity (V2.2-4.4) | CVSS standardizes technical vulnerability severity using Base, Threat, Environmental, and Supplemental metrics | CVSS v4.0 score/vector shown in Vulnerability Registry | The game uses a bounded set of fictional vulnerability records for core gameplay | FIRST, CVSS v4.0 Specification — https://www.first.org/cvss/v4.0/specification-document |
| Vulnerability prioritization (V2.2-4.4) | CVSS Base alone does not represent full organizational risk; exposure and active exploitation matter | Separate game-side priority uses severity, exposure, asset criticality, threat activity, and controls | Priority classes are game-specific, not official CVSS values | FIRST, CVSS v4.0 User Guide — https://www.first.org/cvss/user-guide |
| Known exploited vulnerabilities (V2.2-4.4) | CISA KEV identifies vulnerabilities with evidence of exploitation in the wild | KEV-like signal increases remediation urgency | Fictional campaign feed; real catalog may inform optional educational examples | CISA, Known Exploited Vulnerabilities Catalog — https://www.cisa.gov/known-exploited-vulnerabilities-catalog |
| Network DoS (V2.2-4.4) | Network bandwidth can be exhausted by malicious traffic, affecting multiple dependent services | Volumetric attack consumes shared network capacity in the flow model | No packet-level flood generation | MITRE ATT&CK T1498, Network Denial of Service — https://attack.mitre.org/techniques/T1498/ |
| Endpoint DoS (V2.2-4.4) | Service or operating-system resources can be exhausted without saturating the access network | DNS, portal, billing, or management service capacity is consumed | Resource pressure is abstracted as service load | MITRE ATT&CK T1499, Endpoint Denial of Service — https://attack.mitre.org/techniques/T1499/ |
| DDoS mitigation (V2.2-4.4) | Large attacks may require filtering upstream from the constrained link; local filtering cannot restore capacity already consumed upstream | Scrubbing-provider contract, upstream filtering, and mitigation activation | Provider capacity and cost are balancing values | CISA/FBI/MS-ISAC, Understanding and Responding to DDoS Attacks (2024, v2.0) — https://www.cisa.gov/sites/default/files/2024-03/understanding-and-responding-to-distributed-denial-of-service-attacks_508c.pdf |
| Routing security mechanisms (V2.2-4.4) | RPKI, BGP origin validation, prefix filtering, source address validation, uRPF, RTBH, FlowSpec, and RRL are recognized interdomain-resilience mechanisms | Existing BGP layer gains RPKI/ROV, filtering, anti-spoofing, and mitigation actions | Detailed protocol behavior is represented by route and policy state | NIST SP 800-189, Resilient Interdomain Traffic Exchange — https://csrc.nist.gov/pubs/sp/800/189/final |
| ISP routing security operations (V2.2-4.4) | Network operators use filtering, anti-spoofing, coordination, and global routing information validation | MANRS-style operational practices have costs and incident consequences | Compliance is represented by capability and configuration state | MANRS, Actions for Network Operators — https://manrs.org/netops/ |

**Reference substitutions (disclosed):** the brief proposed ITU-T M.20 (*Maintenance Philosophy*) — its cited link is a login-gated file and M.3370 already grounds the maintenance workflow, so M.20 is dropped. The brief proposed ISOC's *Assessment of the Impact of IXPs* (`/resources/doc/ixpimpact/`) — the URL did not resolve to a verifiable document; its claims are covered by the two verified ISOC sources above.

---

## V2.2-7. MVP and Development Scope (MVP concept "The First Mile" preserved)

| System | MVP | v0.5 | v1.0 | Post-launch |
| --- | --- | --- | --- | --- |
| **USD economy** | Full USD ledger + basic reports | Regional tier economics depth | Advanced financial reporting | Mod/scenario economy |
| **Competitors** | Static profiles + price comparison | Basic reactions (entry, pricing) with delays | Strategic behavior, product-tier responses | Personalities, acquisition events |
| **Maintenance** | Asset records (tracked classes), corrective + emergency repair, simple WOs | Registry screen, PM + condition-based, spares inventory | Reliability analytics (MTBF/MTTR trends), full lifecycle | Advanced degradation simulation |
| **Upstream** | 1–2 transit profiles, flat/commit billing | Multi-homing + public peering (IXP costs, route server) | 95th-percentile billing, private peering, RPKI/research security node | Full interconnection ecosystem, caches |
| **Analytics** | §6.5 core metrics + arg-min bottleneck (TC-3 semantics) + before/after windows | Threshold config, forecasting (V2.2-3.4 spec), incident bands | p95 billing integration, revenue-at-risk depth | Predictive maintenance |
| **Cybersecurity** (V2.2-4.4) | Basic security events; volumetric DDoS abstraction; service exhaustion; basic ACL/firewall; NOC detection; incident response | Vulnerability Registry; CVE/CVSS advisory model; patch management; IDS/IPS abstraction; DNS security; credential compromise; upstream DDoS mitigation | BGP hijack and route-leak scenarios; RPKI/ROV; uRPF/SAV; RTBH/FlowSpec; security research branch; security posture analytics | Advanced multi-vector campaigns; ransomware recovery; insider threat; supply-chain incidents; cross-provider attack coordination |

**Why this phasing** (per the brief: why / dependencies / complexity / minimal playable / deferred):

- **USD at MVP:** retrofitting currency is the most expensive kind of rework; ledger and pricing are MVP-critical anyway. *Dependencies:* none. *Minimal playable:* ledger + package prices + payroll. *Deferred:* regional unit-economics panel (needs tiers + funnel data).
- **Static competitors at MVP:** the sim needs rivals for the market to mean anything, but the reaction model depends on the choice model and telemetry that don't exist yet. *Minimal playable:* profiles with prices/coverage on the map + choice weights in conversion. *Deferred:* reaction delays, product-tier responses, treasury behavior.
- **Corrective-only maintenance at MVP:** incidents already exist (v2 §15); asset records + corrective repair is a small extension of the failure path. PM/CBM depend on the condition model and work-order queue (v0.5, alongside tech staffing depth). *Deferred:* spares economics, reliability analytics.
- **Single-transit at MVP:** peering requires ASN/BGP (v2 eras 3+), IXP costing, and the p95 sampler. *Minimal playable:* two transit profiles with price/quality tradeoff. *Deferred:* everything in §9.5 beyond profiles.
- **Arg-min bottleneck at MVP:** §6.6's detector must be right from day one because tickets, postmortems, and the marker all consume it; forecasting waits for 30-day history to exist. *Deferred:* labels-on-forecast UI polish.
- **Incident-and-response security at MVP:** the full Vulnerability Registry needs asset/version tracking, vendor advisory content, patch compatibility, maintenance scheduling, and prioritization UI; the MVP should first establish the incident-and-response loop, which the vulnerability system then expands without a second simulation engine. *Minimal playable security loop:* (1) the player operates a network with basic firewall/ACL controls; (2) a DDoS or service-exhaustion event occurs; (3) the existing monitoring layer detects abnormal utilization or service health; (4) the NOC generates an incident with affected assets and customers; (5) the player selects a mitigation action; (6) the flow model calculates remaining legitimate service capacity; (7) the business layer calculates SLA, revenue-at-risk, and recovery cost; (8) the incident is closed with a short postmortem. *Deferred:* registry depth, IDS/IPS, DNS security, credential compromise, scrubbing contracts.
- **Routing security at v1.0:** RPKI, route validation, and advanced BGP mitigation depend on the existing ASN/BGP policy layer, upstream cooperation, and route-state modeling; they should be introduced after basic upstream and multi-homing systems are stable. *Deferred until then:* hijack/route-leak scenarios, uRPF/SAV, RTBH/FlowSpec, posture analytics.

Deterministic tick-based flow simulation: unchanged. No packet-level simulation is introduced anywhere in V2.2.

---

## V2.2-8. Assumptions and Open Questions

**Verified technical values:** B+/C+ optical Tx/sensitivity/overload ranges (vendor datasheets implementing G.984.2; C+ sensitivity is vendor-dependent — recorded as a range); splitter loss table (v2, unchanged); Fresnel/60% practice (v2, unchanged); G.650.3 OTDR methodology; MANRS action set; M.3370 work-order model.

**Verified security standards (V2.2-4.4):** CVSS v4.0 metric groups, score nomenclature (CVSS-B/BT/BE/BTE), and severity bands (FIRST specification, Table 22; the User Guide's "severity ≠ risk" separation is adopted as a rule); CVE as the vulnerability identifier; CISA KEV as an active-exploitation intelligence signal (not a severity score); MITRE ATT&CK T1498/T1499 as the DoS taxonomy anchors; NIST SP 800-189 for routing-security and DDoS-mitigation mechanisms; MANRS actions for filtering, anti-spoofing, coordination, and routing-information validation.

**Published market data:** APJII operator survey (segments, constraints); APJII/Indonesia Baik home-Wi-Fi spend bands; BPS 2024 penetration; ISOC peering-cost study (port fees ≈ 44%); Boik & Takahashi and Hogue & Rennhoff findings. All carried with their original-methodology caveats; IDR values converted at Rp 16,500/US$ [documented planning rate].

**Estimated market values:** business/enterprise pricing, salaries, electricity — method stated in §19.2/§19.3 notes; tunable in `packages/data`.

**Game-balancing values:** all construction CAPEX ranges; transit prices; conversion probabilities; reaction delays/noise; patience and expiry windows; MTBF hazard curves; peering port/cross-connect prices; maintenance costs; lab reward scalars; warning-threshold defaults; security balancing values (V2.2-4.4): attack intensity/duration distributions, detection delay and confidence, IDS/IPS effectiveness and false-positive rates, scrubbing capacity/price/activation delay, advisory cadence, patch-availability delay and maintenance risk, staff skill and response-time modifiers, financial consequences/SLA credits/churn effects.

**Fictional gameplay values:** Insight, Komtel, competitor archetypes, event cadence, intelligence-tool accuracy.

**Open questions (added to the parent §25.2 list):**
1. Does the arg-min bottleneck need per-flow allocation visible to the player, or only the arg-min result plus evidence? (Lean: result + evidence; allocation math stays in the field guide.)
2. Should competitor product-tier responses (Boik & Takahashi) appear at v0.5 with reactions, or only at v1.0? (Lean: v0.5 — price-only rivals teach price-warring as the *only* tool, which is the wrong lesson.)
3. Is per-household exposure tracking affordable at MVP scale (≈1,800 households)? (Yes at this scale; revisit at region scale.)
4. Should the water-sensor/OTDR condition tools require research unlocks, or ship as catalog items? (Lean: catalog items — CBM should be a purchase decision, not a tree gate.)
5. Peering-policy negotiation depth: fixed policies (open/selective per v2) vs event-driven bilateral negotiation? (Lean: fixed policies; negotiation is content, not system.)
6. Should the MVP include only volumetric DDoS, or also a simple service-exhaustion event? (Lean: include both, but keep the second as an abstract service-capacity event.)
7. Should real CVE IDs appear in the campaign, or should the game use fictional IDs? (Lean: fictional IDs for core campaign content; real CVEs can appear in optional educational/reference material.)
8. Should DDoS scrubbing be available through upstream contracts or as a dedicated security provider? (Lean: both, with different costs and coverage.)
9. Should IDS/IPS be a research unlock or catalog purchase? (Lean: basic IDS as a purchase; advanced IPS capabilities as a research and staffing progression.)
10. Should security staff be separate from network technicians? (Lean: introduce a security-specialist role at v0.5; MVP response can use trained NOC staff.)
11. Should the player be able to configure detailed ACL/FlowSpec rules? (Lean: basic policy templates first; advanced rule configuration only after the underlying routing model is ready.)

---

## V2.2-9. Change Summary

**Added:** §10.5 Competitor Intelligence & Market Response; §14.6 + §10.6 Maintenance & Asset Lifecycle; §9.5 Upstream/Transit/Peering business (with the MANRS practice loop); V2.2-5 dependency matrix; corrections spec V2.2-3.1–3.5 with test cases TC-1…TC-6; §V2.2-4.4 Cybersecurity & Network Resilience (vulnerability management on CVE/CVSS v4.0; threat taxonomy for DoS/DDoS, routing attacks, DNS attacks, and internal compromise; Threat Event Engine; detection and response controls; security incident fields; threat intelligence; security UI; SEC-1…SEC-10 test cases).

**Modified:** economy → USD-only (v2.1 §19 currency decision removed; market tiers and all non-currency localization retained); v2.1 §6.6 bottleneck → arg-min-of-allocated-share + fault flags (revenue-weighting kept, double-counting removed, incident/persistent separated); v2.1 §13.6 campaign formulas → household-level exposure model with seeded deterministic draws; v2.1 §14.4 forecasting → full sampling/aggregation/label spec; v2.1 §18.1 lab rewards → validity/interpretation/dedup rules; v2 §7.2 optical numbers → parameter table.

**Extended:** §V2.2-5 dependency matrix with security relationships and ten security integration checks; §V2.2-6 references with CVSS/CISA KEV/MITRE ATT&CK/NIST SP 800-189/MANRS rows; §V2.2-7 roadmap with the cybersecurity row, the minimal playable security loop, and the CVSS-at-v0.5 / routing-security-at-v1.0 rationales; §V2.2-8 assumptions and six security open questions; §V2.2-9 this summary.

**Retained unchanged (security additions):** the deterministic tick-based flow simulation — no packet-level simulation, real exploit execution, malware execution, or offensive cyber gameplay is introduced by V2.2-4.4.

**Removed:** IDR primary-currency system and FX-planning note as player-facing mechanics (v2.1 §19 currency sections); the "earliest stressed resource" bottleneck rule (replaced); ITU-T M.20 and the unresolvable ISOC ixpimpact reference (replaced by verified equivalents — disclosed above).

**Retained unchanged:** v2 vision/pillars (§1–3), simulation core and flow model (§6.1–6.4), WISP physics (§8), addressing/CGNAT concept (§9.2), map & construction (§10.1–10.3), catalog (§11), finance core (§12.1–12.5), customer classes/packages (§13.1–13.3), incidents/security (§15), staff (§16), regulator (§17), research tree structure (§18 table), era ladder (§20), UI screens (§21, +planner/registry screens added per new systems), modes (§22), architecture (§23), MVP exit criterion (§24.1), Reality Check rows (§26 — extended by V2.2-6), and v2.1's threshold taxonomy and funnel stages (as corrected above).

*End of refinement. GDD v2 remains the source of truth; v2.1 remains valid except where corrected here; this document (v2.2) is the current implementation reference.*
