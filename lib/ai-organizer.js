import {
  MAX_TABS_PER_REQUEST,
  RESPONSE_SCHEMA,
} from './constants.js';
import {
  isUsableStatus,
  normalizeStatus,
  probeLanguageModels,
} from './ai-probe.js';
import {
  buildBackgroundDownloadProgress,
  buildDownloadProgress,
} from './download-progress.js';
import {
  formatEnvironmentSummary,
  getEnvironmentInfo,
  getLikelyBlockers,
} from './environment-info.js';
import {
  loadCachedProfile,
  saveCachedProfile,
} from './probe-cache.js';
import { buildPrompt, validatePlan } from './tab-manager.js';

const STATUS_MESSAGES = {
  unavailable:
    'Chrome がこの端末での Prompt API 利用を拒否しています（下の診断情報を確認）',
  downloadable:
    'モデルのダウンロードを開始します（約 22 GB・数分〜数十分）',
  downloading:
    'AI モデルをダウンロード中です。この画面を開いたままお待ちください…',
  available: '利用可能',
  readily: '利用可能',
  ready: 'AI 準備完了',
  'after-download':
    'モデルのダウンロードを開始します（約 22 GB・数分〜数十分）',
};

const UNAVAILABLE_HINTS = [
  'RAM 16GB 以上、空きディスク 22GB 以上、Wi‑Fi 等の非従量制回線が必要',
  'chrome://flags → optimization-guide-on-device-model を Enabled（開発中は BypassPerfRequirement も可）',
  'chrome://flags → prompt-api-for-gemini-nano を Enabled multilingual',
  'chrome://on-device-internals → Model Status にエラーがないか確認',
  'Chrome を再起動してから再度お試しください',
];

let memoryProbeResult = null;
let cachedSession = null;
let warmPromise = null;

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

function buildProbeFromSelection(selected, rawStatus) {
  return {
    hasLanguageModel: true,
    probes: [{
      id: selected.id,
      label: selected.label,
      rawStatus,
      status: normalizeStatus(rawStatus),
    }],
    selected,
  };
}

async function verifyCachedProfile(cachedProfile) {
  if (!cachedProfile?.options || !('LanguageModel' in globalThis)) {
    return null;
  }

  try {
    const rawStatus = await LanguageModel.availability(cachedProfile.options);
    if (!isUsableStatus(rawStatus)) {
      return null;
    }

    return buildProbeFromSelection(
      {
        id: cachedProfile.id,
        label: cachedProfile.label,
        options: cachedProfile.options,
      },
      rawStatus,
    );
  } catch {
    return null;
  }
}

async function resolveLanguageOptions({ forceRefresh = false } = {}) {
  if (!forceRefresh && memoryProbeResult?.selected) {
    return {
      ok: true,
      languageOptions: memoryProbeResult.selected.options,
      probe: memoryProbeResult,
    };
  }

  if (!forceRefresh) {
    const cachedProfile = await loadCachedProfile();
    const cachedProbe = await verifyCachedProfile(cachedProfile);
    if (cachedProbe) {
      memoryProbeResult = cachedProbe;
      return {
        ok: true,
        languageOptions: cachedProbe.selected.options,
        probe: cachedProbe,
      };
    }
  }

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
    memoryProbeResult = probe;
    return {
      ok: false,
      reason: 'unavailable',
      message: STATUS_MESSAGES.unavailable,
      hints: UNAVAILABLE_HINTS,
      probeSummary: formatProbeSummary(probe.probes),
      probe,
    };
  }

  memoryProbeResult = probe;
  await saveCachedProfile(probe.selected);

  return {
    ok: true,
    languageOptions: probe.selected.options,
    probe,
  };
}

async function prepareSession(languageOptions, onProgress, maxWaitMs = 45 * 60 * 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const rawStatus = await LanguageModel.availability(languageOptions);
    const status = normalizeStatus(rawStatus);

    if (status === 'unavailable') {
      throw new Error(STATUS_MESSAGES.unavailable);
    }

    if (status === 'downloading') {
      onProgress?.(buildBackgroundDownloadProgress(Date.now() - startedAt));
      await sleep(1000);
      continue;
    }

    onProgress?.(buildDownloadProgress(0));

    return LanguageModel.create({
      ...languageOptions,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          onProgress?.(buildDownloadProgress(event.loaded ?? 0));
        });
      },
    });
  }

  throw new Error(
    'モデルのダウンロードがタイムアウトしました。Chrome を再起動してから再度お試しください',
  );
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

