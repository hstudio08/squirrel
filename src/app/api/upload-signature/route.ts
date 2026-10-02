import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ALLOWED_EMAILS = [
  'officialhaadi81@gmail.com',
  'lonehaadi81@gmail.com'
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
    
    let body = {};
    if (req.headers.get('content-type')?.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    }
    const { folder, public_id, upload_preset } = body as any;

    const params: Record<string, string | number> = {
      timestamp
    };
    if (folder) params.folder = folder;
    if (public_id) params.public_id = public_id;
    if (upload_preset) params.upload_preset = upload_preset;

    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
    
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    return NextResponse.json({ timestamp, signature, folder, public_id });

  } catch (error) {
    console.error('Error generating signature:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
