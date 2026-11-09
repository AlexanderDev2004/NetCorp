# NetCorp — ISP Business & Network Simulation Game Design Document

**Version:** 2.0 (redesign) · **Date:** {{date:2026-11-09}} · **Status:** Draft for development planning
**Working title:** NetCorp (alternatives: TransitTown, Fiber & Air, Upstream)

> **What changed from v1.** GDD v1 cast the player as an internal IT team defending one office LAN. That identity is retired. In v2 the player **founds and grows an Internet Service Provider**: they build fiber and wireless infrastructure across a living map, sell subscriptions to real simulated customers, run a NOC, hire staff, deal with a regulator, and answer for every outage with money and reputation. Everything v1 did well — the deterministic command-driven sim, symptom-only tickets, the mail inbox as a risk surface, firmware/CVE pressure, staff traits, the shop of meaningful tradeoffs — is preserved and repurposed as *ISP operations* instead of *office IT*. This document is a rewrite, not an appendix: the core loop, the map, the physics, and the economy are all new.

---

## 1. Executive Summary

NetCorp is a deterministic, tick-based business-and-engineering simulation in which the player builds an Internet Service Provider from a single neighborhood resale operation to a national telecommunications company. The simulation models two access technologies with genuine physical tradeoffs — **FTTH** (fiber, splitters, optical power budgets) and **WISP** (towers, line-of-sight, spectrum) — over a shared geographic map, connected through a core network that buys **IP transit**, peers at exchange points, and manages addressing.

The player's decisions live in three coupled layers:

- **Engineering** — where cables go, which splitter ratio, which tower serves which rooftops, which package fits which node's capacity.
- **Operations** — incidents with explainable causes, technicians, tickets, maintenance, security.
- **Business** — pricing, packages, coverage investment, licensing, payroll, and the constant question: *is this network profitable where it is, or is it just big?*

The game's thesis: an ISP is the rare setting where **physics, topology, and accounting all bite at once**. A splitter ratio is simultaneously a dB margin decision, a capacity decision, and a cost-per-customer decision. That triple-exposure is the core of the design, and every system in this document exists to make the player feel it.

**Pitch line:** *Build the ISP the town deserves — one dB of optical margin and one paid invoice at a time.*

---

## 2. Game Vision and Identity

### 2.1 Vision

You inherit nothing but a small loan, a resale agreement with one upstream carrier, and a town that mostly can't get internet faster than 10 Mbps. You string your first fiber drop yourself. Five years of game time later, you own the metro fiber ring, three towers on the ridge, a rack at the exchange point, and a NOC where someone else works nights — and a regulator wants to talk about your spectrum filing.

The fantasy is **stewardship**: of a physical network you can trace strand by strand, of customers whose trust you earn or lose, and of a company that is never more than one bad quarter from being a cautionary tale.

### 2.2 What this game is not

- Not a packet-level emulator. The simulation is honest about what it aggregates (§27).
- Not a generic tycoon. Money is never an abstraction on a slider; every dollar enters or leaves through a named port, tower, salary, or license.
- Not an exam. Nothing requires certification-style answers; the network itself is the feedback machine.

### 2.3 Design pillars

1. **The wire is real.** Optical power, line of sight, cable distance, and port capacity are simulated quantities. A link that fails does so for a physical reason the player can discover and fix.
2. **The customer pays the bills.** Every technical object has a P&L shadow: CAPEX to build, OPEX to run, revenue if customers subscribe, penalties if they churn. Business decisions change what the network can do; the network changes what the business can sell.
3. **Diagnosis is the gameplay.** Tickets and alerts report symptoms, never causes. The player reads the network — power levels, utilization graphs, LoS surveys, logs — to find the truth.
4. **Every purchase is a tradeoff.** No strictly-better equipment. A 1:32 splitter is brilliant at 90% take-rate and a disaster at 20%. A cheap tower saves money and buys you a rain-fade outage every monsoon.
5. **The mail is the meta.** Vendor notices, CVEs, invoices, regulator letters, and phishing all arrive in one inbox the player must actually manage.
6. **Growth changes the game.** Each era adds a new *kind* of problem, not just a bigger number: from "one PON port is saturated" to "our upstream is also our competitor" to "we are a peering partner now."

### 2.4 Target audience

- Primary: players who liked **Quorum**, **Series of Tubes**, **Mini Motorways**-style systemic clarity, or **Workers & Resources**-style accountability; homelabbers, junior network engineers, ISP employees, telecom students.
- Secondary: business-sim players attracted by the infrastructure angle (UI keeps a "simplified" configuration mode for them, §22).
- No prior networking knowledge assumed; the game teaches by consequence, with an in-game field guide for every mechanic.

---

## 3. Design Pillars in Practice (Operational Rules)

These convert the pillars into testable rules for the whole team:

| # | Rule | Test |
| --- | --- | --- |
| R1 | No incident may be *caused* by a dice roll | Every incident has a state-based precondition chain; RNG only picks *which* qualifying cause fires first |
| R2 | No statistic without behavior | Every number shown to the player must change at least one decision they could make |
| R3 | Symptoms, never causes | A ticket titled by its cause is a content bug (this rule is enforced by a unit test in the existing codebase) |
| R4 | Nothing sells itself | Every catalog item must have a workload where it is the *wrong* buy |
| R5 | Money has provenance | Every cash movement in the ledger is traceable to a device, license, employee, customer, or contract |
| R6 | Simplifications are documented | Every mechanic's field-guide entry states what is simplified and why (§27) |

---

## 4. Inspirations and Competitive Analysis

### 4.1 What we take, what we drop

| Source | What we take | What we deliberately drop |
| --- | --- | --- |
| **Series of Tubes** | Geographic infrastructure expansion; upstream/IP-transit economics; Tier 1/2 carrier relationships; IXPs and peering; traffic engineering as gameplay; geopolitical disruption events | Its abstract globe scale; we stay at the scale of one region where individual customers exist |
| **Quorum** | Component-based simulation; bottleneck-as-content; business meta-loop; mail with traps; eras; research currency; honest disclaimers; percentile-based social features | Software-stack simulation; we simulate *access networks and an ISP business*, not app runtimes |
| **Cisco Packet Tracer / GNS3** | Config-panel and CLI depth; the joy of watching a packet die and seeing *why*; simulation mode as debugger | Emulation fidelity, exam framing, VM friction |
| **MikroTik / RouterOS / WISPs** | WinBox-style device panels; real WISP vocabulary (PtP backhaul, sector plans, Fresnel zone); the culture of scrappy regional ISPs | Vendor-specific syntax as a requirement |
| **Workers & Resources / Factorio** | Physical provenance of everything; legibility of systems at scale | Their punishing onboarding; we teach through consequence, not manuals |
| **Game Dev Tycoon / Big Pharma** | Budget rhythm, project pacing | Abstract market sliders |
| **NetCorp GDD v1 (internal)** | Deterministic sim + commands; symptom-only tickets; mail inbox with phishing; firmware/CVE feed; staff traits (skill, confidence, communication); runbooks; the shop's no-treadmill rule | The single-office scale, the "IT department for hire" framing |

