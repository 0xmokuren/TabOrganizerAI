import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const stagingDir = join(distDir, 'TabOrganizerAI');
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const zipFileName = `TabOrganizerAI-${version}.zip`;
const zipPath = join(distDir, zipFileName);

const includePaths = [
  'manifest.json',
  'background',
  'lib',
  'popup',
  'icons',
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

for (const path of includePaths) {
  cpSync(join(root, path), join(stagingDir, path), { recursive: true });
}

execFileSync('zip', ['-r', join('..', zipFileName), '.'], { cwd: stagingDir });

if (!existsSync(zipPath)) {
  throw new Error(`ビルド成果物が見つかりません: ${zipPath}`);
}

console.log(`build: ${zipPath}`);
