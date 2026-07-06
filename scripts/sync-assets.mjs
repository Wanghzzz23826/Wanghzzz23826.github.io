import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const pairs = [
  ['assets', 'public/assets'],
  ['images', 'public/images']
];

for (const [source, target] of pairs) {
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, force: true });
}

console.log('Synced static assets into public/.');
