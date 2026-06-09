import { getTabClusterKey } from './plan-splitter.js';

const MERGE_SCORE_THRESHOLD = 0.45;

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s_\-・/／&＆+.,、]+/g, '');
}

function nameSimilarity(proposedName, existingTitle) {
  const left = normalizeName(proposedName);
  const right = normalizeName(existingTitle);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return 0.72 + ratio * 0.23;
  }
  return 0;
}

function clusterKeySet(tabs) {
  return new Set(tabs.map((tab) => getTabClusterKey(tab)));
}

function jaccardSimilarity(left, right) {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreMergeCandidate(proposedName, proposedTabs, existingGroup) {
  const proposedKeys = clusterKeySet(proposedTabs);
  const existingKeys = clusterKeySet(existingGroup.tabs);
  const keyScore = jaccardSimilarity(proposedKeys, existingKeys);
  const nameScore = nameSimilarity(proposedName, existingGroup.title);

  if (!existingGroup.title.trim()) {
    return keyScore >= 0.5 ? keyScore : 0;
  }

  if (nameScore >= 0.85) {
    return nameScore;
  }

  if (keyScore >= 0.66) {
    return keyScore * 0.85 + nameScore * 0.15;
  }

  return keyScore * 0.55 + nameScore * 0.45;
}

export function attachMergeTargets(plan, ungroupedTabs, existingGroups) {
  if (!existingGroups.length || !plan.groups.length) {
    return {
      ...plan,
      mergeSummary: {
        merge: 0,
        create: plan.groups.length,
      },
    };
  }

  const pairs = [];

  plan.groups.forEach((group, proposedIndex) => {
    const proposedTabs = group.tabIndices
      .map((index) => ungroupedTabs[index])
      .filter(Boolean);

    for (const existingGroup of existingGroups) {
      const score = scoreMergeCandidate(group.name, proposedTabs, existingGroup);
      if (score >= MERGE_SCORE_THRESHOLD) {
        pairs.push({
          proposedIndex,
          existingGroup,
          score,
        });
      }
    }
  });

  pairs.sort((left, right) => right.score - left.score);

  const usedProposed = new Set();
  const usedExisting = new Set();
  const assignments = new Map();

  for (const pair of pairs) {
    if (
      usedProposed.has(pair.proposedIndex)
      || usedExisting.has(pair.existingGroup.id)
    ) {
      continue;
    }

    usedProposed.add(pair.proposedIndex);
    usedExisting.add(pair.existingGroup.id);
    assignments.set(pair.proposedIndex, {
      groupId: pair.existingGroup.id,
      title: pair.existingGroup.title.trim() || '（無題）',
      color: pair.existingGroup.color,
      score: pair.score,
    });
  }

  const groups = plan.groups.map((group, index) => ({
    ...group,
    mergeTarget: assignments.get(index) ?? null,
  }));

  const mergeCount = groups.filter((group) => group.mergeTarget).length;

  return {
    ...plan,
    groups,
    mergeSummary: {
      merge: mergeCount,
      create: groups.length - mergeCount,
    },
  };
}
