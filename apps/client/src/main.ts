/**
 * The interactive Board editor, styled after Quorum (playquorum.dev):
 * HUD top-left, toolbar top-right, build dock at the bottom, a round Inbox
 * button bottom-right, and floating Inspector / Tickets panels.
 *
 * Every state change goes through sim Commands; the UI only renders state and
 * forwards input. Modes: select (click/drag, inspect), place (click to buy +
 * place the dock selection), wire (click two devices to link their first free
 * interfaces).
 */
import { advanceTicks, applyCommand, createWorld, type Device, type World } from '@netcorp/sim';
import { CAREER_START, DEVICE_CATALOG, catalogAsRecord } from '@netcorp/data';

const world = createWorld(CAREER_START.seed, catalogAsRecord());
world.cash = CAREER_START.startingCash + 1000; // demo funds for the sandbox

const canvas = document.querySelector<HTMLCanvasElement>('#board');
const ctx = canvas === null ? null : canvas.getContext('2d');
const hintEl = document.querySelector<HTMLDivElement>('#hint');
const toastEl = document.querySelector<HTMLDivElement>('#toast');
const logEl = document.querySelector<HTMLDivElement>('#log-panel');
const inspectorPanel = document.querySelector<HTMLDivElement>('#inspector-panel');
const inspectorEl = document.querySelector<HTMLDivElement>('#inspector');
const ticketsPanel = document.querySelector<HTMLDivElement>('#tickets-panel');
const dockEl = document.querySelector<HTMLDivElement>('#dock');
const inboxBtn = document.querySelector<HTMLButtonElement>('#inbox-btn');

if (canvas === null || ctx === null) throw new Error('board canvas missing');

type Mode = 'select' | 'place' | 'wire';
let mode: Mode = 'select';
let selectedDefId: string | null = DEVICE_CATALOG[0]?.id ?? null;
let selectedId: string | null = null;
let wireFromId: string | null = null;
let ticketsOpen = false;
let clockRunning = false;
let mouse = { x: 0, y: 0 };
let drag: { deviceId: string; dx: number; dy: number; moved: boolean } | null = null;

/* Quorum palette (from playquorum.dev source). */
const C = {
  bg: '#0c0c0d',
  grid: 'oklch(1 0 0 / 0.03)',
  cableEdge: '#7a818c',
  cable: '#2b2e33',
  panel: '#18191c',
  ink: '#eaebec',
  muted: '#8b9099',
  signal: 'oklch(0.8 0.12 225)',
  danger: '#e5484d',
  warn: '#f0b429',
};

/** Small accent per device kind, shown as a dot on the node card. */
const KIND_ACCENTS: Record<string, string> = {
  'router-soho': 'oklch(0.8 0.14 145)',
  'router-edge': 'oklch(0.8 0.14 145)',
  firewall: 'oklch(0.68 0.19 25)',
  'switch-unmanaged': C.signal,
  'switch-managed': C.signal,
  'access-point': 'oklch(0.75 0.14 300)',
  desktop: 'oklch(0.8 0.13 85)',
  server: 'oklch(0.8 0.13 85)',
  printer: C.muted,
  ups: C.muted,
};

const MODE_HINTS: Record<Mode, string> = {
  select: 'click a node to inspect · drag to move · esc closes',
  place: 'click the board to place the dock selection',
  wire: 'click node A, then node B — first free ports are linked',
};

// ---- Build dock ----

if (dockEl !== null) {
  for (const def of DEVICE_CATALOG) {
    const button = document.createElement('button');
    button.dataset.def = def.id;
    button.innerHTML = `<span>${def.name}</span><span class="price">$${def.price}</span>`;
    button.addEventListener('click', () => {
      selectedDefId = def.id;
      setMode('place');
    });
    dockEl.append(button);
  }
}

// ---- Command helpers ----

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