### 4.2 Competitive position

No shipping game combines a **geographic ISP build-out** with **hands-on network configuration**. Series of Tubes has the macro without the hands; Packet Tracer has the hands without the business or the map; tycoons have the business without the physics. NetCorp occupies the intersection, and the intersection is the identity.

---

## 5. Core Gameplay Loops

### 5.1 Short loop (seconds–minutes): Observe → Diagnose → Configure → Measure

1. A dashboard tile or alert flags something: a PON port at 97% utilization, a sector's latency crawling, a customer power level drifting out of spec.
2. The player opens the device/customer, reads the numbers, forms a hypothesis.
3. They act: raise a package, rebalance a splitter, add a sector, raise a ticket for a technician.
4. The sim re-measures; graphs confirm or refute. Insight is awarded for *correctly attributed* fixes.

### 5.2 Operational loop (minutes): Incident → Investigate → Dispatch → Restore → Close

An alert or complaint opens a **ticket** (symptom text only). The player investigates (remotely from the NOC, or by dispatching a technician with travel time and a skill profile), fixes the root cause, verifies with measurements, and closes. SLA timers run on business-critical customers. The loop is described in detail in §15.

### 5.3 Business loop (hours–days): Market → Sell → Deliver → Reinvest

Read the market map (uncovered households, competitor prices, demand density) → decide where to extend coverage → choose the technology (fiber vs wireless) → price a package → sign customers → deliver the promised bandwidth without melting the aggregation layer → collect MRR → reinvest.

### 5.4 Growth loop (weeks–months): Revenue → Research → Infrastructure → Territories

Revenue funds research and construction; research unlocks technologies (XGS-PON, 11 GHz backhaul, BGP multi-homing); infrastructure unlocks territories; territories bring larger customer classes (schools, industry, government) with stricter requirements.

### 5.5 Long-term arc

Garage reseller → neighborhood WISP → fiber into the first village → local ISP with a POP → regional ISP at the IXP → provincial carrier with its own fiber ring → national telecommunications enterprise. Each rung is defined in §20.

### 5.6 A session in play (example, ~30 minutes)

Morning: the overnight report shows 3 new tickets. One is a village that lost fiber backhaul ("no sync" — a digger cut the feeder; you dispatch a fiber tech with a splicer). One is "slow at night" on Treefall estate — the 1:32 splitter you deployed when only 9 homes subscribed now has 29, and the PON port is congested; you plan a second OLT port. The third is spam — but the *third real* mail is the regulator's renewal notice for your 5 GHz filings. At noon a monsoon event degrades the ridge PtP backhaul to 40%; you've been meaning to replace it with the licensed 11 GHz link the shop is running a promo on. You don't have the cash and the tower crew is booked until Thursday. You choose: throttle the two villages on that backhaul and eat complaints, or take a loan. Credits screen shows you're 4 days from payroll. Welcome to the ISP business.

---

## 6. Network Simulation Architecture

### 6.1 The layered model

The network is modeled in four layers over one geographic world:

```
┌────────────────────────────────────────────────────────────┐
│ L4 SERVICE   customers · packages · QoE · SLA · satisfaction│
├────────────────────────────────────────────────────────────┤
│ L3 CORE      ASN · transit · peering · addressing · CGNAT   │
│              routing policy · DNS/DHCP services             │
├────────────────────────────────────────────────────────────┤
│ L2 AGGREGATION  OLT/PON trees · tower/sector trees ·        │
│              switches · routers · capacity & congestion     │
├────────────────────────────────────────────────────────────┤
│ L1 PHYSICAL  fiber strands & routes · towers · LoS/Fresnel  │
│              spectrum · power · weather · terrain           │
└────────────────────────────────────────────────────────────┘
```

Each layer reads the layer below and is read by the layer above. **The bottleneck that matters is whichever layer is most constrained for a given customer**, and as the ISP grows, the binding constraint migrates between layers — this is the "moving bottleneck" principle (pillar 6).

### 6.2 Traffic model: flow-level by default

**Design decision (tradeoff):** the simulation aggregates traffic into **flows and utilization** rather than simulating packets. A packet-level core would produce unmatched "aha" moments but caps the network at a few dozen nodes; a flow model scales to thousands of customers, which is the actual subject of the game.

- Every customer generates a **demand profile**: package speed × activity probability × diurnal curve (residential evening peak, business daytime peak, school term-time).
- Offered load on any aggregation point = Σ (demands of everything routed through it, with statistical multiplexing: `effective_load = Σ demand_i × activity_i`, no per-packet queueing math).
- When offered load approaches capacity, delivered throughput compresses and latency/loss rise — customers experience "slow internet," not "the PON is saturated."
- **Probe mode** (a player tool, not a background sim): when the player runs ping/traceroute/iperf-style probes from any point, the engine computes the result *on demand* against the flow model, including per-hop drops (no route, ACL deny, congested egress, no sync, LoS lost). This is where Packet Tracer-style visibility lives, exactly when the player asks for it.

### 6.3 Deterministic core and commands

The existing NetCorp architecture carries over unchanged in shape, and is the reason this redesign is implementable:

- **Pure simulation core** (`packages/sim`): deterministic, tick-based (1 tick = 1 game hour by default; configurable), no DOM access, no I/O.
- **World state + commands**: every player and staff action is a command object (`placeDevice`, `wireLink`, `setIpv4`, `sellPackage`, `dispatchTechnician`, `payInvoice`, `applyForLicense`…). Commands mutate state and emit **events** (which the UI renders and the log records).
- Consequences: replays, challenge verification, save/load as event logs, future co-op with host-authoritative sim, and unit-testable network behavior — all for free.
- All content (device catalog, vendor profiles, mail templates, packages, scenario definitions, weather regions, regulator rules) lives in the `packages/data` catalog as data, not code (modding-friendly).

### 6.4 What the simulation computes per tick

Per-tick work is dominated by L4 accounting over customers and L1 state (weather, wear, power). Routing recomputation is event-driven (topology change only). Utilization, satisfaction, and finance are updated per tick; telemetry graphs are sampled per tick and retained per day/hour/month buckets for the NOC's historical views.

---

## 7. FTTH System Design

### 7.1 The fiber chain

The player builds and owns this chain from the POP outward:

```
Upstream/transit ─ Border/Edge router ─ Core router ─ Distribution switch
      ─ OLT (PON ports) ─ Feeder fiber ─ ODF ─ ODC/ODP ─ PLC splitter
      ─ Distribution fiber ─ Drop fiber ─ ONT/ONU ─ Customer router (Wi-Fi)
```

Fictional roles for clarity: the **ODF** terminates feeder cables at the POP; an **ODC** (cabinet) or **ODP** (smaller point, pole/wall-mounted) hosts splitters in the field.

### 7.2 Optical physics (the real rules the game simulates)

**Optical power budget** — every optical path is computed as:

