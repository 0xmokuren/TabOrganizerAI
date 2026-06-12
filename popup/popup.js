import {
  warmSession,
  releaseSession,
  isSessionReady,
  getUnavailableHints,
} from '../lib/ai-organizer.js';
import {
  suggestGroupsForProvider,
  checkProviderAvailability,
} from '../lib/ai-router.js';
import { suggestGroupsByDomain } from '../lib/rule-based-grouper.js';
import {
  applyGroupPlan,
  countTabGroupsInScope,
  getOrganizableTabs,
  resolvePlanWithExistingGroups,
  ungroupAllTabs,
} from '../lib/tab-manager.js';
import {
  loadUserInstructions,
  saveUserInstructions,
} from '../lib/user-prompt.js';
import {
  AI_PROVIDERS,
  loadAiProviderSettings,
  saveAiProvider,
  saveGeminiApiKey,
  saveGeminiApiModel,
} from '../lib/ai-provider-settings.js';
import { GEMINI_API_MODELS } from '../lib/gemini-models.js';
import { applyStaticI18n, t } from '../lib/i18n.js';
import {
  AppError,
  ErrorCode,
  getDisplayError,
} from '../lib/errors.js';

const COLOR_MAP = {
  grey: '#9aa0a6',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#e8710a',
};

const els = {
  aiStatus: document.getElementById('ai-status'),
  statusDot: document.getElementById('status-dot'),
  providerDetail: document.getElementById('provider-detail'),
  currentWindowOnly: document.getElementById('current-window-only'),
  analyzeBtn: document.getElementById('analyze-btn'),
  ruleBasedBtn: document.getElementById('rule-based-btn'),
  ungroupAllBtn: document.getElementById('ungroup-all-btn'),
  actionStatus: document.getElementById('action-status'),
  progressSection: document.getElementById('progress-section'),
  progressPercent: document.getElementById('progress-percent'),
  progressText: document.getElementById('progress-text'),
  progressDetail: document.getElementById('progress-detail'),
  progressStream: document.getElementById('progress-stream'),
  progressFill: document.getElementById('progress-fill'),
  summarySection: document.getElementById('summary-section'),
  summaryText: document.getElementById('summary-text'),
  previewSection: document.getElementById('preview-section'),
  previewList: document.getElementById('preview-list'),
  applyBtn: document.getElementById('apply-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  errorText: document.getElementById('error-text'),
  diagnostics: document.getElementById('diagnostics'),
  diagnosticsList: document.getElementById('diagnostics-list'),
  userPromptInput: document.getElementById('user-prompt-input'),
  userPromptStatus: document.getElementById('user-prompt-status'),
  providerOnDevice: document.getElementById('provider-on-device'),
  providerGeminiApi: document.getElementById('provider-gemini-api'),
  geminiSettingsSection: document.getElementById('gemini-settings-section'),
  geminiApiKeyInput: document.getElementById('gemini-api-key-input'),
  geminiModelSelect: document.getElementById('gemini-model-select'),
  aiProviderStatus: document.getElementById('ai-provider-status'),
};

let currentPlan = null;
let statusPollTimer = null;
let sessionWarmPromise = null;
let userPromptSaveTimer = null;
let apiKeySaveTimer = null;
let currentSettings = null;

function showError(message) {
  if (!els.errorText) {
    return;
  }
  els.errorText.textContent = message;
  els.errorText.classList.remove('hidden');
}

function clearError() {
  if (!els.errorText) {
    return;
  }
  els.errorText.textContent = '';
  els.errorText.classList.add('hidden');
}

function setUserPromptStatus(message) {
  if (els.userPromptStatus) {
    els.userPromptStatus.textContent = message;
  }
}

function setAiProviderStatus(message) {
  if (els.aiProviderStatus) {
    els.aiProviderStatus.textContent = message;
  }
}

function getUserInstructionsFromInput() {
  return els.userPromptInput?.value ?? '';
}

function getSelectedProvider() {
  if (els.providerGeminiApi?.checked) {
    return AI_PROVIDERS.GEMINI_API;
  }
  return AI_PROVIDERS.ON_DEVICE;
}

function isGeminiApiProvider() {
  return getSelectedProvider() === AI_PROVIDERS.GEMINI_API;
}

function updateGeminiApiFieldsVisibility() {
  const showGemini = isGeminiApiProvider();
  els.geminiSettingsSection?.classList.toggle('hidden', !showGemini);
}

function setStatusDot(state) {
  if (!els.statusDot) {
    return;
  }

  els.statusDot.classList.remove('ready', 'pending', 'error');
  if (state) {
    els.statusDot.classList.add(state);
  }
}

function setProviderDetail(text) {
  if (!els.providerDetail) {
    return;
  }

  if (text) {
    els.providerDetail.textContent = text;
    els.providerDetail.classList.remove('hidden');
  } else {
    els.providerDetail.textContent = '';
    els.providerDetail.classList.add('hidden');
  }
}

function resolveStatusPresentation(result, settings) {
  if (result.provider === AI_PROVIDERS.GEMINI_API) {
    if (result.status === 'missing-key') {
      return {
        message: t('apiKeyRequired'),
        detail: result.modelLabel ? t('modelDetail', result.modelLabel) : null,
        dot: 'error',
      };
    }

    return {
      message: t('statusAvailable'),
      detail: result.modelLabel ? t('modelDetail', result.modelLabel) : null,
      dot: 'ready',
    };
  }

  if (result.status === 'unavailable' || result.status === 'missing-api' || result.status === 'error') {
    return {
      message: result.message,
      detail: t('localAiDetail'),
      dot: 'error',
    };
  }

  if (
    settings.aiProvider === AI_PROVIDERS.ON_DEVICE
    && sessionWarmPromise
    && !result.sessionReady
  ) {
    return {
      message: t('aiPreparing'),
      detail: t('localAiDetail'),
      dot: 'pending',
    };
  }

  if (result.status === 'downloading') {
    return {
      message: result.message,
      detail: t('localAiDetail'),
      dot: 'pending',
    };
  }

  return {
    message: result.message,
    detail: t('localAiDetail'),
    dot: result.sessionReady || result.status === 'available' || result.status === 'ready'
      ? 'ready'
      : 'pending',
  };
}

function getSettingsFromInputs() {
  return {
    aiProvider: getSelectedProvider(),
    geminiApiKey: els.geminiApiKeyInput?.value ?? '',
    geminiApiModel: els.geminiModelSelect?.value ?? currentSettings?.geminiApiModel,
  };
}

async function persistUserInstructions(showSavedMessage = true) {
  if (!els.userPromptInput) {
    return '';
  }

  const saved = await saveUserInstructions(getUserInstructionsFromInput());
  els.userPromptInput.value = saved;

  if (showSavedMessage) {
    setUserPromptStatus(saved ? t('policySaved') : t('policyCleared'));
  }

  return saved;
}

function scheduleUserInstructionsSave() {
  if (userPromptSaveTimer) {
    clearTimeout(userPromptSaveTimer);
  }

  setUserPromptStatus(t('saving'));
  userPromptSaveTimer = window.setTimeout(() => {
    persistUserInstructions(true).catch(handleFatalError);
    userPromptSaveTimer = null;
  }, 400);
}

async function persistGeminiApiKey(showSavedMessage = true) {
  if (!els.geminiApiKeyInput) {
    return '';
  }

  const saved = await saveGeminiApiKey(els.geminiApiKeyInput.value);
  els.geminiApiKeyInput.value = saved;
  currentSettings = {
    ...currentSettings,
    geminiApiKey: saved,
  };

  if (showSavedMessage) {
    setAiProviderStatus(saved ? t('apiKeySaved') : t('apiKeyCleared'));
  }

  await refreshAiStatus();
  return saved;
}

function scheduleGeminiApiKeySave() {
  if (apiKeySaveTimer) {
    clearTimeout(apiKeySaveTimer);
  }

  setAiProviderStatus(t('saving'));
  apiKeySaveTimer = window.setTimeout(() => {
    persistGeminiApiKey(true).catch(handleFatalError);
    apiKeySaveTimer = null;
  }, 400);
}

async function persistAiProvider() {
  const provider = getSelectedProvider();
  const saved = await saveAiProvider(provider);
  currentSettings = {
    ...currentSettings,
    aiProvider: saved,
  };
  updateGeminiApiFieldsVisibility();
  await refreshAiStatus();

  if (saved === AI_PROVIDERS.ON_DEVICE) {
    startSessionPrewarm();
  }
}

async function persistGeminiApiModel() {
  if (!els.geminiModelSelect) {
    return currentSettings?.geminiApiModel;
  }

  const saved = await saveGeminiApiModel(els.geminiModelSelect.value);
  els.geminiModelSelect.value = saved;
  currentSettings = {
    ...currentSettings,
    geminiApiModel: saved,
  };
  setAiProviderStatus(t('modelSaved'));
  await refreshAiStatus();
  return saved;
}

function populateGeminiModelSelect(selectedModel) {
  if (!els.geminiModelSelect) {
    return;
  }

  els.geminiModelSelect.innerHTML = '';

  for (const model of GEMINI_API_MODELS) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.label;
    els.geminiModelSelect.appendChild(option);
  }

  els.geminiModelSelect.value = selectedModel;
}

