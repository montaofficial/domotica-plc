import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In Docker, use /app/data for persistence; otherwise use project root
const dataDir = existsSync('/app/data') ? '/app/data' : join(__dirname, '..');
const dbPath = join(dataDir, 'knx-controller.db');

console.log(`[DB] Using database at: ${dbPath}`);
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initializeDatabase() {
  db.exec(`
    -- Rooms/Areas for organizing devices
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'home',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Physical KNX devices (by physical address)
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      physical_address TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen TEXT
    );

    -- Group addresses (functional endpoints)
    CREATE TABLE IF NOT EXISTS group_addresses (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      device_type TEXT DEFAULT 'switch',
      data_type TEXT DEFAULT 'DPT1',
      room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
      current_value TEXT,
      is_controllable INTEGER DEFAULT 1,
      icon TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_activity TEXT
    );

    -- Link physical devices to group addresses
    CREATE TABLE IF NOT EXISTS device_group_links (
      device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
      group_address_id TEXT REFERENCES group_addresses(id) ON DELETE CASCADE,
      PRIMARY KEY (device_id, group_address_id)
    );

    -- Telegram history for debugging/audit
    CREATE TABLE IF NOT EXISTS telegram_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      src TEXT NOT NULL,
      dst TEXT NOT NULL,
      type TEXT NOT NULL,
      raw_hex TEXT,
      decoded_value TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_devices_physical_address ON devices(physical_address);
    CREATE INDEX IF NOT EXISTS idx_group_addresses_address ON group_addresses(address);
    CREATE INDEX IF NOT EXISTS idx_group_addresses_room ON group_addresses(room_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_history_timestamp ON telegram_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_telegram_history_dst ON telegram_history(dst);
  `);

  // Insert default room if none exist
  const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (roomCount.count === 0) {
    db.prepare(`
      INSERT INTO rooms (id, name, icon, sort_order)
      VALUES (?, ?, ?, ?)
    `).run('default', 'Uncategorized', 'home', 999);
  }
}

// Room operations
export const roomsDb = {
  getAll() {
    return db.prepare('SELECT * FROM rooms ORDER BY sort_order, name').all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  },

  create(room) {
    const stmt = db.prepare(`
      INSERT INTO rooms (id, name, icon, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(room.id, room.name, room.icon || 'home', room.sort_order || 0);
    return this.getById(room.id);
  },

  update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    db.prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id) {
    // Move devices to default room first
    db.prepare('UPDATE group_addresses SET room_id = ? WHERE room_id = ?').run('default', id);
    db.prepare('UPDATE devices SET room_id = ? WHERE room_id = ?').run('default', id);
    return db.prepare('DELETE FROM rooms WHERE id = ? AND id != ?').run(id, 'default');
  }
};

// Device operations (physical KNX devices)
export const devicesDb = {
  getAll() {
    return db.prepare(`
      SELECT d.*, r.name as room_name
      FROM devices d
      LEFT JOIN rooms r ON d.room_id = r.id
      ORDER BY d.physical_address
    `).all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  },

  getByPhysicalAddress(address) {
    return db.prepare('SELECT * FROM devices WHERE physical_address = ?').get(address);
  },

  upsert(device) {
    const existing = this.getByPhysicalAddress(device.physical_address);

    if (existing) {
      db.prepare(`
        UPDATE devices SET last_seen = ? WHERE physical_address = ?
      `).run(new Date().toISOString(), device.physical_address);
      return existing;
    }

    const stmt = db.prepare(`
      INSERT INTO devices (id, physical_address, name, description, room_id, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      device.id,
      device.physical_address,
      device.name || null,
      device.description || null,
      device.room_id || 'default',
      new Date().toISOString()
    );
    return this.getById(device.id);
  },

  update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.room_id !== undefined) { fields.push('room_id = ?'); values.push(updates.room_id); }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    db.prepare(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }
};

