// Service Worker registration & PWA install prompt handler

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      navigator.serviceWorker
        .register(swUrl, { scope: import.meta.env.BASE_URL })
        .then((reg) => {
          console.log('FluentPath ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('FluentPath ServiceWorker registration failed:', err);
        });
    });

    // Android Chrome等でPWAインストールプロンプトをキャプチャ
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e as unknown as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });
  }
}

export function promptPwaInstall(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deferredInstallPrompt) {
      resolve(false);
      return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        deferredInstallPrompt = null;
        resolve(true);
      } else {
        console.log('User dismissed the PWA install prompt');
        resolve(false);
      }
    });
  });
}

export function isPwaInstallable(): boolean {
  return !!deferredInstallPrompt;
}
