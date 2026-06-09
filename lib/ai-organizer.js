import {
  MAX_TABS_PER_REQUEST,
  RESPONSE_SCHEMA,
} from './constants.js';
import {
  normalizeStatus,
  probeLanguageModels,
} from './ai-probe.js';
import { buildPrompt, validatePlan } from './tab-manager.js';

const STATUS_MESSAGES = {
  unavailable:
    'Prompt API がこの端末では利用できません（設定が ON でもハードウェア要件を満たさない場合があります）',
  downloadable:
    'モデルを準備します。「タブを分析」の操作でダウンロードが始まります',
  downloading:
    'AI モデルをダウンロード中です。この画面を開いたままお待ちください…',
  available: '利用可能',
  readily: '利用可能',
  'after-download':
    'モデルを準備します。「タブを分析」の操作でダウンロードが始まります',
};

const UNAVAILABLE_HINTS = [
  'RAM 16GB 以上、空きディスク 22GB 以上、Wi‑Fi 等の非従量制回線が必要',
  'chrome://flags → optimization-guide-on-device-model を Enabled（開発中は BypassPerfRequirement も可）',
  'chrome://flags → prompt-api-for-gemini-nano を Enabled multilingual',
  'chrome://on-device-internals → Model Status にエラーがないか確認',
  'Chrome を再起動してから再度お試しください',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProbeSummary(probes) {
  if (!probes.length) {
    return '診断情報なし';
  }

  return probes
    .map((probe) => {
      if (probe.error) {
        return `${probe.label}: エラー (${probe.error})`;
      }
      return `${probe.label}: ${probe.rawStatus}`;
    })
    .join(' / ');
}

async function resolveLanguageOptions() {
  const probe = await probeLanguageModels();

  if (!probe.hasLanguageModel) {
    return {
      ok: false,
      reason: 'missing-api',
      message:
        'Prompt API がこの Chrome では利用できません（Chrome 138 以上が必要）',
      probe,
    };
  }

  if (!probe.selected) {
    return {
      ok: false,
      reason: 'unavailable',
      message: STATUS_MESSAGES.unavailable,
      hints: UNAVAILABLE_HINTS,
      probeSummary: formatProbeSummary(probe.probes),
      probe,
    };
  }

  return {
    ok: true,
    languageOptions: probe.selected.options,
    probe,
  };
}

export async function checkAiAvailability() {
  try {
    const resolved = await resolveLanguageOptions();

    if (!resolved.ok) {
      return {
        status: resolved.reason === 'missing-api' ? 'missing-api' : 'unavailable',
        message: resolved.message,
        hints: resolved.hints,
        probeSummary: resolved.probeSummary,
        probes: resolved.probe?.probes,
      };
    }

    const rawStatus = resolved.probe.probes.find(
      (item) => item.id === resolved.probe.selected.id,
    )?.rawStatus;
    const status = normalizeStatus(rawStatus);

    return {
      status,
      rawStatus,
      message: STATUS_MESSAGES[rawStatus] || STATUS_MESSAGES[status] || rawStatus,
      selectedProfile: resolved.probe.selected.id,
      probeSummary: formatProbeSummary(resolved.probe.probes),
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      hints: UNAVAILABLE_HINTS,
    };
  }
}

async function waitWhileDownloading(languageOptions, onStatus, maxWaitMs = 30 * 60 * 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const rawStatus = await LanguageModel.availability(languageOptions);
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

async function createSession(languageOptions, onDownloadProgress) {
  return LanguageModel.create({
    ...languageOptions,
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
      'chrome://on-device-internals の Model Status を確認してください。',
      '設定 → システム → オンデバイス AI が ON かも再確認してください。',
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

  const resolved = await resolveLanguageOptions();
  if (!resolved.ok) {
    const details = resolved.probeSummary ? `\n診断: ${resolved.probeSummary}` : '';
    throw new Error(`${resolved.message}${details}`);
  }

  const { languageOptions } = resolved;

  const readiness = await waitWhileDownloading(languageOptions, (status) => {
    onStatus?.(status);
  });

  onStatus?.(readiness === 'available' ? 'available' : 'downloadable');

  let session;
  try {
    session = await createSession(languageOptions, onDownloadProgress);
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

export { UNAVAILABLE_HINTS };
