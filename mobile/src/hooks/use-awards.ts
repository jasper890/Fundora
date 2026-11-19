import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { awardDetailSchema, awardsSchema } from '@/lib/api/schemas';

export function useAwards() {
  return useQuery({ queryKey: ['awards'], queryFn: () => api('/api/v1/awards', awardsSchema) });
}

export function useAward(id: string) {
  return useQuery({ queryKey: ['award', id], queryFn: () => api(`/api/v1/awards/${id}`, awardDetailSchema) });
}
