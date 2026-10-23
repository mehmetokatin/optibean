import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RENK } from '../constants/optibean';
import { supabase } from '../lib/supabase';

// AYARLAR: hesap bilgisi, çıkış ve deneme verilerini sıfırlama.
// Sıfırlama ürünlere, fiyatlara ve kategorilere asla dokunmaz.

type Secim = 'satislar' | 'giderler' | 'stok';

const SECENEKLER: { id: Secim; baslik: string; aciklama: string }[] = [
  { id: 'satislar', baslik: 'Satışlar', aciklama: 'Tüm satış kayıtları ve ciro geçmişi silinir.' },
  { id: 'giderler', baslik: 'Giderler', aciklama: 'Tüm gider kayıtları silinir.' },
  { id: 'stok', baslik: 'Stok', aciklama: 'Üretim ve kutu geçmişi silinir, tüm lezzetlerin kutu sayısı 0 olur.' },
];

const ONAY_KELIMESI = 'SIFIRLA';

type Props = { eposta?: string; onGeri: () => void; onSifirlandi: () => void };

export default function AyarlarEkrani({ eposta, onGeri, onSifirlandi }: Props) {
  const [secili, setSecili] = useState<Record<Secim, boolean>>({ satislar: false, giderler: false, stok: false });
  const [onay, setOnay] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);

  const secililer = SECENEKLER.filter((s) => secili[s.id]);
  const hazir = secililer.length > 0 && onay.trim().toLocaleUpperCase('tr-TR') === ONAY_KELIMESI;

  async function sifirla() {
    if (!hazir) return;
    setCalisiyor(true);
    // Supabase silme işleminde filtre ister; "id > 0" tüm satırları kapsar.
    const hatalar: string[] = [];
    if (secili.satislar) {
      const { error } = await supabase.from('satislar').delete().gt('id', 0); // kalemler de otomatik silinir
      if (error) hatalar.push(`Satışlar: ${error.message}`);
    }
    if (secili.giderler) {
      const { error } = await supabase.from('giderler').delete().gt('id', 0);
      if (error) hatalar.push(`Giderler: ${error.message}`);
    }
    if (secili.stok) {
      const r1 = await supabase.from('kutu_hareketleri').delete().gt('id', 0);
      const r2 = await supabase.from('uretimler').delete().gt('id', 0);
      const r3 = await supabase.from('urunler').update({ kutu_sayisi: 0 }).gt('id', 0);
      for (const r of [r1, r2, r3]) if (r.error) hatalar.push(`Stok: ${r.error.message}`);
    }
    setCalisiyor(false);
    setOnay('');
    setSecili({ satislar: false, giderler: false, stok: false });
    onSifirlandi();

    if (hatalar.length > 0) {
      Alert.alert('Bazı veriler silinemedi', hatalar.join('\n'));
    } else {
      Alert.alert('Sıfırlandı', `${secililer.map((s) => s.baslik).join(', ')} temizlendi.`);
    }
  }

  function cikisYap() {
    Alert.alert('Çıkış yap', 'Hesaptan çıkmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.ekran} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onGeri} hitSlop={10}>
          <Text style={styles.geri}>‹ Ana sayfa</Text>
        </Pressable>
        <Text style={styles.baslik}>Ayarlar</Text>

        <View style={styles.kart}>
          <Text style={styles.kartBaslik}>Hesap</Text>
          <Text style={styles.metin}>{eposta ?? '-'}</Text>
          <Pressable style={styles.ikincilButon} onPress={cikisYap}>
            <Text style={styles.ikincilMetin}>Çıkış yap</Text>
          </Pressable>
        </View>

        <View style={[styles.kart, styles.tehlikeKart]}>
          <Text style={[styles.kartBaslik, { color: '#B3263E' }]}>Verileri sıfırla</Text>
          <Text style={styles.metin}>
            Deneme amaçlı girdiğin kayıtları temizlemek için. Ürünlerin, fiyatların ve kategorilerin silinmez. Bu işlem geri alınamaz.
          </Text>

          {SECENEKLER.map((s) => (
            <Pressable key={s.id} style={styles.secenek} onPress={() => setSecili((x) => ({ ...x, [s.id]: !x[s.id] }))}>
              <View style={[styles.kutucuk, secili[s.id] && styles.kutucukSecili]}>
                {secili[s.id] && <Text style={styles.tik}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.secenekBaslik}>{s.baslik}</Text>
                <Text style={styles.secenekAciklama}>{s.aciklama}</Text>
              </View>
            </Pressable>
          ))}

          {secililer.length > 0 && (
            <>
              <Text style={styles.onayEtiket}>Onaylamak için {ONAY_KELIMESI} yaz</Text>
              <TextInput
                style={styles.girdi}
                value={onay}
                onChangeText={setOnay}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={ONAY_KELIMESI}
                placeholderTextColor="#C9B9B9"
              />
            </>
          )}

          <Pressable style={[styles.tehlikeButon, !hazir && { opacity: 0.3 }]} onPress={sifirla} disabled={!hazir || calisiyor}>
            {calisiyor ? (
              <ActivityIndicator color={RENK.sut} />
            ) : (
              <Text style={styles.tehlikeMetin}>
                {secililer.length === 0 ? 'Sıfırlanacak veriyi seç' : `${secililer.map((s) => s.baslik).join(' + ')} sıfırla`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: 'transparent' },
  icerik: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep, marginBottom: 14 },
  kart: { backgroundColor: RENK.sut, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, padding: 16, marginBottom: 14 },
  tehlikeKart: { borderColor: '#B3263E' },
  kartBaslik: { fontSize: 18, fontWeight: '900', color: RENK.murekkep, marginBottom: 6 },
  metin: { color: RENK.murekkepYumusak, fontWeight: '600', lineHeight: 20 },
  ikincilButon: { marginTop: 12, alignSelf: 'flex-start', borderWidth: 2, borderColor: RENK.murekkep, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  ikincilMetin: { fontWeight: '800', color: RENK.murekkep },
  secenek: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  kutucuk: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: RENK.murekkep, alignItems: 'center', justifyContent: 'center', backgroundColor: RENK.sut },
  kutucukSecili: { backgroundColor: '#B3263E', borderColor: '#B3263E' },
  tik: { color: RENK.sut, fontWeight: '900', fontSize: 16 },
  secenekBaslik: { fontWeight: '900', color: RENK.murekkep, fontSize: 16 },
  secenekAciklama: { color: RENK.murekkepYumusak, fontSize: 13, marginTop: 1 },
  onayEtiket: { fontWeight: '800', color: '#B3263E', marginTop: 18, marginBottom: 6 },
  girdi: {
    borderWidth: 2,
    borderColor: '#B3263E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '900',
    color: RENK.murekkep,
    letterSpacing: 2,
  },
  tehlikeButon: { backgroundColor: '#B3263E', borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  tehlikeMetin: { color: RENK.sut, fontWeight: '900', fontSize: 16 },
});
