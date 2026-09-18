'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const sentences = [
  "The Digital Personal Data Protection Act establishes a comprehensive framework for processing digital personal data in India.",
  "Bioluminescent jellyfish drift silently through the abyssal plain, casting an ethereal glow.",
  "Organizations must ensure that personal data is collected for a lawful purpose and with explicit consent.",
  "The giant squid, long thought to be a myth, battles sperm whales in the crushing depths.",
  "Data Fiduciaries face significant penalties for failing to implement reasonable security safeguards.",
  "Coral reefs support an incredible diversity of marine life, serving as the rainforests of the sea.",
  "Users have the right to request erasure of their personal data under the new legislative guidelines.",
  "Manta rays glide effortlessly, filtering plankton through their massive cephalic fins.",
  "Cross-border data transfers are permitted to certain countries pending government notification.",
  "The mimic octopus can imitate the physical likeness and movements of more than fifteen different species.",
  "Data Protection Officers must be appointed by Significant Data Fiduciaries to ensure compliance.",
  "Deep-sea anglerfish use a fleshy, bioluminescent lure to attract prey in the absolute darkness.",
  "The Data Protection Board of India will act as an adjudicatory body for resolving disputes.",
  "Seahorses are among the only animal species on Earth in which the male bears the unborn young.",
  "Notice of data collection must be provided in multiple languages to ensure accessibility for all users.",
  "The Mariana Trench hides ecosystems that survive entirely on chemosynthesis near hydrothermal vents.",
  "Under the DPDP Act, personal data of children requires verifiable parental consent before processing.",
  "Great white sharks can detect one drop of blood in 100 liters of water from miles away.",
  "Consent managers are introduced as an entirely new class of fiduciaries to help data principals manage their permissions.",
  "The immortal jellyfish, Turritopsis dohrnii, can revert entirely to a sexually immature colonial stage after reaching adulthood.",
  "Exemptions are granted for the processing of personal data in the interest of prevention of offenses or national security.",
  "Vampire squids do not ink; instead, they eject a sticky cloud of bioluminescent mucus to confuse predators.",
  "Fines for breaching the data protection provisions can extend up to two hundred and fifty crore rupees.",
  "Orcas, actually the largest member of the dolphin family, have highly complex social structures and hunting dialects."
];

const generateDecoyText = () => {
  const blocks = [];
  for (let i = 0; i < 200; i++) {
    let paragraph = "";
    const numSentences = (i % 6) + 5; // 5 to 10 sentences
    for (let j = 0; j < numSentences; j++) {
      const idx = (i * 11 + j * 7) % sentences.length;
      paragraph += sentences[idx] + " ";
    }
    blocks.push(paragraph.trim());
  }
  return blocks;
};

const decoyParagraphs = generateDecoyText();

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      router.push('/chat');
    }
  }, [user, loading, router]);

  // Handle continuous clicks with a timeout reset
  useEffect(() => {
    if (clickCount > 0 && clickCount < 5) {
      const timer = setTimeout(() => {
        setClickCount(0); // Reset if not clicked fast enough
      }, 600); // 600ms window between clicks
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const handleSecretClick = () => {
    setClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        signIn();
        return 0;
      }
      return newCount;
    });
  };

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-white">
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#faf9f6] text-[#333] p-4 sm:p-8 font-sans leading-relaxed">
      <div className="max-w-4xl mx-auto w-full">
        <h1 
          className="text-2xl sm:text-4xl font-bold mb-6 cursor-default select-none text-[#1a365d] border-b-2 border-[#1a365d] pb-4"
          onClick={handleSecretClick}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Comprehensive Analysis: Indian Digital Data Privacy & Marine Biological Ecosystems
        </h1>
        
        <div className="text-sm sm:text-base text-gray-700 space-y-6 select-none opacity-80 cursor-default">
          {decoyParagraphs.map((para, index) => (
            <p key={index} className="text-justify leading-7">
              {para}
            </p>
          ))}
        </div>
      </div>
    </main>
  );
}
