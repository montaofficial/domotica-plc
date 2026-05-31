// node-cron job for the evening "lights still on" report. cron is injected
// from index.js so this module stays a no-op import when the bot is disabled.

import { getOnLights, buildReportMessage } from './report.js';

export async function sendEveningReport({ bot, config, auth }) {
  const on = await getOnLights(config.officeRoomIds);

  if (on.length === 0) {
    if (config.silentIfEmpty) {
      console.log('[Telegram] evening report: no office lights on — staying silent');
      return;
    }
    for (const chatId of auth.allowedIds) {
      await bot.sendMessage(chatId, '🌙 Tutte le luci d’ufficio sono spente. Buona serata.')
        .catch((e) => console.error('[Telegram] report send failed:', e?.message || e));
    }
    return;
  }

  const { text, reply_markup } = buildReportMessage(on);
  for (const chatId of auth.allowedIds) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup })
      .catch((e) => console.error('[Telegram] report send failed:', e?.message || e));
  }
  console.log(`[Telegram] evening report sent: ${on.length} light(s) on`);
}

export function startScheduler({ cron, bot, config, auth }) {
  if (!cron.validate(config.cron)) {
    console.error(`[Telegram] invalid cron expression: "${config.cron}" — report disabled`);
    return null;
  }
  const task = cron.schedule(
    config.cron,
    () => {
      sendEveningReport({ bot, config, auth })
        .catch((e) => console.error('[Telegram] evening report error:', e?.message || e));
    },
    { timezone: config.tz }
  );
  console.log(`[Telegram] evening report scheduled "${config.cron}" (${config.tz})`);
  return task;
}
