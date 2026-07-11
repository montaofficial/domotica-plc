import { useState, useEffect } from 'react';
import { useRooms, useUpdateGroupAddress } from '../hooks/useDevices';
import { useToast } from './Toast';
import Modal from './Modal';
import {
  Lightbulb,
  Power,
  Zap,
  Fan,
  DoorOpen,
  Blinds,
  Activity,
  Thermometer,
  CircleDot
} from 'lucide-react';

const deviceTypes = [
  { value: 'light', label: 'Luce', icon: Lightbulb },
  { value: 'switch', label: 'Interruttore', icon: Power },
  { value: 'pulse', label: 'Pulsante', icon: Zap },
  { value: 'fan', label: 'Ventola', icon: Fan },
  { value: 'door', label: 'Porta', icon: DoorOpen },
  { value: 'blind', label: 'Tapparella', icon: Blinds },
  { value: 'sensor', label: 'Sensore', icon: Activity },
  { value: 'thermostat', label: 'Termostato', icon: Thermometer },
  { value: 'other', label: 'Altro', icon: CircleDot }
];

const ADDRESS_RE = /^\d{1,2}\/\d{1,2}\/\d{1,3}$/;

function DeviceConfigModal({ device, isOpen, onClose }) {
  const { data: rooms = [] } = useRooms();
  const updateDevice = useUpdateGroupAddress();
  const toast = useToast();

  const [formData, setFormData] = useState({
    address: '',
    name: '',
    description: '',
    device_type: 'switch',
    room_id: '',
    is_controllable: true
  });
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (device) {
      setFormData({
        address: device.address || '',
        name: device.name || '',
        description: device.description || '',
        device_type: device.device_type || 'switch',
        room_id: device.room_id || '',
        is_controllable: device.is_controllable !== 0
      });
      setAddressError('');
    }
  }, [device]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const address = formData.address.trim();
    if (!ADDRESS_RE.test(address)) {
      setAddressError('Formato indirizzo non valido. Usa main/middle/sub, es. 1/2/3');
      return;
    }

    try {
      await updateDevice.mutateAsync({
        id: device.id,
        data: {
          ...formData,
          address,
          room_id: formData.room_id || null
        }
      });
      toast('Dispositivo salvato', 'success');
      onClose();
    } catch (error) {
      // Mutation errors already surface a toast globally; keep the modal open.
      console.error('Salvataggio fallito:', error);
    }
  };

  if (!device) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configura dispositivo">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address (editable) */}
        <div>
          <label className="label">Indirizzo KNX</label>
          <input
            type="text"
            value={formData.address}
            onChange={e => { setFormData(prev => ({ ...prev, address: e.target.value })); setAddressError(''); }}
            placeholder="es. 1/2/3"
            className={`input ${addressError ? 'border-red-500' : ''}`}
          />
          {addressError
            ? <p className="text-xs text-red-400 mt-1">{addressError}</p>
            : <p className="text-xs text-dark-400 mt-1">Cambiarlo rimappa il dispositivo su un altro indirizzo del bus.</p>}
        </div>

        {/* Name */}
        <div>
          <label className="label">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="es. Luce salotto"
            className="input"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="label">Descrizione (opzionale)</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Note aggiuntive sul dispositivo"
            className="input"
            rows={2}
          />
        </div>

        {/* Device Type */}
        <div>
          <label className="label">Tipo dispositivo</label>
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
          <label className="label">Stanza</label>
          <select
            value={formData.room_id}
            onChange={e => setFormData(prev => ({ ...prev, room_id: e.target.value }))}
            className="select"
          >
            <option value="">Nessuna stanza</option>
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
            Controllabile dalla dashboard
          </span>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={updateDevice.isPending}
            className="btn-primary"
          >
            {updateDevice.isPending ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default DeviceConfigModal;