async function initUserPromptSettings() {
  if (!els.userPromptInput) {
    return;
  }

  const saved = await loadUserInstructions();
  els.userPromptInput.value = saved;
  setUserPromptStatus(saved ? t('savedPolicyLoaded') : '');

  els.userPromptInput.addEventListener('input', scheduleUserInstructionsSave);
  els.userPromptInput.addEventListener('blur', () => {
    if (userPromptSaveTimer) {
      clearTimeout(userPromptSaveTimer);
      userPromptSaveTimer = null;
    }
    persistUserInstructions(true).catch(handleFatalError);
  });
}

async function initAiProviderSettings() {
  currentSettings = await loadAiProviderSettings();

  if (currentSettings.aiProvider === AI_PROVIDERS.GEMINI_API) {
    els.providerGeminiApi.checked = true;
  } else {
    els.providerOnDevice.checked = true;
  }

  populateGeminiModelSelect(currentSettings.geminiApiModel);

  if (els.geminiApiKeyInput) {
    els.geminiApiKeyInput.value = currentSettings.geminiApiKey;
  }

  updateGeminiApiFieldsVisibility();
  setAiProviderStatus('');

  els.providerOnDevice?.addEventListener('change', () => {
    persistAiProvider().catch(handleFatalError);
  });
  els.providerGeminiApi?.addEventListener('change', () => {
    persistAiProvider().catch(handleFatalError);
  });
  els.geminiApiKeyInput?.addEventListener('input', scheduleGeminiApiKeySave);
  els.geminiApiKeyInput?.addEventListener('blur', () => {
    if (apiKeySaveTimer) {
      clearTimeout(apiKeySaveTimer);
      apiKeySaveTimer = null;
    }
    persistGeminiApiKey(true).catch(handleFatalError);
  });
  els.geminiModelSelect?.addEventListener('change', () => {
    persistGeminiApiModel().catch(handleFatalError);
  });
}

