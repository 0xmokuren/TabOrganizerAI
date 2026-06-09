import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stagingDir = join(root, 'dist', 'TabOrganizerAI');
const zipPath = join(root, 'dist', 'TabOrganizerAI.zip');

const includePaths = [
  'manifest.json',
  'background',
  'lib',
  'popup',
  'icons',
];

rmSync(join(root, 'dist'), { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const path of includePaths) {
  cpSync(join(root, path), join(stagingDir, path), { recursive: true });
}

execFileSync('zip', ['-r', zipPath, '.'], { cwd: stagingDir });
console.log(`package: ${zipPath}`);
