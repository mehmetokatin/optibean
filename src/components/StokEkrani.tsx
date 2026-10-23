import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KATEGORILER, KUTU_KG, RENK, type Kategori } from '../constants/optibean';
import { supabase } from '../lib/supabase';

type StokSatiri = { id: number; ad: string; kategori: Kategori; renk: string | null; kutu_sayisi: number; kritik_kutu: number };

type Props = { onGeri: () => void };

export default function StokEkrani({ onGeri }: Props) {
  const [urunler, setUrunler] = useState<StokSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [kategori, setKategori] = useState<Kategori | 'hepsi'>('hepsi');

  // Üretim penceresi
  const [uretimAcik, setUretimAcik] = useState(false);
  const [sutKg, setSutKg] = useState('');
  const [uretimNotu, setUretimNotu] = useState('');
  const [uretimKutular, setUretimKutular] = useState<Record<number, number>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Sayım / ayar penceresi
  const [secili, setSecili] = useState<StokSatiri | null>(null);
  const [sayim, setSayim] = useState('');
  const [kritik, setKritik] = useState('');

  const yukle = useCallback(async () => {
    const { data, error } = await supabase
      .from('urunler')
      .select('id, ad, kategori, renk, kutu_sayisi, kritik_kutu')
      .eq('aktif', true)
      .order('ad');
    setYukleniyor(false);
    if (error) {
      Alert.alert('Hata', 'Stok yüklenemedi. Supabase’de 002_kutu_stok.sql çalıştırıldı mı?');
      return;
    }
    setUrunler(data as StokSatiri[]);
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  async function yenile() {
    setYenileniyor(true);
    await yukle();
    setYenileniyor(false);
  }

  const azalanMi = (u: StokSatiri) => u.kutu_sayisi <= u.kritik_kutu;
  const filtreli = kategori === 'hepsi' ? urunler : urunler.filter((u) => u.kategori === kategori);
  // Azalanlar en üstte, sonra kutu sayısı azdan çoğa
  const sirali = filtreli.slice().sort((a, b) => Number(azalanMi(b)) - Number(azalanMi(a)) || a.kutu_sayisi - b.kutu_sayisi);
  const azalanlar = urunler.filter(azalanMi);
  const toplamKutu = urunler.reduce((t, u) => t + u.kutu_sayisi, 0);

  // "−1 kutu": ekranda hemen düşür, veritabanına yaz, hata olursa geri al
  async function kutuBitti(u: StokSatiri) {
    if (u.kutu_sayisi === 0) return;
    setUrunler((l) => l.map((x) => (x.id === u.id ? { ...x, kutu_sayisi: x.kutu_sayisi - 1 } : x)));
    const { error } = await supabase.rpc('kutu_degistir', { p_urun_id: u.id, p_tur: 'bitti', p_degisim: -1 });
    if (error) {
      setUrunler((l) => l.map((x) => (x.id === u.id ? { ...x, kutu_sayisi: u.kutu_sayisi } : x)));
      Alert.alert('Kaydedilemedi', error.message);
    }
  }

  function ayarAc(u: StokSatiri) {
    setSecili(u);
    setSayim(String(u.kutu_sayisi));
    setKritik(String(u.kritik_kutu));
  }

  async function ayarKaydet() {
    if (!secili) return;
    const yeniSayi = parseInt(sayim, 10);
    const yeniKritik = parseInt(kritik, 10);
    if (isNaN(yeniSayi) || yeniSayi < 0 || isNaN(yeniKritik) || yeniKritik < 0) {
      Alert.alert('Geçersiz değer', 'Kutu sayılarını 0 veya daha büyük tam sayı olarak yaz.');
      return;
    }
    setKaydediliyor(true);
    const fark = yeniSayi - secili.kutu_sayisi;
    const sonuc1 = fark !== 0 ? await supabase.rpc('kutu_degistir', { p_urun_id: secili.id, p_tur: 'duzeltme', p_degisim: fark }) : { error: null };
    const sonuc2 =
      yeniKritik !== secili.kritik_kutu ? await supabase.from('urunler').update({ kritik_kutu: yeniKritik }).eq('id', secili.id) : { error: null };
    setKaydediliyor(false);
    if (sonuc1.error || sonuc2.error) {
      Alert.alert('Kaydedilemedi', (sonuc1.error ?? sonuc2.error)!.message);
      return;
    }
    setSecili(null);
    yukle();
  }

  function uretimAc() {
    setSutKg('');
    setUretimNotu('');
    setUretimKutular({});
    setUretimAcik(true);
  }

  function uretimDegistir(id: number, degisim: number) {
    setUretimKutular((k) => ({ ...k, [id]: Math.max(0, (k[id] ?? 0) + degisim) }));
  }

  const uretimToplamKutu = Object.values(uretimKutular).reduce((t, n) => t + n, 0);

  async function uretimKaydet() {
    const kutular = Object.entries(uretimKutular)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ urun_id: Number(id), kutu: n }));
    if (kutular.length === 0) {
      Alert.alert('Boş üretim', 'En az bir lezzete kutu ekle.');
      return;
    }
    const sut = sutKg ? Number(sutKg.replace(',', '.')) : null;
    if (sut !== null && (isNaN(sut) || sut < 0)) {
      Alert.alert('Geçersiz süt miktarı', 'Süt miktarını kg olarak sayı yaz, örn. 100');
      return;
    }
    setKaydediliyor(true);
    const { error } = await supabase.rpc('uretim_kaydet', { p_sut_kg: sut, p_notu: uretimNotu, p_kutular: kutular });
    setKaydediliyor(false);
    if (error) {
      Alert.alert('Kaydedilemedi', error.message);
      return;
    }
    setUretimAcik(false);
    yukle();
  }

  return (
    <View style={styles.ekran}>
      <ScrollView
        contentContainerStyle={styles.icerik}
        refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} />}
      >
        <Pressable onPress={onGeri}>
          <Text style={styles.geri}>‹ Ana sayfa</Text>
        </Pressable>
        <View style={styles.baslikSatiri}>
          <Text style={styles.baslik}>Stok</Text>
          <Pressable style={styles.uretimButon} onPress={uretimAc}>
            <Text style={styles.uretimButonMetin}>+ Üretim gir</Text>
          </Pressable>
        </View>
        <Text style={styles.ozet}>
          Vitrin ve dolapta {toplamKutu} kutu · yaklaşık {toplamKutu * KUTU_KG} kg
        </Text>

        {azalanlar.length > 0 && (
          <View style={styles.uyari}>
            <Text style={styles.uyariBaslik}>⚠ {azalanlar.length} lezzet azaldı</Text>
            <Text style={styles.uyariMetin}>{azalanlar.map((u) => `${u.ad} (${u.kutu_sayisi})`).join(', ')}</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreler}>
          {KATEGORILER.map((k) => (
            <Pressable key={k.id} style={[styles.filtre, kategori === k.id && styles.filtreSecili]} onPress={() => setKategori(k.id)}>
              <Text style={[styles.filtreMetin, kategori === k.id && styles.filtreMetinSecili]}>{k.ad}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {yukleniyor ? (
          <ActivityIndicator color={RENK.murekkep} style={{ marginTop: 30 }} />
        ) : (
          sirali.map((u) => {
            const azaldi = azalanMi(u);
            return (
              <Pressable key={u.id} style={[styles.satir, azaldi && styles.satirAzaldi]} onPress={() => ayarAc(u)}>
                <View style={[styles.top, { backgroundColor: u.renk ?? '#DDD' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ad}>{u.ad}</Text>
                  <Text style={[styles.alt, azaldi && { color: '#B3263E' }]}>
                    {u.kutu_sayisi === 0 ? 'Bitti!' : `~${u.kutu_sayisi * KUTU_KG} kg`}
                    {azaldi && u.kutu_sayisi > 0 ? ' · azaldı' : ''}
                  </Text>
                </View>
                <Text style={[styles.kutuSayi, azaldi && { color: '#B3263E' }]}>{u.kutu_sayisi}</Text>
                <Text style={styles.kutuEtiket}>kutu</Text>
                <Pressable
                  style={[styles.bittiButon, u.kutu_sayisi === 0 && { opacity: 0.25 }]}
                  onPress={() => kutuBitti(u)}
                  disabled={u.kutu_sayisi === 0}
                  hitSlop={6}
                >
                  <Text style={styles.bittiMetin}>−1</Text>
                </Pressable>
              </Pressable>
            );
          })
        )}
        <Text style={styles.ipucu}>
          Bir kutu bitince “−1”e bas. Sayım yapmak ya da uyarı sınırını değiştirmek için lezzete dokun.
        </Text>
      </ScrollView>

      {/* ÜRETİM PENCERESİ */}
      <Modal visible={uretimAcik} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUretimAcik(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalUst}>
            <Pressable onPress={() => setUretimAcik(false)}>
              <Text style={styles.vazgec}>Vazgeç</Text>
            </Pressable>
            <Text style={styles.modalBaslik}>Yeni üretim</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalIcerik} keyboardShouldPersistTaps="handled">
            <Text style={styles.etiket}>Kullanılan süt (kg, isteğe bağlı)</Text>
            <TextInput
              style={styles.girdi}
              value={sutKg}
              onChangeText={setSutKg}
              keyboardType="decimal-pad"
              placeholder="örn. 100"
              placeholderTextColor={RENK.murekkepYumusak}
            />
            <Text style={styles.etiket}>Not (isteğe bağlı)</Text>
            <TextInput
              style={styles.girdi}
              value={uretimNotu}
              onChangeText={setUretimNotu}
              placeholder="örn. Cumartesi partisi"
              placeholderTextColor={RENK.murekkepYumusak}
            />
            <Text style={styles.etiket}>Hangi lezzetten kaç kutu?</Text>
            {urunler.map((u) => {
              const n = uretimKutular[u.id] ?? 0;
              return (
                <View key={u.id} style={[styles.uretimSatir, n > 0 && { backgroundColor: '#FFE3EC' }]}>
                  <View style={[styles.top, { backgroundColor: u.renk ?? '#DDD' }]} />
                  <Text style={[styles.ad, { flex: 1 }]}>{u.ad}</Text>
                  <Pressable style={styles.adimButon} onPress={() => uretimDegistir(u.id, -1)} hitSlop={6}>
                    <Text style={styles.adimMetin}>−</Text>
                  </Pressable>
                  <Text style={styles.adimSayi}>{n}</Text>
                  <Pressable style={styles.adimButon} onPress={() => uretimDegistir(u.id, 1)} hitSlop={6}>
                    <Text style={styles.adimMetin}>+</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.modalAlt}>
            <Text style={styles.modalAltMetin}>
              {uretimToplamKutu} kutu · ~{uretimToplamKutu * KUTU_KG} kg
            </Text>
            <Pressable style={styles.kaydetButon} onPress={uretimKaydet} disabled={kaydediliyor}>
              {kaydediliyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.kaydetMetin}>Üretimi kaydet</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SAYIM / AYAR PENCERESİ */}
      <Modal visible={secili !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSecili(null)}>
        {secili && (
          <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalUst}>
              <Pressable onPress={() => setSecili(null)}>
                <Text style={styles.vazgec}>Vazgeç</Text>
              </Pressable>
              <Text style={styles.modalBaslik}>{secili.ad}</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalIcerik}>
              <Text style={styles.etiket}>Elindeki kutu sayısı (sayım)</Text>
              <TextInput style={styles.girdi} value={sayim} onChangeText={setSayim} keyboardType="number-pad" />
              <Text style={styles.yardim}>Şu an sistemde {secili.kutu_sayisi} kutu görünüyor. Fark “düzeltme” olarak kaydedilir.</Text>

              <Text style={styles.etiket}>Uyarı sınırı (kutu)</Text>
              <TextInput style={styles.girdi} value={kritik} onChangeText={setKritik} keyboardType="number-pad" />
              <Text style={styles.yardim}>Kutu sayısı bu değere eşit ya da altındaysa lezzet “azaldı” olarak işaretlenir.</Text>

              <Pressable style={styles.kaydetButon} onPress={ayarKaydet} disabled={kaydediliyor}>
                {kaydediliyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.kaydetMetin}>Kaydet</Text>}
              </Pressable>
            </View>
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
  uretimButon: { backgroundColor: RENK.pembe, borderWidth: 2, borderColor: RENK.murekkep, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  uretimButonMetin: { fontWeight: '900', color: RENK.murekkep },
  ozet: { color: RENK.murekkepYumusak, fontWeight: '600', marginTop: 4, marginBottom: 12 },
  uyari: { backgroundColor: '#FCE4E4', borderWidth: 2, borderColor: '#B3263E', borderRadius: 16, padding: 12, marginBottom: 12 },
  uyariBaslik: { fontWeight: '900', color: '#B3263E', fontSize: 15 },
  uyariMetin: { color: '#7A1A2B', fontWeight: '600', marginTop: 4, lineHeight: 20 },
  filtreler: { gap: 8, paddingBottom: 12 },
  filtre: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut },
  filtreSecili: { backgroundColor: RENK.murekkep },
  filtreMetin: { fontWeight: '800', color: RENK.murekkep },
  filtreMetinSecili: { color: RENK.sut },
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
  satirAzaldi: { borderColor: '#B3263E', backgroundColor: '#FFF4F4' },
  top: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: RENK.murekkep },
  ad: { fontSize: 15, fontWeight: '800', color: RENK.murekkep },
  alt: { fontSize: 12, fontWeight: '600', color: RENK.murekkepYumusak, marginTop: 1 },
  kutuSayi: { fontSize: 24, fontWeight: '900', color: RENK.murekkep },
  kutuEtiket: { fontSize: 12, fontWeight: '700', color: RENK.murekkepYumusak, marginLeft: -6, marginRight: 4 },
  bittiButon: { backgroundColor: RENK.murekkep, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  bittiMetin: { color: RENK.sut, fontWeight: '900', fontSize: 16 },
  ipucu: { color: RENK.murekkepYumusak, fontSize: 12, textAlign: 'center', marginTop: 12 },
  modal: { flex: 1, backgroundColor: RENK.krema },
  modalUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  vazgec: { color: RENK.murekkepYumusak, fontWeight: '700', fontSize: 16, width: 60 },
  modalBaslik: { fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  modalIcerik: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  etiket: { fontWeight: '800', color: RENK.murekkep, marginTop: 14, marginBottom: 6 },
  yardim: { fontSize: 12, color: RENK.murekkepYumusak, marginTop: 6 },
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
  uretimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RENK.sut,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RENK.cizgi,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  adimButon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, alignItems: 'center', justifyContent: 'center' },
  adimMetin: { fontSize: 20, fontWeight: '900', color: RENK.murekkep },
  adimSayi: { width: 28, textAlign: 'center', fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  modalAlt: { borderTopWidth: 2, borderTopColor: RENK.murekkep, backgroundColor: RENK.sut, padding: 16, paddingBottom: 34 },
  modalAltMetin: { textAlign: 'center', fontWeight: '800', color: RENK.murekkepYumusak, marginBottom: 10 },
  kaydetButon: {
    backgroundColor: RENK.murekkep,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  kaydetMetin: { color: RENK.sut, fontSize: 18, fontWeight: '900' },
});
