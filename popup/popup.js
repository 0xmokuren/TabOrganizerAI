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
};

let currentPlan = null;
let requestId = null;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

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

async function refreshAiStatus() {
  const result = await sendMessage({ type: 'CHECK_AI' });
  if (!result?.ok) {
    els.aiStatus.textContent = result?.error || '状態を取得できません';
    return;
  }

  els.aiStatus.textContent = result.message;
  els.analyzeBtn.disabled = result.status === 'unavailable';
}

async function analyzeTabs() {
  clearError();
  resetPreview();
  setBusy(true);
  requestId = crypto.randomUUID();

  els.progressSection.classList.remove('hidden');
  els.progressText.textContent = 'AI がタブを分析しています…';
  els.progressFill.style.width = '0%';

  try {
    const result = await sendMessage({
      type: 'SUGGEST_GROUPS',
      currentWindowOnly: els.currentWindowOnly.checked,
      requestId,
    });

    if (!result?.ok) {
      throw new Error(result?.error || '分析に失敗しました');
    }

    currentPlan = result.plan;
    renderPreview(result.plan, result.tabs);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    els.progressSection.classList.add('hidden');
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
    const result = await sendMessage({
      type: 'APPLY_GROUPS',
      plan: currentPlan,
      currentWindowOnly: els.currentWindowOnly.checked,
    });

    if (!result?.ok) {
      throw new Error(result?.error || '適用に失敗しました');
    }

    window.close();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setBusy(false);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'DOWNLOAD_PROGRESS' || message.requestId !== requestId) {
    return;
  }
  els.progressText.textContent = `AI モデルをダウンロード中… ${message.percent}%`;
  els.progressFill.style.width = `${message.percent}%`;
});

els.analyzeBtn.addEventListener('click', analyzeTabs);
els.applyBtn.addEventListener('click', applyGroups);
els.cancelBtn.addEventListener('click', resetPreview);

refreshAiStatus();
