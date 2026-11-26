import { existsSync, readFileSync } from 'node:fs';

/** The flow `senyap init` writes; a placeholder, not a flow anyone chose. */
export const DEFAULT_FLOW = 'Open the home page and use its main feature the way a first-time user would';

/**
 * senyap.config.json: { url, flows: [string | { flow, probe? }], reset?, persistence?, maxAttempts? }
 * - probe: shell command run after Kane's run; a non-zero exit means the data is wrong
 *   even if the screen looked right (bugs that leave nothing in the network or console).
 * - reset: shell command run before every Kane attempt, so a retry starts from the same state.
 */
export function loadConfig(path = 'senyap.config.json') {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

/** Flows as objects, placeholder dropped. */
export const flowsOf = (cfg) => (cfg.flows ?? []).map((f) => (typeof f === 'string' ? { flow: f } : f)).filter((f) => f.flow && f.flow !== DEFAULT_FLOW);
