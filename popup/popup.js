import { suggestGroups, checkAiAvailability, UNAVAILABLE_HINTS } from '../lib/ai-organizer.js';
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
  progressSection: document.getElementById('progress-section'),
  progressText: document.getElementById('progress-text'),
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

function showError(message) {
  els.errorText.textContent = message;
  els.errorText.classList.remove('hidden');
}

function clearError() {
  els.errorText.textContent = '';
  els.errorText.classList.add('hidden');
}

function setBusy(busy) {
  els.analyzeBtn.disabled = busy;
  els.applyBtn.disabled = busy;
  els.currentWindowOnly.disabled = busy;
}

function resetPreview() {
  currentPlan = null;
  els.previewSection.classList.add('hidden');
  els.summarySection.classList.add('hidden');
  els.previewList.innerHTML = '';
}

function renderPreview(plan, tabs) {
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

  els.summaryText.textContent = `${plan.groups.length} グループ / ${tabs.length} タブを分析しました`;
  els.summarySection.classList.remove('hidden');
  els.previewSection.classList.remove('hidden');
}

function setProgress(text, percent = null) {
  els.progressSection.classList.remove('hidden');
  els.progressText.textContent = text;
  if (percent === null) {
    els.progressFill.style.width = '100%';
    els.progressFill.classList.add('indeterminate');
    return;
  }
  els.progressFill.classList.remove('indeterminate');
  els.progressFill.style.width = `${percent}%`;
}

function clearProgress() {
  els.progressSection.classList.add('hidden');
  els.progressFill.classList.remove('indeterminate');
  els.progressFill.style.width = '0%';
}

function renderDiagnostics(result) {
  els.diagnosticsList.innerHTML = '';

  if (result.probeSummary) {
    const item = document.createElement('li');
    item.textContent = result.probeSummary;
    els.diagnosticsList.appendChild(item);
  }

  if (result.selectedProfile) {
    const item = document.createElement('li');
    item.textContent = `使用プロファイル: ${result.selectedProfile}`;
    els.diagnosticsList.appendChild(item);
  }

  const hints = result.hints || (
    result.status === 'unavailable' || result.status === 'missing-api'
      ? UNAVAILABLE_HINTS
      : null
  );

  if (hints) {
    for (const hint of hints) {
      const item = document.createElement('li');
      item.textContent = hint;
      els.diagnosticsList.appendChild(item);
    }
  }

  els.diagnostics.classList.toggle('hidden', els.diagnosticsList.children.length === 0);
}

async function refreshAiStatus() {
  const result = await checkAiAvailability();
  els.aiStatus.textContent = result.message;
  els.analyzeBtn.disabled =
    result.status === 'unavailable' || result.status === 'missing-api';

  renderDiagnostics(result);

  if (statusPollTimer) {
    clearTimeout(statusPollTimer);
    statusPollTimer = null;
  }

  if (result.status === 'downloading') {
    statusPollTimer = window.setTimeout(refreshAiStatus, 3000);
  }
}

async function analyzeTabs() {
  clearError();
  resetPreview();
  setBusy(true);
  setProgress('AI の準備を確認しています…', 0);

  try {
    const tabs = await getOrganizableTabs(els.currentWindowOnly.checked);
    const tabSummaries = tabs.map((tab) => ({
      id: tab.id,
      title: tab.title || 'Untitled',
      url: tab.url || '',
    }));

    const plan = await suggestGroups(tabs, {
      onStatus(status) {
        if (status === 'downloading') {
          setProgress('AI モデルをダウンロード中です。完了までお待ちください…');
        } else if (status === 'downloadable') {
          setProgress('AI モデルを初期化しています…', 0);
        }
      },
      onDownloadProgress(percent, loaded) {
        if (loaded >= 1) {
          setProgress('モデルを読み込んでいます…');
          return;
        }
        setProgress(`AI モデルをダウンロード中… ${percent}%`, percent);
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
    const tabs = await getOrganizableTabs(els.currentWindowOnly.checked);
    await applyGroupPlan(tabs, currentPlan);
    window.close();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setBusy(false);
  }
}

els.analyzeBtn.addEventListener('click', analyzeTabs);
els.applyBtn.addEventListener('click', applyGroups);
els.cancelBtn.addEventListener('click', resetPreview);

refreshAiStatus();
