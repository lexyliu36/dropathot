import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dropathot.app',
  appName: 'Thots.',
  webDir: 'dist',
  server: {
    allowNavigation: [],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0a0f',
    scrollEnabled: false,
  },
  android: {
    backgroundColor: '#0a0a0f',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0a0a0f',
    },
  },
}

export default config