function setBusy(busy) {
  if (els.analyzeBtn) {
    els.analyzeBtn.disabled = busy;
  }
  if (els.ruleBasedBtn) {
    els.ruleBasedBtn.disabled = busy;
  }
  if (els.applyBtn) {
    els.applyBtn.disabled = busy;
  }
  if (els.currentWindowOnly) {
    els.currentWindowOnly.disabled = busy;
  }
  if (els.userPromptInput) {
    els.userPromptInput.disabled = busy;
  }
  if (els.providerOnDevice) {
    els.providerOnDevice.disabled = busy;
  }
  if (els.providerGeminiApi) {
    els.providerGeminiApi.disabled = busy;
  }
  if (els.geminiApiKeyInput) {
    els.geminiApiKeyInput.disabled = busy;
  }
  if (els.geminiModelSelect) {
    els.geminiModelSelect.disabled = busy;
  }
  if (els.ungroupAllBtn) {
    els.ungroupAllBtn.disabled = busy;
  }
}

let actionStatusTimer = null;

function showActionStatus(message, type = 'info') {
  if (!els.actionStatus) {
    return;
  }
  els.actionStatus.textContent = message;
  els.actionStatus.classList.remove('hidden', 'success');
  if (type === 'success') {
    els.actionStatus.classList.add('success');
  }
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer);
  }
  actionStatusTimer = window.setTimeout(() => {
    els.actionStatus?.classList.add('hidden');
    actionStatusTimer = null;
  }, 3500);
}

async function ungroupAllInScope() {
  clearError();
  const currentWindowOnly = els.currentWindowOnly?.checked ?? true;

  let count;
  try {
    count = await countTabGroupsInScope(currentWindowOnly);
  } catch (error) {
    showError(getDisplayError(error));
    return;
  }

  if (count === 0) {
    showActionStatus(t('ungroupNoGroups'));
    return;
  }

  if (!window.confirm(t('ungroupConfirm', String(count)))) {
    return;
  }

  setBusy(true);
  try {
    const { ungroupedTabs, removedGroups } = await ungroupAllTabs(currentWindowOnly);
    showActionStatus(
      t('ungroupComplete', String(removedGroups), String(ungroupedTabs)),
      'success',
    );
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    setBusy(false);
  }
}

