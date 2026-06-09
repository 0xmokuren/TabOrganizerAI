import { t } from './i18n.js';

export function getEnvironmentInfo() {
  const chromeMatch = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  const chromeMajor = chromeMatch ? Number(chromeMatch[1].split('.')[0]) : null;

  return {
    chromeVersion: chromeMatch?.[1] ?? t('envUnknown'),
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
      ? t('envMemoryUnknown')
      : t('envMemoryRef', String(info.deviceMemoryGB));
  const cores = info.cpuCores ?? t('envUnknown');
  const oldSuffix = info.chromeSupported ? '' : t('envChromeOld');

  return t(
    'envSummary',
    info.chromeVersion,
    oldSuffix,
    info.platform,
    memory,
    String(cores),
  );
}

export function getLikelyBlockers(info) {
  const blockers = [];

  if (!info.chromeSupported) {
    blockers.push(t('blockerChromeUpdate'));
  }

  if (info.deviceMemoryGB !== null && info.deviceMemoryGB < 16) {
    blockers.push(t('blockerLowMemory', String(info.deviceMemoryGB)));
  }

  if (info.cpuCores !== null && info.cpuCores < 4) {
    blockers.push(t('blockerLowCores', String(info.cpuCores)));
  }

  if (!info.onLine) {
    blockers.push(t('blockerOffline'));
  }

  if (blockers.length === 0) {
    blockers.push(t('blockerTryBypassPerf'));
  }

  return blockers;
}
