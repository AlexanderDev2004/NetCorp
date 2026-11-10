/**
 * The interactive Board editor — Modern Dark NOC layout:
 * top app bar (stats + clock + inbox), left sidebar (tools + device catalog),
 * maximized canvas workspace, right inspector (persistent, empty state when
 * nothing is selected), and a bottom operations console (Events /
 * Diagnostics / Network Activity).
 *
 * Every state change goes through sim Commands; the UI only renders state and
 * forwards input. Modes: select (click/drag, inspect), place (click to buy +
 * place the catalog selection), wire (click two devices to link their first
 * free interfaces).
 */
import { advanceTicks, applyCommand, createWorld, deliverMail, CONTRACT_OFFERS, RACK_TIERS, REPAIR_COST, TRADE_IN_CREDIT, phishAlertLevel, phishPayRepLoss, rackSlots, rewardMultiplier, TWIN_REPLACEMENT_PHISH, PRESTIGE_DAY_TICKS, careerPrestige, SEASON_GOALS, devicePrice, repairCost, maybeRivalPoach, type Contract, type Device, type Mail, type World, type DeviceKind } from '@netcorp/sim';
import { BOARD_PROTOTYPE, BOARD_PROTOTYPE_TOPOLOGY, DEVICE_CATALOG, FIRMWARE_UPDATES, STARTER_MAIL, catalogAsRecord, type ScenarioTopology } from '@netcorp/data';

const world = createWorld(BOARD_PROTOTYPE.seed, catalogAsRecord());
world.cash = BOARD_PROTOTYPE.startingCash;
// The vendor firmware channels feed the sim's ambient outdated-firmware roll.
for (const [defId, update] of Object.entries(FIRMWARE_UPDATES)) {
  world.firmwareChannels[defId] = update.version;
}

const canvas = document.querySelector<HTMLCanvasElement>('#board');
const ctx = canvas === null ? null : canvas.getContext('2d');
const hintEl = document.querySelector<HTMLDivElement>('#hint');
const toastEl = document.querySelector<HTMLDivElement>('#toast');
const inspectorPanel = document.querySelector<HTMLDivElement>('#inspector-panel');
const inspectorEl = document.querySelector<HTMLDivElement>('#inspector');
const mailPanel = document.querySelector<HTMLDivElement>('#mail-panel');
const mailView = document.querySelector<HTMLDivElement>('#mail-view');
const inboxBtn = document.querySelector<HTMLButtonElement>('#inbox-btn');

if (canvas === null || ctx === null) throw new Error('board canvas missing');

type Mode = 'select' | 'place' | 'wire';
let mode: Mode = 'select';
let selectedDefId: string | null = DEVICE_CATALOG[0]?.id ?? null;
let selectedId: string | null = null;
let wireFromId: string | null = null;
let mailPanelOpen = false;
let mailTab: 'mail' | 'tickets' | 'contracts' = 'mail';
let mailFolder: 'inbox' | 'discarded' = 'inbox';
let openMailId: string | null = null;
let shopOpen = false;
let clockRunning = false;
/** The closing the player has already dismissed: the scorecard shows again for each new season. */
let endgameDismissedTick: number | null = null;
/** Season number being replayed from the shop's records, when one is open. */
let scorecardSeason: number | null = null;
let consoleTab: 'events' | 'diag' | 'activity' = 'events';
let catalogQuery = '';
let mouse = { x: 0, y: 0 };
let drag: { deviceId: string; dx: number; dy: number; moved: boolean } | null = null;

/* Design tokens — Modern Dark NOC (mirrors the CSS :root variables). */
const C = {
  bg: '#0b0d10',
  grid: 'rgba(231, 234, 240, 0.04)',
  cableEdge: '#3a424d',
  cable: '#20262e',
  panel: '#1b2027',
  ink: '#e7eaf0',
  muted: '#929aa7',
  signal: '#35bdeb',
  danger: '#ef6262',
  warn: '#f2b84b',
  ok: '#36c98f',
};

/** Small accent per device kind, shown as a dot on the node card. */
const KIND_ACCENTS: Record<string, string> = {
  'router-soho': C.ok,
  'router-edge': C.ok,
  firewall: C.danger,
  'switch-unmanaged': C.signal,
  'switch-managed': C.signal,
  'access-point': '#b085f5',
  desktop: C.warn,
  server: C.warn,
  printer: C.muted,
  ups: C.muted,
};

const MODE_HINTS: Record<Mode, string> = {
  select: 'click a node to inspect · drag to move · esc clears',
  place: 'click the board to place the catalog selection',
  wire: 'click node A, then node B — first free ports are linked',
};

/* ---- Device catalog groups (sidebar) ---- */

const CATALOG_GROUPS: Array<{ label: string; kinds: DeviceKind[] }> = [
  { label: 'Networking', kinds: ['router-soho', 'router-edge', 'switch-unmanaged', 'switch-managed', 'access-point'] },
  { label: 'Security', kinds: ['firewall'] },
  { label: 'Servers', kinds: ['server'] },
  { label: 'Endpoints', kinds: ['desktop', 'printer'] },
  { label: 'Infrastructure', kinds: ['ups'] },
];

function renderCatalog(): void {
  const catalogEl = document.querySelector<HTMLDivElement>('#catalog');
  if (catalogEl === null) return;
  const query = catalogQuery.trim().toLowerCase();
  const parts: string[] = [];
  for (const group of CATALOG_GROUPS) {
    const defs = DEVICE_CATALOG.filter(
      (def) =>
        group.kinds.includes(def.kind) &&
        (query === '' || def.name.toLowerCase().includes(query) || def.kind.toLowerCase().includes(query)),
    );
    if (defs.length === 0) continue;
    const items = defs
      .map(
        (def) => `
        <button class="catalog-item${mode === 'place' && selectedDefId === def.id ? ' active' : ''}" data-def="${esc(def.id)}" title="${esc(def.kind)} · firmware ${esc(def.firmware)}">
          <span class="icon">${KIND_ICON[def.kind] ?? '▪'}</span>
          <span class="info">
            <span class="name">${esc(def.name)}</span>
            <span class="desc">${esc(def.kind)} · ${def.interfaces.length} port${def.interfaces.length === 1 ? '' : 's'}</span>
          </span>
          <span class="price">$${def.price}</span>
        </button>`,
      )
      .join('');
    parts.push(`<div class="section-title">${esc(group.label)}</div>${items}`);
  }
  catalogEl.innerHTML =
    parts.join('') || '<div class="empty">No devices match this search.</div>';

  for (const button of catalogEl.querySelectorAll<HTMLButtonElement>('button.catalog-item')) {
    button.addEventListener('click', () => {
      selectedDefId = button.dataset.def ?? null;
      setMode('place');
    });
  }
}

const KIND_ICON: Record<string, string> = {
  'router-soho': '⇄',
  'router-edge': '⇄',
  'switch-unmanaged': '⊞',
  'switch-managed': '⊞',
  'access-point': '⌇',
  firewall: '🛡',
  server: '▤',
  desktop: '▢',
  printer: '⎙',
  ups: '▮',
};

/* ---- Command helpers ---- */

function run(command: Parameters<typeof applyCommand>[1]): void {
  const events = applyCommand(world, command);
  const last = events.at(-1);
  if (last !== undefined && (last.level === 'warn' || last.level === 'alert')) {
    showToast(last.text);
  }
  render();
}

let toastTimer: number | undefined;
function showToast(text: string): void {
  if (toastEl === null) return;
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 3200);
}

/* ---- Board rendering ---- */

function deviceBoxWidth(device: Device): number {
  if (ctx === null) return 120;
  ctx.font = "500 12.5px 'Geist Mono', ui-monospace, monospace";
  return Math.max(120, ctx.measureText(device.name).width + 34);
}

function deviceAt(x: number, y: number): Device | undefined {
  return Object.values(world.devices).find((device) => {
    const half = deviceBoxWidth(device) / 2;
    return x >= device.x - half && x <= device.x + half && y >= device.y - 26 && y <= device.y + 26;
  });
}

