import { describe, it, expect, beforeEach } from 'vitest';
import { saveSession, loadSession, clearSession } from '../src/session/sessionManager.js';

describe('sessionManager', () => {
  beforeEach(() => {
    // Mock localStorage and sessionStorage
    const createStore = () => {
      let store = {};
      return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; },
      };
    };
    global.localStorage = createStore();
    global.sessionStorage = createStore();
  });

  it('saves and loads session state from localStorage', () => {
    const state = {
      dispatch: { records: [{ id: 1, dnNumber: '2134621450' }], nextId: 2 },
      inventory: { records: [{ id: 1, material: 'HDA041Z9' }], nextId: 2 },
    };

    saveSession(state);
    const loaded = loadSession();

    expect(loaded).not.toBeNull();
    expect(loaded.dispatch.records).toHaveLength(1);
    expect(loaded.dispatch.records[0].dnNumber).toBe('2134621450');
    expect(loaded.inventory.records[0].material).toBe('HDA041Z9');
  });

  it('migrates legacy sessionStorage data to localStorage seamlessly', () => {
    const legacyState = {
      dispatch: { records: [{ id: 1, dnNumber: '11112222' }], nextId: 2 },
      inventory: { records: [], nextId: 1 },
    };
    sessionStorage.setItem('haeger_warehouse_session_v2', JSON.stringify(legacyState));

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded.dispatch.records[0].dnNumber).toBe('11112222');

    // Should also be copied into localStorage
    expect(localStorage.getItem('haeger_warehouse_session_v2')).not.toBeNull();
  });

  it('clears session properly', () => {
    saveSession({
      dispatch: { records: [{ id: 1 }], nextId: 2 },
      inventory: { records: [], nextId: 1 },
    });
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
