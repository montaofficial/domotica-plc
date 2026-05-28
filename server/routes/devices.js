import { Router } from 'express';
import { z } from 'zod';
import { devicesDb, deviceGroupLinksDb } from '../database.js';

const router = Router();

// Validation schemas
const updateDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  room_id: z.string().optional()
});

// GET /api/devices - List all physical devices
router.get('/', (req, res) => {
  try {
    const devices = devicesDb.getAll();

    // Include linked group addresses for each device
    const devicesWithGroups = devices.map(device => {
      const groups = deviceGroupLinksDb.getGroupsForDevice(device.id);
      return {
        ...device,
        group_addresses: groups
      };
    });

    res.json(devicesWithGroups);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', (req, res) => {
  try {
    const device = devicesDb.getById(req.params.id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const groups = deviceGroupLinksDb.getGroupsForDevice(device.id);

    res.json({
      ...device,
      group_addresses: groups
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/devices/:id - Update device
router.put('/:id', (req, res) => {
  try {
    const existing = devicesDb.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const validated = updateDeviceSchema.parse(req.body);
    const device = devicesDb.update(req.params.id, validated);

    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating device:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/devices/by-address/:address - Get device by physical address
router.get('/by-address/:address', (req, res) => {
  try {
    // Decode the address (e.g., "1.1.10")
    const address = decodeURIComponent(req.params.address);
    const device = devicesDb.getByPhysicalAddress(address);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const groups = deviceGroupLinksDb.getGroupsForDevice(device.id);

    res.json({
      ...device,
      group_addresses: groups
    });
  } catch (error) {
    console.error('Error fetching device by address:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
