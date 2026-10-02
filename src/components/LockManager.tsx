'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function LockManager() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let appListener: any;
    
    const initAppListener = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { App } = await import('@capacitor/app');
          
          appListener = await App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock === 'true' && pathname !== '/') {
                // Instantly lock by going to calculator
                router.replace('/');
              } else if (quickLock !== 'true' && pathname !== '/') {
                // If off, we could record the time it went to background
                localStorage.setItem('squirrel_background_time', Date.now().toString());
              }
            } else {
              // App came back to foreground
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock !== 'true' && pathname !== '/') {
                const bgTimeStr = localStorage.getItem('squirrel_background_time');
                if (bgTimeStr) {
                  const bgTime = parseInt(bgTimeStr, 10);
                  const now = Date.now();
                  // 3 minutes timeout if quick lock is off
                  if (now - bgTime > 3 * 60 * 1000) {
                    router.replace('/');
                  }
                  localStorage.removeItem('squirrel_background_time');
                }
              }
            }
          });
        } else {
          // Web fallback
          const handleVisibilityChange = () => {
            if (document.hidden) {
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock === 'true' && window.location.pathname !== '/') {
                window.location.replace('/');
              } else if (quickLock !== 'true' && window.location.pathname !== '/') {
                localStorage.setItem('squirrel_background_time', Date.now().toString());
              }
            } else {
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock !== 'true' && window.location.pathname !== '/') {
                const bgTimeStr = localStorage.getItem('squirrel_background_time');
                if (bgTimeStr) {
                  const bgTime = parseInt(bgTimeStr, 10);
                  const now = Date.now();
                  if (now - bgTime > 3 * 60 * 1000) {
                    window.location.replace('/');
                  }
                  localStorage.removeItem('squirrel_background_time');
                }
              }
            }
          };
          document.addEventListener('visibilitychange', handleVisibilityChange);
          appListener = { remove: () => document.removeEventListener('visibilitychange', handleVisibilityChange) };
        }
      } catch (e) {
        console.error('LockManager Error:', e);
      }
    };
    
    initAppListener();

    return () => {
      if (appListener) {
        appListener.remove();
      }
    };
  }, [router, pathname]);

  return null;
}
