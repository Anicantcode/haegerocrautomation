import { describe, it, expect } from 'vitest';
import {
  appReducer,
  initialState,
  ACTIONS,
  isDuplicateDN,
  isDuplicateMaterial,
  getDispatchStats,
  getInventoryStats,
} from '../src/context/AppContext.jsx';

describe('AppContext & Reducer', () => {
  describe('Dispatch Actions', () => {
    it('creates new dispatch record when ADD_INVOICE is called', () => {
      const state = appReducer(initialState, {
        type: ACTIONS.ADD_INVOICE,
        payload: '2134621450',
      });

      expect(state.dispatch.records).toHaveLength(1);
      expect(state.dispatch.records[0].dnNumber).toBe('2134621450');
      expect(state.dispatch.records[0].status).toBe('PENDING_DOCKET');
    });

    it('pairs docket with pending invoice', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_INVOICE,
        payload: '2134621450',
      });
      const s2 = appReducer(s1, {
        type: ACTIONS.ADD_DOCKET,
        payload: 'DOC998877',
      });

      expect(s2.dispatch.records).toHaveLength(1);
      expect(s2.dispatch.records[0].dnNumber).toBe('2134621450');
      expect(s2.dispatch.records[0].docketNumber).toBe('DOC998877');
      expect(s2.dispatch.records[0].status).toBe('COMPLETE');
    });

    it('detects duplicate DNs correctly', () => {
      const records = [{ dnNumber: '2134621450' }];
      expect(isDuplicateDN('2134621450', records)).toBe(true);
      expect(isDuplicateDN('9999999999', records)).toBe(false);
    });

    it('updates and deletes dispatch records', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_INVOICE,
        payload: '2134621450',
      });
      const recId = s1.dispatch.records[0].id;

      const s2 = appReducer(s1, {
        type: ACTIONS.UPDATE_RECORD,
        payload: { id: recId, boxes: '10', weight: '50' },
      });
      expect(s2.dispatch.records[0].boxes).toBe('10');
      expect(s2.dispatch.records[0].weight).toBe('50');

      const s3 = appReducer(s2, {
        type: ACTIONS.DELETE_RECORD,
        payload: recId,
      });
      expect(s3.dispatch.records).toHaveLength(0);
    });

    it('clears dispatch session', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_INVOICE,
        payload: '2134621450',
      });
      const s2 = appReducer(s1, { type: ACTIONS.CLEAR_SESSION });
      expect(s2.dispatch.records).toHaveLength(0);
      expect(s2.dispatch.nextId).toBe(1);
    });
  });

  describe('Inventory Actions', () => {
    it('creates new inventory record when ADD_MATERIAL is called', () => {
      const state = appReducer(initialState, {
        type: ACTIONS.ADD_MATERIAL,
        payload: 'HDA041Z9',
      });

      expect(state.inventory.records).toHaveLength(1);
      expect(state.inventory.records[0].material).toBe('HDA041Z9');
      expect(state.inventory.records[0].status).toBe('PENDING_BIN');
    });

    it('pairs bin with pending material', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_MATERIAL,
        payload: 'HDA041Z9',
      });
      const s2 = appReducer(s1, {
        type: ACTIONS.ADD_BIN,
        payload: 'A-12-04',
      });

      expect(s2.inventory.records).toHaveLength(1);
      expect(s2.inventory.records[0].material).toBe('HDA041Z9');
      expect(s2.inventory.records[0].bin).toBe('A-12-04');
      expect(s2.inventory.records[0].status).toBe('COMPLETE');
    });

    it('allows duplicate/double material scanning in inventory', () => {
      const records = [{ material: 'HDA041Z9' }];
      expect(isDuplicateMaterial('HDA041Z9', records)).toBe(false);
    });

    it('updates and deletes inventory records', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_MATERIAL,
        payload: 'HDA041Z9',
      });
      const recId = s1.inventory.records[0].id;

      const s2 = appReducer(s1, {
        type: ACTIONS.UPDATE_INVENTORY_RECORD,
        payload: { id: recId, quantity: '100', year: '2025' },
      });
      expect(s2.inventory.records[0].quantity).toBe('100');
      expect(s2.inventory.records[0].year).toBe('2025');

      const s3 = appReducer(s2, {
        type: ACTIONS.DELETE_INVENTORY_RECORD,
        payload: recId,
      });
      expect(s3.inventory.records).toHaveLength(0);
    });

    it('clears inventory session', () => {
      const s1 = appReducer(initialState, {
        type: ACTIONS.ADD_MATERIAL,
        payload: 'HDA041Z9',
      });
      const s2 = appReducer(s1, { type: ACTIONS.CLEAR_INVENTORY_SESSION });
      expect(s2.inventory.records).toHaveLength(0);
      expect(s2.inventory.nextId).toBe(1);
    });
  });

  describe('Selectors', () => {
    it('calculates dispatch stats accurately', () => {
      const records = [
        { dnNumber: '1', docketNumber: 'D1', status: 'COMPLETE' },
        { dnNumber: '2', docketNumber: null, status: 'PENDING_DOCKET' },
      ];
      const stats = getDispatchStats(records);
      expect(stats.total).toBe(2);
      expect(stats.complete).toBe(1);
      expect(stats.pendingDocket).toBe(1);
    });

    it('calculates inventory stats accurately', () => {
      const records = [
        { material: 'M1', bin: 'B1', status: 'COMPLETE' },
        { material: 'M2', bin: null, status: 'PENDING_BIN' },
      ];
      const stats = getInventoryStats(records);
      expect(stats.total).toBe(2);
      expect(stats.complete).toBe(1);
      expect(stats.pendingBin).toBe(1);
    });
  });
});
