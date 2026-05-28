import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRooms } from '../hooks/useDevices';
import { groupAddressesApi } from '../api';
import Modal from './Modal';
import {
  Lightbulb,
  Power,
  Fan,
  DoorOpen,
  Blinds,
  Activity,
  Thermometer,
  CircleDot,
  AlertCircle
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

const dataTypes = [
  { value: 'DPT1', label: 'DPT1 - Switch (On/Off)' },
  { value: 'DPT1.001', label: 'DPT1.001 - Switch' },
  { value: 'DPT1.008', label: 'DPT1.008 - Up/Down' },
  { value: 'DPT1.009', label: 'DPT1.009 - Open/Close' },
  { value: 'DPT5', label: 'DPT5 - Percentage (0-100%)' },
  { value: 'DPT9', label: 'DPT9 - Temperature' }
];

function AddDeviceModal({ isOpen, onClose }) {
  const { data: rooms = [] } = useRooms();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    address: '',
    name: '',
    description: '',
    device_type: 'switch',
    data_type: 'DPT1',
    room_id: '',
    is_controllable: true
  });
  const [error, setError] = useState('');

  const createDevice = useMutation({
    mutationFn: groupAddressesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      if (err.message.includes('already exists')) {
        setError('A device with this address already exists');
      } else {
        setError(err.message);
      }
    }
  });

  const resetForm = () => {
    setFormData({
      address: '',
      name: '',
      description: '',
      device_type: 'switch',
      data_type: 'DPT1',
      room_id: '',
      is_controllable: true
    });
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate address format
    const addressRegex = /^\d{1,2}\/\d{1,2}\/\d{1,3}$/;
    if (!addressRegex.test(formData.address)) {
      setError('Invalid KNX address format. Use format like 1/2/3');
      return;
    }

    createDevice.mutate({
      ...formData,
      room_id: formData.room_id || null
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Device Manually" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* KNX Address */}
        <div>
          <label className="label">KNX Group Address *</label>
          <input
            type="text"
            value={formData.address}
            onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="e.g., 1/2/3"
            className="input"
            required
            autoFocus
          />
          <p className="text-xs text-dark-400 mt-1">
            Format: main/middle/sub (e.g., 3/0/1)
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="label">Device Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Living Room Light"
            className="input"
            required
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

        {/* Data Type */}
        <div>
          <label className="label">Data Type (DPT)</label>
          <select
            value={formData.data_type}
            onChange={e => setFormData(prev => ({ ...prev, data_type: e.target.value }))}
            className="select"
          >
            {dataTypes.map(dt => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
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
            onClick={handleClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createDevice.isPending || !formData.address || !formData.name}
            className="btn-primary"
          >
            {createDevice.isPending ? 'Adding...' : 'Add Device'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default AddDeviceModal;