function drawBoard(): void {
  if (canvas === null || ctx === null) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, width, height);

  // Fine grid.
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx < width; gx += 32) {
    ctx.moveTo(gx + 0.5, 0);
    ctx.lineTo(gx + 0.5, height);
  }
  for (let gy = 0; gy < height; gy += 32) {
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(width, gy + 0.5);
  }
  ctx.stroke();

  // Cables: dark core with a lighter edge. A cable whose endpoint interface
  // is DOWN draws red — the player sees the break, and the inspector explains it.
  for (const link of world.links) {
    const a = world.devices[link.a.deviceId];
    const b = world.devices[link.b.deviceId];
    if (a === undefined || b === undefined) continue;
    const aIface = a.interfaces.find((i) => i.name === link.a.interfaceName);
    const bIface = b.interfaces.find((i) => i.name === link.b.interfaceName);
    const down = (aIface !== undefined && !aIface.enabled) || (bIface !== undefined && !bIface.enabled);
    const edge = down ? C.danger : C.cableEdge;
    const core = down ? '#7f2226' : C.cable;
    ctx.lineCap = 'round';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = core;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Pending wire preview in signal color.
  if (mode === 'wire' && wireFromId !== null) {
    const from = world.devices[wireFromId];
    if (from !== undefined) {
      ctx.save();
      ctx.strokeStyle = C.signal;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Node cards: dark panels with a ring, kind dot, name, and address.
  for (const device of Object.values(world.devices)) {
    const accent = KIND_ACCENTS[device.kind] ?? C.muted;
    const boxWidth = deviceBoxWidth(device);
    const selected = device.id === selectedId;
    const wireSource = device.id === wireFromId;
    const compromised = device.compromised === true;
    const failed = device.failed === true;

    ctx.font = "500 12.5px 'Geist Mono', ui-monospace, monospace";
    ctx.fillStyle = C.panel;
    // A failed node wears a red ring like a compromised one — the dead box
    // should jump out on the board before any ticket is read.
    ctx.strokeStyle = failed || compromised ? C.danger : selected || wireSource ? C.signal : '#2a3038';
    ctx.lineWidth = selected || wireSource || failed || compromised ? 1.6 : 1;
    ctx.beginPath();
    ctx.roundRect(device.x - boxWidth / 2, device.y - 26, boxWidth, 52, 10);
    ctx.fill();
    ctx.stroke();

    // Compromise / failure marker.
    if (failed || compromised) {
      ctx.fillStyle = C.danger;
      ctx.font = "600 12px 'Geist Mono', ui-monospace, monospace";
      ctx.fillText(failed ? '×' : '⚠', device.x + boxWidth / 2 - 14, device.y - 8);
    }

    // Kind dot.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(device.x - boxWidth / 2 + 13, device.y - 12, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.fillText(device.name, device.x - boxWidth / 2 + 24, device.y - 8);

    const mgmt = device.interfaces.find((iface) => iface.ipv4 !== undefined)?.ipv4;
    ctx.fillStyle = C.muted;
    ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace";
    ctx.fillText(
      mgmt === undefined ? device.kind : `${mgmt.address}/${mgmt.prefix}`,
      device.x - boxWidth / 2 + 12,
      device.y + 14,
    );
    ctx.textAlign = 'center';
  }
}

/* ---- Top bar ---- */

function renderHud(): void {
  const cash = document.querySelector<HTMLSpanElement>('#hud-cash');
  const rep = document.querySelector<HTMLSpanElement>('#hud-rep');
  const insight = document.querySelector<HTMLSpanElement>('#hud-insight');
  const devices = document.querySelector<HTMLSpanElement>('#hud-devices');
  const calendar = document.querySelector<HTMLSpanElement>('#hud-calendar');
  if (cash !== null) {
    cash.textContent = `$${world.cash}`;
    cash.classList.toggle('bad', world.cash < 0);
  }
  if (rep !== null) {
    rep.textContent = String(world.reputation);
    rep.classList.toggle('bad', world.reputation < 0);
    // Standing has real rates: premium partners, penalized contractors (GDD §5).
    const repStat = rep.closest<HTMLElement>('.stat');
    if (repStat !== null) {
      repStat.title =
        world.reputation >= 5
          ? 'Premium partner: new tickets pay +25%'
          : world.reputation <= -5
            ? 'Penalized contractor: new tickets pay 70%'
            : world.reputation <= -3
              ? 'Distrusted: fewer new tickets arrive'
              : 'Neutral standing';
    }
  }
  if (insight !== null) insight.textContent = String(world.insight);
  if (devices !== null) {
    const used = Object.keys(world.devices).length;
    const slots = rackSlots(world);
    devices.textContent = `${used}/${slots}`;
    devices.classList.toggle('bad', used >= slots);
    devices.title = used >= slots ? 'Rack full — upgrade the server room in the shop' : `Server room holds ${slots} devices`;
  }
  if (calendar !== null) {
    // Season-relative day: each season runs its own 30-day clock.
    const seasonStart = PRESTIGE_DAY_TICKS * (world.season - 1);
    const seasonDay = Math.floor((world.tick - seasonStart) / 24) + 1;
    const hour = world.tick % 24;
    calendar.textContent = `S${world.season} D${seasonDay} ${String(hour).padStart(2, '0')}:00`;
    const daysLeft = 30 - seasonDay;
    calendar.title =
      daysLeft > 0
        ? `Season ${world.season} closes at day 30 — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
        : `Season ${world.season} in progress — the season ${world.season - 1} scorecard is in your inbox`;
  }
  const goalChip = document.querySelector<HTMLDivElement>('#season-goal');
  if (goalChip !== null) {
    const goal = SEASON_GOALS[world.goal];
    const themed = world.goal !== 'none';
    goalChip.classList.toggle('hidden', !themed);
    goalChip.textContent = `★ ${goal.name}`;
    goalChip.title = `${goal.description} (Season ${world.season} theme)`;
  }
  const simState = document.querySelector<HTMLDivElement>('#sim-state');
  const simLabel = document.querySelector<HTMLSpanElement>('#sim-label');
  if (simState !== null) simState.classList.toggle('paused', !clockRunning);
  if (simLabel !== null) simLabel.textContent = clockRunning ? 'RUNNING' : 'PAUSED';
  const clockButton = document.querySelector<HTMLButtonElement>('#clock');
  if (clockButton !== null) clockButton.textContent = clockRunning ? 'Pause' : 'Run';
  const hardButton = document.querySelector<HTMLButtonElement>('#hard-btn');
  if (hardButton !== null) {
    const hard = world.difficulty === 'hard';
    hardButton.classList.toggle('active', hard);
    hardButton.textContent = hard ? 'Hard ✓' : 'Hard';
  }
}

/* ---- Inspector ---- */

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/* Collapsible inspector sections: remember the player's open/closed choices
   across re-renders (the panel HTML is regenerated on every render). */
const sectionOpen: Record<string, boolean> = {
  overview: true,
  interfaces: true,
  firmware: true,
  ping: true,
  dhcp: false,
  firewall: false,
};

let lastAutoOpenId: string | null | undefined;

function details(id: string, label: string, body: string): string {
  const open = sectionOpen[id] ?? true;
  return `<details data-section="${id}"${open ? ' open' : ''}><summary>${label}</summary><div class="section-body">${body}</div></details>`;
}

function renderInspector(): void {
  if (inspectorPanel === null || inspectorEl === null) return;
  const device = selectedId === null ? undefined : world.devices[selectedId];

  // When the selection changes to a device, open the inspector even on small
  // screens (where it starts collapsed). A manual collapse while the same
  // device stays selected is respected.
  if (selectedId !== lastAutoOpenId) {
    lastAutoOpenId = selectedId;
    if (device !== undefined) {
      inspectorToggleOverride = false;
      document.body.classList.remove('inspector-collapsed');
    }
  }

  if (device === undefined) {
    inspectorEl.innerHTML = `
      <div class="empty-state">
        <div class="glyph">◇</div>
        Nothing selected.<br />
        Click a node on the board to inspect its interfaces,
        IPv4 settings, DHCP pools, firewall rules, and diagnostics.
      </div>`;
    return;
  }

  const interfaces = device.interfaces
    .map((iface) => {
      const wired = world.links.some(
        (link) =>
          (link.a.deviceId === device.id && link.a.interfaceName === iface.name) ||
          (link.b.deviceId === device.id && link.b.interfaceName === iface.name),
      );
      const ipv4 = iface.ipv4;
      const source =
        iface.ipv4Source === 'dhcp'
          ? `via DHCP from ${esc(world.devices[iface.leaseServerDeviceId ?? '']?.name ?? '?')}`
          : iface.ipv4Source === 'static'
            ? 'static'
            : '';
      const status = iface.enabled
        ? '<span class="status up">UP</span>'
        : '<span class="status down">DOWN</span>';
      const toggle = `<button class="iface-toggle" data-iface="${esc(iface.name)}" data-enabled="${iface.enabled ? '1' : '0'}">${iface.enabled ? 'shut' : 'no shut'}</button>`;
      return `
        <div class="iface">
          <div class="name"><span class="ifname">${esc(iface.name)}</span> · ${esc(iface.kind)}${wired ? ' · wired' : ' · free'} ${toggle} ${status}</div>
          <div class="row">
            <label>IPv4</label>
            <input class="wide ip-address" data-iface="${esc(iface.name)}" placeholder="e.g. 10.0.0.10"
              value="${ipv4 === undefined ? '' : esc(ipv4.address)}" />
            <label>/</label>
            <input class="ip-prefix" data-iface="${esc(iface.name)}" style="width:52px" placeholder="24"
              value="${ipv4 === undefined ? '' : String(ipv4.prefix)}" />
            <button class="ip-clear" data-iface="${esc(iface.name)}">clear</button>
          </div>
          <div class="row">
            <label>gw</label>
            <input class="wide ip-gateway" data-iface="${esc(iface.name)}" placeholder="gateway"
              value="${iface.ipv4Gateway === undefined ? '' : esc(iface.ipv4Gateway)}" />
            ${iface.kind !== 'wan' ? `<button class="dhcp-request" data-iface="${esc(iface.name)}">request DHCP</button>` : ''}
          </div>
          ${source !== '' ? `<div class="row muted source-note">${source}</div>` : ''}
        </div>`;
    })
    .join('');

  const pools = device.config.dhcpPools
    .map(
      (pool) => `
        <div class="rule">
          <span class="action-allow">${esc(pool.interfaceName)}</span>
          <span class="muted">${esc(pool.network)}/${pool.prefix} · ${esc(pool.rangeStart)} – ${esc(pool.rangeEnd)}</span>
          <button class="pool-remove" data-iface="${esc(pool.interfaceName)}">✕</button>
        </div>`,
    )
    .join('');
  const poolForm = `
    <div class="row">
      <select class="pool-iface">
        ${device.interfaces.filter((i) => i.kind !== 'wan').map((i) => `<option value="${esc(i.name)}">${esc(i.name)}</option>`).join('')}
      </select>
      <input class="pool-network wide" placeholder="network e.g. 10.0.0.0" />
      <input class="pool-prefix" style="width:52px" placeholder="24" />
    </div>
    <div class="row">
      <input class="pool-start" placeholder="range start" />
      <input class="pool-end" placeholder="range end" />
      <button class="pool-add">add pool</button>
    </div>`;

  const rules = device.config.firewallRules
    .map((rule) => {
      const desc = [rule.srcCidr ?? '*', '→', rule.dstCidr ?? '*', rule.dstPort !== undefined ? `:${rule.dstPort}` : '', rule.protocol ?? '']
        .join(' ')
        .trim();
      return `
        <div class="rule">
          <span class="action-${rule.action}">${rule.action}</span>
          <span class="muted">${esc(desc)}</span>
          <button class="rule-remove" data-rule="${esc(rule.id)}">✕</button>
        </div>`;
    })
    .join('');

  const channel = FIRMWARE_UPDATES[device.defId];
  const outdated = channel !== undefined && channel.version !== device.firmware;
  const compromiseNote = device.compromised === true
    ? '<div class="fw-compromised">⚠ COMPROMISED — exploited through this device\'s outdated firmware. Install the update to clean it.</div>'
    : '';
  const firmwareBody = `${compromiseNote}${channel === undefined
    ? '<div class="muted">No vendor update channel for this model.</div>'
    : outdated
      ? `<div class="row fw-update">
           <span class="muted">${esc(channel.version)} available — ${esc(channel.notes)}</span>
           <button class="fw-update-run">install update</button>
         </div>`
      : `<div class="muted">Up to date (${esc(device.firmware)}).</div>`}`;

  // Wear: dead hardware gets a paid repair; old hardware gets a heads-up.
  const daysInService = Math.floor(device.uptimeTicks / 24);
  const wearNote = device.failed === true
    ? (() => {
        const def = DEVICE_CATALOG.find((d) => d.id === device.defId);
        const replaceCost = def === undefined ? null : Math.max(0, devicePrice(world, def) - TRADE_IN_CREDIT);
        const repairBill = repairCost(world);
        return `<div class="fw-compromised">✖ FAILED — the hardware gave out and every link through it is dead.
         <button class="repair-run" title="Pays $${repairBill}, brings the box back with a fresh wear clock">repair ($${repairBill})</button>${
           replaceCost === null ? '' : ` <button class="replace-run" title="Swaps in brand-new hardware of the same model — wiring, addresses, and config carry over; the dead unit trades in for $${TRADE_IN_CREDIT}">replace ($${replaceCost})</button>`
         }</div>`;
      })()
    : daysInService >= 7
      ? `<div class="muted" style="margin-bottom:8px">worn — ${daysInService} days in service, failure risk rising</div>`
      : '';

  inspectorEl.innerHTML = `
    <div class="device-head">
      <div class="dname">${esc(device.name)}</div>
      <div class="dmodel">${esc(device.kind)} · firmware ${esc(device.firmware)}</div>
    </div>
    ${wearNote}
    ${details('interfaces', 'Interfaces', interfaces)}
    ${details('firmware', 'Firmware', firmwareBody)}
    ${details('ping', 'Diagnostics · Ping', `
      <div class="row">
        <label>ping</label>
        <input class="wide ping-target" placeholder="target address" />
        <button class="ping-run">run</button>
      </div>`)}
    ${details('dhcp', 'DHCP server', `
      ${pools || '<div class="muted">No pools — this device serves no addresses.</div>'}
      ${poolForm}`)}
    ${details('firewall', 'Firewall', `
      ${rules || '<div class="muted">No rules — all traffic passes.</div>'}
      <div class="row">
        <select class="fw-action">
          <option value="deny">deny</option>
          <option value="allow">allow</option>
        </select>
        <input class="fw-src" placeholder="src CIDR" />
        <input class="fw-dst" placeholder="dst CIDR" />
        <input class="fw-port" style="width:64px" placeholder="port" />
        <button class="fw-add">add rule</button>
      </div>`)}
    <div class="row" style="margin-top:14px">
      <button class="danger device-delete">delete device</button>
    </div>
  `;

  for (const element of inspectorEl.querySelectorAll<HTMLDetailsElement>('details[data-section]')) {
    element.addEventListener('toggle', () => {
      sectionOpen[element.dataset.section ?? ''] = element.open;
    });
  }
  bindInspector(device);
}

function bindInspector(device: Device): void {
  if (inspectorEl === null) return;

  const repairButton = inspectorEl.querySelector<HTMLButtonElement>('button.repair-run');
  if (repairButton !== null) {
    repairButton.addEventListener('click', () => {
      run({ type: 'repairDevice', deviceId: device.id });
    });
  }

  const replaceButton = inspectorEl.querySelector<HTMLButtonElement>('button.replace-run');
  if (replaceButton !== null) {
    replaceButton.addEventListener('click', () => {
      // The swap mints a new device id; keep the fresh unit selected so the
      // player sees the healthy box, not "Nothing selected".
      const name = device.name;
      run({ type: 'replaceDevice', deviceId: device.id });
      const fresh = Object.values(world.devices).find((d) => d.name === name);
      if (fresh !== undefined) selectedId = fresh.id;
      render();
    });
  }

  for (const input of inspectorEl.querySelectorAll<HTMLInputElement>('input.ip-address')) {
    input.addEventListener('change', () => {
      const prefixInput = inspectorEl.querySelector<HTMLInputElement>(
        `input.ip-prefix[data-iface="${input.dataset.iface}"]`,
      );
      const prefix = Number(prefixInput?.value ?? 24);
      const address = input.value.trim();
      if (address === '') return;
      run({ type: 'setIpv4', deviceId: device.id, interfaceName: input.dataset.iface ?? '', address, prefix });
    });
  }
  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.ip-clear')) {
    button.addEventListener('click', () => {
      run({ type: 'setIpv4', deviceId: device.id, interfaceName: button.dataset.iface ?? '' });
    });
  }
  for (const input of inspectorEl.querySelectorAll<HTMLInputElement>('input.ip-gateway')) {
    input.addEventListener('change', () => {
      const addressInput = inspectorEl.querySelector<HTMLInputElement>(
        `input.ip-address[data-iface="${input.dataset.iface}"]`,
      );
      const address = addressInput?.value.trim();
      if (address === undefined || address === '') return;
      run({ type: 'setIpv4', deviceId: device.id, interfaceName: input.dataset.iface ?? '', address, gateway: input.value.trim() });
    });
  }
  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.dhcp-request')) {
    button.addEventListener('click', () => {
      const ifaceName = button.dataset.iface;
      run(
        ifaceName === undefined || ifaceName === ''
          ? { type: 'dhcpDiscover', deviceId: device.id }
          : { type: 'dhcpDiscover', deviceId: device.id, interfaceName: ifaceName },
      );
    });
  }
  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.iface-toggle')) {
    button.addEventListener('click', () => {
      run({
        type: 'setInterfaceEnabled',
        deviceId: device.id,
        interfaceName: button.dataset.iface ?? '',
        enabled: button.dataset.enabled !== '1',
      });
    });
  }

  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.fw-update-run')) {
    button.addEventListener('click', () => {
      const channel = FIRMWARE_UPDATES[device.defId];
      if (channel !== undefined) run({ type: 'updateFirmware', deviceId: device.id, version: channel.version });
    });
  }

  inspectorEl.querySelector('button.pool-add')?.addEventListener('click', () => {
    const ifaceName = inspectorEl.querySelector<HTMLSelectElement>('select.pool-iface')?.value;
    const network = inspectorEl.querySelector<HTMLInputElement>('input.pool-network')?.value.trim();
    const prefixText = inspectorEl.querySelector<HTMLInputElement>('input.pool-prefix')?.value.trim();
    const start = inspectorEl.querySelector<HTMLInputElement>('input.pool-start')?.value.trim();
    const end = inspectorEl.querySelector<HTMLInputElement>('input.pool-end')?.value.trim();
    const prefix = prefixText === undefined || prefixText === '' ? 24 : Number(prefixText);
    if (ifaceName === undefined || network === undefined || network === '' || start === undefined || start === '' || end === undefined || end === '') {
      return;
    }
    run({ type: 'addDhcpPool', deviceId: device.id, pool: { interfaceName: ifaceName, network, prefix, rangeStart: start, rangeEnd: end } });
  });
  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.pool-remove')) {
    button.addEventListener('click', () => {
      run({ type: 'removeDhcpPool', deviceId: device.id, interfaceName: button.dataset.iface ?? '' });
    });
  }

  inspectorEl.querySelector('button.ping-run')?.addEventListener('click', () => {
    const target = inspectorEl.querySelector<HTMLInputElement>('input.ping-target')?.value.trim();
    if (target !== undefined && target !== '') {
      run({ type: 'ping', fromDevice: device.id, toAddress: target });
    }
  });

  inspectorEl.querySelector('button.fw-add')?.addEventListener('click', () => {
    const action = inspectorEl.querySelector<HTMLSelectElement>('select.fw-action')?.value;
    const src = inspectorEl.querySelector<HTMLInputElement>('input.fw-src')?.value.trim();
    const dst = inspectorEl.querySelector<HTMLInputElement>('input.fw-dst')?.value.trim();
    const portText = inspectorEl.querySelector<HTMLInputElement>('input.fw-port')?.value.trim();
    const port = portText === undefined || portText === '' ? undefined : Number(portText);
    if (action !== 'allow' && action !== 'deny') return;
    const rule: { action: 'allow' | 'deny'; srcCidr?: string; dstCidr?: string; dstPort?: number } = { action };
    if (src !== undefined && src !== '') rule.srcCidr = src;
    if (dst !== undefined && dst !== '') rule.dstCidr = dst;
    if (port !== undefined) rule.dstPort = port;
    run({ type: 'addFirewallRule', deviceId: device.id, rule });
  });
  for (const button of inspectorEl.querySelectorAll<HTMLButtonElement>('button.rule-remove')) {
    button.addEventListener('click', () => {
      run({ type: 'removeFirewallRule', deviceId: device.id, ruleId: button.dataset.rule ?? '' });
    });
  }

  inspectorEl.querySelector('button.device-delete')?.addEventListener('click', () => {
    run({ type: 'deleteDevice', deviceId: device.id });
    selectedId = null;
    render();
  });
}

/* ---- Tickets ---- */

function renderTickets(): void {
  const ticketsEl = document.querySelector<HTMLDivElement>('#tickets');
  const badge = document.querySelector<HTMLSpanElement>('#ticket-badge');
  const openCount = world.tickets.filter((t) => t.status === 'open');
  if (badge !== null) badge.textContent = String(openCount.length);
  if (ticketsEl === null) return;

  const sorted = [...world.tickets].sort((a, b) => {
    const aOpen = a.status === 'open' ? 0 : 1;
    const bOpen = b.status === 'open' ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    if (a.status === 'open' && b.status === 'open') {
      const aRem = a.openedTick + a.slaTicks - world.tick;
      const bRem = b.openedTick + b.slaTicks - world.tick;
      if (a.breached !== b.breached) return a.breached ? -1 : 1;
      return aRem - bRem;
    }
    return b.openedTick - a.openedTick;
  });

  const cards = sorted.map((ticket) => {
    if (ticket.status === 'resolved') {
      return `
        <div class="ticket resolved">
          <div class="client">${esc(ticket.client)}</div>
          <div class="title">✓ ${esc(ticket.title)}</div>
          <div class="meta"><span class="muted">resolved at t${ticket.resolvedTick ?? '?'}</span></div>
        </div>`;
    }
    const remaining = ticket.openedTick + ticket.slaTicks - world.tick;
    const fraction = remaining / ticket.slaTicks;
    const slaClass = ticket.breached ? 'sla-breach' : fraction > 0.5 ? 'sla-ok' : fraction > 0.2 ? 'sla-warn' : 'sla-breach';
    const slaText = ticket.breached ? 'SLA BREACHED' : `SLA: ${remaining} ticks left`;
    return `
      <div class="ticket${ticket.breached ? ' breached' : ''}">
        <div class="client">${esc(ticket.client)}</div>
        <div class="title">${esc(ticket.title)}</div>
        <div class="symptom">${esc(ticket.symptom)}</div>
        <div class="meta">
          <span class="${slaClass}">${slaText}</span>
          <span class="reward">+$${ticket.rewardCash}</span>
          ${ticket.breached ? `<span class="penalty">-$${ticket.penaltyCash} taken</span>` : `<span class="penalty">-$${ticket.penaltyCash} on breach</span>`}
          <button class="ticket-resolve" data-ticket="${esc(ticket.id)}">resolve</button>
        </div>
      </div>`;
  });
  ticketsEl.innerHTML = cards.join('') || '<span class="muted">No tickets. The clients are, for the moment, content.</span>';

  for (const button of ticketsEl.querySelectorAll<HTMLButtonElement>('button.ticket-resolve')) {
    button.addEventListener('click', () => {
      run({ type: 'resolveTicket', ticketId: button.dataset.ticket ?? '' });
    });
  }
}

/* ---- Contracts ---- */

function renderContracts(): void {
  const contractsEl = document.querySelector<HTMLDivElement>('#contracts');
  if (contractsEl === null) return;

  // Active side: what the shop earns per day and from which box.
  const active = world.contracts.filter((c) => c.active);
  const dailyTotal = active.reduce((sum, c) => sum + c.feePerDay, 0);
  const activeCards = active.map((contract) => {
    const device = world.devices[contract.deviceId];
    const daysLeft = Math.max(0, Math.ceil((contract.endTick - world.tick) / 24));
    const term = daysLeft === 0 ? 'term ends today' : `~${daysLeft}d left of term`;
    const strikes = contract.breaches === 0
      ? ''
      : ` <span class="sla-breach">· ${contract.breaches}/3 strikes</span>`;
    const status = device === undefined
      ? '<span class="sla-breach">device gone — ends today</span>'
      : device.failed
        ? '<span class="sla-breach">withheld — device failed</span>'
        : device.compromised
          ? '<span class="sla-breach">withheld — device compromised</span>'
          : '<span class="sla-ok">paying</span>';
    return `
      <div class="ticket contract">
        <div class="client">${esc(contract.client)}</div>
        <div class="title">${esc(device?.name ?? 'unknown device')} · <span class="mono">$${contract.feePerDay}/day</span></div>
        <div class="meta">
          ${status}
          <span class="muted">· ${term}</span>${strikes}
          <button class="ticket-resolve contract-cancel" data-contract="${esc(contract.id)}">cancel</button>
        </div>
      </div>`;
  });

  // Offer side: clients write a proposal letter before they appear here —
  // the shop does not cold-call. Signing needs a device of the client's
  // required kind on the board, and a client who ever signed (or churned)
  // leaves this list; expired terms come back through renewal mail instead.
  const offerCards = CONTRACT_OFFERS.map((offer) => {
    const everSigned = world.contracts.some((c) => c.client === offer.client);
    const proposed = world.mail.some((m) => m.actions.some((a) => a.command === `signContractOffer:${offer.client}`));
    if (everSigned || !proposed) return '';
    const candidates = Object.values(world.devices).filter((d) => d.kind === offer.requiresKind);
    const fee = Math.round(offer.baseFeePerDay * rewardMultiplier(world.reputation));
    const body = candidates.length === 0
      ? `<div class="meta"><span class="muted">needs a ${offer.requiresKind} on the board to sign</span></div>`
      : `<div class="meta">
          <span class="muted">device:</span>
          <select class="contract-device" data-client="${esc(offer.client)}">
            ${candidates.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}
          </select>
          <button class="ticket-resolve contract-sign" data-client="${esc(offer.client)}">sign — $${fee}/day</button>
        </div>`;
    return `
      <div class="ticket">
        <div class="client">${esc(offer.client)}</div>
        <div class="title">maintenance contract · base $${offer.baseFeePerDay}/day</div>
        ${body}
      </div>`;
  });

  contractsEl.innerHTML = `
    <div class="section-label">Active contracts — $${dailyTotal}/day total</div>
    ${activeCards.join('') || '<div class="muted" style="padding:0 4px 8px">No contracts yet. When clients write, their proposals land in your inbox.</div>'}
    <div class="section-label">Proposed contracts</div>
    ${offerCards.join('') || '<div class="muted" style="padding:0 4px 8px">No open proposals — clients write once they hear about your shop.</div>'}`;

  for (const button of contractsEl.querySelectorAll<HTMLButtonElement>('button.contract-sign')) {
    button.addEventListener('click', () => {
      const client = button.dataset.client ?? '';
      const select = contractsEl.querySelector<HTMLSelectElement>(`.contract-device[data-client="${CSS.escape(client)}"]`);
      run({ type: 'signContract', client, deviceId: select?.value ?? '' });
      renderContracts();
    });
  }
  for (const button of contractsEl.querySelectorAll<HTMLButtonElement>('button.contract-cancel')) {
    button.addEventListener('click', () => {
      run({ type: 'cancelContract', contractId: button.dataset.contract ?? '' });
      renderContracts();
    });
  }
}

/* ---- Mail ---- */

const OUTCOME_TEXT: Record<string, { text: string; tone: 'bad' | 'good' | 'neutral' }> = {
  'phish-pay': { text: 'Payment sent. The "vendor" is not coming back. (-$250, -1 reputation)', tone: 'bad' },
  reportPhish: { text: 'Reported as phishing. Your spam filter just got smarter. (+1 insight)', tone: 'good' },
  openReleaseNotes: { text: 'You actually read the release notes. Somewhere, Dr. Reboot smiles. (+1 insight)', tone: 'good' },
  ackContractTicket: { text: 'Receipt acknowledged. The client waits — the SLA clock does too.', tone: 'neutral' },
  renewContract: { text: 'Contract renewed for another term at the current rate.', tone: 'good' },
  replaced: { text: 'Field team done: the new unit is in, wired like the old one. The client is back online.', tone: 'good' },
  matchRival: { text: 'Deal matched. The client stays — at a permanently cheaper fee.', tone: 'neutral' },
  declineRival: { text: 'You held the line. They stay — but weighing the rival cost a trust strike.', tone: 'bad' },
};

function renderMail(): void {
  const mailBadge = document.querySelector<HTMLSpanElement>('#mail-badge');
  const inboxBadge = document.querySelector<HTMLSpanElement>('#inbox-badge');
  const inFolder = (m: Mail): boolean => (mailFolder === 'discarded') === (m.discarded === true);
  const unread = world.mail.filter((m) => !m.read && !m.discarded);
  if (mailBadge !== null) mailBadge.textContent = String(unread.length);
  if (inboxBadge !== null) inboxBadge.textContent = String(unread.length);
  if (inboxBtn !== null) {
    // Quorum's Inbox rule: the badge turns red and the button pulses when a
    // message waits for the player's action.
    const actionable = world.mail.some((m) => !m.read && !m.discarded && !m.actionTaken && m.actions.length > 0);
    inboxBtn.classList.toggle('has-action', actionable);
  }
  const discardBadge = document.querySelector<HTMLSpanElement>('#discard-badge');
  if (discardBadge !== null) {
    const discardedCount = world.mail.filter((m) => m.discarded).length;
    discardBadge.textContent = discardedCount > 0 ? String(discardedCount) : '';
  }
  if (mailView === null) return;

  for (const tab of document.querySelectorAll<HTMLButtonElement>('#mail-panel .tabs button')) {
    tab.classList.toggle('active', tab.id === `mail-tab-${mailTab}`);
  }
  document.querySelector<HTMLDivElement>('#tickets')?.classList.toggle('hidden', mailTab !== 'tickets');
  document.querySelector<HTMLDivElement>('#contracts')?.classList.toggle('hidden', mailTab !== 'contracts');
  mailView.classList.toggle('hidden', mailTab !== 'mail');
  if (mailTab === 'contracts') renderContracts();
  if (mailTab !== 'mail') return;

  const mail = openMailId === null ? undefined : world.mail.find((m) => m.id === openMailId);

  if (mail === undefined) {
    // The mail view doubles as inbox and discard folder, toggled by the
    // folder switch; discarded letters stay retrievable, never destroyed.
    const visible = world.mail.filter(inFolder);
    const folderSwitch =
      `<div class="folder-switch">
        <button id="folder-inbox"${mailFolder === 'inbox' ? ' class="active"' : ''}>Inbox</button>
        <button id="folder-discarded"${mailFolder === 'discarded' ? ' class="active"' : ''}>Discarded</button>
      </div>`;
    const rows = [...visible].reverse().map((m) => {
      const snippet = m.body.replaceAll('\n', ' ').slice(0, 90);
      // A trained eye flags phishing letters straight in the list; a green
      // player sees nothing unusual.
      const flagged = m.kind === 'phish' && phishAlertLevel(world.insight) !== 'none';
      const tag = m.quarantined === true ? '<span class="mail-kind">quarantine</span>' : '';
      return `
        <div class="mail-row${m.read ? ' read' : ''}${flagged ? ' phish-flagged' : ''}" data-mail="${esc(m.id)}">
          <div class="from">
            <span class="dot"></span>
            <span>${esc(m.from)}</span>
            ${tag}
            <span class="mail-kind">${m.kind}</span>
          </div>
          <div class="subject">${esc(m.subject)}</div>
          <div class="snippet">${esc(snippet)}</div>
        </div>`;
    });
    mailView.innerHTML =
      folderSwitch +
      (rows.join('') || `<span class="muted">${mailFolder === 'discarded' ? 'Nothing discarded. The inbox is winning.' : 'The inbox is empty. Enjoy it while it lasts.'}</span>`);
    for (const row of mailView.querySelectorAll<HTMLDivElement>('.mail-row')) {
      row.addEventListener('click', () => {
        openMailId = row.dataset.mail ?? null;
        if (openMailId !== null) run({ type: 'readMail', mailId: openMailId });
        renderMail();
      });
    }
    for (const button of mailView.querySelectorAll<HTMLButtonElement>('.folder-switch button')) {
      button.addEventListener('click', () => {
        mailFolder = button.id === 'folder-discarded' ? 'discarded' : 'inbox';
        renderMail();
      });
    }
    return;
  }

  const outcome =
    mail.actionTaken !== undefined && mail.quarantined === true && mail.actionTaken === 'reportPhish'
      ? undefined // the filter's own report: the quarantine banner already says it
      : mail.actionTaken === undefined
        ? undefined
        : OUTCOME_TEXT[mail.actionTaken.split(':')[0] ?? ''];
  // Paying a phish costs more standing every repeat — show the real numbers.
  const payOutcome =
    mail.actionTaken?.startsWith('phish-pay') === true
      ? `Payment sent. The "vendor" is not coming back. (-$250, -${phishPayRepLoss(world.phishPayments - 1)} reputation, worse every time)`
      : undefined;
  // A quarantined letter was caught by the spam filter before it could do harm.
  const quarantine =
    mail.quarantined === true && mail.actionTaken === 'reportPhish'
      ? '<div class="outcome good">Caught by your spam filter on arrival and reported automatically. (+1 insight)</div>'
      : mail.quarantined === true
        ? '<div class="outcome">Your spam filter flagged this letter as phishing on arrival. Do not pay "vendors" like this one.</div>'
        : '';
  // Experience speaking: the more phishes reported, the louder the warning —
  // and the replacement-phish twin gets a specific tell called out.
  const replacementPhish = mail.kind === 'phish' && mail.subject.startsWith('Instant replacement available for your ');
  const alert =
    mail.kind === 'phish' && mail.actionTaken === undefined
      ? phishAlertLevel(world.insight) === 'trained'
        ? `<div class="outcome bad">${replacementPhish ? 'Your trained eye catches it: the real Hardware Care writes from field@novabit.example and PAYS you for a dead unit — nobody asks for a courier fee.' : 'Your trained eye recognizes this pattern — the sender is not who they claim to be.'}</div>`
        : phishAlertLevel(world.insight) === 'uneasy'
          ? `<div class="outcome">${replacementPhish ? 'Something feels off — the real vendor letter quoted your exact model and a trade-in credit. This one wants money instead.' : 'Something feels off about this letter. Check the sender address before touching those buttons.'}</div>`
          : ''
      : '';
  const buttons = mail.actionTaken === undefined
    ? mail.actions
        .map(
          (action) =>
            `<button class="${action.command.startsWith('phish-pay') ? 'danger' : 'primary'} mail-action" data-command="${esc(action.command)}">${esc(action.label)}</button>`,
        )
        .join('')
    : '';
  const discardButton =
    mail.discarded === true
      ? '<button class="mail-discard" data-discard="restore">Restore to inbox</button>'
      : '<button class="mail-discard" data-discard="discard">Discard</button>';
  // The vendor replacement offer quotes the live price list under its text;
  // its phishing evil twin gets a fraud warning instead.
  const isReplacementLetter = mail.kind === 'vendor' && mail.subject.startsWith('Instant replacement available for your ');
  const replacementQuote = isReplacementLetter
    ? (() => {
        const model = mail.subject.slice('Instant replacement available for your '.length);
        const def = DEVICE_CATALOG.find((d) => d.name === model);
        if (def === undefined) return '';
        const replaceCost = Math.max(0, def.price - TRADE_IN_CREDIT);
        return `<div class="mail-quote"><b>${esc(def.name)}</b> · ${esc(def.kind)} · new $${def.price} − trade-in $${TRADE_IN_CREDIT} → <b class="mono">$${replaceCost}</b></div>`;
      })()
    : '';
  mailView.innerHTML = `
    <div class="mail-read">
      <button class="back">← inbox</button>
      <div class="from">${esc(mail.from)}</div>
      <div class="subject">${esc(mail.subject)}</div>
      <div class="body">${esc(mail.body)}</div>
      ${replacementQuote}
      ${quarantine}
      ${alert}
      ${buttons !== '' ? `<div class="actions">${buttons}</div>` : ''}
      <div class="actions">${discardButton}</div>
      ${
        payOutcome !== undefined
          ? `<div class="outcome bad">${esc(payOutcome)}</div>`
          : outcome !== undefined
            ? `<div class="outcome ${outcome.tone === 'neutral' ? '' : outcome.tone}">${esc(outcome.text)}</div>`
            : ''
      }
    </div>`;
  mailView.querySelector('button.back')?.addEventListener('click', () => {
    openMailId = null;
    renderMail();
  });
  mailView.querySelector('button.mail-discard')?.addEventListener('click', (event) => {
    const restore = (event.currentTarget as HTMLButtonElement).dataset.discard === 'restore';
    run({ type: 'discardMail', mailId: mail.id, restore });
    if (restore) openMailId = null; // back to the folder list after restoring
    renderMail();
  });
  for (const button of mailView.querySelectorAll<HTMLButtonElement>('button.mail-action')) {
    button.addEventListener('click', () => {
      const command = button.dataset.command ?? '';
      if (command === 'openPrestige') {
        // Client-side affordance: reopen the scorecard overlay. No sim state.
        endgameDismissedTick = null;
        render();
        return;
      }
      run({ type: 'mailAction', mailId: mail.id, command });
      renderMail();
    });
  }
}

/* ---- Operations console (bottom drawer) ---- */

function renderEvents(): void {
  const view = document.querySelector<HTMLDivElement>('#events-view');
  if (view === null) return;
  // Full event history, newest at the bottom, auto-scrolled like a console.
  view.innerHTML = world.log
    .map((entry) => `<div class="log-line ${entry.level}"><span class="sev">${entry.level === 'alert' ? '✖' : entry.level === 'warn' ? '▲' : '·'}</span><span class="meta">[t${entry.tick}]</span> ${esc(entry.text)}</div>`)
    .join('');
  view.parentElement?.scrollTo({ top: view.parentElement.scrollHeight });
}

function renderDiagnostics(): void {
  const view = document.querySelector<HTMLDivElement>('#diag-view');
  if (view === null) return;
  const pingLines = world.log.filter((entry) => entry.text.toLowerCase().includes('ping')).slice(-4);
  const linkLines = world.links.map((link) => {
    const a = world.devices[link.a.deviceId];
    const b = world.devices[link.b.deviceId];
    if (a === undefined || b === undefined) return '';
    const aIface = a.interfaces.find((i) => i.name === link.a.interfaceName);
    const bIface = b.interfaces.find((i) => i.name === link.b.interfaceName);
    const down = (aIface !== undefined && !aIface.enabled) || (bIface !== undefined && !bIface.enabled);
    return `<div class="di"><span class="${down ? 'fail' : 'ok'}">${down ? 'DOWN' : 'UP  '}</span> ${esc(a.name)}:${esc(link.a.interfaceName)} ⇄ ${esc(b.name)}:${esc(link.b.interfaceName)}</div>`;
  });
  view.innerHTML = `
    <div class="di">Last ping results:</div>
    ${pingLines.map((entry) => `<div class="di"><span class="meta">[t${entry.tick}]</span> ${esc(entry.text)}</div>`).join('') || '<div class="di">No pings yet — run one from the inspector.</div>'}
    <div class="di" style="margin-top:8px">Link state (${world.links.length} cable${world.links.length === 1 ? '' : 's'}):</div>
    ${linkLines.join('') || '<div class="di">No links.</div>'}`;
}

function renderActivity(): void {
  const view = document.querySelector<HTMLDivElement>('#activity-view');
  if (view === null) return;
  // Honest scope: the sim does not trace individual packets yet, so this tab
  // reports what the sim does know — per-device interface occupancy.
  const lines = Object.values(world.devices).map((device) => {
    const wired = device.interfaces.filter((iface) =>
      world.links.some(
        (link) =>
          (link.a.deviceId === device.id && link.a.interfaceName === iface.name) ||
          (link.b.deviceId === device.id && link.b.interfaceName === iface.name),
      ),
    ).length;
    const up = device.interfaces.filter((iface) => iface.enabled).length;
    const addressed = device.interfaces.filter((iface) => iface.ipv4 !== undefined).length;
    return `<div class="di"><b>${esc(device.name)}</b> — ${wired}/${device.interfaces.length} ports wired · ${up} up · ${addressed} addressed</div>`;
  });
  view.innerHTML = `
    <div class="di">Per-port summary (packet-level capture is not simulated yet):</div>
    ${lines.join('')}`;
}

function setConsoleTab(next: 'events' | 'diag' | 'activity'): void {
  consoleTab = next;
  const views: Record<string, string> = { events: '#events-view', diag: '#diag-view', activity: '#activity-view' };
  for (const [tab, selector] of Object.entries(views)) {
    document.querySelector(selector)?.classList.toggle('hidden', tab !== consoleTab);
  }
  for (const id of ['ctab-events', 'ctab-diag', 'ctab-activity']) {
    document.querySelector<HTMLButtonElement>(`#${id}`)?.classList.toggle('active', id === `ctab-${consoleTab}`);
  }
  if (consoleTab === 'diag') renderDiagnostics();
  if (consoleTab === 'activity') renderActivity();
}

/* ---- Shop (equipment store) ---- */

function renderShop(): void {
  const shopPanel = document.querySelector<HTMLDivElement>('#shop-panel');
  const shopCash = document.querySelector<HTMLElement>('#shop-cash');
  const shopView = document.querySelector<HTMLDivElement>('#shop-view');
  if (shopPanel === null || shopView === null) return;
  shopPanel.classList.toggle('open', shopOpen);
  document.body.classList.toggle('shop-open', shopOpen);
  if (shopCash !== null) shopCash.textContent = `$${world.cash}`;

  const parts: string[] = [];
  for (const group of CATALOG_GROUPS) {
    const defs = DEVICE_CATALOG.filter((def) => group.kinds.includes(def.kind));
    if (defs.length === 0) continue;
    const items = defs
      .map((def) => {
        const afford = world.cash >= def.price;
        const ports = def.interfaces.length;
        const portLine = ports === 0 ? 'no ports' : `${ports} ports`;
        const listPrice = devicePrice(world, def);
        return `
          <div class="shop-item${afford ? '' : ' poor'}">
            <span class="icon">${KIND_ICON[def.kind] ?? '▪'}</span>
            <span class="info">
              <span class="name">${esc(def.name)}</span>
              <span class="meta">${esc(def.kind)} · ${portLine} · ${esc(def.firmware)}</span>
            </span>
            <span class="price">$${listPrice}</span>
            <button class="buy${afford ? '' : ' poor'}" data-def="${esc(def.id)}" title="${afford ? 'Buy and place on the board' : 'Not enough cash — the sim will refuse'}">buy</button>
          </div>`;
      })
      .join('');
    parts.push(`<div class="group-title">${esc(group.label)}</div>${items}`);
  }
  // Community actions: the paid way back to good standing.
  const goodwill = `
    <div class="group-title">Community</div>
    <div class="shop-item">
      <span class="icon">🎮</span>
      <span class="info">
        <span class="name">Sponsor the LAN party</span>
        <span class="meta">+$1 reputation · the local crowd remembers</span>
      </span>
      <span class="price">$120</span>
      <button class="buy goodwill" data-action="sponsor-lan" title="Costs $120, earns reputation while below premium standing">do it</button>
    </div>
    <div class="shop-item">
      <span class="icon">🔧</span>
      <span class="info">
        <span class="name">Free-repairs weekend</span>
        <span class="meta">+$1 reputation · good will with the regulars</span>
      </span>
      <span class="price">$80</span>
      <button class="buy goodwill" data-action="free-repairs" title="Costs $80, earns reputation while below premium standing">do it</button>
    </div>`;
  // Server Room: the rack upgrade that raises the board's device capacity.
  const used = Object.keys(world.devices).length;
  const slots = rackSlots(world);
  const nextTier = RACK_TIERS[world.rackTier + 1];
  const rack = `<div class="group-title">Server Room</div>
    <div class="shop-item">
      <span class="icon">🗄️</span>
      <span class="info">
        <span class="name">${nextTier === undefined ? 'Server room — fully expanded' : esc(nextTier.name)}</span>
        <span class="meta">${used}/${slots} slots in use${nextTier === undefined ? '' : ` → ${nextTier.slots}`}</span>
      </span>
      <span class="price">${nextTier === undefined ? '—' : `$${nextTier.price}`}</span>
      ${
        nextTier === undefined
          ? '<button class="buy poor" disabled title="Every tier is installed">max</button>'
          : `<button class="buy rack-upgrade${world.cash >= nextTier.price ? '' : ' poor'}" title="Raises device capacity to ${nextTier.slots} slots">upgrade</button>`
      }
    </div>`;
  // Season Records: every closed season, replayable through the scorecard overlay.
  const seasonRows = [...world.prestigeHistory]
    .reverse()
    .map((record) => {
      const careerUpTo = world.prestigeHistory
        .slice(0, world.prestigeHistory.findIndex((r) => r.season === record.season) + 1)
        .reduce((sum, r) => sum + r.score, 0);
      return `
        <div class="shop-item">
          <span class="icon">🏆</span>
          <span class="info">
            <span class="name">Season ${record.season}</span>
            <span class="meta">${record.score} prestige · career ${careerUpTo} · ${esc(prestigeRank(careerUpTo))}</span>
          </span>
          <span class="price">${record.score}</span>
          <button class="buy scorecard-view" data-season="${record.season}" title="Replay this season's scorecard">view</button>
        </div>`;
    })
    .join('');
  const seasonRecords = seasonRows === '' ? '' : `<div class="group-title">Season Records</div>${seasonRows}`;

  shopView.innerHTML = rack + parts.join('') + goodwill + seasonRecords;

  for (const button of shopView.querySelectorAll<HTMLButtonElement>('button.scorecard-view')) {
    button.addEventListener('click', () => {
      scorecardSeason = Number(button.dataset.season);
      render();
    });
  }

  for (const button of shopView.querySelectorAll<HTMLButtonElement>('button.rack-upgrade')) {
    button.addEventListener('click', () => {
      run({ type: 'upgradeRack' });
    });
  }

  for (const button of shopView.querySelectorAll<HTMLButtonElement>('button.goodwill')) {
    button.addEventListener('click', () => {
      run({ type: 'goodwill', action: button.dataset.action as 'sponsor-lan' | 'free-repairs' });
    });
  }

  for (const button of shopView.querySelectorAll<HTMLButtonElement>('button.buy')) {
    button.addEventListener('click', () => {
      selectedDefId = button.dataset.def ?? null;
      shopOpen = false;
      setMode('place');
    });
  }

  document.querySelector('#prestige-continue')?.addEventListener('click', () => {
    endgameDismissedTick = world.endgameTick ?? null;
    scorecardSeason = null;
    render();
  });
}

/* ---- Prestige scorecard (day-30 endgame, per season) ---- */

function prestigeRank(career: number): string {
  if (career >= 600) return 'Backbone Legend';
  if (career >= 300) return 'City-Grade ISP';
  if (career >= 100) return 'Neighborhood Staple';
  return 'Back-Alley Cable Runner';
}

function renderPrestige(): void {
  const overlay = document.querySelector<HTMLDivElement>('#prestige-overlay');
  if (overlay === null) return;
  const freshClose = world.endgameTick !== undefined && world.endgameTick !== endgameDismissedTick;
  const show = scorecardSeason !== null || freshClose;
  overlay.classList.toggle('hidden', !show);
  if (!show) return;
  // A shop replay shows the requested season's frozen record; a fresh close
  // shows the latest record. Either way the numbers never drift after the fact.
  const closed =
    scorecardSeason !== null
      ? world.prestigeHistory.find((record) => record.season === scorecardSeason)
      : world.prestigeHistory.at(-1);
  if (closed === undefined) return;
  const careerUpTo = world.prestigeHistory
    .slice(0, world.prestigeHistory.findIndex((record) => record.season === closed.season) + 1)
    .reduce((sum, record) => sum + record.score, 0);
  const seasonEl = document.querySelector<HTMLElement>('#prestige-season');
  if (seasonEl !== null) seasonEl.textContent = `SEASON ${closed.season} COMPLETE`;
  const scoreEl = document.querySelector<HTMLElement>('#prestige-score');
  if (scoreEl !== null) scoreEl.textContent = String(closed.score);
  const rankEl = document.querySelector<HTMLElement>('#prestige-rank');
  if (rankEl !== null) rankEl.textContent = prestigeRank(careerUpTo);
  const careerEl = document.querySelector<HTMLElement>('#prestige-career');
  if (careerEl !== null) {
    careerEl.innerHTML =
      scorecardSeason !== null
        ? `Career prestige <b>${careerUpTo}</b> after season ${closed.season}`
        : `Career prestige <b>${careerPrestige(world)}</b> across ${world.prestigeHistory.length} season${world.prestigeHistory.length === 1 ? '' : 's'}`;
  }
  const breakdown = document.querySelector<HTMLElement>('#prestige-breakdown');
  if (breakdown !== null) {
    const score = closed.breakdown;
    const rows: { label: string; points: number; bonus?: boolean }[] = [
      { label: 'Banked cash', points: score.cashPoints },
      { label: 'Reputation', points: score.reputationPoints },
      { label: 'Insight', points: score.insightPoints },
      { label: 'Live contracts', points: score.contractPoints },
      { label: 'Network built', points: score.networkPoints },
      { label: 'Tickets resolved', points: score.servicePoints },
      { label: 'Hard-mode bonus', points: score.hardBonus, bonus: true },
    ];
    breakdown.innerHTML = rows
      .filter((row) => row.bonus === undefined || row.points > 0)
      .map((row) => `<div class="row${row.bonus ? ' bonus' : ''}"><span>${esc(row.label)}</span><b>${row.points}</b></div>`)
      .join('');
  }
}

/* ---- Hint ---- */

function renderHint(): void {
  if (hintEl === null) return;
  let text = MODE_HINTS[mode];
  if (mode === 'wire' && wireFromId !== null) {
    text = `from ${world.devices[wireFromId]?.name ?? '?'} — click the destination`;
  }
  hintEl.textContent = text;
}

/* ---- Render root ---- */

function render(): void {
  drawBoard();
  renderHud();
  renderInspector();
  renderTickets();
  renderMail();
  renderShop();
  renderPrestige();
  renderEvents();
  if (consoleTab === 'diag') renderDiagnostics();
  if (consoleTab === 'activity') renderActivity();
  renderHint();
  renderCatalog();

  for (const id of ['mode-select', 'mode-wire', 'mode-place']) {
    document.querySelector<HTMLButtonElement>(`#${id}`)?.classList.toggle('active', id === `mode-${mode}`);
  }
  const deleteButton = document.querySelector<HTMLButtonElement>('#tool-delete');
  if (deleteButton !== null) deleteButton.disabled = selectedId === null;
  if (mailPanel !== null) mailPanel.classList.toggle('open', mailPanelOpen);
  document.body.classList.toggle('mail-open', mailPanelOpen);
}

/* ---- Canvas input ---- */

canvas.addEventListener('mousemove', (event) => {
  mouse = { x: event.offsetX, y: event.offsetY };
  if (drag !== null) {
    const device = world.devices[drag.deviceId];
    if (device === undefined) return;
    const x = Math.round(mouse.x - drag.dx);
    const y = Math.round(mouse.y - drag.dy);
    if (device.x !== x || device.y !== y) {
      drag.moved = true;
      run({ type: 'moveDevice', deviceId: device.id, x, y });
      return;
    }
  }
  if (mode === 'wire' && wireFromId !== null) drawBoard();
});

canvas.addEventListener('mousedown', (event) => {
  const hit = deviceAt(event.offsetX, event.offsetY);
  if (mode === 'select' && hit !== undefined) {
    drag = { deviceId: hit.id, dx: event.offsetX - hit.x, dy: event.offsetY - hit.y, moved: false };
  }
});

canvas.addEventListener('mouseup', (event) => {
  const wasDrag = drag !== null && drag.moved;
  drag = null;
  const hit = deviceAt(event.offsetX, event.offsetY);

  if (mode === 'select') {
    if (!wasDrag && hit !== undefined) {
      selectedId = hit.id;
      mailPanelOpen = false;
    } else if (!wasDrag && hit === undefined) {
      selectedId = null;
    }
    render();
    return;
  }

  if (mode === 'place') {
    if (hit === undefined && selectedDefId !== null) {
      const def = world.catalog[selectedDefId];
      if (def !== undefined) {
        run({ type: 'placeDevice', defId: selectedDefId, name: `${def.kind}-${Object.keys(world.devices).length + 1}`, x: event.offsetX, y: event.offsetY });
        selectedId = Object.keys(world.devices).at(-1) ?? null;
      }
    }
    render();
    return;
  }

  if (mode === 'wire') {
    if (hit === undefined) {
      wireFromId = null;
    } else if (wireFromId === null) {
      wireFromId = hit.id;
      selectedId = hit.id;
    } else if (hit.id !== wireFromId) {
      const from = world.devices[wireFromId];
      const aIface = from?.interfaces.find((iface) => isFree(from.id, iface.name));
      const bIface = hit.interfaces.find((iface) => isFree(hit.id, iface.name));
      if (from !== undefined && aIface !== undefined && bIface !== undefined) {
        run({
          type: 'wireLink',
          a: { deviceId: from.id, interfaceName: aIface.name },
          b: { deviceId: hit.id, interfaceName: bIface.name },
        });
      }
      wireFromId = null;
    }
    render();
  }
});

function isFree(deviceId: string, interfaceName: string): boolean {
  return !world.links.some(
    (link) =>
      (link.a.deviceId === deviceId && link.a.interfaceName === interfaceName) ||
      (link.b.deviceId === deviceId && link.b.interfaceName === interfaceName),
  );
}

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  setMode('select');
});

