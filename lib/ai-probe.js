import {
  SUPPORTED_OUTPUT_LANGUAGES,
  buildLanguageCandidates,
  buildLanguageOptions,
  resolveBrowserOutputLanguage,
} from './locale.js';
import { runLanguageModelTask } from './language-model-queue.js';

export { SUPPORTED_OUTPUT_LANGUAGES };

export function hasExplicitOutputLanguage(options) {
  const outputs = options?.expectedOutputs;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return false;
  }

  return outputs.some(
    (output) =>
      output?.type === 'text'
      && Array.isArray(output.languages)
      && output.languages.length === 1
      && SUPPORTED_OUTPUT_LANGUAGES.includes(output.languages[0]),
  );
}

export function getOutputLanguageFromOptions(options) {
  const output = options?.expectedOutputs?.find(
    (item) => item?.type === 'text' && Array.isArray(item.languages),
  );
  if (!output) {
    return null;
  }

  const supported = output.languages.filter((code) =>
    SUPPORTED_OUTPUT_LANGUAGES.includes(code),
  );

  if (supported.length !== 1) {
    return null;
  }

  return supported[0];
}

export function normalizeLanguageOptions(
  options,
  { preferredOutput = resolveBrowserOutputLanguage() } = {},
) {
  const outputLanguage = getOutputLanguageFromOptions(options) ?? preferredOutput;
  return buildLanguageOptions(outputLanguage);
}

export function toLanguageModelCreateOptions(languageOptions) {
  const normalized = normalizeLanguageOptions(languageOptions);
  return {
    expectedInputs: normalized.expectedInputs,
    expectedOutputs: normalized.expectedOutputs,
  };
}

export function toLanguageModelPromptOptions(languageOptions) {
  const normalized = normalizeLanguageOptions(languageOptions);
  return {
    expectedInputs: normalized.expectedInputs,
    expectedOutputs: normalized.expectedOutputs,
  };
}

function normalizeStatus(status) {
  if (status === 'readily') {
    return 'available';
  }
  if (status === 'after-download') {
    return 'downloadable';
  }
  return status;
}

function isUsableStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized !== 'unavailable';
}

export async function probeLanguageModels() {
  const hasLanguageModel = 'LanguageModel' in globalThis;
  const probes = [];
  const candidates = buildLanguageCandidates();

  if (!hasLanguageModel) {
    return { hasLanguageModel, probes, selected: null };
  }

  for (const candidate of candidates) {
    if (!hasExplicitOutputLanguage(candidate.options)) {
      continue;
    }

    try {
      const rawStatus = await runLanguageModelTask(() =>
        LanguageModel.availability(candidate.options),
      );
      probes.push({
        id: candidate.id,
        label: candidate.label,
        rawStatus,
        status: normalizeStatus(rawStatus),
      });
    } catch (error) {
      probes.push({
        id: candidate.id,
        label: candidate.label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const selectedProbe = probes.find(
    (probe) => probe.rawStatus && isUsableStatus(probe.rawStatus),
  );
  const selected = selectedProbe
    ? candidates.find((item) => item.id === selectedProbe.id)
    : null;

  return { hasLanguageModel, probes, selected };
}

export { normalizeStatus, isUsableStatus };
