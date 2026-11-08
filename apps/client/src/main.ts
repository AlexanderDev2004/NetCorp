/**
 * The interactive Board editor.
 *
 * Every state change goes through sim Commands; the UI only renders state and
 * forwards input. Modes: select (click/drag, inspect), place (click to buy +
 * place from the catalog dropdown), wire (click two devices to link their
 * first free interfaces).
 */
import { applyCommand, createWorld, type Device, type World } from '@netcorp/sim';
import { CAREER_START, DEVICE_CATALOG, catalogAsRecord } from '@netcorp/data';

const world = createWorld(CAREER_START.seed, catalogAsRecord());
world.cash = CAREER_START.startingCash + 1000; // demo funds for the sandbox

const canvas = document.querySelector<HTMLCanvasElement>('#board');
const ctx = canvas === null ? null : canvas.getContext('2d');
const hint = document.querySelector<HTMLDivElement>('#hint');
const statsEl = document.querySelector<HTMLSpanElement>('#stats');
const inspectorEl = document.querySelector<HTMLDivElement>('#inspector');
const logEl = document.querySelector<HTMLDivElement>('#log');
const placeDef = document.querySelector<HTMLSelectElement>('#place-def');

if (canvas === null || ctx === null) throw new Error('board canvas missing');

// Fill the catalog dropdown.
for (const def of DEVICE_CATALOG) {
  const option = document.createElement('option');
  option.value = def.id;
  option.textContent = `${def.name} — $${def.price}`;
  placeDef?.append(option);
}

type Mode = 'select' | 'place' | 'wire';
let mode: Mode = 'select';
let selectedId: string | null = null;
let wireFromId: string | null = null;
let mouse = { x: 0, y: 0 };
let drag: { deviceId: string; dx: number; dy: number; moved: boolean } | null = null;

const KIND_COLORS: Record<string, string> = {
  'router-soho': '#7ee787',
  'router-edge': '#7ee787',
  firewall: '#ff6b6b',
  'switch-unmanaged': '#79c0ff',
  'switch-managed': '#79c0ff',
  'access-point': '#d2a8ff',
  desktop: '#e3b341',
  server: '#e3b341',
  printer: '#9fb0c3',
  ups: '#9fb0c3',
};

const MODE_HINTS: Record<Mode, string> = {
  select: 'Click a device to inspect · drag to move · Esc cancels',
  place: 'Click an empty spot to place the selected device',
  wire: 'Click device A, then device B — their first free interfaces are linked',
};

// ---- Command helpers ----

function run(command: Parameters<typeof applyCommand>[1]): void {
  applyCommand(world, command);
  render();
}

// ---- Rendering ----

function deviceBoxWidth(device: Device): number {
  if (ctx === null) return 110;
  ctx.font = '13px ui-monospace, monospace';
  return Math.max(110, ctx.measureText(device.name).width + 26);
}

