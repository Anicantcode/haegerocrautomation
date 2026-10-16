import { createContext, useContext, useReducer, useEffect } from 'react';
import { saveSession, loadSession } from '../session/sessionManager.js';

// ─── Action Types ────────────────────────────────────────────────────────────
export const ACTIONS = {
  // Dispatch
  ADD_INVOICE:    'ADD_INVOICE',
  ADD_DOCKET:     'ADD_DOCKET',
  UPDATE_RECORD:  'UPDATE_RECORD',
  DELETE_RECORD:  'DELETE_RECORD',
  CLEAR_SESSION:  'CLEAR_SESSION',

  // Inventory
  ADD_MATERIAL:             'ADD_MATERIAL',
  ADD_BIN:                  'ADD_BIN',
  UPDATE_INVENTORY_RECORD:  'UPDATE_INVENTORY_RECORD',
  DELETE_INVENTORY_RECORD:  'DELETE_INVENTORY_RECORD',
  CLEAR_INVENTORY_SESSION:  'CLEAR_INVENTORY_SESSION',
};

// ─── Initial State ───────────────────────────────────────────────────────────
export const initialState = {
  dispatch:  { records: [], nextId: 1 },
  inventory: { records: [], nextId: 1 },
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
export function appReducer(state, action) {
  switch (action.type) {

    // ── Dispatch: Add Invoice ────────────────────────────────────────────────
    case ACTIONS.ADD_INVOICE: {
      const dnNumber = action.payload;
      const dRecords = state.dispatch.records;
      const pendingIdx = dRecords.findIndex(r => r.status === 'PENDING_INVOICE');
      if (pendingIdx >= 0) {
        const updated = [...dRecords];
        updated[pendingIdx] = { ...updated[pendingIdx], dnNumber, status: 'COMPLETE' };
        return { ...state, dispatch: { ...state.dispatch, records: updated } };
      }
      return {
        ...state,
        dispatch: {
          ...state.dispatch,
          records: [...dRecords, {
            id: state.dispatch.nextId,
            dnNumber,
            docketNumber: null,
            boxes: '',
            weight: '',
            transporter: '',
            status: 'PENDING_DOCKET',
            createdAt: new Date().toISOString(),
          }],
          nextId: state.dispatch.nextId + 1,
        },
      };
    }

    // ── Dispatch: Add Docket ─────────────────────────────────────────────────
    case ACTIONS.ADD_DOCKET: {
      const docketNumber = action.payload;
      const dRecords = state.dispatch.records;
      const pendingIdx = dRecords.findIndex(r => r.status === 'PENDING_DOCKET');
      if (pendingIdx >= 0) {
        const updated = [...dRecords];
        updated[pendingIdx] = { ...updated[pendingIdx], docketNumber, status: 'COMPLETE' };
        return { ...state, dispatch: { ...state.dispatch, records: updated } };
      }
      return {
        ...state,
        dispatch: {
          ...state.dispatch,
          records: [...dRecords, {
            id: state.dispatch.nextId,
            dnNumber: null,
            docketNumber,
            boxes: '',
            weight: '',
            transporter: '',
            status: 'PENDING_INVOICE',
            createdAt: new Date().toISOString(),
          }],
          nextId: state.dispatch.nextId + 1,
        },
      };
    }

    // ── Dispatch: Update Record ──────────────────────────────────────────────
    case ACTIONS.UPDATE_RECORD: {
      const records = state.dispatch.records.map(r => {
        if (r.id !== action.payload.id) return r;
        const merged = { ...r, ...action.payload };
        if (merged.dnNumber && merged.docketNumber) merged.status = 'COMPLETE';
        else if (merged.dnNumber) merged.status = 'PENDING_DOCKET';
        else merged.status = 'PENDING_INVOICE';
        return merged;
      });
      return { ...state, dispatch: { ...state.dispatch, records } };
    }

    // ── Dispatch: Delete Record ──────────────────────────────────────────────
    case ACTIONS.DELETE_RECORD: {
      const records = state.dispatch.records.filter(r => r.id !== action.payload);
      return { ...state, dispatch: { ...state.dispatch, records } };
    }

    // ── Dispatch: Clear Session ──────────────────────────────────────────────
    case ACTIONS.CLEAR_SESSION: {
      return { ...state, dispatch: { records: [], nextId: 1 } };
    }

    // ── Inventory: Add Material ──────────────────────────────────────────────
    case ACTIONS.ADD_MATERIAL: {
      const material = action.payload;
      const invRecords = state.inventory.records;
      const pendingIdx = invRecords.findIndex(r => r.status === 'PENDING_MATERIAL');
      if (pendingIdx >= 0) {
        const updated = [...invRecords];
        updated[pendingIdx] = { ...updated[pendingIdx], material, status: 'COMPLETE' };
        return { ...state, inventory: { ...state.inventory, records: updated } };
      }
      return {
        ...state,
        inventory: {
          ...state.inventory,
          records: [...invRecords, {
            id: state.inventory.nextId,
            material,
            bin: null,
            quantity: '',
            year: '',
            remark: '',
            status: 'PENDING_BIN',
            createdAt: new Date().toISOString(),
          }],
          nextId: state.inventory.nextId + 1,
        },
      };
    }

    // ── Inventory: Add Bin ───────────────────────────────────────────────────
    case ACTIONS.ADD_BIN: {
      const bin = action.payload;
      const invRecords = state.inventory.records;
      const pendingIdx = invRecords.findIndex(r => r.status === 'PENDING_BIN');
      if (pendingIdx >= 0) {
        const updated = [...invRecords];
        updated[pendingIdx] = { ...updated[pendingIdx], bin, status: 'COMPLETE' };
        return { ...state, inventory: { ...state.inventory, records: updated } };
      }
      return {
        ...state,
        inventory: {
          ...state.inventory,
          records: [...invRecords, {
            id: state.inventory.nextId,
            material: null,
            bin,
            quantity: '',
            year: '',
            remark: '',
            status: 'PENDING_MATERIAL',
            createdAt: new Date().toISOString(),
          }],
          nextId: state.inventory.nextId + 1,
        },
      };
    }

    // ── Inventory: Update Record ─────────────────────────────────────────────
    case ACTIONS.UPDATE_INVENTORY_RECORD: {
      const records = state.inventory.records.map(r => {
        if (r.id !== action.payload.id) return r;
        const merged = { ...r, ...action.payload };
        if (merged.material && merged.bin) merged.status = 'COMPLETE';
        else if (merged.material) merged.status = 'PENDING_BIN';
        else merged.status = 'PENDING_MATERIAL';
        return merged;
      });
      return { ...state, inventory: { ...state.inventory, records } };
    }

    // ── Inventory: Delete Record ─────────────────────────────────────────────
    case ACTIONS.DELETE_INVENTORY_RECORD: {
      const records = state.inventory.records.filter(r => r.id !== action.payload);
      return { ...state, inventory: { ...state.inventory, records } };
    }

    // ── Inventory: Clear Session ─────────────────────────────────────────────
    case ACTIONS.CLEAR_INVENTORY_SESSION: {
      return { ...state, inventory: { records: [], nextId: 1 } };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(
    appReducer,
    initialState,
    () => loadSession() || initialState
  );

  // Persist on every state change
  useEffect(() => { saveSession(state); }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// ─── Derived selectors ───────────────────────────────────────────────────────
export function getDispatchStats(records = []) {
  const complete      = records.filter(r => r.status === 'COMPLETE').length;
  const pendingDocket = records.filter(r => r.status === 'PENDING_DOCKET').length;
  const pendingInvoice= records.filter(r => r.status === 'PENDING_INVOICE').length;
  const invoiceCount  = records.filter(r => r.dnNumber).length;
  const docketCount   = records.filter(r => r.docketNumber).length;
  return { complete, pendingDocket, pendingInvoice, invoiceCount, docketCount, total: records.length };
}

export const getStats = getDispatchStats;

export function getInventoryStats(records = []) {
  const complete        = records.filter(r => r.status === 'COMPLETE').length;
  const pendingBin      = records.filter(r => r.status === 'PENDING_BIN').length;
  const pendingMaterial = records.filter(r => r.status === 'PENDING_MATERIAL').length;
  const materialCount   = records.filter(r => r.material).length;
  const binCount        = records.filter(r => r.bin).length;
  return { complete, pendingBin, pendingMaterial, materialCount, binCount, total: records.length };
}

export function isDuplicateDN(dnNumber, records = []) {
  return records.some(r => r.dnNumber === dnNumber);
}

export function isDuplicateDocket(docketNumber, records = []) {
  return false;
}

export function isDuplicateMaterial(material, records = []) {
  return records.some(r => r.material === material);
}

export function isDuplicateBin(bin, records = []) {
  return false;
}

