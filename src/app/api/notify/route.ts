import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';

const FAKE_MESSAGES = [
  "Your AI assistant has something new for you.",
  "Your AI session is ready to continue.",
  "A new AI insight is waiting.",
  "Your AI assistant just finished processing.",
  "A fresh AI response is ready.",
  "Your AI workspace has been updated.",
  "Your AI assistant is ready when you are.",
  "A new AI thought is waiting for you.",
  "Your AI assistant has a new update for you.",
  "Your latest AI interaction is ready."
];

export async function POST(req: NextRequest) {
  try {
    const { receiverUid } = await req.json();

    if (!receiverUid) {
      return NextResponse.json({ error: 'Missing receiverUid' }, { status: 400 });
    }

    // Get the receiver's token from Firestore
    const userDoc = await adminDb.collection('users').doc(receiverUid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (!token) {
      return NextResponse.json({ error: 'No FCM token found for user' }, { status: 422 });
    }

    // Pick a random decoy message
    const randomMessage = FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)];

    // Send the notification using Admin SDK
    const response = await adminMessaging.send({
      token,
      notification: {
        title: 'AI Plus',
        body: randomMessage,
        // The logo you asked for!
        imageUrl: 'https://hstudio08.github.io/squirrel/iconii.png', 
      },
      webpush: {
        notification: {
          icon: '/iconii.png',
          vibrate: [200, 100, 200],
          click_action: 'https://hstudio08.github.io/squirrel/chat'
        }
      }
    });

    return NextResponse.json({ success: true, response });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
