import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const here = (f) => pathToFileURL(new URL(f, import.meta.url).pathname).href;
const out = (f) => new URL(`../static/${f}`, import.meta.url).pathname;
const b = await chromium.launch();
// OG 1200×630
let p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.goto(here('./og.html')); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out('og.png') }); await p.close();
// icons
for (const [name, size] of [['favicon-32.png', 32], ['favicon-192.png', 192], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
  p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.goto(here('./icon.html')); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out(name) }); await p.close();
}
await b.close(); console.log('ok');
