import { existsSync, readFileSync } from 'node:fs';

/** senyap.config.json: { url, flows: [string], persistence?, maxAttempts? } */
export function loadConfig(path = 'senyap.config.json') {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