function destroyCachedSession() {
  if (!cachedSession) {
    return;
  }

  try {
    cachedSession.destroy();
  } catch {
    // ignore
  }

  cachedSession = null;
}

export function isSessionReady() {
  return cachedSession !== null;
}

export function releaseSession() {
  destroyCachedSession();
  warmPromise = null;
}

async function ensureSession({ onProgress, forceNew = false } = {}) {
  if (!forceNew && cachedSession) {
    return cachedSession;
  }

  if (!forceNew && warmPromise) {
    return warmPromise;
  }

  const work = (async () => {
    if (forceNew) {
      destroyCachedSession();
    }

    const resolved = await resolveLanguageOptions();
    if (!resolved.ok) {
      const details = resolved.probeSummary ? `\n診断: ${resolved.probeSummary}` : '';
      throw new Error(`${resolved.message}${details}`);
    }

    const session = await prepareSession(resolved.languageOptions, onProgress);
    cachedSession = session;
    return session;
  })();

  warmPromise = work;

  try {
    return await work;
  } catch (error) {
    destroyCachedSession();
    throw wrapSessionError(error);
  } finally {
    if (warmPromise === work) {
      warmPromise = null;
    }
  }
}

export async function warmSession({ onProgress } = {}) {
  const resolved = await resolveLanguageOptions();
  if (!resolved.ok) {
    return {
      ok: false,
      reason: resolved.reason,
      message: resolved.message,
    };
  }

  if (cachedSession) {
    return { ok: true, ready: true };
  }

  try {
    await ensureSession({ onProgress });
    return { ok: true, ready: true };
  } catch (error) {
    return {
      ok: false,
      reason: 'session-error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkAiAvailability() {
  const environment = getEnvironmentInfo();

  try {
    const resolved = await resolveLanguageOptions();

    if (!resolved.ok) {
      return {
        status: resolved.reason === 'missing-api' ? 'missing-api' : 'unavailable',
        message: resolved.message,
        hints: resolved.hints,
        probeSummary: resolved.probeSummary,
        probes: resolved.probe?.probes,
        environmentSummary: formatEnvironmentSummary(environment),
        likelyBlockers: getLikelyBlockers(environment),
        hasLanguageModel: resolved.probe?.hasLanguageModel ?? false,
        sessionReady: false,
      };
    }

    const rawStatus = resolved.probe.probes.find(
      (item) => item.id === resolved.probe.selected.id,
    )?.rawStatus;
    const status = normalizeStatus(rawStatus);

    return {
      status,
      rawStatus,
      message: cachedSession
        ? STATUS_MESSAGES.ready
        : STATUS_MESSAGES[rawStatus] || STATUS_MESSAGES[status] || rawStatus,
      selectedProfile: resolved.probe.selected.id,
      probeSummary: formatProbeSummary(resolved.probe.probes),
      environmentSummary: formatEnvironmentSummary(environment),
      hasLanguageModel: true,
      sessionReady: cachedSession !== null,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      hints: UNAVAILABLE_HINTS,
      environmentSummary: formatEnvironmentSummary(environment),
      likelyBlockers: getLikelyBlockers(environment),
      sessionReady: false,
    };
  }
}

export async function suggestGroups(tabs, { onProgress } = {}) {
  if (tabs.length < 2) {
    throw new Error('グループ化するには未整理タブが2つ以上必要です');
  }

  if (tabs.length > MAX_TABS_PER_REQUEST) {
    throw new Error(
      `一度に整理できるのは ${MAX_TABS_PER_REQUEST} タブまでです（現在 ${tabs.length} タブ）`,
    );
  }

  const sessionAlreadyReady = cachedSession !== null;
  const session = await ensureSession({
    onProgress: sessionAlreadyReady ? undefined : onProgress,
  });

  onProgress?.({
    phase: 'analyzing',
    percent: 100,
    message: 'タブを分析しています…',
    detail: null,
  });

  const prompt = buildPrompt(tabs);
  const raw = await session.prompt(prompt, {
    responseConstraint: RESPONSE_SCHEMA,
  });

  const parsed = JSON.parse(raw);
  return validatePlan(parsed, tabs.length);
}

export { UNAVAILABLE_HINTS };
