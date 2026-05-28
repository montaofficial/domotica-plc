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
    refetchInterval: 5000 // Refresh every 5 seconds
  });
}

export function useUpdateGroupAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => groupAddressesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
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

export function useDeviceTypes() {
  return useQuery({
    queryKey: ['deviceTypes'],
    queryFn: groupAddressesApi.getTypes,
    staleTime: Infinity // Types don't change
  });
}
