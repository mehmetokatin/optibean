import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

// Alt sekme çubuğu (Home/Explore) kaldırıldı: uygulama tek ana ekran + kendi ekranları üzerinden ilerliyor.
// Uygulama markası açık renkli olduğu için her zaman açık tema kullanılıyor.
export default function KokDuzen() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
