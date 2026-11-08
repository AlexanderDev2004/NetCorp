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
