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
    return [
      'AI 処理中に Chrome 内部エラーが発生しました。',
      '拡張機能を再読み込みするか、タブ数を減らして再試行してください。',
      '改善しない場合は chrome://on-device-internals → Model Status を確認し、Chrome を再起動してください。',
    ].join(' ');
  }

  if (message.includes('JSON')) {
    return message;
  }

  return message;
}
