import {
  MAX_TABS_PER_REQUEST,
  RESPONSE_SCHEMA,
} from './constants.js';
import { buildPrompt, validatePlan } from './tab-manager.js';

export const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['ja', 'en'] }],
  expectedOutputs: [{ type: 'text', languages: ['ja', 'en'] }],
};

const STATUS_MESSAGES = {
  unavailable:
    'オンデバイス AI が利用できません。設定 → システム → オンデバイス AI を確認してください',
  downloadable:
    'モデルを準備します。「タブを分析」の操作でダウンロードが始まります',
  downloading:
    'AI モデルをダウンロード中です。この画面を開いたままお待ちください…',
  available: '利用可能',
  readily: '利用可能',
  'after-download':
    'モデルを準備します。「タブを分析」の操作でダウンロードが始まります',
};

function normalizeStatus(status) {
  if (status === 'readily') {
    return 'available';
  }
  if (status === 'after-download') {
    return 'downloadable';
  }
  return status;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkAiAvailability() {
  if (!globalThis.LanguageModel) {
    return {
      status: 'unavailable',
      message:
        'Prompt API がこの Chrome では利用できません（Chrome 138 以上が必要）',
    };
  }

  try {
    const rawStatus = await LanguageModel.availability(LANGUAGE_OPTIONS);
    const status = normalizeStatus(rawStatus);

    return {
      status,
      rawStatus,
      message: STATUS_MESSAGES[rawStatus] || STATUS_MESSAGES[status] || rawStatus,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitWhileDownloading(onStatus, maxWaitMs = 30 * 60 * 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const rawStatus = await LanguageModel.availability(LANGUAGE_OPTIONS);
    const status = normalizeStatus(rawStatus);
    onStatus?.(status, rawStatus);

    if (status === 'unavailable') {
      throw new Error(STATUS_MESSAGES.unavailable);
    }

    if (status !== 'downloading') {
      return status;
    }

    await sleep(2000);
  }

  throw new Error(
    'モデルのダウンロードがタイムアウトしました。Chrome を再起動してから再度お試しください',
  );
}

async function createSession(onDownloadProgress) {
  return LanguageModel.create({
    ...LANGUAGE_OPTIONS,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        if (!onDownloadProgress) {
          return;
        }
        const percent = Math.round((event.loaded || 0) * 100);
        onDownloadProgress(percent, event.loaded);
      });
    },
  });
}

function wrapSessionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('unable to create a session')) {
    return error instanceof Error ? error : new Error(message);
  }

  return new Error(
    [
      'AI セッションを開始できませんでした。',
      '① chrome://extensions で TabOrganizerAI の「更新」を押す',
      '② 設定 → システム → オンデバイス AI をオン',
      '③ chrome://on-device-internals で Model Status を確認',
      '④ Wi‑Fi 接続・空き 22GB 以上・Chrome 再起動',
    ].join(' '),
  );
}

export async function suggestGroups(tabs, { onDownloadProgress, onStatus } = {}) {
  if (tabs.length < 2) {
    throw new Error('グループ化するには未整理タブが2つ以上必要です');
  }

  if (tabs.length > MAX_TABS_PER_REQUEST) {
    throw new Error(
      `一度に整理できるのは ${MAX_TABS_PER_REQUEST} タブまでです（現在 ${tabs.length} タブ）`,
    );
  }

  if (!globalThis.LanguageModel) {
    throw new Error(
      'Prompt API がこの Chrome では利用できません（Chrome 138 以上が必要）',
    );
  }

  const readiness = await waitWhileDownloading((status) => {
    onStatus?.(status);
  });

  onStatus?.(readiness === 'available' ? 'available' : 'downloadable');

  let session;
  try {
    session = await createSession(onDownloadProgress);
  } catch (error) {
    throw wrapSessionError(error);
  }

  try {
    const prompt = buildPrompt(tabs);
    const raw = await session.prompt(prompt, {
      responseConstraint: RESPONSE_SCHEMA,
    });

    const parsed = JSON.parse(raw);
    return validatePlan(parsed, tabs.length);
  } finally {
    session.destroy();
  }
}
