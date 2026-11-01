/**
 * Direct printer communication service for TSC Alpha-3RB.
 * Supports:
 * 1. Web Serial API (Chrome/Edge on Windows via Bluetooth COM port or USB cable, and Android)
 * 2. Web Bluetooth API (BLE GATT write)
 * 3. Browser Print (window.print() with 72mm thermal layout fallback)
 */

class PrinterService {
  constructor() {
    this.serialPort = null;
    this.bleDevice = null;
    this.bleCharacteristic = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
    this.type = null;             // 'serial' | 'bluetooth' | null
    this.deviceName = '';
    this.listeners = new Set();
    this._activeWriter = null;
    this._bleDisconnectHandler = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try { fn(state); } catch (_) {}
    });
  }

  getState() {
    return {
      status: this.status,
      type: this.type,
      deviceName: this.deviceName,
      isConnected: this.status === 'connected',
      hasSerial: typeof navigator !== 'undefined' && 'serial' in navigator,
      hasBluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    };
  }

  /**
   * Connect via Web Serial API (Bluetooth COM port or USB cable on Windows/Android)
   */
  async connectSerial() {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      throw new Error('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }

    // Clean up any existing connection first
    await this.disconnect();

    try {
      this.status = 'connecting';
      this.notify();

      // Prompt user to pick the TSC printer / COM port
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });

      this.serialPort = port;
      this.status = 'connected';
      this.type = 'serial';
      const info = port.getInfo ? port.getInfo() : {};
      this.deviceName = info.usbVendorId ? 'Printer (USB)' : 'Printer (Serial/BT)';
      this.notify();

      // Listen for unexpected disconnect
      port.ondisconnect = () => {
        this.disconnect();
      };

      return true;
    } catch (err) {
      await this.disconnect();
      if (err.name === 'NotFoundError') {
        throw new Error('No port selected.');
      }
      throw err;
    }
  }

  /**
   * Connect via Web Bluetooth (BLE GATT)
   */
  async connectBluetooth() {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth API is not supported in this browser. Please use Chrome on Android/Windows.');
    }

    // Clean up any existing connection first
    await this.disconnect();

    try {
      this.status = 'connecting';
      this.notify();

      // Known SPP-over-BLE service UUIDs (standard serial profiles)
      const optionalServices = [
        '0000ffe0-0000-1000-8000-00805f9b34fb', // Common serial service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Nordic UART
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent
        '000018f0-0000-1000-8000-00805f9b34fb',
      ];

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices,
      });

      const server = await device.gatt.connect();

      // Find the first writable characteristic
      let writeChar = null;
      for (const serviceUuid of optionalServices) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch (_) {}
      }

      if (!writeChar) {
        throw new Error('Connected to Bluetooth device, but could not find a writable serial channel. Try using Serial connection instead.');
      }

      this.bleDevice = device;
      this.bleCharacteristic = writeChar;
      this.status = 'connected';
      this.type = 'bluetooth';
      this.deviceName = device.name || 'Printer (Bluetooth)';
      this.notify();

      this._bleDisconnectHandler = () => {
        this.disconnect();
      };
      device.addEventListener('gattserverdisconnected', this._bleDisconnectHandler);

      return true;
    } catch (err) {
      await this.disconnect();
      if (err.name === 'NotFoundError') {
        throw new Error('No Bluetooth device selected.');
      }
      throw err;
    }
  }

  /**
   * Disconnect any active connection safely releasing all stream locks
   */
  async disconnect() {
    try {
      if (this._activeWriter) {
        try {
          this._activeWriter.releaseLock();
        } catch (_) {}
        this._activeWriter = null;
      }

      if (this.serialPort) {
        if (this.serialPort.ondisconnect) {
          this.serialPort.ondisconnect = null;
        }
        try {
          await this.serialPort.close();
        } catch (_) {}
        this.serialPort = null;
      }

      if (this.bleDevice) {
        if (this._bleDisconnectHandler) {
          try {
            this.bleDevice.removeEventListener('gattserverdisconnected', this._bleDisconnectHandler);
          } catch (_) {}
          this._bleDisconnectHandler = null;
        }
        if (this.bleDevice.gatt && this.bleDevice.gatt.connected) {
          try {
            this.bleDevice.gatt.disconnect();
          } catch (_) {}
        }
        this.bleDevice = null;
        this.bleCharacteristic = null;
      }
    } finally {
      this.status = 'disconnected';
      this.type = null;
      this.deviceName = '';
      this._activeWriter = null;
      this.notify();
    }
  }

  /**
   * Send raw TSPL ASCII string to printer with timeout protection
   */
  async printDirect(tsplString, timeoutMs = 8000) {
    if (this.status !== 'connected') {
      throw new Error('Printer is not connected.');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(tsplString);

    const executePrint = async () => {
      if (this.type === 'serial' && this.serialPort?.writable) {
        const writer = this.serialPort.writable.getWriter();
        this._activeWriter = writer;
        try {
          await writer.write(data);
        } finally {
          try {
            writer.releaseLock();
          } catch (_) {}
          this._activeWriter = null;
        }
        return true;
      }

      if (this.type === 'bluetooth' && this.bleCharacteristic) {
        // Chunk into 100-byte packets for BLE MTU limits
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
          const slice = data.slice(i, i + chunkSize);
          if (this.bleCharacteristic.properties.writeWithoutResponse) {
            await this.bleCharacteristic.writeValueWithoutResponse(slice);
          } else {
            await this.bleCharacteristic.writeValue(slice);
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        return true;
      }

      throw new Error('Printer connection channel is not writable.');
    };

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Print request timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([executePrint(), timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Trigger browser print for standard thermal printing
   */
  printBrowser() {
    window.print();
  }
}

export const printerService = new PrinterService();
