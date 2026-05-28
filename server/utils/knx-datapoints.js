/**
 * KNX Datapoint Type utilities
 * Common DPTs used in home automation
 */

export const DPT_INFO = {
  'DPT1': {
    name: 'Switch',
    description: 'On/Off, True/False',
    unit: '',
    encode: (value) => value ? 1 : 0,
    decode: (raw) => raw === 1 || raw === true
  },
  'DPT1.001': {
    name: 'Switch',
    description: 'On/Off',
    unit: '',
    encode: (value) => value ? 1 : 0,
    decode: (raw) => raw === 1 || raw === true
  },
  'DPT1.008': {
    name: 'Up/Down',
    description: 'Up/Down for blinds',
    unit: '',
    encode: (value) => value ? 1 : 0,
    decode: (raw) => raw === 1
  },
  'DPT1.009': {
    name: 'Open/Close',
    description: 'Open/Close for contacts',
    unit: '',
    encode: (value) => value ? 1 : 0,
    decode: (raw) => raw === 1
  },
  'DPT5': {
    name: 'Percentage',
    description: '0-100%',
    unit: '%',
    encode: (value) => Math.round((value / 100) * 255),
    decode: (raw) => Math.round((raw / 255) * 100)
  },
  'DPT5.001': {
    name: 'Percentage',
    description: '0-100%',
    unit: '%',
    encode: (value) => Math.round((value / 100) * 255),
    decode: (raw) => Math.round((raw / 255) * 100)
  },
  'DPT9': {
    name: 'Temperature',
    description: '2-byte float',
    unit: '°C',
    encode: (value) => {
      // Simplified encoding
      const sign = value < 0 ? 1 : 0;
      const exp = 0;
      const mant = Math.round(value * 100);
      return [(sign << 7) | (exp << 3) | ((mant >> 8) & 0x07), mant & 0xFF];
    },
    decode: (raw) => {
      if (!Array.isArray(raw) && typeof raw !== 'object') return null;
      const bytes = Array.isArray(raw) ? raw : Array.from(raw);
      if (bytes.length < 2) return null;

      const sign = (bytes[0] >> 7) & 1;
      const exp = (bytes[0] >> 3) & 0x0F;
      const mant = ((bytes[0] & 0x07) << 8) | bytes[1];

      let value = (1 << exp) * mant * 0.01;
      if (sign) value = -value;
      return Math.round(value * 10) / 10;
    }
  }
};

/**
 * Get DPT info for a given type
 */
export function getDPTInfo(dpt) {
  return DPT_INFO[dpt] || DPT_INFO['DPT1'];
}

/**
 * Decode a raw value using the specified DPT
 */
export function decodeValue(rawHex, dpt = 'DPT1') {
  if (!rawHex) return null;

  try {
    const buffer = Buffer.from(rawHex, 'hex');
    const info = getDPTInfo(dpt);

    if (dpt.startsWith('DPT1')) {
      return info.decode(buffer[0] & 0x01);
    }

    if (dpt.startsWith('DPT5')) {
      return info.decode(buffer[0]);
    }

    if (dpt.startsWith('DPT9')) {
      return info.decode(buffer);
    }

    // Default: return boolean interpretation
    return (buffer[0] & 0x01) === 1;
  } catch (error) {
    console.error('Decode error:', error);
    return null;
  }
}

/**
 * Format a value for display
 */
export function formatValue(value, dpt = 'DPT1') {
  if (value === null || value === undefined) return 'Unknown';

  const info = getDPTInfo(dpt);

  if (dpt.startsWith('DPT1')) {
    return value ? 'ON' : 'OFF';
  }

  if (info.unit) {
    return `${value}${info.unit}`;
  }

  return String(value);
}

/**
 * Get device type suggestions based on group address patterns
 */
export function suggestDeviceType(address) {
  // Parse address (e.g., "3/0/1" -> main=3, middle=0, sub=1)
  const parts = address.split('/').map(Number);
  if (parts.length !== 3) return 'other';

  const [main] = parts;

  // Common KNX address conventions (may vary by installation)
  switch (main) {
    case 0:
      return 'switch'; // Often central functions
    case 1:
      return 'light'; // Lighting
    case 2:
      return 'blind'; // Blinds/shutters
    case 3:
      return 'light'; // Often feedback/status
    case 4:
      return 'sensor'; // Often sensors
    case 5:
      return 'thermostat'; // HVAC
    default:
      return 'switch';
  }
}

export const DEVICE_TYPES = [
  { value: 'light', label: 'Light', icon: 'Lightbulb' },
  { value: 'switch', label: 'Switch', icon: 'Power' },
  { value: 'fan', label: 'Fan', icon: 'Fan' },
  { value: 'door', label: 'Door', icon: 'DoorOpen' },
  { value: 'blind', label: 'Blind/Shutter', icon: 'Blinds' },
  { value: 'sensor', label: 'Sensor', icon: 'Activity' },
  { value: 'thermostat', label: 'Thermostat', icon: 'Thermometer' },
  { value: 'other', label: 'Other', icon: 'CircleDot' }
];

export const ROOM_ICONS = [
  { value: 'home', label: 'Home' },
  { value: 'sofa', label: 'Living Room' },
  { value: 'bed', label: 'Bedroom' },
  { value: 'utensils', label: 'Kitchen' },
  { value: 'bath', label: 'Bathroom' },
  { value: 'briefcase', label: 'Office' },
  { value: 'warehouse', label: 'Garage' },
  { value: 'trees', label: 'Garden' },
  { value: 'door-open', label: 'Hallway' },
  { value: 'stairs', label: 'Stairs' }
];
