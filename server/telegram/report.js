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

// Candidate lights (DB says ON) in the given rooms, each verified with a live
// GroupValueRead. Excludes ones the gateway doesn't answer for (unknown state)
// and ones that answer OFF (stale DB value). Returns the verified-on list.
export async function getOnLights(roomIds) {
  const candidates = groupAddressesDb.lightsCurrentlyOn(roomIds);
  const on = [];
  for (const light of candidates) {
    if (!knxService.isConnected()) break;
    try {
      const r = await knxService.readGroupValue(light.address, 800);
      if (r.answered && isOnHex(r.hex)) on.push(light);
    } catch {
      // ignore a single failed probe
    }
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

// /status — verify live and render. Empty => a friendly note (no buttons).
export async function buildStatusMessage(roomIds) {
  if (!knxService.isConnected()) {
    return { text: '⚠️ Gateway KNX offline, stato non disponibile.' };
  }
  const on = await getOnLights(roomIds);
  if (on.length === 0) {
    return { text: '🌙 Nessuna luce d’ufficio risulta accesa al momento.' };
  }
  return buildReportMessage(on);
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
