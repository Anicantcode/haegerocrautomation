import { describe, it, expect, beforeEach, vi } from 'vitest';
import { printerService } from '../src/printer/printerService.js';

describe('printerService', () => {
  beforeEach(async () => {
    await printerService.disconnect();
  });

  it('initializes with disconnected state', () => {
    const state = printerService.getState();
    expect(state.status).toBe('disconnected');
    expect(state.isConnected).toBe(false);
    expect(state.type).toBeNull();
  });

  it('notifies subscribers on state changes', () => {
    const listener = vi.fn();
    const unsubscribe = printerService.subscribe(listener);

    printerService.notify();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      status: 'disconnected',
      isConnected: false,
    }));

    unsubscribe();
    listener.mockClear();
    printerService.notify();
    expect(listener).not.toHaveBeenCalled();
  });

  it('throws error when printing while disconnected', async () => {
    await expect(printerService.printDirect('TEST')).rejects.toThrow('Printer is not connected');
  });

  it('handles simulated serial disconnect safely', async () => {
    const mockPort = {
      close: vi.fn().mockResolvedValue(undefined),
      writable: {
        getWriter: vi.fn(),
      },
      getInfo: () => ({ usbVendorId: 1234 }),
    };

    printerService.serialPort = mockPort;
    printerService.status = 'connected';
    printerService.type = 'serial';
    printerService.deviceName = 'Printer (USB)';

    await printerService.disconnect();

    expect(mockPort.close).toHaveBeenCalled();
    expect(printerService.status).toBe('disconnected');
    expect(printerService.serialPort).toBeNull();
  });
});
