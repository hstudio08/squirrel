import { NextRequest, NextResponse } from 'next/server';

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
    
    const allowedEmails = ['officialhaadi81@gmail.com', 'lonehaadi81@gmail.com', 'sadiyaayoub22019@gmail.com'];
    if (!decodedToken.email || !allowedEmails.includes(decodedToken.email) || !decodedToken.email_verified) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const { receiverUid } = await req.json();

    if (!receiverUid) {
      return NextResponse.json({ error: 'Missing receiverUid' }, { status: 400, headers: corsHeaders });
    }

    const tokensDoc = await adminDb.collection('users').doc(receiverUid).collection('private').doc('tokens').get();
    
    let tokens: string[] = [];
    if (tokensDoc.exists) {
      const tokensData = tokensDoc.data();
      tokens = tokensData?.fcmTokens || (tokensData?.fcmToken ? [tokensData.fcmToken] : []);
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No FCM tokens found for user' }, { status: 422, headers: corsHeaders });
    }

    const origin = req.nextUrl.origin;
    const robustIconUrl = 'https://raw.githubusercontent.com/hstudio08/squirrel/main/public/iconii.png';

    // Send the notification using Admin SDK
    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'Sandbox Notification Test',
        body: 'This is a test notification from the Sandbox page!',
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
          sound: 'default'
        }
      }
    });

    return NextResponse.json({ success: true, response }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
