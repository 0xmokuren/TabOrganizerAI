import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const requiredTopLevel = [
  'manifest_version',
  'default_locale',
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

const defaultLocale = manifest.default_locale;
const defaultMessagesPath = join(root, '_locales', defaultLocale, 'messages.json');
if (!existsSync(defaultMessagesPath)) {
  throw new Error(`default_locale の messages.json が見つかりません: ${defaultMessagesPath}`);
}

const masterMessages = JSON.parse(readFileSync(defaultMessagesPath, 'utf8'));
const masterKeys = Object.keys(masterMessages).sort();

const localesDir = join(root, '_locales');
const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const requiredLocales = ['en', 'ja', 'de', 'es', 'fr'];
for (const locale of requiredLocales) {
  if (!locales.includes(locale)) {
    throw new Error(`_locales/${locale} がありません`);
  }

  const messagesPath = join(localesDir, locale, 'messages.json');
  if (!existsSync(messagesPath)) {
    throw new Error(`messages.json が見つかりません: _locales/${locale}/messages.json`);
  }

  const messages = JSON.parse(readFileSync(messagesPath, 'utf8'));
  const keys = Object.keys(messages).sort();
  const missing = masterKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !masterKeys.includes(key));

  if (missing.length > 0) {
    throw new Error(`_locales/${locale}/messages.json に不足キー: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    throw new Error(`_locales/${locale}/messages.json に余分なキー: ${extra.join(', ')}`);
  }
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
