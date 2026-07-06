import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const astroBin = path.join(process.cwd(), 'node_modules', 'astro', 'astro.js');

if (!existsSync(astroBin)) {
  console.error('Astro is not installed yet. Run `pnpm install` first.');
  process.exit(1);
}

const child = spawn(process.execPath, [astroBin, ...process.argv.slice(2)], {
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1'
  },
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Astro command stopped with signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
