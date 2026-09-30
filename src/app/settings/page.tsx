'use client';

import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, ArrowDown, Camera, Check, Loader2, ImagePlus, Save, X, RotateCcw, Pen, Trash2 } from 'lucide-react';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

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

  const [status, setStatus] = useState('');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [partnerNickname, setPartnerNickname] = useState('');
  const [isSavingPartnerNickname, setIsSavingPartnerNickname] = useState(false);
  const [partnerNicknameSaved, setPartnerNicknameSaved] = useState(false);
  const [partnerData, setPartnerData] = useState<any>(null);
  const [isEditingPartnerNickname, setIsEditingPartnerNickname] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      import('firebase/firestore').then(({ getDoc, doc }) => {
        getDoc(doc(db, 'users', user.uid)).then(snap => {
          if (snap.exists()) {
            if (snap.data().status !== undefined) setStatus(snap.data().status);
            if (snap.data().displayName !== undefined) setDisplayName(snap.data().displayName);
            else if (user.displayName) setDisplayName(user.displayName);

            if (snap.data().partnerNickname !== undefined) setPartnerNickname(snap.data().partnerNickname);
          } else if (user.displayName) {
            setDisplayName(user.displayName);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Camera access denied or error:", err);
      alert("Could not access the camera. Please check permissions.");
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
      if (ctx) {
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
    const { centerCrop, makeAspectCrop } = await import('react-image-crop');
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(crop);
  }

  const handleSaveStatus = async () => {
    if (!user || status.length > 40) return;
    setIsSavingStatus(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { status });
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

  const handleSavePartnerNickname = async () => {
    if (!user || partnerNickname.length > 30) return;
    setIsSavingPartnerNickname(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { partnerNickname });
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
      formData.append('file', blob);
      formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
      formData.append('timestamp', timestamp.toString());
      formData.append('upload_preset', 'Squirrel');
      formData.append('signature', signature);

      const res = await fetch(`https://api.cloudinary.com/v1_1/wusvh42x/image/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload to Cloudinary failed');
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
      <div className="h-dvh flex items-center justify-center bg-[#f2f2f7]">
        <Loader2 className="animate-spin text-neutral-400" size={32} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-dvh bg-[#f2f2f7] flex flex-col font-sans overflow-hidden">
      {/* Header (iOS Style) */}
      <div className="px-4 py-3 flex items-center shrink-0 bg-[#f2f2f7]/80 backdrop-blur-md z-10 sticky top-0">
        <button
          onClick={() => router.push('/chat')}
          className="relative z-10 w-10 h-10 flex items-center justify-center text-blue-500 hover:opacity-70 transition-opacity"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold text-black -ml-10 pointer-events-none">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-4 flex flex-col items-center">

        {/* Profile Card */}
        <div className="w-full max-w-sm mt-2 flex flex-col gap-5">

          {/* Avatar and Profile Info */}
          <div className="flex items-center gap-4 px-2">

            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-white shadow-sm flex items-center justify-center border-4 border-white">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-200 to-slate-50 flex items-center justify-center">
                    <svg className="w-1/2 h-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
              <div className="flex flex-col gap-1">
                {isEditingName ? (
                  <div className="flex items-center bg-white rounded-lg border border-neutral-100 overflow-hidden pr-1">
                    <input
                      type="text"
                      maxLength={50}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent outline-none text-black text-[13px] font-bold px-2 py-1.5"
                      autoFocus
                      onBlur={() => {
                        if (displayName === user.displayName || displayName.trim() === '') {
                          setIsEditingName(false);
                          setDisplayName(user.displayName || '');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        handleSaveName();
                        setIsEditingName(false);
                      }}
                      disabled={isSavingName || displayName.length > 50 || displayName === user.displayName}
                      className="w-6 h-6 flex items-center justify-center rounded-md bg-blue-50 text-blue-600 active:bg-blue-100 disabled:opacity-40 shrink-0"
                    >
                      {isSavingName ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <h2 className="text-lg font-bold text-black tracking-tight leading-tight truncate">{user.displayName || 'Anonymous'}</h2>
                    <button onClick={() => setIsEditingName(true)} className="text-neutral-400 hover:text-blue-500 transition-colors opacity-50 group-hover:opacity-100">
                      <Pen size={12} />
                    </button>
                  </div>
                )}
                <p className="text-neutral-500 text-[10px] truncate">{user.email}</p>
              </div>

              <div className="flex gap-2 mt-1">
                <label className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer bg-white shadow-sm active:scale-95 transition-all text-neutral-500 hover:text-blue-500 border border-neutral-100">
                  <ImagePlus size={14} />
                  <input type="file" accept="image/*" onChange={onSelectFile} className="hidden" />
                </label>
                <button onClick={openCamera} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer bg-white shadow-sm active:scale-95 transition-all text-neutral-500 hover:text-blue-500 border border-neutral-100">
                  <Camera size={14} />
                </button>
                {user.photoURL && (
                  <button onClick={handleDeleteProfilePicture} disabled={uploading} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer bg-white shadow-sm active:scale-95 transition-all text-neutral-500 hover:text-red-500 border border-neutral-100 disabled:opacity-40">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields Stacked */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-100/50 flex flex-col gap-4">
            {/* Status/About Input */}
            <div className="flex flex-col">
              <div className="flex justify-between items-end mb-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">About You</label>
                <span className="text-[9px] text-neutral-400 font-medium">{status.length}/35</span>
              </div>
              <div className="flex items-center border-b border-neutral-100 pb-1">
                <input
                  type="text"
                  placeholder="What are you doing?"
                  maxLength={35}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-black placeholder:text-neutral-300 text-[14px] font-medium"
                />
                <button
                  onClick={handleSaveStatus}
                  disabled={isSavingStatus || status.length > 35}
                  className={`ml-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${statusSaved ? 'bg-green-500 text-white' : 'bg-blue-50 text-blue-600 active:bg-blue-100'
                    } disabled:opacity-40 flex items-center gap-1`}
                >
                  {isSavingStatus ? <Loader2 size={12} className="animate-spin" /> : statusSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Emotional Timeline */}
        <div className="w-full max-w-sm mt-16 mb-24 flex flex-col items-center justify-center relative">
          <style>{`
            @keyframes slideUpFade {
              0% { opacity: 0; transform: translateY(20px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes typing {
              from { max-width: 0 }
              to { max-width: 250px }
            }
            @keyframes blink {
              50% { border-color: transparent }
            }
            .typewriter {
              display: inline-block;
              overflow: hidden;
              white-space: nowrap;
              border-right: 2px solid white;
              animation: typing 2s steps(12, end) forwards, blink 0.75s step-end infinite;
            }
            .stagger-1 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards; opacity: 0; }
            .stagger-2 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; opacity: 0; }
            .stagger-3 { animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards; opacity: 0; }
          `}</style>

          <div className="mb-12 inline-flex">
            <h3 className="text-[14px] font-bold text-white uppercase tracking-[0.15em] bg-black px-4 py-2 rounded-md shadow-sm">
              <span className="typewriter">OUR TIMELINE</span>
            </h3>
          </div>

          <div className="flex flex-col items-center relative w-full">
            {/* The Connecting Zigzag Line */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 stagger-1">
              <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" fill="none">
                <path d="M 15 12 L 85 12 L 15 48.5 L 85 48.5 L 15 86.5 L 85 86.5" stroke="url(#zigzag-grad)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 4" />
                <defs>
                  <linearGradient id="zigzag-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6B705C" />
                    <stop offset="0.5" stopColor="#A67C52" />
                    <stop offset="1" stopColor="#2F6662" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Level 1 */}
            <div className="flex items-center w-full justify-between relative z-10 group cursor-default px-2 stagger-1">
              <div className="w-[84px] h-[84px] rounded-full flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105"
                style={{ backgroundColor: '#F2E8CF', borderColor: '#6B705C', borderWidth: 1 }}>
                <span className="text-[13px] font-medium italic" style={{ color: '#6B705C' }}>Sadiya</span>
              </div>

              <div className="w-[84px] h-[84px] rounded-full flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105"
                style={{ backgroundColor: '#EBF0F2', borderColor: '#5E7480', borderWidth: 1 }}>
                <span className="text-[13px] font-medium italic" style={{ color: '#5E7480' }}>Haadi</span>

              </div>
            </div>

            {/* Gap */}
            <div className="h-10 w-full"></div>

            {/* Level 2 */}
            <div className="flex items-center w-full justify-between relative z-10 group cursor-default px-2 stagger-2">
              <div className="w-[90px] h-[90px] rounded-full flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105"
                style={{ backgroundColor: '#F9EED9', borderColor: '#A67C52', borderWidth: 1 }}>
                <span className="text-[14px] font-semibold italic" style={{ color: '#A67C52' }}>Squirrel</span>
              </div>

              <div className="w-[90px] h-[90px] rounded-full flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105"
                style={{ backgroundColor: '#E5EDE8', borderColor: '#547A64', borderWidth: 1 }}>
                <span className="text-[14px] font-semibold italic" style={{ color: '#547A64' }}>Pookie</span>
              </div>
            </div>

            {/* Gap */}
            <div className="h-10 w-full"></div>

            {/* Level 3 */}
            <div className="flex items-center w-full justify-between relative z-10 group cursor-default px-2 stagger-3">
              {/* Sadiya's Nickname (Left) */}
              <div className="w-[96px] h-[96px] flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105 relative group/left"
                style={{ backgroundColor: '#E0EAE9', borderColor: '#2F6662', borderWidth: 1, borderRadius: '55% 45% 40% 60% / 60% 50% 50% 40%' }}>
                {user?.email === 'officialhaadi81@gmail.com' ? (
                  isEditingPartnerNickname ? (
                    <input
                      ref={nicknameInputRef}
                      type="text"
                      maxLength={20}
                      value={partnerNickname}
                      onChange={(e) => setPartnerNickname(e.target.value)}
                      onBlur={() => { if (!isSavingPartnerNickname) handleSavePartnerNickname(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePartnerNickname(); }}
                      placeholder="For Sadiya"
                      className="w-[70px] bg-transparent outline-none text-center text-[14px] font-medium italic font-serif placeholder:opacity-50 placeholder:not-italic placeholder:text-[10px]"
                      style={{ color: '#2F6662' }}
                    />
                  ) : (
                    <span className="text-[14px] font-medium italic font-serif text-center px-2" style={{ color: '#2F6662' }}>
                      {partnerNickname || '" "'}
                    </span>
                  )
                ) : (
                  <span className="text-[14px] font-medium italic font-serif text-center px-2" style={{ color: '#2F6662' }}>
                    {partnerData?.partnerNickname || '" "'}
                  </span>
                )}

                {user?.email === 'officialhaadi81@gmail.com' && !isEditingPartnerNickname && (
                  <button
                    onClick={() => {
                      setIsEditingPartnerNickname(true);
                      setTimeout(() => nicknameInputRef.current?.focus(), 50);
                    }}
                    className="absolute bottom-1 right-1 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:scale-110 transition-all z-20"
                    style={{ color: '#2F6662' }}
                  >
                    <Pen size={14} />
                  </button>
                )}
                {user?.email === 'officialhaadi81@gmail.com' && isEditingPartnerNickname && isSavingPartnerNickname && (
                  <div className="absolute inset-0 m-auto w-8 h-8 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-full z-20" style={{ color: '#2F6662' }}>
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
              </div>

              {/* Haadi's Nickname (Right) */}
              <div className="w-[96px] h-[96px] flex flex-col items-center justify-center transition-transform duration-500 hover:scale-105 relative group/right"
                style={{ backgroundColor: '#F0E9E1', borderColor: '#705746', borderWidth: 1, borderRadius: '45% 55% 60% 40% / 50% 60% 40% 50%' }}>
                {user?.email === 'sadiyaayoub22019@gmail.com' ? (
                  isEditingPartnerNickname ? (
                    <input
                      ref={nicknameInputRef}
                      type="text"
                      maxLength={20}
                      value={partnerNickname}
                      onChange={(e) => setPartnerNickname(e.target.value)}
                      onBlur={() => { if (!isSavingPartnerNickname) handleSavePartnerNickname(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePartnerNickname(); }}
                      placeholder="For Haadi"
                      className="w-[70px] bg-transparent outline-none text-center text-[14px] font-medium italic font-serif placeholder:opacity-50 placeholder:not-italic placeholder:text-[10px]"
                      style={{ color: '#705746' }}
                    />
                  ) : (
                    <span className="text-[14px] font-medium italic font-serif text-center px-2" style={{ color: '#705746' }}>
                      {partnerNickname || '" "'}
                    </span>
                  )
                ) : (
                  <span className="text-[14px] font-medium italic font-serif text-center px-2" style={{ color: '#705746' }}>
                    {partnerData?.partnerNickname || '" "'}
                  </span>
                )}

                {user?.email === 'sadiyaayoub22019@gmail.com' && !isEditingPartnerNickname && (
                  <button
                    onClick={() => {
                      setIsEditingPartnerNickname(true);
                      setTimeout(() => nicknameInputRef.current?.focus(), 50);
                    }}
                    className="absolute bottom-1 right-1 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:scale-110 transition-all z-20"
                    style={{ color: '#705746' }}
                  >
                    <Pen size={14} />
                  </button>
                )}
                {user?.email === 'sadiyaayoub22019@gmail.com' && isEditingPartnerNickname && isSavingPartnerNickname && (
                  <div className="absolute inset-0 m-auto w-8 h-8 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-full z-20" style={{ color: '#705746' }}>
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>
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

