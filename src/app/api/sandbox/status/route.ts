import { NextResponse } from 'next/server';
import { adminRtdb, adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Get Haadi's User Record by his specific email
    const haadiUser = await adminAuth.getUserByEmail('officialhaadi81@gmail.com');
    const haadiUid = haadiUser.uid;

    // 2. Fetch Haadi's status and settings from Realtime Database using Admin SDK
    const statusSnapshot = await adminRtdb.ref(`/status/${haadiUid}`).once('value');
    const settingsSnapshot = await adminRtdb.ref(`/settings/${haadiUid}/freezePresence`).once('value');

    const status = statusSnapshot.val() || { state: 'offline', last_changed: Date.now() };
    const freezePresence = !!settingsSnapshot.val();

    return NextResponse.json({
      status,
      freezePresence,
    });
  } catch (error: any) {
    console.error('Error fetching sandbox status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
