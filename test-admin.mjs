import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

try {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  console.log("Firebase initialized successfully");
  const auth = getAuth();
  console.log("Auth initialized successfully");
  await auth.getUserByEmail('officialhaadi81@gmail.com');
  console.log("Network call successful");
} catch (e) {
  console.error("Error:", e);
}
