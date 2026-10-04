import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

const FAKE_MESSAGES = [
  "Your calculation has been saved to history.",
  "Result copied to clipboard.",
  "Cannot divide a number by zero.",
  "Please check your expression and try again.",
  "Value stored in calculator memory.",
  "Calculator memory has been cleared.",
  "Switched to scientific mode.",
  "Conversion completed successfully.",
  "Angle mode changed to degrees.",
  "Dark mode is now enabled.",
  "You haven't completed your saved calculation.",
  "Statistics calculated for your selected values.",
  "Calculation history has been cleared.",
  "A new calculator feature is available. Tap to explore."
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    const { adminDb, adminMessaging, adminAuth } = await import('@/lib/firebase-admin');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders });
    }
    
    const allowedEmails = ['officialhaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];
    if (!decodedToken.email || !allowedEmails.includes(decodedToken.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { receiverUid, chatId, messageId, senderToken } = await req.json();

    if (!receiverUid) {
      return NextResponse.json({ error: 'Missing receiverUid' }, { status: 400, headers: corsHeaders });
    }

    // Get the receiver's user doc to check settings
    const userDoc = await adminDb.collection('users').doc(receiverUid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData?.notificationsEnabled === false) {
        return NextResponse.json({ success: true, message: 'Notifications disabled by user' }, { headers: corsHeaders });
      }
    }

    // Get the receiver's token from Firestore
    const tokensDoc = await adminDb.collection('users').doc(receiverUid).collection('private').doc('tokens').get();
    
    let tokens: string[] = [];
    if (tokensDoc.exists) {
      const tokensData = tokensDoc.data();
      tokens = tokensData?.fcmTokens || (tokensData?.fcmToken ? [tokensData.fcmToken] : []);
    }

    if (senderToken) {
      tokens = tokens.filter(t => t !== senderToken);
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No FCM tokens found for user' }, { status: 422, headers: corsHeaders });
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
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          tag: messageId || Date.now().toString()
        }
      }
    });

    // Update delivered status if successful and message details provided
    if (response.successCount > 0 && chatId && messageId) {
      try {
        await adminDb.collection('conversations').doc(chatId).collection('messages').doc(messageId).update({
          delivered: true,
          deliveredAt: FieldValue.serverTimestamp()
        });
      } catch (updateErr) {
        console.error('Failed to update delivered status:', updateErr);
      }
    }

    return NextResponse.json({ success: true, response }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
