// Whitelist of Telegram chat IDs allowed to talk to the bot. Parsed once from
// the comma-separated TELEGRAM_ALLOWED_CHAT_IDS env var into Number[].

export function parseChatIds(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function makeAuth(allowedIds) {
  const allowed = new Set(allowedIds);
  return {
    allowedIds,
    isAllowed(chatId) {
      return allowed.has(Number(chatId));
    }
  };
}
