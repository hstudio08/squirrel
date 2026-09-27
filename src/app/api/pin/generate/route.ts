import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    if (decodedToken.email !== 'officialhaadi81@gmail.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const pin = crypto.randomInt(1000, 9999).toString();
    const hash = crypto.createHash('sha256').update(pin).digest('hex');
    
    await adminDb.collection('pinSessions').doc(hash).set({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // now + 30m
      used: false
    });
    
    return NextResponse.json({ pin });
  } catch (error) {
    console.error('Error in /api/pin/generate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
