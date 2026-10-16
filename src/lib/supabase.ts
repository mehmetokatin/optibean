import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_ANAHTAR, SUPABASE_URL } from '../constants/supabaseAyar';

// Uygulamanın veritabanıyla konuştuğu tek nokta.
// Oturum telefonda saklanır, böylece her açılışta tekrar giriş yapman gerekmez.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANAHTAR, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Uygulama ön plandayken oturumu tazele, arka plandayken durdur.
AppState.addEventListener('change', (durum) => {
  if (durum === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
