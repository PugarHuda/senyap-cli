## How to read the table

- **A**: plain `kane-cli run "<flow>. Then verify that it worked." --agent --headless --bug-detection continue --timeout 300`. It counts as a catch only when Kane ends `failed` with 740 `confirmed_product_bug`.
- **B / C**: `senyap hunt --url <url> --flow "<flow>" --json` (senyap 0.1.2) on the buggy / fixed build, with the same flow sentence as A. B counts as a catch when the status is `silent_failure` or `failed`. C counts as a false alarm when it is either of those.
- "blocking / findings" counts what Senyap read from Kane's HAR and console logs. Warnings (`auth_probe`, `ambient_console`) never block.
- Every Kane run on 23 Nov ran alone: one browser run at a time, against a freshly reset app (new DB or data dir, reseeded).
- `observe x/y` is Senyap's first Kane run. The cell's main result code comes from the confirm run when that run produced a 740; otherwise it comes from observe.
- The A column for wallos459 and for tududi1045, kuma3713 and memos5011 comes from 22 Nov (valid, unchanged). All B and C cells are live 0.1.2 runs from 23 Nov.

## Headline (8 real bugs; B/C with senyap 0.1.2)

| | Plain Kane (A) | Senyap (B) |
|---|---|---|
| Caught on the buggy build | **5/8**: tududi1045, memos5011, memos4978, memos5865, wallos459 | **6/8**: tududi1045, memos5011, tududi904, linkding1451, memos5865, wallos459 |
| Caught only by this side | memos4978 (Senyap inconclusive) | linkding1451 (A was a false green), tududi904 (A ended 750) |
| Missed | kuma3713 (false green), linkding1451 (false green), tududi904 (750, twice) | kuma3713 (clean on the re-run, inconclusive on the first run), memos4978 (inconclusive) |

Senyap on the **fixed** builds (8 bugs):
- clean 4/8: kuma3713, memos5011, linkding1451, tududi904
- inconclusive 3/8: tududi1045, memos4978, wallos459 (Kane verdict family `automation_bug` each time)
- false alarm 1/8: memos5865

There was also one more false alarm in a run that was later re-run: wallos459 C run 1. See limit 5.

**Where Senyap's evidence reading made the difference**, meaning Kane's own observe run passed: tududi1045 (hidden 500 on `PUT /api/profile/today-settings`) and linkding1451 (Turbo console error). On tududi904 the catch came from Kane's own 740 under Senyap's objective, which adds an explicit reload-and-verify step. That pack had no blocking finding. On memos5011, memos5865 and wallos459, plain Kane already caught the bug, so Senyap added nothing.

**Credits on 23 Nov:** the balance went from 9,670.75 to 8,071.38, so **1,599.4 credits** were spent, under the 1,800 cap. That includes the re-runs and first attempts that are not in the table: kuma3713 B run 1 (63.3), wallos459 C run 1 (51.5), tududi904 A attempt 1 (50.9), memos4978 A attempt 1 (44.2) and memos5865 A attempt 1 (28.3). Per-run figures are Kane session sums (tools/credits.js). The table total (Totals section) also includes the four A runs from 22 Nov and leaves out the re-runs and attempts listed here, so it does not equal the balance delta. Senyap's B/C runs cost about 2x plain Kane, because a failure triggers a second (confirm) Kane run and an inconclusive observe is retried once.

## Honest misses and limits (with evidence)

