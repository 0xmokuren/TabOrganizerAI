import {
  MAX_TABS_PER_REQUEST,
  RESPONSE_SCHEMA,
} from './constants.js';
import { buildPrompt, validatePlan } from './tab-manager.js';

const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['ja', 'en'] }],
  expectedOutputs: [{ type: 'text', languages: ['ja'] }],
};

export async function checkAiAvailability() {
  if (!globalThis.LanguageModel) {
    return {
      status: 'unavailable',
      message: 'Prompt API がこの Chrome では利用できません（Chrome 138 以上が必要）',
    };
  }

  try {
    const status = await LanguageModel.availability(LANGUAGE_OPTIONS);
    const messages = {
      unavailable:
        'オンデバイス AI が利用できません。設定 → システム → オンデバイス AI を確認してください',
      downloading: 'AI モデルをダウンロード中です。完了後にもう一度お試しください',
      readily: '利用可能',
      'after-download': 'モデルのダウンロード後に利用可能です',
    };

    return {
      status,
      message: messages[status] || status,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createSession(onDownloadProgress) {
  return LanguageModel.create({
    ...LANGUAGE_OPTIONS,
    monitor(monitor) {
      if (!onDownloadProgress) {
        return;
      }
      monitor.addEventListener('downloadprogress', (event) => {
        onDownloadProgress(Math.round((event.loaded || 0) * 100));
      });
    },
  });
}

export async function suggestGroups(tabs, { onDownloadProgress } = {}) {
  if (tabs.length < 2) {
    throw new Error('グループ化するには未整理タブが2つ以上必要です');
  }

  if (tabs.length > MAX_TABS_PER_REQUEST) {
    throw new Error(
      `一度に整理できるのは ${MAX_TABS_PER_REQUEST} タブまでです（現在 ${tabs.length} タブ）`,
    );
  }

  const availability = await checkAiAvailability();
  if (availability.status === 'unavailable') {
    throw new Error(availability.message);
  }

  const session = await createSession(onDownloadProgress);

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
