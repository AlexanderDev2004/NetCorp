# NetCorp

**Packet Tracer meets Quorum: configure real networks, keep clients online, survive the 3 AM breach.**

You found a small IT company. You wire routers, switches, and access points onto a board,
configure real protocols (IP, DHCP, DNS, NAT, firewall, VLANs), and live with the consequences:
tickets arrive as symptoms, attackers target your actual exposure, and the mail inbox
is both your best tool and your biggest threat.

## Layout

```
packages/sim      Pure deterministic simulation core. No DOM, no I/O.
                  Takes Commands, returns Events + new State. Runs in browser and Node.
packages/data     Content: device catalog, vendors, mail templates, scenarios.
                  Data, not code — modding-friendly.
apps/client       Web client (Vite + TypeScript). Canvas board, inspector, mail, tickets.
docs/             Game design document and architecture notes.
```

Design rules (see `docs/gdd.md` §12 and `CONTEXT.md`):

- The simulation is deterministic: same state + same commands = same result. This buys us
  replays, challenge leaderboards, and eventual co-op for free.
- GUI forms and CLI commands compile to the same command objects.
- Simulation outcomes are never error dialogs — they surface as logs, alerts, and tickets.

## Getting started

```shell
npm install
npm test        # simulation tests
npm run dev     # client dev server
```

## Board Prototype v0.1

The client boots into the sample topology **PC-A → Switch-A → Router-A → Server-A**
(data: `packages/data/src/scenarios.ts` → `BOARD_PROTOTYPE_TOPOLOGY`). Router-A and
Server-A are pre-configured; PC-A boots unconfigured. The loop:

1. Click **PC-A**, give it an IPv4 (`192.168.10.10/24`, gateway `192.168.10.1`).
2. Ping the server: `10.20.0.100` from the inspector.
3. Break it on purpose — `shut` an interface, mistype a mask, unwire a link.
4. Watch the diagnostics explain exactly where the path broke and why, then fix it.

Simulation rules (pure functions in `packages/sim`): strict IPv4/prefix validation,
interface UP/DOWN gates every link, Wi-Fi only cables to Wi-Fi, cross-subnet traffic
requires a gateway with an L2 path on both sides and a route toward the destination.
