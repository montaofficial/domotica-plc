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
    // Handle of the pending reconnect timer, so we never schedule two in
    // parallel (the 'error' + 'disconnected' paths both call scheduleReconnect)
    // and can cancel it on a clean shutdown.
    this.reconnectTimer = null;
    // Set on an intentional disconnect() so the resulting 'disconnected' event
    // doesn't immediately schedule an unwanted reconnect during shutdown.
    this.stopped = false;
    // address -> { prev, at }: values written optimistically to the DB but not
    // yet confirmed on the bus. If the client reports an error while a write is
    // in flight we revert these, erring toward "still on" (see the error
    // handler) — a missed OFF is worse than a spurious ON in the evening report.
    this.pendingWrites = new Map();
  }

  // Safely dispose the current client. knxultimate's Disconnect() is async and
  // rejects if the socket was already torn down (e.g. after a heartbeat loss);
  // a bare call would surface as an unhandledRejection and kill the process on
  // Node >= 20, so we swallow both sync throws and async rejections here.
  safeDisconnectClient() {
    if (!this.client) return;
    try {
      const r = this.client.Disconnect?.();
      if (r && typeof r.then === 'function') r.catch(() => {});
    } catch (e) {
      // already disconnected — ignore
    }
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
    this.safeDisconnectClient();
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
      // A dropped connection means any in-flight write may never have reached
      // the bus. Roll those back so an unconfirmed OFF doesn't hide a light
      // that's still physically on from the evening report.
      this.revertPendingWrites('disconnected');
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

    // Decode value. Only single-byte payloads are safely a DPT1 boolean; a
    // multi-byte payload (DPT9 temperature, DPT5 percentage, …) is NOT a bit,
    // so decoding its first byte as on/off would corrupt current_value in the
    // DB. Leave those as null rather than inventing a boolean for them.
    let decodedValue = null;
    if (raw && raw.length === 1) {
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

    // Any bus activity on an address we just wrote confirms the telegram was
    // actually delivered — drop it from the unconfirmed set so a later error
    // can't wrongly revert it.
    if (this.pendingWrites.has(dst)) this.pendingWrites.delete(dst);

    // Auto-discover devices and group addresses
    if (type === 'GroupWrite' || type === 'GroupResponse') {
      this.autoDiscover(src, dst, decodedValue);
    }

    // Emit events
    this.emit('telegram', telegram);

    if (type === 'GroupWrite' || type === 'GroupResponse') {
      // Tag whether this address is actually mapped (configured with a name).
      // The UI only shows configured devices, so unmapped chatter (e.g. the
      // noisy 3/* and 4/* blocks) must not trigger a refetch downstream.
      const ga = groupAddressesDb.getByAddress(dst);
      const mapped = !!ga?.name;
      this.emit('state_change', { address: dst, value: decodedValue, rawHex, mapped });
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
    this.stopped = false;
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
    // Intentional shutdown: stop retrying and cancel any pending reconnect so
    // the process can exit cleanly and no orphan tunnel is left on the gateway.
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.safeDisconnectClient();
    this.connected = false;
  }

  // Revert recent DB values written but not yet confirmed on the bus. Only
  // rolls back writes issued in the last few seconds (an old un-echoed write is
  // almost certainly fine — command GAs just never echo — so reverting it would
  // be a spurious flip). Emits state_change so the UI reflects the correction.
  revertPendingWrites(reason) {
    if (this.pendingWrites.size === 0) return;
    const recentCutoff = Date.now() - 15_000;
    let reverted = 0;
    for (const [address, { prev, at }] of this.pendingWrites) {
      if (at < recentCutoff) continue;
      try {
        groupAddressesDb.updateValue(address, prev);
        this.emit('state_change', { address, value: prev === 'true' || prev === '1', rawHex: '', mapped: !!groupAddressesDb.getByAddress(address)?.name });
        reverted++;
      } catch (e) {
        // best-effort; keep reverting the rest
      }
    }
    if (reverted > 0) console.warn(`[KNX] Reverted ${reverted} unconfirmed write(s) (${reason})`);
    this.pendingWrites.clear();
  }

  scheduleReconnect() {
    if (this.stopped) return;
    // Dedupe: one pending reconnect at a time. Without this the error and
    // disconnected paths can schedule parallel timers that race.
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Backoff grows then plateaus at 60s. We NEVER give up: a building
    // controller must recover on its own whenever the gateway comes back,
    // even after an outage far longer than the first few minutes.
    const delay = Math.min(this.reconnectDelay * Math.min(this.reconnectAttempts, 6), 60000);

    if (this.reconnectAttempts === this.maxReconnectAttempts) {
      console.error(`[KNX] Still offline after ${this.reconnectAttempts} attempts — will keep retrying every ${Math.round(delay / 1000)}s until the gateway returns`);
    } else {
      console.log(`[KNX] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // A throw here (e.g. KNXClient constructor failing because the KNX NIC
      // vanished) would otherwise be an uncaughtException = process crash.
      try {
        this.createClient();
        this.connect();
      } catch (error) {
        console.error('[KNX] Reconnect attempt failed:', error?.message || error);
        this.scheduleReconnect();
      }
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

    // Remember the value we're overwriting so an aborted (un-ACKed) write can
    // be rolled back by revertPendingWrites().
    const prev = groupAddressesDb.getByAddress(address)?.current_value ?? null;

    try {
      // For DPT1 (boolean), use simple write
      if (dataType === 'DPT1' || dataType === 'DPT1.001') {
        const boolValue = value === true || value === 1 || value === '1' || value === 'true';
        this.client.write(address, boolValue, 'DPT1.001');
      } else {
        // For other datatypes, pass through
        this.client.write(address, value, dataType);
      }

      // Update local state (optimistic — confirmed when the bus echoes it, or
      // rolled back if the client reports an error while it's still pending).
      groupAddressesDb.updateValue(address, String(value));
      this.pendingWrites.set(address, { prev, at: Date.now() });
      // Bound the pending set: drop anything older than 10s (either confirmed
      // by a bus echo already, or so old that reverting it would be wrong).
      const cutoff = Date.now() - 10_000;
      for (const [addr, rec] of this.pendingWrites) {
        if (rec.at < cutoff) this.pendingWrites.delete(addr);
      }

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
   * Passively read a group address's current state: send a GroupValueRead and
   * resolve with the first matching GroupValueResponse. This is READ-ONLY on
   * the bus — it never changes device state — and is the primitive the
   * topology mapper uses to fingerprint the installation without actuating
   * anything. Resolves { answered, hex, len } (answered:false on timeout).
   * @param {string} address - Group address (e.g. "3/0/1")
   * @param {number} timeoutMs - how long to wait for a response
   */
  readGroupValue(address, timeoutMs = 600) {
    if (!this.connected) {
      return Promise.resolve({ address, answered: false, hex: '', len: 0, error: 'not_connected' });
    }
    return new Promise((resolve) => {
      let settled = false;
      const onTelegram = (t) => {
        if (settled) return;
        // Only a genuine read reply (GroupResponse) counts as "answered". A
        // coincidental GroupWrite to the same address (busy bus, physical
        // button press) must NOT be mistaken for the read's answer — that
        // could drop a still-on light from the evening report.
        if (t.dst === address && t.type === 'GroupResponse') {
          settled = true;
          this.off('telegram', onTelegram);
          clearTimeout(timer);
          resolve({
            address,
            answered: true,
            hex: t.rawHex || '',
            len: t.rawHex ? t.rawHex.length / 2 : 0,
            type: t.type
          });
        }
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.off('telegram', onTelegram);
        resolve({ address, answered: false, hex: '', len: 0 });
      }, timeoutMs);

      this.on('telegram', onTelegram);
      try {
        this.client.read(address);
      } catch (error) {
        if (!settled) {
          settled = true;
          this.off('telegram', onTelegram);
          clearTimeout(timer);
          resolve({ address, answered: false, hex: '', len: 0, error: error?.message || String(error) });
        }
      }
    });
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
