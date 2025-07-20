import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    console.log('PWA: Initializing...');
    
    // Check if app is installed (running in standalone mode)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            window.matchMedia('(display-mode: fullscreen)').matches ||
                            window.matchMedia('(display-mode: minimal-ui)').matches;
    setIsStandalone(isStandaloneMode);
    console.log('PWA: Standalone mode:', isStandaloneMode);

    // Check if user has recently dismissed the install prompt
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const dismissedDate = parseInt(dismissedTime);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      // If dismissed less than 24 hours ago, don't show the prompt
      if (now - dismissedDate < oneDay) {
        console.log('PWA: Install prompt recently dismissed, not showing');
        return;
      } else {
        // Clear old dismissal
        localStorage.removeItem('pwa-install-dismissed');
        console.log('PWA: Cleared old dismissal');
      }
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('PWA: App installed event fired');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      // Clear any dismissal when app is installed
      localStorage.removeItem('pwa-install-dismissed');
    };

    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if already installed
    if (isStandaloneMode) {
      console.log('PWA: App already installed (standalone mode detected)');
      setIsInstalled(true);
      setIsInstallable(false);
    } else {
      console.log('PWA: App not installed (running in browser mode)');
      setIsInstalled(false);
    }

    // Check if PWA is installable (for debugging)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        console.log('PWA: Service Worker registration:', registration);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async () => {
    console.log('PWA: installApp called, deferredPrompt:', !!deferredPrompt);
    
    if (!deferredPrompt) {
      console.log('PWA: No install prompt available');
      return false;
    }

    try {
      console.log('PWA: Showing install prompt...');
      // Show the install prompt
      await deferredPrompt.prompt();
      
      console.log('PWA: Waiting for user choice...');
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('PWA: User choice outcome:', outcome);
      
      if (outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        // Clear any dismissal when app is installed
        localStorage.removeItem('pwa-install-dismissed');
        return true;
      } else {
        console.log('PWA: User dismissed the install prompt');
        // Store dismissal for 24 hours
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        setIsInstallable(false);
        setDeferredPrompt(null);
        return false;
      }
    } catch (error) {
      console.error('PWA: Error installing app:', error);
      return false;
    }
  };

  const checkForUpdate = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          return true;
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
    return false;
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  };

  const resetPWAState = () => {
    console.log('PWA: Resetting state for testing');
    localStorage.removeItem('pwa-install-dismissed');
    setIsInstalled(false);
    setIsInstallable(false);
    setDeferredPrompt(null);
  };

  const registerBackgroundSync = async () => {
    if ('serviceWorker' in navigator && 'sync' in (window.ServiceWorkerRegistration.prototype as any)) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await (registration as any).sync.register('background-sync');
          console.log('PWA: Background sync registered');
          return true;
        }
      } catch (error) {
        console.error('PWA: Failed to register background sync:', error);
      }
    }
    return false;
  };

  const storeOfflineData = async (key: string, data: any) => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      await store.put({ key, value: data, timestamp: Date.now() });
      console.log('PWA: Stored offline data:', key);
    } catch (error) {
      console.error('PWA: Failed to store offline data:', error);
    }
  };

  const getOfflineData = async (key: string) => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const result = await store.get(key);
      return result ? (result as any).value : null;
    } catch (error) {
      console.error('PWA: Failed to get offline data:', error);
      return null;
    }
  };

  const openIndexedDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('FinanceTrackerDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('offlineData')) {
          db.createObjectStore('offlineData', { keyPath: 'key' });
        }
      };
    });
  };

  return {
    isInstallable,
    isInstalled,
    isOnline,
    isStandalone,
    installApp,
    checkForUpdate,
    requestNotificationPermission,
    showNotification,
    resetPWAState,
    registerBackgroundSync,
    storeOfflineData,
    getOfflineData
  };
}; 