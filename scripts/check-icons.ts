/**
 * Lists every item id that has no icon file in public/icons/ yet.
 * Run: npm run check-icons
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = resolve(root, 'public/icons');
const items = JSON.parse(readFileSync(resolve(root, 'src/data/items.json'), 'utf8')) as {
  id: string;
  name: string;
  hidden?: boolean;
}[];

const present = new Set(existsSync(iconsDir) ? readdirSync(iconsDir) : []);
const missing = items.filter((i) => !present.has(`${i.id}.png`));
const known = new Set(items.map((i) => `${i.id}.png`));
const extra = [...present].filter((f) => f.endsWith('.png') && !known.has(f));

if (missing.length === 0) {
  console.log(`All ${items.length} items have an icon.`);
} else {
  console.log(`${missing.length} of ${items.length} items have no icon in public/icons/ yet:`);
  for (const i of missing) console.log(`  ${i.id}.png  (${i.name}${i.hidden ? ', hidden in the picker' : ''})`);
}
if (extra.length) {
  console.log(`\nThese files do not match any item id: ${extra.join(', ')}`);
}
