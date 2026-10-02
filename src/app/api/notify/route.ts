import { NextRequest, NextResponse } from 'next/server';

const FAKE_MESSAGES = [
  "10"
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    const { adminDb, adminMessaging, adminAuth } = await import('@/lib/firebase-admin');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];
    if (!decodedToken.email || !allowedEmails.includes(decodedToken.email) || !decodedToken.email_verified) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { receiverUid } = await req.json();

    if (!receiverUid) {
      return NextResponse.json({ error: 'Missing receiverUid' }, { status: 400 });
    }

    // Get the receiver's user doc to check settings
    const userDoc = await adminDb.collection('users').doc(receiverUid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.notificationsEnabled === false) {
        return NextResponse.json({ success: true, message: 'Notifications disabled by user' });
      }
    }

    // Get the receiver's token from Firestore
    const tokensDoc = await adminDb.collection('users').doc(receiverUid).collection('private').doc('tokens').get();
    
    let tokens: string[] = [];
    if (tokensDoc.exists) {
      const tokensData = tokensDoc.data();
      tokens = tokensData?.fcmTokens || (tokensData?.fcmToken ? [tokensData.fcmToken] : []);
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No FCM tokens found for user' }, { status: 422 });
    }

    // Pick a random decoy message
    const randomMessage = FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)];

    const origin = req.nextUrl.origin;
    const robustIconUrl = 'https://raw.githubusercontent.com/hstudio08/squirrel/main/public/iconii.png';

    // Send the notification using Admin SDK
    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Calculator',
        body: randomMessage,
        // The logo you asked for!
        imageUrl: robustIconUrl, 
      },
      webpush: {
        notification: {
          icon: robustIconUrl,
          vibrate: [200, 100, 200],
          click_action: `${origin}/`
        }
      }
    });

    return NextResponse.json({ success: true, response });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
