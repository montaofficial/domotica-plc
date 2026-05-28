// Hooks for driving the Learn engine. The engine's *state* (idle / calibrating
// / learning, calibration progress, detection stream) is pushed over the
// WebSocket and lifted into App.jsx — those values arrive in <Discovery /> as
// props. What this file owns is the imperative side: REST mutations + a fall-
// back fetch of state used on first mount before the first WS message lands.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learnApi } from '../api';

export function useLearnState() {
  return useQuery({
    queryKey: ['learn', 'state'],
    queryFn: learnApi.state,
    staleTime: 30_000
  });
}

export function useLearnProfile() {
  return useQuery({
    queryKey: ['learn', 'profile'],
    queryFn: learnApi.profile,
    refetchInterval: 5_000
  });
}

function useInvalidatingMutation(mutationFn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learn'] });
    }
  });
}

export function useStartBaseline() { return useInvalidatingMutation((ms) => learnApi.startBaseline(ms)); }
export function useExtendBaseline() { return useInvalidatingMutation((ms) => learnApi.extendBaseline(ms)); }
export function useStopBaseline() { return useInvalidatingMutation(() => learnApi.stopBaseline()); }
export function useResetBaseline() { return useInvalidatingMutation(() => learnApi.resetBaseline()); }
export function useExcludeFromNoise() { return useInvalidatingMutation((dst) => learnApi.excludeFromNoise(dst)); }
export function useStartLearning() { return useInvalidatingMutation((threshold) => learnApi.startLearning(threshold)); }
export function useSetThreshold() { return useInvalidatingMutation((threshold) => learnApi.setThreshold(threshold)); }
export function useStopLearning() { return useInvalidatingMutation(() => learnApi.stopLearning()); }
