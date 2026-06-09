import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const requiredTopLevel = [
  'manifest_version',
  'name',
  'version',
  'description',
  'permissions',
  'action',
  'background',
  'icons',
];

for (const key of requiredTopLevel) {
  if (!(key in manifest)) {
    throw new Error(`manifest.json に ${key} がありません`);
  }
}

if (manifest.manifest_version !== 3) {
  throw new Error('manifest_version は 3 である必要があります');
}

const referencedFiles = new Set([
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.action.default_icon ?? {}),
  ...Object.values(manifest.icons ?? {}),
]);

for (const relativePath of referencedFiles) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`manifest が参照するファイルが見つかりません: ${relativePath}`);
  }
}

const requiredPermissions = ['tabs', 'tabGroups'];
for (const permission of requiredPermissions) {
  if (!manifest.permissions.includes(permission)) {
    throw new Error(`permissions に ${permission} が必要です`);
  }
}

console.log('validate: OK');
