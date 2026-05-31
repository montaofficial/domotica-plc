import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi, groupAddressesApi, controlApi } from '../api';

// Rooms hooks
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: roomsApi.getAll
  });
}

export function useRoom(id) {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: () => roomsApi.getById(id),
    enabled: !!id
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: roomsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => roomsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: roomsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });
}

// Group addresses hooks
export function useGroupAddresses(params = {}) {
  return useQuery({
    queryKey: ['groupAddresses', params],
    queryFn: () => groupAddressesApi.getAll(params)
  });
}

export function useConfiguredDevices() {
  return useQuery({
    queryKey: ['groupAddresses', 'configured'],
    queryFn: groupAddressesApi.getConfigured
  });
}

export function useDiscoveredAddresses() {
  return useQuery({
    queryKey: ['groupAddresses', 'discovered'],
    queryFn: groupAddressesApi.getDiscovered,
    // Updates are pushed over WebSocket (coalesced invalidation in App.jsx);
    // this slow interval is only a reconnect/missed-event safety net.
    refetchInterval: 30000
  });
}

export function useUpdateGroupAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => groupAddressesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
      // Configuring a device from anywhere (Dashboard, Topology, Discovery)
      // should keep the topology map in sync too.
      queryClient.invalidateQueries({ queryKey: ['topology'] });
    }
  });
}

export function useDeleteGroupAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupAddressesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
    }
  });
}

// Control hooks
export function useToggleDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlApi.toggle,
    onSuccess: () => {
      // Optimistically update will be handled via WebSocket
    }
  });
}

export function useControlDevice() {
  return useMutation({
    mutationFn: ({ address, value, dataType }) => controlApi.write(address, value, dataType)
  });
}

// Turn every controllable device in a room on or off, paced ~50ms apart so the
// bus isn't flooded (same spacing the Telegram bot uses for multi-writes).
export function useRoomBulkControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ devices, on }) => {
      const targets = devices.filter((d) => d.is_controllable !== 0 && d.address);
      let done = 0;
      for (const d of targets) {
        try {
          await (on ? controlApi.on(d.address) : controlApi.off(d.address));
          done++;
        } catch {
          // keep going; the others should still switch
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      return { done, total: targets.length, on };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupAddresses'] })
  });
}

export function useDeviceTypes() {
  return useQuery({
    queryKey: ['deviceTypes'],
    queryFn: groupAddressesApi.getTypes,
    staleTime: Infinity // Types don't change
  });
}