// ---- Board rendering ----

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

  // Cables: dark core with a lighter edge, like the hero art.
  for (const link of world.links) {
    const a = world.devices[link.a.deviceId];
    const b = world.devices[link.b.deviceId];
    if (a === undefined || b === undefined) continue;
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.cableEdge;
    ctx.lineWidth = 5.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = C.cable;
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

    ctx.font = "500 12.5px 'Geist Mono', ui-monospace, monospace";
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = selected ? C.signal : wireSource ? C.signal : 'oklch(1 0 0 / 0.12)';
    ctx.lineWidth = selected || wireSource ? 1.6 : 1;
    ctx.beginPath();
    ctx.roundRect(device.x - boxWidth / 2, device.y - 26, boxWidth, 52, 10);
    ctx.fill();
    ctx.stroke();

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

// ---- Panels ----

function renderHud(): void {
  const cash = document.querySelector<HTMLSpanElement>('#hud-cash');
  const rep = document.querySelector<HTMLSpanElement>('#hud-rep');
  const insight = document.querySelector<HTMLSpanElement>('#hud-insight');
  const devices = document.querySelector<HTMLSpanElement>('#hud-devices');
  const calendar = document.querySelector<HTMLSpanElement>('#hud-calendar');
  if (cash !== null) {
    cash.textContent = `$${world.cash}`;
    cash.classList.toggle('bad', world.cash < 0);
    cash.classList.toggle('signal', world.cash >= 0);
  }
  if (rep !== null) {
    rep.textContent = String(world.reputation);
    rep.classList.toggle('bad', world.reputation < 0);
  }
  if (insight !== null) insight.textContent = String(world.insight);
  if (devices !== null) devices.textContent = String(Object.keys(world.devices).length);
  if (calendar !== null) {
    const day = Math.floor(world.tick / 24) + 1;
    const hour = world.tick % 24;
    calendar.textContent = `D${day} ${String(hour).padStart(2, '0')}:00`;
  }
}

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderInspector(): void {
  if (inspectorPanel === null || inspectorEl === null) return;
  const device = selectedId === null ? undefined : world.devices[selectedId];
  inspectorPanel.classList.toggle('open', device !== undefined);
  if (device === undefined) return;

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
      return `
        <div class="iface">
          <div class="name">${esc(iface.name)} · ${esc(iface.kind)}${wired ? ' · wired' : ' · free'}</div>
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

  inspectorEl.innerHTML = `
    <div class="row">
      <span class="muted">${esc(device.kind)} · ${esc(device.firmware)}</span>
    </div>
    ${interfaces}
    <div class="row">
      <label>ping</label>
      <input class="wide ping-target" placeholder="target address" />
      <button class="ping-run">run</button>
    </div>
    <div class="section">DHCP server</div>
    ${pools || '<div class="muted">No pools — this device serves no addresses.</div>'}
    ${poolForm}
    <div class="section">Firewall</div>
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
    </div>
    <div class="row" style="margin-top:14px">
      <button class="danger device-delete">delete device</button>
    </div>
  `;

  bindInspector(device);
}

function bindInspector(device: Device): void {
  if (inspectorEl === null) return;

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

function renderTickets(): void {
  const ticketsEl = document.querySelector<HTMLDivElement>('#tickets');
  const badge = document.querySelector<HTMLSpanElement>('#ticket-badge');
  const openCount = world.tickets.filter((t) => t.status === 'open');
  if (badge !== null) badge.textContent = String(openCount.length);
  if (inboxBtn !== null) {
    // Quorum's Inbox: badge turns red and the button pulses when action waits.
    inboxBtn.classList.toggle('has-action', openCount.some((t) => t.breached));
  }
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

function renderLog(): void {
  if (logEl === null) return;
  const recent = world.log.slice(-6);
  logEl.innerHTML = recent
    .map((entry) => `<div class="log-line ${entry.level}"><span class="meta">[t${entry.tick}]</span> ${esc(entry.text)}</div>`)
    .join('');
}

function renderHint(): void {
  if (hintEl === null) return;
  let text = MODE_HINTS[mode];
  if (mode === 'wire' && wireFromId !== null) {
    text = `from ${world.devices[wireFromId]?.name ?? '?'} — click the destination`;
  }
  hintEl.textContent = text;
}

function render(): void {
  drawBoard();
  renderHud();
  renderInspector();
  renderTickets();
  renderLog();
  renderHint();

  if (dockEl !== null) {
    for (const button of dockEl.querySelectorAll<HTMLButtonElement>('button[data-def]')) {
      button.classList.toggle('active', mode === 'place' && button.dataset.def === selectedDefId);
    }
  }
  for (const id of ['mode-select', 'mode-wire', 'mode-place']) {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);
    if (button !== null) button.classList.toggle('active', id === `mode-${mode}`);
  }
  const clockButton = document.querySelector<HTMLButtonElement>('#clock');
  if (clockButton !== null) clockButton.textContent = clockRunning ? 'Pause' : 'Run';
  if (ticketsPanel !== null) ticketsPanel.classList.toggle('open', ticketsOpen);
}

// ---- Canvas input ----

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
      ticketsOpen = false;
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

// ---- Toolbar, dock, panels, keys ----

function setMode(next: Mode): void {
  mode = next;
  if (next !== 'wire') wireFromId = null;
  if (next !== 'select') selectedId = null;
  render();
}

document.querySelector('#mode-select')?.addEventListener('click', () => setMode('select'));
document.querySelector('#mode-wire')?.addEventListener('click', () => setMode('wire'));
document.querySelector('#mode-place')?.addEventListener('click', () => setMode('place'));
document.querySelector('#inspector-close')?.addEventListener('click', () => {
  selectedId = null;
  render();
});
inboxBtn?.addEventListener('click', () => {
  ticketsOpen = !ticketsOpen;
  if (ticketsOpen) selectedId = null;
  render();
});
document.querySelector('#tickets-close')?.addEventListener('click', () => {
  ticketsOpen = false;
  render();
});

const clockButton = document.querySelector<HTMLButtonElement>('#clock');
clockButton?.addEventListener('click', () => {
  clockRunning = !clockRunning;
  render();
});
window.setInterval(() => {
  if (!clockRunning) return;
  advanceTicks(world, 1);
  render();
}, 500);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 's') setMode('select');
  if (key === 'w') setMode('wire');
  if (key === 'p') setMode('place');
  if (key === 't') {
    ticketsOpen = !ticketsOpen;
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
    ticketsOpen = false;
    setMode('select');
  }
  if (key === 'delete' && selectedId !== null) {
    run({ type: 'deleteDevice', deviceId: selectedId });
    selectedId = null;
  }
});

window.addEventListener('resize', () => render());

// Seed the board with a small starter LAN.
run({ type: 'placeDevice', defId: 'router-soho', name: 'gw1', x: 480, y: 180 });
run({ type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 480, y: 360 });
run({ type: 'placeDevice', defId: 'desktop', name: 'cashier-pc', x: 260, y: 540 });
run({
  type: 'wireLink',
  a: { deviceId: Object.keys(world.devices)[0] ?? '', interfaceName: 'eth0' },
  b: { deviceId: Object.keys(world.devices)[1] ?? '', interfaceName: 'eth0' },
});
run({
  type: 'wireLink',
  a: { deviceId: Object.keys(world.devices)[1] ?? '', interfaceName: 'eth1' },
  b: { deviceId: Object.keys(world.devices)[2] ?? '', interfaceName: 'eth0' },
});
run({ type: 'setIpv4', deviceId: Object.keys(world.devices)[0] ?? '', interfaceName: 'eth0', address: '192.168.10.1', prefix: 24 });
run({ type: 'setIpv4', deviceId: Object.keys(world.devices)[2] ?? '', interfaceName: 'eth0', address: '192.168.10.50', prefix: 24 });

// Dev affordance: URL params reproduce UI states for captures/tests.
// ?select=<name>, ?mode=wire|place, ?tab=tickets, ?clock=run,
// ?incident=rogue-dhcp&target=<name>&lease=<name>, ?fast=<ticks>
const params = new URLSearchParams(window.location.search);
const selectName = params.get('select');
if (selectName !== null) {
  const device = Object.values(world.devices).find((d) => d.name === selectName);
  if (device !== undefined) selectedId = device.id;
}
const modeParam = params.get('mode');
if (modeParam === 'wire' || modeParam === 'place') mode = modeParam;
if (params.get('tab') === 'tickets') ticketsOpen = true;
if (params.get('clock') === 'run') clockRunning = true;
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
const fast = Number(params.get('fast') ?? '');
if (Number.isInteger(fast) && fast > 0) advanceTicks(world, fast);

render();
