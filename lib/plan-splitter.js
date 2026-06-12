import { GROUP_COLORS } from './constants.js';
import { getDefaultGroupName, resolveBrowserOutputLanguage } from './locale.js';

export function getTabClusterKey(tab) {
  const url = tab.url || '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (host.includes('amazon.')) {
      return `site:${host}`;
    }

    if (host === 'github.com') {
      if (parts.length >= 2) {
        return `gh:${parts[0]}/${parts[1]}`;
      }
      if (parts.length === 1) {
        return `gh:${parts[0]}`;
      }
      return 'gh:home';
    }

    if (parts.length >= 2) {
      return `${host}/${parts[0]}/${parts[1]}`;
    }
    if (parts.length >= 1) {
      return `${host}/${parts[0]}`;
    }
    return `site:${host}`;
  } catch {
    return 'unknown';
  }
}

/** 複数トピックを無理に1グループ名にまとめたパターン */
const COMBINED_NAME_PATTERN = /[・･/／&＆+]|(?:\s*[,、]\s*)|(?:\s+(?:and|&|＆)\s+)/i;

function looksLikeCombinedName(name) {
  return COMBINED_NAME_PATTERN.test(name);
}

function shouldSplitGroup(group) {
  // 結合名（"A・B" や "Work and Study"）だけ分割対象にする。
  // ドメインが複数なのは意味グルーピングの自然な姿なので分割しない。
  return looksLikeCombinedName(group.name);
}

function nameFromClusterKey(key, tabs, indices) {
  if (key.startsWith('gh:')) {
    const slug = key.slice(3);
    if (slug === 'home') {
      return 'GitHub';
    }
    if (slug.includes('/')) {
      return slug.split('/')[1] ?? slug;
    }
    return slug;
  }

  const sampleTitle = tabs[indices[0]]?.title?.trim();
  if (sampleTitle) {
    for (const separator of [' | ', ' - ', ' — ', ': ']) {
      const index = sampleTitle.indexOf(separator);
      if (index > 3) {
        return sampleTitle.slice(0, index).trim();
      }
    }
  }

  const segment = key.split('/').pop() ?? key;
  if (segment.startsWith('site:')) {
    return segment.slice(5);
  }
  return segment;
}

function nextColor(baseColor, offset) {
  const baseIndex = GROUP_COLORS.indexOf(baseColor);
  const index = baseIndex >= 0 ? baseIndex : 0;
  return GROUP_COLORS[(index + offset) % GROUP_COLORS.length];
}

function sanitizeSplitName(name, outputLanguage) {
  const fallback = getDefaultGroupName(outputLanguage);
  const trimmed = String(name || fallback).trim();
  return trimmed.slice(0, 20) || fallback;
}

function splitGroup(group, tabs, outputLanguage) {
  const buckets = new Map();

  for (const index of group.tabIndices) {
    const key = getTabClusterKey(tabs[index]);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(index);
  }

  const splitGroups = [];
  let colorOffset = 0;

  for (const [key, indices] of buckets) {
    if (indices.length < 2) {
      continue;
    }

    splitGroups.push({
      name: sanitizeSplitName(nameFromClusterKey(key, tabs, indices), outputLanguage),
      color: nextColor(group.color, colorOffset),
      tabIndices: indices,
    });
    colorOffset += 1;
  }

  return splitGroups;
}

export function refinePlanGroups(
  plan,
  tabs,
  outputLanguage = resolveBrowserOutputLanguage(),
) {
  const refined = [];

  for (const group of plan.groups) {
    if (!shouldSplitGroup(group)) {
      refined.push(group);
      continue;
    }

    const splitGroups = splitGroup(group, tabs, outputLanguage);
    if (splitGroups.length === 0) {
      // 結合名だが分割で全タブが捨てられた場合は元のグループに戻す。
      // ユーザーが「グループ化できるタブが見つかりません」で詰むのを防ぐ。
      refined.push(group);
      continue;
    }
    if (splitGroups.length === 1) {
      refined.push(splitGroups[0]);
      continue;
    }

    refined.push(...splitGroups);
  }

  return { groups: refined };
}
