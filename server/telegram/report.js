// Message builders + the "which lights are actually on" probe used by both the
// evening report and /status. Read-only on the bus (GroupValueRead).

import knxService from '../knx-service.js';
import { groupAddressesDb } from '../database.js';

// Escape the Markdown-significant chars that can appear in a device name.
export function esc(s) {
  return String(s == null ? '' : s).trim().replace(/([_*\[\]`])/g, '\\$1');
}

function isOnHex(hex) {
  if (!hex) return false;
  return (parseInt(hex, 16) & 0x01) === 1;
}

// Candidate lights (DB current_value = ON) in the given rooms, refined with a
// live GroupValueRead where possible. Hybrid policy: if a light answers the
// read we trust the live value (this drops a stale DB "on"); if it does NOT
// answer — which on this installation is every light, since they are mapped to
// command GAs that don't report state — we fall back to the DB value (the
// candidate, i.e. ON). Same fallback when the gateway is offline.
export async function getOnLights(roomIds) {
  const candidates = groupAddressesDb.lightsCurrentlyOn(roomIds);
  if (!knxService.isConnected()) return candidates; // can't verify => trust DB

  // Probe in small parallel batches: the reads are independent and each one
  // burns its full timeout for command GAs (which never answer), so doing
  // them serially would block /status and the report for ~14s. Concurrency is
  // kept under the EventEmitter default maxListeners (10).
  const CONCURRENCY = 6;
  const on = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (light) => {
      try {
        const r = await knxService.readGroupValue(light.address, 800);
        if (r.answered) return isOnHex(r.hex) ? light : null; // live truth; off => stale, drop
        return light; // no readable state => trust DB (it said ON)
      } catch {
        return light; // read errored => trust DB
      }
    }));
    for (const x of results) if (x) on.push(x);
  }
  return on;
}

// Build the report / status payload (text + inline keyboard) for a list of
// on-lights. Shared shape so the evening cron and /status look identical.
export function buildReportMessage(lights) {
  const header = `💡 *${lights.length} ${lights.length === 1 ? 'luce ancora accesa' : 'luci ancora accese'}:*`;
  const body = lights.map((l) => `• ${esc(l.name)}`).join('\n');
  const text = `${header}\n${body}`;

  const inline_keyboard = lights.map((l) => [
    { text: `💡 Spegni ${l.name.trim()}`, callback_data: `off:${l.address}` }
  ]);
  inline_keyboard.push([
    { text: 'Spegni tutte', callback_data: 'off_all' },
    { text: 'Ignora', callback_data: 'cancel' }
  ]);

  return { text, reply_markup: { inline_keyboard } };
}

// /status — render the currently-on lights (hybrid live/DB). When the gateway
// is offline we still show the last-known DB state with a note.
export async function buildStatusMessage(roomIds) {
  const on = await getOnLights(roomIds);
  if (on.length === 0) {
    return { text: '🌙 Nessuna luce d’ufficio risulta accesa al momento.' };
  }
  const msg = buildReportMessage(on);
  if (!knxService.isConnected()) {
    msg.text = `⚠️ _Gateway offline — stato dal DB_\n${msg.text}`;
  }
  return msg;
}

// /list — every configured light, grouped by room, with last-known state.
export function buildListMessage() {
  const lights = groupAddressesDb.configuredLights();
  if (lights.length === 0) {
    return { text: 'Nessuna luce configurata.' };
  }
  const byRoom = new Map();
  for (const l of lights) {
    const room = l.room_name || 'Senza stanza';
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push(l);
  }
  const sections = [];
  for (const [room, arr] of byRoom) {
    const lines = arr
      .map((l) => {
        const on = l.current_value === 'true' || l.current_value === '1';
        return `${on ? '🟢' : '⚪'} ${esc(l.name)}`;
      })
      .join('\n');
    sections.push(`*${esc(room)}*\n${lines}`);
  }
  return {
    text: `💡 *Luci configurate (${lights.length})*\n\n${sections.join('\n\n')}`
  };
}
