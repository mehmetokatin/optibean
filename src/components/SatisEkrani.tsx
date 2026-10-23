import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KATEGORILER, ODEME_TURLERI, RENK, type Kategori, type Urun } from '../constants/optibean';
import { supabase } from '../lib/supabase';

export type SepetKalemi = { urun: Urun; adet: number };

type Props = {
  urunler: Urun[];
  // Satışı veritabanına kaydeder; başarılıysa true döner.
  onSatisTamamla: (kalemler: SepetKalemi[], odemeTuru: string) => Promise<boolean>;
  onGeri: () => void;
};

const ODEME_KISA: Record<string, string> = { Nakit: 'Nakit', Kart: 'Kart', 'Trendyol Yemek': 'Trendyol' };

// HIZLI SATIŞ AKIŞI:
//   lezzetlere dokun (+1)  →  alttaki ödeme butonuna dokun  →  satış kaydedildi.
//   Uzun basış bir top azaltır. Lezzetler son 30 günde en çok satandan aza sıralı.
export default function SatisEkrani({ urunler, onSatisTamamla, onGeri }: Props) {
  const [sepet, setSepet] = useState<SepetKalemi[]>([]);
  const [kategori, setKategori] = useState<Kategori | 'hepsi'>('hepsi');
  const [populerlik, setPopulerlik] = useState<Record<number, number>>({});
  const [bildirim, setBildirim] = useState('');
  const bildirimOpaklik = useRef(new Animated.Value(0)).current;

  // Son 30 günde hangi lezzetten kaç top satıldı? (sıralama için)
  useEffect(() => {
    const otuzGunOnce = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from('satis_kalemleri')
      .select('urun_id, adet, satislar!inner(tarih_saat)')
      .gte('satislar.tarih_saat', otuzGunOnce)
      .limit(10000)
      .then(({ data }) => {
        if (!data) return;
        const sayac: Record<number, number> = {};
        for (const k of data) sayac[k.urun_id] = (sayac[k.urun_id] ?? 0) + k.adet;
        setPopulerlik(sayac);
      });
  }, []);

  const gorunenUrunler = (kategori === 'hepsi' ? urunler : urunler.filter((u) => u.kategori === kategori))
    .slice()
    .sort((a, b) => (populerlik[b.id] ?? 0) - (populerlik[a.id] ?? 0));

  const toplam = sepet.reduce((t, k) => t + k.urun.fiyat * k.adet, 0);
  const topSayisi = sepet.reduce((t, k) => t + k.adet, 0);
  const sepettekiAdet = (id: number) => sepet.find((k) => k.urun.id === id)?.adet ?? 0;

  function sepeteEkle(urun: Urun) {
    setSepet((s) =>
      s.some((k) => k.urun.id === urun.id)
        ? s.map((k) => (k.urun.id === urun.id ? { ...k, adet: k.adet + 1 } : k))
        : [...s, { urun, adet: 1 }]
    );
  }

  function sepettenAzalt(urunId: number) {
    setSepet((s) => s.map((k) => (k.urun.id === urunId ? { ...k, adet: k.adet - 1 } : k)).filter((k) => k.adet > 0));
  }

  function bildirimGoster(metin: string) {
    setBildirim(metin);
    bildirimOpaklik.setValue(1);
    Animated.timing(bildirimOpaklik, { toValue: 0, duration: 600, delay: 1800, useNativeDriver: true }).start();
  }

  // Tek dokunuşla tamamla: sepet hemen boşalır, kayıt arka planda yapılır.
  // Kayıt başarısız olursa sepet geri gelir ve uyarı çıkar, satış kaybolmaz.
  async function tamamla(odemeTuru: string) {
    if (sepet.length === 0) return;
    const kayitliSepet = sepet;
    const kayitliToplam = toplam;
    setSepet([]);
    bildirimGoster(`✓ ${kayitliToplam} ₺ · ${ODEME_KISA[odemeTuru] ?? odemeTuru} kaydedildi`);

    const basarili = await onSatisTamamla(kayitliSepet, odemeTuru);
    if (!basarili) {
      setSepet(kayitliSepet);
      bildirimOpaklik.setValue(0);
    }
  }

  function sepetiTemizle() {
    if (sepet.length === 0) return;
    Alert.alert('Sepeti temizle', 'Sepetteki tüm lezzetler silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: () => setSepet([]) },
    ]);
  }

  return (
    <View style={styles.ekran}>
      {/* Üst kısım: başlık + kategoriler */}
      <View style={styles.ust}>
        <View style={styles.ustSatir}>
          <Pressable onPress={onGeri} hitSlop={10}>
            <Text style={styles.geri}>‹ Ana sayfa</Text>
          </Pressable>
          <Text style={styles.baslik}>Satış</Text>
          <View style={{ width: 80 }} />
        </View>
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
      </View>

      {/* Lezzet ızgarası: 3 sütun */}
      <ScrollView contentContainerStyle={styles.izgara}>
        {gorunenUrunler.map((urun) => {
          const adet = sepettekiAdet(urun.id);
          return (
            <Pressable
              key={urun.id}
              style={({ pressed }) => [
                styles.kart,
                urun.kutu === 0 && styles.kartBitti,
                adet > 0 && styles.kartSecili,
                pressed && styles.kartBasili,
              ]}
              onPress={() => sepeteEkle(urun)}
              onLongPress={() => sepettenAzalt(urun.id)}
              delayLongPress={350}
            >
              <View style={[styles.renkSerit, { backgroundColor: urun.renk }]} />
              <Text style={styles.kartAd} numberOfLines={2}>
                {urun.ad}
              </Text>
              <Text style={styles.kartFiyat}>{urun.kutu === 0 ? 'Kutu bitti' : `${urun.fiyat} ₺`}</Text>
              {adet > 0 && (
                <View style={styles.rozet}>
                  <Text style={styles.rozetMetin}>{adet}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Kayıt bildirimi */}
      <Animated.View pointerEvents="none" style={[styles.bildirim, { opacity: bildirimOpaklik }]}>
        <Text style={styles.bildirimMetin}>{bildirim}</Text>
      </Animated.View>

      {/* Sabit alt panel: sepet özeti + ödeme butonları */}
      <View style={styles.alt}>
        {sepet.length === 0 ? (
          <Text style={styles.ipucu}>Lezzete dokun: +1 top · Uzun bas: −1 top</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sepetCipler}>
            {sepet.map((k) => (
              <Pressable key={k.urun.id} style={styles.cip} onPress={() => sepettenAzalt(k.urun.id)}>
                <View style={[styles.cipTop, { backgroundColor: k.urun.renk }]} />
                <Text style={styles.cipMetin}>
                  {k.adet}× {k.urun.ad}
                </Text>
                <Text style={styles.cipEksi}>−</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.toplamSatir}>
          <Text style={styles.toplamEtiket}>{topSayisi > 0 ? `${topSayisi} top` : 'Sepet boş'}</Text>
          <Text style={styles.toplam}>{toplam} ₺</Text>
          <Pressable onPress={sepetiTemizle} hitSlop={8} disabled={sepet.length === 0}>
            <Text style={[styles.temizle, sepet.length === 0 && { opacity: 0.3 }]}>Temizle</Text>
          </Pressable>
        </View>

        <View style={styles.odemeler}>
          {ODEME_TURLERI.map((tur) => (
            <Pressable
              key={tur}
              style={({ pressed }) => [styles.odeme, sepet.length === 0 && styles.odemePasif, pressed && styles.kartBasili]}
              onPress={() => tamamla(tur)}
              disabled={sepet.length === 0}
            >
              <Text style={styles.odemeMetin}>{ODEME_KISA[tur] ?? tur}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: 'transparent' },
  ust: { paddingTop: 60, paddingHorizontal: 16 },
  ustSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', width: 80 },
  baslik: { fontSize: 22, fontWeight: '900', color: RENK.murekkep },
  filtreler: { gap: 6, paddingBottom: 10 },
  filtre: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut },
  filtreSecili: { backgroundColor: RENK.murekkep },
  filtreMetin: { fontWeight: '800', color: RENK.murekkep, fontSize: 13 },
  filtreMetinSecili: { color: RENK.sut },
  izgara: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  kart: {
    width: '31.5%',
    minHeight: 86,
    backgroundColor: RENK.sut,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: RENK.murekkep,
    padding: 8,
    paddingTop: 12,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  kartSecili: { backgroundColor: '#FFE3EC' },
  kartBitti: { opacity: 0.4 },
  kartBasili: { transform: [{ scale: 0.95 }] },
  renkSerit: { position: 'absolute', top: 0, left: 0, right: 0, height: 7 },
  kartAd: { fontSize: 13, fontWeight: '800', color: RENK.murekkep, lineHeight: 16 },
  kartFiyat: { fontSize: 12, fontWeight: '700', color: RENK.murekkepYumusak, marginTop: 4 },
  rozet: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: RENK.murekkep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  rozetMetin: { color: RENK.sut, fontWeight: '900', fontSize: 14 },
  bildirim: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 230,
    backgroundColor: '#1E7A3C',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bildirimMetin: { color: RENK.sut, fontWeight: '900', fontSize: 15 },
  alt: {
    backgroundColor: RENK.sut,
    borderTopWidth: 2,
    borderTopColor: RENK.murekkep,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 30,
  },
  ipucu: { color: RENK.murekkepYumusak, fontWeight: '600', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  sepetCipler: { gap: 6, paddingVertical: 2 },
  cip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RENK.krema,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: RENK.murekkep,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cipTop: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: RENK.murekkep },
  cipMetin: { fontWeight: '700', color: RENK.murekkep, fontSize: 13 },
  cipEksi: { fontWeight: '900', color: RENK.murekkepYumusak, fontSize: 15 },
  toplamSatir: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  toplamEtiket: { fontWeight: '700', color: RENK.murekkepYumusak, fontSize: 14, width: 80 },
  toplam: { flex: 1, textAlign: 'center', fontSize: 28, fontWeight: '900', color: RENK.murekkep },
  temizle: { fontWeight: '800', color: '#B3263E', width: 80, textAlign: 'right' },
  odemeler: { flexDirection: 'row', gap: 8 },
  odeme: {
    flex: 1,
    backgroundColor: RENK.murekkep,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: RENK.pembe,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  odemePasif: { opacity: 0.3 },
  odemeMetin: { color: RENK.sut, fontWeight: '900', fontSize: 16 },
});
