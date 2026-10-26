// Renders the SVG icon sources to the PNG sizes a PWA needs, using the
// Playwright Chromium that ships with the dev dependencies.
// Usage: npm run icons
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  { src: 'scripts/icon.svg', out: 'public/pwa-192x192.png', size: 192, transparent: true },
  { src: 'scripts/icon.svg', out: 'public/pwa-512x512.png', size: 512, transparent: true },
  { src: 'scripts/icon-maskable.svg', out: 'public/maskable-512x512.png', size: 512 },
  { src: 'scripts/icon-apple.svg', out: 'public/apple-touch-icon.png', size: 180 },
  { src: 'scripts/icon.svg', out: 'public/favicon-48x48.png', size: 48, transparent: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  const svg = await readFile(join(root, job.src), 'utf8');
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${job.size}" height="${job.size}" `)}</body></html>`,
  );
  await page.screenshot({ path: join(root, job.out), omitBackground: !!job.transparent, clip: { x: 0, y: 0, width: job.size, height: job.size } });
  console.log('✓', job.out);
}
await browser.close();
