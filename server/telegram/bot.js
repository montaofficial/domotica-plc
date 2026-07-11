// Message + callback handlers for the Telegram bot. All async handlers are
// wrapped so a thrown error can never kill the long-polling loop.

import knxService from '../knx-service.js';
import { groupAddressesDb } from '../database.js';
import { parseIntent, buildMatchers } from './intent.js';
import { buildStatusMessage, buildListMessage, buildReportMessage, esc } from './report.js';

const OFFLINE_MSG = '⚠️ Gateway KNX offline, riprova tra qualche istante';
const STATE_TTL_MS = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In-process, per-chat pending action (confirm / disambiguate). Lazily GC'd.
const pendingState = new Map();
let nonceCounter = 0;

function setState(chatId, value) {
  const now = Date.now();
  for (const [k, v] of pendingState) if (v.expiresAt < now) pendingState.delete(k);
  // Each pending state gets a fresh nonce. Inline buttons carry it, so a tap on
  // a stale keyboard (the user reformulated, overwriting the per-chat state)
  // is rejected instead of resolving its index against the new options — which
  // could otherwise actuate the wrong device.
  const nonce = String(++nonceCounter);
  pendingState.set(Number(chatId), { ...value, nonce, expiresAt: now + STATE_TTL_MS });
  return nonce;
}
function getState(chatId) {
  const v = pendingState.get(Number(chatId));
  if (!v) return null;
  if (v.expiresAt < Date.now()) { pendingState.delete(Number(chatId)); return null; }
  return v;
}
function clearState(chatId) { pendingState.delete(Number(chatId)); }

// --- dataset & helpers ----------------------------------------------------

function getDataset(config) {
  const lights = groupAddressesDb.configuredLights().map((l) => ({
    kind: 'light',
    name: l.name.trim(),
    address: l.address,
    room_name: l.room_name,
    room_id: l.room_id,
    current_value: l.current_value
  }));
  const roomMap = new Map();
  for (const l of lights) {
    if (config.officeRoomIds.includes(l.room_id) && !roomMap.has(l.room_id)) {
      roomMap.set(l.room_id, { kind: 'room', name: l.room_name, id: l.room_id });
    }
  }
  return { lights, rooms: [...roomMap.values()] };
}

function lightByAddress(addr) {
  return groupAddressesDb.configuredLights().find((l) => l.address === addr);
}

function boolFor(verb, light) {
  if (verb === 'on') return true;
  if (verb === 'off') return false;
  return !(light.current_value === 'true' || light.current_value === '1');
}
function pastWord(bool) { return bool ? 'Acceso' : 'Spento'; }

async function executeSingle(verb, light) {
  if (!knxService.isConnected()) return { offline: true };
  const bool = boolFor(verb, light);
  try {
    knxService.write(light.address, bool, 'DPT1.001');
  } catch (e) {
    console.error('[Telegram] write failed for', light.address, e?.message || e);
    return { offline: true };
  }
  return { ok: true, bool, name: (light.name || '').trim() };
}

async function executeMulti(verb, lights) {
  if (!knxService.isConnected()) return { offline: true };
  const done = [];
  for (const l of lights) {
    const bool = boolFor(verb, l);
    try {
      knxService.write(l.address, bool, 'DPT1.001');
      done.push((l.name || '').trim());
    } catch (e) {
      console.error('[Telegram] write failed for', l.address, e?.message || e);
    }
    await sleep(50);
  }
  return { ok: true, count: done.length, names: done };
}

// --- registration ---------------------------------------------------------

