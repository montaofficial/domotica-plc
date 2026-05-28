// Topology mapping — PASSIVE infrastructure discovery.
//
// Everything here is read-only on the KNX bus: the only bus primitive used is
// GroupValueRead (knxService.readGroupValue), which asks a device for its
// current state and never changes it. There is intentionally NO path to
// GroupValueWrite/toggle in this module — actuating the plant during mapping
// was explicitly ruled out as unsafe (we don't know what every GA controls).
//
// The orchestration ("four hands") is: an operator/agent triggers /scan to
// fingerprint the bus, reads /evidence (probe results + history-derived
// stats + co-activation correlations), interprets each GA, and writes the
// result back via /classify. /map returns the assembled, human-facing view.

import { Router } from 'express';
import { z } from 'zod';
import knxService from '../knx-service.js';
import { groupAddressesDb, gaInferenceDb } from '../database.js';
import db from '../database.js';

const router = Router();

const scanSchema = z.object({
  addresses: z.array(z.string().min(1)).optional(),
  spacingMs: z.number().int().min(40).max(1000).optional(),
  timeoutMs: z.number().int().min(200).max(2000).optional(),
  includeSweep: z.boolean().optional()
});

const classifySchema = z.object({
  items: z.array(z.object({
    address: z.string().min(1),
    name: z.string().max(120).optional(),
    device_type: z.string().max(40).optional(),
    data_type: z.string().max(40).optional(),
    role: z.enum(['status', 'command', 'unknown']).optional(),
    category: z.string().max(40).optional(),
    confidence: z.number().min(0).max(1).optional(),
    rationale: z.string().max(2000).optional(),
    apply_name: z.boolean().optional()
  })).min(1)
});

// ---- helpers -------------------------------------------------------------

function knownAddresses() {
  return groupAddressesDb.getAll().map((g) => g.address);
}

// Build candidate addresses for an optional bounded sweep: for every
// (main/middle) pair we've actually observed, walk the full sub range. We
// log the exact span so coverage is never silently truncated.
function sweepCandidates() {
  const seen = new Set();
  const pairs = new Set();
  for (const a of knownAddresses()) {
    const parts = a.split('/');
    if (parts.length === 3) {
      pairs.add(`${parts[0]}/${parts[1]}`);
      seen.add(a);
    }
  }
  const candidates = [];
  for (const pair of pairs) {
    for (let sub = 0; sub <= 255; sub++) {
      const addr = `${pair}/${sub}`;
      if (!seen.has(addr)) candidates.push(addr);
    }
  }
  return { candidates, pairs: [...pairs] };
}

