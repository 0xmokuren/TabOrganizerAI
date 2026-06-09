export async function getExistingTabGroups(currentWindowOnly = true) {
  const query = {
    pinned: false,
    url: ['http://*/*', 'https://*/*'],
  };
  if (currentWindowOnly) {
    query.currentWindow = true;
  }

  const tabs = await chrome.tabs.query(query);
  const tabsByGroup = new Map();

  for (const tab of tabs) {
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      continue;
    }
    if (!tabsByGroup.has(tab.groupId)) {
      tabsByGroup.set(tab.groupId, []);
    }
    tabsByGroup.get(tab.groupId).push(tab);
  }

  if (tabsByGroup.size === 0) {
    return [];
  }

  const windowIds = [
    ...new Set(
      tabs
        .filter((tab) => tabsByGroup.has(tab.groupId))
        .map((tab) => tab.windowId),
    ),
  ];

  const existing = [];

  for (const windowId of windowIds) {
    const groups = await chrome.tabGroups.query({ windowId });
    for (const group of groups) {
      const memberTabs = tabsByGroup.get(group.id);
      if (!memberTabs?.length) {
        continue;
      }

      existing.push({
        id: group.id,
        title: group.title || '',
        color: group.color,
        windowId: group.windowId,
        tabs: memberTabs,
      });
    }
  }

  return existing;
}
