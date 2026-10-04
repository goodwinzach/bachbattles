// Screenshot helper for visual review. Usage:
//   node tests/shot.mjs <name> [--w 1440] [--h 900] [--dark|--light] [--hash run] [--full] [--eval "js"] [--click "selector"]...
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const name = args[0] ?? 'shot';
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const w = parseInt(opt('--w', '1440'), 10);
const h = parseInt(opt('--h', '900'), 10);
const scheme = args.includes('--light') ? 'light' : 'dark';
const hash = opt('--hash', 'run');
const full = args.includes('--full');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
// serve Google Fonts from the local cache (tests/.fonts) so screenshots use the real faces
await page.route('https://fonts.googleapis.com/**', async (route) =>
  route.fulfill({ status: 200, contentType: 'text/css', body: await readFile('tests/.fonts/fonts.css', 'utf8') }),
);
await page.route('https://fonts.gstatic.com/**', async (route) => {
  const f = route.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_');
  try {
    await route.fulfill({ status: 200, contentType: 'font/woff2', body: await readFile('tests/.fonts/' + f) });
  } catch {
    await route.abort();
  }
});
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + resolve('dist/index.html') + '#' + hash);
await page.waitForTimeout(600);
await page.evaluate(() => document.fonts.ready);
for (const step of args.flatMap((a, i) => (a === '--click' || a === '--eval' || a === '--wait' || a === '--key' ? [[a, args[i + 1]]] : []))) {
  const [kind, val] = step;
  if (kind === '--click') await page.click(val, { timeout: 4000 }).catch((e) => errors.push('click failed: ' + val + ' ' + e.message.split('\n')[0]));
  if (kind === '--eval') await page.evaluate(val).catch((e) => errors.push('eval failed: ' + e.message));
  if (kind === '--wait') await page.waitForTimeout(parseInt(val, 10));
  if (kind === '--key') await page.keyboard.press(val);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await page.screenshot({ path: `tests/screens/${name}.png`, fullPage: full });
console.log(`${name}: ${w}x${h} ${scheme} overflowX=${overflow}px errors=${errors.length}`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
