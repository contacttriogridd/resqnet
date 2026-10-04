import { useSyncExternalStore } from 'react';
import { networkStore } from '../offline/network';
import { sessionStore } from '../services/session';
import { syncStore } from '../sync/syncManager';
import type { Store } from '../utils/store';

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const useNetwork = () => useStore(networkStore);
export const useSyncState = () => useStore(syncStore);
export const useSession = () => useStore(sessionStore);