/* ---- Toolbar, sidebar, panels, keys ---- */

function setMode(next: Mode): void {
  mode = next;
  if (next !== 'wire') wireFromId = null;
  if (next !== 'select') selectedId = null;
  render();
}

document.querySelector('#mode-select')?.addEventListener('click', () => setMode('select'));
document.querySelector('#mode-wire')?.addEventListener('click', () => setMode('wire'));
document.querySelector('#mode-place')?.addEventListener('click', () => setMode('place'));
document.querySelector('#tool-delete')?.addEventListener('click', () => {
  if (selectedId !== null) {
    run({ type: 'deleteDevice', deviceId: selectedId });
    selectedId = null;
    render();
  }
});
document.querySelector('#catalog-search')?.addEventListener('input', (event) => {
  catalogQuery = (event.target as HTMLInputElement).value;
  renderCatalog();
});
document.querySelector('#toggle-sidebar')?.addEventListener('click', () => {
  sidebarToggleOverride = true;
  document.body.classList.toggle('rail-collapsed');
});
// On smaller screens the catalog sidebar starts collapsed to keep the canvas
// maximized; on desktop widths it starts open. A manual toggle wins until the
// viewport crosses the breakpoint again.
let sidebarToggleOverride = false;
function applySidebarDefault(): void {
  if (window.innerWidth <= 1080) {
    if (!sidebarToggleOverride) document.body.classList.add('rail-collapsed');
  } else {
    if (!sidebarToggleOverride) document.body.classList.remove('rail-collapsed');
    sidebarToggleOverride = false;
  }
}
applySidebarDefault();
window.addEventListener('resize', applySidebarDefault);
// Mirror behavior for the inspector: collapsed by default on small screens,
// open on desktop. Selecting a device opens it regardless of width.
let inspectorToggleOverride = false;
function applyInspectorDefault(): void {
  if (window.innerWidth <= 1080) {
    // Don't collapse while a device is selected — the panel is showing it.
    if (!inspectorToggleOverride && selectedId === null) document.body.classList.add('inspector-collapsed');
  } else {
    if (!inspectorToggleOverride) document.body.classList.remove('inspector-collapsed');
    inspectorToggleOverride = false;
  }
}
applyInspectorDefault();
window.addEventListener('resize', applyInspectorDefault);
document.querySelector('#toggle-inspector')?.addEventListener('click', () => {
  inspectorToggleOverride = true;
  document.body.classList.toggle('inspector-collapsed');
});
document.querySelector('#inspector-close')?.addEventListener('click', () => {
  selectedId = null;
  render();
});
inboxBtn?.addEventListener('click', () => {
  mailPanelOpen = !mailPanelOpen;
  if (mailPanelOpen) selectedId = null;
  render();
});
document.querySelector('#mail-close')?.addEventListener('click', () => {
  mailPanelOpen = false;
  render();
});
document.querySelector('#shop-btn')?.addEventListener('click', () => {
  shopOpen = !shopOpen;
  if (shopOpen) {
    selectedId = null;
    mailPanelOpen = false;
  }
  render();
});
document.querySelector('#shop-close')?.addEventListener('click', () => {
  shopOpen = false;
  render();
});
document.querySelector('#mail-tab-mail')?.addEventListener('click', () => {
  mailTab = 'mail';
  renderMail();
});
document.querySelector('#mail-tab-tickets')?.addEventListener('click', () => {
  mailTab = 'tickets';
  renderMail();
});
for (const [id, tab] of [['ctab-events', 'events'], ['ctab-diag', 'diag'], ['ctab-activity', 'activity']] as const) {
  document.querySelector(`#${id}`)?.addEventListener('click', () => setConsoleTab(tab));
}
document.querySelector('#console-toggle')?.addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('console-collapsed');
  document.querySelector<HTMLButtonElement>('#console-toggle')!.textContent = collapsed ? '▴' : '▾';
});

