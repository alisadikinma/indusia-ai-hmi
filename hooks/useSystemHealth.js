/**
 * useSystemHealth Hook
 * Wrapper hook for SystemHealthContext
 */

import { useSystemHealthContext } from '@/context/SystemHealthContext';

export function useSystemHealth() {
  return useSystemHealthContext();
}

export default useSystemHealth;
