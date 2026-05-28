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
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import DeviceCard from './DeviceCard';

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

function RoomSection({ room, devices, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const RoomIcon = roomIconMap[room.icon] || Home;

  const onCount = devices.filter(d =>
    d.current_value === 'true' || d.current_value === '1'
  ).length;

  return (
    <div className="card">
      {/* Room Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-dark-700 rounded-lg">
            <RoomIcon className="w-5 h-5 text-primary-400" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold text-white">{room.name}</h2>
            <p className="text-xs text-dark-400">
              {devices.length} device{devices.length !== 1 ? 's' : ''}
              {onCount > 0 && (
                <span className="text-green-400"> ({onCount} on)</span>
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-dark-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-dark-400" />
        )}
      </button>

      {/* Devices Grid */}
      {expanded && devices.length > 0 && (
        <div className="p-4 pt-0 border-t border-dark-700">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-4">
            {devices.map(device => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      {expanded && devices.length === 0 && (
        <div className="p-8 text-center text-dark-400 border-t border-dark-700">
          No devices in this room
        </div>
      )}
    </div>
  );
}

export default RoomSection;
