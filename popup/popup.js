import {
  suggestGroups,
  checkAiAvailability,
  warmSession,
  releaseSession,
  isSessionReady,
  UNAVAILABLE_HINTS,
} from '../lib/ai-organizer.js';
import { suggestGroupsByDomain } from '../lib/rule-based-grouper.js';
import {
  applyGroupPlan,
  getOrganizableTabs,
} from '../lib/tab-manager.js';

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
  currentWindowOnly: document.getElementById('current-window-only'),
  analyzeBtn: document.getElementById('analyze-btn'),
  ruleBasedBtn: document.getElementById('rule-based-btn'),
  progressSection: document.getElementById('progress-section'),
  progressPercent: document.getElementById('progress-percent'),
  progressText: document.getElementById('progress-text'),
  progressDetail: document.getElementById('progress-detail'),
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
};

let currentPlan = null;
let statusPollTimer = null;
let sessionWarmPromise = null;

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
}

function resetPreview() {
  currentPlan = null;
  els.previewSection?.classList.add('hidden');
  els.summarySection?.classList.add('hidden');
  if (els.previewList) {
    els.previewList.innerHTML = '';
  }
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
    dot.style.background = COLOR_MAP[group.color] || COLOR_MAP.blue;

    const title = document.createElement('span');
    title.textContent = `${group.name} (${group.tabIndices.length} タブ)`;

    header.appendChild(dot);
    header.appendChild(title);

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
    els.summaryText.textContent = `${plan.groups.length} グループ / ${tabs.length} タブを分析しました`;
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

  if (result.environmentSummary) {
    appendDiagnosticItem(result.environmentSummary);
  }

  if (typeof result.hasLanguageModel === 'boolean') {
    appendDiagnosticItem(
      `LanguageModel API: ${result.hasLanguageModel ? 'あり' : 'なし'}`,
    );
  }

  if (result.probeSummary) {
    appendDiagnosticItem(result.probeSummary);
  }

  if (result.selectedProfile) {
    appendDiagnosticItem(`使用プロファイル: ${result.selectedProfile}`);
  }

  if (result.likelyBlockers?.length) {
    appendDiagnosticItem(`想定原因: ${result.likelyBlockers.join(' / ')}`);
  }

  const hints = result.hints || (
    result.status === 'unavailable' || result.status === 'missing-api'
      ? UNAVAILABLE_HINTS
      : null
  );

  if (hints) {
    for (const hint of hints) {
      appendDiagnosticItem(hint);
    }
  }

  els.diagnostics.open = els.diagnosticsList.children.length > 0;
}

async function refreshAiStatus() {
  try {
    const result = await checkAiAvailability();

    if (els.aiStatus) {
      if (sessionWarmPromise && !result.sessionReady) {
        els.aiStatus.textContent = 'AI を準備中…';
      } else {
        els.aiStatus.textContent = result.message;
      }
    }
    if (els.analyzeBtn) {
      els.analyzeBtn.disabled =
        result.status === 'unavailable' ||
        result.status === 'missing-api';
    }
    if (els.ruleBasedBtn) {
      els.ruleBasedBtn.disabled = false;
    }

    renderDiagnostics(result);

    if (statusPollTimer) {
      clearTimeout(statusPollTimer);
      statusPollTimer = null;
    }

    if (result.status === 'downloading') {
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
      title: tab.title || 'Untitled',
      url: tab.url || '',
    }));

    const plan = suggestGroupsByDomain(tabs);
    currentPlan = plan;
    renderPreview(plan, tabSummaries);

    if (els.summaryText) {
      els.summaryText.textContent =
        `${plan.groups.length} グループ / ${tabs.length} タブ（ドメイン単位）`;
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}

async function analyzeTabs() {
  clearError();
  resetPreview();
  setBusy(true);

  const sessionReady = isSessionReady();
  if (!sessionReady) {
    setProgress({
      message: 'AI の準備を確認しています…',
      percent: 0,
      detail: '初回は約 22 GB のダウンロードが必要な場合があります',
      phase: 'preparing',
    });
  } else {
    setProgress({
      message: 'タブを分析しています…',
      percent: 100,
      phase: 'analyzing',
      detail: null,
    });
  }

  try {
    const tabs = await getOrganizableTabs(els.currentWindowOnly?.checked ?? true);
    const tabSummaries = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url || '',
    }));

    const plan = await suggestGroups(tabs, {
      onProgress(progress) {
        if (sessionReady && progress.phase !== 'analyzing') {
          return;
        }
        setProgress(progress);
      },
    });

    currentPlan = plan;
    renderPreview(plan, tabSummaries);
    await refreshAiStatus();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    clearProgress();
    setBusy(false);
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
    showError(error instanceof Error ? error.message : String(error));
    setBusy(false);
  }
}

function handleFatalError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (els.aiStatus) {
    els.aiStatus.textContent = '拡張機能の初期化に失敗しました';
  }
  showError(message);
}

function validateRequiredElements() {
  const required = [
    'aiStatus',
    'analyzeBtn',
    'errorText',
  ];

  for (const key of required) {
    if (!els[key]) {
      throw new Error(`UI 要素が見つかりません: ${key}`);
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
  sessionWarmPromise = warmSession({
    onProgress(progress) {
      if (!els.aiStatus || isSessionReady()) {
        return;
      }

      if (progress.phase === 'downloading' || progress.phase === 'background') {
        els.aiStatus.textContent = progress.message;
      } else if (progress.phase === 'loading' || progress.percent === 0) {
        els.aiStatus.textContent = 'AI モデルを読み込み中…';
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
  registerGlobalErrorHandlers();
  validateRequiredElements();

  els.analyzeBtn.addEventListener('click', analyzeTabs);
  els.ruleBasedBtn?.addEventListener('click', analyzeTabsByDomain);
  els.applyBtn?.addEventListener('click', applyGroups);
  els.cancelBtn?.addEventListener('click', resetPreview);

  window.addEventListener('pagehide', () => {
    releaseSession();
  });

  refreshAiStatus()
    .then(() => {
      startSessionPrewarm();
    })
    .catch(handleFatalError);
}

init();