const clockButton = document.querySelector<HTMLButtonElement>('#clock');
clockButton?.addEventListener('click', () => {
  clockRunning = !clockRunning;
  render();
});

// The clock ticks twice per second normally; hard mode doubles the pace, so
// SLAs, wear rolls, and incidents all land twice as often in real time.
let clockTimer = 0;
function tickIntervalMs(): number {
  return world.difficulty === 'hard' ? 250 : 500;
}
function startClock(): void {
  window.clearInterval(clockTimer);
  clockTimer = window.setInterval(() => {
    if (!clockRunning) return;
    advanceTicks(world, 1);
    render();
  }, tickIntervalMs());
}
startClock();

const hardButton = document.querySelector<HTMLButtonElement>('#hard-btn');
hardButton?.addEventListener('click', () => {
  applyCommand(world, { type: 'setDifficulty', difficulty: world.difficulty === 'hard' ? 'normal' : 'hard' });
  startClock();
  render();
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 's') setMode('select');
  if (key === 'w') setMode('wire');
  if (key === 'p') setMode('place');
  if (key === 't') {
    mailPanelOpen = !mailPanelOpen;
    render();
  }
  if (key === 'b') {
    shopOpen = !shopOpen;
    if (shopOpen) {
      selectedId = null;
      mailPanelOpen = false;
    }
    render();
  }
  if (event.code === 'Space') {
    event.preventDefault();
    clockRunning = !clockRunning;
    render();
  }
  if (key === 'escape') {
    wireFromId = null;
    selectedId = null;
    mailPanelOpen = false;
    shopOpen = false;
    setMode('select');
  }
  if (key === 'delete' && selectedId !== null) {
    run({ type: 'deleteDevice', deviceId: selectedId });
    selectedId = null;
  }
});

