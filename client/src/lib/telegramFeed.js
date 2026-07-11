// Module-level ring buffer for the live KNX telegram feed.
//
// Telegrams arrive 3-4x/sec, 24/7. Holding them in App-root state made every
// telegram re-render the entire component tree (Layout + active page + every
// DeviceCard) several times a second on every page, even though only the
// Discovery page reads the feed. Here the buffer lives outside React and
// notifies just the components that subscribe (via useTelegramFeed), so the
// rest of the app is untouched by bus chatter.

const MAX = 100;
let buffer = [];
const listeners = new Set();

export function pushTelegram(telegram) {
  buffer = [telegram, ...buffer.slice(0, MAX - 1)];
  for (const l of listeners) l(buffer);
}

export function getTelegrams() {
  return buffer;
}

export function subscribeTelegrams(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