function resetPreview() {
  currentPlan = null;
  els.previewSection?.classList.add('hidden');
  els.summarySection?.classList.add('hidden');
  if (els.previewList) {
    els.previewList.innerHTML = '';
  }
}

function formatPlanSummary(plan, tabCount) {
  const base = t(
    'planSummary',
    String(plan.groups.length),
    String(tabCount),
  );
  const summary = plan.mergeSummary;

  if (!summary?.merge) {
    return t('planAnalyzed', base);
  }

  if (summary.create === 0) {
    return t('planAllMerged', base);
  }

  return t(
    'planMergeCreate',
    base,
    String(summary.merge),
    String(summary.create),
  );
}

function renderPreview(plan, tabs) {
  if (!els.previewList) {
    return;
  }

  els.previewList.innerHTML = '';

  for (const group of plan.groups) {
    const card = document.createElement('div');
    card.className = 'group-card';

    const header = document.createElement('div');
    header.className = 'group-header';

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    const displayColor = group.mergeTarget?.color ?? group.color;
    dot.style.background = COLOR_MAP[displayColor] || COLOR_MAP.blue;

    const title = document.createElement('span');
    title.textContent = t(
      'groupTabCount',
      group.name,
      String(group.tabIndices.length),
    );

    const badge = document.createElement('span');
    badge.className = `group-action ${group.mergeTarget ? 'merge' : 'create'}`;
    badge.textContent = group.mergeTarget
      ? t('mergeExisting', group.mergeTarget.title)
      : t('badgeNew');

    header.appendChild(dot);
    header.appendChild(title);
    header.appendChild(badge);

    const list = document.createElement('ul');
    for (const index of group.tabIndices) {
      const tab = tabs[index];
      if (!tab) {
        continue;
      }
      const item = document.createElement('li');
      item.textContent = tab.title;
      list.appendChild(item);
    }

    card.appendChild(header);
    card.appendChild(list);
    els.previewList.appendChild(card);
  }

  if (els.summaryText) {
    els.summaryText.textContent = formatPlanSummary(plan, tabs.length);
  }
  els.summarySection?.classList.remove('hidden');
  els.previewSection?.classList.remove('hidden');
}

function setProgress(progress) {
  if (!els.progressSection || !els.progressText || !els.progressFill) {
    return;
  }

  const info = typeof progress === 'string'
    ? { message: progress, percent: 0, detail: null, phase: 'preparing' }
    : progress;

  els.progressSection.classList.remove('hidden');
  els.progressText.textContent = info.message ?? '';

  if (els.progressDetail) {
    if (info.detail) {
      els.progressDetail.textContent = info.detail;
      els.progressDetail.classList.remove('hidden');
    } else {
      els.progressDetail.textContent = '';
      els.progressDetail.classList.add('hidden');
    }
  }

  if (els.progressPercent) {
    if (info.percent === null || info.percent === undefined) {
      els.progressPercent.classList.add('hidden');
    } else {
      els.progressPercent.textContent = `${info.percent}%`;
      els.progressPercent.classList.remove('hidden');
    }
  }

  if (els.progressStream) {
    if (info.streamPreview) {
      els.progressStream.textContent = info.streamPreview;
      els.progressStream.classList.remove('hidden');
    } else {
      els.progressStream.textContent = '';
      els.progressStream.classList.add('hidden');
    }
  }

  if (info.percent === null || info.percent === undefined) {
    els.progressFill.style.width = '100%';
    els.progressFill.classList.add('indeterminate');
    return;
  }

  els.progressFill.classList.remove('indeterminate');
  els.progressFill.style.width = `${info.percent}%`;
}

function clearProgress() {
  els.progressSection?.classList.add('hidden');
  els.progressPercent?.classList.add('hidden');
  els.progressDetail?.classList.add('hidden');
  if (els.progressStream) {
    els.progressStream.textContent = '';
    els.progressStream.classList.add('hidden');
  }
  if (els.progressFill) {
    els.progressFill.classList.remove('indeterminate');
    els.progressFill.style.width = '0%';
  }
}

