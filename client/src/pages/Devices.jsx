import { useState } from 'react';
import { useGroupAddresses, useRooms, useDeleteGroupAddress } from '../hooks/useDevices';
import DeviceConfigModal from '../components/DeviceConfigModal';
import AddDeviceModal from '../components/AddDeviceModal';
import {
  Lightbulb,
  Power,
  Fan,
  DoorOpen,
  Blinds,
  Activity,
  Thermometer,
  CircleDot,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Search,
  Filter,
  Plus
} from 'lucide-react';

const iconMap = {
  light: Lightbulb,
  switch: Power,
  fan: Fan,
  door: DoorOpen,
  blind: Blinds,
  sensor: Activity,
  thermostat: Thermometer,
  other: CircleDot
};

function Devices() {
  const { data: devices = [], isLoading, error } = useGroupAddresses();
  const { data: rooms = [] } = useRooms();
  const deleteDevice = useDeleteGroupAddress();

  const [editingDevice, setEditingDevice] = useState(null);
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');

  // Filter devices
  const filteredDevices = devices.filter(device => {
    // Configured devices only (have a name)
    if (!device.name) return false;

    const matchesSearch =
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || device.device_type === typeFilter;
    const matchesRoom = roomFilter === 'all' || device.room_id === roomFilter;

    return matchesSearch && matchesType && matchesRoom;
  });

  const handleDelete = async (device) => {
    if (!confirm(`Delete "${device.name || device.address}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDevice.mutateAsync(device.id);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

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
        </div>
      </div>
    );
  }

  const deviceTypes = [...new Set(devices.filter(d => d.name).map(d => d.device_type))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Devices</h1>
          <p className="text-dark-400">Manage your configured KNX devices</p>
        </div>
        <button
          onClick={() => setIsAddingDevice(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search devices..."
                className="input pl-10"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-dark-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="select w-40"
            >
              <option value="all">All Types</option>
              {deviceTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <select
              value={roomFilter}
              onChange={e => setRoomFilter(e.target.value)}
              className="select w-40"
            >
              <option value="all">All Rooms</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-dark-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-dark-400">
                    {searchQuery || typeFilter !== 'all' || roomFilter !== 'all'
                      ? 'No devices match your filters'
                      : 'No configured devices yet. Add a device manually or configure discovered devices.'}
                  </td>
                </tr>
              ) : (
                filteredDevices.map(device => {
                  const Icon = iconMap[device.device_type] || CircleDot;
                  const isOn = device.current_value === 'true' || device.current_value === '1';
                  const room = rooms.find(r => r.id === device.room_id);

                  return (
                    <tr key={device.id} className="hover:bg-dark-700/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-dark-700 rounded-lg">
                            <Icon className="w-4 h-4 text-primary-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{device.name}</p>
                            {device.description && (
                              <p className="text-xs text-dark-400 truncate max-w-[200px]">
                                {device.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-sm text-dark-300 bg-dark-700 px-2 py-1 rounded">
                          {device.address}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-dark-300 capitalize">
                          {device.device_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-dark-300">
                          {room?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`
                          inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                          ${isOn
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-dark-700 text-dark-400'
                          }
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-green-400' : 'bg-dark-500'}`} />
                          {isOn ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingDevice(device)}
                            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(device)}
                            className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <DeviceConfigModal
        device={editingDevice}
        isOpen={!!editingDevice}
        onClose={() => setEditingDevice(null)}
      />

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddingDevice}
        onClose={() => setIsAddingDevice(false)}
      />
    </div>
  );
}

export default Devices;
