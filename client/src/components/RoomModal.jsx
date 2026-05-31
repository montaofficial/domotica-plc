import { useState, useEffect } from 'react';
import { useCreateRoom, useUpdateRoom } from '../hooks/useDevices';
import Modal from './Modal';
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
  ArrowUpDown
} from 'lucide-react';

const roomIcons = [
  { value: 'home', label: 'Casa', icon: Home },
  { value: 'sofa', label: 'Salotto', icon: Sofa },
  { value: 'bed', label: 'Camera', icon: Bed },
  { value: 'utensils', label: 'Cucina', icon: UtensilsCrossed },
  { value: 'bath', label: 'Bagno', icon: Bath },
  { value: 'briefcase', label: 'Ufficio', icon: Briefcase },
  { value: 'warehouse', label: 'Garage', icon: Warehouse },
  { value: 'trees', label: 'Giardino', icon: Trees },
  { value: 'door-open', label: 'Corridoio', icon: DoorOpen },
  { value: 'stairs', label: 'Scale', icon: ArrowUpDown }
];

function RoomModal({ room, isOpen, onClose }) {
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const isEditing = !!room;

  const [formData, setFormData] = useState({
    name: '',
    icon: 'home',
    sort_order: 0
  });

  useEffect(() => {
    if (room) {
      setFormData({
        name: room.name || '',
        icon: room.icon || 'home',
        sort_order: room.sort_order || 0
      });
    } else {
      setFormData({
        name: '',
        icon: 'home',
        sort_order: 0
      });
    }
  }, [room]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isEditing) {
        await updateRoom.mutateAsync({
          id: room.id,
          data: formData
        });
      } else {
        await createRoom.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save room:', error);
    }
  };

  const isPending = createRoom.isPending || updateRoom.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifica stanza' : 'Aggiungi stanza'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="label">Nome stanza</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="es. Salotto"
            className="input"
            required
            autoFocus
          />
        </div>

        {/* Icon */}
        <div>
          <label className="label">Icona</label>
          <div className="grid grid-cols-5 gap-2">
            {roomIcons.map(({ value, label, icon: Icon }) => {
              const isSelected = formData.icon === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon: value }))}
                  className={`
                    p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all
                    ${isSelected
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-dark-600 hover:border-dark-500 text-dark-400'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Order */}
        <div>
          <label className="label">Ordine</label>
          <input
            type="number"
            value={formData.sort_order}
            onChange={e => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
            className="input"
            min={0}
          />
          <p className="text-xs text-dark-400 mt-1">
I numeri più bassi compaiono per primi
          </p>
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
            disabled={isPending || !formData.name.trim()}
            className="btn-primary"
          >
            {isPending ? 'Salvataggio…' : isEditing ? 'Salva' : 'Aggiungi stanza'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RoomModal;
