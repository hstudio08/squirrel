'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import { Menu, Search, Share2, MessageSquare } from 'lucide-react';

export default function DecoyPage() {
  const [clickCount, setClickCount] = useState(0);
  const router = useRouter();
  const lastClickRef = useRef<number>(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.email && allowedEmails.includes(user.email)) {
        router.push('/chat');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSecretClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    let currentCount = clickCount;
    
    // Reset if more than 1 second between clicks
    if (now - lastClickRef.current > 1000) {
      currentCount = 0;
    }
    
    currentCount++;
    setClickCount(currentCount);
    lastClickRef.current = now;

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1000);

    if (currentCount >= 5) {
      setClickCount(0);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      signInWithPopup(auth, provider)
                  .then(async (result) => {
            const email = result.user?.email;
            if (email && allowedEmails.includes(email)) {
              await setDoc(doc(db, 'users', result.user.uid), {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
                lastLogin: serverTimestamp()
              }, { merge: true });
              router.push('/chat');
          } else {
            auth.signOut();
            alert('Unauthorized access.');
          }
        })
        .catch((error) => {
          console.error('Login failed', error);
        });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f9f9f9] text-[#222] font-sans pb-safe">
      {/* Fake Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Menu className="w-6 h-6 text-gray-600" />
          <span className="font-extrabold text-2xl tracking-tighter text-[#1a56db]">MobileDaily</span>
        </div>
        <Search className="w-5 h-5 text-gray-600" />
      </header>
      
      {/* Article Content - Removed max-w and margins to make it full width edge-to-edge */}
      <main className="w-full bg-white shadow-sm min-h-screen">
        <div className="px-4 pt-6">
          <div className="text-xs sm:text-sm text-gray-500 font-bold mb-3 uppercase tracking-widest text-[#1a56db]">News • Rumors</div>
          <h1 className="text-3xl sm:text-5xl font-black text-black leading-tight sm:leading-tight mb-6" onClick={handleSecretClick} style={{ cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent" }}>
            Galaxy S27 Ultra camera details: No 4x optical zoom, says reliable source
          </h1>
          
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-400 font-bold text-xl">
                RJ
              </div>
              <div>
                <div className="font-bold text-sm text-gray-900">Ryan Jackson</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">September 19, 2026 • 3 min read</div>
              </div>
            </div>
            <div className="flex gap-4 text-gray-400">
              <button className="hover:text-[#1a56db] transition-colors"><Share2 className="w-5 h-5" /></button>
              <button className="hover:text-[#1a56db] transition-colors"><MessageSquare className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        {/* Edge-to-edge Hero Image */}
        <div className="w-full h-64 sm:h-96 relative mb-6">
          <Image 
            src="https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?q=80&w=1200&auto=format&fit=crop" 
            alt="Samsung Galaxy Ultra" 
            fill
            className="object-cover"
            priority
          />
        </div>
        
        {/* Article body */}
        <div className="prose prose-lg max-w-none text-gray-800 space-y-6 text-[17px] leading-relaxed px-4 pb-6">
          <p>
            Back in late August, a rumor claimed Samsung would equip the <a href="#" className="text-[#1a56db] hover:underline font-medium decoration-2">Galaxy S27 Ultra</a> with <a href="#" className="text-[#1a56db] hover:underline font-medium decoration-2">a new telephoto camera</a> with 4x optical zoom. This would have used a 1/1.9" type sensor. Earlier this week, however, <a href="#" className="text-[#1a56db] hover:underline font-medium decoration-2">another source vehemently denied this</a>, claiming that the S27 Ultra would have the exact same 5x optical zoom telephoto camera as <a href="#" className="text-[#1a56db] hover:underline font-medium decoration-2">its predecessor</a>.
          </p>
          
          <p>
            Today a new, usually reliable source has chimed in on the controversy as well. According to Roland Quandt, the Galaxy S27 Ultra will use a 50MP 5x optical zoom telephoto camera with a Sony sensor. So it's not going to be 4x optical zoom, which strongly implies that it will indeed be the same camera seen in the Galaxy S26 Ultra.
          </p>

          <div className="w-full h-56 sm:h-80 relative my-8 -mx-4 w-[calc(100%+2rem)]">
            <Image 
              src="https://images.unsplash.com/photo-1610792516307-ea5af9a6f7b3?q=80&w=1200&auto=format&fit=crop" 
              alt="Samsung Camera Module" 
              fill
              className="object-cover"
            />
          </div>
          
          <div className="bg-[#f3f6fc] p-5 sm:p-6 border-l-4 border-[#1a56db] my-8 rounded-r-xl">
            <p className="text-sm font-bold text-[#1a56db] mb-2 uppercase tracking-wide">Related coverage</p>
            <a href="#" className="text-lg font-semibold text-gray-900 hover:text-[#1a56db] transition-colors">Samsung details its impressively bright M16 OLED display coming to next-gen flagships</a>
          </div>

          <p>
            Quandt also mentions that the Galaxy S27 Ultra's ultrawide camera will have 50MP resolution, matching the S26 Ultra. Finally, he says the upcoming flagship will have a 16MP selfie camera with autofocus. That would be a change from the S26 Ultra's 12MP selfie snapper.
          </p>

          <p>
            The Samsung Galaxy S27 Ultra is expected to feature the recently unveiled M16 OLED panel, and it will be powered, at least in some markets, by the upcoming Snapdragon 8 Elite Gen 6 Pro chipset (though there have been rumors about the <a href="#" className="text-[#1a56db] hover:underline font-medium decoration-2">Exynos 2700 being offered</a> in some markets). For users invested in the broader ecosystem, connectivity is expected to improve alongside accessories like the Samsung Duo line, making cross-device multitasking even more seamless.
          </p>
        </div>
        
        {/* Fake Tags/Share */}
        <div className="px-4 mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-2 pb-10">
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">Samsung</span>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">Galaxy S27 Ultra</span>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold uppercase tracking-wider">Rumors</span>
        </div>
      </main>

        <div className="bg-white border-t border-gray-200 mt-12 py-10 px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Comments (14)</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">JD</div>
              <div>
                <p className="text-sm font-bold text-gray-900">John Doe <span className="text-gray-400 font-normal ml-2">2 hours ago</span></p>
                <p className="text-gray-700 mt-1 text-sm">Honestly, keeping the 5x is fine. I just want them to focus on the software processing and shutter lag. The S26 Ultra is already a beast.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0">MT</div>
              <div>
                <p className="text-sm font-bold text-gray-900">TechManiac <span className="text-gray-400 font-normal ml-2">5 hours ago</span></p>
                <p className="text-gray-700 mt-1 text-sm">Wait, so the 4x rumor was just a test unit? That makes sense. I prefer the 50MP 5x anyway, it gives much better detail at 10x crop.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">AL</div>
              <div>
                <p className="text-sm font-bold text-gray-900">AndroidLover99 <span className="text-gray-400 font-normal ml-2">1 day ago</span></p>
                <p className="text-gray-700 mt-1 text-sm">They need to bring back the 10x optical. I miss the 10x periscope from the older ultras. Everything else sounds amazing though, especially the 3nm chip!</p>
              </div>
            </div>
          </div>
          <button className="w-full mt-8 py-3 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50 transition-colors">Load more comments</button>
        </div>

      
      {/* Fake Footer */}
      <footer className="bg-[#111827] text-white py-12 sm:py-16 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="font-extrabold text-xl mb-4 text-[#1a56db]">MobileDaily</div>
            <p className="text-sm text-gray-400">Your trusted source for mobile news, leaks, and reviews since 2012.</p>
          </div>
          <div>
            <div className="font-bold mb-4 text-gray-200">Categories</div>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">Phones</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Tablets</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Wearables</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Software</a></li>
            </ul>
          </div>
          <div>
            <div className="font-bold mb-4 text-gray-200">Company</div>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Editorial Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Advertise</a></li>
            </ul>
          </div>
          <div>
            <div className="font-bold mb-4 text-gray-200">Legal</div>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Use</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-3xl mx-auto text-center text-sm text-gray-500 mt-12 border-t border-gray-800 pt-8">
          © 2026 MobileDaily Media Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
