/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://apis.google.com https://*.firebaseio.com https://www.gstatic.com https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://www.google.com https://www.gstatic.com https://cdn.jsdelivr.net https://images.unsplash.com https://res.cloudinary.com https://lh3.googleusercontent.com https://hstudio08.github.io https://firebasestorage.googleapis.com",
  "connect-src 'self' https://cdn.jsdelivr.net https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://api.cloudinary.com https://res.cloudinary.com https://*.firebaseapp.com https://apis.google.com https://www.googleapis.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://lh3.googleusercontent.com https://firebasestorage.googleapis.com",
  "frame-src 'self' https://squirrel-4f5a6.firebaseapp.com https://*.firebaseapp.com https://*.firebaseio.com https://apis.google.com",
  "object-src 'none'",
  "media-src 'self' blob: https://res.cloudinary.com",
  "worker-src 'self' https://www.gstatic.com blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
