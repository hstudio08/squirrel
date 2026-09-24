import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ALLOWED_EMAILS = [
  'officialhaadi81@gmail.com',
  'sadiyaayoub22019@gmail.com'
];

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { adminAuth } = await import('@/lib/firebase-admin');
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const email = decodedToken.email?.toLowerCase();

    if (!email || !ALLOWED_EMAILS.includes(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      console.error('Missing CLOUDINARY_API_SECRET environment variable.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary signature requires alphabetically sorted parameters
    // 't' (timestamp) comes before 'u' (upload_preset)
    const signatureString = `timestamp=${timestamp}&upload_preset=Squirrel${apiSecret}`;
    
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    return NextResponse.json({ timestamp, signature });

  } catch (error) {
    console.error('Error generating signature:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
