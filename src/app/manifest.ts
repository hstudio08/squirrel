import { MetadataRoute } from 'next';
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI Plus',
    short_name: 'AI Plus',
    description: 'Advanced AI System',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
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
