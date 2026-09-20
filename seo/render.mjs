// Renders the OG images and icons in static/ from the HTML next to this file.
// Playwright is not a dependency of this repo: point PLAYWRIGHT at an installed copy, e.g.
//   PLAYWRIGHT=../verysmallwoods/node_modules/playwright/index.mjs node seo/render.mjs [og] [og-jev] [og-cookbook] [icons]
// With no targets every asset is rendered.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const here = (f) => pathToFileURL(new URL(f, import.meta.url).pathname).href;
const out = (f) => new URL(`../static/${f}`, import.meta.url).pathname;
const targets = new Set(process.argv.slice(2));
const want = (t) => targets.size === 0 || targets.has(t);
const b = await chromium.launch();
async function shot(html, file, width, height) {
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await p.goto(here(html));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out(file) });
  await p.close();
  console.log('wrote', file);
}
// OG 1200×630, one per page
if (want('og')) await shot('./og.html', 'og.png', 1200, 630);
if (want('og-jev')) await shot('./og-jev.html', 'og-jev.png', 1200, 630);
if (want('og-cookbook')) await shot('./og-cookbook.html', 'og-cookbook.png', 1200, 630);
// icons
if (want('icons')) for (const [name, size] of [['favicon-32.png', 32], ['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) await shot('./icon.html', name, size, size);
await b.close();
