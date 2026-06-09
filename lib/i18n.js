export function t(key, ...substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

export function applyStaticI18n(root = document) {
  const doc = root.ownerDocument ?? document;
  const lang = chrome.i18n.getUILanguage();
  if (doc.documentElement) {
    doc.documentElement.lang = lang;
  }

  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) {
      element.textContent = t(key);
    }
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (key && 'placeholder' in element) {
      element.placeholder = t(key);
    }
  });

  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (key) {
      element.setAttribute('aria-label', t(key));
    }
  });
}
