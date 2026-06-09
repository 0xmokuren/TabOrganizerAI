const STORAGE_KEY = 'groupingInstructions';
export const MAX_USER_INSTRUCTIONS_LENGTH = 500;

function stripControlCharacters(value) {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (
      code === 0x09
      || code === 0x0a
      || code === 0x0d
      || (code >= 0x20 && code !== 0x7f)
    ) {
      result += char;
    }
  }
  return result;
}

export function normalizeUserInstructions(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return stripControlCharacters(value)
    .trim()
    .slice(0, MAX_USER_INSTRUCTIONS_LENGTH);
}

export async function loadUserInstructions() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeUserInstructions(stored[STORAGE_KEY] ?? '');
  } catch {
    return '';
  }
}

export async function saveUserInstructions(value) {
  const normalized = normalizeUserInstructions(value);

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  } catch {
    // ignore
  }

  return normalized;
}

export async function clearUserInstructions() {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch {
    // ignore
  }
}
