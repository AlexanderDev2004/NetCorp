/**
 * Client bootstrap stub: boots the sim, builds a small demo LAN through
 * Commands only (the UI never mutates state directly), and renders the Board
 * plus the event log. The real editor replaces this, but the data flow shown
 * here — Command in, Events out, draw state — is the whole architecture.
 */
import { applyCommand, advanceTicks, createWorld, type Device, type World } from '@netcorp/sim';
import { CAREER_START, catalogAsRecord } from '@netcorp/data';

const world = createWorld(CAREER_START.seed, catalogAsRecord());
// The demo LAN below costs more than the Garage start; grant demo funds so
// every device type renders. The real game starts at $400 with no grant.
world.cash = CAREER_START.startingCash + 1000;

// A demo LAN through commands only.
applyCommand(world, { type: 'placeDevice', defId: 'router-soho', name: 'gw1', x: 420, y: 90 });
applyCommand(world, { type: 'placeDevice', defId: 'switch-unmanaged', name: 'sw1', x: 420, y: 280 });
applyCommand(world, { type: 'placeDevice', defId: 'desktop', name: 'cashier-pc', x: 200, y: 430 });
applyCommand(world, { type: 'placeDevice', defId: 'printer', name: 'front-desk-printer', x: 640, y: 430 });

const gw = find(world, 'gw1');
const sw = find(world, 'sw1');
const pc = find(world, 'cashier-pc');
const pr = find(world, 'front-desk-printer');

if (gw && sw && pc) {
  applyCommand(world, { type: 'wireLink', a: { deviceId: gw.id, interfaceName: 'eth0' }, b: { deviceId: sw.id, interfaceName: 'eth0' } });
  applyCommand(world, { type: 'wireLink', a: { deviceId: sw.id, interfaceName: 'eth1' }, b: { deviceId: pc.id, interfaceName: 'eth0' } });
  if (pr !== undefined) {
    applyCommand(world, { type: 'wireLink', a: { deviceId: sw.id, interfaceName: 'eth2' }, b: { deviceId: pr.id, interfaceName: 'eth0' } });
    applyCommand(world, { type: 'setIpv4', deviceId: pr.id, interfaceName: 'eth0', address: '192.168.10.60', prefix: 24 });
  }
  applyCommand(world, { type: 'setIpv4', deviceId: gw.id, interfaceName: 'eth0', address: '192.168.10.1', prefix: 24 });
  applyCommand(world, { type: 'setIpv4', deviceId: pc.id, interfaceName: 'eth0', address: '192.168.10.50', prefix: 24 });
  applyCommand(world, { type: 'ping', fromDevice: pc.id, toAddress: '192.168.10.1' });
}

advanceTicks(world, 5);

function find(world: World, name: string): Device | undefined {
  return Object.values(world.devices).find((d) => d.name === name);
}

// ---- Rendering (canvas stub; the real editor replaces this) ----

const canvas = document.querySelector<HTMLCanvasElement>('#board');
const ctx = canvas === null ? null : canvas.getContext('2d');

const KIND_COLORS: Record<string, string> = {
  'router-soho': '#7ee787',
  'router-edge': '#7ee787',
  firewall: '#ff6b6b',
  'switch-unmanaged': '#79c0ff',
  'switch-managed': '#79c0ff',
  'access-point': '#d2a8ff',
  desktop: '#e3b341',
  server: '#e3b341',
  printer: '#8a93a5',
  ups: '#8a93a5',
};

function drawBoard(): void {
  if (canvas === null || ctx === null) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const device of Object.values(world.devices)) {
    const color = KIND_COLORS[device.kind] ?? '#8a93a5';
    const labelWidth = ctx.measureText(device.name).width;
    const boxWidth = Math.max(110, labelWidth + 26);
    ctx.fillStyle = '#1d212b';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(device.x - boxWidth / 2, device.y - 24, boxWidth, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(device.name, device.x, device.y + 4);
  }
}

function drawPanel(): void {
  const stats = document.querySelector<HTMLDivElement>('#stats');
  if (stats !== null) {
    stats.innerHTML =
      `cash <b>$${world.cash}</b> · reputation <b>${world.reputation}</b> · insight <b>${world.insight}</b>` +
      `<br>tick ${world.tick} · devices ${Object.keys(world.devices).length} · links ${world.links.length}`;
  }
  const logEl = document.querySelector<HTMLDivElement>('#log');
  if (logEl !== null) {
    logEl.innerHTML = world.log
      .map((entry) => `<div class="${entry.level}"><span class="meta">[t${entry.tick}] ${entry.source}</span> ${entry.text}</div>`)
      .reverse()
      .join('');
  }
}

drawBoard();
drawPanel();
