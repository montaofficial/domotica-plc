import {
  Home,
  Sofa,
  Bed,
  UtensilsCrossed,
  Bath,
  Briefcase,
  Warehouse,
  Trees,
  DoorOpen,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Power,
  Loader2
} from 'lucide-react';
import { useState } from 'react';
import DeviceCard from './DeviceCard';
import { useRoomBulkControl } from '../hooks/useDevices';
import { useToast } from './Toast';

const roomIconMap = {
  home: Home,
  sofa: Sofa,
  bed: Bed,
  utensils: UtensilsCrossed,
  bath: Bath,
  briefcase: Briefcase,
  warehouse: Warehouse,
  trees: Trees,
  'door-open': DoorOpen,
  stairs: ArrowUpDown
};

function RoomSection({ room, devices, defaultExpanded = true, editMode = false, onEdit }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const RoomIcon = roomIconMap[room.icon] || Home;
  const bulk = useRoomBulkControl();
  const toast = useToast();

  // Pulse devices have no on/off state: they don't count as "accese" and the
  // room-level bulk ON/OFF must never fire impulses at them.
  const onCount = devices.filter(d =>
    d.device_type !== 'pulse' &&
    (d.current_value === 'true' || d.current_value === '1')
  ).length;
  const controllable = devices.filter(d => d.is_controllable !== 0 && d.address && d.device_type !== 'pulse');

  const runBulk = (on) => {
    bulk.mutate(
      { devices, on },
      {
        onSuccess: (res) => toast(
          `${room.name}: ${res.done} ${res.done === 1 ? 'luce' : 'luci'} ${on ? 'accese' : 'spente'}`,
          'success'
        )
      }
    );
  };

  return (
    <div className="card">
      {/* Room Header */}
      <div className="w-full flex items-center justify-between p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-90 transition-opacity"
        >
          <div className={`p-2 rounded-lg shrink-0 border transition-colors ${onCount > 0 ? 'bg-amber-400/10 border-amber-400/25' : 'bg-dark-700/80 border-dark-600/60'}`}>
            <RoomIcon className={`w-5 h-5 ${onCount > 0 ? 'text-amber-300' : 'text-primary-400'}`} />
          </div>
          <div className="text-left min-w-0">
            <h2 className="font-display font-semibold text-white truncate" title={room.name}>{room.name}</h2>
            <p className="text-xs text-dark-400 truncate">
              {devices.length} {devices.length === 1 ? 'dispositivo' : 'dispositivi'}
              {onCount > 0 && (
                <span className="text-amber-300"> · {onCount} {onCount === 1 ? 'accesa' : 'accese'}</span>
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Per-room bulk ON/OFF (hidden in edit mode) */}
          {!editMode && controllable.length > 0 && (
            <div className="flex items-center gap-1">
              {bulk.isPending && <Loader2 className="w-4 h-4 text-dark-400 animate-spin" />}
              <button
                onClick={() => runBulk(true)}
                disabled={bulk.isPending}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-dark-600 text-dark-300 hover:text-amber-300 hover:border-amber-400/40 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                title={`Accendi tutte le luci di ${room.name}`}
              >
                <Power className="w-3 h-3 inline mr-1" />ON
              </button>
              <button
                onClick={() => runBulk(false)}
                disabled={bulk.isPending}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-dark-600 text-dark-300 hover:text-dark-100 hover:border-dark-400 hover:bg-dark-700 transition-colors disabled:opacity-50"
                title={`Spegni tutte le luci di ${room.name}`}
              >
                <Power className="w-3 h-3 inline mr-1" />OFF
              </button>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-dark-400 hover:text-white"
            aria-label={expanded ? 'Comprimi' : 'Espandi'}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      {expanded && devices.length > 0 && (
        <div className="p-4 pt-0 border-t border-dark-700">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-4">
            {devices.map(device => (
              <DeviceCard key={device.id} device={device} editMode={editMode} onEdit={onEdit} />
            ))}
          </div>
        </div>
      )}

      {expanded && devices.length === 0 && (
        <div className="p-8 text-center text-dark-400 border-t border-dark-700">
          Nessun dispositivo in questa stanza
        </div>
      )}
    </div>
  );
}

export default RoomSection;
