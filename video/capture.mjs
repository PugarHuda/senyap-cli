// Record the live pages for the video (headless Chromium): public/clips/<name>.webm
//   node capture.mjs [name ...]   (no names: all clips)
import { chromium } from 'playwright';
import { mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./public/clips/', import.meta.url));
const TMP = fileURLToPath(new URL('./.capture-tmp/', import.meta.url));
const W = 1440, H = 900;
const pause = (page, ms) => page.waitForTimeout(ms);
const glide = (page, px, ms = 1600) => page.evaluate(([px, ms]) => new Promise((done) => {
  const y0 = scrollY, t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, y0 + px * (0.5 - Math.cos(Math.PI * k) / 2)); k < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
}), [px, ms]);
const typeSlow = async (page, sel, text) => { await page.click(sel); await page.keyboard.type(text, { delay: 70 }); };

// Real Kane Test Manager share links from runs in this project (see README / landing page).
const KANE_BUGGY = 'https://test-manager.lambdatest.com/projects/01M81V2EG0623DQRHQE21PDZQ2/test-cases/01M820WAC7X9K2F2G23VNWRS9A/dashboard/share/US_MUV4PFPQ6NDVT1WSMSX8FLF2HZ4XOIXTJGCHNOVNBO4Q3F09QO2WKB9I2PMQE7NM?type=summary&agentView=true&fqdn=summary-page';

const clips = {
  // the buggy demo: the user sees "Saved!"
  async save(page) {
    await page.goto('https://senyap-demo.vercel.app/', { waitUntil: 'networkidle' });
    await pause(page, 1200);
    await typeSlow(page, '#text', "Don't forget the milk");
    await pause(page, 500);
    await page.click('button');
    await pause(page, 3500);
  },
  // the landing hero: lift the screen
  async lift(page) {
    await page.goto('https://senyap-cli.vercel.app/', { waitUntil: 'networkidle' });
    await pause(page, 2500);
    await page.click('#peek');
    await pause(page, 4500);
  },
  // Kane's own record of the hosted buggy run
  async kane(page) {
    await page.goto(KANE_BUGGY, { waitUntil: 'networkidle', timeout: 60000 });
    await pause(page, 5000);
    await glide(page, 500, 2500); await pause(page, 3000);
  },
  // the fixed demo saves for real
  async fixed(page) {
    await page.goto('https://senyap-demo.vercel.app/fixed/', { waitUntil: 'networkidle' });
    await pause(page, 1000);
    await typeSlow(page, '#text', "Don't forget the milk");
    await page.click('button');
    await pause(page, 1500);
    await page.reload({ waitUntil: 'networkidle' });
    await pause(page, 2500);
  },
  // the GitHub Action: buggy job red-as-expected, fixed job green
  async ci(page) {
    await page.goto('https://github.com/PugarHuda/senyap-cli/actions/runs/45044916800', { waitUntil: 'networkidle', timeout: 60000 });
    await pause(page, 5000);
  },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(clips);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const name of names) {
  rmSync(TMP, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: TMP, size: { width: W, height: H } }, colorScheme: 'light' });
  const page = await ctx.newPage();
  try { await clips[name](page); } catch (e) { console.error(name, e.message); }
  await ctx.close();
  const f = readdirSync(TMP).find((x) => x.endsWith('.webm'));
  renameSync(TMP + f, OUT + name + '.webm');
  console.log('clip', name);
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
