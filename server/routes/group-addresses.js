import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { groupAddressesDb, deviceGroupLinksDb } from '../database.js';
import { DEVICE_TYPES } from '../utils/knx-datapoints.js';

const router = Router();

// KNX address validation regex (e.g., "1/2/3" or "0/0/1")
const knxAddressRegex = /^\d{1,2}\/\d{1,2}\/\d{1,3}$/;

// Validation schemas
const createGroupAddressSchema = z.object({
  address: z.string().regex(knxAddressRegex, 'Invalid KNX address format (e.g., 1/2/3)'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  device_type: z.enum(['light', 'switch', 'fan', 'door', 'blind', 'sensor', 'thermostat', 'other']).default('switch'),
  data_type: z.string().default('DPT1'),
  room_id: z.string().nullable().optional(),
  is_controllable: z.boolean().default(true),
  icon: z.string().nullable().optional()
});

const updateGroupAddressSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  device_type: z.enum(['light', 'switch', 'fan', 'door', 'blind', 'sensor', 'thermostat', 'other']).optional(),
  data_type: z.string().optional(),
  room_id: z.string().nullable().optional(),
  is_controllable: z.boolean().optional(),
  icon: z.string().nullable().optional()
});

// GET /api/group-addresses - List all group addresses
router.get('/', (req, res) => {
  try {
    const { configured, room } = req.query;

    let addresses;
    if (configured === 'true') {
      addresses = groupAddressesDb.getConfigured();
    } else if (room) {
      addresses = groupAddressesDb.getByRoom(room);
    } else {
      addresses = groupAddressesDb.getAll();
    }

    res.json(addresses);
  } catch (error) {
    console.error('Error fetching group addresses:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/group-addresses - Create new group address manually
router.post('/', (req, res) => {
  try {
    const validated = createGroupAddressSchema.parse(req.body);

    // Check if address already exists
    const existing = groupAddressesDb.getByAddress(validated.address);
    if (existing) {
      return res.status(409).json({
        error: 'Address already exists',
        existing: existing
      });
    }

    const ga = groupAddressesDb.upsert({
      id: uuidv4(),
      ...validated,
      is_controllable: validated.is_controllable ? 1 : 0,
      current_value: null
    });

    res.status(201).json(ga);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating group address:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/group-addresses/discovered - Get undiscovered/unconfigured addresses
router.get('/discovered', (req, res) => {
  try {
    const addresses = groupAddressesDb.getDiscovered();
    res.json(addresses);
  } catch (error) {
    console.error('Error fetching discovered addresses:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/group-addresses/types - Get available device types
router.get('/types', (req, res) => {
  res.json(DEVICE_TYPES);
});

// GET /api/group-addresses/:id - Get single group address
router.get('/:id', (req, res) => {
  try {
    const ga = groupAddressesDb.getById(req.params.id);

    if (!ga) {
      return res.status(404).json({ error: 'Group address not found' });
    }

    const devices = deviceGroupLinksDb.getDevicesForGroup(ga.id);

    res.json({
      ...ga,
      linked_devices: devices
    });
  } catch (error) {
    console.error('Error fetching group address:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/group-addresses/:id - Update group address
router.put('/:id', (req, res) => {
  try {
    const existing = groupAddressesDb.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Group address not found' });
    }

    const validated = updateGroupAddressSchema.parse(req.body);
    const ga = groupAddressesDb.update(req.params.id, validated);

    res.json(ga);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating group address:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/group-addresses/:id - Delete group address
router.delete('/:id', (req, res) => {
  try {
    const existing = groupAddressesDb.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Group address not found' });
    }

    groupAddressesDb.delete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group address:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/group-addresses/by-address/:address - Get by KNX address
router.get('/by-address/:address', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const ga = groupAddressesDb.getByAddress(address);

    if (!ga) {
      return res.status(404).json({ error: 'Group address not found' });
    }

    res.json(ga);
  } catch (error) {
    console.error('Error fetching group address by address:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
