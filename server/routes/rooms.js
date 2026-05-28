import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { roomsDb, groupAddressesDb } from '../database.js';

const router = Router();

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  sort_order: z.number().int().optional()
});

const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().optional()
});

// GET /api/rooms - List all rooms
router.get('/', (req, res) => {
  try {
    const rooms = roomsDb.getAll();

    // Optionally include device counts
    const roomsWithCounts = rooms.map(room => {
      const devices = groupAddressesDb.getByRoom(room.id);
      return {
        ...room,
        device_count: devices.length
      };
    });

    res.json(roomsWithCounts);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rooms/:id - Get single room with its devices
router.get('/:id', (req, res) => {
  try {
    const room = roomsDb.getById(req.params.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const devices = groupAddressesDb.getByRoom(room.id);

    res.json({
      ...room,
      devices
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rooms - Create new room
router.post('/', (req, res) => {
  try {
    const validated = createRoomSchema.parse(req.body);

    const room = roomsDb.create({
      id: uuidv4(),
      ...validated
    });

    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/rooms/:id - Update room
router.put('/:id', (req, res) => {
  try {
    const existing = roomsDb.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Prevent modification of default room's id
    if (req.params.id === 'default' && req.body.id) {
      return res.status(400).json({ error: 'Cannot change default room ID' });
    }

    const validated = updateRoomSchema.parse(req.body);
    const room = roomsDb.update(req.params.id, validated);

    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating room:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rooms/:id - Delete room
router.delete('/:id', (req, res) => {
  try {
    if (req.params.id === 'default') {
      return res.status(400).json({ error: 'Cannot delete default room' });
    }

    const existing = roomsDb.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    roomsDb.delete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
