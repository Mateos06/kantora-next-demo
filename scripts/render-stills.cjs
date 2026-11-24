// Renders stills of each building model from the running app.
//
//   npm run dev
//   npm run renders                       (or: node scripts/render-stills.cjs <base url>)
//
// Output in public/renders/:
//   <model>-day.jpg, <model>-dusk.jpg   the scene as shown in the viewer (hero, sidebar)
//   <model>.webp                         the bare building on a transparent background (project cards)
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'public', 'renders');
// One project per model file is enough: projects that share a model share its stills.
const MODELS = [
  { project: 'lakeview', stem: 'lakeview' },
  { project: 'durres', stem: 'aba' },
  { project: 'astir', stem: 'toptani' },
];
// Show only the 3D scene: no controls, pins or tags, and a larger canvas.
const CLEAN = `
  .timeline-bar, .viewer-dock, .floor-card, .canvas-loader, .evidence-pin, .floor-tag,
  .model-layout > aside, nextjs-portal { display: none !important; }
  .model-layout { grid-template-columns: 1fr !important; }
  .model-canvas { height: 820px !important; }
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1080 } });
  await page.goto(BASE + '/director');
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.addStyleTag({ content: CLEAN });
  const canvas = page.locator('.model-canvas canvas');

  for (const { project, stem } of MODELS) {
    await page.getByLabel('Project', { exact: true }).selectOption(project);
    await page.getByText('Model ready · local GLB loaded').waitFor({ timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: 'Reset view' }).click();
    for (const light of ['Day', 'Dusk']) {
      await page.getByRole('button', { name: light, exact: true }).click();
      await page.waitForTimeout(3500);
      const file = path.join(OUT, `${stem}-${light.toLowerCase()}.jpg`);
      await canvas.screenshot({ path: file, type: 'jpeg', quality: 86 });
      console.log('wrote', path.relative(process.cwd(), file));
    }
    await page.getByRole('button', { name: 'Day', exact: true }).click();
  }

  // Cutouts: `?still` makes the viewer draw only the building, on a transparent canvas.
  await page.goto(BASE + '/director?still');
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.addStyleTag({ content: CLEAN });
  for (const { project, stem } of MODELS) {
    await page.getByLabel('Project', { exact: true }).selectOption(project);
    await page.getByText('Model ready · local GLB loaded').waitFor({ timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await page.waitForTimeout(3500);
    // Crop to the building and scale down in the page, so no image library is needed.
    const url = await page.evaluate(() => {
      const source = document.querySelector('.model-canvas canvas');
      const full = document.createElement('canvas');
      full.width = source.width;
      full.height = source.height;
      const ctx = full.getContext('2d');
      ctx.drawImage(source, 0, 0);
      const { data } = ctx.getImageData(0, 0, full.width, full.height);
      let x0 = full.width,
        y0 = full.height,
        x1 = 0,
        y1 = 0;
      for (let y = 0; y < full.height; y++)
        for (let x = 0; x < full.width; x++)
          if (data[(y * full.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      const w = x1 - x0 + 1,
        h = y1 - y0 + 1;
      const scale = Math.min(1, 720 / h);
      const out = document.createElement('canvas');
      out.width = Math.round(w * scale);
      out.height = Math.round(h * scale);
      const o = out.getContext('2d');
      o.imageSmoothingQuality = 'high';
      o.drawImage(full, x0, y0, w, h, 0, 0, out.width, out.height);
      return out.toDataURL('image/webp', 0.9);
    });
    const file = path.join(OUT, stem + '.webp');
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', path.relative(process.cwd(), file));
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
