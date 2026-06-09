const PROBE_CACHE_KEY = 'languageProfileV4';

export async function loadCachedProfile() {
  try {
    const stored = await chrome.storage.session.get(PROBE_CACHE_KEY);
    return stored[PROBE_CACHE_KEY] ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedProfile(profile) {
  if (!profile?.id || !profile?.options || !profile?.outputLanguage) {
    return;
  }

  try {
    await chrome.storage.session.set({
      [PROBE_CACHE_KEY]: {
        id: profile.id,
        label: profile.label,
        outputLanguage: profile.outputLanguage,
        browserLocales: profile.browserLocales,
        options: profile.options,
      },
    });
  } catch {
    // session storage が使えない環境ではメモリキャッシュのみ
  }
}

export async function clearCachedProfile() {
  try {
    await chrome.storage.session.remove(PROBE_CACHE_KEY);
  } catch {
    // ignore
  }
}
