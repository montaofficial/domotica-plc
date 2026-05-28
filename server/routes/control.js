import { Router } from 'express';
import { z } from 'zod';
import knxService from '../knx-service.js';
import { groupAddressesDb } from '../database.js';

const router = Router();

// Validation schemas
const writeSchema = z.object({
  value: z.union([z.boolean(), z.number(), z.string()]),
  dataType: z.string().optional()
});

// POST /api/control/:address - Write value to KNX group address
router.post('/:address', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const validated = writeSchema.parse(req.body);

    // Get stored group address info for datatype
    const ga = groupAddressesDb.getByAddress(address);
    const dataType = validated.dataType || ga?.data_type || 'DPT1';

    // Write to KNX
    knxService.write(address, validated.value, dataType);

    res.json({
      success: true,
      address,
      value: validated.value,
      dataType
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    if (error.message === 'Not connected to KNX gateway') {
      return res.status(503).json({
        error: 'KNX gateway not connected',
        status: knxService.getStatus()
      });
    }

    console.error('Error writing to KNX:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/control/:address/toggle - Toggle boolean value
router.post('/:address/toggle', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);

    knxService.toggle(address);

    const ga = groupAddressesDb.getByAddress(address);

    res.json({
      success: true,
      address,
      newValue: ga?.current_value
    });
  } catch (error) {
    if (error.message === 'Not connected to KNX gateway') {
      return res.status(503).json({
        error: 'KNX gateway not connected',
        status: knxService.getStatus()
      });
    }

    console.error('Error toggling KNX address:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/control/:address/on - Turn on
router.post('/:address/on', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const ga = groupAddressesDb.getByAddress(address);
    const dataType = ga?.data_type || 'DPT1';

    knxService.write(address, true, dataType);

    res.json({
      success: true,
      address,
      value: true
    });
  } catch (error) {
    if (error.message === 'Not connected to KNX gateway') {
      return res.status(503).json({
        error: 'KNX gateway not connected',
        status: knxService.getStatus()
      });
    }

    console.error('Error turning on:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/control/:address/off - Turn off
router.post('/:address/off', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const ga = groupAddressesDb.getByAddress(address);
    const dataType = ga?.data_type || 'DPT1';

    knxService.write(address, false, dataType);

    res.json({
      success: true,
      address,
      value: false
    });
  } catch (error) {
    if (error.message === 'Not connected to KNX gateway') {
      return res.status(503).json({
        error: 'KNX gateway not connected',
        status: knxService.getStatus()
      });
    }

    console.error('Error turning off:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/control/:address/read - Request read from KNX
router.get('/:address/read', (req, res) => {
  try {
    const address = decodeURIComponent(req.params.address);

    knxService.read(address);

    res.json({
      success: true,
      address,
      message: 'Read request sent'
    });
  } catch (error) {
    if (error.message === 'Not connected to KNX gateway') {
      return res.status(503).json({
        error: 'KNX gateway not connected',
        status: knxService.getStatus()
      });
    }

    console.error('Error reading from KNX:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
