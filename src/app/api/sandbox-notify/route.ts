import { NextRequest, NextResponse } from 'next/server';

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
    
    const allowedEmails = ['officialhaadi81@gmail.com', 'lonehaadi81@gmail.com'];
    if (!decodedToken.email || !allowedEmails.includes(decodedToken.email) || !decodedToken.email_verified) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the user with email officialhaadi81@gmail.com
    const usersSnapshot = await adminDb.collection('users')
      .where('email', '==', 'officialhaadi81@gmail.com')
      .limit(1)
      .get();
      
    if (usersSnapshot.empty) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetUid = usersSnapshot.docs[0].id;
    const tokensDoc = await adminDb.collection('users').doc(targetUid).collection('private').doc('tokens').get();
    
    let tokens: string[] = [];
    if (tokensDoc.exists) {
      const tokensData = tokensDoc.data();
      tokens = tokensData?.fcmTokens || (tokensData?.fcmToken ? [tokensData.fcmToken] : []);
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: 'No FCM tokens found for target user' }, { status: 422 });
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
      }
    });

    return NextResponse.json({ success: true, response });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
