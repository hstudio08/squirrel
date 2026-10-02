import { MetadataRoute } from 'next';
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Calculator',
    short_name: 'Calculator',
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
