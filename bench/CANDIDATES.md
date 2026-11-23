# QuietBench: candidate bugs

Researched 2026-11-22 with the `gh` CLI. Every row is a **closed** GitHub issue that has a merged fix. **Before SHA** is the first parent of the fix commit: check it out to get the buggy build. **Fix SHA** gives the clean build. SHAs are shortened to 10 characters, and `git checkout` accepts them.

Rank is my score out of 5 for local setup ease, how silent the symptom is, and how deterministic the trigger is. I read the fix diff for each of the top 8 (★).

## Candidate table

| # | Rank | App / Issue | Fix (PR / commit) | Before SHA → Fix SHA | Fix date | Silent symptom (quote from issue) | One-sentence agent flow |
|---|---|---|---|---|---|---|---|
| 1 ★ | 5.0 | tududi [#1045](https://github.com/chrisvel/tududi/issues/1045) | [PR #1044](https://github.com/chrisvel/tududi/pull/1044) | `a21e643842` → `b9eaedc468` | 2026-04-20 | "Toggling any setting in the today view settings dropdown … immediately fails with a 500 … `PUT /api/profile/today-settings` … CSRF token missing. The setting does not persist." | Log in, open Today, open the settings dropdown, toggle "Show metrics", reload, and check that the toggle kept its value. |
| 2 ★ | 4.8 | tududi [#1134](https://github.com/chrisvel/tududi/issues/1134) | [PR #1143](https://github.com/chrisvel/tududi/pull/1143) | `e2de8c332f` → `3ff413557d` | 2026-05-26 | "The request to `api/task/<task_id>` fails because of a missing CSRF token" | Create a project with one task, open the project page, change the task's status with the row button, and reload. |
| 3 ★ | 4.7 | tududi [#904](https://github.com/chrisvel/tududi/issues/904) | [PR #905](https://github.com/chrisvel/tududi/pull/905) | `47d270b242` → `0bde44e460` | 2026-03-04 | "the UI displays 'Task title updated successfully' … The task name is not saved." | Create a task, open it, rename it, wait for the success toast, then reload and check the new name. |
| 4 ★ | 4.6 | Wallos [#459](https://github.com/ellite/Wallos/issues/459) | [PR #460](https://github.com/ellite/Wallos/pull/460) | `d7af7cc18b` → `8cb43553fd` | 2024-07-15 | "nothing happens, checked the console and there was the error: `TypeError: event.stopPropagation is not a function`" | Add a subscription, open its edit modal, click Delete, and check that it is gone after a reload. |
| 5 ★ | 4.5 | Memos [#5011](https://github.com/usememos/memos/issues/5011) | [PR #5012](https://github.com/usememos/memos/pull/5012) | `01d3f2f86c` → `fbcdf0fba7` | 2025-08-18 | "If no general setting exists the api throws an error when trying to change the theme." | On a fresh install, sign up as the first user, open Settings → Preferences, change the theme to Dark, and reload. |
| 6 ★ | 4.4 | Uptime Kuma [#3713](https://github.com/louislam/uptime-kuma/issues/3713) | [PR #3717](https://github.com/louislam/uptime-kuma/pull/3717) | `1f29fabe64` → `0af4ee6c34` | 2023-09-09 | "Pause a monitor, edit it (even without changing anything), save it => it goes alive (not paused anymore)" | Create an HTTP monitor, pause it, click Edit → Save without changes, and check that it is still paused. |
| 7 ★ | 4.3 | Memos [#4978](https://github.com/usememos/memos/issues/4978) | [PR #4980](https://github.com/usememos/memos/pull/4980) | `1f1add1a48` → `9f8921d3b9` | 2025-08-08 | "On any change in the preferences all settings are lost and are not being saved." | Sign in, change the theme and then the default memo visibility in Settings → Preferences, reload, and check both values. |
| 8 ★ | 4.2 | Memos [#5865](https://github.com/usememos/memos/issues/5865) | [PR #5867](https://github.com/usememos/memos/pull/5867) | `d98f665919` → `b5863d76be` | 2026-04-20 | "Check some boxes and save the memo … Edit the memo and you'll see the checboxes are no longer checked" | Create a memo `- [ ] a` / `- [ ] b`, tick "a" in the rendered memo, choose Edit → Save, and check that "a" is still ticked. |
| 9 | 4.1 | tududi [#1805](https://github.com/chrisvel/tududi/issues/1805) | [PR #1809](https://github.com/chrisvel/tududi/pull/1809) | `85d139febb` → `3402a7095b` | 2026-10-06 | "it's changing on UI but reload shows it's in old status" | Plan a task for today, change its status to "In progress" from the row on /today, and reload. |
| 10 | 3.9 | tududi [#1117](https://github.com/chrisvel/tududi/issues/1117) | [PR #1119](https://github.com/chrisvel/tududi/pull/1119) | `1678cce4c1` → `cdcbc4be49` | 2026-05-14 | "`POST /api/upload/project-image` returns **500** … image is not saved" | Open a project, upload a PNG as its image, and reload. This needs a file-upload step. |
| 11 | 3.8 | Memos [#6500](https://github.com/usememos/memos/issues/6500) | [PR #6508](https://github.com/usememos/memos/pull/6508) | `334c758bac` → `08acc22f3f` | 2026-10-29 | "'Check all tasks' … does nothing. There is no toast and no update request, and both boxes stay unchecked after a reload." | Create a memo with `> - [ ] first` / `> - [ ] second`, choose ⋮ → "Check all tasks", and reload. The fix is a larger editor upgrade (17 files). |
| 12 | 3.7 | Memos [#6434](https://github.com/usememos/memos/issues/6434) | [PR #6457](https://github.com/usememos/memos/pull/6457) | `7cb288864b` → `a668bb8f7e` | 2026-10-11 | "every memo created from the composer gets **the same** `createTime` … so their order within the day is lost." | Click today in the sidebar calendar, post two memos about a minute apart, and compare their timestamps. |
| 13 | 3.6 | Memos [#6128](https://github.com/usememos/memos/issues/6128) | [PR #6155](https://github.com/usememos/memos/pull/6155) | `ec689c3a03` → `3f567fda45` | 2026-08-06 | "inline image thumbnail returns 401 for anonymous viewers (missing share_token), download link for same file works fine" | Create a memo with an image, create a share link, open it in a logged-out context, and check the network for a 401. |
| 14 | 3.5 | Linkding [#1451](https://github.com/sissbruecker/linkding/issues/1451) | [PR #1452](https://github.com/sissbruecker/linkding/pull/1452) | `b58a7bb0b8` → `96c4ef3f33` | 2026-08-18 | "Console shows: `Uncaught (in promise) Error: The response (200) did not contain the expected <turbo-frame id="tag-main">`" | Add a tagged bookmark, open Tags → Manage Tags, and click the bookmark count for that tag. |
| 15 | 3.4 | Actual [#7648](https://github.com/actualbudget/actual/issues/7648) | [PR #7672](https://github.com/actualbudget/actual/pull/7672) | `78d533c800` → `2c3e2a34fd` | 2026-05-04 | "Saved, still shows April data" | Using the demo budget, create a Spending Analysis (Live + Average), save it, edit it to compare an earlier month, save again, and reopen. |
| 16 | 3.3 | Actual [#9200](https://github.com/actualbudget/actual/issues/9200) | [PR #9205](https://github.com/actualbudget/actual/pull/9205) | `4ae0f078ed` → `1c852e4882` | 2026-10-14 | "if there is a category, it is cleared" when two transactions are linked as a transfer | Select one off-budget and one on-budget (categorised) transaction, choose "Make transfer", and check the category. |
| 17 | 3.2 | Memos [#6575](https://github.com/usememos/memos/issues/6575) | [PR #6576](https://github.com/usememos/memos/pull/6576) | `4beaad6e42` → `6251f8ae8e` | 2026-11-17 | "the copy button of a share link copies nothing and shows nothing … throws an unhandled rejection" | Open Memos over a **LAN IP over plain HTTP** (not localhost), create a share link, and click Copy. |
| 18 | 3.0 | Vikunja [#1437](https://github.com/go-vikunja/vikunja/issues/1437) | commit [cd711fd](https://github.com/go-vikunja/vikunja/commit/cd711fd11cf1ac94ed9c964292bb8e8ece576e31) | `9cc9991006` → `cd711fd11c` | 2025-09-09 | "Clicking away or navigating to another page will not save the description if you didn't hit 'Save'." | Open a task from the Kanban view, type a description, close the modal, and reopen the task. |
| 19 | 2.9 | Vikunja [#1392](https://github.com/go-vikunja/vikunja/issues/1392) | commit [411cfbe](https://github.com/go-vikunja/vikunja/commit/411cfbef92d6662b226f41b4b2e3b9a84138ea46) | `682096e5f6` → `411cfbef92` | 2025-09 (the commit was later rebased, so the committer date shows 2025-11-15) | "If the page is refreshed, some will be back on the original bucket" | Drag three tasks one by one into another Kanban bucket and reload. |
| 20 | 2.8 | Uptime Kuma [#3848](https://github.com/louislam/uptime-kuma/issues/3848) | [PR #3849](https://github.com/louislam/uptime-kuma/pull/3849) | `5b7206f8e2` → `b2439527de` | 2023-10-08 | "Saving the settings on a status page before all preferences have loaded causes said unloaded preferences to be removed" | Set a custom domain on a status page, reopen Edit, click Save immediately, and reload. This is a race. |
| 21 | 2.6 | Memos [#6525](https://github.com/usememos/memos/issues/6525) | [PR #6526](https://github.com/usememos/memos/pull/6526) | `abdeb8a57c` → `66501e9f75` | 2026-11-10 | "The server saved both and holds the second. The page stays that way until the memo is fetched again" | Pin and then quickly Unpin a memo on its detail page, and compare the UI with the state after a reload. This is a race. |
| 22 | 2.4 | Uptime Kuma [#7504](https://github.com/louislam/uptime-kuma/issues/7504) | [PR #7515](https://github.com/louislam/uptime-kuma/pull/7515) | `73f199f4bd` → `082f101cf4` | 2026-07-17 | "the Screenshot Delay field is emptied and no setting is being saved" | Edit a Browser Engine monitor, set Screenshot Delay, save, and reopen. This needs Chromium on the server. |
| 23 | 2.2 | Actual [#4900](https://github.com/actualbudget/actual/issues/4900) | [PR #4910](https://github.com/actualbudget/actual/pull/4910) | `2215c131a5` → `0431039eb6` | 2025-05-13 | "the transaction is sometimes saved with the original (unchanged) date … approx 50% of the time" | At mobile viewport, add a transaction, change the date, tap Add, and check the saved date. This is flaky. |
| 24 | 2.0 | Excalidraw [#11962](https://github.com/excalidraw/excalidraw/issues/11962) | [PR #11970](https://github.com/excalidraw/excalidraw/pull/11970) | `bee01e3a12` → `6f0a4d19b5` | 2026-10-20 | "no banner renders, and the scene silently stops persisting while the user keeps drawing. They find out on reload." | Fill localStorage, draw a shape, and reload. **Firefox only**, so it needs a Firefox-driving agent. |

### Rejected after reading (so nobody re-checks them)
- **Kanboard #5755, #5757 and #5689** (save spins forever or the comment is not saved): caused by third-party plugins (Group_assign, KanboardCommentActions), not by core code.
- **Uptime Kuma #6476** (tags appear only after the second save): the data *is* saved and only the sidebar list is stale, so it does not fit "not persisted".
- **Vikunja #312** ("G.update is not a function"): the error is shown to the user, so it is not silent.
- **Uptime Kuma #7975/#7976** (en-GB locale TypeError): no linked fix, and it needs the browser locale set to en-GB.
- **Trilium #11464** (deleting a Kanban column does not persist): a good symptom, but the issue does not identify a fix commit.
- **Memos #5642** (`.ps1` attachment fails): no linked fix commit.

---

## Top 8: verified notes

All flows assume a fresh clone in a temp directory. Agent check for every item: before = network 4xx/5xx, a console error, or state lost after reload; after = clean.

### 1. tududi #1045: Today-settings toggle returns 500
- **Diff:** `frontend/components/Task/TodaySettingsDropdown.tsx` sent `PUT profile/today-settings` without the `x-csrf-token` header; the fix adds `'x-csrf-token': await getCsrfToken()`. At the buggy SHA, `handleToggle` updates local state first and only logs `console.error('Failed to save settings')` when the save fails. The toggle looks switched, the network shows a 500 from lusca, and the value reverts on reload.
- **CSRF in dev:** CSRF is enforced in dev. The only exemption is `NODE_ENV==='test'` (`backend/app.js`).
- **Setup:** `git checkout a21e643842 && npm install && npm run db:init && npm run user:create test@example.com password123 && npm run backend:dev` (port 3001), plus `npm run frontend:dev` in a second terminal (port 8080).

### 2. tududi #1134: Task status change on the project page fails CSRF
- **Diff:** in `ProjectDetails.tsx`, `handleTaskUpdate` calls `fetch(PATCH task/<uid>)` with only `Content-Type`. When the response is not ok it throws `Error('Failed to update task')`, which surfaces as an uncaught promise rejection, and no toast appears. The fix adds the CSRF header (one file).
- **Setup:** same as #1 at `e2de8c332f`.

### 3. tududi #904: "Task title updated successfully" but the title is not saved
- **Diff:** `TaskDetails.tsx` called `updateTask(uid, { ...task, name })`. Spreading the whole task object broke the update while the success toast still showed. The fix sends only the changed field. The same pattern is fixed for note, project and subtasks, so those could be extra flows.
- **Weaker check:** the issue says "no request is sent", so the check is persistence after reload, not a 4xx.
- **Setup:** same as #1 at `47d270b242`.

### 4. Wallos #459: Delete in the edit modal throws a TypeError
- **Diff:** `scripts/dashboard.js` set `onClick="deleteSubscription(${id})"`, but the handler signature is `(event, id)`, so `event.stopPropagation` is undefined. The fix passes `event`. Nothing happens on screen; the only sign is the console TypeError.
- **Why it is top 8:** it is the simplest setup on the list, with no build step.
- **Setup:** PHP 8.2 with sqlite3, curl, gd, intl and zip: `git checkout d7af7cc18b && cp db/wallos.empty.db db/wallos.db && php -S localhost:8000`. Then open `http://localhost:8000/endpoints/db/migrate.php` once and register the first user at `/`.

### 5. Memos #5011: Theme change on a fresh install fails
- **Diff:** in `server/router/api/v1/user_service.go`, `UpdateUserSetting` returned `NotFound` when no GENERAL user-setting row existed yet, which is always true for a new user. On the frontend, `PreferencesSection.handleThemeChange` simply `await`s the store call with no try/catch. The result is an unhandled rejection in the console, a failed gRPC-web/Connect call in the network tab, and the theme reverts on reload.
- **Fresh data needed:** the bug needs a user with no saved settings, so do not use `--mode demo`.
- **Setup:** `git checkout 01d3f2f86c && go run ./bin/memos/main.go --mode dev --port 8081`, plus `cd web && pnpm i && pnpm dev` in a second terminal. Sign up; the first user becomes admin.

### 6. Uptime Kuma #3713: Saving a paused monitor silently resumes it
- **Diff:** a one-character class of bug in `server/server.js`: `if (bean.isActive())` tests a Promise, which is always truthy, so `restartMonitor` runs. The fix is `await bean.isActive()`. The UI shows the normal "Saved" toast, while the monitor is actually restarted and heartbeats resume.
- **Signal:** the state change shows up in the UI and the DB, not in the network or console. It is still a good "success, but wrong state persisted" case.
- **Setup:** Node 18: `git checkout 1f29fabe64 && npm ci && npm run dev`. Vite runs on :3000 and the server on :3001. The first visit asks you to create an admin. Monitor `http://localhost:3001` itself so no network access is needed.

### 7. Memos #4978: Preferences wiped on change (main-branch regression)
- **Diff:** in `web/src/store/user.ts`, `initialUserStore` called `fetchUserSettings()` before `currentUser` was set in the store. Settings therefore loaded empty, and any later preference update wrote that empty state back, wiping the other fields. The fix moves the call after `setPartial({currentUser})`. Nothing errors and the UI looks fine; the values are wrong after reload.
- **Setup:** same as #5 at `1f1add1a48`.

### 8. Memos #5865: Checkbox state lost when editing a memo
- **Diff (9 files):** the sanitizer schema dropped the `checked` attribute on `<input>`. Also, `useMemoInit` preferred a stale localStorage draft over the saved content, and `useAutoSave` re-wrote the just-saved content as a draft on unmount. Ticking a box saves it, but opening Edit loads the old unchecked draft, and saving that overwrites the server state.
- **Setup:** `git checkout d98f665919 && go run ./cmd/memos --port 8081`, plus `cd web && pnpm i && pnpm dev` (port 3001 at this commit). Alternative: `docker run -p 5230:5230 neosmemo/memos:0.27.1`.

### Setup cheat-sheet for the other apps
- **Actual:** `yarn install && yarn start` runs browser-only, with no server needed. Use "View demo" for data.
- **Linkding:** `pip install -r requirements.txt && npm ci && npm run build && python manage.py migrate && python manage.py createsuperuser && python manage.py runserver`.
- **Vikunja:** needs the Go API (`mage build` or a release binary with SQLite) and `cd frontend && pnpm dev`, so it is the heaviest setup on the list.
- **Excalidraw:** `yarn && yarn start`.
