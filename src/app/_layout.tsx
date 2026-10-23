import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import Arkaplan from '@/components/Arkaplan';

SplashScreen.preventAutoHideAsync();

// Ekranlar şeffaf; arkalarında her yerde aynı OptiBean arka planı (inek benekleri, dondurmalar, serpinti) duruyor.
const SeffafTema = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

// Alt sekme çubuğu (Home/Explore) kaldırıldı: uygulama tek ana ekran + kendi ekranları üzerinden ilerliyor.
// Uygulama markası açık renkli olduğu için her zaman açık tema kullanılıyor.
export default function KokDuzen() {
  return (
    <ThemeProvider value={SeffafTema}>
      <View style={{ flex: 1 }}>
        <Arkaplan />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      </View>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
