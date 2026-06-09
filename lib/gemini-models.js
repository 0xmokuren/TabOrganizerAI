export const DEFAULT_GEMINI_API_MODEL = 'gemini-3.1-flash-lite';

export const GEMINI_API_MODELS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', tier: 'stable' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', tier: 'stable' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tier: 'stable' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'stable' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'stable' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', tier: 'preview' },
];

const MODEL_IDS = new Set(GEMINI_API_MODELS.map((model) => model.id));

export function isValidGeminiApiModel(id) {
  return typeof id === 'string' && MODEL_IDS.has(id);
}

export function resolveGeminiApiModel(stored) {
  if (isValidGeminiApiModel(stored)) {
    return stored;
  }
  return DEFAULT_GEMINI_API_MODEL;
}

export function getGeminiApiModelLabel(modelId) {
  const resolved = resolveGeminiApiModel(modelId);
  const model = GEMINI_API_MODELS.find((item) => item.id === resolved);
  return model?.label ?? resolved;
}
