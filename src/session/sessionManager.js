const SESSION_KEY = 'haeger_warehouse_session_v2';
const LEGACY_KEY = 'ids_session_v1';

export function saveSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.dispatch || parsed.inventory)) {
        return {
          dispatch: parsed.dispatch || { records: [], nextId: 1 },
          inventory: parsed.inventory || { records: [], nextId: 1 },
        };
      }
    }

    // Check legacy single-module key
    const legacyRaw = sessionStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && Array.isArray(legacy.records)) {
        return {
          dispatch: { records: legacy.records, nextId: legacy.nextId || 1 },
          inventory: { records: [], nextId: 1 },
        };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_KEY);
}