export function registerHandlers({ bot, config, auth }) {
  const send = async (chatId, payload, extra = {}) => {
    const { text, reply_markup } = payload;
    try {
      return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup, ...extra });
    } catch (e) {
      // Markdown can trip on odd content — retry as plain text.
      try { return await bot.sendMessage(chatId, text, { reply_markup, ...extra }); }
      catch (e2) { console.error('[Telegram] send failed:', e2?.message || e2); }
    }
  };

  const wrap = (fn) => (...args) => {
    Promise.resolve(fn(...args)).catch((e) =>
      console.error('[Telegram] handler error:', e?.message || e));
  };

  bot.on('message', wrap((msg) => handleMessage(msg)));
  bot.on('callback_query', wrap((q) => handleCallback(q)));
  bot.on('polling_error', (e) =>
    console.error('[Telegram] polling error:', e?.code || '', e?.message || e));

  // --- message routing ---
  async function handleMessage(msg) {
    const chatId = msg.chat?.id;
    if (!auth.isAllowed(chatId)) {
      console.log(`[Telegram] ignored msg from ${chatId}`);
      return;
    }
    const text = (msg.text || '').trim();
    if (!text) return;
    if (text.startsWith('/')) return handleCommand(chatId, text);
    return handleFreeText(chatId, text);
  }

  async function handleCommand(chatId, text) {
    const [rawCmd, ...rest] = text.split(/\s+/);
    const cmd = rawCmd.toLowerCase().replace(/@.*$/, '');
    const args = rest.join(' ').trim();

    switch (cmd) {
      case '/start':
      case '/help':
        return send(chatId, { text: helpText() });
      case '/ping':
        return send(chatId, { text: 'pong' });
      case '/status':
        return send(chatId, await buildStatusMessage(config.officeRoomIds));
      case '/list':
        return send(chatId, buildListMessage());
      case '/off':
        if (!args) return send(chatId, { text: 'Uso: /off <nome luce>' });
        return handleFreeText(chatId, `spegni ${args}`);
      case '/on':
        if (!args) return send(chatId, { text: 'Uso: /on <nome luce>' });
        return handleFreeText(chatId, `accendi ${args}`);
      case '/toggle':
        if (!args) return send(chatId, { text: 'Uso: /toggle <nome luce>' });
        return handleFreeText(chatId, `toggle ${args}`);
      case '/all_off':
        return handleAllOff(chatId, args);
      default:
        return send(chatId, { text: 'Comando sconosciuto. Scrivi /help.' });
    }
  }

  async function handleFreeText(chatId, text) {
    const dataset = getDataset(config);
    const matchers = buildMatchers(dataset.lights, dataset.rooms);
    const intent = parseIntent(text, matchers);

    if (intent.type === 'status') {
      return send(chatId, await buildStatusMessage(config.officeRoomIds));
    }

    const { verb, residue, all, lightResults, roomResults } = intent;
    if (!verb) {
      return send(chatId, { text: 'Vuoi accendere o spegnere? Es: "spegni sala riunioni".' });
    }

    const validLights = lightResults.filter((r) => r.score <= 0.4);
    const validRooms = roomResults.filter((r) => r.score <= 0.4);
    const bestLight = validLights[0];
    const bestRoom = validRooms[0];

    // A strong, explicit room match wins — e.g. "spegni tutte le luci di
    // industries" means that room, even though "tutte" also looks like "all".
    if (bestRoom && bestRoom.score < 0.3) {
      return roomAction(chatId, verb, bestRoom.item, dataset);
    }

    // "accendi/spegni tutto" → every configured light, no confirmation.
    if (all) {
      return allAction(chatId, verb, dataset);
    }

    if (!residue) {
      return send(chatId, { text: 'Quale luce o stanza? Es: "accendi ufficio alex", "spegni tutto".' });
    }

    // 0 useful matches → suggestions (nearest neighbours, any score).
    if (!bestLight && !bestRoom) {
      return suggest(chatId, verb, text, lightResults, roomResults);
    }

    // Confident single light.
    if (bestLight && bestLight.score < 0.3) {
      const res = await executeSingle(verb, bestLight.item);
      if (res.offline) return send(chatId, { text: OFFLINE_MSG });
      return send(chatId, { text: `✓ ${pastWord(res.bool)}: ${esc(res.name)}` });
    }

    // A room is the best remaining signal → room action.
    if (bestRoom && (!bestLight || bestRoom.score <= bestLight.score)) {
      return roomAction(chatId, verb, bestRoom.item, dataset);
    }

    // Uncertain light(s) in the 0.3..0.4 band → disambiguate.
    return disambiguate(chatId, verb, validLights.slice(0, 3).map((r) => r.item));
  }

  // Whole-installation command: every configured light, executed directly.
  async function allAction(chatId, verb, dataset) {
    const lights = dataset.lights;
    if (lights.length === 0) return send(chatId, { text: 'Nessuna luce configurata.' });
    const res = await executeMulti(verb, lights);
    if (res.offline) return send(chatId, { text: OFFLINE_MSG });
    const v = verb === 'on' ? 'accese' : verb === 'off' ? 'spente' : 'invertite';
    return send(chatId, { text: `✓ ${res.count} luci → ${v}.` });
  }

  // Room command — executed directly, no confirmation (per user preference).
  async function roomAction(chatId, verb, room, dataset) {
    const lights = dataset.lights.filter((l) => l.room_id === room.id);
    if (lights.length === 0) {
      return send(chatId, { text: `Nessuna luce configurata in ${esc(room.name)}.` });
    }
    const res = await executeMulti(verb, lights);
    if (res.offline) return send(chatId, { text: OFFLINE_MSG });
    return send(chatId, { text: `✓ ${res.count} luci di ${esc(room.name)} → ${verb === 'on' ? 'accese' : verb === 'off' ? 'spente' : 'invertite'}.` });
  }

  // /all_off — executed directly, no confirmation.
  async function handleAllOff(chatId, roomArg) {
    const dataset = getDataset(config);
    let lights = dataset.lights;
    let label = 'ufficio';
    if (roomArg) {
      const { roomFuse } = buildMatchers(dataset.lights, dataset.rooms);
      const m = roomFuse.search(roomArg).filter((r) => r.score <= 0.4)[0];
      if (!m) return send(chatId, { text: `Stanza "${esc(roomArg)}" non trovata.` });
      label = m.item.name;
      lights = dataset.lights.filter((l) => l.room_id === m.item.id);
    }
    if (lights.length === 0) return send(chatId, { text: 'Nessuna luce da spegnere.' });
    const res = await executeMulti('off', lights);
    if (res.offline) return send(chatId, { text: OFFLINE_MSG });
    return send(chatId, { text: `✓ ${res.count} luci di ${esc(label)} spente.` });
  }

  function disambiguate(chatId, verb, options) {
    if (options.length === 0) return send(chatId, { text: 'Nessuna corrispondenza.' });
    const nonce = setState(chatId, { kind: 'disambiguate', verb, options });
    const inline_keyboard = options.map((o, i) => [
      { text: o.name.trim(), callback_data: `dis:${nonce}:${i}` }
    ]);
    inline_keyboard.push([{ text: '✖️ Annulla', callback_data: 'cancel' }]);
    return send(chatId, { text: 'Quale intendi?', reply_markup: { inline_keyboard } });
  }

  function suggest(chatId, verb, originalText, lightResults, roomResults) {
    const pool = [
      ...lightResults.map((r) => ({ ...r, kind: 'light' })),
      ...roomResults.map((r) => ({ ...r, kind: 'room' }))
    ].sort((a, b) => a.score - b.score).slice(0, 3);

    if (pool.length === 0) {
      return send(chatId, { text: `Non ho capito "${esc(originalText)}". Prova con /list.` });
    }
    const nonce = setState(chatId, { kind: 'disambiguate', verb, options: pool.map((p) => p.item) });
    const inline_keyboard = pool.map((p, i) => [
      { text: `${p.kind === 'room' ? '🏠 ' : ''}${p.item.name.trim()}`, callback_data: `dis:${nonce}:${i}` }
    ]);
    inline_keyboard.push([{ text: '✖️ Annulla', callback_data: 'cancel' }]);
    return send(chatId, {
      text: `Non ho capito "${esc(originalText)}". Hai forse detto:`,
      reply_markup: { inline_keyboard }
    });
  }

  // --- callbacks ---
  async function handleCallback(q) {
    const chatId = q.message?.chat?.id;
    const messageId = q.message?.message_id;
    const data = q.data || '';
    if (!auth.isAllowed(chatId)) {
      console.log(`[Telegram] ignored callback from ${chatId}`);
      try { await bot.answerCallbackQuery(q.id); } catch {}
      return;
    }

    const ack = (text) => bot.answerCallbackQuery(q.id, text ? { text } : undefined).catch(() => {});
    const editMarkup = (kb) =>
      bot.editMessageReplyMarkup({ inline_keyboard: kb }, { chat_id: chatId, message_id: messageId }).catch(() => {});
    const editText = (text) =>
      bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }).catch(() => {});

    try {
      if (data === 'cancel') {
        clearState(chatId);
        await ack('Annullato');
        return editText('✖️ Annullato.');
      }

      if (data.startsWith('off:') || data.startsWith('on:')) {
        const [verb, addr] = data.split(':');
        const light = lightByAddress(addr);
        if (!light) { return ack('Luce non trovata'); }
        const res = await executeSingle(verb, light);
        if (res.offline) { return ack('Gateway offline'); }
        await ack(`${pastWord(res.bool)}: ${res.name}`);
        // Remove this light's button from the original message.
        const kb = removeButtonsFor(q.message?.reply_markup, addr);
        if (kb && kb.length) return editMarkup(kb);
        return editText('✓ Fatto.');
      }

      if (data === 'off_all') {
        const lights = groupAddressesDb.lightsCurrentlyOn(config.officeRoomIds);
        const res = await executeMulti('off', lights);
        if (res.offline) return ack('Gateway offline');
        await ack(`Spente ${res.count} luci`);
        return editText(`✓ Spente ${res.count} luci d’ufficio.`);
      }

      if (data.startsWith('off_room:')) {
        const roomId = data.slice('off_room:'.length);
        const lights = groupAddressesDb.configuredLights().filter((l) => l.room_id === roomId);
        const res = await executeMulti('off', lights);
        if (res.offline) return ack('Gateway offline');
        await ack(`Spente ${res.count} luci`);
        return editText(`✓ Spente ${res.count} luci.`);
      }

      if (data === 'confirm') {
        const st = getState(chatId);
        if (!st || st.kind !== 'confirm') { await ack('Scaduto'); return editText('⏱️ Conferma scaduta.'); }
        clearState(chatId);
        const res = await executeMulti(st.verb, st.lights);
        if (res.offline) return ack('Gateway offline');
        await ack(`Fatto (${res.count})`);
        const v = st.verb === 'on' ? 'accese' : st.verb === 'off' ? 'spente' : 'invertite';
        return editText(`✓ ${res.count} luci di ${esc(st.label)} → ${v}.`);
      }

      if (data.startsWith('dis:')) {
        // Format: dis:<nonce>:<idx>
        const parts = data.split(':');
        const nonce = parts[1];
        const idx = Number(parts[2]);
        const st = getState(chatId);
        if (!st || st.kind !== 'disambiguate' || st.nonce !== nonce || !st.options[idx]) {
          await ack('Scaduto');
          return editText('⏱️ Scelta scaduta o non più valida.');
        }
        clearState(chatId);
        const opt = st.options[idx];
        if (opt.kind === 'room') {
          await ack();
          const dataset = getDataset(config);
          return roomAction(chatId, st.verb, opt, dataset);
        }
        const res = await executeSingle(st.verb, opt);
        if (res.offline) return ack('Gateway offline');
        await ack(`${pastWord(res.bool)}: ${res.name}`);
        return editText(`✓ ${pastWord(res.bool)}: ${esc(res.name)}`);
      }

      return ack();
    } catch (e) {
      console.error('[Telegram] callback error:', e?.message || e);
      return ack('Errore');
    }
  }
}

// Rebuild an inline keyboard without the row(s) targeting a given address.
function removeButtonsFor(reply_markup, addr) {
  const kb = reply_markup?.inline_keyboard;
  if (!kb) return null;
  const filtered = kb.filter((row) =>
    !row.some((b) => b.callback_data === `off:${addr}` || b.callback_data === `on:${addr}`));
  // Drop a lone control row ([Spegni tutte][Ignora]) if no lights remain.
  const lightRowsLeft = filtered.some((row) =>
    row.some((b) => typeof b.callback_data === 'string' && /^(off|on):/.test(b.callback_data)));
  return lightRowsLeft ? filtered : [];
}

function helpText() {
  return [
    '🤖 *Domotica PLC*',
    '',
    'Scrivimi in linguaggio naturale, es:',
    '• _spegni sala riunioni_',
    '• _accendi ufficio alex_',
    '• _spegni industries_',
    '',
    '*Comandi:*',
    '/status — luci accese ora',
    '/list — tutte le luci per stanza',
    '/on <nome> · /off <nome> · /toggle <nome>',
    '/all\\_off \\[stanza] — spegni tutto (con conferma)',
    '/ping — test'
  ].join('\n');
}
