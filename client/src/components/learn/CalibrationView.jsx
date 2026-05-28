import { Activity, Radio } from 'lucide-react';

// Calibration window UI. Driven entirely by props pushed in via WebSocket;
// no local timers, no setInterval — the server owns the deadline and ticks
// progress on its own clock (~2 updates/sec), which keeps every connected
// client in lock-step.
function CalibrationView({ calibration, onSkip, onExtend, onReset }) {
  const totalMs = calibration?.durationMs ?? 0;
  const remainingMs = calibration?.remainingMs ?? 0;
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  const pct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Radio className="w-5 h-5 text-primary-400 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">Sto ascoltando il bus…</h3>
      </div>
      <p className="text-sm text-dark-300">
        Imparo il rumore di fondo per <strong>{Math.round(totalMs / 1000)}s</strong>. Tutto quello che
        appare qui dentro verrà considerato rumore e nascosto nella fase di scoperta.
        <span className="text-dark-400"> Non premere ancora il pulsante che vuoi identificare.</span>
      </p>

      <div className="space-y-2">
        <div className="h-2 w-full bg-dark-700 rounded overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-dark-400">
          <span>{seconds}s rimasti</span>
          <span>{Math.round(pct)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-700 rounded p-3">
          <div className="text-xs uppercase text-dark-400 mb-1">Telegrammi ascoltati</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-400" />
            {calibration?.telegramsSeen ?? 0}
          </div>
        </div>
        <div className="bg-dark-700 rounded p-3">
          <div className="text-xs uppercase text-dark-400 mb-1">Nuovi indirizzi visti</div>
          <div className="text-2xl font-bold text-white">{calibration?.newGas ?? 0}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button onClick={onExtend} className="btn-secondary text-sm">+ 10 s</button>
        <button onClick={onSkip} className="btn-secondary text-sm">Salta ora</button>
        <button onClick={onReset} className="btn-secondary text-sm text-red-400">Reset profilo</button>
      </div>
    </div>
  );
}

export default CalibrationView;
