import { GROUP_COLORS } from './constants.js';
import { t } from './i18n.js';

export const SUPPORTED_OUTPUT_LANGUAGES = ['de', 'en', 'es', 'fr', 'ja'];

const OUTPUT_LANGUAGE_MESSAGE_KEYS = {
  de: 'langDe',
  en: 'langEn',
  es: 'langEs',
  fr: 'langFr',
  ja: 'langJa',
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
    task: '以下のタブを意味の近さでグループ化してください。',
    rules: [
      '各タブは最大1グループ。2タブ未満のグループは作らない',
      '名前は具体的な日本語20字以内（Webサイト・作業・ドメイン名のみは不可）',
      'color は指定リストのいずれか',
      'tabIndices は番号（0始まり）',
      '1グループ1トピック（・/＆などで結合しない）',
    ],
    tabListHeading: 'タブ一覧:',
  },
  en: {
    task: 'Group the tabs below by semantic similarity.',
    rules: [
      'Each tab in at most one group; no single-tab groups',
      'Names: specific, max 20 chars (no vague labels or domain-only names)',
      'color must be one of the allowed values',
      'tabIndices use the numbers above (0-based)',
      'One topic per group; no ・ / & joins',
    ],
    tabListHeading: 'Tabs:',
  },
  de: {
    task: 'Gruppiere die Tabs nach inhaltlicher Nähe.',
    rules: [
      'Max. 1 Gruppe pro Tab; keine Ein-Tab-Gruppen',
      'Namen konkret, max. 20 Zeichen (keine vagen Labels, keine Domain allein)',
      'color muss ein zulässiger Wert sein',
      'tabIndices ab 0',
      'Unzusammenhängende Tabs nicht erzwingen',
    ],
    tabListHeading: 'Tabs:',
  },
  es: {
    task: 'Agrupa las pestañas por similitud semántica.',
    rules: [
      'Máx. 1 grupo por pestaña; sin grupos de 1',
      'Nombres concretos, máx. 20 caracteres (sin etiquetas vagas ni solo dominio)',
      'color debe ser uno de los valores permitidos',
      'tabIndices desde 0',
      'No forzar pestañas no relacionadas',
    ],
    tabListHeading: 'Pestañas:',
  },
  fr: {
    task: 'Regroupez les onglets par similarité sémantique.',
    rules: [
      "Max. 1 groupe par onglet; pas de groupe d'un seul",
      'Noms précis, 20 caractères max. (pas de libellés vagues ni domaine seul)',
      'color doit être une valeur autorisée',
      'tabIndices à partir de 0',
      'Ne pas forcer des onglets sans lien',
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
  const key = OUTPUT_LANGUAGE_MESSAGE_KEYS[code];
  return key ? t(key) : code;
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
    label: t(
      'languageCandidateLabel',
      getOutputLanguageLabel(outputLanguage),
      outputLanguage,
    ),
    outputLanguage,
    options: buildLanguageOptions(outputLanguage),
  }));
}

function buildPromptFromTemplate(
  template,
  tabsText,
  outputLanguage,
  userInstructions = '',
) {
  const rules = template.rules.map((rule) => {
    if (rule.includes('color') || rule.includes('Color')) {
      return `- ${rule}: ${GROUP_COLORS.join(', ')}`;
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
    template.task,
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

export function buildLocalizedPrompt(
  tabsText,
  outputLanguage,
  userInstructions = '',
) {
  const template = PROMPT_TEMPLATES[outputLanguage] ?? PROMPT_TEMPLATES.en;
  return buildPromptFromTemplate(template, tabsText, outputLanguage, userInstructions);
}