function appendDiagnosticItem(text) {
  if (!els.diagnosticsList) {
    return;
  }
  const item = document.createElement('li');
  item.textContent = text;
  els.diagnosticsList.appendChild(item);
}

function renderDiagnostics(result) {
  if (!els.diagnostics || !els.diagnosticsList) {
    return;
  }

  els.diagnosticsList.innerHTML = '';

  if (result.provider === AI_PROVIDERS.GEMINI_API) {
    appendDiagnosticItem(t('diagProviderGemini'));
    if (result.modelLabel) {
      appendDiagnosticItem(t('diagModel', result.modelLabel));
    }
    return;
  }

  if (result.environmentSummary) {
    appendDiagnosticItem(result.environmentSummary);
  }

  if (typeof result.hasLanguageModel === 'boolean') {
    appendDiagnosticItem(
      t(
        'diagLanguageModelApi',
        result.hasLanguageModel ? t('diagYes') : t('diagNo'),
      ),
    );
  }

  if (result.probeSummary) {
    appendDiagnosticItem(result.probeSummary);
  }

  if (result.selectedProfile) {
    appendDiagnosticItem(t('diagProfile', result.selectedProfile));
  }

  if (result.outputLanguageLabel) {
    appendDiagnosticItem(
      t('diagOutputLanguage', result.outputLanguageLabel, result.outputLanguage),
    );
  }

  if (result.browserLocales?.length) {
    appendDiagnosticItem(t('diagBrowserLocales', result.browserLocales.join(', ')));
  }

  if (result.likelyBlockers?.length) {
    appendDiagnosticItem(t('diagLikelyBlockers', result.likelyBlockers.join(' / ')));
  }

  const hints = result.hints || (
    result.status === 'unavailable' || result.status === 'missing-api'
      ? getUnavailableHints()
      : null
  );

  if (hints) {
    for (const hint of hints) {
      appendDiagnosticItem(hint);
    }
  }

  const shouldOpenDiagnostics = result.status === 'unavailable'
    || result.status === 'missing-api'
    || result.status === 'missing-key'
    || result.status === 'error';

  if (els.diagnostics) {
    els.diagnostics.open = shouldOpenDiagnostics;
  }
}

function shouldDisableAnalyze(result) {
  if (result.provider === AI_PROVIDERS.GEMINI_API) {
    return result.status === 'missing-key';
  }

  return result.status === 'unavailable' || result.status === 'missing-api';
}

async function refreshAiStatus() {
  try {
    const settings = getSettingsFromInputs();
    const result = await checkProviderAvailability(settings.aiProvider, settings);

    const presentation = resolveStatusPresentation(result, settings);

    if (els.aiStatus) {
      els.aiStatus.textContent = presentation.message;
    }
    setStatusDot(presentation.dot);
    setProviderDetail(presentation.detail);

    if (els.analyzeBtn) {
      els.analyzeBtn.disabled = shouldDisableAnalyze(result);
    }

    if (els.ruleBasedBtn) {
      els.ruleBasedBtn.disabled = false;
    }

    renderDiagnostics(result);

    if (statusPollTimer) {
      clearTimeout(statusPollTimer);
      statusPollTimer = null;
    }

    if (
      settings.aiProvider === AI_PROVIDERS.ON_DEVICE
      && result.status === 'downloading'
    ) {
      statusPollTimer = window.setTimeout(() => {
        refreshAiStatus().catch(handleFatalError);
      }, 3000);
    }
  } catch (error) {
    handleFatalError(error);
  }
}

async function analyzeTabsByDomain() {
  clearError();
  resetPreview();
  setBusy(true);

  try {
    const tabs = await getOrganizableTabs(els.currentWindowOnly?.checked ?? true);
    const tabSummaries = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title || t('untitledTab'),
      url: tab.url || '',
    }));

    const currentWindowOnly = els.currentWindowOnly?.checked ?? true;
    const plan = await resolvePlanWithExistingGroups(
      suggestGroupsByDomain(tabs),
      tabs,
      currentWindowOnly,
    );
    currentPlan = plan;
    renderPreview(plan, tabSummaries);
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    setBusy(false);
    await refreshAiStatus();
  }
}

