import { checkAiAvailability, suggestGroups } from '../lib/ai-organizer.js';
import { applyGroupPlan, getOrganizableTabs } from '../lib/tab-manager.js';

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
    case 'CHECK_AI':
      return { ok: true, ...(await checkAiAvailability()) };

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

    case 'SUGGEST_GROUPS': {
      const tabs = await getOrganizableTabs(message.currentWindowOnly !== false);
      const requestId = message.requestId || 'default';

      const plan = await suggestGroups(tabs, {
        onDownloadProgress(percent) {
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_PROGRESS',
            requestId,
            percent,
          }).catch(() => {});
        },
      });

      return {
        ok: true,
        plan,
        tabCount: tabs.length,
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title || 'Untitled',
          url: tab.url || '',
        })),
      };
    }

    case 'APPLY_GROUPS': {
      const tabs = await getOrganizableTabs(message.currentWindowOnly !== false);
      const created = await applyGroupPlan(tabs, message.plan);
      return { ok: true, created };
    }

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
