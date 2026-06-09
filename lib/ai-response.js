import { t } from './i18n.js';

const JSON_FALLBACK_SUFFIX =
  '\n\n出力は JSON のみ。形式: {"groups":[{"name":"短い名前","color":"blue","tabIndices":[0,1]}]}';

export function appendJsonFallbackInstruction(prompt) {
  return `${prompt}${JSON_FALLBACK_SUFFIX}`;
}

export function parseModelJson(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    throw new Error(t('errorEmptyAiResponse'));
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(t('errorInvalidJson'));
  }
}
