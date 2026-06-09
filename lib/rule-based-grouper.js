import { GROUP_COLORS } from './constants.js';
import { validatePlan } from './tab-manager.js';

function getDomainLabel(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function suggestGroupsByDomain(tabs) {
  const buckets = new Map();

  tabs.forEach((tab, index) => {
    const label = getDomainLabel(tab.url || '');
    if (!buckets.has(label)) {
      buckets.set(label, []);
    }
    buckets.get(label).push(index);
  });

  const groups = [];
  let colorIndex = 0;

  for (const [name, tabIndices] of buckets) {
    if (tabIndices.length < 2) {
      continue;
    }

    groups.push({
      name,
      color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
      tabIndices,
    });
    colorIndex += 1;
  }

  if (groups.length === 0) {
    throw new Error('同一ドメインのタブが 2 つ以上見つかりませんでした');
  }

  return validatePlan({ groups }, tabs);
}