window.addEventListener('resize', () => render());

// Seed the board with the Board Prototype v0.1 sample topology:
// PC-A → Switch-A → Router-A → Server-A (router/server pre-configured,
// PC-A unconfigured — the player's first job is the address and first ping).
function loadStarterTopology(topology: ScenarioTopology): void {
  const ids = new Map<string, string>();
  for (const spec of topology.devices) {
    run({ type: 'placeDevice', defId: spec.defId, name: spec.name, x: spec.x, y: spec.y });
    const device = Object.values(world.devices).find((d) => d.name === spec.name);
    if (device === undefined) continue;
    ids.set(spec.name, device.id);
    for (const iface of spec.interfaces ?? []) {
      run({
        type: 'setIpv4',
        deviceId: device.id,
        interfaceName: iface.interfaceName,
        address: iface.address,
        prefix: iface.prefix,
        ...(iface.gateway !== undefined ? { gateway: iface.gateway } : {}),
      });
    }
    for (const route of spec.routes ?? []) {
      run({
        type: 'addRoute',
        deviceId: device.id,
        route: {
          destinationCidr: route.destinationCidr,
          metric: route.metric,
          ...(route.gateway !== undefined ? { gateway: route.gateway } : {}),
        },
      });
    }
  }
  for (const link of topology.links) {
    const a = ids.get(link.a.deviceName);
    const b = ids.get(link.b.deviceName);
    if (a === undefined || b === undefined) continue;
    run({
      type: 'wireLink',
      a: { deviceId: a, interfaceName: link.a.interfaceName },
      b: { deviceId: b, interfaceName: link.b.interfaceName },
    });
  }
}
loadStarterTopology(BOARD_PROTOTYPE_TOPOLOGY);

