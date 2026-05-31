// Telegram bot bootstrap. Completely inert unless TELEGRAM_BOT_TOKEN is set:
// node-telegram-bot-api and node-cron are imported lazily inside the guard, so
// when the token is absent this module pulls in nothing and does nothing.
//
// The whole bootstrap is wrapped so a bot failure can never take down the HTTP
// / WebSocket server it shares a process with.

import { parseChatIds, makeAuth } from './auth.js';
import { registerHandlers } from './bot.js';
import { startScheduler } from './scheduler.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('[Telegram] TELEGRAM_BOT_TOKEN not set — bot disabled');
} else {
  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    const cron = (await import('node-cron')).default;

    const config = {
      officeRoomIds: (process.env.TELEGRAM_OFFICE_ROOM_IDS || '')
        .split(',').map((s) => s.trim()).filter(Boolean),
      cron: process.env.TELEGRAM_EVENING_REPORT_CRON || '30 19 * * 1-5',
      tz: process.env.TELEGRAM_TIMEZONE || 'Europe/Rome',
      silentIfEmpty: String(process.env.TELEGRAM_REPORT_SILENT_IF_EMPTY || 'true').toLowerCase() === 'true'
    };

    const auth = makeAuth(parseChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS));
    if (auth.allowedIds.length === 0) {
      console.warn('[Telegram] TELEGRAM_ALLOWED_CHAT_IDS is empty — every message will be ignored');
    }

    const bot = new TelegramBot(token, { polling: true });
    registerHandlers({ bot, config, auth });
    startScheduler({ cron, bot, config, auth });

    bot.getMe()
      .then((me) => console.log(`[Telegram] Bot started @${me.username}`))
      .catch((e) => console.error('[Telegram] getMe failed:', e?.message || e));
  } catch (err) {
    console.error('[Telegram] Bootstrap failed:', err?.message || err);
  }
}
