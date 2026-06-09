import { suggestGroups, checkAiAvailability } from './ai-organizer.js';
import { suggestGroupsWithGeminiApi } from './gemini-api-organizer.js';
import {
  AI_PROVIDERS,
  hasGeminiApiKey,
  loadAiProviderSettings,
} from './ai-provider-settings.js';
import { getGeminiApiModelLabel } from './gemini-models.js';

export async function suggestGroupsForProvider(provider, tabs, options = {}) {
  const settings = options.settings ?? await loadAiProviderSettings();
  const resolvedProvider = provider ?? settings.aiProvider;

  if (resolvedProvider === AI_PROVIDERS.GEMINI_API) {
    return suggestGroupsWithGeminiApi(tabs, {
      apiKey: settings.geminiApiKey,
      model: settings.geminiApiModel,
      onProgress: options.onProgress,
      userInstructions: options.userInstructions,
    });
  }

  return suggestGroups(tabs, {
    onProgress: options.onProgress,
    userInstructions: options.userInstructions,
  });
}

export async function checkProviderAvailability(provider, settings) {
  const resolvedSettings = settings ?? await loadAiProviderSettings();
  const resolvedProvider = provider ?? resolvedSettings.aiProvider;

  if (resolvedProvider === AI_PROVIDERS.GEMINI_API) {
    const modelLabel = getGeminiApiModelLabel(resolvedSettings.geminiApiModel);

    if (!hasGeminiApiKey(resolvedSettings)) {
      return {
        provider: AI_PROVIDERS.GEMINI_API,
        status: 'missing-key',
        message: 'API キーを設定してください',
        modelLabel,
        sessionReady: false,
      };
    }

    return {
      provider: AI_PROVIDERS.GEMINI_API,
      status: 'available',
      message: `Gemini API 利用可能（${modelLabel}）`,
      modelLabel,
      sessionReady: true,
    };
  }

  const onDevice = await checkAiAvailability();
  return {
    provider: AI_PROVIDERS.ON_DEVICE,
    ...onDevice,
  };
}
