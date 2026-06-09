import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'icons');
const svgPath = join(iconsDir, 'icon.svg');
const svg = readFileSync(svgPath, 'utf8');

mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const png = resvg.render().asPng();
  const outPath = join(iconsDir, `icon${size}.png`);
  writeFileSync(outPath, png);
  console.log(`generate-icons: ${outPath}`);
}

console.log('generate-icons: OK');
