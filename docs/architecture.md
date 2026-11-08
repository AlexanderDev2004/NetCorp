# Architecture

## Boundary rule

`packages/sim` knows nothing about the browser, the DOM, React, or any UI. It exports three
things: `createWorld`, `applyCommand`, and `advanceTicks`. Everything else — board rendering,
mail UI, tickets — is a projection of state plus events.

## Data flow

```
UI (apps/client)                    Sim (packages/sim)
────────────────                    ──────────────────
click "Set IPv4"      ──Command──►  applyCommand(state, cmd)
                                    │
                                    ├─► State (immutable snapshot)
                                    └─► Event[] (logs, alerts, traffic)
graphs, logs, tickets ◄──Events─────┘
```

- **State is data.** Plain objects, JSON-serializable, no classes with behavior. This keeps
  saves trivial and enables server-side replay verification later.
- **Commands are data.** GUI forms and CLI commands both compile to the same command objects;
  the CLI dialect (§15 open question) is a skin over commands, not a second path.
- **Determinism.** All randomness goes through a seeded PRNG stored in state. Same seed +
  same command list = same world. Co-op and challenge replays ride on this.

## Packages

| Path | Contents |
|---|---|
| `packages/sim` | Engine: graph, protocols (DHCP, DNS, firewall, routing stubs), incidents, economy. |
| `packages/data` | Device catalog, vendor profiles, mail templates, scenario definitions. Imported by sim and client. |
| `apps/client` | Vite + TS. Canvas board, inspector, ticket board, mail, pager. |

## Non-goals for the scaffold

No renderer beyond a stub, no server, no persistence beyond save/load of the state JSON.
