import { RESPONSE_SCHEMA } from './constants.js';
import { resolveBrowserOutputLanguage } from './locale.js';
import { buildPrompt, validatePlan } from './tab-manager.js';
import { parseModelJson } from './ai-response.js';
import {
  loadUserInstructions,
  normalizeUserInstructions,
} from './user-prompt.js';
import {
  DEFAULT_GEMINI_API_MODEL,
  resolveGeminiApiModel,
} from './gemini-models.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function toGeminiApiResponseSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(toGeminiApiResponseSchema);
  }

  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') {
      continue;
    }
    result[key] = toGeminiApiResponseSchema(value);
  }
  return result;
}

function buildGenerateContentUrl(model) {
  return `${GEMINI_API_BASE_URL}/models/${model}:generateContent`;
}

function extractResponseText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('');
}

function formatGeminiApiError(status, payload) {
  const apiMessage = payload?.error?.message;

  switch (status) {
    case 400:
      return apiMessage
        ? `リクエストが不正です: ${apiMessage}`
        : 'リクエストが不正です。タブ数を減らして再試行してください。';
    case 403:
      return 'API キーが無効です。Google AI Studio でキーを確認してください。';
    case 404:
      return '選択したモデルは利用できません。設定から別のモデルに変更してください。';
    case 429:
      return 'レート制限に達しました。しばらく待ってから再試行するか、AI Studio で利用上限を確認してください。';
    case 500:
    case 503:
      return 'Gemini API が一時的に利用できません。しばらく待ってから再試行してください。';
    default:
      return apiMessage
        ? `Gemini API エラー (${status}): ${apiMessage}`
        : `Gemini API エラー (${status})`;
  }
}

async function requestGeminiApi(apiKey, model, body) {
  let response;

  try {
    response = await fetch(buildGenerateContentUrl(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Gemini API に接続できませんでした。ネットワーク接続を確認してください。');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(formatGeminiApiError(response.status, payload));
  }

  const text = extractResponseText(payload);
  if (!text) {
    throw new Error('Gemini API から空の応答が返されました');
  }

  return text;
}

export async function suggestGroupsWithGeminiApi(tabs, {
  apiKey,
  model = DEFAULT_GEMINI_API_MODEL,
  onProgress,
  userInstructions,
} = {}) {
  const normalizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!normalizedKey) {
    throw new Error('API キーを設定してください');
  }

  const resolvedModel = resolveGeminiApiModel(model);
  const outputLanguage = resolveBrowserOutputLanguage();
  const instructions = normalizeUserInstructions(
    userInstructions ?? await loadUserInstructions(),
  );
  const prompt = buildPrompt(tabs, outputLanguage, instructions);

  onProgress?.({
    phase: 'analyzing',
    percent: null,
    message: 'Gemini API で分析中…',
    detail: resolvedModel,
  });

  const raw = await requestGeminiApi(normalizedKey, resolvedModel, {
    contents: [{
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiApiResponseSchema(RESPONSE_SCHEMA),
    },
  });

  const parsed = parseModelJson(raw);
  return validatePlan(parsed, tabs, outputLanguage);
}
