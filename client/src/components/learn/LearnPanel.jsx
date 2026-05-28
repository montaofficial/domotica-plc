import { useMemo, useState } from 'react';
import { Brain, Database, Loader2, Pause, Play, RotateCcw, Sliders, Repeat2 } from 'lucide-react';
import CalibrationView from './CalibrationView';
import DetectionList from './DetectionList';
import {
  useStartBaseline, useExtendBaseline, useStopBaseline, useResetBaseline,
  useStartLearning, useStopLearning, useSetThreshold, useSetEchoFilter, useExcludeFromNoise
} from '../../hooks/useLearn';

const PRESET_BASELINES = [
  { label: '5 s',  ms: 5_000 },
  { label: '10 s', ms: 10_000 },
  { label: '30 s', ms: 30_000 },
  { label: '60 s', ms: 60_000 }
];

function formatRelative(iso) {
  if (!iso) return 'mai';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s fa`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m fa`;
  const h = Math.floor(m / 60);
  return `${h}h fa`;
}

function LearnPanel({
  learnState,
  calibration,
  detections,
  onConfigureDetection
}) {
  const [baselineMs, setBaselineMs] = useState(10_000);
  const [threshold, setThresholdLocal] = useState(0.4);

  const startBaseline = useStartBaseline();
  const extendBaseline = useExtendBaseline();
  const stopBaseline = useStopBaseline();
  const resetBaseline = useResetBaseline();
  const startLearning = useStartLearning();
  const stopLearning = useStopLearning();
  const setThresholdMut = useSetThreshold();
  const setEchoFilterMut = useSetEchoFilter();
  const excludeFromNoise = useExcludeFromNoise();

  const state = learnState?.state ?? 'idle';
  const profile = learnState?.profile ?? { signatureCount: 0, lastUpdate: null };
  const session = learnState?.session;

  // Keep slider in sync with server-reported session threshold when one is active.
  const effectiveThreshold = session?.threshold ?? threshold;
  const echoFilterOn = session?.echoFilter ?? true;
  const echoesSuppressed = session?.echoesSuppressed ?? 0;

  const profileFresh = useMemo(() => {
    if (!profile.lastUpdate) return false;
    return Date.now() - new Date(profile.lastUpdate).getTime() < 10 * 60_000;
  }, [profile.lastUpdate]);

  const handleStartFlow = () => {
    if (profileFresh && profile.signatureCount > 0) {
      // Profile is fresh enough — go straight to Learn
      startLearning.mutate({ threshold });
    } else {
      startBaseline.mutate(baselineMs);
    }
  };

  const handleThresholdChange = (v) => {
    setThresholdLocal(v);
    if (state === 'learning') setThresholdMut.mutate(v);
  };

  const handleExcludeDetection = (d) => {
    excludeFromNoise.mutate(d.dst);
  };

  return (
    <div className="space-y-4">
      {/* Profile summary card */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-500/10 p-2 rounded">
            <Database className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Profilo rumore</div>
            <div className="text-xs text-dark-400">
              {profile.signatureCount} indirizzi tracciati · ultimo aggiornamento {formatRelative(profile.lastUpdate)}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {state === 'idle' && (
            <>
              <select
                value={baselineMs}
                onChange={(e) => setBaselineMs(Number(e.target.value))}
                className="bg-dark-700 text-white text-sm rounded px-2 py-1.5 border border-dark-600"
              >
                {PRESET_BASELINES.map((p) => (
                  <option key={p.ms} value={p.ms}>Baseline {p.label}</option>
                ))}
              </select>
              <button
                onClick={handleStartFlow}
                className="btn-primary text-sm flex items-center gap-2"
                disabled={startBaseline.isPending || startLearning.isPending}
              >
                {(startBaseline.isPending || startLearning.isPending)
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4" />}
                {profileFresh && profile.signatureCount > 0 ? 'Riusa profilo & cerca' : 'Inizia scoperta'}
              </button>
              <button
                onClick={() => resetBaseline.mutate()}
                className="btn-secondary text-sm flex items-center gap-2"
                title="Cancella completamente il profilo rumore"
                disabled={resetBaseline.isPending || profile.signatureCount === 0}
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </>
          )}

          {state === 'calibrating' && (
            <button onClick={() => stopBaseline.mutate()} className="btn-secondary text-sm">
              <Pause className="w-4 h-4 inline mr-1" />
              Ferma calibrazione
            </button>
          )}

          {state === 'learning' && (
            <button onClick={() => stopLearning.mutate()} className="btn-secondary text-sm">
              <Pause className="w-4 h-4 inline mr-1" />
              Termina sessione
            </button>
          )}
        </div>
      </div>

      {/* Calibration phase */}
      {state === 'calibrating' && (
        <CalibrationView
          calibration={calibration}
          onExtend={() => extendBaseline.mutate(10_000)}
          onSkip={() => {
            stopBaseline.mutate(undefined, {
              onSuccess: () => startLearning.mutate({ threshold })
            });
          }}
          onReset={() => resetBaseline.mutate()}
        />
      )}

      {/* Learn phase */}
      {state === 'learning' && (
        <>
          <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-white">Sessione attiva</span>
            </div>
            <div className="text-xs text-dark-400">
              {session?.telegramsObserved ?? 0} telegrammi ascoltati ·
              {' '}<strong className="text-white">{detections?.length ?? 0}</strong> rilevamenti
              {echoesSuppressed > 0 && (
                <span className="ml-2 text-fuchsia-300">
                  · {echoesSuppressed} echo nascosti
                </span>
              )}
            </div>

            <label
              className={`flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded border ${
                echoFilterOn
                  ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-200'
                  : 'bg-dark-700 border-dark-600 text-dark-300'
              }`}
              title="Sopprime i telegram di feedback inviati dagli attuatori subito dopo il comando (stesso valore, src diversa, < 800 ms)."
            >
              <Repeat2 className="w-3.5 h-3.5" />
              <input
                type="checkbox"
                className="accent-fuchsia-400"
                checked={echoFilterOn}
                onChange={(e) => setEchoFilterMut.mutate(e.target.checked)}
              />
              Filtra echo attuatori
            </label>

            <div className="ml-auto flex items-center gap-3 min-w-[260px]">
              <Sliders className="w-4 h-4 text-dark-400" />
              <input
                type="range"
                min="0.2" max="0.9" step="0.05"
                value={effectiveThreshold}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-dark-300 w-12 text-right">soglia {effectiveThreshold.toFixed(2)}</span>
            </div>
          </div>

          <DetectionList
            detections={detections}
            onConfigure={onConfigureDetection}
            onExcludeFromNoise={handleExcludeDetection}
          />
        </>
      )}

      {/* Idle empty hint */}
      {state === 'idle' && profile.signatureCount === 0 && (
        <div className="card p-6 text-center">
          <Brain className="w-10 h-10 mx-auto mb-3 text-dark-500" />
          <p className="font-medium text-white">Nessun profilo di rumore ancora.</p>
          <p className="text-sm text-dark-400 mt-1">
            Premi <em>Inizia scoperta</em>: prima imparo il rumore di fondo, poi mostro solo gli eventi
            che non ho mai visto. Tutto il sistema continua a funzionare come prima.
          </p>
        </div>
      )}
    </div>
  );
}

export default LearnPanel;
