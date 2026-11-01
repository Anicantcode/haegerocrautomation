const SESSION_KEY = 'haeger_warehouse_session_v2';
const LEGACY_KEY = 'ids_session_v1';

function getStorage() {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage;
  }
  return null;
}

export function saveSession(state) {
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(SESSION_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Could not save session:', e);
  }
}

export function loadSession() {
  try {
    // 1. Try primary storage (localStorage)
    const storage = getStorage();
    let raw = storage ? storage.getItem(SESSION_KEY) : null;

    // 2. Check fallback/legacy in sessionStorage if not in primary storage
    if (!raw && typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(SESSION_KEY);
      if (raw && storage) {
        // Migrate to primary storage
        storage.setItem(SESSION_KEY, raw);
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.dispatch || parsed.inventory)) {
        return {
          dispatch: parsed.dispatch || { records: [], nextId: 1 },
          inventory: parsed.inventory || { records: [], nextId: 1 },
        };
      }
    }

    // 3. Check legacy single-module key (sessionStorage or localStorage)
    let legacyRaw = storage ? storage.getItem(LEGACY_KEY) : null;
    if (!legacyRaw && typeof sessionStorage !== 'undefined') {
      legacyRaw = sessionStorage.getItem(LEGACY_KEY);
    }

    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && Array.isArray(legacy.records)) {
        const migrated = {
          dispatch: { records: legacy.records, nextId: legacy.nextId || 1 },
          inventory: { records: [], nextId: 1 },
        };
        if (storage) {
          storage.setItem(SESSION_KEY, JSON.stringify(migrated));
        }
        return migrated;
      }
    }

    return null;
  } catch (e) {
    console.warn('Could not load session:', e);
    return null;
  }
}

export function clearSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(LEGACY_KEY);
    }
  } catch (e) {
    console.warn('Could not clear session:', e);
  }
}
