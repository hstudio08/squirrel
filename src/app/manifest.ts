import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Plus',
    short_name: 'AI Plus',
    description: 'Advanced AI System',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/iconii.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/iconii.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/iconii.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
