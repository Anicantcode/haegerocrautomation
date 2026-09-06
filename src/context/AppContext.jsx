import { createContext, useContext, useReducer, useEffect } from 'react';
import { saveSession, loadSession } from '../session/sessionManager.js';

// ─── Action Types ────────────────────────────────────────────────────────────
export const ACTIONS = {
  ADD_INVOICE:    'ADD_INVOICE',
  ADD_DOCKET:     'ADD_DOCKET',
  UPDATE_RECORD:  'UPDATE_RECORD',
  DELETE_RECORD:  'DELETE_RECORD',
  CLEAR_SESSION:  'CLEAR_SESSION',
};

// ─── Initial State ───────────────────────────────────────────────────────────
export const initialState = { records: [], nextId: 1 };

// ─── Reducer ─────────────────────────────────────────────────────────────────
export function appReducer(state, action) {
  switch (action.type) {

    case ACTIONS.ADD_INVOICE: {
      const dnNumber = action.payload;
      // Pair with oldest PENDING_INVOICE record (has docket, no DN)
      const pendingIdx = state.records.findIndex(r => r.status === 'PENDING_INVOICE');
      if (pendingIdx >= 0) {
        const updated = [...state.records];
        updated[pendingIdx] = { ...updated[pendingIdx], dnNumber, status: 'COMPLETE' };
        return { ...state, records: updated };
      }
      // No pending → new record waiting for docket
      return {
        ...state,
        records: [...state.records, {
          id: state.nextId,
          dnNumber,
          docketNumber: null,
          status: 'PENDING_DOCKET',
          createdAt: new Date().toISOString(),
        }],
        nextId: state.nextId + 1,
      };
    }

    case ACTIONS.ADD_DOCKET: {
      const docketNumber = action.payload;
      // Pair with oldest PENDING_DOCKET record (has DN, no docket)
      const pendingIdx = state.records.findIndex(r => r.status === 'PENDING_DOCKET');
      if (pendingIdx >= 0) {
        const updated = [...state.records];
        updated[pendingIdx] = { ...updated[pendingIdx], docketNumber, status: 'COMPLETE' };
        return { ...state, records: updated };
      }
      // No pending → new record waiting for invoice
      return {
        ...state,
        records: [...state.records, {
          id: state.nextId,
          dnNumber: null,
          docketNumber,
          status: 'PENDING_INVOICE',
          createdAt: new Date().toISOString(),
        }],
        nextId: state.nextId + 1,
      };
    }

    case ACTIONS.UPDATE_RECORD: {
      const records = state.records.map(r => {
        if (r.id !== action.payload.id) return r;
        const merged = { ...r, ...action.payload };
        // Recompute status
        if (merged.dnNumber && merged.docketNumber) merged.status = 'COMPLETE';
        else if (merged.dnNumber)   merged.status = 'PENDING_DOCKET';
        else                        merged.status = 'PENDING_INVOICE';
        return merged;
      });
      return { ...state, records };
    }

    case ACTIONS.DELETE_RECORD:
      return { ...state, records: state.records.filter(r => r.id !== action.payload) };

    case ACTIONS.CLEAR_SESSION:
      return initialState;

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
export function getStats(records) {
  const complete      = records.filter(r => r.status === 'COMPLETE').length;
  const pendingDocket = records.filter(r => r.status === 'PENDING_DOCKET').length;
  const pendingInvoice= records.filter(r => r.status === 'PENDING_INVOICE').length;
  const invoiceCount  = records.filter(r => r.dnNumber).length;
  const docketCount   = records.filter(r => r.docketNumber).length;
  return { complete, pendingDocket, pendingInvoice, invoiceCount, docketCount, total: records.length };
}

export function isDuplicateDN(dnNumber, records) {
  return records.some(r => r.dnNumber === dnNumber);
}

export function isDuplicateDocket(docketNumber, records) {
  // Multiple packages and invoices can share the same Docket / Consignment number
  return false;
}
