import {
  MAX_TABS_PER_REQUEST,
  RESPONSE_SCHEMA,
} from './constants.js';
import { runLanguageModelTask } from './language-model-queue.js';
import {
  getOutputLanguageFromOptions,
  hasExplicitOutputLanguage,
  isUsableStatus,
  normalizeLanguageOptions,
  normalizeStatus,
  probeLanguageModels,
  toLanguageModelCreateOptions,
  toLanguageModelPromptOptions,
} from './ai-probe.js';
import {
  getBrowserLocales,
  getOutputLanguageLabel,
  resolveBrowserOutputLanguage,
} from './locale.js';
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
import { formatAiError, isUnknownAiError } from './ai-errors.js';
import {
  appendJsonFallbackInstruction,
  parseModelJson,
} from './ai-response.js';
import {
  loadUserInstructions,
  normalizeUserInstructions,
} from './user-prompt.js';

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
let cachedSessionOptions = null;
let warmPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOutputLanguageError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No output language was specified');
}

function optionsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

  if (!hasExplicitOutputLanguage(cachedProfile.options)) {
    return null;
  }

  const preferredOutput = resolveBrowserOutputLanguage();
  if (
    cachedProfile.outputLanguage
    && cachedProfile.outputLanguage !== preferredOutput
  ) {
    return null;
  }

  const languageOptions = normalizeLanguageOptions(cachedProfile.options, {
    preferredOutput,
  });

  try {
    const createOptions = toLanguageModelCreateOptions(languageOptions);
    const rawStatus = await runLanguageModelTask(() =>
      LanguageModel.availability(createOptions),
    );
    if (!isUsableStatus(rawStatus)) {
      return null;
    }

    const outputLanguage = getOutputLanguageFromOptions(languageOptions) ?? preferredOutput;

    return buildProbeFromSelection(
      {
        id: cachedProfile.id,
        label: cachedProfile.label,
        outputLanguage,
        options: languageOptions,
      },
      rawStatus,
    );
  } catch {
    return null;
  }
}

async function resolveLanguageOptions({ forceRefresh = false } = {}) {
  if (!forceRefresh && memoryProbeResult?.selected) {
    const preferredOutput = resolveBrowserOutputLanguage();
    const languageOptions = normalizeLanguageOptions(
      memoryProbeResult.selected.options,
      { preferredOutput },
    );

    return {
      ok: true,
      languageOptions,
      outputLanguage: memoryProbeResult.selected.outputLanguage
        ?? getOutputLanguageFromOptions(languageOptions)
        ?? preferredOutput,
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
        outputLanguage: cachedProbe.selected.outputLanguage
          ?? getOutputLanguageFromOptions(cachedProbe.selected.options),
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
  const preferredOutput = resolveBrowserOutputLanguage();
  const languageOptions = normalizeLanguageOptions(probe.selected.options, {
    preferredOutput,
  });
  const outputLanguage = probe.selected.outputLanguage
    ?? getOutputLanguageFromOptions(languageOptions)
    ?? preferredOutput;

  await saveCachedProfile({
    ...probe.selected,
    outputLanguage,
    browserLocales: getBrowserLocales(),
    options: languageOptions,
  });

  return {
    ok: true,
    languageOptions,
    outputLanguage,
    probe,
  };
}

async function prepareSession(rawLanguageOptions, onProgress, maxWaitMs = 45 * 60 * 1000) {
  const languageOptions = normalizeLanguageOptions(rawLanguageOptions);
  const createOptions = toLanguageModelCreateOptions(languageOptions);
  const startedAt = Date.now();

  return runLanguageModelTask(async () => {
    while (Date.now() - startedAt < maxWaitMs) {
      const rawStatus = await LanguageModel.availability(createOptions);
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

      const session = await LanguageModel.create({
        ...createOptions,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', (event) => {
            onProgress?.(buildDownloadProgress(event.loaded ?? 0));
          });
        },
      });

      cachedSessionOptions = createOptions;
      return session;
    }

    throw new Error(
      'モデルのダウンロードがタイムアウトしました。Chrome を再起動してから再度お試しください',
    );
  });
}

function wrapSessionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (isOutputLanguageError(error)) {
    return new Error(
      'AI 出力言語の設定エラーです。拡張機能を再読み込みしてから再度お試しください。',
    );
  }
  if (isUnknownAiError(error)) {
    return new Error(formatAiError(error));
  }
  if (!message.includes('unable to create a session')) {
    return error instanceof Error ? error : new Error(formatAiError(error));
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
  if (cachedSession) {
    try {
      cachedSession.destroy();
    } catch {
      // ignore
    }
  }

  cachedSession = null;
  cachedSessionOptions = null;
}

export function isSessionReady() {
  return cachedSession !== null;
}

export function releaseSession() {
  destroyCachedSession();
  warmPromise = null;
}