function deviceAt(x: number, y: number): Device | undefined {
  return Object.values(world.devices).find((device) => {
    const half = deviceBoxWidth(device) / 2;
    return x >= device.x - half && x <= device.x + half && y >= device.y - 24 && y <= device.y + 24;
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
  ctx.clearRect(0, 0, width, height);

  // Links.
  ctx.strokeStyle = '#3b4354';
  ctx.lineWidth = 2;
  for (const link of world.links) {
    const a = world.devices[link.a.deviceId];
    const b = world.devices[link.b.deviceId];
    if (a === undefined || b === undefined) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Pending wire preview.
  if (mode === 'wire' && wireFromId !== null) {
    const from = world.devices[wireFromId];
    if (from !== undefined) {
      ctx.save();
      ctx.strokeStyle = '#7ee787';
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Devices.
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const device of Object.values(world.devices)) {
    const color = KIND_COLORS[device.kind] ?? '#8a93a5';
    const boxWidth = deviceBoxWidth(device);
    const selected = device.id === selectedId;
    const wireSource = device.id === wireFromId;

    ctx.fillStyle = '#1d212b';
    ctx.strokeStyle = selected ? '#ffffff' : wireSource ? '#7ee787' : color;
    ctx.lineWidth = selected || wireSource ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(device.x - boxWidth / 2, device.y - 24, boxWidth, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(device.name, device.x, device.y + 4);

    // Show the management IPv4 under the box if configured.
    const mgmt = device.interfaces.find((iface) => iface.ipv4 !== undefined)?.ipv4;
    if (mgmt !== undefined) {
      ctx.fillStyle = '#5a6372';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`${mgmt.address}/${mgmt.prefix}`, device.x, device.y + 38);
      ctx.font = '13px ui-monospace, monospace';
    }
  }
}

function renderStats(): void {
  if (statsEl === null) return;
  statsEl.innerHTML =
    `cash <b>$${world.cash}</b> · rep <b>${world.reputation}</b> · insight <b>${world.insight}</b>` +
    ` · tick ${world.tick} · devices ${Object.keys(world.devices).length}`;
}

function renderHint(): void {
  if (hint === null) return;
  let text = MODE_HINTS[mode];
  if (mode === 'wire' && wireFromId !== null) {
    text = `From ${world.devices[wireFromId]?.name ?? '?'} — click the destination device`;
  }
  hint.textContent = text;
}

function esc(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderInspector(): void {
  if (inspectorEl === null) return;
  const device = selectedId === null ? undefined : world.devices[selectedId];
  if (device === undefined) {
    inspectorEl.innerHTML = `<span class="muted">Nothing selected. ${esc(MODE_HINTS.select)}</span>`;
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
      return `
        <div class="iface">
          <div class="name">${esc(iface.name)} · ${esc(iface.kind)}${wired ? ' · wired' : ' · <span class="muted">free</span>'}</div>
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
          ${source !== '' ? `<div class="row muted">${source}</div>` : ''}
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
      const desc = [
        rule.srcCidr ?? '*',
        '→',
        rule.dstCidr ?? '*',
        rule.dstPort !== undefined ? `:${rule.dstPort}` : '',
        rule.protocol ?? '',
      ]
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
      <b>${esc(device.name)}</b>
      <span class="muted">${esc(device.kind)} · ${esc(device.firmware)}</span>
    </div>
    ${interfaces}
    <div class="row">
      <label>ping</label>
      <input class="wide ping-target" placeholder="target address" />
      <button class="ping-run">run</button>
    </div>
    <div class="row" style="margin-top:12px">
      <b>DHCP server</b>
    </div>
    ${pools || '<div class="muted">No pools — this device serves no addresses.</div>'}
    ${poolForm}
    <div class="row" style="margin-top:12px">
      <b>Firewall</b>
    </div>
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
    <div class="row" style="margin-top:12px">
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

function renderLog(): void {
  if (logEl === null) return;
  logEl.innerHTML = world.log
    .map((entry) => `<div class="${entry.level}"><span class="meta">[t${entry.tick}] ${esc(entry.source)}</span> ${esc(entry.text)}</div>`)
    .reverse()
    .join('');
}

function render(): void {
  drawBoard();
  renderStats();
  renderHint();
  renderInspector();
  renderLog();
  for (const id of ['mode-select', 'mode-wire', 'mode-place']) {
    const button = document.querySelector<HTMLButtonElement>(`#${id}`);
    if (button !== null) button.classList.toggle('active', id === `mode-${mode}`);
  }
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
      return; // run() re-renders
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
    } else if (!wasDrag && hit === undefined) {
      selectedId = null;
    }
    render();
    return;
  }

  if (mode === 'place') {
    if (hit === undefined) {
      const defId = placeDef?.value ?? '';
      const def = world.catalog[defId];
      if (def !== undefined) {
        run({ type: 'placeDevice', defId, name: `${def.kind}-${Object.keys(world.devices).length + 1}`, x: event.offsetX, y: event.offsetY });
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
      const to = hit;
      const aIface = from?.interfaces.find((iface) => isFree(from.id, iface.name));
      const bIface = to.interfaces.find((iface) => isFree(to.id, iface.name));
      if (from !== undefined && aIface !== undefined && bIface !== undefined) {
        run({
          type: 'wireLink',
          a: { deviceId: from.id, interfaceName: aIface.name },
          b: { deviceId: to.id, interfaceName: bIface.name },
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

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    wireFromId = null;
    setMode('select');
  }
  if (event.key === 'Delete' && selectedId !== null) {
    run({ type: 'deleteDevice', deviceId: selectedId });
    selectedId = null;
  }
});

// ---- Toolbar ----

function setMode(next: Mode): void {
  mode = next;
  if (next !== 'wire') wireFromId = null;
  render();
}

document.querySelector('#mode-select')?.addEventListener('click', () => setMode('select'));
document.querySelector('#mode-wire')?.addEventListener('click', () => setMode('wire'));
document.querySelector('#mode-place')?.addEventListener('click', () => setMode('place'));
placeDef?.addEventListener('change', () => setMode('place'));

window.addEventListener('resize', () => render());

// Seed the board with a small starter LAN.
run({ type: 'placeDevice', defId: 'router-soho', name: 'gw1', x: 420, y: 110 });
run({ type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 420, y: 300 });
run({ type: 'placeDevice', defId: 'desktop', name: 'cashier-pc', x: 220, y: 460 });
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
// ?select=<device name> preselects a device; ?mode=wire|place sets the mode;
// ?incident=rogue-dhcp&target=<name>&lease=<name> injects the incident, then
// makes the named device request a lease (the symptom appears on screen).
const params = new URLSearchParams(window.location.search);
const selectName = params.get('select');
if (selectName !== null) {
  const device = Object.values(world.devices).find((d) => d.name === selectName);
  if (device !== undefined) selectedId = device.id;
}
const modeParam = params.get('mode');
if (modeParam === 'wire' || modeParam === 'place') mode = modeParam;
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

render();
