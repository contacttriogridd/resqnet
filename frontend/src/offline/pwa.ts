import { META, getMeta, setMeta } from '../database/db';
import { createStore } from '../utils/store';

/** PWA install / update state, exposed to the UI. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  canInstall: boolean;
  installDismissed: boolean;
  installed: boolean;
  updateAvailable: boolean;
  offlineReady: boolean;
}

export const pwaStore = createStore<PwaState>({
  canInstall: false,
  installDismissed: false,
  installed: false,
  updateAvailable: false,
  offlineReady: false,
});

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

const DISMISS_FOR_MS = 14 * 86_400_000;

export async function initPwa() {
  const dismissedAt = await getMeta<number>(META.installDismissedAt);
  const installed = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  pwaStore.set((s) => ({
    ...s,
    installed,
    installDismissed: !!dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS,
  }));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    pwaStore.set((s) => ({ ...s, canInstall: true }));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    pwaStore.set((s) => ({ ...s, canInstall: false, installed: true }));
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => pwaStore.set((s) => ({ ...s, updateAvailable: true })),
      onOfflineReady: () => pwaStore.set((s) => ({ ...s, offlineReady: true })),
    });
  }
}

export async function promptInstall() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  pwaStore.set((s) => ({ ...s, canInstall: false, installed: outcome === 'accepted' }));
}

export async function dismissInstall() {
  await setMeta(META.installDismissedAt, Date.now());
  pwaStore.set((s) => ({ ...s, installDismissed: true }));
}

export async function updateApp() {
  await applyUpdate?.(true);
}
