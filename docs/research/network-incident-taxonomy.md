# Network Incident Taxonomy (PROPOSED)

Status: design proposal for review — no implementation in this phase.
Grounding: GDD v2 §15.2 ("causes, not dice" — every incident requires a precondition chain; randomness selects timing among qualifying causes only), GDD v2 §15.3 (incident flow), GDD v2.2 §V2.2-4.2 (asset lifecycle/condition model), V2.2-4.4 §B/C (threat taxonomy, attack event model), V2.2-4.5 (SLA penalties). Evidence tags: VERIFIED / SECONDARY / PROPOSED / ASSUMPTION / UNKNOWN.

## 0. Design rules (carried from the GDD, non-negotiable)

1. **Precondition chains, not dice** (v2 §15.2): an incident fires only when its precondition chain exists in world state; the seeded roll picks *when* among qualifying candidates.
2. **Flow-level, no packets** (v2 §6.2): incidents modify flow/utilization state or topology; player probes compute results on demand.
3. **Symptom language first** (v2 §15.1): tickets describe symptoms ("no lights on the box"), never root causes. Diagnosis is the player's job.
4. **One resolver** (v2.2 V2.2-4.4 §E): security incidents reuse the same topology/customer-attribution logic as network incidents. No parallel impact systems.
5. **Confidence vocabulary** (v2.2 V2.2-3.3): detection states are `observed` / `suspected` / `confirmed`.

Incident record (extends v2.2 §E fields): `id`, `class`, `cause` (taxonomy id), `preconditions` (ids that qualified), `target` (asset ids), `startedTick`, `detectedTick?`, `detectionSource`, `detectionConfidence`, `affectedCustomers` (topology-derived), `slaClock?`, `resolvedTick?`, `resolution`, `postmortem?`.

## 1. Physical layer

| Cause | Preconditions | Symptoms (ticket/probe) | Diagnosis | Repair | Impact profile |
|---|---|---|---|---|---|
| Fiber cut — dig damage | Route crosses activity corridor; no depth protection event | Whole tree down: "no lights on the box" ×N; probe: L1 break | OTDR localizes to ±m (GDD §11 test gear); without it, tech drive-and-look | Splice crew + fusion splicer; spare closure; hours | Many customers, high rep/SLA; the canonical multi-customer outage |
| Fiber cut — tree fall / storm | Weather event crosses aerial route | Same as above; clustered in one weather region | OTDR; weather correlation | Same | Same; forecastable (weather system) |
| Splice degradation | Poor workmanship (install quality seed) or age event on closure | One customer slow: "video calls buffer"; probe: elevated loss | Power-meter margin check; OTDR splice view | Re-splice | Quiet until found; condition-based maintenance trigger (v2.2 §14.6) |
| Connector contamination | No dust rating at POP patch panel; maintenance touched it | Intermittent drops on one link | Clean-and-retest; power meter | Clean/replace connector | Cheap fix, easy miss |
| Water ingress in closure | Underground closure; no water sensor (ITU-T L.315 alarm is the sensor) | Gradual loss growth on a segment; then failure | Water alarm if monitored; else OTDR after symptoms | Open, dry, reseal; replace splices | Silent degrader — monitoring pays here |
| Power outage at site | Site backup missing/inadequate (v2 §15.2 Power class) | Whole POP/tree dark; "everything down since the storm" | Site alarm via monitoring; else customer flood | Grid restore; genset/battery fleet | SLA clock starts at outage, not detection |
| Port / NIC failure | Hardware wear (v2.2 hazard curve) or overload | Single link down; one customer or one upstream | Interface counters (CRC/errors); swap test | Replace SFP/NIC/port; spares stock cuts MTTR | Localized; spares inventory test |
| Wireless rain fade | Monsoon/heavy rain on licensed/60 GHz link | Backhaul latency/loss spikes; congestion downstream | Spectrum/ signal history | Adaptive modulation (auto), capacity headroom, band change | Weather-correlated, self-limiting |

## 2. Data link layer

