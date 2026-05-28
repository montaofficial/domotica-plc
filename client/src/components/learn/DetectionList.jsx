import { ArrowRight, EyeOff, Settings, Sparkles } from 'lucide-react';

const REASON_STYLE = {
  new_ga:       { label: 'Nuovo GA',        chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  novel_type:   { label: 'Tipo inedito',    chip: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  novel_value:  { label: 'Valore inedito',  chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  novel_source: { label: 'Sorgente nuova',  chip: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' }
};

function valueChip(d) {
  if (d.decodedValue === true || d.decodedValue === false) {
    const isOn = !!d.decodedValue;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${isOn ? 'bg-green-500/20 text-green-300' : 'bg-dark-700 text-dark-300'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-green-400' : 'bg-dark-500'}`} />
        {isOn ? 'ON' : 'OFF'}
      </span>
    );
  }
  return <code className="text-xs text-dark-300">{d.rawHex || '—'}</code>;
}

function DetectionList({ detections, onConfigure, onExcludeFromNoise }) {
  if (!detections || detections.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary-400 opacity-70" />
        <p className="font-medium text-white">Pronto. Premi il pulsante del dispositivo.</p>
        <p className="text-sm text-dark-400 mt-1">
          Mostro solo gli eventi che non somigliano al rumore appreso.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="p-4 border-b border-dark-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Rilevamenti</h3>
          <p className="text-xs text-dark-400">
            {detections.length} eventi filtrati — i più recenti in alto
          </p>
        </div>
      </div>
      <div className="divide-y divide-dark-700/60 max-h-[28rem] overflow-y-auto scrollbar-thin">
        {detections.map((d) => {
          const style = REASON_STYLE[d.reason] || REASON_STYLE.new_ga;
          return (
            <div key={d.id} className="p-3 flex items-center gap-3 hover:bg-dark-700/40">
              <div className={`shrink-0 px-2 py-0.5 rounded border text-xs ${style.chip}`}>{style.label}</div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <span className="text-dark-300">{d.src}</span>
                <ArrowRight className="w-3 h-3 text-dark-500" />
                <span className="text-primary-300">{d.dst}</span>
              </div>
              <div className="ml-2">{valueChip(d)}</div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onConfigure?.(d)}
                  className="btn-secondary text-xs py-1 px-2"
                  title="Configura come dispositivo"
                >
                  <Settings className="w-3 h-3 inline mr-1" />
                  Configura
                </button>
                <button
                  onClick={() => onExcludeFromNoise?.(d)}
                  className="btn-secondary text-xs py-1 px-2"
                  title="Forza questo GA a NON essere mai considerato rumore"
                >
                  <EyeOff className="w-3 h-3 inline mr-1" />
                  Mai rumore
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DetectionList;
