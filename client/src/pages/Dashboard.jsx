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
          <p className="text-red-400">Caricamento dispositivi fallito</p>
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
          <p className="text-dark-400">Controlla i dispositivi</p>
        </div>

        <div className="card p-12 text-center">
          <Radio className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Nessun dispositivo configurato</h2>
          <p className="text-dark-400 mb-6 max-w-md mx-auto">
            I dispositivi vengono scoperti automaticamente quando inviano telegrammi sul bus KNX.
            Vai alla pagina Discovery per configurarli.
          </p>
          <Link to="/discovery" className="btn-primary inline-flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Vai a Discovery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1 sm:mb-2">Dashboard</h1>
            <p className="text-dark-400 text-sm">
              {editMode
                ? 'Modalità modifica: tocca un dispositivo per riconfigurarlo.'
                : 'Controlla i dispositivi'}
            </p>
          </div>
          {/* Edit toggle stays next to the title on mobile */}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={`shrink-0 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors sm:order-2 ${
              editMode
                ? 'bg-primary-600 border-primary-500 text-white'
                : 'bg-dark-700 border-dark-600 text-dark-300 hover:text-white'
            }`}
            title="Attiva/disattiva la modifica dei dispositivi"
          >
            {editMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {editMode ? 'Fine' : 'Modifica'}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 text-sm sm:order-1">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{totalDevices}</p>
            <p className="text-dark-400">Dispositivi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{onDevices}</p>
            <p className="text-dark-400">Accese</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-dark-400">{totalDevices - onDevices}</p>
            <p className="text-dark-400">Spente</p>
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