// Deliver the starter inbox from the data package.
for (const template of STARTER_MAIL) {
  deliverMail(world, template);
}

// Dev affordance: URL params reproduce UI states for captures/tests.
// ?select=<name>, ?mode=wire|place, ?tab=mail|discarded|tickets, ?openmail=<index|id:mail-N>, ?clock=run,
// ?incident=rogue-dhcp&target=<name> | ?incident=outdated-firmware&target=<name>&fwfix=1,
// ?ifdown=<deviceName>:<ifaceName> (brings an interface DOWN before capture),
// ?insight=<n> sets the insight total (reproduces phish-alert levels for captures),
// ?phishpay=<mailId,...> pays those phishing letters at load (reproduces paid outcomes),
// ?discard=<mailId,...> discards those letters at load (reproduces the discard folder),
// ?rack=<tier> sets the rack tier, ?fillrack=1 fills the rack to capacity,
// ?fail=<name> fails a device, ?age=<ticks> ages all devices,
// ?replace=1 swaps the first failed device for new hardware
const params = new URLSearchParams(window.location.search);
// ?twinmail=1 force-delivers the vendor-impersonation replacement phish and
// opens it — reproduces the twin letter for captures without waiting on the
// ambient mail RNG.
if (params.get('twinmail') === '1') {
  const twin = deliverMail(world, TWIN_REPLACEMENT_PHISH);
  mailPanelOpen = true;
  mailTab = 'mail';
  openMailId = twin.id;
  applyCommand(world, { type: 'readMail', mailId: twin.id });
}
const insightParam = Number(params.get('insight') ?? '');
if (Number.isInteger(insightParam) && insightParam > 0) world.insight = insightParam;
// ?hard=1 engages hard mode at load (and restarts the clock at its faster pace).
if (params.get('hard') === '1') {
  applyCommand(world, { type: 'setDifficulty', difficulty: 'hard' });
  startClock();
}
// ?day30=1 advances the world to the final tick of day 29, so the next tick
// closes the season through the engine's real endgame path (scorecard, mail).
if (params.get('day30') === '1') {
  world.tick = PRESTIGE_DAY_TICKS - 1;
  advanceTicks(world, 1);
}
const ifdownParam = params.get('ifdown');
if (ifdownParam !== null) {
  const [deviceName, ifaceName] = ifdownParam.split(':');
  const device = Object.values(world.devices).find((d) => d.name === deviceName);
  if (device !== undefined && ifaceName !== undefined) {
    applyCommand(world, { type: 'setInterfaceEnabled', deviceId: device.id, interfaceName: ifaceName, enabled: false });
  }
}
const selectName = params.get('select');
if (selectName !== null) {
  const device = Object.values(world.devices).find((d) => d.name === selectName);
  if (device !== undefined) selectedId = device.id;
}
const modeParam = params.get('mode');
if (modeParam === 'wire' || modeParam === 'place') mode = modeParam;
if (params.get('tab') === 'tickets') {
  mailPanelOpen = true;
  mailTab = 'tickets';
} else if (params.get('tab') === 'mail') {
  mailPanelOpen = true;
  mailTab = 'mail';
} else if (params.get('tab') === 'discarded') {
  mailPanelOpen = true;
  mailTab = 'mail';
  mailFolder = 'discarded';
} else if (params.get('tab') === 'contracts') {
  mailPanelOpen = true;
  mailTab = 'contracts';
}
const openMailParam = params.get('openmail');
if (openMailParam !== null) {
  mailPanelOpen = true;
  mailTab = 'mail';
}
if (params.get('clock') === 'run') clockRunning = true;
// ?contract=<offerNamePrefix> signs the first matching offer with its first
// required-kind device — reproduces signed-contract states for captures.
// The signing itself runs after ?fast= below, so the fresh term (and any
// ?phishpay strikes) show at render time instead of expiring mid-advance.
const contractParam = params.get('contract');
if (params.get('shop') === '1') {
  shopOpen = true;
  selectedId = null;
}
// ?rack=<tier> sets the rack tier directly and ?fillrack=1 fills the rack to
// capacity with dev-funded desktops — reproduces full-rack states for captures.
// ?fail=<deviceName> marks that device failed (wear-failure incident) and
// ?age=<ticks> ages every device's wear clock — reproduces worn/failed states.
const failParam = params.get('fail');
if (failParam !== null) {
  const target =
    Object.values(world.devices).find((d) => d.name === failParam) ??
    Object.values(world.devices).find((d) => d.kind === 'switch-unmanaged');
  if (target !== undefined) {
    applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: target.id });
  }
}
const ageParam = Number(params.get('age') ?? '');
if (Number.isInteger(ageParam) && ageParam > 0) {
  for (const device of Object.values(world.devices)) device.uptimeTicks += ageParam;
}
// ?replace=1 swaps the first failed device for new hardware — reproduces the
// post-replacement state (fresh box, wiring intact) for captures.
// ?replaceaction=<name> fails that device, then takes the vendor letter's
// one-click order — reproduces the mail-with-taken-action state for captures.
if (params.get('replace') === '1') {
  const dead = Object.values(world.devices).find((d) => d.failed === true);
  if (dead !== undefined) {
    const wasSelected = selectedId === dead.id;
    applyCommand(world, { type: 'replaceDevice', deviceId: dead.id });
    if (wasSelected) {
      const fresh = Object.values(world.devices).find((d) => d.name === dead.name);
      if (fresh !== undefined) selectedId = fresh.id;
    }
  }
}
const replaceActionParam = params.get('replaceaction');
if (replaceActionParam !== null) {
  const device = Object.values(world.devices).find((d) => d.name === replaceActionParam);
  if (device !== undefined) {
    applyCommand(world, { type: 'triggerIncident', kind: 'wear-failure', targetDeviceId: device.id });
    const letter = [...world.mail].reverse().find((m) => m.actions.some((a) => a.command === `orderReplacement:${device.id}`));
    if (letter !== undefined) applyCommand(world, { type: 'mailAction', mailId: letter.id, command: `orderReplacement:${device.id}` });
  }
}
const rackParam = Number(params.get('rack') ?? '');
if (Number.isInteger(rackParam) && rackParam >= 0) world.rackTier = rackParam;
if (params.get('fillrack') === '1') {
  world.cash = Math.max(world.cash, 100000);
  while (Object.keys(world.devices).length < rackSlots(world)) {
    const n = Object.keys(world.devices).length;
    applyCommand(world, { type: 'placeDevice', defId: 'desktop', x: 60 + (n % 6) * 120, y: 70 + Math.floor(n / 6) * 100 });
  }
}
if (params.get('incident') === 'rogue-dhcp') {
  const target =
    Object.values(world.devices).find((d) => d.name === params.get('target')) ??
    Object.values(world.devices).find((d) => d.kind === 'switch-unmanaged');
  if (target !== undefined) {
    applyCommand(world, { type: 'triggerIncident', kind: 'rogue-dhcp', targetDeviceId: target.id });
    const leaseName = params.get('lease');
    const leaser = leaseName === null ? undefined : Object.values(world.devices).find((d) => d.name === leaseName);
    if (leaser !== undefined) {
      applyCommand(world, { type: 'dhcpDiscover', deviceId: leaser.id });
    }
  }
}
if (params.get('incident') === 'outdated-firmware') {
  const target =
    Object.values(world.devices).find((d) => d.name === params.get('target')) ??
    Object.values(world.devices).find((d) => world.firmwareChannels[d.defId] !== undefined && world.firmwareChannels[d.defId] !== d.firmware);
  const channel = target === undefined ? undefined : world.firmwareChannels[target.defId];
  if (target !== undefined && channel !== undefined) {
    applyCommand(world, { type: 'triggerIncident', kind: 'outdated-firmware', targetDeviceId: target.id, latestVersion: channel });
    if (params.get('fwfix') === '1') {
      applyCommand(world, { type: 'updateFirmware', deviceId: target.id, version: channel });
    }
  }
}
// Let the ambient roll run while the clock advances (?fast=<ticks>).
const fast = Number(params.get('fast') ?? '');
if (Number.isInteger(fast) && fast > 0) advanceTicks(world, fast);