```
P_rx = P_tx − Σ(attenuation) − Σ(splitter loss) − Σ(connector/splice loss)
budget_check: P_tx − P_rx ≥ requirement, margin = budget_available − budget_used ≥ 3 dB
```

Reference values used by the sim:

| Element | Loss/value | Notes |
| --- | --- | --- |
| Fiber attenuation | 0.35 dB/km @1310 nm, 0.25 dB/km @1550 nm | Distance is geodesic along the *built cable route*, not straight line |
| Splitter 1:2 / 1:8 / 1:16 / 1:32 | 3.6 / 10.5 / 13.8 / 17.1 dB | Ratio is also the max customers per tree branch |
| Connector / splice | 0.5 / 0.1 dB | Workmanship quality (technician skill) adds variance |
| Class B+ optics | 28 dB budget | Standard/cheap; Class C+ (32 dB) is a research unlock |
| ONT receive floor | −27 dBm (B+) | Below floor = no sync or unstable |

**Failure modes from real physics:** too many splitters on a long run → no sync; degraded splice (water ingress) → power drifts down over weeks → intermittent complaints; bent/macro-bent drop fiber from a sloppy technician install → permanent low margin; fiber cut → whole tree down.

**Player-facing consequence:** every ONT reports its measured Rx power. A tree running at 26 dB used of 28 dB budget "works" until a splice degrades — and then it's *his* problem to explain the intermittent sync losses in Village 4. Margin is a hidden difficulty slider the player set themselves.

### 7.3 PON technologies

| Technology | Down/up per PON port | Max split | Cost level | Era |
| --- | --- | --- | --- | --- |
| EPON | 1.25 / 1.25 Gbps | 1:32 | Low | 1 |
| GPON | 2.49 / 1.24 Gbps | 1:64 (practical 1:32) | Low–mid | 1 |
| XGS-PON | 9.95 / 9.95 Gbps | 1:64–1:128 | High | 4 |

Oversubscription is the player's core FTTH math: a GPON port carries 2.49 Gbps shared; selling thirty 300 Mbps packages on one 1:32 tree "works" only because residential activity rates keep concurrent demand under capacity — until the streaming night. **The oversubscription ratio** (Σ subscribed speeds ÷ port capacity) is displayed honestly per PON port and per package; the *congestion* is what customers feel.

### 7.4 FTTH player actions, rules, and consequences

- **Player actions:** lay cable routes (per-segment cost by terrain and distance), place ODF/ODC/ODP, choose splitter ratios, assign drops to splitters, install ONTs (activation fee), swap OLT line cards, repair cuts.
- **System rules:** a drop must have a physical path to a splitter with optical margin; a splitter must have feeder margin to a PON port; PON port capacity is shared by all trees on it.
- **Inputs:** map geometry, catalog items, packages assigned to customers, weather (rare, for aerial fiber), construction events.
- **Outputs:** per-ONT power levels, per-PON utilization, per-tree customer counts, delivery of (or failure to deliver) package speeds.
- **Failure conditions:** no margin (no sync), saturation (congestion complaints), physical cut (outage tree), port/hardware failure (wear-scheduled).
- **Economic consequences:** cost per passing home vs cost per *subscriber* is the central FTTH tension — fiber through a wealthy apartment block and fiber through a rice-field hamlet cost the same per km.
- **Progression:** EPON/GPON at Era 1, C+ optics Era 3, XGS-PON Era 4, WDM coexistence research to run GPON+XGS on one existing fiber (Era 5) — the classic "why we rebuild the OLT" moment.

**Worked example (teaching scenario, era 1):** Ridgeline Court has 16 homes, 400 m from the nearest ODP. Options: 1:16 splitter on one PON port (cheap, one tree, 13.8 dB of the budget spent at the splitter alone), or two 1:8 splitters on two ports (more hardware, double the port capacity, more margin). At a forecast 60% take-rate the 1:16 saturates within a year. The game never says this; the utilization graph says it six months later.

---

## 8. WISP System Design

### 8.1 The wireless chain

```
Core network ─ Fiber or PtP backhaul ─ Tower ─ Sector antennas (PtMP)
      ─ Customer CPE (rooftop dish/panel) ─ CPE router
```

Towers come in heights (12/30/50 m) with mounting slots, power options (grid, solar+battery, generator), and access difficulty (a ridge tower with no road has higher maintenance cost — technicians take longer to reach it).

### 8.2 Wireless physics

- **Line of Sight (LoS):** terrain is sampled along the CPE↔sector path; buildings add obstruction where mapped. No LoS = no service (or heavily degraded at low frequencies only).
- **Fresnel zone:** first-zone radius at path midpoint `r = 8.66 × √(d_km / f_GHz)` meters; the sim requires ≥60% clearance for full performance. A path that grazes a treeline loses margin — and the treeline grows (seasonal vegetation events).
- **Signal quality → capacity:** the sim maps SNR to modulation (MCS) tiers: SNR < 8 dB = marginal (lowest MCS), 8–20 = mid, > 20 = high. Sector capacity is shared by all CPEs on it, weighted by their achievable MCS.
- **Spectrum:** license-exempt 2.4/5 GHz (shared, interference-prone, free to use) vs licensed 6/11 GHz PtP backhaul (clean, expensive, requires a spectrum permit, §18). Channel width and frequency choice are player decisions per sector; overlapping sectors on the same channel self-interfere.
- **Weather:** rain fade on 5 GHz is mild but real during monsoon events; on 11 GHz+ it is significant (a design lever for backhaul choices). Wind events stress tower alignment (misaligned sectors drift).

### 8.3 WISP player actions, rules, and consequences

