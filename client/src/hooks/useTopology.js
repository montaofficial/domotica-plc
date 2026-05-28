import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { topologyApi } from '../api';

export function useTopologyMap() {
  return useQuery({
    queryKey: ['topology', 'map'],
    queryFn: topologyApi.map
  });
}

export function useTopologyScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts) => topologyApi.scan(opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topology'] })
  });
}

export function useClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items) => topologyApi.classify(items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['topology'] });
      qc.invalidateQueries({ queryKey: ['groupAddresses'] });
    }
  });
}
