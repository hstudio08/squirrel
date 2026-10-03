'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Calculator from './Calculator';

export default function LockManager() {
  const [isLocked, setIsLocked] = useState(false);
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
            const bypassLock = localStorage.getItem('squirrel_bypass_lock');
            const isBypassValid = bypassLock && (Date.now() - parseInt(bypassLock, 10) < 120000);
            
            if (!isActive) {
              if (isBypassValid) return; // Skip lock
              
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock === 'true' && pathname !== '/') {
                // Instantly lock by overlaying calculator
                setIsLocked(true);
              } else if (quickLock !== 'true' && pathname !== '/') {
                // If off, we could record the time it went to background
                localStorage.setItem('squirrel_background_time', Date.now().toString());
              }
            } else {
              if (isBypassValid) return; // Skip lock logic on return

              // App came back to foreground
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock !== 'true' && pathname !== '/') {
                const bgTimeStr = localStorage.getItem('squirrel_background_time');
                if (bgTimeStr) {
                  const bgTime = parseInt(bgTimeStr, 10);
                  const now = Date.now();
                  // 3 minutes timeout if quick lock is off
                  if (now - bgTime > 3 * 60 * 1000) {
                    setIsLocked(true);
                  }
                  localStorage.removeItem('squirrel_background_time');
                }
              }
            }
          });
        } else {
          // Web fallback
          const handleVisibilityChange = () => {
            const bypassLock = localStorage.getItem('squirrel_bypass_lock');
            const isBypassValid = bypassLock && (Date.now() - parseInt(bypassLock, 10) < 120000);
            
            if (document.hidden) {
              if (isBypassValid) return;
              
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock === 'true' && window.location.pathname !== '/') {
                setIsLocked(true);
              } else if (quickLock !== 'true' && window.location.pathname !== '/') {
                localStorage.setItem('squirrel_background_time', Date.now().toString());
              }
            } else {
              if (isBypassValid) return;
              
              const quickLock = localStorage.getItem('squirrel_quick_lock');
              if (quickLock !== 'true' && window.location.pathname !== '/') {
                const bgTimeStr = localStorage.getItem('squirrel_background_time');
                if (bgTimeStr) {
                  const bgTime = parseInt(bgTimeStr, 10);
                  const now = Date.now();
                  if (now - bgTime > 3 * 60 * 1000) {
                    setIsLocked(true);
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

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[999999] bg-black">
        <Calculator onUnlock={() => setIsLocked(false)} />
      </div>
    );
  }

  return null;
}
