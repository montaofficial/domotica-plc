import { KNXClient } from 'knxultimate';
import { EventEmitter } from 'events';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { devicesDb, groupAddressesDb, historyDb, deviceGroupLinksDb } from './database.js';

// knxultimate 5.5.8 calls ipAddressHelper.getLocalAddress() unconditionally
// and overwrites whatever we pass as `localIPAddress` (KNXClient.ts:462). It
// only honors the `interface` option (NIC name). On hosts with multiple NICs
// in different subnets (e.g. eno1 on the office LAN + vlan2 on the KNX LAN)
// its heuristic picks the wrong one and the gateway never sees a reachable
// source IP. Resolve the NIC that owns the configured KNX_LOCAL_IP and pass
// it through, so the library binds the UDP socket to the correct interface.
function resolveInterfaceForIp(ip) {
  if (!ip) return undefined;
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (addrs?.some(a => a.family === 'IPv4' && a.address === ip)) {
      return name;
    }
  }
  return undefined;
}

class KNXService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
  }

  initialize(config) {
    if (!config.gatewayIp) {
      console.warn('[KNX] KNX_GATEWAY_IP is not set - the controller will keep trying to reach a placeholder gateway.');
    }
    const iface = resolveInterfaceForIp(config.localIp);
    if (config.localIp && !iface) {
      console.warn(`[KNX] KNX_LOCAL_IP=${config.localIp} does not match any local interface — falling back to library heuristic.`);
    }

    this.config = {
      hostProtocol: 'TunnelUDP',
      ipAddr: config.gatewayIp || '0.0.0.0',
      ipPort: config.gatewayPort || 3671,
      loglevel: config.logLevel || 'info',
      ...(iface ? { interface: iface } : {}),
      ...(config.localIp ? { localIPAddress: config.localIp } : {})
    };

    this.createClient();
  }

  createClient() {
    if (this.client) {
      try {
        this.client.Disconnect?.();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    this.client = new KNXClient(this.config);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('connected', () => {
      console.log(`[KNX] Connected to gateway ${this.config.ipAddr}:${this.config.ipPort}`);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.client.on('disconnected', (reason) => {
      console.log('[KNX] Disconnected:', reason);
      this.connected = false;
      this.emit('disconnected', reason);
      this.scheduleReconnect();
    });

    this.client.on('error', (error) => {
      console.error('[KNX] Error:', error?.message || error);
      this.emit('error', error);
      // If we lost or never had a connection, schedule a reconnect.
      // Without this, a failed initial Connect() never retries and the
      // service stays dark even after the gateway comes back online.
      if (!this.connected) {
        this.scheduleReconnect();
      }
    });

    this.client.on('indication', (packet) => {
      this.handleIndication(packet);
    });
  }

  handleIndication(packet) {
    const cemi = packet?.cEMIMessage;
    if (!cemi) return;

    const src = cemi.srcAddress?.toString?.() ?? '?';
    const dst = cemi.dstAddress?.toString?.() ?? '?';
    const npdu = cemi.npdu;

    const isWrite = !!npdu?.isGroupWrite;
    const isResponse = !!npdu?.isGroupResponse;
    const isRead = !!npdu?.isGroupRead;

    const raw = npdu?.dataValue;
    const rawHex = raw ? raw.toString('hex') : '';

    // Decode value
    let decodedValue = null;
    if (raw && raw.length >= 1) {
      // Simple DPT1 (boolean) decoding
      decodedValue = (raw.readUInt8(0) & 0x01) === 1;
    }

    const type = isWrite ? 'GroupWrite' : isResponse ? 'GroupResponse' : isRead ? 'GroupRead' : 'Other';

    const telegram = {
      src,
      dst,
      type,
      rawHex,
      decodedValue,
      timestamp: new Date().toISOString()
    };

    // Store in history
    historyDb.add({
      src,
      dst,
      type,
      raw_hex: rawHex,
      decoded_value: decodedValue !== null ? String(decodedValue) : null
    });

    // Auto-discover devices and group addresses
    if (type === 'GroupWrite' || type === 'GroupResponse') {
      this.autoDiscover(src, dst, decodedValue);
    }

    // Emit events
    this.emit('telegram', telegram);

    if (type === 'GroupWrite' || type === 'GroupResponse') {
      this.emit('state_change', { address: dst, value: decodedValue, rawHex });
    }
  }

  autoDiscover(srcAddress, dstAddress, value) {
    // Upsert physical device
    const existingDevice = devicesDb.getByPhysicalAddress(srcAddress);
    let device;
    if (!existingDevice) {
      device = devicesDb.upsert({
        id: uuidv4(),
        physical_address: srcAddress
      });
      this.emit('device_discovered', device);
    } else {
      device = devicesDb.upsert({ physical_address: srcAddress });
    }

    // Upsert group address
    const existingGA = groupAddressesDb.getByAddress(dstAddress);
    let groupAddress;
    if (!existingGA) {
      groupAddress = groupAddressesDb.upsert({
        id: uuidv4(),
        address: dstAddress,
        current_value: value !== null ? String(value) : null
      });
      this.emit('group_address_discovered', groupAddress);
    } else {
      groupAddress = groupAddressesDb.updateValue(dstAddress, value !== null ? String(value) : null);
    }

    // Link device to group address
    if (device && groupAddress) {
      deviceGroupLinksDb.link(device.id, groupAddress.id);
    }
  }

  connect() {
    if (this.connected) {
      console.log('[KNX] Already connected');
      return;
    }

    try {
      console.log(`[KNX] Connecting to ${this.config.ipAddr}:${this.config.ipPort}...`);
      this.client.Connect();
    } catch (error) {
      console.error('[KNX] Connection failed:', error?.message || error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    try {
      this.client?.Disconnect?.();
    } catch (error) {
      // Ignore
    }
    this.connected = false;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[KNX] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(`[KNX] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.createClient();
      this.connect();
    }, delay);
  }

  /**
   * Write a value to a KNX group address
   * @param {string} address - Group address (e.g., "3/0/1")
   * @param {boolean|number} value - Value to write
   * @param {string} dataType - KNX datapoint type (default: "DPT1")
   */
  write(address, value, dataType = 'DPT1') {
    if (!this.connected) {
      throw new Error('Not connected to KNX gateway');
    }

    console.log(`[KNX] Writing to ${address}: ${value} (${dataType})`);

    try {
      // For DPT1 (boolean), use simple write
      if (dataType === 'DPT1' || dataType === 'DPT1.001') {
        const boolValue = value === true || value === 1 || value === '1' || value === 'true';
        this.client.write(address, boolValue, 'DPT1.001');
      } else {
        // For other datatypes, pass through
        this.client.write(address, value, dataType);
      }

      // Update local state
      groupAddressesDb.updateValue(address, String(value));

      this.emit('write_success', { address, value, dataType });
      return true;
    } catch (error) {
      console.error(`[KNX] Write error for ${address}:`, error?.message || error);
      this.emit('write_error', { address, value, error });
      throw error;
    }
  }

  /**
   * Read current value from a KNX group address
   * @param {string} address - Group address
   */
  read(address) {
    if (!this.connected) {
      throw new Error('Not connected to KNX gateway');
    }

    console.log(`[KNX] Reading from ${address}`);

    try {
      this.client.read(address);
      return true;
    } catch (error) {
      console.error(`[KNX] Read error for ${address}:`, error?.message || error);
      throw error;
    }
  }

  /**
   * Toggle a boolean group address
   * @param {string} address - Group address
   */
  toggle(address) {
    const ga = groupAddressesDb.getByAddress(address);
    if (!ga) {
      throw new Error(`Group address ${address} not found`);
    }

    const currentValue = ga.current_value === 'true' || ga.current_value === '1';
    return this.write(address, !currentValue, ga.data_type || 'DPT1');
  }

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      connected: this.connected,
      gateway: this.config?.ipAddr,
      port: this.config?.ipPort,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
const knxService = new KNXService();

export default knxService;
