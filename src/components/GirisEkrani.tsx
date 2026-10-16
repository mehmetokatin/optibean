import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RENK } from '../constants/optibean';
import { supabase } from '../lib/supabase';

export default function GirisEkrani() {
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  async function girisYap() {
    if (!eposta || !sifre) {
      setHata('E-posta ve şifreyi gir.');
      return;
    }
    setYukleniyor(true);
    setHata('');
    const { error } = await supabase.auth.signInWithPassword({ email: eposta.trim(), password: sifre });
    setYukleniyor(false);
    if (error) {
      setHata('Giriş yapılamadı: e-posta ya da şifre hatalı.');
    }
    // Başarılıysa ana ekran oturum değişikliğini fark edip kendini açar.
  }

  return (
    <View style={styles.ekran}>
      <Image source={require('../../assets/images/optibean-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.baslik}>Yönetim Paneli</Text>

      <TextInput
        style={styles.girdi}
        placeholder="E-posta"
        placeholderTextColor={RENK.murekkepYumusak}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={eposta}
        onChangeText={(t) => {
          setEposta(t);
          setHata('');
        }}
      />
      <TextInput
        style={styles.girdi}
        placeholder="Şifre"
        placeholderTextColor={RENK.murekkepYumusak}
        secureTextEntry
        autoComplete="password"
        value={sifre}
        onChangeText={(t) => {
          setSifre(t);
          setHata('');
        }}
        onSubmitEditing={girisYap}
      />
      {hata ? <Text style={styles.hata}>{hata}</Text> : null}

      <Pressable style={styles.buton} onPress={girisYap} disabled={yukleniyor}>
        {yukleniyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.butonMetin}>Giriş yap</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: RENK.krema, padding: 24, justifyContent: 'center' },
  logo: { width: 200, height: 162, alignSelf: 'center' },
  baslik: { fontSize: 20, fontWeight: '900', color: RENK.murekkep, textAlign: 'center', marginBottom: 28 },
  girdi: {
    backgroundColor: RENK.sut,
    borderWidth: 2,
    borderColor: RENK.murekkep,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: RENK.murekkep,
    marginBottom: 12,
  },
  hata: { color: '#B3263E', fontWeight: '700', marginBottom: 8 },
  buton: {
    backgroundColor: RENK.murekkep,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  butonMetin: { color: RENK.sut, fontSize: 18, fontWeight: '900' },
});
