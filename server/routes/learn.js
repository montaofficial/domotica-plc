import { Router } from 'express';
import { z } from 'zod';
import learnEngine from '../learn-engine.js';

const router = Router();

const durationSchema = z.object({
  durationMs: z.number().int().positive().optional()
});

const thresholdSchema = z.object({
  threshold: z.number().min(0.1).max(0.95).optional()
});

const dstSchema = z.object({
  dst: z.string().min(1).max(64)
});

function withZod(schema, handler) {
  return (req, res) => {
    try {
      const body = schema.parse(req.body ?? {});
      handler(req, res, body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: err.flatten() });
      }
      console.error('[learn] handler error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  };
}

// GET /api/learn/state — current engine state + profile stats
router.get('/state', (req, res) => {
  res.json(learnEngine.getStateSummary());
});

// GET /api/learn/profile — full list of tracked noise signatures
router.get('/profile', (req, res) => {
  res.json({
    stats: learnEngine.getStateSummary().profile,
    signatures: learnEngine.listSignatures()
  });
});

// POST /api/learn/baseline/start — begin calibration window
router.post('/baseline/start', withZod(durationSchema, (req, res, body) => {
  res.json(learnEngine.startCalibration(body));
}));

// POST /api/learn/baseline/extend — push the calibration deadline
router.post('/baseline/extend', withZod(durationSchema, (req, res, body) => {
  res.json(learnEngine.extendCalibration(body));
}));

// POST /api/learn/baseline/stop — cut calibration short
router.post('/baseline/stop', (req, res) => {
  res.json(learnEngine.stopCalibration());
});

// DELETE /api/learn/baseline — wipe the entire noise profile
router.delete('/baseline', (req, res) => {
  res.json(learnEngine.resetBaseline());
});

// POST /api/learn/baseline/exclude — remove a single GA from noise
router.post('/baseline/exclude', withZod(dstSchema, (req, res, body) => {
  res.json(learnEngine.excludeFromNoise(body.dst));
}));

// POST /api/learn/start — enter Learn mode
router.post('/start', withZod(thresholdSchema, (req, res, body) => {
  res.json(learnEngine.startLearning(body));
}));

// PATCH /api/learn/threshold — adjust live during a session
router.patch('/threshold', withZod(thresholdSchema.required(), (req, res, body) => {
  res.json(learnEngine.setThreshold(body.threshold));
}));

// POST /api/learn/stop — end the session and return its detections
router.post('/stop', (req, res) => {
  const summary = learnEngine.stopLearning();
  if (!summary) return res.json({ ended: false });
  res.json({ ended: true, session: summary });
});

// GET /api/learn/detections — snapshot for client reconnects
router.get('/detections', (req, res) => {
  res.json({ detections: learnEngine.getDetections() });
});

export default router;