// Per-GA evidence derived from the passive telegram history.
function historyStats() {
  const rows = db.prepare(`
    SELECT src, dst, type, raw_hex, timestamp
    FROM telegram_history
    ORDER BY timestamp DESC
    LIMIT 8000
  `).all();

  const byDst = new Map();
  for (const r of rows) {
    let s = byDst.get(r.dst);
    if (!s) {
      s = { writes: 0, srcs: new Set(), values: new Set(), widths: new Set(), lastTs: r.timestamp };
      byDst.set(r.dst, s);
    }
    s.writes++;
    if (r.src) s.srcs.add(r.src);
    if (r.raw_hex) { s.values.add(r.raw_hex); s.widths.add(r.raw_hex.length / 2); }
  }

  // Co-activation: GAs that fire within CORR_WINDOW_MS of each other. The
  // strongest partner of a command GA is usually the load it drives (the echo
  // pattern we already exploit in Learn).
  const CORR_WINDOW_MS = 1200;
  const chron = rows
    .map((r) => ({ dst: r.dst, t: Date.parse(r.timestamp) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
  const corr = new Map(); // dst -> Map(otherDst -> count)
  for (let i = 0; i < chron.length; i++) {
    const a = chron[i];
    for (let j = i + 1; j < chron.length && chron[j].t - a.t <= CORR_WINDOW_MS; j++) {
      const b = chron[j];
      if (b.dst === a.dst) continue;
      for (const [x, y] of [[a.dst, b.dst], [b.dst, a.dst]]) {
        let m = corr.get(x);
        if (!m) { m = new Map(); corr.set(x, m); }
        m.set(y, (m.get(y) || 0) + 1);
      }
    }
  }

  const out = new Map();
  for (const [dst, s] of byDst) {
    const partners = [...(corr.get(dst)?.entries() || [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([addr, count]) => ({ addr, count }));
    out.set(dst, {
      writes: s.writes,
      srcs: [...s.srcs],
      distinctValues: s.values.size,
      values: [...s.values].slice(0, 8),
      widths: [...s.widths],
      partners
    });
  }
  return out;
}

function buildEvidence() {
  const gas = groupAddressesDb.getAll();
  const hist = historyStats();
  const inf = new Map(gaInferenceDb.getAll().map((r) => [r.address, r]));

  return gas.map((g) => {
    const h = hist.get(g.address) || { writes: 0, srcs: [], distinctValues: 0, values: [], widths: [], partners: [] };
    const i = inf.get(g.address) || {};
    return {
      address: g.address,
      name: g.name,
      current_value: g.current_value,
      device_type: g.device_type,
      data_type: g.data_type,
      probe: {
        answeredRead: i.answered_read === 1,
        payloadLen: i.payload_len,
        lastHex: i.last_read_hex,
        readAt: i.read_at
      },
      history: h,
      classification: {
        role: i.role,
        inferredDpt: i.inferred_dpt,
        inferredCategory: i.inferred_category,
        confidence: i.confidence,
        rationale: i.rationale,
        source: i.source
      }
    };
  });
}

function withZod(schema, handler) {
  return (req, res) => {
    try {
      const body = schema.parse(req.body ?? {});
      return handler(req, res, body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: err.flatten() });
      }
      console.error('[topology] error:', err);
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  };
}

// ---- routes --------------------------------------------------------------

// POST /api/topology/scan — passive GroupValueRead sweep
router.post('/scan', withZod(scanSchema, async (req, res, body) => {
  if (!knxService.isConnected()) {
    return res.status(409).json({ error: 'KNX not connected' });
  }
  const spacing = body.spacingMs ?? 120;
  const timeout = body.timeoutMs ?? 600;

  let targets = body.addresses?.length ? body.addresses : knownAddresses();
  let sweepInfo = null;
  if (body.includeSweep) {
    const { candidates, pairs } = sweepCandidates();
    sweepInfo = { pairs, candidateCount: candidates.length };
    targets = [...new Set([...targets, ...candidates])];
  }

  console.log(`[topology] scan start: ${targets.length} GAs, spacing ${spacing}ms, timeout ${timeout}ms${sweepInfo ? ` (sweep +${sweepInfo.candidateCount})` : ''}`);

  let answered = 0;
  for (const addr of targets) {
    const r = await knxService.readGroupValue(addr, timeout);
    gaInferenceDb.recordProbe(addr, { answered: r.answered, payloadLen: r.len, hex: r.hex });
    if (r.answered) answered++;
    await new Promise((res2) => setTimeout(res2, spacing));
  }

  console.log(`[topology] scan done: ${answered}/${targets.length} answered`);
  res.json({
    scanned: targets.length,
    answered,
    sweep: sweepInfo,
    coverageNote: sweepInfo
      ? `Swept observed middle-groups [${sweepInfo.pairs.join(', ')}] sub 0-255; other ranges NOT covered.`
      : 'Scanned only addresses already known to the system; unseen ranges NOT covered (pass includeSweep:true to widen).'
  });
}));

// GET /api/topology/evidence — full evidence bundle for interpretation
router.get('/evidence', (req, res) => {
  res.json({ generatedAt: new Date().toISOString(), gas: buildEvidence() });
});

// PATCH /api/topology/classify — write back interpretations
router.patch('/classify', withZod(classifySchema, (req, res, body) => {
  let updated = 0;
  for (const item of body.items) {
    gaInferenceDb.classify(item.address, {
      role: item.role,
      inferredDpt: item.data_type,
      inferredCategory: item.category,
      confidence: item.confidence,
      rationale: item.rationale,
      source: 'claude'
    });
    // Optionally promote the classification into the user-facing GA record.
    const gaUpdate = {};
    if (item.apply_name && item.name) gaUpdate.name = item.name;
    if (item.device_type) gaUpdate.device_type = item.device_type;
    if (item.data_type) gaUpdate.data_type = item.data_type;
    if (Object.keys(gaUpdate).length > 0) {
      const ga = groupAddressesDb.getByAddress(item.address);
      if (ga) groupAddressesDb.update(ga.id, gaUpdate);
    }
    updated++;
  }
  res.json({ updated });
}));

// GET /api/topology/map — assembled, grouped view for the UI
router.get('/map', (req, res) => {
  const evidence = buildEvidence();
  // Group by KNX line inferred from the source device, falling back to the
  // GA main group when no source is known.
  const groups = {};
  for (const e of evidence) {
    const main = e.address.split('/')[0] || '?';
    const key = `main:${main}`;
    (groups[key] ||= { key, mainGroup: main, items: [] }).items.push(e);
  }
  res.json({
    generatedAt: new Date().toISOString(),
    total: evidence.length,
    classified: evidence.filter((e) => e.classification.inferredCategory).length,
    groups: Object.values(groups).sort((a, b) => Number(a.mainGroup) - Number(b.mainGroup))
  });
});

export default router;
