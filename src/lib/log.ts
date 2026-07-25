/**
 * Namespaced console logger. Everything the extension prints is prefixed so
 * it is distinguishable from the router's own (noisy, legacy) console output.
 */
const PREFIX = '[merlins-cloak]';

export const log = {
  info: (...args: unknown[]) => console.info(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
  debug: (...args: unknown[]) => console.debug(PREFIX, ...args),
};