- **Player actions:** place towers, mount sectors (choose azimuth, channel, width), establish PtP backhaul links, install CPEs, survey candidate rooftops (survey tool shows predicted SNR before you spend the truck roll).
- **System rules:** a CPE must clear Fresnel to a sector; sector capacity is shared; backhaul must carry the sum of served sectors; tower power must cover the draw or the site browns out.
- **Failure conditions:** obstruction growth, interference (neighbors' towers, or *your own* misplanned channels), backhaul congestion, rain fade, tower power failure, hardware wear.
- **Economic consequences:** WISP CAPEX per customer is 3–10× lower than FTTH and deployable in days — but sector capacity ceilings are hard, and licensed backhaul and tower OPEX erode the advantage. The strategic rule of thumb the game teaches without stating: *WISP is how you get there first; fiber is how you stay.*
- **Progression:** 5 GHz PtMP + 60 GHz PtP at Era 1; GPS-sync (self-interference reduction) Era 2; licensed 11 GHz backhaul Era 3; massive-MIMO-like high-capacity sectors Era 5.

**Worked example:** Two villages sit across a valley, 7 km apart, each ~15 interested households. One tower with two sectors reaches both from the ridge — one backhaul, 30 customers on ~500 Mbps of shared sector capacity. It is the right answer for two years. At year three, a competitor has a WISP too, the 5 GHz band is crowded, and the school in Village B wants 200 Mbps symmetric with an SLA. Now the answer is fiber to the ridge and a licensed PtP — and the game's geography made the player money *and* created the exact problem that forces the upgrade.

### 8.4 Hybrid doctrine

FTTH and WISP are not rivals in the player's network; they are a portfolio. Canonical hybrid patterns the game supports natively: fiber backbone with WISP edge villages; WISP backhaul *to* the fiber POP while the fiber build is funded; WISP as interim service on streets where fiber construction is queued. Access technology choice per area is a strategic decision weighted by geography, density, construction cost, and expected demand (§11).

---

## 9. Core Network and Upstream Connectivity

### 9.1 Upstream and transit

- The player starts with a **resale agreement** (sell a wholesaler's product under your brand; no own addressing; thin margins) and can graduate to a **transit contract**: committed rate (e.g. 1 Gbps, 10 Gbps) with 95th-percentile billing above commit.
- Transit pricing follows a market curve by era and region: ~$1.50/Mbps/mo at Era 1 down to ~$0.15 at Era 6 — bandwidth cost is a first-class OPEX line and a reason peering exists.
- **Upstream quality varies:** the cheap transit provider has congestion at peak (your customers' speed tests suffer on *your* reputation), occasional outages, and slow support. Multi-homing (two upstreams, Era 3+) is the fix — and introduces its own routing policy gameplay.

### 9.2 ASN, addressing, and BGP (stylized)

- At Era 3 the player can register an **ASN** and a **public IPv4 block** (a scarce, appreciating asset — the game models a shrinking free pool; IPv4 transfer market exists) and **IPv6 allocation** (abundant but requires dual-stack work on every device/service — modeled as a per-device capability flag and a research track).
- **BGP is policy-level, not route-exchange-level (design decision, tradeoff):** the player does not type prefix-lists. They set *relationships and policies* — primary/backup upstream, local-preference weights, what to announce to whom, whether to accept a peer's routes — and the sim computes reachability, path choice, and failure modes (route leak, provider prepend mistakes, accidental "we are transit for the world" announcement). This preserves the *decisions and failure modes* of BGP without a full routing-table simulation that no game needs. Reality-check in §27.
- **CGNAT** (Era 3): cheap IPv4 survival strategy; constrained port pools break inbound services and game consoles — a scripted complaint class with a real fix (IPv6 rollout, or buy IPv4).

### 9.3 Internet Exchange Points and peering

- The region's **IXP** is a physical place (a rack you rent in Era 3+). Peering with content networks and other regional ISPs *diverts traffic off paid transit*, directly reducing the largest OPEX line at scale.
- Peering policy is a decision: open peering (goodwill, more offload), selective (protect revenue), or no peering (your upstream — who is often also a competitor — thanks you).
- **IXP incidents:** a route leak at the exchange (someone else's fault, your outage), a peering dispute event with a content network (traffic stays on transit; bills spike; PR choice), and DDoS reflection arriving via the IXP.

### 9.4 Core services

DNS (recursive resolver with caching, forwarders; cache-poisoning attack class carried over from v1), DHCP (pools, relay, lease management, rogue-DHCP incident — the v1 implementation is reused as a customer-side and NOC-side mechanic), NTP, RADIUS (for PPPoE/IPoE session auth on WISP), and management/monitoring plane (SNMP-analog telemetry, syslog, NetFlow-analog summaries — the NOC's data sources, §15).

---

## 10. Geographic Construction System

### 10.1 The map

One region composed of named settlements (cities, towns, villages, hamlets) and terrain (roads, rivers, rice paddies, forests, hills). Each **building cluster** has: household count, business/government/school special buildings, wealth profile, and an **interest level** (willingness to subscribe, driven by current service quality, price sensitivity, and marketing). Aerial photography look, schematic-render option (§22).

### 10.2 Surveying and planning

- **Demand map overlay:** prospective customers as a heat layer; competitor coverage as shaded polygons.
- **Route planning:** the player draws fiber routes segment by segment. Each segment costs `length × rate(terrain) + permits`; terrain multipliers: paved-road trenching 1.0×, aerial on existing poles 0.6× (but storm-vulnerable), river crossing 4×, rocky/urban-core 2–3×, private land requires right-of-way (time + fee, §18).
- **Coverage prediction:** from any tower or ODP, the game shows which clusters *could* be served (LoS Fresnel for wireless; distance/cost for fiber) before a single dollar is spent. Good planning is rewarded; the map forgives nothing.

### 10.3 Construction

- Projects take real game time (a crew lays cable at a per-day rate; a tower takes a build window; monsoon season delays aerial work).
- Crews are hired (§16) or contracted (faster, pricier, no skill growth). Player-built infrastructure appears on the map as first-class objects with maintenance schedules and wear.
- **Construction incidents:** permit delays, a landowner dispute event, "we cut someone else's fiber while digging" (reciprocal incident — you receive a bill and a lesson).

### 10.4 Competition

Two to five AI ISPs share the region with distinct strategies: the incumbent telco (slow, expensive, everywhere in the city), a discount WISP (cheap, congested), a fiber overbuilder (well-funded, enters profitable areas). Market share in each cluster resolves from coverage, price, reputation, and satisfaction. Competitors react over time: price cuts where you're strong, poaching your underserved areas, and (era 5+) acquiring smaller rivals. The player can also propose **wholesale/roaming deals** — carrying a competitor's customers where they have no coverage (margin, no loyalty).

---

## 11. Equipment and Component Catalog

### 11.1 Catalog structure

Data-driven (`packages/data`), with vendor personalities carried over from v1. Fields per item: price, capability set, capacity (pps/Gbps/port counts), power draw, environmental rating, failure rate (MTBF curve), firmware channel, and era availability.

### 11.2 Catalog highlights (representative, not exhaustive)

| Domain | Items (cheap → premium) | Key tradeoff |
| --- | --- | --- |
| OLT | 1-PON-port desktop OLT → 16-port rack OLT → chassis OLT | Port density vs cost vs power; chassis needs a real rack site |
| Splitters | 1:2 … 1:32, LGX-box vs bare | Ratio vs dB budget vs per-customer cost |
| Optics | B+ SFP → C+ SFP → XGS SFP+ | dB budget vs price |
| Routers | SOHO → edge router → core router → chassis | Throughput, session count, feature set (BGP full tables needs RAM!) |
| Switches | Unmanaged → smart → managed L2/L3 | PoE budget for tower tops and ONTs, VLAN depth |
| Wireless | 5 GHz sector (90°) → high-capacity sector → 60 GHz PtP → 11 GHz licensed PtP | Capacity vs spectrum class vs weather sensitivity |
| Towers | 12 m pole → 30 m self-support → 50 m guyed | Height (coverage) vs cost vs permitting (§18) |
| CPE | Basic CPE → dual-band CPE → SFU+router | Cost per install vs support burden |
| Power | Power strip → line-interactive UPS → online UPS + battery bank → generator | Runtime vs cost; site class matters (a POP without genset is a SLA lawsuit in waiting) |
| Test gear | Power meter (basic) → OTDR (localizes cuts to ±m!) → spectrum analyzer | Diagnosis speed vs price; the OTDR is the fiber tech's best friend |
| Splicing | Mechanical splice kit (lossy, fast) → fusion splicer (clean, expensive) | Workmanship quality feeds the dB variance directly |

### 11.3 Shop dynamics

Carried over from v1, restated for ISP scale: no tier treadmill (each item fits a workload); vendor personalities (one ships great OLTs and abandons firmware; one's cheap sectors drift in wind); **used market** (discounted towers with hidden corrosion, leased-core returns); **fleet deals** and vendor financing at higher eras; equipment **type approval** required by the regulator before a device class can be deployed (§18).

---

## 12. Business and Financial Simulation

### 12.1 The ledger

Every cash movement is a named event (R5). Headline figures on the dashboard: cash, monthly recurring revenue (MRR), monthly OPEX, net burn, runway (months of cash at current burn), and valuation-ish "company worth" for era gates.

### 12.2 Revenue model

- **MRR = Σ customers × package price**, net of wholesale costs in resale mode.
- **Churn** is the quiet killer: each customer has satisfaction (uptime experienced, delivered-vs-promised speed, support responsiveness, price vs alternatives); satisfaction below threshold → cancellation event with a reason string.
- **Installation fees** offset truck rolls; **contracts** (12/24 mo) reduce churn but scare off price-sensitive households; **SLA products** (business tiers) pay 2–5× residential rates and impose penalties (§15).
- **CAC vs LTV:** marketing spend per cluster raises interest and trial installs; the dashboard shows payback months per cluster — the game's gentle lesson that a bad neighborhood deal is a slow leak, not a splash.

### 12.3 Cost model

| Line | Driver |
| --- | --- |
| Transit/bandwidth | 95th-percentile usage above commit; peering offload reduces it |
| Payroll | Headcount × salary (§16) |
| Electricity | POP and tower power draw × tariff (grid reliability per area varies) |
| Maintenance | Fleet size × wear rate; tower access difficulty |
| Leases | POP rack space, tower land, IXP port, office |
| Debt service | Loans (§12.4) |
| Regulatory | License fees, permit fees, renewal events (§18) |

### 12.4 Financing

- **Loans** with terms and covenants (miss two payrolls → default event, reputation crash, possible game-over unless a bridge investor event is accepted, which dilutes future era-gate money).
- **Vendor financing** on big purchases (higher total, no bank approval).
- **Grants/subsidy programs** (era 3+): a rural-connectivity fund pays 30–50% of approved village fiber projects — with audit strings (deliver the promised coverage within 18 months, or repay + fine). A entire strategic pathway (rural-focused ISP) hangs off this mechanic.

### 12.5 The congestion economics loop

The design's central engine, worth stating explicitly:

```
Sell packages → customers add load → utilization rises → delivered speed drops
  → complaints/churn OR capacity CAPEX → transit bill rises → margin thins
  → price increase / package redesign / peering / efficiency
```

Every path out of this loop is a real ISP strategy, and the game's difficulty curve is tuned so the loop tightens at each era.

---

## 13. Customer and Subscription Systems

### 13.1 Customer classes

| Class | Volume | ARPU | Demands | Special teeth |
| --- | --- | --- | --- | --- |
| Residential | Many | Low | Speed, price, evening performance | Churn freely, review publicly |
| Small business | Some | Mid | Reliability, static IP, quick support | Anchor of early MRR; leaves quietly |
| Enterprise | Few | High | SLA with penalties, redundant paths, IPv6 | Requires dual-upstream design to even sign |
| School | Few | Mid | Term-time peaks, content filtering (regulatory!), budget cycles | Referrals to other institutions |
| Government | Very few | High | Compliance, security audits, data residency | Regularity audits; slow pay, big reputation |
| Industrial | Rare | Very high | Uptime, private APN/VLAN, field service response | Site visits, harsh environments |

### 13.2 Packages

Player-defined products: speed (down/up), price, install fee, contract length, FUP policy (soft cap → deprioritization, the classic WISP tool), and optional SLA. Packages are assigned per node; the sim *delivers* what physics and capacity allow, not what the brochure says — and speed-test evidence lands in tickets and reviews.

### 13.3 The customer lifecycle

Prospect (interest by cluster) → Lead (marketing or referral) → Install (truck roll scheduled, technician skill affects workmanship quality → optical margin / SNR / Wi-Fi setup quality) → Subscriber (satisfaction evolves) → Renew/churn. Each stage is instrumented; the "install quality" stat quietly determines how many quiet-margin tickets the player sees a year later.

---

## 14. NOC and Network Operations

### 14.1 The NOC dashboard

Real-time: map with node health, top talkers, per-PON/per-sector utilization bars, latency/loss sparklines on backbone links, active alerts. Historical: per-day/hour/month views, SLA compliance report per business customer, and the **weekly network report** (auto-generated, readable — the player can forward it to the board/investor).

### 14.2 Monitoring as a build, not a HUD

Carried over from v1 as a principle: an unmonitored network is silent. The player *buys and configures* monitoring (a monitoring server, telemetry enabled on devices, thresholds set). Better monitoring = earlier detection = shorter outages; and monitoring infra itself needs a server, power, and care. The game's alerts originate from the player's own monitoring stack — no omniscient narrator.

### 14.3 Maintenance

Wear accumulates on every device (MTBF curves, environment modifiers: heat, dust, humidity, vibration on towers). The player schedules maintenance windows (advance-notify affected customers → reduced penalty), replaces aging fleet before failures, and manages spares inventory (a shelf with the right SFP at 2 AM is a purchase decision made a year earlier).

---

## 15. Tickets, Incidents and Cybersecurity

### 15.1 Tickets

Carried over intact from v1's system, reskinned: tickets are written by customers (or generated by monitoring) **in symptom language only** ("internet slow since last night," "no lights on the box," "video calls drop every meeting"). Each has a client, an SLA countdown (business tiers), and a thread. The player investigates or delegates (§16). Resolution quality (correct root cause vs reboot-until-quiet) feeds insight and recurrence rules — an unresolved root cause re-tickets within days (rule R1's twin: the network doesn't forget).

### 15.2 Incident generation: causes, not dice

All incidents require a **precondition chain** in the simulation state; randomness only selects timing among qualifying causes. Taxonomy:

| Class | Examples | Precondition |
| --- | --- | --- |
| Physical | Fiber cut (digger/storm/tree-fall), splice degradation, connector dirt | Built route exposed to activity corridor; or weather event crosses aerial route |
| Power | Grid outage at site, battery depleted, brownout damage | Site has no adequate backup |
| Hardware | OLT card failure, sector radio failure, worn PSU | Age/wear threshold; heat accelerates |
| Capacity | PON/sector/backhaul congestion, session exhaustion | Utilization above sustained threshold |
| Wireless | Interference from competitor, rain fade, misalignment | Channel overlap; monsoon; wind event |
| Upstream | Transit outage, transit congestion, route leak at IXP | Single-upstream design; peering misconfig |
| Configuration | Anything the player or staff misconfigured surfaces as a ticket, not an error dialog (v1 rule) | — |
| Security | §15.4 | Exposed surface + unpatched firmware / weak config |

### 15.3 Incident flow

Alert (from *your* monitoring) or complaint → triage (severity, affected customers auto-counted from topology) → investigate (remote probes; dispatch tech with skills and travel time; OTDR on fiber issues) → fix → verify (measurements, not vibes) → close → **postmortem** for criticals (root cause, one action item; writing it grants Insight; skipping lets the incident class recur harder — carried over from v1).

### 15.4 Cybersecurity

Attackers target the player's actual exposed surface (v1 model, scaled up): scans on management IPs, brute force on device logins, DDoS on the POP or a business customer (mitigations: rate limiting, upstream scrubbing service — paid, effective; blackholing — fast, collateral damage), DNS cache poisoning (the v1 CVE event), unauthorized CPE/rogue device insertion (v1's rogue-DHCP becomes "someone plugged a consumer router into an ODP LAN port" — and its whole tree now fights for DHCP), ransomware on internal servers (backups are a purchasable, testable practice), and phishing (§5 of the mail system). Security tooling (firewall rules, management VLAN, patch cadence, backups) is *built*, purchased, and configured — never a HUD abstraction.

### 15.5 Severity and the NOC at night

Night events delegate to on-call staff with competence/confidence/communication traits (§16); mishap chance is real, and staff notes come in-character. Reputation effects scale with affected-customer-hours, not incident count.

---

## 16. Employee and Workforce Systems

### 16.1 Roles

| Role | What they do | Player-facing effect |
| --- | --- | --- |
| Network Engineer | Designs/configures; sign-off on complex configs (BGP, dual-homing) | Delegation of remote fixes; config review |
| NOC Engineer | Watches alerts, triages | Night coverage; alert ack speed |
| Field Technician | Truck rolls, installs, repairs (copper/fiber/wireless specializations) | Travel time, workmanship quality stat |
| Fiber Optic Technician | Splicing, OTDR, civil works oversight | Splice loss quality; cut repair speed |
| Customer Support | Answers, calms, resolves simple tickets | Ticket deflection; satisfaction |
| Sales Rep | Leads generation in clusters | CAC reduction in assigned areas |
| Finance/Admin | Invoicing, payroll accuracy, tax filings | Fewer "billing incident" events |
| Security Specialist | Hardening, audit prep, incident response | Attack surface reduction, faster containment |

### 16.2 Employee model

Each employee: role, skill (1–10 per specialty), **confidence** (acts without escalating), **communication** (writes useful notes), salary, morale, and quirks (v1's "fragrant optimism" — reports success where none occurred — is too good to lose). Hiring pool refreshes; training costs cash + time and lifts skills; certifications (internally-flavored, no real trademark) unlock sign-off abilities.

### 16.3 Delegation and schedules

Tickets/alerts/projects assign to staff; outcomes are simulated with skill + workload + confidence. Shift scheduling covers the 24h clock; understaffed nights are where reputations die. At scale, the player's real job shifts from doing to *designing the organization that does* — the same escalation of abstraction the technical side gets.

---

## 17. Legal and Regulatory Simulation

### 17.1 Setting

A fictionalized archipelago nation, **Nusantara Baru** (Indonesia-inspired, deliberately fictional): dense cities, dispersed islands and villages, monsoon weather, a fast-growing internet market. The regulator is the **Komtel** (Komisi Telekomunikasi). All organizations, names, and forms are invented; a clearly labeled "Game vs Reality" panel documents every abstraction (rule R6; §27).

### 17.2 The compliance ladder

| Requirement | Unlocks/requires | Consequence of neglect |
| --- | --- | --- |
| Business registration | Era 0 gate | Can't legally invoice |
| ISP operating authorization (network + services) | Own addressing, selling under own brand | Fines; forced resale-only mode |
| Construction / right-of-way permits | Per municipality and land class | Work stoppage events; retrofit fines |
| Spectrum permits (licensed bands, PtP links) | 6/11 GHz backhaul, higher capacities | Illegal-link event: forced shutdown of the link |
| Equipment type approval | New device classes deployable | Blocked deployments |
| Consumer protection | Billing accuracy, honest advertising of speeds | Complaint-driven audits; fines; reputation |
| Data protection & breach disclosure | Handling customer data; 72h disclosure window decision | Scandal multiplier if hidden and discovered |
| Security obligations (critical infrastructure, Era 5+) | Minimum controls on core infrastructure | Audit findings; era-gate lock |

### 17.3 Design intent

Compliance is *pace-setting*, not paperwork-sim: each requirement is a timed decision with a cost, a queue, and a consequence. The regulator's personality is firm-but-fair; audits focus on whatever the player has been neglecting (driven by the same state-based logic as incidents). Late-game event: a national data-protection modernization bill forces fleet-wide changes — an era-defining compliance sprint.

---

## 18. Research and Technology Progression

Research spends **Insight** (earned from correct diagnoses, postmortems, and first-time solutions — carried over from v1) plus cash and time. The tree's branches, with the strategic choice each unlock represents:

| Branch | Sample unlocks | Strategic choice it creates |
| --- | --- | --- |
| Fiber optics | C+ optics, XGS-PON, WDM coexistence, OTDR-assisted repair | Depth of FTTH vs earlier wireless reach |
| Wireless | GPS sync, licensed backhaul, high-capacity sectors | Spectrum strategy |
| Core routing | BGP multi-homing, IXP peering, traffic engineering | Independence from upstreams |
| Addressing | IPv6 dual-stack program | Escape CGNAT; enterprise eligibility |
| Automation | Config templates, fleet push, self-healing runbooks | Ops scalability vs hands-on control (v1's runbook idea, systematized) |
| Observability | Flow analysis, predictive maintenance | Fewer surprises, better SLAs |
| Security | Hardening programs, scrubbing partnerships | Risk posture |
| Business | CRM depth, dynamic pricing, wholesale products | Margin levers |

Research gates *capabilities*, not stats: no "+5% throughput" nodes. Every unlock is a new decision the player didn't have before.

---

## 19. Economy and Balancing (Reference Numbers)

Baseline numbers for the MVP region (tunable in data files; the sim reads them, never hardcodes):

| Item | MVP value |
| --- | --- |
| Starting capital | $25,000 (loan partially) |
| Resale margin (Era 0) | 15–25% of package price |
| Transit (Era 1, regional) | $1.20/Mbps/mo on 1 Gbps commit |
| Fiber build, aerial | $4–7 per meter |
| Fiber build, underground | $12–20 per meter |
| Tower 30 m, built | $18,000–30,000 |
| GPON OLT (8 ports) + optics | $6,000 |
| 5 GHz sector + mount | $900 |
| CPE installed | $120–180 (often financed via install fee) |
| Residential package (100/20) | $18–25/mo typical market |
| Residential activity at peak | 30–50% of package, 40–60% of customers concurrently |
| Field tech salary | $2,200/mo |
| Payback on residential fiber build | 18–36 months at 50% take-rate |

Balancing targets: the "congestion economics loop" (§12.5) should tighten every 2–4 hours of play; a residential customer should be profitable within a year *if* the build decision was sound; no single strategy (all-fiber, all-wireless, discount, premium) should be dominant across two consecutive eras. The **bottleneck marker** (v1's best-adapted idea) remains: the dashboard always names the single weakest constraint of the current network — so players are never lost, only busy.

---

## 20. Company Eras

| Era | Name | Unlocks (tech / business / ops) | Signature pain |
| --- | --- | --- | --- |
| 0 | Garage ISP | Resale brand, 1 tower or 1 OLT, home POP | Everything; the founder is the staff |
| 1 | Neighborhood ISP | GPON + 5 GHz WISP, own packages, 2–3 technicians, first hired NOC hand | Rogue device on the network, first fiber cut, first monsoon |
| 2 | Local ISP | Second POP, redundancy basics, GPS sync, school/business customers | First SLA contract; night coverage; interference war with rival WISP |
| 3 | Regional ISP | ASN + own IPv4/IPv6, BGP multi-homing, IXP rack, licensed backhaul, rural grant fund | Transit bills, peering politics, compliance audit #1 |
| 4 | Provincial ISP | XGS-PON, second region entry, 24/7 NOC, datacenter POP | Scaling the organization; CGNAT pain peak; regional competitor response |
| 5 | National ISP | Wholesale products, long-haul fiber, content-network peering | Regulation as weather (data-protection act), supply-chain security, brand-level PR events |
| 6 | Telco Enterprise | Subsidiary lines of business (enterprise, cloud connect), acquisition events | "What is the company for?" — legacy network debt, activist investors, succession |

Era gates are milestone-based (subscribers, MRR, uptime track record, compliance standing) — never cash-only (explicitly anti "money-grinding progression").

---

## 21. UI / UX and Interaction Design

### 21.1 Screens

1. **Company Dashboard** — cash/MRR/runway, era progress, bottleneck marker, weekly report.
2. **Geographic Map** — the heart: terrain, clusters, built routes, coverage overlays, demand/competitor layers, construction projects.
3. **Network Topology Editor** — the v1 Board, recontextualized: logical core/aggregation view (POP racks, uplinks, service devices).
4. **FTTH Planner** — OLT port view → tree view (ODF→ODC→splitters→drops) with power budgets and utilization per node.
5. **Wireless Planner** — tower view: sectors, azimuths, channels, CPE lists, LoS survey tool.
6. **NOC Dashboard** — live health, alerts, historical graphs, SLA report.
7. **Device Inspector** — v1's inspector: interfaces, config tabs (GUI panels + CLI), logs, firmware, power/environment.
8. **Customer Management** — prospects, subscribers, satisfaction, churn reasons.
9. **Billing & Finance** — ledger (provenance-complete), invoices, loans, taxes.
10. **Employee Management** — roster, skills, shifts, morale.
11. **Ticket Board** — v1's Kanban with SLA countdowns.
12. **Incident Center** — active incidents, postmortems, incident history by class.
13. **Research Tree.**
14. **Procurement & Equipment Shop** — catalog, vendors, used market, fleet deals, type-approval status.
15. **Mail & Communications** — v1's inbox (folders, filters, phishing, attachments) plus regulator letters and investor updates.
16. **Legal & Compliance Center** — license/permit inventory, deadlines, audit history, the Game-vs-Reality panel.

### 21.2 Interaction principles

Carried over from v1: no modal error popups — consequences surface as logs, alerts, and tickets; keyboard-first; severity = icon + text, never color alone; simplified vs advanced config modes per screen (business players can run an ISP on the simplified mode; engineering players can go to the CLI). New: the map and planners share one selection model (select a cluster → see its serving tree/tower → jump to the device), because cross-layer navigation *is* the game.

---

## 22. Game Modes

- **Career** (primary): the full arc, eras 0–6, permadeath off, rich save/load.
- **Sandbox:** unlimited funds, all tech unlocked, failure injection panel (the teaching and modding surface).
- **Scenario Challenges:** authored small maps with win conditions ("Survive the monsoon season with < 2% downtime," "Beat the incumbent to the university contract"), verified replays, percentile leaderboards (v1's Quorum-inherited social design; server optional).
- **Free Build:** one map, no eras, no competitor pressure — the model-railway mode.
- **Campaign** (post-1.0): authored story across a fictional nation's history; tutorial-adjacent.
- **Co-op company management:** post-launch; the deterministic command-driven core makes it feasible (host-authoritative, same model as v1's plan); explicitly not MVP.

---

## 23. Technical Architecture

### 23.1 Principles (carried over and extended)

- **Deterministic sim core, command-driven** — `packages/sim` as it exists today: `createWorld`, `applyCommand(world, cmd) → events`, `advanceTicks`. Extend with: geographic layer, FTTH/WISP physical models, customer/demand accounting, finance ledger, staff simulation, and the regulator calendar.
- **Graph-based topology** — devices as nodes, links as edges with physical metadata (length, medium, dB, spectrum); paths computed on topology change.
- **Flow-level traffic with on-demand probes** (§6.2) — the core performance decision.
- **Data-driven content** — `packages/data` catalogs: devices, vendors, mail, packages, scenarios, weather regions, regulator rules, research tree. Modding = editing data.
- **Save/load** — event-log + snapshot; replays are free.
- **Client** — TypeScript + canvas, Quorum-derived visual language (already implemented); server optional (challenges/leaderboards/async sharing) and career fully offline.

### 23.2 Simulation honesty and the Reality Check

Every mechanic ships with a field-guide entry: real behavior → game implementation → simplification → why → reference. Full table in §27. The game never pretends to be an emulator; it pretends to be a *good teacher*.

---

## 24. MVP and Development Roadmap

### 24.1 MVP — "The First Mile" (vertical slice)

**Scope:** One small coastal town (Kotapinang, pop ~9,000; ~1,800 households; one ridge, one river, one commercial street). One upstream provider (resale then transit). Core devices: edge router, distribution switch, one OLT (GPON), splitters (1:8/1:16), ONTs, one 30 m tower, 5 GHz sectors, CPEs, UPS. Both access technologies playable end-to-end. ~40 prospect clusters; residential + small-business classes. Three packages; install fees; MRR, OPEX, one loan. Monitoring-lite (device health + utilization + alerts), ticket system, technician dispatch (2 hireable techs). Incident classes: fiber cut, grid outage/UPS, PON congestion, sector congestion, rogue device on ODP, monsoon rain fade, splice degradation. Mail: mentor, one vendor (with CVE notice), invoices, spam, phishing, first regulator letter. Map + topology editor + FTTH planner + NOC-lite + shop + ticket board + mail.

**Explicitly NOT in MVP:** ASN/BGP/IXP/peering, IPv6, CGNAT, enterprise/government customers, competitor AI beyond price/coverage response, research tree (era unlocks are time+milestone gates), datacenter POP, licensed spectrum, co-op, campaign.

**Exit criterion:** a new player, within 45 minutes, builds fiber to one street and wireless to one village, signs 12 customers, experiences a monsoon-degraded backhaul, diagnoses it with the survey tool, and spends their first rebate on a second sector — and immediately starts planning where the next cable goes.

### 24.2 v0.5 — "The Local Carrier"

Research tree (first branches), business-class SLAs + penalties, monitoring depth (thresholds, historical), staff roles expand (NOC, support, sales), postmortems + runbooks, competitor AI v1 (reactive pricing/coverage), grants program, **regulatory ladder v1** (business reg, ISP authorization, permits, type approval).

### 24.3 v1.0 — "The Regional ISP"

ASN/addressing/BGP-policy layer, IXP + peering, IPv6 + CGNAT, enterprise + school + government classes, licensed backhaul + spectrum permits, era ladder complete (0–5+), mail server self-hosting consequences (v1 carryover), audit events, scenario challenges + replays.

### 24.4 Post-launch

Co-op company management, campaign, wholesale/marketplace dynamics, national-scale long-haul map layer, mod tooling polish, PvP red/blue (v1 sketch, still deferred).

---

## 25. Risk Assessment and Open Questions

### 25.1 Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Simulation scope creep (physics seduction) | High | Flow-level rule is law; new physics needs a gameplay-consequence case (R2) |
| UI load: 16 screens is a lot | High | MVP ships 8; screens merge until data demands separation |
| Balance complexity (3-layer economy) | Medium | Tunable data files; automated soak sims as tests; telemetry |
| Teaching load (FTTH+WISP+business) | Medium | Progressive disclosure; era-gated mechanics; field guide; sandbox scenarios |
| Regulator/legal content feels like homework | Medium | Keep every legal event under 2 decisions; comedy in the mail; audit focus on neglect, not trivia |
| Performance at thousands of customers | Medium | Flow model + bucketed telemetry; profile per milestone |

### 25.2 Open questions (unresolved by design)

1. **Map representation:** polygon settlements vs point clusters with polygons as flavor — affects route-planning feel and perf. (Current lean: point clusters, route polylines, coverage as computed polygons.)
2. **Time granularity:** 1 tick = 1 hour vs adaptive (fast-forward outside business hours). Affects staff-shift gameplay depth.
3. **Competitor AI depth:** scripted archetypes with parameterized reactions (cheap, robust) vs market-level equilibrium model (accurate, unreadable). (Lean: archetypes.)
4. **How physical is "enough"?** Does the player ever see a dB number, or only "margin: 1.2 dB OK/LOW/BAD"? (Lean: show the number; the audience that wants it really wants it; simplified mode hides it.)
5. **CLI dialect** (carried from v1): neutral invented syntax vs RouterOS-flavored skin. (Lean: neutral core, vendor skins later.)
6. **Business model:** premium vs free-web + supporter tiers (Quorum model). Affects server investment timing.
7. **Multiplayer timing** (carried from v1): command-driven core makes co-op cheap *later*, but some data-model choices (staff ownership, ticket assignment races) are cheaper to make correctly *now*. Decide by end of MVP.

---

## 26. Reality Check and Technical References

| Real-world behavior | Game implementation | Simplification | Why | Reference |
| --- | --- | --- | --- | --- |
| GPON PON port 2.488/1.244 Gbps, TDM/DBA allocation | Shared capacity per port with activity-weighted demand | No per-TCON DBA math | Flow model scales; DBA adds no player decisions at this granularity | ITU-T G.984 series |
| Optical budget: 28 dB (B+), 32 dB (C+) | Full loss arithmetic per path, 3 dB margin rule | No chromatic dispersion / PMD modeling | Irrelevant below the distances the game simulates | ITU-T G.984.2; vendor optics datasheets |
| Splitters 1:2–1:64 with stated insertion loss | Fixed loss table per ratio | Uniform splitting, no WDM losses | Decision-relevant precision achieved | Standard PLC splitter datasheets |
| Fresnel zone clearance ≥60% for near-free-space path | Midpoint radius formula per path, obstruction sampling | Single-point (midpoint) check, not N-point | Terrain resolution doesn't justify N-point | Standard radio-propagation texts |
| SNR→MCS mapping, adaptive modulation | Tiered table (low/mid/high) with capacity weighting | Continuous rate adaptation abstracted to tiers | Tier boundaries create *decisions*; continuous curves create noise | IEEE 802.11 / 802.16 literature |
| 95th-percentile transit billing | Per-day 5-min samples, 95th over month | Sample rate reduced (hourly in fast-forward) | Player-readable, economically equivalent | Standard transit contracts |
| BGP policy (local-pref, announcements, communities) | Policy-level relationships with computed reachability + failure modes | No routing-table exchange simulation | Full BGP is an emulator feature, not a game; policy preserves the decisions | RFC 4271; "BGP" (Halabi) |
| CGNAT port exhaustion breaking inbound | Per-subscriber port pool; inbound-service failure events | No per-flow NAT table | Event fidelity at flow cost | RFC 6264 |
| Regulatory licensing (Indonesia-inspired) | Fictional Komtel ladder with timed permits/audits | Fictional law, simplified procedure | Legally safe; pedagogically honest | Published Indonesian telecom regs (as inspiration only) |
| Ticket triage and SLA management | Symptom-only tickets, SLA timers, delegation sim | No natural-language parsing | Symptom text is authored content | ISP support practice |
| Rain fade on microwave links | Frequency-dependent attenuation during weather events | ITU-R P.838 curve abstracted to event classes | Weather events are the gameplay; continuous dB rain is not | ITU-R P.838 |

### 26.1 Realism register

- **Realistic (simulated faithfully):** optical budgets, splitter math, LoS/Fresnel, capacity sharing, oversubscription effects, transit economics, SLA penalties, wear/failure curves, permit timelines.
- **Stylized (real decisions, abstracted mechanics):** BGP (policy-level), packet behavior (probes only), regulatory procedure (fictionalized), market dynamics (archetype AIs).
- **Gamelike (openly invented):** Insight currency, staff quirks, event cadence, competitor personalities.

---

## 27. Glossary (new-player vocabulary, in-game field guide)

**ASN** · **Backhaul** · **CAPEX/OPEX** · **CPE** · **dB / dBm** · **Drop fiber** · **Fresnel zone** · **FTTH** · **GPON/EPON/XGS-PON** · **IXP** · **LoS** · **MRR** · **ODF/ODC/ODP** · **OLT/ONT** · **Oversubscription** · **Peering** · **PON** · **POP** · **PtP/PtMP** · **SNR** · **SLA** · **Splitter ratio** · **Transit** · **WISP**

Each term's entry follows rule R6: definition, where it appears in the game, what's simplified, and one "why this matters" example from play.

---

*End of document. NetCorp GDD v2 supersedes v1; v1's office-IT framing is retained only as historical context for reused systems (tickets, mail, staff, runbooks, firmware/CVE feed, deterministic sim core).*
