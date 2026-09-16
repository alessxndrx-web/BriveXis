/**
 * Rasterizes scripts/og-image.svg to public/og-image.png at 1200x630.
 *
 * Crawlers and chat clients do not render SVG link previews, so the PNG is the
 * asset that actually ships; the SVG stays the editable source. sharp is only
 * needed to run this script, which is why it is not a project dependency:
 *   npx --yes sharp@0.34.4 ...   (or `npm i --no-save sharp` first)
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('./og-image.svg', import.meta.url));

const png = await sharp(svg, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(new URL('../public/og-image.png', import.meta.url), png);
console.log(`public/og-image.png written (${(png.length / 1024).toFixed(1)} kB)`);
