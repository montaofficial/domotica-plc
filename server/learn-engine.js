// Adaptive noise-cancelling Learn engine for the KNX discovery flow.
//
// The KNX bus is noisy (3-4 telegrams/sec on this site) which makes manual
// discovery via the live telegram view impractical. This engine fingerprints
// the noise floor during a "calibration" window and then, during a Learn
// session, scores each incoming telegram against the noise signatures and
// emits only the ones that look meaningfully different from the baseline.
//
// State machine: idle -> calibrating -> idle -> learning -> idle. There is
// exactly one engine in the process and one active session at a time. State
// transitions broadcast over WebSocket so any number of connected clients
// see the same view.

import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import knxService from './knx-service.js';
import { noiseSignaturesDb, learnSessionsDb } from './database.js';

const DEFAULT_BASELINE_MS = 10_000;
const MIN_BASELINE_MS = 2_000;
const MAX_BASELINE_MS = 5 * 60_000;
const DEFAULT_THRESHOLD = 0.4;
const MIN_OCCURRENCES_FOR_NOISE = 2;
const MAX_VALUE_SAMPLES = 8;
const MAX_DETECTIONS_PER_SESSION = 200;
const CALIBRATION_PROGRESS_MS = 500;

// KNX pattern: pressing a physical switch emits a command telegram from the
// switch's individual address, and ~100-500 ms later one or more actuators
// echo back the new state with the same value but from their own individual
// address (often on a different status group address). The first telegram is
// the "real" command — the rest are confirmations the user does not need to
// map. Within ECHO_WINDOW_MS we suppress any detection that has the same
// rawHex but a different src than something we just emitted.
const ECHO_WINDOW_MS = 800;
const RECENT_EMISSIONS_CAP = 16;

const REASONS = {
  NEW_GA: { reason: 'new_ga', score: 1.0, label: 'Nuovo GA' },
  NOVEL_TYPE: { reason: 'novel_type', score: 0.8, label: 'Tipo inedito' },
  NOVEL_VALUE: { reason: 'novel_value', score: 0.6, label: 'Valore inedito' },
  NOVEL_SOURCE: { reason: 'novel_source', score: 0.5, label: 'Sorgente nuova' },
  NOISE: { reason: 'noise', score: 0.0, label: 'Rumore' }
};

class LearnEngine extends EventEmitter {
  constructor() {
    super();
    this.state = 'idle';
    this.signatures = new Map();
    this.session = null;
    this.calibration = null;
    this._telegramHandler = (t) => this._handleTelegram(t);
  }

  init() {
    this._loadFromDb();
    knxService.on('telegram', this._telegramHandler);
  }

  // ---------- state introspection ----------

  getStateSummary() {
    return {
      state: this.state,
      session: this.session ? this._publicSession() : null,
      calibration: this.calibration ? this._publicCalibration() : null,
      profile: this._profileStats()
    };
  }

  listSignatures() {
    return Array.from(this.signatures.values()).map((s) => ({
      dst: s.dst,
      occurrences: s.occurrences,
      srcs: [...s.srcSet],
      types: [...s.typeSet],
      values: [...s.valueSamples],
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen
    })).sort((a, b) => b.occurrences - a.occurrences);
  }

  // ---------- baseline lifecycle ----------

  startCalibration({ durationMs = DEFAULT_BASELINE_MS } = {}) {
    const dur = Math.max(MIN_BASELINE_MS, Math.min(MAX_BASELINE_MS, Number(durationMs) || DEFAULT_BASELINE_MS));
    if (this.state === 'learning') this.stopLearning();

    this.state = 'calibrating';
    this.calibration = {
      startedAt: Date.now(),
      durationMs: dur,
      endsAt: Date.now() + dur,
      telegramsSeen: 0,
      newGas: 0,
      timer: setTimeout(() => this._endCalibration('done'), dur),
      ticker: setInterval(() => this._broadcastCalibration(), CALIBRATION_PROGRESS_MS)
    };
    this._broadcastState();
    return this.getStateSummary();
  }

  extendCalibration({ durationMs = DEFAULT_BASELINE_MS } = {}) {
    if (this.state !== 'calibrating') {
      return this.startCalibration({ durationMs });
    }
    const extra = Math.max(MIN_BASELINE_MS, Math.min(MAX_BASELINE_MS, Number(durationMs) || DEFAULT_BASELINE_MS));
    clearTimeout(this.calibration.timer);
    this.calibration.durationMs += extra;
    this.calibration.endsAt = Math.max(Date.now(), this.calibration.endsAt) + extra;
    this.calibration.timer = setTimeout(() => this._endCalibration('done'), this.calibration.endsAt - Date.now());
    this._broadcastCalibration();
    return this.getStateSummary();
  }

