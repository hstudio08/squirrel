import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whyitworks.squirrel',
  appName: 'Calculator',
  webDir: 'out',
  server: {
    url: 'https://mysquirrel.vercel.app',
    cleartext: true,
    allowNavigation: [
      'accounts.google.com',
      'mysquirrel.firebaseapp.com',
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.cloudinary.com'
    ]
  },
  android: {
    overrideUserAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#000000',
      showSpinner: false
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"]
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
