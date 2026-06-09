import { GROUP_COLORS } from './constants.js';
import {
  buildLocalizedPrompt,
  getDefaultGroupName,
  resolveBrowserOutputLanguage,
} from './locale.js';

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
      const title = (tab.title || 'Untitled').replace(/\s+/g, ' ').trim();
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
  return buildLocalizedPrompt(tabList, outputLanguage, GROUP_COLORS, userInstructions);
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

export function validatePlan(plan, tabCount, outputLanguage = resolveBrowserOutputLanguage()) {
  if (!plan || !Array.isArray(plan.groups)) {
    throw new Error('AI の応答形式が不正です');
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

  if (groups.length === 0) {
    throw new Error('グループ化できるタブが見つかりませんでした');
  }

  return { groups };
}

export async function applyGroupPlan(tabs, plan) {
  const validated = validatePlan(plan, tabs.length);
  const created = [];

  for (const group of validated.groups) {
    const tabIds = group.tabIndices
      .map((index) => tabs[index]?.id)
      .filter((id) => typeof id === 'number');

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

  return created;
}
