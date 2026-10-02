'use client';

import React, { useState, useRef, useEffect } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, ArrowDown, Camera, Check, Loader2, ImagePlus, Save, X, RotateCcw, Pen, Trash2 } from 'lucide-react';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import WallpaperSettingsPanel from '@/components/WallpaperSettings';

const ReactCrop = dynamic(() => import('react-image-crop'), { ssr: false });

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [status, setStatus] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_status') || '' : '');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [displayName, setDisplayName] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_displayName') || '' : '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [partnerNickname, setPartnerNickname] = useState(typeof window !== 'undefined' ? localStorage.getItem('squirrel_partnerNickname') || '' : '');
  const [isSavingPartnerNickname, setIsSavingPartnerNickname] = useState(false);
  const [partnerNicknameSaved, setPartnerNicknameSaved] = useState(false);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [isEditingPartnerNickname, setIsEditingPartnerNickname] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [quickLock, setQuickLock] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // App PIN state
  const [appPin, setAppPin] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    // Load existing PIN if any
    const savedPin = localStorage.getItem('squirrel_pin');
    if (savedPin) {
      setAppPin(savedPin);
    }
    const savedQuickLock = localStorage.getItem('squirrel_quick_lock');
    if (savedQuickLock === 'true') {
      setQuickLock(true);
    }
    const savedNotifs = localStorage.getItem('squirrel_notifications');
    if (savedNotifs === 'true') {
      setNotificationsEnabled(true);
    }
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      import('firebase/firestore').then(({ getDoc, doc }) => {
        getDoc(doc(db, 'users', user.uid)).then(snap => {
          if (snap.exists()) {
            if (snap.data().status !== undefined) {
              setStatus(snap.data().status);
              localStorage.setItem('squirrel_status', snap.data().status);
            }
            if (snap.data().displayName !== undefined) {
              setDisplayName(snap.data().displayName);
              localStorage.setItem('squirrel_displayName', snap.data().displayName);
            } else if (user.displayName) {
              setDisplayName(user.displayName);
              localStorage.setItem('squirrel_displayName', user.displayName);
            }

            if (snap.data().partnerNickname !== undefined) {
              setPartnerNickname(snap.data().partnerNickname);
              localStorage.setItem('squirrel_partnerNickname', snap.data().partnerNickname);
            }
          } else if (user.displayName) {
            setDisplayName(user.displayName);
            localStorage.setItem('squirrel_displayName', user.displayName);
          }
        });

        // Fetch partner data
        const partnerEmail = user.email === 'sadiyaayoub22019@gmail.com' ? 'officialhaadi81@gmail.com' : 'sadiyaayoub22019@gmail.com';
        import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
          const q = query(collection(db, 'users'), where('email', '==', partnerEmail));
          getDocs(q).then(snapshot => {
            if (!snapshot.empty) {
              setPartnerData(snapshot.docs[0].data());
            }
          });
        });
      });
    }
  }, [user, loading, router]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Assign stream to video element
  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);
  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCropping(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  async function openCamera() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          width: 1080
        });
        if (image.dataUrl) {
          setImgSrc(image.dataUrl);
          setCrop(undefined);
          setIsCropping(true);
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } }
        });
        setCameraStream(stream);
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error("Camera access denied, error, or user cancelled:", err);
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  }

  function capturePhoto() {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        // Mirror the image horizontally if it's front-facing
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImgSrc(dataUrl);
        setCrop(undefined);
        setIsCropping(true);
        closeCamera();
      }
    }
  }

  async function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const { centerCrop, makeAspectCrop, convertToPixelCrop } = await import('react-image-crop');
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(crop); 
    setCompletedCrop(convertToPixelCrop(crop, width, height));
  }

  const handleSaveStatus = async () => {
    if (!user || status.length > 40) return;
    setIsSavingStatus(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { status });
      localStorage.setItem('squirrel_status', status);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save status", error);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveName = async () => {
    if (!user || displayName.length > 50) return;
    setIsSavingName(true);
    try {
      await updateProfile(user, { displayName });
      await updateDoc(doc(db, 'users', user.uid), { displayName });
      localStorage.setItem('squirrel_displayName', displayName);
      await user.reload();
      setUser({ ...auth.currentUser! });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save name", error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSavePin = () => {
    const finalPin = appPin.replace(/\s/g, '');
    if (finalPin.length === 0) {
      localStorage.removeItem('squirrel_pin');
      setAppPin('');
    } else if (/^\d{4}$/.test(finalPin)) {
      localStorage.setItem('squirrel_pin', finalPin);
      setAppPin(finalPin);
    } else {
      alert('PIN must be exactly 4 digits.');
      return;
    }
    setIsEditingPin(false);
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
  };

  const handleSavePartnerNickname = async () => {
    if (!user || partnerNickname.length > 30) return;
    setIsSavingPartnerNickname(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { partnerNickname });
      localStorage.setItem('squirrel_partnerNickname', partnerNickname);
      setPartnerNicknameSaved(true);
      setIsEditingPartnerNickname(false);
      setTimeout(() => setPartnerNicknameSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save partner nickname", error);
    } finally {
      setIsSavingPartnerNickname(false);
    }
  };

  const handleSaveCroppedImage = async () => {
    if (!completedCrop || !imgRef.current || !user) return;

    setUploading(true);
    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      let actualWidth = Math.floor(completedCrop.width * scaleX);
      let actualHeight = Math.floor(completedCrop.height * scaleY);

      // Limit resolution to avoid mobile memory issues
      const MAX_SIZE = 1080;
      if (actualWidth > MAX_SIZE || actualHeight > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / actualWidth, MAX_SIZE / actualHeight);
        actualWidth = Math.floor(actualWidth * ratio);
        actualHeight = Math.floor(actualHeight * ratio);
      }

      canvas.width = actualWidth;
      canvas.height = actualHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('No 2d context');

      // Fill white background (prevents black background on transparent PNGs when saving as JPEG)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(
        image,
        Math.floor(completedCrop.x * scaleX),
        Math.floor(completedCrop.y * scaleY),
        Math.floor(completedCrop.width * scaleX),
        Math.floor(completedCrop.height * scaleY),
        0, 0, actualWidth, actualHeight
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) return reject(new Error('Canvas is empty'));
          resolve(b);
        }, 'image/jpeg', 0.9);
      });

      const idToken = await user.getIdToken();
      const sigRes = await fetch('/api/upload-signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upload_preset: 'Squirrel' })
      });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { timestamp, signature } = await sigRes.json();

      const formData = new FormData();
      formData.append('file', blob, `${user.uid}_${Date.now()}.jpg`);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
      formData.append('timestamp', timestamp.toString());
      formData.append('upload_preset', 'Squirrel');
      formData.append('signature', signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload image to Cloudinary');
      
      const data = await res.json();
      const downloadURL = data.secure_url;

      await updateProfile(user, { photoURL: downloadURL });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });

      await user.reload();
      setUser({ ...auth.currentUser! });

      setIsCropping(false);
      setImgSrc('');
    } catch (error) {
      console.error("Error updating profile picture:", error);
      alert('Failed to update profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!user) return;
    try {
      setUploading(true);
      await updateProfile(user, { photoURL: "" });
      await updateDoc(doc(db, 'users', user.uid), { photoURL: "" });

      setUser({ ...user, photoURL: "" } as User);
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      alert('Failed to delete profile picture.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#F2F2F7]">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-dvh bg-[#F2F2F7] text-black flex flex-col font-sans overflow-hidden">
      {/* Header (Clean iOS Style) */}
      <div className="px-4 py-3 flex items-center shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-200 z-20 sticky top-0">
        <button
          onClick={() => router.push('/chat')}
          className="relative z-10 w-10 h-10 flex items-center justify-center text-blue-500 hover:bg-gray-100 rounded-full transition-all"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold text-black -ml-10 pointer-events-none">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-6 flex flex-col items-center custom-scrollbar">
        <div className="w-full max-w-md flex flex-col gap-6">

          {/* Profile Card */}
          <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-sm border border-gray-200/60">
            
            {/* Avatar */}
            <div className="relative group shrink-0 z-10">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <svg className="w-1/2 h-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar Actions */}
            <div className="flex gap-3 mt-1">
              <label onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all text-gray-700 shadow-sm">
                <ImagePlus size={18} />
                <input type="file" accept="image/*" onChange={onSelectFile} onClick={() => localStorage.setItem('squirrel_bypass_lock', Date.now().toString())} className="hidden" />
              </label>
              <button onClick={(e) => { localStorage.setItem('squirrel_bypass_lock', Date.now().toString()); openCamera(); }} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all text-gray-700 shadow-sm">
                <Camera size={18} />
              </button>
              {user.photoURL && (
                <button onClick={handleDeleteProfilePicture} disabled={uploading} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer bg-gray-100 hover:bg-red-50 active:bg-red-100 transition-all text-red-500 shadow-sm disabled:opacity-40">
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
              )}
            </div>

            {/* Name */}
            <div className="w-full mt-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1 mb-1 block">Name</label>
              {isEditingName ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center bg-gray-50 rounded-xl border border-blue-500 px-1 py-1 transition-colors shadow-sm">
                    <input
                      type="text"
                      maxLength={50}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent outline-none text-black text-[16px] px-3 py-2 placeholder:text-gray-400"
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setDisplayName(user.displayName || '');
                        setIsEditingName(false);
                      }}
                      className="px-3 py-2 rounded-lg text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleSaveName();
                        setIsEditingName(false);
                      }}
                      disabled={isSavingName || displayName.length > 50 || displayName === user.displayName || displayName.trim() === ''}
                      className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${nameSaved ? 
                        'bg-green-500 text-white' : 'bg-blue-500 text-white active:scale-95 hover:bg-blue-600'
                      } disabled:opacity-50 flex items-center gap-1 shrink-0 shadow-sm`}
                    >
                      {isSavingName ? <Loader2 size={14} className="animate-spin" /> : nameSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setDisplayName(user.displayName || '');
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsEditingName(true)}>
                  <span className="text-[17px] text-black truncate">{user.displayName || 'Anonymous'}</span>
                  <Pen size={16} className="text-gray-400" />
                </div>
              )}
              <p className="text-gray-500 text-xs ml-1 mt-1.5">{user.email}</p>
            </div>

            {/* About */}
            <div className="w-full mt-2">
              <div className="flex justify-between items-end mb-1 ml-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">About</label>
                <span className="text-[10px] text-gray-400 font-medium">{status.length}/35</span>
              </div>
              <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-1 py-1 focus-within:border-gray-300 transition-colors shadow-sm">
                <input
                  type="text"
                  placeholder="What are you doing?"
                  maxLength={35}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent outline-none text-black placeholder:text-gray-400 text-[16px] px-3 py-2"
                />
                <button
                  onClick={handleSaveStatus}
                  disabled={isSavingStatus || status.length > 35}
                  className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${statusSaved ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 active:scale-95 hover:bg-gray-300'
                    } disabled:opacity-40 flex items-center gap-1 shrink-0`}
                >
                  {isSavingStatus ? <Loader2 size={14} className="animate-spin" /> : statusSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Group 2: App & Security */}
          <div className="flex flex-col gap-0 bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
            
            {/* App Unlock PIN Setting */}
            {isEditingPin ? (
              <div className="p-4 flex flex-col gap-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <h4 className="text-black font-semibold text-[16px]">Set Unlock PIN</h4>
                  <button 
                    onClick={() => {
                      setAppPin(localStorage.getItem('squirrel_pin') || '');
                      setIsEditingPin(false);
                    }} 
                    className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-gray-500 text-[13px] leading-tight -mt-2">
                  4-digit PIN to directly open chat from the calculator.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={4}
                    placeholder="Enter 4 digits"
                    value={appPin.replace(/\s/g, '')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setAppPin(val);
                    }}
                    className="flex-1 h-14 px-4 bg-white border border-gray-300 rounded-xl text-black font-semibold text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                  />
                  <button
                    onClick={handleSavePin}
                    disabled={appPin.replace(/\s/g, '').length !== 4 && appPin.replace(/\s/g, '').length !== 0}
                    className="h-14 px-6 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed active:scale-95 transition-all shadow-sm"
                  >
                    Save
                  </button>
                </div>
                {pinSaved && (
                  <span className="text-green-600 text-[13px] flex items-center gap-1 font-medium mt-1">
                    <Check size={14} /> PIN Saved Successfully
                  </span>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingPin(true)}
                className="p-4 w-full flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
              >
                <div>
                  <h4 className="text-black font-semibold text-[16px]">App Unlock PIN</h4>
                  <p className="text-gray-500 text-[13px] mt-0.5">4-digit PIN for the calculator.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-medium text-[15px]">{appPin ? '••••' : ''}</span>
                  <span className="text-blue-500 font-medium text-[14px]">Set</span>
                </div>
              </button>
            )}

            <div className="h-[1px] bg-gray-200 w-full"></div>

            {/* Notifications Button */}
            <button
              onClick={async () => {
                const val = !notificationsEnabled;
                if (val) {
                  try {
                    const { Capacitor } = await import('@capacitor/core');
                    if (Capacitor.isNativePlatform()) {
                      const { LocalNotifications } = await import('@capacitor/local-notifications');
                      let permStatus = await LocalNotifications.checkPermissions();
                      if (permStatus.display !== 'granted') {
                        permStatus = await LocalNotifications.requestPermissions();
                      }
                      if (permStatus.display === 'granted') {
                        setNotificationsEnabled(true);
                        localStorage.setItem('squirrel_notifications', 'true');
                        if (user) {
                          import('firebase/firestore').then(({ doc, updateDoc }) => {
                            updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
                          });
                        }
                      } else {
                        alert('Notifications permission denied.');
                      }
                    } else {
                      if ('Notification' in window) {
                        Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                            setNotificationsEnabled(true);
                            localStorage.setItem('squirrel_notifications', 'true');
                            if (user) {
                              import('firebase/firestore').then(({ doc, updateDoc }) => {
                                updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: true }).catch(() => {});
                              });
                            }
                          } else {
                            alert('Notifications permission denied.');
                          }
                        });
                      } else {
                        alert('Your browser does not support notifications.');
                      }
                    }
                  } catch (e) {
                    alert('Error setting up notifications');
                  }
                } else {
                  setNotificationsEnabled(false);
                  localStorage.setItem('squirrel_notifications', 'false');
                  if (user) {
                    import('firebase/firestore').then(({ doc, updateDoc }) => {
                      updateDoc(doc(db, 'users', user.uid), { notificationsEnabled: false }).catch(() => {});
                    });
                  }
                }
              }}
              className="p-4 w-full flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div>
                <h4 className="text-black font-semibold text-[16px]">App Notifications</h4>
                <p className="text-gray-500 text-[13px] mt-0.5">Dummy calculator alerts for messages.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={notificationsEnabled}
                  readOnly
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </button>
          </div>

          {/* Quick Lock Setting */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
            <div className="p-4 w-full flex items-center justify-between">
              <div>
                <h4 className="text-black font-semibold text-[16px]">Quick Lock</h4>
                <p className="text-gray-500 text-[13px] mt-0.5">Instantly lock when minimized</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={quickLock}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setQuickLock(val);
                    localStorage.setItem('squirrel_quick_lock', val.toString());
                  }}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
          </div>

          <WallpaperSettingsPanel />

        </div>
      </div>

      {/* Live Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 pt-10 text-white z-10 absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent">
            <button onClick={closeCamera} className="p-2 active:opacity-50">
              <X size={28} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onCanPlay={(e) => {
                e.currentTarget.play();
              }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>

          <div className="pb-12 pt-6 bg-black flex justify-center items-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-[6px] border-white/30 flex items-center justify-center active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-full bg-white"></div>
            </button>
          </div>
        </div>
      )}

      {/* Cropper Modal */}
      {isCropping && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col">
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
            {!!imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-full max-w-full"
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </ReactCrop>
            )}
          </div>
          <div className="p-6 pb-10 flex justify-between items-center shrink-0">
            <button
              onClick={() => { setIsCropping(false); setImgSrc(''); }}
              className="px-5 py-2.5 rounded-full text-white font-medium active:bg-white/10"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCroppedImage}
              disabled={uploading}
              className="px-6 py-2.5 rounded-full bg-white text-black font-semibold flex items-center gap-2 active:bg-white/80 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin text-black" size={18} />
                  Saving...
                </>
              ) : (
                'Choose'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

