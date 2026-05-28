import { useState } from 'react';
import { useTopologyMap, useTopologyScan, useClassify } from '../hooks/useTopology';
import DeviceConfigModal from '../components/DeviceConfigModal';
import {
  Network, Loader2, RefreshCw, ArrowRight, ArrowLeft, Lightbulb,
  ToggleLeft, Gauge, Sigma, HelpCircle, Check, Pencil, Settings
} from 'lucide-react';

const CATEGORY_META = {
  binary_load:      { label: 'Carico binario', icon: Lightbulb,  chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  command:          { label: 'Comando',         icon: ToggleLeft, chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  command_highrate: { label: 'Comando (HR)',    icon: Sigma,      chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  status_highrate:  { label: 'Stato (HR)',      icon: Gauge,      chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  central:          { label: 'Generale',        icon: Network,    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  unknown:          { label: '—',               icon: HelpCircle, chip: 'bg-dark-700 text-dark-300 border-dark-600' }
};

function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2" title={`Confidenza ${pct}%`}>
      <div className="w-16 h-1.5 bg-dark-700 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-dark-400 w-7">{pct}%</span>
    </div>
  );
}

function RoleBadge({ role }) {
  if (role === 'status') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><ArrowLeft className="w-3 h-3" />stato</span>;
  }
  if (role === 'command') {
    return <span className="inline-flex items-center gap-1 text-[10px] text-blue-300"><ArrowRight className="w-3 h-3" />comando</span>;
  }
  return <span className="text-[10px] text-dark-400">?</span>;
}

function GaRow({ item, onSaveName, onConfigure }) {
  const c = item.classification || {};
  const meta = CATEGORY_META[c.inferredCategory] || CATEGORY_META.unknown;
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name || '');
  const isMapped = !!item.name;

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-dark-700/30">
      <code className="text-sm text-primary-300 bg-dark-900 px-2 py-1 rounded w-20 text-center">{item.address}</code>
      <div className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${meta.chip}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
      </div>
      <RoleBadge role={c.role} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input py-1 text-sm flex-1"
              autoFocus
            />
            <button
              className="btn-primary text-xs py-1 px-2"
              onClick={() => { onSaveName(item.address, name); setEditing(false); }}
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            className="text-left text-sm text-dark-200 hover:text-white flex items-center gap-2 group w-full truncate"
            onClick={() => setEditing(true)}
            title={c.rationale || ''}
          >
            <span className="truncate">{item.name || <span className="text-dark-500">senza nome</span>}</span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
          </button>
        )}
        {c.rationale && !editing && (
          <p className="text-[11px] text-dark-500 truncate" title={c.rationale}>{c.rationale}</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[10px] text-dark-500">{c.inferredDpt || item.data_type || '—'}</div>
        <ConfidenceBar value={c.confidence} />
      </div>

      <button
        onClick={() => onConfigure?.(item)}
        className="shrink-0 btn-secondary text-xs py-1 px-2"
        title={isMapped ? 'Modifica questo dispositivo' : 'Configura / assegna questo indirizzo'}
      >
        <Settings className="w-3 h-3 inline mr-1" />
        {isMapped ? 'Modifica' : 'Configura'}
      </button>
    </div>
  );
}

function Topology() {
  const { data: map, isLoading, error, refetch } = useTopologyMap();
  const scan = useTopologyScan();
  const classify = useClassify();
  const [configuring, setConfiguring] = useState(null);

  const handleSaveName = (address, name) => {
    classify.mutate([{ address, name, apply_name: true }]);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-primary-500 animate-spin" /></div>;
  }
  if (error) {
    return <div className="text-red-400 p-8">Errore nel caricamento della mappa.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Network className="w-6 h-6 text-primary-400" />
            Topology
          </h1>
          <p className="text-dark-400 max-w-2xl">
            Mappa dedotta dell'infrastruttura, costruita in modo <strong>passivo</strong>:
            interrogazioni di stato (GroupValueRead, che non comandano nulla) più l'analisi
            dello storico. Ruolo comando/stato e accoppiamenti sono ad alta affidabilità;
            la categoria di un carico on/off (luce vs presa) non è distinguibile da soli dati
            passivi — correggi pure i nomi qui sotto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scan.mutate({ spacingMs: 120, timeoutMs: 600 })}
            disabled={scan.isPending}
            className="btn-secondary flex items-center gap-2"
            title="Rilegge lo stato di tutti i GA noti (passivo, non attua nulla)"
          >
            {scan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Riscansiona
          </button>
        </div>
      </div>

      {map && (
        <div className="flex items-center gap-4 text-sm text-dark-400">
          <span><strong className="text-white">{map.total}</strong> group address</span>
          <span><strong className="text-emerald-400">{map.classified}</strong> classificati</span>
          {scan.data && (
            <span className="text-dark-500">
              ultimo scan: {scan.data.answered}/{scan.data.scanned} hanno risposto
            </span>
          )}
        </div>
      )}

      {map?.groups.map((g) => (
        <div key={g.key} className="card">
          <div className="p-4 border-b border-dark-700 flex items-center justify-between">
            <h2 className="font-semibold text-white">Main group {g.mainGroup}</h2>
            <span className="text-xs text-dark-400">{g.items.length} indirizzi</span>
          </div>
          <div className="divide-y divide-dark-700/50">
            {g.items
              .slice()
              .sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }))
              .map((item) => (
                <GaRow key={item.address} item={item} onSaveName={handleSaveName} onConfigure={setConfiguring} />
              ))}
          </div>
        </div>
      ))}

      <DeviceConfigModal
        device={configuring}
        isOpen={!!configuring}
        onClose={() => setConfiguring(null)}
      />
    </div>
  );
}

export default Topology;
