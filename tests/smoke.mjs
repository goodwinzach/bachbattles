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
    // the story flow opens scenes into branches, and branches into more branches
    await page.click('.map__bar [role=tab]:has-text("Story flow")');
    await page.waitForTimeout(300);
    const dot = await page.$eval('.fnode .rec', (el) => getComputedStyle(el).position).catch(() => 'missing');
    check(dot === 'static', 'the now-playing dot sits in the scene card, not on top of its number', dot);
    await page.click('.fnode:has-text("The Green Dragon") >> nth=0');
    await page.waitForSelector('.xroot');
    const branches = await page.$$eval('.xnode', (els) => els.map((e) => e.textContent ?? ''));
    check(
      (await page.textContent('.xroot__title')) === 'The Green Dragon' && branches.length >= 8 && branches.some((t) => /Green Dragon Inn/.test(t)),
      'clicking a scene opens it with its branches, starting with the location',
      `branches=${branches.length}`,
    );
    await page.click('.xnode__main:has-text("Characters")');
    await page.click('.xnode__main:has-text("Edward Norton")');
    await page.click('.xnode__main:has-text("Dialogue options")');
    await page.click('.xnode__main:has-text("Asked his name")');
    await page.waitForTimeout(400);
    const lines = await page.$$eval('.xnode--line', (els) => els.map((e) => e.textContent ?? ''));
    check(lines.length === 3 && lines.some((t) => /Pick one/.test(t)), 'branches open level by level, down to single lines of dialogue', lines.join(' / '));
    await page.click('.xnode:has(.xnode__main:has-text("Characters")) .xnode__toggle');
    await page.waitForTimeout(300);
    check((await page.$$('.xnode--line')).length === 0 && !!(await page.$('.xroot')), 'closing a branch closes everything under it');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(!(await page.$('.xroot')), 'Esc closes what was opened last');
    // the view may have panned away from these; dispatch the clicks directly
    await page.locator('.fnode:has-text("Abbott & Costello")').first().dispatchEvent('click');
    await page.locator('.fnode:has-text("The Gentlemen")').first().dispatchEvent('click');
    await page.waitForTimeout(300);
    const roots = (await page.$$('.xroot')).length;
    await page.click('.mapctl button[title="Close every open node"]');
    await page.waitForTimeout(200);
    check(roots === 2 && (await page.$$('.xroot, .xnode')).length === 0, 'several scenes can be open at once; one button closes them all', `open=${roots}`);

    // scenes can be dragged somewhere else; the spot is saved, undoable and resettable
    await page.click('.mapctl button[title="Fit everything"]');
    await page.waitForTimeout(200);
    const gd = page.locator('.fnode:has-text("The Green Dragon")').first();
    const at = async () => gd.evaluate((el) => `${el.style.left},${el.style.top}`);
    const start = await at();
    const b = await gd.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height / 2 + 40, { steps: 6 });
    await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 80, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const moved = await at();
    check(moved !== start && !(await page.$('.xroot')), 'dragging a scene moves it (and does not open it)', `${start} -> ${moved}`);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    check((await at()) === start, 'undo puts the scene back', await at());
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    await page.click('.mapctl button[aria-label="Put every scene back in place"]');
    await page.waitForTimeout(200);
    check((await at()) === start, '"Put every scene back in place" resets the layout', await at());

    // double-click empty space for a note: it attaches to the nearest scene
    const vp = await page.locator('.mapvp').boundingBox();
    await page.mouse.dblclick(vp.x + vp.width * 0.45, vp.y + vp.height * 0.18);
    await page.waitForSelector('.mnote textarea');
    await page.keyboard.type('Something to remember.');
    await page.mouse.click(vp.x + 20, vp.y + 20);
    await page.waitForTimeout(250);
    const attach = await page.evaluate(() => {
      const n = document.querySelector('.mnote').getBoundingClientRect();
      const px = n.left + n.width / 2;
      const py = n.top + 16;
      let best = '';
      let bestD = Infinity;
      for (const el of document.querySelectorAll('.fnode')) {
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        if (dx * dx + dy * dy < bestD) {
          bestD = dx * dx + dy * dy;
          best = el.querySelector('.fnode__title')?.textContent ?? '';
        }
      }
      return { label: document.querySelector('.mnote__scene')?.textContent, nearest: best };
    });
    check(!!attach.label && attach.label.includes(attach.nearest), 'a double-click adds a note attached to the nearest scene', JSON.stringify(attach));
    await page.click('.mnote__del');
    await page.waitForTimeout(200);
    check(!(await page.$('.mnote')), 'notes can be deleted');
    // a note from a scene's card belongs to that scene and shows with it on the Run screen
    await page.locator('.fnode:has-text("The Green Dragon")').first().dispatchEvent('click');
    await page.waitForSelector('.xroot');
    await page.click('.xroot button:has-text("Note")');
    await page.waitForSelector('.mnote textarea');
    await page.keyboard.type('Ask who broke the floor before Michael does.');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    await page.evaluate(() => (location.hash = 'run'));
    await page.click('.strip__s >> nth=2');
    await page.waitForTimeout(250);
    const runNotes = await page.$$eval('.mapnotes__note', (els) => els.map((e) => e.textContent));
    check(runNotes.some((t) => /broke the floor/.test(t ?? '')), 'the note shows with its scene on the Run screen', runNotes.join(' / '));
    check(errors.length === 0, 'no console errors on the story flow', errors.join(' | '));

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
      lines: document.querySelectorAll('.prof__talk .dlg__opt').length,
      situations: document.querySelectorAll('.prof__talk .dlg__card').length,
      mask: document.querySelector('.phero__mask')?.getAttribute('title'),
      hash: location.hash,
    }));
    check(lou.name === 'Lou Bloom' && /Nightcrawler/.test(lou.from ?? '') && lou.situations >= 5 && lou.lines >= 15, 'profile page: name, source and dialogue options by situation', JSON.stringify(lou));
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
      tabs: document.querySelectorAll('.drawer.is-on .dlg__tab').length,
      lines: document.querySelectorAll('.drawer.is-on .dlg__opt').length,
    }));
    check(drawer.name === 'Louise Banks' && drawer.img && drawer.tabs >= 4 && drawer.lines >= 2, 'clicking a name opens their profile with portrait and dialogue options', JSON.stringify(drawer));
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
    await page.goto(`${URL_BASE}#cast/npc/norton`);
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

  // ── 4b. renamed entities, secrets, dialogue options ────────────────────
  console.log('\nRenames and dialogue');
  {
    // a save from before the renames still uses the old ids; its edits must carry over
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const patches = { 'npc:narrator': { dmNote: 'Old note about the bar guy' }, 'item:donuts': { state: 'held', holder: 'party', qty: 3 } };
      localStorage.setItem('orf-dm/v1/data', JSON.stringify({ v: 1, patches, created: {}, game: { scene: 'green-dragon' }, log: [], savedAt: 1 }));
    });
    const page = await ctx.newPage();
    const errors = [];
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${URL_BASE}#cast/npc/norton`);
    await page.waitForSelector('.phero--page');
    const norton = await page.evaluate(() => ({
      name: document.querySelector('.phero__name')?.textContent,
      src: document.querySelector('.phero .srcline')?.textContent ?? '',
      note: (document.querySelector('.prof')?.textContent ?? '').includes('Old note about the bar guy'),
    }));
    check(norton.name === 'Guy who looks like Edward Norton', 'the bar guy is now "Guy who looks like Edward Norton"', JSON.stringify(norton));
    check(norton.note, 'edits saved under his old id carry over', JSON.stringify(norton));
    check(/Fight Club/.test(norton.src) && /secret/i.test(norton.src), 'his Fight Club tie shows only as a DM secret', norton.src);
    await page.keyboard.press('h');
    await page.waitForTimeout(200);
    const hidden = await page.evaluate(() => ({ src: document.querySelector('.phero .srcline')?.textContent ?? '', rels: document.querySelectorAll('.rels__row').length }));
    check(/Origin unknown/.test(hidden.src) && hidden.rels === 0, 'the spoiler shield hides where he is from and who he really is', JSON.stringify(hidden));
    await page.keyboard.press('h');
    await page.click('.castnav button:has-text("All cast"), .castnav a:has-text("All cast")').catch(() => page.evaluate(() => (location.hash = 'cast')));
    await page.waitForSelector('.ctile');
    const tile = await page.$eval('.ctile:has-text("Edward Norton")', (el) => el.textContent ?? '');
    check(!/Fight Club|Tyler|Narrator/i.test(tile), 'his gallery tile gives nothing away', tile);

    await page.evaluate(() => (location.hash = 'run'));
    await page.waitForSelector('.talk');
    const run = await page.evaluate(() => ({
      text: document.querySelector('.monitor')?.innerText ?? '',
      who: document.querySelectorAll('.talk__pick').length,
      side: document.querySelector('.run__side')?.textContent ?? '',
    }));
    check(!/narrator/i.test(run.text) && /Edward Norton/.test(run.text), 'the Green Dragon never calls him the narrator', '');
    check(/Everything Bagels/.test(run.side) && !/Donut/i.test(run.side), 'bagels replace donuts, and a saved donut count carries over', run.side.slice(0, 300));
    check(run.who === 6, "the scene's dialogue panel offers everyone at the bar", `who=${run.who}`);
    await page.click('.talk__pick:has-text("Edward Norton")');
    await page.click('.talk .dlg__tab:has-text("Asked his name")');
    const opts = await page.$$eval('.talk .dlg__opt', (els) => els.length);
    await page.click('.talk .dlg__opt >> nth=0');
    await page.click('.talk .dlg__foot button:has-text("Pick one")');
    const st = await page.evaluate(() => ({
      said: document.querySelectorAll('.talk .dlg__opt.is-said').length,
      picked: document.querySelector('.talk .dlg__opt.is-picked')?.classList.contains('is-said'),
    }));
    check(opts >= 3 && st.said === 1 && st.picked === false, 'dialogue: several lines per situation; mark one as said; the dice picks an unused one', JSON.stringify({ opts, ...st }));

    // the editor writes dialogue options like any other field, and undo takes them back
    await page.click('.castcard .ref:has-text("Edward Norton")');
    await page.waitForSelector('.drawer.is-on .phero');
    await page.click('.drawer.is-on button:has-text("Edit")');
    await page.waitForSelector('.drawer.is-on .dlgedit');
    await page.click('.drawer.is-on .dlgedit > .btn:has-text("Add a situation")');
    await page.waitForTimeout(150);
    const added = await page.$$eval('.drawer.is-on .dlgedit__cue', (els) => els.length);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    check(added === 7, 'the editor adds a dialogue situation', `situations=${added}`);
    check(errors.length === 0, 'no console errors with renames and dialogue', errors.join(' | '));
    await ctx.close();
  }

  // ── 4c. locations ──────────────────────────────────────────────────────
  console.log('\nLocations');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'run' });
    await page.click('.strip__s >> nth=2');
    await page.waitForSelector('.locbanner img');
    const banner = await page.$eval('.locbanner', (el) => el.textContent ?? '');
    check(/Green Dragon Inn/.test(banner), 'each scene opens with its location picture', banner);
    await page.click('.locbanner');
    await page.waitForSelector('.drawer.is-on .locpic--hero img');
    const loc = await page.evaluate(() => ({
      scenes: document.querySelectorAll('.drawer.is-on .chip[data-ref^="scene:"]').length,
      people: document.querySelectorAll('.drawer.is-on .chip[data-ref^="npc:"]').length,
    }));
    check(loc.scenes === 3 && loc.people >= 6, 'the location page lists its scenes and who the party meets there', JSON.stringify(loc));
    await page.keyboard.press('Escape');
    await page.evaluate(() => (location.hash = 'codex'));
    await page.click('button[role=tab]:has-text("Locations")');
    await page.waitForSelector('.card--loc');
    const cards = await page.$$eval('.card--loc .locpic > img', (els) => els.length);
    check(cards === 10, 'the Codex has a card with a picture for every location', `cards=${cards}`);
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('.frame');
    const places = await page.$$eval('.frame--place', (els) => els.length);
    check(places >= 8, 'the slides cut to an establishing shot whenever the story moves', `places=${places}`);
    await page.goto(`${URL_BASE}#cast/npc/odysseus`);
    await page.waitForSelector('.phero--page');
    const where = await page.$$eval('.prof__places [data-ref^="location:"]', (els) => els.map((e) => e.textContent));
    check(where.length >= 3, 'profiles show where to find a character', where.join(', '));
    check(errors.length === 0, 'no console errors with locations', errors.join(' | '));
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

    // table aids: who has waited longest for the spotlight, and a recap after a break
    await page.evaluate(() => (location.hash = 'run'));
    await page.waitForSelector('.spot__pc');
    await page.click('.spot__pc >> nth=0');
    await page.waitForTimeout(150);
    const hint = await page.textContent('.spot__hint');
    check(/waited longest/.test(hint ?? '') && !/^Flynn/.test(hint ?? ''), 'the spotlight panel points at whoever has waited longest', hint);
    await page.click('.sessionpanel button:has-text("Recap")');
    await page.waitForSelector('.recap');
    const recap = await page.$$eval('.recap__scenes li', (els) => els.length);
    check(recap >= 1, 'the recap lists what has happened so far', `scenes=${recap}`);
    await page.keyboard.press('Escape');

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

    // the Cat in the Hat always follows Toothless
    await page.evaluate(() => (location.hash = 'story'));
    await page.waitForTimeout(300);
    const catOut = await page.$eval('.toc__scene:has-text("The Cat in the Hat")', (el) => el.classList.contains('is-out'));
    const order = await page.$$eval('.toc__scene', (els) => els.map((e) => e.textContent ?? ''));
    const ti = order.findIndex((t) => /Toothless/.test(t));
    check(!catOut && /Cat in the Hat/.test(order[ti + 1] ?? ''), 'the Cat in the Hat is on the route, right after Toothless', order[ti + 1]);
    check(errors.length === 0, 'no console errors using the tools', errors.join(' | '));
    await ctx.close();
  }

  // ── 6. the table rules the app enforces ────────────────────────────────
  console.log('\nTable rules');
  {
    const { ctx, page, errors } = await open(browser, { hash: 'run' });
    const jump = async (id) => {
      await page.selectOption('.slate__pick', id);
      await page.waitForTimeout(250);
    };
    const title = () => page.textContent('.slate__h');
    const member = (name) => page.locator(`.member:has(.member__name:text-is("${name}"))`);
    const statusOf = (name) => member(name).evaluate((el) => [...el.classList].find((c) => c.startsWith('member--')));

    // nobody dies before the island: 0 HP knocks them out, and they are back when the scene ends
    for (let i = 0; i < 10 && (await member('Dude Bro').locator('.member__hpnum').textContent())?.trim().split('/')[0] !== '0'; i++) {
      await page.click('[aria-label="Dude Bro minus 5 HP"]');
    }
    check((await statusOf('Dude Bro')) === 'member--down', 'before the island, 0 HP knocks a groomsman out instead of killing him', await statusOf('Dude Bro'));
    await page.keyboard.press(']');
    await page.waitForTimeout(250);
    const back = (await member('Dude Bro').locator('.member__hpnum').textContent())?.trim();
    check((await statusOf('Dude Bro')) === 'member--alive' && /^1\//.test(back ?? ''), 'he is back at 1 HP once the scene ends', `${await statusOf('Dude Bro')} ${back}`);

    // ...also when the DM jumps ahead with the scene picker
    for (let i = 0; i < 10 && (await member('Dude Bro').locator('.member__hpnum').textContent())?.trim().split('/')[0] !== '0'; i++) {
      await page.click('[aria-label="Dude Bro minus 5 HP"]');
    }
    await jump('costello');
    check((await statusOf('Dude Bro')) === 'member--alive', 'jumping to another scene also gets a knocked-out groomsman up', await statusOf('Dude Bro'));

    // Costello: each fact shows the question that pulls it and his answer; three questions and he is gone
    const qa = await page.$$eval('.fact', (els) => els.map((e) => [e.querySelector('.fact__q')?.textContent, e.querySelector('.fact__a')?.textContent]));
    check(qa.length === 4 && qa.every(([q]) => q) && qa.filter(([, a]) => a).length === 3, 'each Costello fact shows its question and his answer (the riddle is its own answer)', JSON.stringify(qa[0]));
    for (const n of [0, 1, 2]) await page.click(`.qpip >> nth=${n}`);
    check(/That was three/.test((await page.textContent('.widget:has(.qpip)')) ?? ''), 'after the third question the widget says Abbott and Costello are gone');

    // the route has to be picked before moving on
    await jump('route-choice');
    await page.keyboard.press(']');
    await page.waitForTimeout(250);
    const toastText = await page.$$eval('.toast', (els) => els.map((e) => e.textContent).join(' | '));
    check((await title()) === 'Plane or Boat?' && /Pick the route first/.test(toastText), '"Done, next" at the crossroads asks for the route first', `${await title()} / ${toastText}`);

    // a fight shows its round plan and how it ends, and says so once it runs long
    await jump('gentlemen');
    await page.click('.encounter >> nth=0 >> button:has-text("Start fight")');
    await page.click('.modal button:has-text("Roll initiative")');
    await page.waitForSelector('.combat');
    const round = await page.textContent('.combat__round');
    check(/Round 1/.test(round ?? '') && /of 2–4/.test(round ?? '') && (await page.$('.combat__ends')), 'the combat tracker shows the planned rounds and how the fight ends', round);
    const turns = await page.$$eval('.combat__list > li', (els) => els.length);
    for (let i = 0; i < turns * 4; i++) await page.click('.combat button:has-text("Next turn")');
    check(/Past the plan/.test((await page.textContent('.combat__ends')) ?? ''), 'a fight past its planned rounds says to wrap it up', await page.textContent('.combat__round'));
    await page.click('.combat button:has-text("End fight")');

    // sin rooms lead back to Gluttony
    await jump('pride');
    await page.keyboard.press(']');
    await page.waitForTimeout(250);
    check((await title()) === 'Gluttony', 'finishing a sin room goes next to Gluttony', await title());

    // the studio: the wipe tracker takes people out, and no bagels inside the Volume
    await jump('oh-dae-su');
    check(/One has to fall/.test((await page.textContent('.view')) ?? ''), 'Oh Dae-su shows the wipe tracker');
    await page.click('.widget:has-text("One has to fall") button:has-text("Takes them out") >> nth=0');
    await page.click('.widget:has-text("One has to fall") button:has-text("Takes them out") >> nth=0');
    await page.waitForTimeout(200);
    const ghosts = await page.$$eval('.member--ghost', (els) => els.length);
    check(ghosts === 2, '"Takes them out" turns groomsmen into ghosts after the island', `ghosts=${ghosts}`);
    check(/No bagel revivals/.test((await page.textContent('.view')) ?? ''), 'inside the Volume the bagels stay in the bag');
    await jump('epilogue');
    await page.click('.widget button:has-text("Need a stunt?")');
    const stunt = await page.textContent('.stunt__text').catch(() => '');
    check((stunt ?? '').length > 10, 'the bagel shop suggests a stunt when the table runs out of ideas', stunt);
    for (let i = 0; i < 4 && (await page.$('button:has-text("Stunt done")')); i++) {
      await page.click('button:has-text("Stunt done") >> nth=0');
      await page.waitForTimeout(150);
    }
    check((await page.$$eval('.member--ghost', (els) => els.length)) === 0, 'at the bagel shop, Flynn brings each friend back with his own stunt');

    // no matter what, everyone leaves Gluttony alive and at full health
    await jump('toothless');
    await page.click('.widget:has-text("A few fall") button:has-text("Takes them out") >> nth=0');
    await jump('gluttony');
    await page.click('.effect:has-text("No matter what") button');
    await page.waitForTimeout(200);
    const after = await page.$$eval('.member', (els) => els.map((e) => [e.className, e.querySelector('.member__hpnum')?.textContent?.trim()]));
    check(after.every(([c, hp]) => /member--alive/.test(c) && /^(\d+)\/\1$/.test(hp ?? '')), 'the Gluttony feast brings everyone back at full HP', JSON.stringify(after));

    // Medusa's entrance stays off the table deck until she is met
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('.frame');
    const tableMedusa = await page.$$eval('.frame[title="Medusa"]', (els) => els.length);
    await page.click('.slides__bar button:has-text("DM deck")');
    await page.waitForTimeout(200);
    const dmMedusa = await page.$$eval('.frame.is-secret[title="Medusa"]', (els) => els.length);
    check(tableMedusa === 0 && dmMedusa === 1, "Medusa's entrance slide is DM-only until she is met", `table=${tableMedusa} dm=${dmMedusa}`);

    // every DM slide fits its frame, and the must-happen box never sits on the read-aloud
    const frames = await page.$$eval('.frame', (els) => els.length);
    const bad = [];
    for (let i = 0; i < frames; i++) {
      await page.evaluate((i) => document.querySelectorAll('.frame')[i].click(), i);
      await page.waitForTimeout(80);
      const issue = await page.evaluate(() => {
        const stage = document.querySelector('.stage')?.getBoundingClientRect();
        const sl = document.querySelector('.stage__slide .sl');
        if (!stage || !sl || sl.matches('.sl--credits, .sl--place')) return null;
        const read = sl.querySelector('.sl__read')?.getBoundingClientRect();
        const must = sl.querySelector('.sl__must')?.getBoundingClientRect();
        if (read && must && must.top < read.bottom - 1) return 'must box over the read-aloud';
        const spill = [...sl.querySelectorAll('h2, p, li, blockquote, .sl__eyebrow')].find((el) => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && (r.top < stage.top - 1 || r.bottom > stage.bottom + 1);
        });
        return spill ? `"${spill.textContent?.slice(0, 30)}" spills out of the frame` : null;
      });
      if (issue) bad.push(`#${i + 1} ${await page.textContent('.frame.is-on .frame__title')}: ${issue}`);
    }
    check(bad.length === 0, 'every DM slide fits its frame, must-happen boxes below the text', bad.slice(0, 4).join(' | '));
    check(errors.length === 0, 'no console errors running the table rules', errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