async function ensureSession({ onProgress, forceNew = false } = {}) {
  const resolved = await resolveLanguageOptions();
  if (!resolved.ok) {
    const details = resolved.probeSummary ? `\n診断: ${resolved.probeSummary}` : '';
    throw new Error(`${resolved.message}${details}`);
  }

  const createOptions = toLanguageModelCreateOptions(resolved.languageOptions);

  if (
    !forceNew
    && cachedSession
    && cachedSessionOptions
    && optionsMatch(cachedSessionOptions, createOptions)
  ) {
    return cachedSession;
  }

  if (!forceNew && warmPromise) {
    return warmPromise;
  }

  const work = (async () => {
    if (forceNew || cachedSession) {
      destroyCachedSession();
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
      outputLanguage: resolved.outputLanguage
        ?? getOutputLanguageFromOptions(resolved.languageOptions)
        ?? resolveBrowserOutputLanguage(),
      outputLanguageLabel: getOutputLanguageLabel(
        resolved.outputLanguage
          ?? getOutputLanguageFromOptions(resolved.languageOptions)
          ?? resolveBrowserOutputLanguage(),
      ),
      browserLocales: getBrowserLocales(),
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

function buildPromptRequestOptions(promptOptions, useSchema) {
  return {
    ...promptOptions,
    ...(useSchema ? { responseConstraint: RESPONSE_SCHEMA } : {}),
    omitResponseConstraintInput: true,
  };
}

async function runPromptOnce(session, prompt, promptOptions, {
  streaming = false,
  useSchema = true,
} = {}) {
  const requestOptions = buildPromptRequestOptions(promptOptions, useSchema);

  if (streaming && typeof session.promptStreaming === 'function') {
    let accumulated = '';
    const stream = session.promptStreaming(prompt, requestOptions);
    for await (const chunk of stream) {
      accumulated += chunk;
    }
    return accumulated;
  }

  return session.prompt(prompt, requestOptions);
}

async function executePrompt(session, prompt, promptOptions, onProgress) {
  const attempts = [
    {
      label: 'streaming',
      streaming: true,
      useSchema: true,
      progress: {
        phase: 'streaming',
        percent: null,
        message: 'AI が考え中…',
        detail: '応答を待っています',
        streamPreview: '',
      },
    },
    {
      label: 'prompt',
      streaming: false,
      useSchema: true,
      progress: {
        phase: 'analyzing',
        percent: null,
        message: 'AI が考え中…',
        detail: '別方式で再試行しています',
      },
    },
    {
      label: 'prompt-json',
      streaming: false,
      useSchema: false,
      prompt: appendJsonFallbackInstruction(prompt),
      progress: {
        phase: 'analyzing',
        percent: null,
        message: 'AI が考え中…',
        detail: '簡易形式で再試行しています',
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      onProgress?.(attempt.progress);
      const raw = await runPromptOnce(
        session,
        attempt.prompt ?? prompt,
        promptOptions,
        {
          streaming: attempt.streaming,
          useSchema: attempt.useSchema,
        },
      );

      onProgress?.({
        phase: 'analyzing',
        percent: 100,
        message: '結果を整理しています…',
        detail: null,
        streamPreview: null,
      });

      return raw;
    } catch (error) {
      lastError = error;
      if (!isUnknownAiError(error) && attempt.label !== 'prompt-json') {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(formatAiError(new Error('kErrorUnknown')));
}

async function analyzeWithSession(
  session,
  tabs,
  outputLanguage,
  promptOptions,
  userInstructions,
  onProgress,
) {
  const prompt = buildPrompt(tabs, outputLanguage, userInstructions);
  const raw = await executePrompt(session, prompt, promptOptions, onProgress);
  const parsed = parseModelJson(raw);
  return validatePlan(parsed, tabs, outputLanguage);
}

async function analyzeWithFreshSession(
  tabs,
  outputLanguage,
  promptOptions,
  instructions,
  onProgress,
) {
  destroyCachedSession();
  warmPromise = null;
  const session = await ensureSession({ onProgress, forceNew: true });
  return analyzeWithSession(
    session,
    tabs,
    outputLanguage,
    promptOptions,
    instructions,
    onProgress,
  );
}

export async function suggestGroups(tabs, { onProgress, userInstructions } = {}) {
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

  const outputLanguage = resolved.outputLanguage ?? resolveBrowserOutputLanguage();
  const promptOptions = toLanguageModelPromptOptions(resolved.languageOptions);
  const instructions = normalizeUserInstructions(
    userInstructions ?? await loadUserInstructions(),
  );
  const sessionAlreadyReady = cachedSession !== null
    && cachedSessionOptions
    && optionsMatch(
      cachedSessionOptions,
      toLanguageModelCreateOptions(resolved.languageOptions),
    );

  try {
    const session = await ensureSession({
      onProgress: sessionAlreadyReady ? undefined : onProgress,
    });

    try {
      return await analyzeWithSession(
        session,
        tabs,
        outputLanguage,
        promptOptions,
        instructions,
        onProgress,
      );
    } catch (error) {
      if (!isUnknownAiError(error)) {
        throw error;
      }

      onProgress?.({
        phase: 'analyzing',
        percent: null,
        message: 'AI セッションを再作成しています…',
        detail: '内部エラーのため再試行します',
      });

      return analyzeWithFreshSession(
        tabs,
        outputLanguage,
        promptOptions,
        instructions,
        onProgress,
      );
    }
  } catch (error) {
    if (isOutputLanguageError(error)) {
      memoryProbeResult = null;
      destroyCachedSession();
      warmPromise = null;

      const session = await ensureSession({ onProgress, forceNew: true });
      return analyzeWithSession(
        session,
        tabs,
        outputLanguage,
        promptOptions,
        instructions,
        onProgress,
      );
    }

    throw wrapSessionError(error);
  }
}

export { UNAVAILABLE_HINTS };
