# Senyap

*Senyap* (Indonesian: "silent"). **Catch the bugs that fail silently.**

Your coding agent says "done". The screen says "Saved!". Underneath, the API returned 500, the console logged an error, and the page called your staging server. A screenshot-based check passes. So does a plain Kane CLI run: we measured it.

Senyap makes [Kane CLI](https://www.testmuai.com/kane-cli/) look under the screen, turns what it finds into a verdict Kane itself enforces, and won't let your agent stop until the flow is clean.

**Landing page:** https://senyap-cli.vercel.app · **Demo app:** https://senyap-demo.vercel.app (silent bugs) and https://senyap-demo.vercel.app/fixed/ (clean)

```
agent says done ─► senyap guard (Stop hook)
                    │
                    ├─ observe: kane-cli run "<flow>. Then reload and verify it's still there"
                    │           --agent --bug-detection continue
                    ├─ read Kane's evidence pack: logs/*-network.har, logs/*-console.ndjson
                    ├─ seal a senyap evidence pack with its own metric catalog
                    ├─ kane-cli evidence verdict --policy senyap.policy.yaml
                    ├─ confirm (only if the evidence shows a failure):
                    │           kane-cli run "<flow>. Then verify no 4xx/5xx, no console errors,
                    │           no calls to another environment" → Kane 740 + root cause
                    │
                    ├─ clean ─────► agent may stop; senyap lock freezes the flow as *_test.md
                    └─ silent failure ► block, hand the agent a brief with Kane's run link,
                                        re-check after the fix (3 tries, then a human)
```

## Try it in one command

```bash
npm install -g @testmuai/kane-cli && kane-cli login
npx senyap hunt --url https://senyap-demo.vercel.app/ --flow "Add a note that says \"Don't forget the milk\" and save it"
# ✖ silent_failure  kane=failed/740  findings=5
npx senyap hunt --url https://senyap-demo.vercel.app/fixed/ --flow "Add a note that says \"Don't forget the milk\" and save it"
# ✔ clean  kane=passed/100  findings=0
```

## A real agent session

Claude Code was asked to add a note counter to `examples/notes-app`, with Senyap as its Stop hook. Senyap blocked the stop twice. Claude Code fixed the apostrophe 500 and the staging call, then, on the second block, found a bug nobody had planted: the server read `index.html` once at startup, so the browser kept getting the old page. The third check came back clean (Kane result code 100, no findings in the pack).

## Why this needs to exist: one measurement

A notes page that shows "Saved!" whatever the server says, while `POST /api/save` returns `500 {"error":"db down"}`:

| Run | Kane result | What was true |
|---|---|---|
| `kane-cli run "Type 'hello', click Save, and verify the note was really saved"` | **passed** (result_code 100) | the save failed |
| Same flow, Senyap objective (network, console, environment, reload) | **failed**, result_code 740 `confirmed_product_bug` | the save failed |
| `senyap check` on the *first* run's evidence pack | **false green**: Kane's own `evidence verdict` fails `no-false-green`, `no-hidden-5xx`, `no-console-errors` | |

The first run's evidence pack already held the 500 and the console error. Nothing read them. Senyap does.

## QuietBench: 8 real bugs from open-source apps

Each bug is a closed GitHub issue with its fix commit, run three ways: plain Kane on the buggy commit (`kane-cli run "<flow>. Then verify that it worked." --bug-detection continue`), Senyap on the buggy commit, Senyap on the fix commit. Same flow sentence for all three, one Kane run at a time, fresh app data. Full table with every Kane run link, the scripts that start each app, and every miss: [bench/RESULTS.md](bench/RESULTS.md).

| Bug | Plain Kane, buggy | Senyap, buggy | Senyap, fixed |
|---|---|---|---|
| [tududi #1045](https://github.com/chrisvel/tududi/issues/1045) settings toggle 500s | caught (740) | caught (Kane passed; hidden 500 in the pack) | inconclusive |
| [Uptime Kuma #3713](https://github.com/louislam/uptime-kuma/issues/3713) save resumes a paused monitor | missed (passed) | missed | clean |
| [Memos #5011](https://github.com/usememos/memos/issues/5011) theme change fails on a fresh install | caught (740) | caught | clean |
| [Memos #4978](https://github.com/usememos/memos/issues/4978) preferences wipe each other | caught (740) | inconclusive | inconclusive |
| [Memos #5865](https://github.com/usememos/memos/issues/5865) ticked boxes untick after edit | caught (740) | caught | false alarm (fixed in 0.1.3, see below) |
| [linkding #1451](https://github.com/sissbruecker/linkding/issues/1451) uncaught Turbo error | missed (passed) | **caught** (console error in the pack) | clean |
| [tududi #904](https://github.com/chrisvel/tududi/issues/904) title "updated" but not saved | no verdict (750) | **caught** (Kane 740 under the reload check) | clean |
| [Wallos #459](https://github.com/ellite/Wallos/issues/459) delete in modal does nothing | caught (740) | caught | inconclusive |

Plain Kane caught 5/8; Senyap caught 6/8, including two plain Kane passed. On fixed builds (senyap 0.1.2, live): 4 clean, 3 inconclusive, 1 false alarm. The rule behind that false alarm shipped in 0.1.3; re-judging the same evidence it becomes inconclusive. What Senyap can't see: bugs that leave nothing in the network or console (Uptime Kuma #3713, Memos #4978) are only as good as Kane's own assertion. Its retry also doesn't reset app state between attempts.

## Install

```bash
npm install -g @testmuai/kane-cli && kane-cli login
npm install -g senyap            # or run from a checkout: node bin/senyap.js
cd your-app
senyap init --agent claude       # or codex, cursor, all
```

`init` writes `senyap.config.json` (your URL and the flows that matter), registers `senyap guard` as the Stop hook of the agents you pick, and installs Kane's own agent skill (`kane-cli install skill`) so the agent can call Kane itself while it fixes.

| Agent | Hook file | How Senyap keeps it working | Run in a live agent session? |
|---|---|---|---|
| Claude Code | `.claude/settings.json` (Stop + PreToolUse) | `{"decision":"block","reason":<brief>}` | **yes** (the session above) |
| Codex CLI | `.codex/hooks.json` (trust once with `/hooks`) | same shape as Claude Code | not yet: built to Codex's documented hook format |
| Cursor | `.cursor/hooks.json` | `{"followup_message":<brief>}` | not yet: built to Cursor's documented hook format |

### The agent can't talk its way past the gate

A coding agent that is blocked will sometimes "fix" the check instead of the app. Senyap closes the easy routes:

- **The checks are pinned.** `senyap.config.json` and `senyap-tests/` are pinned to what a human approved (at `init`, or with `senyap approve`). If they change, the stop is blocked without a hunt: *"the checks were changed; put them back"*.
- **The agent can only add checks.** It may write extra flows to `.senyap/proposed-flows.json`. They are hunted on the next stop (stricter, never looser), and a human promotes them with `senyap approve`, which refuses to run without a terminal. With only the placeholder flow from `init`, the first stop asks the agent to propose flows for what it just built.
- **The guard's memory lives outside the repo** (`~/.senyap/state`), so the agent can't reset its attempt count or mark a tree clean. It fails closed: with no approval on record (say the state was deleted), the stop is blocked until a human runs `senyap approve`.
- **Claude Code also gets a PreToolUse hook** (`senyap protect`) that denies edits to the checks, `senyap approve`, and writes to the state directory. A determined agent with a shell can still get around a hook; the pinned hash at stop time is what actually catches it.

### Probes and resets: bugs that leave no trace

Some bugs never touch the network or console: the API answers 200 and simply doesn't store the change. For those, give a flow a **probe**, a command that reads the app's own data after Kane's run, and a **reset** that puts the app back before every attempt:

```json
{
  "url": "http://localhost:3011",
  "reset": "node scripts/seed-paused-monitor.js",
  "flows": [
    {
      "flow": "Open the paused monitor, click Edit, click Save without changing anything, reload, and check it is still paused",
      "probe": "node scripts/assert-monitor-never-ran.js"
    }
  ]
}
```

A non-zero probe exit is a blocking `probe_failed` finding with the command's output, so Kane's own verdict fails the pack even when the screen and the traffic looked right. Probes and resets come only from the human-approved config, never from agent proposals.

## Commands

```
senyap hunt  [--url <u>] [--flow "<flow>"]...   Kane drives each flow and checks under the screen
senyap check <kane .evidence pack>...           Judge packs Kane already wrote (testmd, testrun, CI)
senyap guard                                    Agent Stop hook
senyap lock  [--flow "<flow>"]                  Freeze clean flows as regression *_test.md files
senyap init  [--agent claude|codex|cursor|all]  Config + hooks + Kane skill
senyap approve                                  (a human) promote proposed flows, re-pin the checks
senyap protect                                  Claude Code PreToolUse hook: the agent can't edit the checks
```

The brief the agent gets names each failing call with its method, status, response and request body, the Kane step it happened in, the files that call that route (`git grep`), Kane's run link, and the one command to re-check just that flow. Secrets in request bodies (password, token and key fields, API keys, bearer tokens) are masked first, because the brief can end up in a PR comment.

Exit codes: `0` clean, `1` silent failure, `2` Kane did not run.

## What counts as a silent failure

Read from the HAR and console logs Kane writes into every evidence pack:

| Finding | Severity | Example |
|---|---|---|
| `http_5xx`, `http_4xx` | blocking | `POST /api/notes → 500` behind a "Saved!" toast |
| `request_failed` | blocking | `net::ERR_NAME_NOT_RESOLVED` |
| `console_error`, `js_exception` | blocking | `save failed 500` |
| `env_leak` | blocking | a page on `127.0.0.1` or production calling `staging.*`, production calling `localhost`, or production sending a payment test key (`pk_test_…`, `sk_test_…`) |
| `probe_failed` | blocking | the flow's probe found the data unchanged although the screen said it was saved |
| `mixed_content`, `slow_response` (> 3 s) | warning | |
| `insecure_cookie` | warning | an https page sets a session cookie without `Secure` or `HttpOnly` |
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
| Kane's DevTools analyzers time out proving that *nothing* failed on a clean page (result_code 750, seen repeatedly), but answer fast when something did | Two phases: observe without analyzers and judge the pack; run the analyzers only to confirm a failure the evidence already shows |
| An environment rule like "no request to localhost" is impossible for an app served from localhost (Kane got stuck, 330) | The rule is derived from the app's own host: local apps must not call staging, production must call neither |
| Kane-side failures (3xx/4xx/750, timeouts) look like test failures | Classified `inconclusive`, retried once, and never counted against the agent |
| Two kane-cli runs started in the same second wrote the same mixed traffic into both evidence packs (found on QuietBench) | Senyap serializes its browser runs with a lock file |
| A failed assertion can be Kane's own mistake (QuietBench: it clicked a label instead of the switch, verdict family `automation_bug`) | 7xx results whose Kane verdict family is `automation_bug` or `environment_issue` are `inconclusive` |

### Noise that is reported but never blocks

Found the hard way on a real app (tududi, QuietBench), where the fixed build was flagged: a pre-login `GET /api/profile → 401`, Chrome's console echo of it, and an i18n error logged on every page load. Since 0.1.2:

- `auth_probe`: a GET answered 401/403 (a refused write still blocks).
- Console lines that only echo a request the HAR already records are dropped; the HAR entry carries the severity.
- `ambient_console`: console errors logged while the page first loads, before the flow does anything.

## Development

```bash
npm test                 # classifiers, objectives, the guard's block/escalate/tamper paths, protect, probes
node bin/senyap.js check ~/.testmuai/kaneai/sessions/*/evidence/*.evidence
```

`examples/notes-app` is a small app with two silent bugs (an apostrophe breaks the save with a 500 while the UI says "Saved!", and analytics posts to a staging host). `node examples/notes-app/server.js` then `cd examples/notes-app && senyap hunt`.

## License

Apache-2.0

## GitHub Action

```yaml
- uses: PugarHuda/senyap-cli@main
  with:
    url: ${{ steps.deploy.outputs.preview-url }}
    flows: |
      Add a note that says "Don't forget the milk" and save it
      Sign up with a new email and open the dashboard
    kane-username: ${{ secrets.KANE_USERNAME }}
    kane-access-key: ${{ secrets.KANE_ACCESS_KEY }}
```

Or judge the packs your own `kane-cli testmd run` steps wrote: `packs: .testmuai/evidence/*.evidence`. The job fails on any silent failure and the agent brief goes to the job summary. On pull requests it also keeps one comment up to date with the brief and Kane's run links (give the job `permissions: pull-requests: write`; turn it off with `comment: false`). `.github/workflows/demo.yml` runs it against the hosted demo and expects the buggy app to fail and the fixed one to pass.
