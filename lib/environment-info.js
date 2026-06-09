export function getEnvironmentInfo() {
  const chromeMatch = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  const chromeMajor = chromeMatch ? Number(chromeMatch[1].split('.')[0]) : null;

  return {
    chromeVersion: chromeMatch?.[1] ?? '不明',
    chromeMajor,
    chromeSupported: chromeMajor !== null && chromeMajor >= 138,
    platform: navigator.platform,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    cpuCores: navigator.hardwareConcurrency ?? null,
    language: navigator.language,
    onLine: navigator.onLine,
  };
}

export function formatEnvironmentSummary(info) {
  const memory =
    info.deviceMemoryGB === null
      ? '不明（Chrome が非公開）'
      : `${info.deviceMemoryGB} GB（参考値）`;
  const cores = info.cpuCores ?? '不明';

  return [
    `Chrome ${info.chromeVersion}${info.chromeSupported ? '' : '（138 未満の可能性）'}`,
    `OS: ${info.platform}`,
    `メモリ参考値: ${memory}`,
    `CPU コア: ${cores}`,
  ].join(' / ');
}

export function getLikelyBlockers(info) {
  const blockers = [];

  if (!info.chromeSupported) {
    blockers.push('Chrome 138 以上に更新してください');
  }

  if (info.deviceMemoryGB !== null && info.deviceMemoryGB < 16) {
    blockers.push(
      `メモリ参考値が ${info.deviceMemoryGB} GB です（Prompt API は 16 GB 以上が必要）`,
    );
  }

  if (info.cpuCores !== null && info.cpuCores < 4) {
    blockers.push(`CPU コア数が ${info.cpuCores} です（4 コア以上が必要）`);
  }

  if (!info.onLine) {
    blockers.push('オフラインです（初回モデル DL にネットワークが必要）');
  }

  if (blockers.length === 0) {
    blockers.push(
      'ハードウェア要件は満たしている可能性があります。chrome://flags の BypassPerfRequirement を試してください',
    );
  }

  return blockers;
}
