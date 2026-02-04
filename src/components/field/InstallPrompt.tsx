'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Listen for install prompt (Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      setShowPrompt(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShowPrompt(false);
      }
    }
  }

  function handleDismiss() {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShowPrompt(false);
  }

  if (!showPrompt) return null;

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-zinc-800 border border-zinc-700 rounded-lg p-4 shadow-lg z-40">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-zinc-400"
        aria-label="Dismiss"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="flex items-start gap-3">
        <svg
          className="w-6 h-6 text-amber-500 mt-0.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        <div>
          <p className="font-medium">Install Stone Henge Field</p>
          {isIOS ? (
            <p className="text-sm text-zinc-400 mt-1">
              Tap the share button, then &quot;Add to Home Screen&quot;
            </p>
          ) : (
            <button
              onClick={handleInstall}
              className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm"
            >
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
