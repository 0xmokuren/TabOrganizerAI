const PROBE_CACHE_KEY = 'languageProfile';

export async function loadCachedProfile() {
  try {
    const stored = await chrome.storage.session.get(PROBE_CACHE_KEY);
    return stored[PROBE_CACHE_KEY] ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedProfile(profile) {
  if (!profile?.id || !profile?.options) {
    return;
  }

  try {
    await chrome.storage.session.set({
      [PROBE_CACHE_KEY]: {
        id: profile.id,
        label: profile.label,
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
