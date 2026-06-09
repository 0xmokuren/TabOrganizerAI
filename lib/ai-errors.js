import { t } from './i18n.js';

const UNKNOWN_AI_ERROR_PATTERN =
  /kErrorUnknown|UnknownError|unknown error occurred|Other generic failures/i;

export function isUnknownAiError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  return UNKNOWN_AI_ERROR_PATTERN.test(message)
    || name === 'UnknownError';
}

export function formatAiError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (isUnknownAiError(error)) {
    return t('unknownChromeAiError');
  }

  if (message.includes('JSON')) {
    return message;
  }

  return message;
}
