/** @type {import('next').NextConfig} */

const nextConfig = {
  // output is dynamically set below
  trailingSlash: true,
  serverExternalPackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  images: {
    unoptimized: true,
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
};

// For Capacitor Android builds we need static export.
// Vercel automatically sets process.env.VERCEL = "1" so it will skip this
// and correctly deploy the /api/notify serverless function!
if (!process.env.VERCEL) {
  nextConfig.output = 'export';
}

export default nextConfig;
