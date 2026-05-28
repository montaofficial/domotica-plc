import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRooms, useConfiguredDevices } from '../hooks/useDevices';
import RoomSection from '../components/RoomSection';
import DeviceConfigModal from '../components/DeviceConfigModal';
import { Radio, Loader2, AlertCircle, Pencil, Check } from 'lucide-react';

function Dashboard() {
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRooms();
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useConfiguredDevices();
  const [editMode, setEditMode] = useState(false);
  const [configuringDevice, setConfiguringDevice] = useState(null);

  // Group devices by room
  const devicesByRoom = useMemo(() => {
    const grouped = {};

    rooms.forEach(room => {
      grouped[room.id] = [];
    });

    devices.forEach(device => {
      const roomId = device.room_id || 'default';
      if (!grouped[roomId]) {
        grouped[roomId] = [];
      }
      grouped[roomId].push(device);
    });

    return grouped;
  }, [rooms, devices]);

  // Sort rooms and filter out empty ones (except default)
  const sortedRooms = useMemo(() => {
    return rooms
      .filter(room => devicesByRoom[room.id]?.length > 0 || room.id === 'default')
      .sort((a, b) => {
        // Default room always last
        if (a.id === 'default') return 1;
        if (b.id === 'default') return -1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
  }, [rooms, devicesByRoom]);

  const isLoading = roomsLoading || devicesLoading;
  const error = roomsError || devicesError;

  // Stats
  const totalDevices = devices.length;
  const onDevices = devices.filter(d =>
    d.current_value === 'true' || d.current_value === '1'
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Failed to load devices</p>
          <p className="text-sm text-dark-400 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-dark-400">Control your smart home devices</p>
        </div>

        <div className="card p-12 text-center">
          <Radio className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Configured Devices</h2>
          <p className="text-dark-400 mb-6 max-w-md mx-auto">
            Devices are automatically discovered when they send telegrams on the KNX bus.
            Go to the Discovery page to configure discovered devices.
          </p>
          <Link to="/discovery" className="btn-primary inline-flex items-center gap-2">
            <Radio className="w-4 h-4" />
            View Discovery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-dark-400">
            {editMode
              ? 'Modalità modifica: tocca un dispositivo per riconfigurarlo.'
              : 'Control your smart home devices'}
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Edit-mode toggle: off by default, so cards act as controls. */}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              editMode
                ? 'bg-primary-600 border-primary-500 text-white'
                : 'bg-dark-700 border-dark-600 text-dark-300 hover:text-white'
            }`}
            title="Attiva/disattiva la modifica dei dispositivi"
          >
            {editMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {editMode ? 'Fine' : 'Modifica'}
          </button>

          {/* Quick Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{totalDevices}</p>
              <p className="text-dark-400">Devices</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{onDevices}</p>
              <p className="text-dark-400">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-dark-400">{totalDevices - onDevices}</p>
              <p className="text-dark-400">Off</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div className="space-y-4">
        {sortedRooms.map(room => (
          <RoomSection
            key={room.id}
            room={room}
            devices={devicesByRoom[room.id] || []}
            defaultExpanded={room.id !== 'default' || sortedRooms.length === 1}
            editMode={editMode}
            onEdit={setConfiguringDevice}
          />
        ))}
      </div>

      <DeviceConfigModal
        device={configuringDevice}
        isOpen={!!configuringDevice}
        onClose={() => setConfiguringDevice(null)}
      />
    </div>
  );
}

export default Dashboard;
