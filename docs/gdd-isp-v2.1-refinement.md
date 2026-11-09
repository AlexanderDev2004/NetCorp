# NetCorp GDD V2.1 — Realism, Market, Analytics & Experimentation Refinement

**Version:** 2.1 (controlled refinement of GDD v2) · **Date:** {{date:2026-11-09}} · **Status:** Draft for development planning
**Parent document:** NetCorp — ISP Business & Network Simulation GDD (v2)

> **What this document is.** A Quorum-Issue-#43-style refinement pass over GDD v2. Four areas are improved — Customer Acquisition, Performance Analytics & Bottleneck Identification, a Research Laboratory, and IDR economic localization — each audited against existing sections first. Everything not listed here is deliberately unchanged. Section numbers below refer to GDD v2.

---

## Part A — Change Audit

| # | Addition | Existing GDD v2 section(s) | Completeness | Missing details | Recommended action |
| --- | --- | --- | --- | --- | --- |
| 1 | Customer Acquisition & Marketing | §12.2 (CAC/LTV, marketing spend per cluster), §13.3 (lifecycle: Prospect→Lead→Install→Subscriber), §16.1 (Sales Rep), §10.4 (competitors) | **Partial** — funnel stages and CAC exist, but channels, campaign mechanics, install-capacity coupling, and funnel conversion rules are undefined | Channel list with era gates; campaign entity + math; the 8-stage funnel with per-stage conversion drivers; install backlog mechanic; channel tradeoffs | **Expand §13** with new §13.4–§13.8 (no duplication of lifecycle — it is redefined once, precisely) |
| 2 | Performance Metrics & Bottleneck Analytics | §6.2 (flow model), §6.4 (per-tick outputs), §7.2–7.3 (optical numbers), §8.2 (SNR/MCS tiers), §14.1 (NOC views), §14.2 (monitoring as build), §19 (bottleneck marker) | **Partial** — metrics exist in prose, but there is no metric catalog, no systematic bottleneck method (§19's marker says "single weakest point" without a method), no threshold taxonomy, no upgrade-verification analytics | Per-layer metric spec (measure/compute/producer/gameplay/diagnosis/limitation); path-relative bottleneck identification; before/after analytics; threshold classes + hysteresis | **Expand §6** with §6.5–§6.6, **expand §14** with §14.4–§14.5, amend §19's bottleneck-marker row |
| 3 | Research Laboratory & Experimentation | §18 (Insight + research tree), §6.2 (probe mode), §22 (Sandbox mode), §24 (roadmap) | **Partial** — research unlocks capabilities and Sandbox allows failure injection, but there is no *experimentation loop* where hypotheses are tested against the sim before production changes | Lab domains (FTTH/WISP/core/business), experiment lifecycle with earned-not-given rewards, lab-vs-production separation, bench limitations, roadmap staging | **Expand §18** with §18.1 (lab); no change to the tree itself |
| 4 | Economic Localization (IDR) | §19 (all USD), §12 (ledger), §17 (Nusantara Baru / Komtel setting), §10.1 (clusters with wealth profiles) | **Missing** — the setting is Indonesia-inspired but the economy is denominated in USD with no localization, no published-data anchors, no currency handling for imported equipment | IDR primary ledger; published price bands (APJII); regional market tiers; unit-economics per region; USD import lines with explicit FX assumption | **Rewrite §19** (v2 §19 table becomes the balancing appendix of the new one); add §12.6 regional unit economics |

Completeness rule applied: nothing is added that restates an existing mechanic under a new name. §13.3's lifecycle *is* the funnel — it is refined in place, not replaced by a parallel system.

---

## Part B — GDD V2.1 Section Changes

### B1. §13.4–§13.8 (new, expands §13 "Customer and Subscription Systems")

#### §13.4 Customer Acquisition Funnel (refines §13.3)

The lifecycle in §13.3 is now specified as eight stages with explicit per-stage conversion drivers:

```
Market Awareness → Prospect → Lead → Coverage Verification → Offer
     → Registration → Installation → Active Subscriber
```

| Stage | What it is | What drives conversion to the next stage | Failure/decay mode |
| --- | --- | --- | --- |
| Market Awareness | Cluster-level exposure to the brand | Marketing campaigns (§13.5), word-of-mouth from satisfied subscribers, competitor absence | Awareness decays toward baseline when campaigns end |
| Prospect | Household/business flagged as potential in a covered-or-coverable cluster | Cluster interest level (§10.1), wealth profile, current service quality (if any) | Interest decays; competitor promos poach prospects |
| Lead | A specific prospect that raised a hand (inquiry, door-knock response, referral) | Lead-gen channel; referral leads arrive pre-sold when referrer satisfaction is high | Leads expire after N game-days (patience is finite) |
| Coverage Verification | Technical check: does a serviceable path exist (optical margin / LoS+Fresnel / port capacity)? | The *actual network state*, not a sales promise | **Hard gate:** failed verification = lost lead or a "we'll build it" promise that starts a construction-clock expectation (§10.3) |
| Offer | Package proposal (price, install fee, contract) | Package fit vs prospect's wealth/needs; competitor price comparison | Rejected offers reduce cluster interest slightly (nobody likes being sold to twice) |
| Registration | Signed agreement | Contract length vs price sensitivity; promo terms | — |
| Installation | Truck roll + workmanship-quality roll (§13.3) | **Technician availability and skill** — the funnel's physical bottleneck | Install backlog (§13.7); failed installs (no margin at the drop, bad LoS) re-open Coverage Verification |
| Active Subscriber | MRR starts; satisfaction evolves | Onboarding quality; delivered-vs-promised speed in week 1 | Churn loop (§12.2, §13.3) |

Design rule: **marketing, sales staff, and network state influence different stages** — marketing creates awareness and leads; sales staff convert offers; the network alone decides verification; technicians alone decide installs. A player can therefore have a funnel leaking at any one stage, and the dashboard shows conversion-per-stage so the leak is findable (rule R2).

#### §13.5 Marketing channels (new)

| Channel | Mechanic | Strengths | Weaknesses | Era |
| --- | --- | --- | --- | --- |
| Word-of-mouth (passive) | Automatic, scales with subscriber satisfaction | Free | Slow; negative when satisfaction is low | 0 |
| Referral program | Pay existing subscribers (bill credit) for signed referrals | Cheap leads, pre-qualified | **Effectiveness ∝ referrer satisfaction**; paying for referrals during outages buys bad leads | 0 |
| Door-to-door / local agents | Hire commission sales agents assigned to a cluster | High conversion in dense clusters; works without brand awareness | Labor cost per lead; agent quality varies (uses the §16 employee model) | 0 |
| Local advertising | Billboards, banners, local radio — per-cluster spend | Broad awareness lift in one cluster | Weak conversion without coverage awareness; wasted in uncovered clusters (§13.7) | 1 |
| Digital advertising | Region-wide targeted spend | Cheap reach; measurable | Skews to urban clusters with existing internet habits | 1 |
| Promotional campaigns (discount/free-install) | Time-boxed package pricing | Converts price-sensitive clusters fast | Lowers ARPU and anchors renewal price (§13.7) | 1 |
| B2B direct sales | Sales Rep works a named business account list (§16.1) | Large contracts, multi-year terms | Long cycles (weeks–months of game time); requires SLA capability to even offer (§13.1) | 2 |
| Institutional & government tenders | Respond to periodic tender events (school district, city offices) | Biggest contracts; era-gate revenue | Formal requirements (compliance standing §17, references, bond); loss is public | 3 |

Era gates use the MVP/v0.5/v1.0 phasing in Part D — channels unlock with mechanics that make their tradeoffs decidable.

#### §13.6 Campaign mechanics (new)

A campaign is a first-class entity with a per-tick simulation, not a spend slider:

| Property | Rule |
| --- | --- |
| Target | One cluster + one segment (residential / business / institution) |
| Channel | One of §13.5 |
| Budget | Total spend, drawn as cash over the campaign duration (provenance-tagged, R5) |
| Duration | In game-days; awareness/lead effects follow the channel's response curve (immediate for door-to-door, ramped for local ads) |
| Expected reach | `reach = budget × channel_efficiency × cluster_density_factor` — computed and shown *before* commit |
| Conversion | `expected_leads = reach × base_conversion(channel, segment) × interest_factor(cluster) × (1 − competitor_share(cluster))` |
| CAC | `campaign_budget ÷ signed_contracts` (the number §12.2 reports; predicted CAC shown pre-commit, realized CAC reported after) |
| Install capacity | Campaign drives leads into the §13.3 install queue; capacity is technician-hours |

The pre-commit panel shows predicted reach/leads/CAC **with confidence bands** (the sim's conversion rates are stochastic per lead, deterministic in aggregate expectation). The numbers are honest, not guaranteed — a campaign underperforms when a competitor runs a counter-promo or an outage is in recent memory (satisfaction-weighted).

#### §13.7 Campaign tradeoffs (new — the decision content)

1. **Marketing in an uncovered area wastes money.** Awareness converts to leads, but Coverage Verification fails → leads expire with a "when will you build here?" interest penalty that *reduces* future conversion. The map's coverage layer must be checked before spend — the game never blocks the wasted spend, it just costs what it costs (teach by consequence).
2. **Marketing beyond install capacity creates a backlog.** Every lead beyond technician-hours waits; waiting leads decay (patience) and leave negative reviews when they churn from the queue. The funnel couples marketing to §16 hiring — the classic WISP growth trap is a billboard that out-sells the truck.
3. **Discount campaigns raise volume, cut margin, and anchor price.** Subscribers acquired at a promo price renew at expectations set by the promo; ending a discount is a churn event window. Long-run ARPU is the price of short-run growth.
4. **Referral quality tracks satisfaction.** Referral campaigns during a satisfaction dip purchase leads that convert worse than organic ones — visible post-hoc in per-channel CAC.
5. **Enterprise/tender wins are obligations.** A signed institutional contract adds SLA penalties (§15) and compliance exposure (§17); losing a tender the player publicly pursued costs reputation with that institution's cluster.

#### §13.8 Funnel economics hookup (new)

The funnel writes into the economy of §12 and the analytics of §14.4: per-stage conversion rates, per-channel CAC, LTV by acquisition channel, payback months per campaign (§12.6). Player-visible dashboard: funnel view per cluster with the weakest stage flagged (rule: the flagged stage is advice, not the bottleneck-marker method of §6.6 — they are different instruments and say so).

---

### B2. §6.5–§6.6 (new, expands §6 "Network Simulation Architecture") and §14.4–§14.5 (new, expands §14 "NOC and Network Operations")

#### §6.5 Performance metrics catalog (new)

Every metric follows rule R2 (influences a decision) and carries a stated limitation. Format: *what / how computed / producer / gameplay effect / diagnosis / limitation*.

**Physical / FTTH**

| Metric | Computation & producer | Gameplay effect | Diagnosis | Limitation |
| --- | --- | --- | --- | --- |
| ONT Rx power (dBm) | Summed loss chain (§7.2) reported by ONT | Margin = distance to no-sync; drives splitter/length decisions | ONT detail panel; compare against budget calc | No per-wavelength detail; static after topology change except scripted degradation events |
| Path optical margin (dB) | `budget(B+/C+) − Σ losses` computed per path | The hidden difficulty slider the player set; margin < 3 dB flags amber | FTTH Planner tree view highlights thin paths | Continuous drift only via modeled splice-degradation events |
| Splitter insertion loss | Fixed table per ratio (§7.2) | Ratio choice = capacity vs margin tradeoff | Budget breakdown per path | Uniform splitting (no per-port variance) |
| PON port utilization | Σ active demand ÷ port capacity, sampled per tick | Congestion → delivered-speed compression; drives port/OLT CAPEX | PON port graph; tree utilization view | No T-CONT/DBA allocation modeling |
| ONT sync status | Derived: Rx above floor + OLT alive + path intact | Binary service state feeding availability | Alarm list; tree status | Sync flap modeled as scripted event class only |

**Wireless / WISP**

| Metric | Computation & producer | Gameplay effect | Diagnosis | Limitation |
| --- | --- | --- | --- | --- |
| CPE RSSI/SNR | Path calculation (distance, terrain, power) per §8.2 | Determines MCS tier → CPE's share of sector capacity | CPE panel; survey tool pre-install | Single-path model; no multipath fading statistics |
| MCS tier | SNR→tier table (§8.2) | Capacity weighting; visible as "connection quality" | CPE panel | Tiered (3 bands), not continuous rate adaptation |
| Channel utilization | Σ demand of all co-channel sectors/CPEs in interference range | Self- and competitor-interference pain; drives re-plan | Spectrum view (needs spectrum analyzer gear, §11) | Interference radius simplified to distance + channel overlap |
| Sector capacity headroom | `capacity − Σ(CPE demand × MCS weight)` | Hard ceiling vs fiber's oversubscription behavior | Sector graph | No per-frame airtime scheduling |
| Link availability (PtP backhaul) | Weather-state modulation (rain fade, P.530-class event model) | Backhaul degradation → multi-site impact | Backhaul graph; weather overlay | Fade is event-class based, not continuous dB rain rate |

**Core / aggregation**

| Metric | Computation & producer | Gameplay effect | Diagnosis | Limitation |
| --- | --- | --- | --- | --- |
| Link utilization / throughput | Σ routed demand ÷ capacity per link | Drives core upgrades; transit sizing | Link graphs | No per-queue dynamics |
| RTT / jitter | Per-link base latency + congestion penalty term | QoE for voice/video-aware customers; SLA metrics | Probe tool traceroute | Queueing abstracted to a congestion penalty, not per-packet delay |
| Packet loss | Congestion overflow + hardware error events | The most customer-visible core metric | Probe tool; interface counters | Flow-level overflow model |
| Interface errors/discards | Wear/environment events increment counters | Predictive-maintenance signal (a dying port errors before it dies) | Device log + counters | Error rates only from modeled causes |
| CPU/memory (devices) | Load vs device spec (sessions, routes, features enabled) | Feature-capacity tradeoffs (BGP full tables need RAM, §11) | Device inspector | Aggregated load, no process model |

**Customer experience**

| Metric | Computation & producer | Gameplay effect | Diagnosis | Limitation |
| --- | --- | --- | --- | --- |
| Delivered vs advertised throughput | Min(constraint chain) applied to package speed during active use | The core honesty metric; drives satisfaction | Speed-test evidence in tickets; customer panel | Measured at sample points, not continuously per customer |
| Service availability | Uptime accounting per customer from topology + incident timeline | SLA compliance; penalties (§15) | SLA report | Availability from sim events, not per-second checks |
| Ticket frequency (per class) | Ticket system (§15.1) | Recurrence = unresolved root cause signal | Ticket analytics | Authored ticket content |
| Satisfaction / churn intent | §12.2 model inputs | Drives churn; referral quality (§13.5) | Customer list heat | Model, not behavior |

#### §6.6 Bottleneck identification method (new — replaces the unspecified "single weakest point")

The v2 bottleneck marker is now a defined algorithm, not a vibe:

1. **Frame the path.** For each affected customer (or each customer when doing a fleet scan), enumerate the end-to-end service path: ONT/CPE → tree/sector → aggregation → POP/core → transit/peering → destination.
2. **Evaluate each resource with the USE triad** — **U**tilization (how busy), **S**aturation (queueing/congestion evidence: delivered-speed compression, latency penalty terms, airtime exhaustion), **E**rrors (discards, sync failures, optical margin violations, interface errors). A resource is a bottleneck *candidate* when any triad member is stressed — highest utilization alone does not qualify (an 80%-used link with no saturation and no errors is fine; a 40%-used radio channel with 20% retransmit-equivalent interference loss is the bottleneck).
3. **Classify the constraint type:** *hard physical* (optical floor, LoS loss, no path), *capacity* (port/sector/link saturation), *configuration* (misroute, wrong package binding), *upstream* (transit congestion, single-homed outage). Type determines the remedy category and is shown to the player.
4. **Pick the binding constraint** for that path: the earliest-stressed resource along the path (packets die at the first wall, not the tallest one).
5. **Fleet aggregation:** the dashboard's *bottleneck marker* (v2 §19) is the binding constraint shared by the most affected-customer-revenue, i.e. `Σ monthly_fee(customer)` over customers whose path binds there. This makes the marker a business-weighted instrument, and makes "fix it" have a computable revenue-at-stake.

The marker deliberately does *not* tell the player the fix — it names the constrained resource and type; diagnosis (§15.1) remains the gameplay.

#### §14.4 Performance analytics (new, expands §14.1)

Beyond v2's per-day/hour/month buckets:

- **Peak vs off-peak:** every utilization graph carries its diurnal envelope; the interesting number (95th-percentile-of-busy-hour) is surfaced because it is what transit billing (§12.3) and capacity planning use.
- **Before/after upgrade comparison:** any config/topology change auto-stamps the telemetry; the player can open a two-window comparison (week before / week after) on the affected path. Answering "did the upgrade work?" is a first-class view, not an archaeology project.
- **Incident timeline correlation:** incident windows are rendered as bands across all metric graphs; a capacity complaint cluster that started exactly when utilization crossed a threshold is visible in one glance.
- **Capacity forecasting:** linear trend on busy-hour 95th-percentile per shared resource → "weeks until saturation" estimate per PON port/sector/backhaul. Shown in the planner views; explicitly an extrapolation, re-fit on new data (the sim's demand growth is scripted-seasonal, so the forecast is honest within its horizon).
- **Customer impact analysis:** for any incident or degraded resource, the affected-subscriber count and revenue-at-risk are computed from topology (the same aggregation §6.6 uses).
- **Root-cause evidence:** the probe tool (§6.2) and device counters are exportable as attachments into tickets/postmortems — evidence, not assertion.
- **Cost/revenue impact of degradation:** delivered-vs-advertised shortfall per cluster × ARPU → "revenue under quality pressure" figure, feeding the §12.5 congestion-economics loop.

#### §14.5 Thresholds and alerts (new)

Four classes, each labeled in the UI by source so the player learns which numbers are negotiable:

| Class | Source | Examples | Player can change? |
| --- | --- | --- | --- |
| Standards/vendor-based technical limits | Optical Rx floor (−27 dBm class B+), max split ratio, device capacity ceilings | G.984.2-class optical specs; catalog limits (§11) | No — physics and hardware |
| Device/vendor-specific limits | Per-catalog-item operational ceilings (session counts, temperature ranges) | Vendor datasheet analogs | No — but choosing the device was the decision |
| Operational recommendations | Industry-practice planning rules, marked as recommendations | Plan upgrades at 70–80% busy-hour utilization; keep ≥3 dB optical margin | Yes — per-network policy, with risk |
| Game-balancing thresholds | Tunable data-file values | Alert trigger points, decay rates, backlog patience | Designer/modder only |

Threshold mechanics: per-resource thresholds with **hysteresis** (alert at trigger, clear only below a lower reset point, e.g. alert at 85%, clear at 75%) to prevent flapping; alert severity derived from the threshold *class* breached and customers affected. The player's own monitoring config (§14.2) sets which classes alert, when, and to whom on shift (§16.3).

---

### B3. §18.1 (new, expands §18 "Research and Technology Progression")

#### §18.1 Research Laboratory & Experimentation (new)

The research tree (§18 table) is unchanged. The lab is the *empirical* layer beneath it: a place to test a hypothesis against the same simulation the production network runs — before betting production on it.

**Unlock and cost.** The lab is built like any infrastructure: a bench room at the POP (space + power), bench equipment from the shop (power meter, spare OLT port, spectrum analyzer, test CPEs, traffic generator — each a §11 catalog item with tradeoffs), and staff time (an engineer assigned per experiment). Its per-experiment cost is real cash and real game-days; there is no free lab.

**Experiment lifecycle.**

```
Hypothesis (player writes a prediction) → Configure test environment
  → Run (simulated in accelerated time) → Collect measurements
  → Compare results vs prediction → Conclusion
  → Insight award (scaled by hypothesis quality and interpretation) + optional research credit
```

**Reward rules (the anti-farming clause):** Insight is *not* granted for starting or merely completing an experiment. Awards scale by (a) whether the player *committed to a falsifiable prediction* before running (a wrong-but-specific hypothesis pays nearly as much as a correct one — being surprised is learning), (b) whether the measurement setup was valid (testing a splitter ratio on a bench with the wrong optics class yields a wrong conclusion the game will let the player draw), and (c) whether the drawn conclusion matches the sim's actual behavior. Scribbled "I learned something" grants nothing.

**Lab domains and canonical experiments.**

| Domain | Experiments | Real-world basis |
| --- | --- | --- |
| FTTH bench | Splitter 1:8 vs 1:16 vs 1:32 at fixed length; budget walks for B+ vs C+ optics; connector/splice loss deltas; length-vs-attenuation curves | G.984.2 optical budget arithmetic (§7.2 tables are the same numbers) |
| WISP bench | Channel width vs throughput at fixed SNR; frequency choice vs rain-fade sensitivity (event replay); Fresnel clearance vs achieved MCS; interference from a scripted co-channel neighbor | SNR→MCS mapping and P.530-class availability modeling (§8.2) |
| Core lab | Single vs dual upstream failover behavior; policy changes (§9.2) measured by delivered RTT/loss; session exhaustion under generated load | RFC 6349-class throughput testing methodology; transit behavior (§9.1) |
| Business/capacity | Package mix vs oversubscription on a synthetic customer population; growth curves vs CAPEX/OPEX scenarios | Flow-model demand curves (§6.2); §12.5 loop |

**Lab vs production separation.** Experiments run on a sandboxed copy of world state. Applying a tested configuration to the live network is always an **explicit command** (`applyLabConfig`), priced and logged like any change — the lab can prove a configuration *in lab conditions* and production can still humiliate it (real traffic mix, weather, a neighbor's new tower, that one ONT with the bent drop fiber). This distinction — *safe experimentation ≠ production deployment* — is the operational lesson of the whole system.

**Known limitation (documented, R6):** the lab cannot contain unknown unknowns; its weather/interference/traffic generators only replay modeled event classes. The field-guide entry says so plainly.

**Roadmap placement** (see Part D): MVP ships probe-mode experiments only; the bench lab arrives with v0.5's FTTH/WISP depth; core/business experiments and production-pilot migrations land in v1.0 with the BGP era.

---

### B4. §19 rewritten (replaces v2 §19 "Economy and Balancing (Reference Numbers)") + §12.6 (new)

#### §12.6 Regional unit economics (new, extends §12)

Per market tier (defined in §19.1 below), the dashboard and data files carry:

`cost per passing home · cost per active subscriber · ARPU · CAC (by channel, §13.6) · LTV · payback months · gross margin · operating margin · monthly churn % · cash runway (months)`

These are computed from the ledger (provenance-complete, R5) per cluster and rolled up per tier. The design goal is explicit: **more than one profitable strategy must exist** (urban-fiber-premium, rural-WISP-volume with grants, mixed hybrid) — the unit-economics panel is how the player verifies their chosen strategy is actually one of them.

#### §19 Economy and Balancing — IDR localization (replaces v2 §19)

**Primary currency: Indonesian Rupiah (Rp / IDR)** — the player-facing ledger, all packages, salaries, and construction are in IDR. **Import lines keep their USD price** (network equipment is internationally priced) with an explicit, configurable planning exchange rate stored in data files (default assumption: **Rp 16,500/US$**, a game-balancing assumption, not a forecast). The ledger never silently mixes currencies: USD lines are stored with original currency and converted at the planning rate, marked with a ⌀ import icon. Currency-exposure gameplay (FX swings) is deliberately **not** modeled — it adds noise, not decisions (rule from Part 7 of the brief: no mechanic without a decision).

**§19.1 Market tiers (regional localization).** Each cluster maps to a tier with published-data-informed properties:

| Tier | Density | Household purchasing power | Existing fixed-broadband penetration | Competitor availability | Willingness to pay |
| --- | --- | --- | --- | --- | --- |
| Urban core | High | Higher | Higher (incumbent fiber present) | Incumbent + overbuilder | Highest, but promo-sensitive |
| Suburban | Medium-high | Medium | Medium | Incumbent partial | Medium-high |
| Town/commercial | Medium | Medium | Low–medium | One discount WISP common | Medium; business demand notable |
| Rural village | Low | Lower | Low | Often none | Lower; FUP-tolerant packages fit |
| Remote/scattered | Very low | Lowest | Minimal | None | Lowest; subsidized-build territory (§12.4 grants) |

Anchors (published data): Indonesia's internet penetration reached **72.78%** of the population in 2024 (BPS, Susenas 2024), while fixed-line household ownership is minimal (**0.99%** of households) — the fixed-broadband market is therefore *growth* territory, matching the game's premise. APJII's operator survey reports ISPs' own target segments — residential first (69% of operators name housing as their preferred market; 67.2% report actual household share), then home-office/shop (58.6% preference), schools (30.5%), government (27.2%) — which seeds the game's segment weighting by tier. The same survey's *operator-reported growth constraints* — high infrastructure and maintenance cost (23.8%), remote/rural access difficulty (23.4%), intense competition (21.3%), regulation (15.9%), capital access (10.5%) — are the game's constraint model in the players' own words, and the reason §10.3 construction costs and §17 permits bite where they do. **Caveat (per the brief):** this is a survey of 239 ISP operators about their businesses — it measures operator perception and market structure, not consumer conversion rates; the game's funnel numbers are balancing values informed by it, not derived from it.

**§19.2 Customer pricing (IDR/month, game-balancing ranges anchored to published bands).** Published anchor (APJII, early 2024, consumers *already subscribing* to home Wi-Fi): **67.4% pay Rp 100,000–300,000/mo; 22.5% pay Rp 300,000–500,000; 7.8% below Rp 100,000; 1.1% above Rp 500,000** — distinct from mobile-internet spending, where most users pay under Rp 100,000/mo (45% pay Rp 50–100k). The game's residential prices therefore live inside the published band, with tiers above it justified by service class:

| Product | Game range (Rp/mo) | Basis |
| --- | --- | --- |
| Residential entry (10–20 Mbps) | 100,000–200,000 | Published band lower half (7.8–67.4% segments) — *balancing estimate* |
| Residential standard (50–100 Mbps) | 150,000–350,000 | Published band core — *balancing estimate* |
| Residential premium (300 Mbps) | 300,000–500,000 | Published band upper half — *balancing estimate* |
| Small business (with static IP) | 400,000–800,000 | Estimated: 2–3× residential, consistent with operator B2B positioning — *balancing estimate* |
| Dedicated business line (1:1, SLA) | 2,000,000–6,000,000 | Estimated from SLA service-class economics — *balancing estimate* |
| Enterprise/SLA dedicated (contract) | ≥ 10,000,000 | Estimated; era-gated (§13.1) — *balancing estimate* |
| Install fee (residential) | 150,000–500,000 (often waived in promos, §13.5) | Estimated; financed via contract terms — *balancing estimate* |
| CPE rental option | 25,000–75,000/mo added | Estimated alternative to purchase — *balancing estimate* |

Advertised vs delivered vs guaranteed speeds are three different things in-game (§6.5): the *package* advertises, the *physics* delivers, the *SLA* guarantees (and only SLA products carry guarantees).

**§19.3 CAPEX and OPEX localization.** Equipment CAPEX is USD-denominated (import) and converted at the planning rate; construction and labor are IDR. Values below are the v2 balancing table re-expressed, with ranges preserved (no false precision; all tunable in `packages/data`):

| Item | Game value | Currency & class |
| --- | --- | --- |
| Starting capital | Rp 400 jt (≈ US$25k at planning rate) | IDR, balancing (carried from v2) |
| Fiber build, aerial | Rp 65k–115k per meter (≈ US$4–7) | IDR conversion of v2 range — *balancing* |
| Fiber build, underground | Rp 200k–330k per meter (≈ US$12–20) | IDR conversion of v2 range — *balancing* |
| GPON OLT (8 ports) + optics | Rp 100 jt (≈ US$6k) | USD import line ⌀ — *balancing* |
| 30 m tower, built | Rp 300–500 jt (≈ US$18–30k) | Mixed (steel IDR, design import) — *balancing* |
| 5 GHz sector + mount | Rp 15 jt (≈ US$900) | USD import ⌀ — *balancing* |
| CPE installed | Rp 2–3 jt (≈ US$120–180) | USD import ⌀ — *balancing* |
| Field tech salary | Rp 4–6 jt/mo | IDR — *estimated from Indonesian technician wage ranges; tunable* |
| Transit | US$1.20/Mbps/mo ⌀ (Era 1 regional commit), declining by era per §9.1 | USD import line ⌀ — *balancing* (international market is USD-denominated in reality) |
| Electricity | Rp 1,450/kWh grid tariff class, per-site draw | IDR — *balancing* |
| Residential activity at peak / concurrency | 30–50% of package; 40–60% concurrent | Sim parameter — *balancing* |
| Payback on residential fiber build | 18–36 months at 50% take-rate | Derived from above — *balancing* |

The §12.5 congestion-economics loop, the era ladder (§20), and every balancing target in v2 §19's closing paragraphs carry over unchanged.

---

## Part C — Real-World References (Quorum-#43 style)

| System | Real-world behavior | Game implementation | Simplification | Gameplay reason | Reference |
| --- | --- | --- | --- | --- | --- |
| Customer acquisition (§13.4–13.8) | Indonesian ISPs target residential-first segments; growth is constrained by infrastructure cost, rural reach, competition, regulation, capital | Funnel with per-stage drivers; channels with era gates; campaign entity with pre-commit predictions and post-hoc CAC | Consumer conversion probabilities are authored balancing values, not measured rates | Makes marketing a resource-allocation decision coupled to coverage, install capacity, and satisfaction | APJII, *Survei Profil Industri dan Riset Pasar ISP* (survey of 239 APJII member ISPs; operator-reported, not consumer measurement) — https://web.apjii.or.id/berita/d/apjii-rilis-survei-profil-industri-dan-riset-pasar-isp |
| Fixed-broadband pricing bands (§19.2) | Indonesian home-Wi-Fi subscribers concentrate at Rp 100–300k/mo (67.4%), with tails below and above; mobile spending is a separate, lower band | Residential package ranges placed inside the published band; SLA tiers above it | Published bands describe current subscribers, not willingness-to-pay ceilings | Prices the player can recognize as real; ARPU/margin decisions stay meaningful | APJII via Indonesia Baik, *Biaya Internet-an Tiap Bulan* — https://indonesiabaik.id/infografis/biaya-internet-an-orang-indonesia |
| Market penetration context (§19.1) | 72.78% of Indonesians accessed the internet in 2024; fixed-line household presence ~1% | Tier model with low fixed-broadband penetration = growth frontier | National aggregates, not per-tier resolution | Grounds the "build it and they will come, slowly" pacing | BPS, *Statistik Telekomunikasi Indonesia 2024* (Susenas 2024) — https://www.bps.go.id/id/publication/2025/08/29/beaa2be400eda6ce6c636ef8/statistik-telekomunikasi-indonesia-2024 |
| Regulatory ladder (§17 support) | Indonesian telecom licensing uses risk-based business licensing standards (PBBR) across post/telecom/broadcast sectors, updated 2025 | Komtel compliance ladder (§17.2); tender requirements reference compliance standing | Fictional regulator; simplified procedure, real shape | License classes and renewals mirror a real, current regulatory structure | PM Komdigi No. 15 Tahun 2025, *Standar Kegiatan Usaha dan Standar Produk/Jasa pada Penyelenggaraan Perizinan Berusaha Berbasis Risiko Sektor Pos, Telekomunikasi, dan Penyiaran…* (replacing Permenkominfo 3/2021) — https://jdih.komdigi.go.id/produk_hukum/view/id/985/t/peraturan+menteri+komunikasi+dan+digital+nomor+15+tahun+2025 ; regulation portal: https://e-telekomunikasi.komdigi.go.id/etelekomunikasi/regulasi |
| Throughput verification (§6.5, §14.4, §18.1) | TCP throughput testing uses standardized methodology (throughput vs offered load, buffer-delay variation) rather than single-sample speed tests | Delivered-vs-advertised metric, before/after upgrade windows, lab traffic-generator experiments | Methodology abstracted to flow-model sampling | "Did the upgrade work?" needs a measurement discipline, not a vibes check | IETF RFC 6349, *Framework for TCP Throughput Testing* — https://www.rfc-editor.org/rfc/rfc6349 |
| Bottleneck diagnosis (§6.6, §14.5) | Systems analysis checks utilization, saturation, *and* errors per resource — high utilization alone is not a bottleneck | USE-triad path analysis; constraint-type classification; revenue-weighted fleet marker | Triad computed from flow-model aggregates, not queueing theory | Teaches the real diagnostic habit; prevents "biggest number = problem" play | Brendan Gregg, *The USE Method* — https://www.brendangregg.com/usemethod.html |
| FTTH metrics (§6.5, §7.2, FTTH lab) | GPON PMD layer specifies optical interface requirements (Tx/Rx levels, sensitivity classes) | Rx floor −27 dBm (B+ class), budget arithmetic, margin warnings | Per GDD v2 §27 row (dispersion/PMD omitted) | The lab experiments and production metrics share one number set | ITU-T G.984.2, *Gigabit-capable Passive Optical Networks (GPON): Physical Media Dependent (PMD) layer specification* — https://www.itu.int/rec/T-REC-G.984.2/en |
| WISP availability & metrics (§6.5, §8.2, WISP lab) | Terrestrial LoS link availability is predicted against propagation effects (rain, multipath, obstruction) | SNR→MCS tiers; rain-fade event classes; Fresnel clearance rule; link-availability metric | Event-class weather, not continuous rain-rate modeling | Wireless planning decisions (frequency, height, clearance) map to availability outcomes | ITU-R P.530, *Propagation data and prediction methods required for the design of terrestrial line-of-sight systems* — https://www.itu.int/rec/R-REC-P.530 |

Sourcing rules honored: every reference above supports the specific mechanic named in its row; operational recommendations (70–80% planning rule, 3 dB margin) are labeled as industry practice, **not** standards; no reference is cited for a claim it does not make; operator-survey data is explicitly not treated as consumer measurement.

---

## Part D — MVP / Roadmap Phasing (updates §24; MVP concept "The First Mile" preserved)

| Addition | MVP | v0.5 | v1.0 | Post-launch |
| --- | --- | --- | --- | --- |
| **Customer acquisition** | Word-of-mouth, referral, door-to-door agents; 4-stage funnel visible (awareness→lead→install→active); install backlog | Local + digital ads, promo campaigns, campaign entity with predictions/CAC; full 8-stage funnel; B2B direct sales | Tenders/institutional channel; per-channel LTV analytics | Channel mods, marketing automation research |
| **Metrics & analytics** | Core metric set from §6.5 (utilization, Rx power, SNR, delivered-vs-advertised, availability); USE-triad bottleneck marker (§6.6) with constraint type; before/after windows | Threshold config + hysteresis (§14.5); capacity forecasting; incident correlation bands | Peak/off-peak reports, revenue-at-risk, SLA compliance reporting depth | Predictive maintenance from error trends, anomaly detection research |
| **Research lab** | Probe-mode experiments only (existing §6.2 probe tool + sandbox) — no bench | FTTH + WISP bench labs with hypothesis/Insight rules | Core + business experiments; `applyLabConfig` production pilots | Community scenario labs, modded experiment packs |
| **IDR localization** | IDR ledger from day one; USD import lines with planning FX; §19.2 price bands in place | Market tiers (§19.1) differentiated; unit-economics panel (§12.6) | Grant/audit economics depth (§12.4), FX-config exposed to modders | — |

Rationale: acquisition needs *something* at MVP (a playable ISP must sign customers) but the campaign entity depends on analytics and install-queue depth; the lab without bench equipment is the probe tool; IDR is cheapest to do correctly at MVP and painful to retrofit. MVP exit criterion (v2 §24.1) unchanged; the funnel's MVP stages plug into it directly.

---

## Part E — Assumptions and Open Questions

**Verified technical values (standards/vendor-anchored):** optical budget classes and Rx floor (G.984.2-class, §7.2); splitter insertion-loss table (§7.2); Fresnel radius formula and 60% clearance practice (§8.2); SNR→MCS tiering as a stylized model; USE triad as diagnostic method; RFC 6349 as measurement-methodology reference.

**Published market data (cited, real):** BPS 2024 penetration (72.78% internet access, 0.99% fixed-line households); APJII home-Wi-Fi price bands (67.4% at Rp 100–300k etc.); APJII operator survey segments and constraint ranking; PM Komdigi 15/2025 licensing structure. Caveats carried: operator survey ≠ consumer conversion; home-Wi-Fi band ≠ willingness-to-pay ceiling; national aggregates ≠ tier resolution.

**Estimated market values (ranges, method-stated):** small-business/dedicated/enterprise pricing (method: service-class multipliers over the published residential band); field-tech salary (method: Indonesian technician wage ranges); install fees and CPE rental (method: promo-practice observation). All tunable in `packages/data`.

**Game balancing values (authored, no external claim):** planning FX rate Rp 16,500/US$; construction cost ranges (v2 USD ranges converted); activity/concurrency percentages; funnel conversion probabilities; threshold/hysteresis defaults; Insight award scaling; backlog patience decay.

**Fictional gameplay mechanics (no real-world claim):** Insight currency; staff quirks; Komtel regulator personality; competitor archetypes; event cadence; lab hypothesis-scoring.

**Open questions added (for §25.2 of the parent GDD):**
1. Does the funnel need per-stage UI on the cluster panel at MVP, or is the weakest-stage flag enough? (Lean: flag only.)
2. Should campaign predictions show confidence bands from day one, or is a point estimate cleaner for new players? (Lean: bands — honesty is a theme.)
3. Does the lab's hypothesis-scoring feel punitive if a valid experiment with a vague hypothesis pays zero? Playtest question; fallback is a minimal participation stipend.
4. Should the planning FX rate drift over eras for flavor, given currency exposure is otherwise not modeled? (Lean: no — static and honest.)
5. Which unit-economics figures are player-visible vs board/investor-report-only? (Ties into §21 dashboard design.)

---

## Part F — Change Summary

**Added:** §13.4–13.8 (acquisition funnel specification, channels, campaigns, tradeoffs, economics hookup); §6.5 (metric catalog with limitations), §6.6 (USE-based bottleneck method replacing the unspecified marker); §14.4 (upgrade-verification and forecasting analytics), §14.5 (threshold taxonomy + hysteresis); §18.1 (research lab with earned rewards and lab/production separation); §12.6 (regional unit economics); §19 fully localized to IDR with published anchors and a four-way assumptions ledger.

**Clarified:** the v2 lifecycle (§13.3) is now the funnel's first-class specification; the bottleneck marker is now an algorithm with a business-weighted aggregation; "delivered/advertised/guaranteed" speeds are now formally distinct; operator-survey data's measurement limits are stated where used.

**Deliberately unchanged:** all architecture (§6.1–6.4), FTTH/WISP physics (§7–8), core network (§9), map/construction (§10), catalog (§11), finance core (§12.1–12.5), incident/ticket systems (§15), staff model (§16), regulator ladder (§17), research tree (§18 table), era ladder (§20), UI screens (§21), modes (§22), technical architecture (§23), MVP exit criterion (§24.1), and the v2 Reality Check rows (§26 — Part C *extends*, not replaces, it).

**Needs further research:** Indonesian construction-cost ground truth (tenders/procurement documents as sources for §19.3 ranges — currently v2 conversions marked as balancing values); competitor AI reaction to player campaigns (§13.5 interaction with §10.4); per-tier take-rate curves (playtest-derived, no published source exists).

---

*End of refinement. NetCorp GDD v2 remains the source of truth; this document modifies it only where stated above.*
