import { GROUP_COLORS } from './constants.js';
import {
  buildLocalizedPrompt,
  getDefaultGroupName,
  resolveBrowserOutputLanguage,
} from './locale.js';
import { refinePlanGroups } from './plan-splitter.js';
import { getExistingTabGroups } from './existing-groups.js';
import { attachMergeTargets } from './group-merge.js';
import { AppError, ErrorCode } from './errors.js';
import { t } from './i18n.js';

export async function getOrganizableTabs(currentWindowOnly = true) {
  const query = {
    pinned: false,
    url: ['http://*/*', 'https://*/*'],
  };
  if (currentWindowOnly) {
    query.currentWindow = true;
  }

  const tabs = await chrome.tabs.query(query);
  return tabs.filter((tab) => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);
}

export function formatTabsForPrompt(tabs) {
  return tabs
    .map((tab, index) => {
      const title = (tab.title || t('untitledTab')).replace(/\s+/g, ' ').trim();
      const url = tab.url || '';
      return `${index}: ${title} (${url})`;
    })
    .join('\n');
}

export function buildPrompt(
  tabs,
  outputLanguage = resolveBrowserOutputLanguage(),
  userInstructions = '',
) {
  const tabList = formatTabsForPrompt(tabs);
  return buildLocalizedPrompt(tabList, outputLanguage, userInstructions);
}

function normalizeColor(color) {
  if (typeof color === 'string' && GROUP_COLORS.includes(color)) {
    return color;
  }
  return 'blue';
}

function sanitizeGroupName(name, outputLanguage = resolveBrowserOutputLanguage()) {
  const fallback = getDefaultGroupName(outputLanguage);
  const trimmed = String(name || fallback).trim();
  return trimmed.slice(0, 20) || fallback;
}

export function parsePlan(plan, tabCount, outputLanguage = resolveBrowserOutputLanguage()) {
  if (!plan || !Array.isArray(plan.groups)) {
    throw new AppError(ErrorCode.INVALID_AI_RESPONSE);
  }

  const usedIndices = new Set();
  const groups = [];

  for (const rawGroup of plan.groups) {
    const indices = Array.isArray(rawGroup.tabIndices)
      ? rawGroup.tabIndices.filter(
          (index) =>
            Number.isInteger(index) &&
            index >= 0 &&
            index < tabCount &&
            !usedIndices.has(index),
        )
      : [];

    if (indices.length < 2) {
      continue;
    }

    indices.forEach((index) => usedIndices.add(index));
    groups.push({
      name: sanitizeGroupName(rawGroup.name, outputLanguage),
      color: normalizeColor(rawGroup.color),
      tabIndices: indices,
    });
  }

  return { groups };
}

export function validatePlan(
  plan,
  tabs,
  outputLanguage = resolveBrowserOutputLanguage(),
) {
  const tabCount = Array.isArray(tabs) ? tabs.length : tabs;
  const tabList = Array.isArray(tabs) ? tabs : null;
  const parsed = parsePlan(plan, tabCount, outputLanguage);
  const refined = tabList
    ? refinePlanGroups(parsed, tabList, outputLanguage)
    : parsed;

  if (refined.groups.length === 0) {
    throw new AppError(ErrorCode.NO_GROUPABLE_TABS);
  }
  return refined;
}

export async function resolvePlanWithExistingGroups(
  plan,
  tabs,
  currentWindowOnly = true,
  outputLanguage = resolveBrowserOutputLanguage(),
) {
  const validated = validatePlan(plan, tabs, outputLanguage);
  const existingGroups = await getExistingTabGroups(currentWindowOnly);
  return attachMergeTargets(validated, tabs, existingGroups);
}

export async function countTabGroupsInScope(currentWindowOnly = true) {
  const query = currentWindowOnly ? { currentWindow: true } : {};
  const tabs = await chrome.tabs.query(query);
  return new Set(
    tabs
      .filter((tab) => tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
      .map((tab) => tab.groupId),
  ).size;
}

export async function ungroupAllTabs(currentWindowOnly = true) {
  const query = currentWindowOnly ? { currentWindow: true } : {};
  const tabs = await chrome.tabs.query(query);
  const grouped = tabs.filter(
    (tab) => tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE,
  );

  if (grouped.length === 0) {
    return { ungroupedTabs: 0, removedGroups: 0 };
  }

  const groupIds = new Set(grouped.map((tab) => tab.groupId));
  const tabIds = grouped
    .map((tab) => tab.id)
    .filter((id) => typeof id === 'number');

  await chrome.tabs.ungroup(tabIds);

  return { ungroupedTabs: tabIds.length, removedGroups: groupIds.size };
}

export async function applyGroupPlan(tabs, plan) {
  const created = [];
  const merged = [];

  for (const group of plan.groups) {
    const tabIds = group.tabIndices
      .map((index) => tabs[index]?.id)
      .filter((id) => typeof id === 'number');

    if (tabIds.length === 0) {
      continue;
    }

    if (group.mergeTarget?.groupId) {
      await chrome.tabs.group({
        groupId: group.mergeTarget.groupId,
        tabIds,
      });
      merged.push({
        groupId: group.mergeTarget.groupId,
        name: group.mergeTarget.title,
        color: group.mergeTarget.color,
        tabCount: tabIds.length,
      });
      continue;
    }

    if (tabIds.length < 2) {
      continue;
    }

    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: group.name,
      color: group.color,
    });

    created.push({
      groupId,
      name: group.name,
      color: group.color,
      tabCount: tabIds.length,
    });
  }

  if (created.length === 0 && merged.length === 0) {
    throw new AppError(ErrorCode.NO_APPLICABLE_GROUPS);
  }

  return { created, merged };
}
