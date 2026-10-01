import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whyitworks.squirrel',
  appName: 'Squirrel',
  webDir: 'out',
  server: {
    url: 'https://mysquirrel.vercel.app',
    cleartext: true
  }
};

export default config;