1. **State-only bugs with no network or console signal (kuma3713, memos4978, tududi904).** Senyap has nothing extra to read here, so it does exactly as well as Kane's own assertion. On kuma3713 the agent pressed Pause itself before checking. A and B run 2 both passed; the server log shows the resume after Save and then the agent's Pause.
2. **The 0.1.2 `automation_bug` rule can hide a real bug (kuma3713 B run 1).** The observe run triggered the bug (server log: `Resume Monitor: 1` right after Save), and Kane failed it with 720. But Kane's verdict blamed itself ("did not perform any pause action"), so 0.1.2 counted the run as inconclusive. Under 0.1.1 the same 720 would have counted as a failure.
3. **Senyap's automatic retry runs on dirty app state.** Senyap does not reset the app between attempts. On kuma3713 B run 1, the retry started with the monitor already resumed by the first attempt. On memos4978, the retry started with Appearance already changed.
4. **False alarm on the fixed memos5865 build, from Senyap's own rules.** Two noise findings block:
   - a pre-login `POST /memos.api.v1.AuthService/RefreshToken -> 401` (0.1.2's `auth_probe` covers only GET);
   - `GET /api/v1/sse` `ERR_ABORTED` (a long-lived event stream cut by the reload).

   The same two findings are on the buggy build. Kane itself ended 750 automation_bug on the fixed build, and the server state was correct (`- [x] alpha`).
5. **Native `confirm()` dialogs (wallos459 C).** The fixed delete handler asks `confirm()`, and Kane never approves it, so no DELETE is sent. Run 1 turned into a Kane 740 "product bug" with 0 Senyap findings: a false alarm that came from Kane's assertion, not from Senyap's evidence. The re-run came back 720 automation_bug, which counts as inconclusive. A DELETE sent with curl on the same server works.
6. **Kane checkpoint placeholders (memos4978 B and C).** Kane's checkpoint recorded `{{appearance_always_dark_c...}}` placeholders instead of page text, so both builds came back inconclusive.
7. **Confirm runs are expensive and often do not finish.** The confirm run ended 750 or 720 on tududi1045 B, tududi904 B and wallos459 B/C, and 330 on memos5865 B; the B status then rests on the observe run. memos5865 B cost 140 credits.
8. **Flows refined after a first plain-Kane attempt:**
   - memos4978: "theme" was ambiguous, because there is both an Appearance select and a Theme select.
   - memos5865: the first flow did not create the stale editor draft the bug needs.
   - kuma3713, on 22 Nov.

   In each case the change came before any Senyap run, and A was re-run with the final flow. The first attempts are kept in `scratch/*-attempt1*`. tududi904 A was re-run once with the same flow and gave the same 750.
9. **Missing Kane links.** Kane returned no Test Manager `test_url` for the memos5865 runs. The local session dirs are referenced from the scratch folders.

## Superseded / invalid runs

| Run | Status | Where |
|---|---|---|
| tududi1045 B, C (senyap 0.1.1, 22 Nov) | superseded by the 0.1.2 live re-runs | results/v011/ (also in the "Superseded" table above) |
| wallos459 B (senyap 0.1.1, Docker PHP, 22 Nov) | superseded by the 0.1.2 run on native PHP | results/v011/ |
| kuma3713 B, memos5011 B (22 Nov) | **invalid**: started in the same second, and Kane wrote the same mixed traffic into both packs | results/invalid/ |
| kuma3713 B run 1 (23 Nov) | valid, superseded by the one allowed re-run | results/kuma3713-pre-run1.json |
| wallos459 C run 1 (23 Nov) | valid (a false alarm), superseded by the one allowed re-run | results/wallos459-post-run1.json |

## 22 Nov history (short)

The first session stopped after 3 bugs on a disk hard-stop (C: fell to 1.1 GB; npm cache, Go module cache and Docker's vhdx). It also found two real Senyap bugs that 0.1.2 fixed: two kane-cli runs started in the same second wrote the same evidence (now serialized with a lock), and pre-login GET 401s plus page-load console noise blocked the tududi fixed build (now `auth_probe` and `ambient_console` warnings). Spend that session: 437.6 credits.

## Environment notes

- No Docker on 23 Nov: the Docker CLI still hangs, and a stale container holds :3001. Neither was touched.
- tududi: Node 26, production webpack build served by the backend, on :3002.
- Uptime Kuma 1.23: Node 26 with the SlowBuffer preload shim (tools/node26-shim.js), on :3011.
- Memos: Go binaries with the embedded frontend, on :8081. 2026 builds have no `--mode` flag; tools/memos_start.sh detects this.
- linkding: Python 3.13 venv via uv plus the npm build, Django runserver with the dev settings, on :9090 (tools/linkding_start.sh).
- Wallos: portable PHP 8.2.36 for Windows (quietbench/php), `php -S` on :8000 (tools/wallos_native.sh, tools/wallos_init.sh). A prepend stubs logout.php, because Kane's runner GET-crawls every link.
- Disk on C: stayed between 25 and 28 GB free.
