// Smoke test: opens the built app (dist/index.html) in Chromium and exercises every view in both
// themes at phone and desktop sizes, then walks the edit path end to end: change an item's state in
// one place and check it lands everywhere, rename a character, undo, reload, roll dice, search.
// Usage: npm test   (builds first; set CHROMIUM_PATH to use a specific browser binary)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const URL_BASE = 'file://' + resolve('dist/index.html');
const VIEWS = ['run', 'story', 'map', 'slides', 'cast', 'codex', 'rules'];

let failures = 0;
function check(cond, msg, detail) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.log(`  ✗ ${msg}${detail ? `\n      ${detail}` : ''}`);
  }
}

async function open(browser, { w = 1440, h = 900, scheme = 'dark', hash = 'run' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  // stay offline: the page falls back to system fonts
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${URL_BASE}#${hash}`);
  await page.waitForSelector('.view', { timeout: 8000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
try {
  // ── 1. every view, both themes, phone + desktop ─────────────────────────
  for (const scheme of ['dark', 'light']) {
    for (const [w, h, label] of [
      [1440, 900, 'desktop'],
      [390, 844, 'phone'],
    ]) {
      console.log(`\nViews: ${label} ${scheme}`);
      const { ctx, page, errors } = await open(browser, { w, h, scheme });
      for (const v of VIEWS) {
        await page.evaluate((v) => (location.hash = v), v);
        await page.waitForTimeout(350);
        const text = await page.$eval('.view', (el) => el.textContent?.length ?? 0);
        const ox = await overflowX(page);
        check(text > 200 && ox <= 0 && errors.length === 0, `${v}: renders, no sideways scroll, no errors`, `text=${text} overflowX=${ox} errors=${errors.join(' | ')}`);
      }
      await ctx.close();
    }
  }

  // ── 2. map modes and slides ────────────────────────────────────────────
  console.log('\nMap and slides');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'map' });
    for (const mode of ['Story flow', 'Connections', 'Pacing']) {
      await page.click(`.map__bar [role=tab]:has-text("${mode}")`);
      await page.waitForTimeout(500);
      const marks = await page.$$eval('.view svg *', (els) => els.length);
      check(marks > 20 && errors.length === 0, `map "${mode}" draws`, `svg nodes=${marks} errors=${errors.join(' | ')}`);
    }
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForTimeout(400);
    const first = await page.getAttribute('.stage', 'aria-label');
    await page.click('.stage__nav--next');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const third = await page.getAttribute('.stage', 'aria-label');
    check(first !== third && /\(3 of \d+\)/.test(third ?? ''), 'slides advance by button and arrow key', `${first} -> ${third}`);
    await ctx.close();
  }

  // ── 3. edit propagation ───────────────────────────────────────────────
  console.log('\nEdit propagation');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'codex' });
    const go = async (v) => {
      await page.evaluate((v) => (location.hash = v), v);
      await page.waitForTimeout(300);
    };
    const tab = (name) => page.click(`.codex__tabs button:has-text("${name}")`);
    const maskCard = () => page.$eval('.card--item:has(.card__name:text-is("Spider-Man Mask"))', (el) => el.className);

    await page.keyboard.press('e');
    check(await page.$eval('.app', (el) => el.classList.contains('is-editing')), 'E turns on edit mode');

    // one state change...
    await tab('Items');
    await page.selectOption('select[aria-label="Spider-Man Mask state"]', 'lost');
    await page.waitForTimeout(150);
    check((await maskCard()).includes('card--state-lost'), 'item card shows the new state');

    // ...shows up everywhere it matters
    await tab('Abilities');
    const sense = await page.$eval('.abil:has(.abil__name:text-is("Spider-Sense"))', (el) => el.className);
    check(sense.includes('abil--locked'), 'Codex: Spider-Sense locks without the mask', sense);
    await tab('Party');
    const spideyBtn = page.locator('.card--pc .maskpick__btn:has-text("Spider-Man")');
    check(await spideyBtn.isDisabled(), 'Codex: Flynn can no longer pick the lost mask');
    const cha = await page.$eval('.card--pc .stat:has(.stat__abbr:text-is("CHA")) .stat__val', (el) => el.textContent);
    check(cha !== '+100', 'losing a mask is not the voluntary "Unmasked" (+100 CHA) beat', `CHA=${cha}`);
    await go('run');
    const tag = await page.$eval('.abtag:has-text("Spider-Sense")', (el) => el.className);
    check(tag.includes('abtag--locked'), 'Run: party panel shows Spider-Sense locked', tag);
    check(await page.locator('.member .maskpick__btn:has-text("Spider-Man")').isDisabled(), 'Run: mask picker greys out the lost mask');

    // rename a character in the drawer editor; every mention updates
    await go('codex');
    await tab('Characters');
    await page.click('.card__name:text-is("Louise Banks")');
    await page.waitForSelector('.drawer.is-on #ed-npc-louise-name');
    await page.fill('#ed-npc-louise-name', 'Louise Lou-Lou Banks');
    await page.press('#ed-npc-louise-name', 'Enter');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    check(await page.$('.card__name:text-is("Louise Lou-Lou Banks")'), 'Codex: card shows the new name');
    await go('story');
    const names = await page.$$eval('[data-ref="npc:louise"]', (els) => els.map((e) => e.textContent));
    check(names.length > 0 && names.every((n) => n?.includes('Lou-Lou')), 'Script: every mention uses the new name', names.join(' / '));

    // undo twice: the name, then the mask
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const undone = await page.$$eval('[data-ref="npc:louise"]', (els) => els.map((e) => e.textContent));
    check(undone.length > 0 && undone.every((n) => n === 'Louise Banks'), 'undo restores the name', undone.join(' / '));
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    await go('codex');
    await tab('Items');
    check((await maskCard()).includes('card--state-equipped'), 'undo puts the mask back on');

    // redo, then reload: the change persists
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(600);
    await page.reload();
    await page.waitForSelector('.view');
    await page.waitForTimeout(300);
    await tab('Items');
    check((await maskCard()).includes('card--state-lost'), 'redo re-applies it, and it survives a reload');
    check(errors.length === 0, 'no console errors while editing', errors.join(' | '));
    await ctx.close();
  }

  // ── 4. character profiles and portraits ────────────────────────────────
  console.log('\nCharacter profiles');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'cast' });
    const tiles = await page.$$eval('.ctile', (els) => els.length);
    const faces = await page.$$eval('.ctile .face img', (els) => els.filter((i) => i.complete && i.naturalWidth > 0).length);
    check(tiles >= 46 && faces >= 30, 'cast gallery shows everyone, with portraits', `tiles=${tiles} portraits=${faces}`);

    await page.click('.ctile:has(.ctile__name:text-is("Lou Bloom"))');
    await page.waitForSelector('.phero--page');
    const lou = await page.evaluate(() => ({
      name: document.querySelector('.phero__name')?.textContent,
      from: document.querySelector('.phero .srcline')?.textContent,
      quotes: document.querySelectorAll('.quote').length,
      mask: document.querySelector('.phero__mask')?.getAttribute('title'),
      hash: location.hash,
    }));
    check(lou.name === 'Lou Bloom' && /Nightcrawler/.test(lou.from ?? '') && lou.quotes >= 3, 'profile page: name, source and lines', JSON.stringify(lou));
    check(lou.mask === 'Wearing the V Mask' && lou.hash === '#cast/npc/lou', 'masked Lou wears the V mask; the page has its own link', JSON.stringify(lou));
    const bible = await page.evaluate(() => ({
      eyebrow: document.querySelector('.phero__eyebrow')?.textContent,
      where: document.querySelector('.phero__where')?.textContent,
      traits: document.querySelectorAll('.phero .trait').length,
      situations: !!document.querySelector('.prof__ifs'),
      fight: document.querySelector('.prof__fight')?.textContent,
      improv: !!document.querySelector('[id], .xp') && [...document.querySelectorAll('.xp__title')].some((t) => t.textContent === 'Improvising them'),
    }));
    check(
      /Main villain/.test(bible.eyebrow ?? '') && !!bible.where && bible.traits >= 3 && bible.situations && /social/.test(bible.fight ?? '') && bible.improv,
      'profile carries the character reference: type, location, traits, situations, fight intent, improv help',
      JSON.stringify(bible),
    );
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const nextName = await page.textContent('.phero__name');
    check(nextName && nextName !== 'Lou Bloom', 'arrow keys page through the cast', `next=${nextName}`);

    await page.goto(`${URL_BASE}#cast/npc/bartender`);
    await page.waitForSelector('.phero--page');
    const unknown = await page.$$eval('.knowgrid__col--no li', (els) => els.map((e) => e.textContent));
    check(unknown.some((t) => /ring/.test(t ?? '')), 'profiles list what a character does not know', unknown.join(' / '));
    await page.goto(`${URL_BASE}#cast/npc/odysseus`);
    await page.waitForSelector('.phero--page');
    check(!!(await page.$('.statblock')), 'Odysseus now has a stat block');

    // a mention anywhere opens the same profile in the drawer, with a jump to the full page
    await page.evaluate(() => (location.hash = 'story'));
    await page.waitForTimeout(300);
    await page.click('[data-ref="npc:louise"] >> nth=0');
    await page.waitForSelector('.drawer.is-on .phero');
    const drawer = await page.evaluate(() => ({
      name: document.querySelector('.drawer.is-on .phero__name')?.textContent,
      img: !!document.querySelector('.drawer.is-on .phero .face img'),
      quotes: document.querySelectorAll('.drawer.is-on .quote').length,
    }));
    check(drawer.name === 'Louise Banks' && drawer.img && drawer.quotes > 0, 'clicking a name opens their profile with portrait and lines', JSON.stringify(drawer));
    await page.click('.drawer.is-on button:has-text("Full profile")');
    await page.waitForSelector('.cast--page .phero__name');
    check((await page.evaluate(() => location.hash)) === '#cast/npc/louise' && !(await page.$('.drawer.is-on')), '"Full profile" opens the page and closes the drawer');

    // state shows on the portrait: Flynn's mask, a defeated boss
    await page.goto(`${URL_BASE}#cast/pc/flynn`);
    await page.waitForSelector('.phero__mask');
    await page.click('.prof .maskpick__btn:has-text("Batman")');
    await page.waitForTimeout(150);
    check((await page.getAttribute('.phero__mask', 'title')) === 'Wearing the Batman Cowl', "switching Flynn's mask updates his portrait badge");
    await page.goto(`${URL_BASE}#cast/npc/kingpin`);
    await page.waitForSelector('.phero--page');
    if (!(await page.$eval('.app', (el) => el.classList.contains('is-editing')))) await page.keyboard.press('e');
    await page.waitForSelector('.phero select');
    await page.selectOption('.phero select', 'defeated');
    await page.waitForTimeout(150);
    await page.click('button:has-text("All cast")');
    const kp = await page.$eval('.ctile:has(.ctile__name:text-is("Kingpin"))', (el) => el.className);
    check(kp.includes('ctile--out'), 'a defeated character greys out in the gallery', kp);

    // the editor's portrait picker changes the picture everywhere; undo brings it back
    await page.goto(`${URL_BASE}#cast/npc/narrator`);
    await page.waitForSelector('.phero--page .phero__face .face img');
    await page.click('.phero__open');
    await page.waitForSelector('.drawer.is-on .portpick');
    await page.click('.drawer.is-on .portpick__none');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(!(await page.$('.phero--page .phero__face .face')), 'choosing "no picture" swaps the portrait for the icon');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    check(!!(await page.$('.phero--page .phero__face .face img')), 'undo restores the portrait');

    // portraits show up across the app
    await page.evaluate(() => (location.hash = 'run'));
    await page.waitForTimeout(300);
    const runFaces = await page.$$eval('.member__head .face img', (els) => els.length);
    check(runFaces === 5, 'run screen: the party shows their portraits', `faces=${runFaces}`);
    await page.keyboard.press('5');
    await page.waitForTimeout(200);
    check((await page.evaluate(() => location.hash)).startsWith('#cast'), 'key 5 opens the Cast view');
    check(errors.length === 0, 'no console errors on the profile pages', errors.join(' | '));
    await ctx.close();
  }

  // ── 5. palette, dice, shield, scene flow ───────────────────────────────
  console.log('\nTools');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'run' });
    await page.keyboard.press('Control+k');
    await page.fill('.palette__input', 'medusa');
    await page.waitForTimeout(150);
    const hits = await page.$$eval('.palette__item', (els) => els.map((e) => e.textContent));
    check(hits.length > 0 && hits.some((t) => /medusa/i.test(t ?? '')), 'palette finds Medusa', hits.slice(0, 3).join(' / '));
    await page.keyboard.press('Enter');
    await page.waitForSelector('.drawer.is-on', { timeout: 2000 }).catch(() => {});
    check(await page.$('.drawer.is-on'), 'Enter opens the result in the drawer');
    await page.keyboard.press('Escape');

    const before = await page.$eval('.slate__title', (el) => el.textContent).catch(() => '');
    await page.keyboard.press(']');
    await page.waitForTimeout(300);
    const after = await page.$eval('.slate__title', (el) => el.textContent).catch(() => '');
    check(before && after && before !== after, '] completes the scene and moves to the next', `${before} -> ${after}`);
    await page.keyboard.press(']');
    await page.waitForTimeout(200);
    const undoBtns = await page.$$eval('.toast', (els) => els.map((e) => !!e.querySelector('.toast__btn')));
    check(undoBtns.length >= 2 && undoBtns.filter(Boolean).length === 1 && undoBtns[undoBtns.length - 1], 'only the newest toast offers Undo', JSON.stringify(undoBtns));

    // a check in the script opens the dice tray preset to its stat and DC
    const chip = page.locator('.view .check').first();
    const chipDc = (await chip.locator('.check__dc').textContent())?.replace(/\D/g, '');
    await chip.click();
    await page.waitForSelector('.dicetray', { timeout: 2000 }).catch(() => {});
    const trayDc = await page.inputValue('.dicetray input[aria-label="Difficulty class"]').catch(() => null);
    check(trayDc === chipDc, 'clicking a check opens the dice tray at its DC', `chip DC ${chipDc}, tray DC ${trayDc}`);
    await page.click('.dicetray .dice__pc >> nth=1');
    await page.click('.dicetray .dice__go');
    const total = await page.$eval('.dicetray .rollres__total', (el) => el.textContent).catch(() => null);
    const verdict = await page.$eval('.dicetray .rollres__out', (el) => el.textContent).catch(() => '');
    check(total != null && /^-?\d+$/.test(total.trim()) && /success|fail|safe|stone|natural/i.test(verdict ?? ''), 'rolling shows a total and a pass/fail', `total=${total} verdict=${verdict}`);
    await page.keyboard.press('Escape');

    await page.keyboard.press('h');
    await page.waitForTimeout(150);
    check(await page.$eval('.app', (el) => el.classList.contains('is-shielded')), 'H raises the spoiler shield');
    await page.evaluate(() => (location.hash = 'codex'));
    await page.click('.codex__tabs button:has-text("Abilities")');
    const hidden = await page.$$eval('.abil--secret', (els) => els.length);
    check(hidden > 0, 'the shield hides secret abilities', `hidden=${hidden}`);

    // a character's drawer lists their connections and can jump to them on the web
    await page.evaluate(() => (location.hash = 'codex'));
    await page.click('.codex__tabs button:has-text("Characters")');
    await page.click('.card__name:text-is("Tyler Durden")');
    const rels = await page.$$eval('.drawer.is-on .rels__row', (els) => els.length);
    check(rels >= 3, 'drawer lists story connections', `rows=${rels}`);
    await page.click('.drawer.is-on button:has-text("On the web")');
    await page.waitForTimeout(700);
    const card = await page.$eval('.mapcard__title', (el) => el.textContent).catch(() => null);
    check(card === 'Tyler Durden', '"On the web" opens the connections web with them selected', `card=${card}`);

    // the studio gauntlet version switch re-routes the whole script
    await page.evaluate(() => (location.hash = 'story'));
    await page.waitForTimeout(300);
    const catOut = () => page.$eval('.toc__scene:has-text("The Cat in the Hat")', (el) => el.classList.contains('is-out'));
    check(await catOut(), 'outline version: the Cat in the Hat is off the route');
    await page.click('.topbar button[aria-label*="ore"]');
    await page.click('text=Settings & campaign options');
    await page.click('button:has-text("Expanded build")');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(!(await catOut()), 'expanded build: the Cat in the Hat joins the route');
    check(errors.length === 0, 'no console errors using the tools', errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
