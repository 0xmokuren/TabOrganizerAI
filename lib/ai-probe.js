export const LANGUAGE_OPTION_CANDIDATES = [
  {
    id: 'ja-en',
    label: '日本語 + 英語',
    options: {
      expectedInputs: [{ type: 'text', languages: ['ja', 'en'] }],
      expectedOutputs: [{ type: 'text', languages: ['ja', 'en'] }],
    },
  },
  {
    id: 'ja-out-en-in',
    label: '入力 en / 出力 ja',
    options: {
      expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
      expectedOutputs: [{ type: 'text', languages: ['ja'] }],
    },
  },
  {
    id: 'en',
    label: '英語のみ',
    options: {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    },
  },
  {
    id: 'legacy-ja-en',
    label: 'legacy languages',
    options: {
      languages: ['ja', 'en'],
    },
  },
  {
    id: 'default',
    label: 'デフォルト',
    options: {},
  },
];

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

  if (!hasLanguageModel) {
    return { hasLanguageModel, probes, selected: null };
  }

  for (const candidate of LANGUAGE_OPTION_CANDIDATES) {
    try {
      const rawStatus = await LanguageModel.availability(candidate.options);
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
    ? LANGUAGE_OPTION_CANDIDATES.find((item) => item.id === selectedProbe.id)
    : null;

  return { hasLanguageModel, probes, selected };
}

export { normalizeStatus, isUsableStatus };
