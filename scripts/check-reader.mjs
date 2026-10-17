/* Usage: PLAYWRIGHT_MODULE=/path/to/package.json node scripts/check-reader.mjs
   Optional: READER_URL, READER_PROOF_DIR, PLAYWRIGHT_BROWSERS_PATH. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(process.env.PLAYWRIGHT_MODULE || import.meta.url);
const { chromium, webkit } = require('playwright');
const base = process.env.READER_URL || 'http://127.0.0.1:4338/';
const proof = process.env.READER_PROOF_DIR || path.join(root, 'verkferlar/2026-10-17-heimskaut-lesari/lesaraprof');
await mkdir(proof, { recursive: true });
const catalogue = JSON.parse(await readFile(path.join(root, 'ARCTIC/sogur.json'), 'utf8'));
const source = JSON.parse(await readFile(path.join(root, 'ARCTIC/heimildir.json'), 'utf8'));
const report = { base, time: new Date().toISOString(), checks: [], errors: [] };
const check = (name, detail) => { report.checks.push({ name, detail }); console.log(`PASS ${name}`); };
const url = (id, page = 1) => `${base}?hofundur=${encodeURIComponent(id)}&sida=${page}`;
const ready = async (page, id, number) => {
  await page.waitForFunction(({ id, number }) => {
    const reader = document.getElementById('reader');
    const image = document.getElementById('page-image');
    return reader.dataset.ready === 'true' && reader.dataset.story === id && reader.dataset.page === String(number) && image.complete && image.naturalWidth > 0;
  }, { id, number });
};
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
const expectImage = async (page, data) => {
  assert.ok((await page.locator('#page-image').getAttribute('src')).endsWith(data.read.src));
  const dimensions = await page.locator('#page-image').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight, fit: getComputedStyle(image).objectFit }));
  assert.equal(dimensions.width, data.read.width);
  assert.equal(dimensions.height, data.read.height);
  assert.equal(dimensions.fit, 'contain');
};

assert.equal(catalogue.stories.length, 12);
assert.equal(catalogue.stories.reduce((sum, story) => sum + story.pages.length, 0), 83);
const imageIds = new Set();
for (let i = 0; i < source.stories.length; i++) {
  const original = source.stories[i], story = catalogue.stories[i];
  assert.equal(story.id, original.id);
  assert.equal(story.author, original.author);
  assert.equal(story.pages.length, original.pages.length);
  for (let p = 0; p < story.pages.length; p++) {
    const page = story.pages[p], provenance = original.pages[p];
    const bytes = await readFile(path.join(root, 'ARCTIC', page.original.src));
    assert.equal(page.number, p + 1);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sha256);
    assert.equal(page.original.sha256, provenance.sha256);
    imageIds.add(provenance.imageId);
    for (const kind of ['read', 'thumb']) assert.equal((await readFile(path.join(root, 'ARCTIC', page[kind].src))).length, page[kind].bytes);
  }
}
assert.equal(imageIds.size, 83);
check('83 original images preserved byte for byte; all derivatives and author/page order match');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('.story-card a').href.startsWith(location.origin));
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.story-card').count(), 12);
  assert.equal(requests.some(src => src.includes('-frum.')), false);
  assert.equal(requests.some(src => new URL(src).origin !== new URL(base).origin), false);
  assert.equal(await page.locator('.story-caption').allTextContents().then(captions => captions.some(text => /\d/.test(text))), false);
  assert.equal(await page.locator('.story-trail:visible').count(), 0);
  await noOverflow(page);
  await page.screenshot({ path: path.join(proof, 'library-desktop.png'), fullPage: true });
  check('Library: 12 authors, local font/art, no original images downloaded on entry');

  let readPages = 0;
  for (const story of catalogue.stories) {
    await page.goto(url(story.id));
    for (let n = 1; n <= story.pages.length; n++) {
      if (n > 1) await page.locator('#next-page').click();
      await ready(page, story.id, n);
      assert.equal(await page.locator('#reader-author').textContent(), story.author);
      await expectImage(page, story.pages[n - 1]);
      readPages++;
    }
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    assert.equal(await page.locator('#story-end').isVisible(), true);
  }
  check('Every page loads and decodes in the right order', { stories: 12, pages: readPages });

  const breki = catalogue.stories[0];
  await page.goto(url('breki'));
  await ready(page, 'breki', 1);
  await page.keyboard.press('ArrowRight');
  await ready(page, 'breki', 2);
  await page.keyboard.press('ArrowLeft');
  await ready(page, 'breki', 1);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) document.getElementById('next-page').click(); });
  await ready(page, 'breki', 5);
  await expectImage(page, breki.pages[4]);
  assert.equal(await page.locator('#page-counter').innerText(), '');
  assert.equal(await page.locator('#reader-trail i').count(), 8);
  assert.equal(await page.locator('#reader-trail i.is-current').evaluate(marker => [...marker.parentElement.children].indexOf(marker)), 4);
  await page.locator('#page-counter').click();
  assert.equal(await page.locator('.thumbnail-button').count(), 8);
  assert.equal(await page.locator('.thumbnail-button[aria-current=page]').getAttribute('aria-label'), 'Síða 5');
  assert.equal(await page.locator('.thumbnail-button').allTextContents().then(labels => labels.join('').trim()), '');
  await page.getByRole('button', { name: 'Síða 4', exact: true }).click();
  await ready(page, 'breki', 4);
  assert.equal(await page.locator('#pages-dialog').isVisible(), false);
  check('Keyboard, rapid navigation and page overview select the correct image');

  const originalRequestsBefore = requests.filter(src => src.includes('-frum.')).length;
  await page.locator('#zoom-page').click();
  await page.waitForFunction(() => document.getElementById('zoom-image').src.includes('-frum.') && document.getElementById('zoom-image').naturalWidth > 0);
  assert.ok((await page.locator('#zoom-image').getAttribute('src')).endsWith(breki.pages[3].original.src));
  assert.equal(requests.filter(src => src.includes('-frum.')).length, originalRequestsBefore + 1);
  const before = await page.locator('#zoom-image').evaluate(image => image.clientWidth);
  await page.locator('#zoom-in').click();
  assert.ok(await page.locator('#zoom-image').evaluate(image => image.clientWidth) > before);
  await page.locator('#zoom-frame').evaluate(frame => { frame.scrollLeft = 100; frame.scrollTop = 200; });
  assert.ok(await page.locator('#zoom-frame').evaluate(frame => frame.scrollTop) > 0);
  await page.screenshot({ path: path.join(proof, 'zoom-desktop.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#zoom-dialog').isVisible(), false);
  await page.waitForFunction(() => !document.body.classList.contains('dialog-open'));
  check('Zoom loads the original only on demand, supports magnification/panning and Escape');

  await page.locator('#share-story').click();
  await page.waitForFunction(() => document.getElementById('action-status').textContent.includes('afritaður'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url('breki', 4));
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('clipboard unavailable'); }; });
  await page.locator('#share-story').click();
  await page.locator('#share-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#share-url').inputValue(), url('breki', 4));
  await page.keyboard.press('Escape');
  check('Share link includes author and page; manual copy works when clipboard is unavailable');

  await page.goto(url('vigdís', 999));
  await ready(page, 'vigdis', 8);
  assert.ok(page.url().includes('hofundur=vigdis&sida=8'));
  await page.goto(url('gabriela', -8));
  await ready(page, 'gabriela', 1);
  await page.goto(url('unknown', 1));
  await page.locator('#library-status').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#library').isVisible(), true);
  check('Legacy accented names, out-of-range pages and unknown authors are handled');

  await page.goto(url('breki', 3));
  await ready(page, 'breki', 3);
  await page.reload();
  await ready(page, 'breki', 3);
  await page.locator('#all-stories').click();
  await page.reload();
  const savedStory = page.locator('.story-card[data-story=breki]');
  await savedStory.locator('[data-story-trail]').waitFor({ state: 'visible' });
  assert.equal(await savedStory.locator('a').getAttribute('href'), url('breki', 3));
  assert.equal(await savedStory.locator('[data-story-trail]').getAttribute('data-position'), '3');
  assert.equal(await savedStory.locator('.story-bookmark').isVisible(), true);
  assert.equal(await savedStory.locator('i.is-current').evaluate(marker => [...marker.parentElement.children].indexOf(marker)), 2);
  await savedStory.locator('a').click();
  await ready(page, 'breki', 3);
  await page.goBack();
  assert.equal(await page.locator('#library').isVisible(), true);
  await page.locator('.story-card[data-story=gabriela] a').click();
  await ready(page, 'gabriela', 1);
  await page.goBack();
  await page.waitForFunction(() => !document.getElementById('library').hidden && scrollY > 0);
  check('Saved reading position, reload, browser Back and library scroll restoration');

  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: width > 700 ? 1024 : 844 });
    await page.goto(base);
    await noOverflow(page);
    await page.goto(url('embla', 2));
    await ready(page, 'embla', 2);
    await noOverflow(page);
    const controlsFit = await page.locator('.reader-bar .drawn-control').evaluateAll(buttons => buttons.every(button => {
      const frame = button.querySelector('.button-frame').getBoundingClientRect(), box = button.getBoundingClientRect();
      return Math.abs(frame.width - box.width) < 3 && Math.abs(frame.height - box.height) < 3;
    }));
    assert.equal(controlsFit, true, 'Drawn outlines must enclose the complete touch controls');
    await page.locator('#page-counter').click();
    await noOverflow(page);
    await page.keyboard.press('Escape');
    if (width === 390) await page.screenshot({ path: path.join(proof, 'reader-mobile.png') });
    if (width === 1024) await page.screenshot({ path: path.join(proof, 'reader-ipad.png') });
  }
  check('No horizontal overflow at 320, 390, 768 and 1024 pixels');
  await context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touch = await touchContext.newPage();
  await touch.goto(url('breki'));
  await ready(touch, 'breki', 1);
  const cdp = await touchContext.newCDPSession(touch);
  const box = await touch.locator('#page-image').boundingBox();
  const y = Math.round(box.y + box.height / 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 310, y }] });
  for (const x of [275, 230, 180, 125]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ready(touch, 'breki', 2);
  assert.equal(await touch.locator('#zoom-dialog').isVisible(), false);
  await touch.locator('#page-art').tap();
  // A second deliberate tap after the swipe suppression period opens magnification.
  if (!await touch.locator('#zoom-dialog').isVisible()) {
    await touch.waitForTimeout(750);
    await touch.locator('#page-art').tap();
  }
  await touch.locator('#zoom-dialog').waitFor({ state: 'visible' });
  await noOverflow(touch);
  await touch.screenshot({ path: path.join(proof, 'zoom-mobile.png') });
  check('Real browser touch events swipe pages; swipe does not trigger zoom; tap opens zoom');
  await touchContext.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } }));
  const unavailable = await blocked.newPage();
  await unavailable.goto(url('breki'));
  await ready(unavailable, 'breki', 1);
  await unavailable.locator('#next-page').click();
  await ready(unavailable, 'breki', 2);
  check('Reading and navigation work with local storage disabled');
  await blocked.close();

  const retryContext = await browser.newContext();
  const retry = await retryContext.newPage();
  const blockedImage = `**/${breki.pages[0].read.src}`;
  await retry.route(blockedImage, route => route.abort());
  await retry.goto(url('breki'));
  await retry.locator('#page-error').waitFor({ state: 'visible' });
  assert.equal(await retry.evaluate(() => localStorage.getItem('arctic.bref.v1')), null);
  await retry.unroute(blockedImage);
  await retry.locator('#retry-page').click();
  await ready(retry, 'breki', 1);
  check('Failed image can be retried; a failed page does not overwrite reading progress');
  await retryContext.close();
} finally { await browser.close(); }

const safari = await webkit.launch({ headless: true });
try {
  const context = await safari.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(`WebKit: ${error.message}`));
  for (const story of catalogue.stories) {
    await page.goto(url(story.id));
    await ready(page, story.id, 1);
    await noOverflow(page);
    await page.locator('#page-counter').click();
    await page.getByRole('button', { name: `Síða ${story.pages.length}`, exact: true }).click();
    await ready(page, story.id, story.pages.length);
    await expectImage(page, story.pages.at(-1));
    assert.equal(await page.locator('#story-end').isVisible(), true);
  }
  await page.locator('#zoom-page').click();
  await page.locator('#zoom-dialog').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const image = document.getElementById('zoom-image');
    return image.src.includes('-frum.') && image.complete && image.naturalWidth > 0;
  });
  await page.locator('#zoom-image').evaluate(image => image.decode());
  // WebKit can finish decoding before its scrolling layer has painted the image.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(proof, 'webkit-mobile-zoom.png') });
  await page.getByRole('button', { name: 'Loka stækkun', exact: true }).click();
  await page.locator('#all-stories').click();
  await noOverflow(page);
  await page.screenshot({ path: path.join(proof, 'webkit-mobile-library.png'), fullPage: true });
  check('WebKit phone: all 12 authors, first/last pages, overview, originals and return to library');
  await context.close();
} finally { await safari.close(); }
assert.deepEqual(report.errors, []);
report.passed = true;
await writeFile(path.join(proof, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, checks: report.checks.length, proof }));
