import { applyGroupPlan, getOrganizableTabs } from '../lib/tab-manager.js';

// AI 処理はユーザー操作が必要なため popup 側で実行する。
// Service Worker は将来のバックグラウンド機能用に最小構成で残す。

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_TABS': {
      const tabs = await getOrganizableTabs(message.currentWindowOnly !== false);
      return {
        ok: true,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title || 'Untitled',
          url: tab.url || '',
        })),
      };
    }

    case 'APPLY_GROUPS': {
      const tabs = await getOrganizableTabs(message.currentWindowOnly !== false);
      const result = await applyGroupPlan(tabs, message.plan);
      return { ok: true, ...result };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