// Group address operations
export const groupAddressesDb = {
  getAll() {
    return db.prepare(`
      SELECT ga.*, r.name as room_name
      FROM group_addresses ga
      LEFT JOIN rooms r ON ga.room_id = r.id
      ORDER BY ga.address
    `).all();
  },

  getById(id) {
    return db.prepare('SELECT * FROM group_addresses WHERE id = ?').get(id);
  },

  getByAddress(address) {
    return db.prepare('SELECT * FROM group_addresses WHERE address = ?').get(address);
  },

  getByRoom(roomId) {
    return db.prepare(`
      SELECT * FROM group_addresses
      WHERE room_id = ?
      ORDER BY device_type, name, address
    `).all(roomId);
  },

  getConfigured() {
    return db.prepare(`
      SELECT ga.*, r.name as room_name
      FROM group_addresses ga
      LEFT JOIN rooms r ON ga.room_id = r.id
      WHERE ga.name IS NOT NULL
      ORDER BY r.sort_order, ga.device_type, ga.name
    `).all();
  },

  getDiscovered() {
    return db.prepare(`
      SELECT * FROM group_addresses
      WHERE name IS NULL
      ORDER BY last_activity DESC
    `).all();
  },

  upsert(ga) {
    const existing = this.getByAddress(ga.address);

    if (existing) {
      db.prepare(`
        UPDATE group_addresses
        SET current_value = ?, last_activity = ?
        WHERE address = ?
      `).run(ga.current_value, new Date().toISOString(), ga.address);
      return this.getByAddress(ga.address);
    }

    const stmt = db.prepare(`
      INSERT INTO group_addresses (id, address, name, description, device_type, data_type, room_id, current_value, is_controllable, icon, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      ga.id,
      ga.address,
      ga.name || null,
      ga.description || null,
      ga.device_type || 'switch',
      ga.data_type || 'DPT1',
      ga.room_id || null,
      ga.current_value || null,
      ga.is_controllable ?? 1,
      ga.icon || null,
      new Date().toISOString()
    );
    return this.getById(ga.id);
  },

  updateValue(address, value) {
    db.prepare(`
      UPDATE group_addresses
      SET current_value = ?, last_activity = ?
      WHERE address = ?
    `).run(value, new Date().toISOString(), address);
    return this.getByAddress(address);
  },

  update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.device_type !== undefined) { fields.push('device_type = ?'); values.push(updates.device_type); }
    if (updates.data_type !== undefined) { fields.push('data_type = ?'); values.push(updates.data_type); }
    if (updates.room_id !== undefined) { fields.push('room_id = ?'); values.push(updates.room_id); }
    if (updates.is_controllable !== undefined) { fields.push('is_controllable = ?'); values.push(updates.is_controllable ? 1 : 0); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    db.prepare(`UPDATE group_addresses SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id) {
    return db.prepare('DELETE FROM group_addresses WHERE id = ?').run(id);
  }
};

// Device-Group link operations
export const deviceGroupLinksDb = {
  link(deviceId, groupAddressId) {
    db.prepare(`
      INSERT OR IGNORE INTO device_group_links (device_id, group_address_id)
      VALUES (?, ?)
    `).run(deviceId, groupAddressId);
  },

  getGroupsForDevice(deviceId) {
    return db.prepare(`
      SELECT ga.* FROM group_addresses ga
      JOIN device_group_links dgl ON ga.id = dgl.group_address_id
      WHERE dgl.device_id = ?
    `).all(deviceId);
  },

  getDevicesForGroup(groupAddressId) {
    return db.prepare(`
      SELECT d.* FROM devices d
      JOIN device_group_links dgl ON d.id = dgl.device_id
      WHERE dgl.group_address_id = ?
    `).all(groupAddressId);
  }
};

// Telegram history operations
export const historyDb = {
  add(telegram) {
    db.prepare(`
      INSERT INTO telegram_history (src, dst, type, raw_hex, decoded_value)
      VALUES (?, ?, ?, ?, ?)
    `).run(telegram.src, telegram.dst, telegram.type, telegram.raw_hex, telegram.decoded_value);
  },

  getRecent(limit = 100) {
    return db.prepare(`
      SELECT * FROM telegram_history
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
  },

  getByAddress(address, limit = 50) {
    return db.prepare(`
      SELECT * FROM telegram_history
      WHERE dst = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(address, limit);
  },

  cleanup(daysToKeep = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    return db.prepare(`
      DELETE FROM telegram_history
      WHERE timestamp < ?
    `).run(cutoff.toISOString());
  }
};

// Initialize on module load
initializeDatabase();

export function closeDatabase() {
  if (db.open) db.close();
}

export default db;
