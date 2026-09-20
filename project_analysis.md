# Squirrel Project Analysis

## Overview
Squirrel is a real-time chat application built using **Next.js 14/15 (App Router)** and **Firebase** (Firestore for messages, Realtime Database for presence). It features a highly polished, mobile-optimized UI using **Tailwind CSS** with advanced glassmorphism ("liquid glass" styling), animations, and a rich feature set typical of modern messengers like WhatsApp/Telegram.

## Technology Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (v4), Lucide React (Icons)
- **Backend/BaaS:** Firebase (Auth, Firestore, Realtime Database)
- **Image Handling:** browser-image-compression, react-image-crop (and Cloudinary integrations)
- **PWA:** Manifest, Service Workers, Custom Installation Prompts

## File Structure & Deep Dive

### 1. `package.json` & Configuration Files
- **Dependencies:** `firebase`, `firebase-admin`, `lucide-react`, `next`, `react`, `react-image-crop`, `browser-image-compression`, `emoji-picker-react`.
- **Dev Dependencies:** `tailwindcss`, `eslint`, `@firebase/rules-unit-testing`, `typescript`.
- Configured as a Next.js web application utilizing Tailwind CSS for styling.

### 2. `src/app/` (Next.js App Router)
- **`layout.tsx` & `globals.css`:** Root layout wrapping the application. Injects global CSS containing custom `@keyframes` for animations (`animate-pop-in`, `animate-fade-in`, etc.) and PWA configurations.
- **`page.tsx`:** The root landing page. Disguised as an enterprise landing page for "AI Plus Gateway API" (used as a camouflage/decoy landing page). It routes to the chat if authenticated or unlocked via session storage.
- **`chat/page.tsx`:** The main entry point for the chat interface. Handles authentication checks, PWA unlocking, and renders a complex loader before serving the `ChatUI` component.
- **`api/notify/route.ts`:** Backend endpoint for sending notifications (likely using Firebase Admin SDK).

### 3. `src/components/` (UI Components)
- **`ChatUI.tsx`:** The core engine of the application (1500+ lines). 
  - **Features:** Message virtualization/pagination, read receipts, typing indicators, image upload/cropping, audio capture, emoji picker, context menus, message selection, deletion (for me/everyone), copying, and replying.
  - **Styling:** Highly advanced "liquid glass" navigation bars and floating buttons, heavily optimized for GPU performance (`will-change-transform`, `transform-gpu`).
  - **State Management:** Manages massive local state for typing, recording, image previews, searching, and context menus.
- **`MessageItem.tsx`:** Renders individual chat bubbles.
  - Handles text, images, deleted message placeholders, optimistic reactions, "edited" tags, and timestamp/seen ticks (similar to WhatsApp's blue ticks).
  - Supports swipe-to-reply mechanics using Touch events.
  - Features complex rendering logic for masked emails, blurred texts (for privacy mode), and inline image preview overlays.
- **`ImageEditor.tsx`:** A component that handles client-side image cropping and compression before sending it to the server.
- **`CameraCapture.tsx`:** Integrates `navigator.mediaDevices.getUserMedia` for taking photos directly within the app.

### 4. `src/hooks/` (Custom Hooks)
- **`useAuth.tsx`:** Manages Firebase Authentication state.
  - Contains a hardcoded whitelist of `ALLOWED_EMAILS` (e.g., `officialhaadi81@gmail.com`). 
  - Immediately logs out unauthorized users, reinforcing strict privacy.

### 5. `src/lib/` (Utility & Initialization)
- **`firebase.ts`:** Initializes the client-side Firebase app, Auth, Firestore, and Realtime Database instances.
- **`firebase-admin.ts`:** (Likely) used in API routes for secure backend operations bypassing client rules.

### 6. `src/types/` (TypeScript Definitions)
- **`chat.ts`:** Defines interfaces for `Message` (text, images, seen statuses, edit histories), `User`, and `UserStatus` (online, typing, last seen).

### 7. `public/` (Static Assets & PWA)
- **`sw.js`:** Service worker for offline caching, PWA installation, and potentially push notifications.
- **`notification.mp3`:** Audio file played upon receiving new messages.
- Various icons (`iconii.png`, `file.svg`, etc.) for manifest definition.

## Key Architectural Highlights & Features

1. **Security & Privacy (Camouflage UI):**
   - The root `/` page pretends to be a completely different SaaS product. 
   - A secret "Ghost Mode" / Anonymous Mode is available inside the chat.
   - Email masking is heavily implemented (`getMaskedEmail`).

2. **Real-time Synchronisation:**
   - **Firestore:** Used for permanent storage of messages.
   - **Realtime Database (RTDB):** Used for ephemeral status like typing indicators and online presence ("Date | Time", crossfading animations).

3. **Advanced Mobile Interactions:**
   - **Swipe-to-reply:** `MessageItem` implements touch tracking for swipe gestures.
   - **Liquid Morphism UI:** Uses advanced Tailwind filters (`backdrop-blur-md`, `backdrop-saturate-150`) combined with GPU composite hints to render "liquid glass" elements without lag.
   - **Keyboard Handling:** Detects visual viewport changes to handle virtual keyboards on iOS/Android seamlessly.

4. **Performance Optimizations:**
   - Client-side image compression (`browser-image-compression`) before uploading.
   - GPU-accelerated CSS layers for floating elements to avoid layout thrashing during scroll events.

## Conclusion
Squirrel is a meticulously crafted, highly-private, bespoke messaging application. It hides behind a decoy landing page and uses strict whitelist authentication. The UI prioritizes a native-like fluid experience on the web (PWA), relying heavily on GPU-accelerated "liquid glass" aesthetics and complex touch interactions.
