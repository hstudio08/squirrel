'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mic, X, ChevronDown, Settings, PenLine, Sparkles, Activity } from 'lucide-react';

interface OnboardingTourProps {
  user: User | null;
}

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome back.',
    description: 'We have crafted some elegant new features exclusively for you two. Let us take a brief tour to get you acquainted.',
    icon: <Sparkles className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  },
  {
    id: 'voice',
    title: 'Voice Notes',
    description: 'Tap and hold the microphone to record. If you change your mind, gently slide left to cancel with a fluid, natural motion.',
    icon: <Mic className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  },
  {
    id: 'navbar',
    title: 'Navigation Secrets',
    description: 'Tap the sleek down-arrow at the top left to expand the menu. Tap your profile picture on the right to view your profile.',
    icon: <ChevronDown className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  },
  {
    id: 'settings',
    title: 'Timeline Nicknames',
    description: 'In Settings, tap the floating pen badge on the timeline bubbles to set a personalized nickname for each other.',
    icon: <Settings className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  },
  {
    id: 'status',
    title: 'Current Status',
    description: 'Update your status to let the other person know exactly what you are doing right nowâ€”whether you are busy, relaxing, or working.',
    icon: <Activity className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  },
  {
    id: 'finish',
    title: 'You are all set.',
    description: 'Enjoy the refined aesthetics and smooth interactions. Your private space is ready.',
    icon: <PenLine className="w-8 h-8 text-slate-700 mb-6 stroke-[1.5]" />,
  }
];

export default function OnboardingTour({ user }: OnboardingTourProps) {
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTourStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      
      const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];
      if (!user.email || !allowedEmails.includes(user.email)) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!data.hasSeenTour) {
            setShowTour(true);
          }
        } else {
          setShowTour(true);
        }
      } catch (error) {
        console.error("Error checking tour status", error);
      } finally {
        setLoading(false);
      }
    };

    checkTourStatus();
  }, [user]);

  if (loading || !showTour) return null;

  const handleNext = async () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, { hasSeenTour: true }, { merge: true });
        }
        setShowTour(false);
      } catch (error) {
        console.error("Failed to complete tour", error);
      }
    }
  };

  const stepData = TOUR_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40  px-6 pointer-events-auto transition-all duration-500">
      <div 
        className="relative w-full max-w-[340px] bg-white/80   rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] overflow-hidden animate-fade-in border border-white/60"
      >
        <div className="p-10 flex flex-col items-center text-center transition-all duration-500 ease-out">
          <div className="opacity-90">
            {stepData.icon}
          </div>

          <h2 className="text-xl font-medium text-slate-800 mb-4 tracking-wide">
            {stepData.title}
          </h2>
          
          <p className="text-[14px] text-slate-600 leading-relaxed font-light mb-10 min-h-[80px]">
            {stepData.description}
          </p>

          <div className="flex space-x-2.5 mb-8">
            {TOUR_STEPS.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1 rounded-full transition-all duration-500 ease-out ${idx === currentStep ? 'w-8 bg-slate-700' : 'w-2 bg-slate-300'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="w-full py-3 bg-transparent border border-slate-300 text-slate-700 rounded-full font-medium text-[14px] hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] transition-all duration-300 tracking-wide"
          >
            {currentStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
