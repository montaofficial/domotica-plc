import { useState, useEffect } from 'react';
import { useRooms, useUpdateGroupAddress } from '../hooks/useDevices';
import Modal from './Modal';
import {
  Lightbulb,
  Power,
  Fan,
  DoorOpen,
  Blinds,
  Activity,
  Thermometer,
  CircleDot
} from 'lucide-react';

const deviceTypes = [
  { value: 'light', label: 'Light', icon: Lightbulb },
  { value: 'switch', label: 'Switch', icon: Power },
  { value: 'fan', label: 'Fan', icon: Fan },
  { value: 'door', label: 'Door', icon: DoorOpen },
  { value: 'blind', label: 'Blind/Shutter', icon: Blinds },
  { value: 'sensor', label: 'Sensor', icon: Activity },
  { value: 'thermostat', label: 'Thermostat', icon: Thermometer },
  { value: 'other', label: 'Other', icon: CircleDot }
];

function DeviceConfigModal({ device, isOpen, onClose }) {
  const { data: rooms = [] } = useRooms();
  const updateDevice = useUpdateGroupAddress();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    device_type: 'switch',
    room_id: '',
    is_controllable: true
  });

  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name || '',
        description: device.description || '',
        device_type: device.device_type || 'switch',
        room_id: device.room_id || '',
        is_controllable: device.is_controllable !== 0
      });
    }
  }, [device]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await updateDevice.mutateAsync({
        id: device.id,
        data: {
          ...formData,
          room_id: formData.room_id || null
        }
      });
      onClose();
    } catch (error) {
      console.error('Failed to update device:', error);
    }
  };

  if (!device) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Device">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address (read-only) */}
        <div>
          <label className="label">KNX Address</label>
          <input
            type="text"
            value={device.address}
            disabled
            className="input bg-dark-900 text-dark-400"
          />
        </div>

        {/* Name */}
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Living Room Light"
            className="input"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Additional notes about this device"
            className="input"
            rows={2}
          />
        </div>

        {/* Device Type */}
        <div>
          <label className="label">Device Type</label>
          <div className="grid grid-cols-4 gap-2">
            {deviceTypes.map(type => {
              const Icon = type.icon;
              const isSelected = formData.device_type === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, device_type: type.value }))}
                  className={`
                    p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all
                    ${isSelected
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-dark-600 hover:border-dark-500 text-dark-400'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Room */}
        <div>
          <label className="label">Room</label>
          <select
            value={formData.room_id}
            onChange={e => setFormData(prev => ({ ...prev, room_id: e.target.value }))}
            className="select"
          >
            <option value="">No room assigned</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        {/* Controllable */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_controllable}
              onChange={e => setFormData(prev => ({ ...prev, is_controllable: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
          </label>
          <span className="text-sm text-dark-300">
            Allow control from dashboard
          </span>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateDevice.isPending}
            className="btn-primary"
          >
            {updateDevice.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default DeviceConfigModal;