| Cause | Preconditions | Symptoms | Diagnosis | Repair | Impact profile |
|---|---|---|---|---|---|
| VLAN misconfiguration | Player/staff config error during expansion (v2 §15.2 Configuration class) | Segment isolated: "new offices have no internet"; probe: L2 path break at switch | Inspector: interface VLAN vs trunk config | Fix assignment | Self-inflicted; teaches config care |
| Trunk mismatch | Mismatched trunking on both ends of a link | Partial connectivity, some VLANs dead | Compare both ends | Align trunk config | Rare, mid-tier confusion |
| Switching loop | Redundant links without STP awareness (PROPOSED: managed switches run STP; unmanaged don't) | Broadcast storm: whole segment crawls then dies; CPU high | Spanning-tree state in inspector; tracer looks like congestion | Remove redundant link or enable STP | Spectacular, self-inflicted; educational |
| Duplex mismatch | Auto-neg failure between odd devices | Slow throughput, CRC errors; "internet is slow but works" | Interface error counters | Force matching duplex | Legacy-flavored; keep only where it teaches counters |

## 3. Network layer

| Cause | Preconditions | Symptoms | Diagnosis | Repair | Impact profile |
|---|---|---|---|---|---|
| Subnet / gateway misconfig | Player sets wrong prefix/gateway (already reachable today via `setIpv4`) | Device online but no internet; probe: no gateway | `ping` probe + inspector | Correct config | Already partially implemented — extend |
| DHCP pool exhaustion | Customer growth beyond pool; rogue-DHCP sibling (implemented) | New customers can't join; lease table full | Lease table; pool address count (implemented) | Widen pool / add server | Data exists — wrap as incident |
| Missing/incorrect route | Route table gap after topology change | Region unreachable; probe: L3 break at router | Route table inspector | Add/fix route | Implemented plumbing; incident wrapper new |
| Routing loop (player routing policy) | Two routers with overlapping static routes | Traffic black-holes or ping-pongs; latency explodes | Traceroute shows cycle | Fix routes | Rare; advanced content |
| Upstream session failure (BGP) | Single/multi-homed upstream; provider-side event or player filter error (v2.2 V2.2-4.3) | Whole-default-free-zone unreachable; transit down | Upstream status, route table, provider ticket | Failover to second upstream / fix filters | The multi-homing payoff moment |
| NAT/CGNAT exhaustion | CGNAT pool undersized for growth | "Some sites work, some don't"; new sessions fail | Port utilization graphs | Add NAT pool/IPv6 program (research `addr-ipv6`) | Growth-scaling lesson |
| MTU mismatch | Tunnel/PPPoE-style overlay added (PROPOSED, late-era) | Large transfers stall, small pings pass | Path-MTU probe | Clamp/fix MTU | Niche; only with overlay features |

## 4. Transport & application

| Cause | Preconditions | Symptoms | Diagnosis | Repair | Impact profile |
|---|---|---|---|---|---|
| DNS resolver failure | Resolver server down/overloaded (v2.2 V2.2-4.4 §B3: distinguish DNS failure from connectivity failure) | "Internet is down" but pings pass | Resolve probe (implemented plumbing) vs ping probe | Restart/replace resolver; add secondary | The classic teaching moment: connectivity ≠ resolution |
| DNS cache poisoning | Unpatched resolver firmware (implemented incident; v1 CVE event) | Customers report wrong sites; security angle | Resolver cache inspection | Patch firmware (updateFirmware), flush | Implemented — keep, rebrand advisory ID |
| DHCP service failure | DHCP server device failed/removed | New devices get no lease | `dhcpDiscover` probe | Repair/replace; add relay | Implemented plumbing |
| Service overload | Portal/billing/AAA demand > capacity (v2.2 §B3 service exhaustion) | Portal slow/unavailable; network fine | Service load metrics | Scale server, cache, rate-limit | Business-system growth lesson |
| Mail/auth outage | Internal server failure | Staff tools down (in-game mail/UI could degrade!) | Service status | Repair; backup restore (ransomware link) | Meta-moment: the game's own tools degrade |

## 5. ISP-specific (the core of NetCorp — v2.2 V2.2-4.2/V2.2-4.3 grounded)

| Cause | Preconditions | Symptoms | Diagnosis | Repair | Impact profile |
|---|---|---|---|---|---|
| OLT card failure | Hazard curve + thermal stress; chassis OLT card | Whole PON tree(s) down | OLT alarm (monitoring); per-card status | Replace card; spares | Big blast radius; card-level sparing decision |
| ONT fleet failure (aggregate) | Fleet-age histogram + vendor defect event (v2.2: ONTs tracked as fleet, not per-unit) | Scattered "no lights" across one old batch | Batch correlation from tickets | Batch replacement program (discounted) | Tests the fleet-histogram model |
| Splitter/distribution failure | Event-driven passive degradation (v2.2: no aging clock on passives) | Tree down or partial loss | OTDR past the splitter; customer distribution analysis | Replace splitter | Passive physics: events, not clocks |
| Last-mile fiber damage | Corridor activity (digger) on a distribution route | Subset of customers down | OTDR + corridor map | Civil works + splice; days not hours | Long-tail outage; permits/time |
| Tower equipment failure | Hazard + wind event misalignment (v2.2 outdoor wireless) | Sector down or degraded | Sector health, signal history | Realign/replace; climb crew (time, cost) | WISP-specific; weather-linked |
| Radio interference | Competitor channel overlap (v2.2 §15.2 Wireless) | Sector throughput collapses in evenings | Spectrum analyzer | Re-channel / coordinate / licensed upgrade | Rival-linked; spectrum analyzer earns its price |
| Backhaul congestion | Capacity < sustained demand (v2.2 Capacity class) | Everything slow at peak | Utilization graphs (flow model native) | Upgrade backhaul (lead time!) | Not an accident — a planning failure |
| Upstream provider outage | Transit profile reliability history (v2.2 V2.2-4.3 provider events) | Full internet outage or degraded reach | Provider status page, probes | Failover / wait; SLA credits owed TO you | Tests multi-homing investment |
| IXP peering failure | Route-server/peer dispute events (v2.2 peering disputes) | Local reachability oddities; transit spike | Route analysis | Fix policy; renegotiate | Advanced; pairs with MANRS loop |
| BGP route leak (self or peer) | Sloppy filtering (v2.2 V2.2-4.3 MANRS filtering) | Traffic black-holed; peers depeer you; reputation hit | Route monitoring, peer reports | Fix filters; global validation (RPKI research) | Reputation event beyond your network |
| BGP prefix hijack (victim) | No RPKI/ROV; announcement accepted (v2.2 V2.2-4.4 §B2) | Traffic diverted; spam/phish from your space | Route-origin monitoring | ROA + upstream filtering; incident comms | Security + reputation; MANRS payoff |

## 6. Security incidents

Spec'd in `cybersecurity-simulation-proposal.md` (companion doc) per GDD v2.2 V2.2-4.4 — taxonomy: DDoS classes, routing attacks, DNS attacks, internal compromise; exploitation relationship is `exploits_vulnerability` / `abuses_exposure_or_configuration` / `capacity_or_protocol_attack`. **They enter this taxonomy's flow at "incident" and share the resolver, SLA, and postmortem machinery.**

## 7. Difficulty progression (PROPOSED)

- **Era 1 (MVP "First Mile"):** physical + config classes on a small tree. One root cause, one probe type. Fiber cut, DHCP exhaustion, resolver failure.
- **Era 2:** capacity + power classes; multi-customer attribution; maintenance windows enter.
- **Era 3:** upstream/routing classes; multi-homing decisions; wireless interference with rival coupling.
- **Era 4+:** chained causes (dig damage exposes a splice that was already degraded), security incidents join the queue, RPKI/route-security content.

Progression = longer precondition chains + more ambiguous symptoms + economic pressure, never bigger random dice.

## Open questions

1. Do link-level states (DOWN per link vs per interface) enter at MVP, or is interface state enough? (Board currently has interface-level only — audit `netcorp-audit.md` gap 4.)
2. Duplex mismatch and crossover-cable legacy friction: teach, or skip as auto-MDIX-modern? (PROPOSED: skip; modern ports auto-negotiate.)
3. Chained-cause incidents (Era 4+): worth the engine complexity, or are separate incidents with correlated timing enough?
