'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PermissionsGate() {
  const [showModal, setShowModal] = useState(false);
  const [denied, setDenied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/chat' && pathname !== '/sandbox') {
      return;
    }

    const checkPermissions = async () => {
      let isMissing = false;

      if ('Notification' in window && Notification.permission !== 'granted') {
        isMissing = true;
      }

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (micPerm.state !== 'granted') isMissing = true;
          
          const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (camPerm.state !== 'granted') isMissing = true;
        } catch (e) {
          // Fallback for browsers that do not support querying mic/camera permissions
          const agreed = localStorage.getItem('permissions_agreed_v2');
          if (!agreed) isMissing = true;
        }
      } else {
        const agreed = localStorage.getItem('permissions_agreed_v2');
        if (!agreed) isMissing = true;
      }

      if (isMissing) {
        setShowModal(true);
      } else {
        setShowModal(false);
        setDenied(false);
      }
    };

    checkPermissions();
  }, [pathname]);

  const handleAgree = async () => {
    let allGranted = true;
    let customError = '';

    try {
      if (!window.isSecureContext) {
        customError = 'Browser requires HTTPS (or localhost) for Camera/Mic access. If testing on mobile via local IP, use a secure tunnel (e.g. localtunnel) or test on your PC.';
        allGranted = false;
      } else {
        // 1. Request Notification Permission
        if ('Notification' in window) {
          const notifStatus = await Notification.requestPermission();
          if (notifStatus === 'denied' || notifStatus === 'default') {
            allGranted = false;
          }
        }

        // 2. Request Camera & Mic Permission
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(track => track.stop());
          } catch (mediaErr) {
            console.warn('Media permission denied:', mediaErr);
            allGranted = false;
          }
        } else {
          allGranted = false;
          customError = 'Your browser does not support camera/microphone access in this environment.';
        }
      }

      if (allGranted) {
        setShowModal(false);
        localStorage.setItem('permissions_agreed_v2', 'true');
      } else {
        setErrorMsg(customError);
        setDenied(true);
      }
    } catch (err) {
      console.warn('Permissions request failed:', err);
      setDenied(true);
    }
  };

  const handleCancel = () => {
    setDenied(true);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center transition-all duration-300 pointer-events-auto">
      <div 
        className="w-[270px] bg-[#1e1e1e]/90 backdrop-blur-xl rounded-[14px] flex flex-col items-center overflow-hidden shadow-2xl"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      >
        {!denied ? (
          <>
            <div className="px-4 pt-5 pb-4 flex flex-col items-center text-center">
              <h2 className="text-[17px] font-semibold text-white leading-[22px] tracking-tight mb-1">
                “Squirrel” Would Like to Access the Camera, Microphone, and Notifications
              </h2>
              <p className="text-[13px] text-white/70 leading-[18px]">
                This allows you to send photos, record voice notes, and receive alerts for new messages.
              </p>
            </div>
            
            <div className="w-full border-t border-white/[0.15] flex">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 text-[17px] text-[#0A84FF] font-normal border-r border-white/[0.15] hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                Don't Allow
              </button>
              <button
                onClick={handleAgree}
                className="flex-1 py-3 text-[17px] text-[#0A84FF] font-semibold hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                Allow
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pt-5 pb-4 flex flex-col items-center text-center">
              <h2 className="text-[17px] font-semibold text-white leading-[22px] tracking-tight mb-1">
                Permissions Required
              </h2>
              <p className="text-[13px] text-white/70 leading-[18px]">
                {errorMsg 
                  ? errorMsg 
                  : 'You cannot use this app without allowing these permissions. If you blocked them in your browser, please enable them in settings.'}
              </p>
            </div>
            
            <div className="w-full border-t border-white/[0.15] flex">
              <button
                onClick={() => setDenied(false)}
                className="w-full py-3 text-[17px] text-[#0A84FF] font-semibold hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
