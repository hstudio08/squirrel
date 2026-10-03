import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

const ALLOWLIST = [
  'officialhaadi81@gmail.com',
  'sadiyaayoub22019@gmail.com'
];

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    if (!decodedToken.email || !ALLOWLIST.includes(decodedToken.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await req.json();
    const { pin } = body;
    if (!pin) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const uid = decodedToken.uid;
    const rateLimitRef = adminDb.collection('users').doc(uid).collection('private').doc('rateLimit');
    
    const rateLimitResult = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const now = Date.now();
      const WINDOW_MS = 15 * 60 * 1000;
      
      let attempts = 0;
      let windowStart = now;
      
      if (doc.exists) {
        const data = doc.data()!;
        if (now - data.windowStart < WINDOW_MS) {
          attempts = data.attempts || 0;
          windowStart = data.windowStart;
        }
      }
      
      if (attempts >= 5) {
        return { ok: false, status: 429, attempts, windowStart };
      }
      return { ok: true, attempts, windowStart };
    });

    if (!rateLimitResult.ok) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    const hash = crypto.createHash('sha256').update(pin).digest('hex');
    const sessionRef = adminDb.collection('pinSessions').doc(hash);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
      await incrementRateLimit(rateLimitRef, rateLimitResult.attempts, rateLimitResult.windowStart);
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }
    
    const sessionData = sessionDoc.data()!;
    const expiresAt = sessionData.expiresAt.toDate();
    if (Date.now() > expiresAt.getTime() || sessionData.used === true) {
      await incrementRateLimit(rateLimitRef, rateLimitResult.attempts, rateLimitResult.windowStart);
      return NextResponse.json({ error: 'Invalid or expired PIN' }, { status: 401 });
    }
    
    await sessionRef.update({ used: true });
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in /api/pin/verify:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function incrementRateLimit(ref: FirebaseFirestore.DocumentReference, attempts: number, windowStart: number) {
  await ref.set({
    attempts: attempts + 1,
    windowStart: windowStart
  }, { merge: true });
}