// ?records=1 opens the shop with every season closing pre-dismissed —
// reproduces the Season Records list for captures (runs after ?fast so the
// latest closing is what gets dismissed).
if (params.get('records') === '1') {
  shopOpen = true;
  selectedId = null;
  endgameDismissedTick = world.endgameTick ?? null;
}
// ?scorecard=<season> replays that season's scorecard over the open shop —
// reproduces the shop's replay overlay for captures.
const scorecardParam = Number(params.get('scorecard') ?? '');
if (Number.isInteger(scorecardParam) && scorecardParam > 0) {
  shopOpen = true;
  selectedId = null;
  scorecardSeason = scorecardParam;
}

// The delayed ?contract= signing (see above): after the clock advance so the
// term does not expire mid-capture, but before ?phishpay so the fake-invoice
// strikes land on the fresh contract.
if (contractParam !== null) {
  const offer = CONTRACT_OFFERS.find((o) => o.client.toLowerCase().startsWith(contractParam.toLowerCase()));
  const device = offer === undefined ? undefined : Object.values(world.devices).find((d) => d.kind === offer.requiresKind);
  if (offer !== undefined && device !== undefined) {
    applyCommand(world, { type: 'signContract', client: offer.client, deviceId: device.id });
  }
}

// ?poach=1 fires the rival ISP's season-close reaction at load — reproduces
// the poach letter for captures. Runs after ?contract= so there is a live
// contract to court; the 999 stands in for a strong scorecard. ?poamatch
// also accepts the deal, collapsing the letter to its matched outcome.
if (params.get('poach') === '1' || params.get('poamatch') === '1') {
  const letter = maybeRivalPoach(world, 999);
  if (params.get('poamatch') === '1' && letter !== undefined) {
    applyCommand(world, { type: 'mailAction', mailId: letter.id, command: letter.actions[0]!.command });
  }
}

