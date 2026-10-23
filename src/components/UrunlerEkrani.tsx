import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KATEGORILER, RENK, type Kategori } from '../constants/optibean';
import { supabase } from '../lib/supabase';

// Veritabanındaki `urunler` tablosunun bir satırı
type UrunSatiri = {
  id: number;
  ad: string;
  kategori: Kategori;
  renk: string | null;
  satis_fiyati: number;
  notu: string | null;
  aktif: boolean;
};

// Düzenleme penceresindeki form; id yoksa yeni ürün demektir.
type Form = { id?: number; ad: string; kategori: Kategori; fiyat: string; notu: string; renk: string; aktif: boolean };

const RENK_SECENEKLERI = ['#FF7A90', '#FFBE3D', '#9BCB5A', '#3D8BD9', '#9B5BC8', '#B0204F', '#6B3E26', '#D9963F', '#FFF0C2', '#E6D9BC'];
const SADECE_KATEGORILER = KATEGORILER.filter((k) => k.id !== 'hepsi') as { id: Kategori; ad: string }[];

type Props = { onGeri: () => void };

export default function UrunlerEkrani({ onGeri }: Props) {
  const [urunler, setUrunler] = useState<UrunSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kategori, setKategori] = useState<Kategori | 'hepsi'>('hepsi');
  const [form, setForm] = useState<Form | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [topluFiyat, setTopluFiyat] = useState('');

  const yukle = useCallback(async () => {
    const { data, error } = await supabase
      .from('urunler')
      .select('id, ad, kategori, renk, satis_fiyati, notu, aktif')
      .order('kategori')
      .order('ad');
    setYukleniyor(false);
    if (error) {
      Alert.alert('Hata', 'Ürünler yüklenemedi.');
      return;
    }
    setUrunler(data.map((u) => ({ ...u, satis_fiyati: Number(u.satis_fiyati) })) as UrunSatiri[]);
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const gorunen = kategori === 'hepsi' ? urunler : urunler.filter((u) => u.kategori === kategori);
  const aktifSayisi = urunler.filter((u) => u.aktif).length;

  function yeniUrun() {
    setForm({
      ad: '',
      kategori: kategori === 'hepsi' ? 'meyveli' : kategori,
      fiyat: '',
      notu: '',
      renk: RENK_SECENEKLERI[0],
      aktif: true,
    });
  }

  function duzenle(u: UrunSatiri) {
    setForm({
      id: u.id,
      ad: u.ad,
      kategori: u.kategori,
      fiyat: String(u.satis_fiyati),
      notu: u.notu ?? '',
      renk: u.renk ?? RENK_SECENEKLERI[0],
      aktif: u.aktif,
    });
  }

  async function kaydet() {
    if (!form) return;
    const fiyat = Number(form.fiyat.replace(',', '.'));
    if (!form.ad.trim()) {
      Alert.alert('Eksik bilgi', 'Lezzet adını yaz.');
      return;
    }
    if (!form.fiyat || isNaN(fiyat) || fiyat < 0) {
      Alert.alert('Geçersiz fiyat', 'Fiyatı sayı olarak yaz, örn. 65');
      return;
    }

    const satir = {
      ad: form.ad.trim(),
      kategori: form.kategori,
      satis_fiyati: fiyat,
      notu: form.notu.trim() || null,
      renk: form.renk,
      aktif: form.aktif,
    };

    setKaydediliyor(true);
    const { error } = form.id
      ? await supabase.from('urunler').update(satir).eq('id', form.id)
      : await supabase.from('urunler').insert(satir);
    setKaydediliyor(false);

    if (error) {
      const ayniIsim = error.code === '23505';
      Alert.alert('Kaydedilemedi', ayniIsim ? 'Bu isimde bir lezzet zaten var.' : error.message);
      return;
    }
    setForm(null);
    yukle();
  }

  async function aktiflikDegistir(u: UrunSatiri) {
    // Ekranı hemen güncelle, sonra veritabanına yaz (hata olursa geri al).
    setUrunler((liste) => liste.map((x) => (x.id === u.id ? { ...x, aktif: !u.aktif } : x)));
    const { error } = await supabase.from('urunler').update({ aktif: !u.aktif }).eq('id', u.id);
    if (error) {
      setUrunler((liste) => liste.map((x) => (x.id === u.id ? { ...x, aktif: u.aktif } : x)));
      Alert.alert('Hata', 'Durum değiştirilemedi.');
    }
  }

  function kategoriyeFiyatUygula() {
    if (kategori === 'hepsi') return;
    const fiyat = Number(topluFiyat.replace(',', '.'));
    if (!topluFiyat || isNaN(fiyat) || fiyat < 0) {
      Alert.alert('Geçersiz fiyat', 'Fiyatı sayı olarak yaz, örn. 65');
      return;
    }
    const kategoriAdi = KATEGORILER.find((k) => k.id === kategori)?.ad;
    const adet = urunler.filter((u) => u.kategori === kategori).length;
    Alert.alert('Toplu fiyat', `${kategoriAdi} kategorisindeki ${adet} lezzetin fiyatı ${fiyat} ₺ olacak. Onaylıyor musun?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Uygula',
        onPress: async () => {
          const { error } = await supabase.from('urunler').update({ satis_fiyati: fiyat }).eq('kategori', kategori);
          if (error) {
            Alert.alert('Hata', error.message);
            return;
          }
          setTopluFiyat('');
          yukle();
        },
      },
    ]);
  }

  return (
    <View style={styles.ekran}>
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onGeri}>
          <Text style={styles.geri}>‹ Ana sayfa</Text>
        </Pressable>
        <View style={styles.baslikSatiri}>
          <Text style={styles.baslik}>Ürünler</Text>
          <Pressable style={styles.ekleButon} onPress={yeniUrun}>
            <Text style={styles.ekleMetin}>+ Yeni lezzet</Text>
          </Pressable>
        </View>
        <Text style={styles.ozet}>
          {aktifSayisi} lezzet satışta · {urunler.length - aktifSayisi} pasif
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreler}>
          {KATEGORILER.map((k) => (
            <Pressable
              key={k.id}
              style={[styles.filtre, kategori === k.id && styles.filtreSecili]}
              onPress={() => setKategori(k.id)}
            >
              <Text style={[styles.filtreMetin, kategori === k.id && styles.filtreMetinSecili]}>{k.ad}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {kategori !== 'hepsi' && (
          <View style={styles.topluKutu}>
            <Text style={styles.topluEtiket}>Bu kategorinin tüm fiyatları</Text>
            <View style={styles.topluSatir}>
              <TextInput
                style={styles.topluGirdi}
                placeholder="₺"
                placeholderTextColor={RENK.murekkepYumusak}
                keyboardType="decimal-pad"
                value={topluFiyat}
                onChangeText={setTopluFiyat}
              />
              <Pressable style={styles.topluButon} onPress={kategoriyeFiyatUygula}>
                <Text style={styles.topluButonMetin}>Uygula</Text>
              </Pressable>
            </View>
          </View>
        )}

        {yukleniyor ? (
          <ActivityIndicator color={RENK.murekkep} style={{ marginTop: 30 }} />
        ) : (
          gorunen.map((u) => (
            <Pressable key={u.id} style={[styles.satir, !u.aktif && styles.satirPasif]} onPress={() => duzenle(u)}>
              <View style={[styles.top, { backgroundColor: u.renk ?? '#DDD' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.urunAd}>{u.ad}</Text>
                <Text style={styles.urunAlt}>
                  {KATEGORILER.find((k) => k.id === u.kategori)?.ad}
                  {u.notu ? ` · ${u.notu}` : ''}
                </Text>
              </View>
              <Text style={styles.fiyat}>{u.satis_fiyati} ₺</Text>
              <Switch
                value={u.aktif}
                onValueChange={() => aktiflikDegistir(u)}
                trackColor={{ true: RENK.pembe, false: '#CCC' }}
                ios_backgroundColor="#CCC"
              />
            </Pressable>
          ))
        )}
        <Text style={styles.ipucu}>Düzenlemek için bir lezzete dokun. Anahtar kapalıysa lezzet satış ekranında görünmez.</Text>
      </ScrollView>

      <Modal visible={form !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setForm(null)}>
        {form && (
          <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.modalIcerik} keyboardShouldPersistTaps="handled">
              <View style={styles.modalUst}>
                <Pressable onPress={() => setForm(null)}>
                  <Text style={styles.vazgec}>Vazgeç</Text>
                </Pressable>
                <Text style={styles.modalBaslik}>{form.id ? 'Lezzeti düzenle' : 'Yeni lezzet'}</Text>
                <View style={{ width: 60 }} />
              </View>

              <Text style={styles.etiket}>Ad</Text>
              <TextInput
                style={styles.girdi}
                value={form.ad}
                onChangeText={(ad) => setForm({ ...form, ad })}
                placeholder="örn. Fındık"
                placeholderTextColor={RENK.murekkepYumusak}
              />

              <Text style={styles.etiket}>Top fiyatı (₺)</Text>
              <TextInput
                style={styles.girdi}
                value={form.fiyat}
                onChangeText={(fiyat) => setForm({ ...form, fiyat })}
                keyboardType="decimal-pad"
                placeholder="örn. 65"
                placeholderTextColor={RENK.murekkepYumusak}
              />

              <Text style={styles.etiket}>Kategori</Text>
              <View style={styles.secenekler}>
                {SADECE_KATEGORILER.map((k) => (
                  <Pressable
                    key={k.id}
                    style={[styles.filtre, form.kategori === k.id && styles.filtreSecili]}
                    onPress={() => setForm({ ...form, kategori: k.id })}
                  >
                    <Text style={[styles.filtreMetin, form.kategori === k.id && styles.filtreMetinSecili]}>{k.ad}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.etiket}>Renk</Text>
              <View style={styles.secenekler}>
                {Array.from(new Set([form.renk, ...RENK_SECENEKLERI])).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setForm({ ...form, renk: r })}
                    style={[styles.renkTop, { backgroundColor: r }, form.renk === r && styles.renkSecili]}
                  />
                ))}
              </View>

              <Text style={styles.etiket}>Not (isteğe bağlı)</Text>
              <TextInput
                style={styles.girdi}
                value={form.notu}
                onChangeText={(notu) => setForm({ ...form, notu })}
                placeholder="örn. Bize özel"
                placeholderTextColor={RENK.murekkepYumusak}
              />

              <View style={styles.aktifSatir}>
                <Text style={styles.etiket}>Satışta</Text>
                <Switch
                  value={form.aktif}
                  onValueChange={(aktif) => setForm({ ...form, aktif })}
                  trackColor={{ true: RENK.pembe, false: '#CCC' }}
                  ios_backgroundColor="#CCC"
                />
              </View>

              <Pressable style={styles.kaydetButon} onPress={kaydet} disabled={kaydediliyor}>
                {kaydediliyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.kaydetMetin}>Kaydet</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: 'transparent' },
  icerik: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep },
  ekleButon: { backgroundColor: RENK.pembe, borderWidth: 2, borderColor: RENK.murekkep, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  ekleMetin: { fontWeight: '900', color: RENK.murekkep },
  ozet: { color: RENK.murekkepYumusak, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  filtreler: { gap: 8, paddingBottom: 14 },
  filtre: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut },
  filtreSecili: { backgroundColor: RENK.murekkep },
  filtreMetin: { fontWeight: '800', color: RENK.murekkep },
  filtreMetinSecili: { color: RENK.sut },
  topluKutu: { backgroundColor: RENK.sut, borderRadius: 16, borderWidth: 2, borderColor: RENK.cizgi, padding: 12, marginBottom: 12 },
  topluEtiket: { fontWeight: '800', color: RENK.murekkep, marginBottom: 8 },
  topluSatir: { flexDirection: 'row', gap: 8 },
  topluGirdi: { flex: 1, borderWidth: 2, borderColor: RENK.murekkep, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: RENK.murekkep },
  topluButon: { backgroundColor: RENK.murekkep, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  topluButonMetin: { color: RENK.sut, fontWeight: '900' },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RENK.sut,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: RENK.murekkep,
    padding: 12,
    marginBottom: 8,
  },
  satirPasif: { opacity: 0.45 },
  top: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: RENK.murekkep },
  urunAd: { fontSize: 15, fontWeight: '800', color: RENK.murekkep },
  urunAlt: { fontSize: 12, color: RENK.murekkepYumusak, marginTop: 1 },
  fiyat: { fontSize: 15, fontWeight: '900', color: RENK.murekkep },
  ipucu: { color: RENK.murekkepYumusak, fontSize: 12, textAlign: 'center', marginTop: 12 },
  modal: { flex: 1, backgroundColor: RENK.krema },
  modalIcerik: { padding: 20, paddingBottom: 60 },
  modalUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  vazgec: { color: RENK.murekkepYumusak, fontWeight: '700', fontSize: 16, width: 60 },
  modalBaslik: { fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  etiket: { fontWeight: '800', color: RENK.murekkep, marginTop: 14, marginBottom: 6 },
  girdi: {
    backgroundColor: RENK.sut,
    borderWidth: 2,
    borderColor: RENK.murekkep,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: RENK.murekkep,
  },
  secenekler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  renkTop: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: RENK.murekkep },
  renkSecili: { borderWidth: 4, transform: [{ scale: 1.15 }] },
  aktifSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  kaydetButon: {
    backgroundColor: RENK.murekkep,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  kaydetMetin: { color: RENK.sut, fontSize: 18, fontWeight: '900' },
});
