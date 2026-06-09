import { ESTIMATED_MODEL_SIZE_BYTES, ESTIMATED_MODEL_SIZE_GB } from './constants.js';
import { t } from './i18n.js';

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = unitIndex >= 3 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function buildDownloadProgress(loadedRatio, {
  estimatedBytes = ESTIMATED_MODEL_SIZE_BYTES,
} = {}) {
  const ratio = Math.max(0, Math.min(1, loadedRatio || 0));
  const percent = Math.round(ratio * 100);
  const downloadedBytes = ratio * estimatedBytes;

  if (ratio >= 1) {
    return {
      phase: 'loading',
      percent: 100,
      message: t('progressLoadingModel'),
      detail: t('progressLoadingDetail'),
      downloadedBytes: estimatedBytes,
      estimatedBytes,
    };
  }

  return {
    phase: 'downloading',
    percent,
    message: t('progressDownloading', String(percent)),
    detail: t(
      'progressDownloadDetail',
      formatBytes(downloadedBytes),
      String(ESTIMATED_MODEL_SIZE_GB),
    ),
    downloadedBytes,
    estimatedBytes,
  };
}

export function buildBackgroundDownloadProgress(elapsedMs) {
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const elapsed = minutes > 0
    ? t('timeMinutesSeconds', String(minutes), String(seconds))
    : t('timeSeconds', String(seconds));

  return {
    phase: 'background',
    percent: null,
    message: t('progressBackgroundDownloading'),
    detail: t(
      'progressBackgroundDetail',
      elapsed,
      String(ESTIMATED_MODEL_SIZE_GB),
    ),
    downloadedBytes: null,
    estimatedBytes: ESTIMATED_MODEL_SIZE_BYTES,
  };
}
