import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whyitworks.squirrel',
  appName: 'Squirrel',
  webDir: 'out',
  server: {
    url: 'https://mysquirrel.vercel.app',
    cleartext: true,
    allowNavigation: [
      'accounts.google.com',
      'mysquirrel.firebaseapp.com',
      '*.firebaseapp.com',
      '*.googleapis.com'
    ]
  },
  android: {
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]
    }
  }
};

export default config;