async function analyzeTabs() {
  clearError();
  resetPreview();
  setBusy(true);

  const settings = getSettingsFromInputs();
  const useGeminiApi = settings.aiProvider === AI_PROVIDERS.GEMINI_API;
  const sessionReady = !useGeminiApi && isSessionReady();

  if (useGeminiApi) {
    setProgress({
      message: t('geminiApiAnalyzing'),
      percent: null,
      phase: 'analyzing',
      detail: null,
    });
  } else if (!sessionReady) {
    setProgress({
      message: t('checkingAiReadiness'),
      percent: 0,
      detail: t('firstDownloadHint'),
      phase: 'preparing',
    });
  } else {
    setProgress({
      message: t('aiThinking'),
      percent: null,
      phase: 'streaming',
      detail: t('waitingForResponse'),
      streamPreview: '',
    });
  }

  try {
    const tabs = await getOrganizableTabs(els.currentWindowOnly?.checked ?? true);
    const tabSummaries = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title || t('untitledTab'),
      url: tab.url || '',
    }));

    const userInstructions = await persistUserInstructions(false);
    const currentWindowOnly = els.currentWindowOnly?.checked ?? true;

    const rawPlan = await suggestGroupsForProvider(settings.aiProvider, tabs, {
      settings,
      userInstructions,
      onProgress(progress) {
        const showDuringAnalyze = progress.phase === 'analyzing'
          || progress.phase === 'streaming';
        if (!useGeminiApi && sessionReady && !showDuringAnalyze) {
          return;
        }
        setProgress(progress);
      },
    });

    currentPlan = await resolvePlanWithExistingGroups(
      rawPlan,
      tabs,
      currentWindowOnly,
    );
    renderPreview(currentPlan, tabSummaries);
    await refreshAiStatus();
  } catch (error) {
    showError(getDisplayError(error));
  } finally {
    clearProgress();
    setBusy(false);
    await refreshAiStatus();
  }
}

async function applyGroups() {
  if (!currentPlan) {
    return;
  }

  clearError();
  setBusy(true);

  try {
    const tabs = await getOrganizableTabs(els.currentWindowOnly?.checked ?? true);
    await applyGroupPlan(tabs, currentPlan);
    window.close();
  } catch (error) {
    showError(getDisplayError(error));
    setBusy(false);
    await refreshAiStatus();
  }
}

function handleFatalError(error) {
  if (els.aiStatus) {
    els.aiStatus.textContent = t('initFailed');
  }
  showError(getDisplayError(error));
}

function validateRequiredElements() {
  const required = [
    'aiStatus',
    'analyzeBtn',
    'errorText',
  ];

  for (const key of required) {
    if (!els[key]) {
      throw new AppError(ErrorCode.UI_ELEMENT_NOT_FOUND, { key });
    }
  }
}

function registerGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    handleFatalError(event.error ?? new Error(event.message));
  });

  window.addEventListener('unhandledrejection', (event) => {
    handleFatalError(event.reason);
  });
}

function startSessionPrewarm() {
  if (isGeminiApiProvider()) {
    return;
  }

  sessionWarmPromise = warmSession({
    onProgress(progress) {
      if (!els.aiStatus || isSessionReady()) {
        return;
      }

      if (progress.phase === 'downloading' || progress.phase === 'background') {
        if (els.aiStatus) {
          els.aiStatus.textContent = progress.message;
        }
        setStatusDot('pending');
        setProviderDetail(t('localAiDetail'));
      } else if (progress.phase === 'loading' || progress.percent === 0) {
        if (els.aiStatus) {
          els.aiStatus.textContent = t('loadingAiModel');
        }
        setStatusDot('pending');
        setProviderDetail(t('localAiDetail'));
      }
    },
  })
    .then(async () => {
      await refreshAiStatus();
    })
    .catch(handleFatalError)
    .finally(() => {
      sessionWarmPromise = null;
    });
}

function init() {
  applyStaticI18n();
  registerGlobalErrorHandlers();
  validateRequiredElements();

  els.analyzeBtn.addEventListener('click', analyzeTabs);
  els.ruleBasedBtn?.addEventListener('click', analyzeTabsByDomain);
  els.applyBtn?.addEventListener('click', applyGroups);
  els.cancelBtn?.addEventListener('click', resetPreview);
  els.ungroupAllBtn?.addEventListener('click', ungroupAllInScope);

  window.addEventListener('pagehide', () => {
    releaseSession();
  });

  initAiProviderSettings()
    .then(async () => {
      await initUserPromptSettings();
      await refreshAiStatus();
      startSessionPrewarm();
    })
    .catch(handleFatalError);
}

init();