  stopCalibration() {
    if (this.state !== 'calibrating') return this.getStateSummary();
    this._endCalibration('stopped');
    return this.getStateSummary();
  }

  resetBaseline() {
    if (this.state === 'calibrating') this._endCalibration('reset');
    this.signatures.clear();
    noiseSignaturesDb.clear();
    this._broadcastState();
    return this.getStateSummary();
  }

  excludeFromNoise(dst) {
    this.signatures.delete(dst);
    noiseSignaturesDb.deleteByDst(dst);
    this._broadcastState();
    return this.getStateSummary();
  }

  // ---------- learn lifecycle ----------

  startLearning({ threshold = DEFAULT_THRESHOLD, echoFilter = true } = {}) {
    if (this.state === 'calibrating') this._endCalibration('superseded');
    if (this.state === 'learning') this.stopLearning();

    const t = this._clampThreshold(threshold);
    this.session = {
      id: uuidv4(),
      threshold: t,
      echoFilter: echoFilter !== false,
      echoesSuppressed: 0,
      recentEmissions: [],
      startedAt: new Date().toISOString(),
      detections: [],
      telegramsObserved: 0
    };
    this.state = 'learning';

    learnSessionsDb.insert({
      id: this.session.id,
      threshold: t,
      started_at: this.session.startedAt
    });

    this._broadcastState();
    return this.getStateSummary();
  }

  setThreshold(threshold) {
    if (!this.session) return this.getStateSummary();
    this.session.threshold = this._clampThreshold(threshold);
    this._broadcastState();
    return this.getStateSummary();
  }

  setEchoFilter(enabled) {
    if (!this.session) return this.getStateSummary();
    this.session.echoFilter = !!enabled;
    this._broadcastState();
    return this.getStateSummary();
  }

  stopLearning() {
    if (this.state !== 'learning' || !this.session) return null;
    const endedAt = new Date().toISOString();
    learnSessionsDb.markEnded(
      this.session.id,
      endedAt,
      this.session.detections.length,
      this.session.telegramsObserved
    );
    const summary = {
      ...this._publicSession(),
      endedAt,
      detections: this.session.detections.slice()
    };
    this.session = null;
    this.state = 'idle';
    this._broadcastState();
    return summary;
  }

  getDetections() {
    if (!this.session) return [];
    return this.session.detections.slice();
  }

  // ---------- internal ----------

  _handleTelegram(t) {
    if (this.state === 'calibrating') {
      this.calibration.telegramsSeen++;
      const isNew = !this.signatures.has(t.dst);
      this._updateSignature(t);
      if (isNew) this.calibration.newGas++;
      return;
    }
    if (this.state === 'learning') {
      this.session.telegramsObserved++;
      const verdict = this._score(t);
      if (verdict.score < this.session.threshold) return;

      if (this.session.echoFilter && this._isLikelyEcho(t)) {
        this.session.echoesSuppressed++;
        // No detection emitted, but bump the broadcast so the UI counter
        // updates. Skip the state push if too chatty by batching to once
        // per ~250 ms.
        this._broadcastStateThrottled();
        return;
      }

      this._trackEmission(t);

      const detection = {
        id: uuidv4(),
        sessionId: this.session.id,
        dst: t.dst,
        src: t.src,
        type: t.type,
        rawHex: t.rawHex,
        decodedValue: t.decodedValue,
        timestamp: t.timestamp,
        score: verdict.score,
        reason: verdict.reason,
        label: verdict.label
      };
      this.session.detections.unshift(detection);
      if (this.session.detections.length > MAX_DETECTIONS_PER_SESSION) {
        this.session.detections.length = MAX_DETECTIONS_PER_SESSION;
      }
      this.emit('detection', detection);
      return;
    }
  }

  _isLikelyEcho(t) {
    if (!t.rawHex) return false;
    const now = Date.now();
    const buf = this.session.recentEmissions;
    for (let i = buf.length - 1; i >= 0; i--) {
      const e = buf[i];
      if (now - e.at > ECHO_WINDOW_MS) break;
      if (e.rawHex === t.rawHex && e.src !== t.src) return true;
    }
    return false;
  }

  _trackEmission(t) {
    const buf = this.session.recentEmissions;
    buf.push({ at: Date.now(), rawHex: t.rawHex, src: t.src });
    const cutoff = Date.now() - ECHO_WINDOW_MS;
    while (buf.length > 0 && buf[0].at < cutoff) buf.shift();
    if (buf.length > RECENT_EMISSIONS_CAP) buf.splice(0, buf.length - RECENT_EMISSIONS_CAP);
  }

