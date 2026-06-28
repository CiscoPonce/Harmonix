import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  'https://moral-sparrow-nationally.ngrok-free.app';

const config: CapacitorConfig = {
  appId: 'com.harmonix.app',
  appName: 'Harmonix',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
