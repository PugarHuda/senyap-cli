# Senyap

*Senyap* (Indonesian: "silent"). **Catch the bugs that fail silently.**

Your coding agent says "done". The screen says "Saved!". Underneath, the API returned 500, the console logged an error, and the page called your staging server. A screenshot-based check passes. So does a plain Kane CLI run: we measured it.

Senyap makes [Kane CLI](https://www.testmuai.com/kane-cli/) look under the screen, turns what it finds into a verdict Kane itself enforces, and won't let your agent stop until the flow is clean.

```
agent says done ─► senyap guard (Stop hook)
                    │
                    ├─ kane-cli run "<flow>. Then verify no 4xx/5xx, no console errors,
                    │                 no calls to staging, still there after reload"
                    │                 --agent --bug-detection continue
                    ├─ read Kane's evidence pack: logs/*-network.har, logs/*-console.ndjson
                    ├─ seal a senyap evidence pack with its own metric catalog
                    ├─ kane-cli evidence verdict --policy senyap.policy.yaml
                    │
                    ├─ clean ─────► agent may stop; senyap lock freezes the flow as *_test.md
                    └─ silent failure ► block, hand the agent a brief with Kane's run link,
                                        re-check after the fix (3 tries, then a human)
```

## Why this needs to exist: one measurement

A notes page that shows "Saved!" whatever the server says, while `POST /api/save` returns `500 {"error":"db down"}`:

| Run | Kane result | What was true |
|---|---|---|
| `kane-cli run "Type 'hello', click Save, and verify the note was really saved"` | **passed** (result_code 100) | the save failed |
| Same flow, Senyap objective (network, console, environment, reload) | **failed**, result_code 740 `confirmed_product_bug` | the save failed |
| `senyap check` on the *first* run's evidence pack | **false green**: Kane's own `evidence verdict` fails `no-false-green`, `no-hidden-5xx`, `no-console-errors` | |

The first run's evidence pack already held the 500 and the console error. Nothing read them. Senyap does.

## Install

```bash
npm install -g @testmuai/kane-cli && kane-cli login
npm install -g senyap            # or run from a checkout: node bin/senyap.js
cd your-app
senyap init --agent claude       # or codex, cursor, all
```

`init` writes `senyap.config.json` (your URL and the flows that matter), registers `senyap guard` as the Stop hook of the agents you pick, and installs Kane's own agent skill (`kane-cli install skill`) so the agent can call Kane itself while it fixes.

| Agent | Hook file | How Senyap keeps it working |
|---|---|---|
| Claude Code | `.claude/settings.json` | `{"decision":"block","reason":<brief>}` |
| Codex CLI | `.codex/hooks.json` (trust once with `/hooks`) | same shape as Claude Code |
| Cursor | `.cursor/hooks.json` | `{"followup_message":<brief>}` |

## Commands

```
senyap hunt  [--url <u>] [--flow "<flow>"]...   Kane drives each flow and checks under the screen
senyap check <kane .evidence pack>...           Judge packs Kane already wrote (testmd, testrun, CI)
senyap guard                                    Agent Stop hook
senyap lock  [--flow "<flow>"]                  Freeze clean flows as regression *_test.md files
senyap init  [--agent claude|codex|cursor|all]  Config + hooks + Kane skill
```

Exit codes: `0` clean, `1` silent failure, `2` Kane did not run.

## What counts as a silent failure

Read from the HAR and console logs Kane writes into every evidence pack:

| Finding | Severity | Example |
|---|---|---|
| `http_5xx`, `http_4xx` | blocking | `POST /api/notes → 500` behind a "Saved!" toast |
| `request_failed` | blocking | `net::ERR_NAME_NOT_RESOLVED` |
| `console_error`, `js_exception` | blocking | `save failed 500` |
| `env_leak` | blocking | a page on `127.0.0.1` or production calling `staging.*`, or production calling `localhost` |
| `mixed_content`, `slow_response` (> 3 s) | warning | |
| **false green** | blocking | Kane passed the test while any blocking finding exists |

## Kane CLI primitives Senyap is built on

Senyap drives no browser of its own. Every verdict comes from Kane.

| Primitive | Used for |
|---|---|
| `kane-cli run --agent` (NDJSON, `run_end`) | the hunt; `result_code`, `reason_code`, `summary`, `test_url`, `credits_consumed` |
| `--bug-detection continue` (result_code 740) | Kane confirms a product bug rather than a test bug |
| DevTools checks inside objectives | network status, console, request hosts |
| Evidence packs (`.evidence`, `logs/*-network.har`, `logs/*-console.ndjson`, `result.yaml`) | the raw facts Senyap reads |
| `@testmuai/evidence-cli` producer catalog + `finalize` | Senyap's own sealed pack with `metrics.silent.*` and `metrics.false_green_tests` |
| `kane-cli evidence verdict --policy` | Kane judges Senyap's metrics; `policies/senyap.policy.yaml` |
| `*_test.md` + `kane-cli testmd run --policy --no-adaptive-heal` | locked regression flows, gated by Kane's own catalog (`steps.failed`, `metrics.tests_without_checks`, `metrics.heal.healed_tests`) |
| `kane-cli install skill` | the agent gets Kane while it fixes |
| Test Manager `test_url` | every claim links to a real Kane run |

## Kane limits we hit, and what we did instead of giving up

| Limit | Workaround in Senyap |
|---|---|
| Verdict policies can't read console or network logs (the catalog is test/step/heal metrics only) | Senyap is an evidence producer: it seals its own pack with a `senyap` metric catalog, so Kane's `evidence verdict` gates on silent failures |
| A plain objective passes a page whose API failed | Hunt objectives ask Kane for network, console, environment and reload checks; the pack is read regardless, so a false green is still caught |
| Network capture resets between internal steps (kane-cli #133) | Locked tests keep the trigger and the asserts in one step; Senyap reads the run's full HAR afterwards |
| `--timeout` is not always honoured (#138) | Senyap's own kill timer around every Kane process |
| Adaptive heal can re-author a step and hide a regression | Locked runs use `--no-adaptive-heal`; the lock policy fails on `metrics.heal.healed_tests` |
| Third-party kane-cli plugins aren't loadable (the registry is an allowlist) | Ship as a CLI + agent hooks + Kane's own skill |
| On Windows the npm shim needs a shell, which splits objectives on spaces | Senyap runs kane-cli's JS entry with node directly |

## Development

```bash
npm test                 # unit tests for the classifiers, objectives and *_test.md shape
node bin/senyap.js check ~/.testmuai/kaneai/sessions/*/evidence/*.evidence
```

`examples/notes-app` is a small app with two silent bugs (an apostrophe breaks the save with a 500 while the UI says "Saved!", and analytics posts to a staging host). `node examples/notes-app/server.js` then `cd examples/notes-app && senyap hunt`.

## License

Apache-2.0
