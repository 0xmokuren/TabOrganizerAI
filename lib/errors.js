import { t } from './i18n.js';

export const ErrorCode = {
  NO_GROUPABLE_TABS: 'NO_GROUPABLE_TABS',
  INVALID_AI_RESPONSE: 'INVALID_AI_RESPONSE',
  NO_APPLICABLE_GROUPS: 'NO_APPLICABLE_GROUPS',
  MIN_TABS_REQUIRED: 'MIN_TABS_REQUIRED',
  MAX_TABS_EXCEEDED: 'MAX_TABS_EXCEEDED',
  SAME_DOMAIN_MIN_TABS: 'SAME_DOMAIN_MIN_TABS',
  UI_ELEMENT_NOT_FOUND: 'UI_ELEMENT_NOT_FOUND',
};

export class AppError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.params = params;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}

export function formatAppError(error) {
  switch (error.code) {
    case ErrorCode.NO_GROUPABLE_TABS:
      return t('errorNoGroupableTabs');
    case ErrorCode.INVALID_AI_RESPONSE:
      return t('errorInvalidAiResponse');
    case ErrorCode.NO_APPLICABLE_GROUPS:
      return t('errorNoApplicableGroups');
    case ErrorCode.MIN_TABS_REQUIRED:
      return t('errorMinTabs');
    case ErrorCode.MAX_TABS_EXCEEDED:
      return t(
        'errorMaxTabs',
        String(error.params.max),
        String(error.params.current),
      );
    case ErrorCode.SAME_DOMAIN_MIN_TABS:
      return t('errorSameDomainMinTabs');
    case ErrorCode.UI_ELEMENT_NOT_FOUND:
      return t('errorUiElementNotFound', String(error.params.key));
    default:
      return error.code;
  }
}

export function getDisplayError(error) {
  if (isAppError(error)) {
    const message = formatAppError(error);
    if (error.code === ErrorCode.NO_GROUPABLE_TABS) {
      return `${message} ${t('errorNoGroupableTabsHint')}`;
    }
    return message;
  }

  return error instanceof Error ? error.message : String(error);
}