// ?phishpay=mail-26,mail-28 pays those phishing letters at load — reproduces
// paid outcomes for captures. Runs after ?fast= so the letters exist.
const phishPayParam = params.get('phishpay');
if (phishPayParam !== null) {
  for (const id of phishPayParam.split(',')) {
    const mail = world.mail.find((m) => m.id === id.trim());
    if (mail !== undefined && mail.actions.some((a) => a.command === 'phish-pay')) {
      applyCommand(world, { type: 'mailAction', mailId: mail.id, command: 'phish-pay' });
    }
  }
}

// ?discard=<mailId,...> discards those letters at load — reproduces the
// discard folder for captures. Runs after ?fast= so the letters exist.
const discardParam = params.get('discard');
if (discardParam !== null) {
  for (const id of discardParam.split(',')) {
    applyCommand(world, { type: 'discardMail', mailId: id.trim() });
  }
}

// Resolved last, right before the first render, so a letter delivered by any
// param (?contract=, ?incident=, ?fast=) can be opened. ?openmail=<index>
// indexes world.mail; ?openmail=id:mail-15 matches by id, which stays valid
// no matter how many letters other params delivered.
if (openMailParam !== null) {
  const idMatch = /^id:(.+)$/.exec(openMailParam);
  const letter =
    idMatch !== null
      ? world.mail.find((m) => m.id === idMatch[1])
      : world.mail[Number(openMailParam)];
  if (letter !== undefined) openMailId = letter.id;
}

render();
