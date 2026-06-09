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
import { t } from './i18n.js';

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
        ? t('geminiBadRequest', apiMessage)
        : t('geminiBadRequestGeneric');
    case 403:
      return t('geminiInvalidKey');
    case 404:
      return t('geminiModelUnavailable');
    case 429:
      return t('geminiRateLimit');
    case 500:
    case 503:
      return t('geminiUnavailable');
    default:
      return apiMessage
        ? t('geminiError', String(status), apiMessage)
        : t('geminiErrorStatus', String(status));
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
    throw new Error(t('geminiNetworkError'));
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
    throw new Error(t('geminiEmptyResponse'));
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
    throw new Error(t('apiKeyRequired'));
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
    message: t('geminiApiAnalyzing'),
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