  _broadcastStateThrottled() {
    const now = Date.now();
    if (!this._lastStateBroadcast || now - this._lastStateBroadcast > 250) {
      this._lastStateBroadcast = now;
      this._broadcastState();
    }
  }

  _score(t) {
    const sig = this.signatures.get(t.dst);
    if (!sig || sig.occurrences < MIN_OCCURRENCES_FOR_NOISE) {
      return REASONS.NEW_GA;
    }
    if (!sig.typeSet.has(t.type)) return REASONS.NOVEL_TYPE;
    if (t.rawHex && !sig.valueSamples.has(t.rawHex)) return REASONS.NOVEL_VALUE;
    if (!sig.srcSet.has(t.src)) return REASONS.NOVEL_SOURCE;
    return REASONS.NOISE;
  }

  _updateSignature(t) {
    let sig = this.signatures.get(t.dst);
    const ts = t.timestamp || new Date().toISOString();
    if (!sig) {
      sig = {
        dst: t.dst,
        occurrences: 0,
        srcSet: new Set(),
        typeSet: new Set(),
        valueSamples: new Set(),
        firstSeen: ts,
        lastSeen: ts
      };
      this.signatures.set(t.dst, sig);
    }
    sig.occurrences++;
    sig.srcSet.add(t.src);
    sig.typeSet.add(t.type);
    if (t.rawHex && sig.valueSamples.size < MAX_VALUE_SAMPLES) {
      sig.valueSamples.add(t.rawHex);
    }
    sig.lastSeen = ts;
  }

  _endCalibration(reason) {
    if (!this.calibration) return;
    clearTimeout(this.calibration.timer);
    clearInterval(this.calibration.ticker);
    this._flushSignaturesToDb();
    this.calibration = null;
    this.state = 'idle';
    this._broadcastState();
    this.emit('calibration_ended', { reason });
  }

  _flushSignaturesToDb() {
    const rows = Array.from(this.signatures.values()).map((s) => ({
      dst: s.dst,
      occurrences: s.occurrences,
      src_set: JSON.stringify([...s.srcSet]),
      type_set: JSON.stringify([...s.typeSet]),
      value_samples: JSON.stringify([...s.valueSamples]),
      first_seen: s.firstSeen,
      last_seen: s.lastSeen
    }));
    if (rows.length > 0) noiseSignaturesDb.bulkUpsert(rows);
  }

  _loadFromDb() {
    for (const row of noiseSignaturesDb.getAll()) {
      this.signatures.set(row.dst, {
        dst: row.dst,
        occurrences: row.occurrences,
        srcSet: new Set(safeJsonArray(row.src_set)),
        typeSet: new Set(safeJsonArray(row.type_set)),
        valueSamples: new Set(safeJsonArray(row.value_samples)),
        firstSeen: row.first_seen,
        lastSeen: row.last_seen
      });
    }
  }

  _profileStats() {
    let lastUpdate = null;
    let totalOccurrences = 0;
    for (const s of this.signatures.values()) {
      totalOccurrences += s.occurrences;
      if (!lastUpdate || s.lastSeen > lastUpdate) lastUpdate = s.lastSeen;
    }
    return {
      signatureCount: this.signatures.size,
      totalOccurrences,
      lastUpdate
    };
  }

  _publicCalibration() {
    const now = Date.now();
    return {
      startedAt: new Date(this.calibration.startedAt).toISOString(),
      durationMs: this.calibration.durationMs,
      remainingMs: Math.max(0, this.calibration.endsAt - now),
      telegramsSeen: this.calibration.telegramsSeen,
      newGas: this.calibration.newGas
    };
  }

  _publicSession() {
    return {
      id: this.session.id,
      threshold: this.session.threshold,
      echoFilter: this.session.echoFilter,
      echoesSuppressed: this.session.echoesSuppressed,
      startedAt: this.session.startedAt,
      detectionsCount: this.session.detections.length,
      telegramsObserved: this.session.telegramsObserved
    };
  }

  _broadcastState() {
    this.emit('state', this.getStateSummary());
  }

  _broadcastCalibration() {
    if (!this.calibration) return;
    this.emit('calibration_progress', this._publicCalibration());
  }

  _clampThreshold(t) {
    const n = Number(t);
    if (!Number.isFinite(n)) return DEFAULT_THRESHOLD;
    return Math.max(0.1, Math.min(0.95, n));
  }
}

function safeJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const learnEngine = new LearnEngine();
export default learnEngine;
