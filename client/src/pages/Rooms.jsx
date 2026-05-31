import { useState } from 'react';
import { useRooms, useDeleteRoom } from '../hooks/useDevices';
import RoomModal from '../components/RoomModal';
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
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';

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

function Rooms() {
  const { data: rooms = [], isLoading, error } = useRooms();
  const deleteRoom = useDeleteRoom();

  const [editingRoom, setEditingRoom] = useState(null);
  const [isAddingRoom, setIsAddingRoom] = useState(false);

  const handleDelete = async (room) => {
    if (room.id === 'default') {
      alert('Impossibile eliminare la stanza predefinita');
      return;
    }

    if (!confirm(`Eliminare la stanza "${room.name}"? I dispositivi passeranno a Non categorizzati.`)) {
      return;
    }

    try {
      await deleteRoom.mutateAsync(room.id);
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
          <p className="text-red-400">Caricamento stanze non riuscito</p>
        </div>
      </div>
    );
  }

  // Sort rooms by sort_order
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.id === 'default') return 1;
    if (b.id === 'default') return -1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Stanze</h1>
          <p className="text-dark-400">Organizza i tuoi dispositivi per stanza</p>
        </div>
        <button
          onClick={() => setIsAddingRoom(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Aggiungi stanza
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRooms.map(room => {
          const Icon = roomIconMap[room.icon] || Home;
          const isDefault = room.id === 'default';

          return (
            <div
              key={room.id}
              className={`card p-4 ${isDefault ? 'opacity-75' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-dark-700 rounded-xl">
                    <Icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {room.name}
                      {isDefault && (
                        <span className="ml-2 text-xs text-dark-400">(Sistema)</span>
                      )}
                    </h3>
                    <p className="text-sm text-dark-400">
                      {room.device_count || 0} dispositiv{room.device_count !== 1 ? 'i' : 'o'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!isDefault && (
                    <>
                      <button
                        onClick={() => setEditingRoom(room)}
                        className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(room)}
                        className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {room.sort_order > 0 && !isDefault && (
                <div className="mt-3 pt-3 border-t border-dark-700">
                  <p className="text-xs text-dark-500">
                    Ordine: {room.sort_order}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {rooms.length === 1 && rooms[0].id === 'default' && (
        <div className="card p-12 text-center">
          <Home className="w-16 h-16 text-dark-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Nessuna stanza personalizzata</h2>
          <p className="text-dark-400 mb-6 max-w-md mx-auto">
            Crea stanze per organizzare i tuoi dispositivi per posizione. I dispositivi senza stanza
            compariranno nella stanza predefinita "Non categorizzati".
          </p>
          <button
            onClick={() => setIsAddingRoom(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crea la prima stanza
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <RoomModal
        room={editingRoom}
        isOpen={isAddingRoom || !!editingRoom}
        onClose={() => {
          setIsAddingRoom(false);
          setEditingRoom(null);
        }}
      />
    </div>
  );
}

export default Rooms;
