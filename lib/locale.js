export const SUPPORTED_OUTPUT_LANGUAGES = ['de', 'en', 'es', 'fr', 'ja'];

const OUTPUT_LANGUAGE_LABELS = {
  de: 'ドイツ語',
  en: '英語',
  es: 'スペイン語',
  fr: 'フランス語',
  ja: '日本語',
};

const DEFAULT_GROUP_NAMES = {
  de: 'Gruppe',
  en: 'Group',
  es: 'Grupo',
  fr: 'Groupe',
  ja: 'グループ',
};

const USER_INSTRUCTIONS_HEADINGS = {
  ja: 'ユーザーの希望:',
  en: 'User preferences:',
  de: 'Nutzerwünsche:',
  es: 'Preferencias del usuario:',
  fr: 'Préférences utilisateur :',
};

const PROMPT_TEMPLATES = {
  ja: {
    role: 'あなたはブラウザのタブ整理アシスタントです。',
    task: '以下のタブ一覧を、意味の近いもの同士でグループに分けてください。',
    rules: [
      '各タブは最大1つのグループにのみ所属する',
      '1タブだけのグループは作らない（そのタブは groups に含めない）',
      'グループ名は短い日本語（20文字以内）',
      'color は指定リストのいずれか',
      'tabIndices は上の番号（0始まり）を使う',
      '関連性が薄いタブは無理にグループ化しない',
    ],
    tabListHeading: 'タブ一覧:',
  },
  en: {
    role: 'You are a browser tab organization assistant.',
    task: 'Group the following tabs by semantic similarity.',
    rules: [
      'Each tab belongs to at most one group',
      'Do not create single-tab groups (omit them from groups)',
      'Group names must be short English (max 20 characters)',
      'color must be one of the allowed values',
      'Use the tab numbers above (0-based) for tabIndices',
      'Do not force unrelated tabs into the same group',
    ],
    tabListHeading: 'Tabs:',
  },
  de: {
    role: 'Du bist ein Assistent zur Organisation von Browser-Tabs.',
    task: 'Gruppiere die folgenden Tabs nach inhaltlicher Ähnlichkeit.',
    rules: [
      'Jeder Tab gehört höchstens zu einer Gruppe',
      'Keine Ein-Tab-Gruppen erstellen',
      'Gruppennamen kurz auf Deutsch (max. 20 Zeichen)',
      'color muss ein zulässiger Wert sein',
      'tabIndices verwenden die Nummern oben (ab 0)',
      'Unzusammenhängende Tabs nicht erzwingen',
    ],
    tabListHeading: 'Tabs:',
  },
  es: {
    role: 'Eres un asistente para organizar pestañas del navegador.',
    task: 'Agrupa las siguientes pestañas por similitud semántica.',
    rules: [
      'Cada pestaña pertenece como máximo a un grupo',
      'No crear grupos de una sola pestaña',
      'Nombres de grupo cortos en español (máx. 20 caracteres)',
      'color debe ser uno de los valores permitidos',
      'tabIndices usan los números de arriba (desde 0)',
      'No agrupar pestañas poco relacionadas',
    ],
    tabListHeading: 'Pestañas:',
  },
  fr: {
    role: 'Vous êtes un assistant d’organisation d’onglets de navigateur.',
    task: 'Regroupez les onglets suivants par similarité sémantique.',
    rules: [
      'Chaque onglet appartient au plus à un groupe',
      'Ne pas créer de groupes d’un seul onglet',
      'Noms de groupe courts en français (20 caractères max.)',
      'color doit être une valeur autorisée',
      'tabIndices utilisent les numéros ci-dessus (à partir de 0)',
      'Ne pas forcer des onglets peu liés dans le même groupe',
    ],
    tabListHeading: 'Onglets :',
  },
};

function parseLanguageCode(locale) {
  if (!locale || typeof locale !== 'string') {
    return null;
  }

  return locale.toLowerCase().split('-')[0];
}

export function getBrowserLocales() {
  const locales = [...(navigator.languages ?? [])];
  if (navigator.language && !locales.includes(navigator.language)) {
    locales.push(navigator.language);
  }
  return locales;
}

export function getOutputLanguageCandidates() {
  const ordered = [];
  const seen = new Set();

  for (const locale of getBrowserLocales()) {
    const code = parseLanguageCode(locale);
    if (code && SUPPORTED_OUTPUT_LANGUAGES.includes(code) && !seen.has(code)) {
      ordered.push(code);
      seen.add(code);
    }
  }

  for (const code of SUPPORTED_OUTPUT_LANGUAGES) {
    if (!seen.has(code)) {
      ordered.push(code);
      seen.add(code);
    }
  }

  return ordered;
}

export function resolveBrowserOutputLanguage() {
  return getOutputLanguageCandidates()[0] ?? 'en';
}

export function getOutputLanguageLabel(code) {
  return OUTPUT_LANGUAGE_LABELS[code] ?? code;
}

export function getDefaultGroupName(outputLanguage = resolveBrowserOutputLanguage()) {
  return DEFAULT_GROUP_NAMES[outputLanguage] ?? DEFAULT_GROUP_NAMES.en;
}

export function buildInputLanguages(outputLanguage) {
  const inputs = [outputLanguage, 'en'];

  for (const locale of getBrowserLocales()) {
    const code = parseLanguageCode(locale);
    if (code && SUPPORTED_OUTPUT_LANGUAGES.includes(code) && !inputs.includes(code)) {
      inputs.push(code);
    }
  }

  return inputs;
}

export function buildLanguageOptions(outputLanguage) {
  return {
    expectedInputs: [{
      type: 'text',
      languages: buildInputLanguages(outputLanguage),
    }],
    expectedOutputs: [{
      type: 'text',
      languages: [outputLanguage],
    }],
  };
}

export function buildLanguageCandidates() {
  return getOutputLanguageCandidates().map((outputLanguage) => ({
    id: `output-${outputLanguage}`,
    label: `${getOutputLanguageLabel(outputLanguage)}出力（ブラウザ: ${outputLanguage}）`,
    outputLanguage,
    options: buildLanguageOptions(outputLanguage),
  }));
}

export function buildLocalizedPrompt(
  tabsText,
  outputLanguage,
  colorList,
  userInstructions = '',
) {
  const template = PROMPT_TEMPLATES[outputLanguage] ?? PROMPT_TEMPLATES.en;
  const rules = template.rules.map((rule) => {
    if (rule.includes('color') || rule.includes('Color')) {
      return `- ${rule}: ${colorList.join(', ')}`;
    }
    return `- ${rule}`;
  });

  const rulesHeading = outputLanguage === 'ja'
    ? 'ルール:'
    : outputLanguage === 'de'
      ? 'Regeln:'
      : outputLanguage === 'es'
        ? 'Reglas:'
        : outputLanguage === 'fr'
          ? 'Règles :'
          : 'Rules:';

  const sections = [
    template.role,
    template.task,
    '',
    rulesHeading,
    ...rules,
  ];

  const trimmedInstructions = userInstructions.trim();
  if (trimmedInstructions) {
    const heading = USER_INSTRUCTIONS_HEADINGS[outputLanguage]
      ?? USER_INSTRUCTIONS_HEADINGS.en;
    sections.push('', heading, trimmedInstructions);
  }

  sections.push('', template.tabListHeading, tabsText);

  return sections.join('\n');
}
