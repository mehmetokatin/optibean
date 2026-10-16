import { useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { KATEGORILER, ODEME_TURLERI, RENK, type Kategori, type Urun } from '../constants/optibean';

export type SepetKalemi = { urun: Urun; adet: number };

type Props = {
  urunler: Urun[];
  // Satışı veritabanına kaydeder; başarılıysa true döner.
  onSatisTamamla: (kalemler: SepetKalemi[], odemeTuru: string) => Promise<boolean>;
  onGeri: () => void;
};

export default function SatisEkrani({ urunler, onSatisTamamla, onGeri }: Props) {
  const [sepet, setSepet] = useState<SepetKalemi[]>([]);
  const [odemeTuru, setOdemeTuru] = useState(ODEME_TURLERI[0]);
  const [kategori, setKategori] = useState<Kategori | 'hepsi'>('hepsi');
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const gorunenUrunler = kategori === 'hepsi' ? urunler : urunler.filter((u) => u.kategori === kategori);
  const toplam = sepet.reduce((t, k) => t + k.urun.fiyat * k.adet, 0);
  const topSayisi = sepet.reduce((t, k) => t + k.adet, 0);

  function sepeteEkle(urun: Urun) {
    const mevcut = sepet.find((k) => k.urun.id === urun.id);
    if (mevcut) {
      setSepet(sepet.map((k) => (k.urun.id === urun.id ? { ...k, adet: k.adet + 1 } : k)));
    } else {
      setSepet([...sepet, { urun, adet: 1 }]);
    }
  }

  function sepettenAzalt(urunId: number) {
    setSepet(
      sepet
        .map((k) => (k.urun.id === urunId ? { ...k, adet: k.adet - 1 } : k))
        .filter((k) => k.adet > 0)
    );
  }

  async function satisiTamamla() {
    if (sepet.length === 0) {
      Alert.alert('Sepet boş', 'Önce bir lezzet ekle.');
      return;
    }
    setKaydediliyor(true);
    const basarili = await onSatisTamamla(sepet, odemeTuru);
    setKaydediliyor(false);
    if (basarili) {
      Alert.alert('Satış kaydedildi', `${toplam} ₺ · ${odemeTuru}`);
      setSepet([]);
    }
  }

  return (
    <ScrollView style={styles.ekran} contentContainerStyle={styles.icerik}>
      <Pressable onPress={onGeri}>
        <Text style={styles.geri}>‹ Ana sayfa</Text>
      </Pressable>
      <Text style={styles.baslik}>Yeni Satış</Text>

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

      <View style={styles.urunIzgara}>
        {gorunenUrunler.map((urun) => (
          <Pressable key={urun.id} style={styles.urunKarti} onPress={() => sepeteEkle(urun)}>
            <View style={[styles.top, { backgroundColor: urun.renk }]} />
            <Text style={styles.urunAd} numberOfLines={2}>
              {urun.ad}
            </Text>
            {urun.not ? <Text style={styles.urunNot}>{urun.not}</Text> : null}
            <Text style={styles.urunFiyat}>{urun.fiyat} ₺ / top</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.bolumBaslik}>Sepet {topSayisi > 0 ? `· ${topSayisi} top` : ''}</Text>
      {sepet.length === 0 ? (
        <Text style={styles.bos}>Henüz lezzet eklenmedi</Text>
      ) : (
        sepet.map((kalem) => (
          <View key={kalem.urun.id} style={styles.sepetSatiri}>
            <View style={[styles.kucukTop, { backgroundColor: kalem.urun.renk }]} />
            <Text style={styles.sepetUrun}>
              {kalem.adet} × {kalem.urun.ad}
            </Text>
            <Text style={styles.sepetTutar}>{kalem.urun.fiyat * kalem.adet} ₺</Text>
            <Pressable style={styles.azaltButon} onPress={() => sepettenAzalt(kalem.urun.id)}>
              <Text style={styles.azaltMetin}>−</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.bolumBaslik}>Ödeme türü</Text>
      <View style={styles.odemeSatiri}>
        {ODEME_TURLERI.map((tur) => (
          <Pressable
            key={tur}
            style={[styles.odemeButon, odemeTuru === tur && styles.odemeSecili]}
            onPress={() => setOdemeTuru(tur)}
          >
            <Text style={[styles.odemeMetin, odemeTuru === tur && styles.odemeMetinSecili]}>{tur}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toplamKutu}>
        <Text style={styles.toplamEtiket}>Toplam</Text>
        <Text style={styles.toplamDeger}>{toplam} ₺</Text>
      </View>

      <Pressable style={styles.tamamlaButon} onPress={satisiTamamla} disabled={kaydediliyor}>
        {kaydediliyor ? (
          <ActivityIndicator color={RENK.sut} />
        ) : (
          <Text style={styles.tamamlaMetin}>Satışı Tamamla</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: RENK.krema },
  icerik: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep, marginBottom: 12 },
  filtreler: { gap: 8, paddingBottom: 14 },
  filtre: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut },
  filtreSecili: { backgroundColor: RENK.murekkep },
  filtreMetin: { fontWeight: '800', color: RENK.murekkep },
  filtreMetinSecili: { color: RENK.sut },
  urunIzgara: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  urunKarti: {
    width: '48%',
    backgroundColor: RENK.sut,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: RENK.murekkep,
  },
  top: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: RENK.murekkep, marginBottom: 8 },
  urunAd: { fontSize: 15, fontWeight: '800', color: RENK.murekkep },
  urunNot: { fontSize: 12, color: RENK.murekkepYumusak, marginTop: 2 },
  urunFiyat: { fontSize: 13, fontWeight: '700', color: RENK.murekkepYumusak, marginTop: 6 },
  bolumBaslik: { fontSize: 17, fontWeight: '900', color: RENK.murekkep, marginTop: 18, marginBottom: 8 },
  bos: { color: RENK.murekkepYumusak, fontStyle: 'italic' },
  sepetSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RENK.sut,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RENK.cizgi,
    padding: 12,
    marginBottom: 6,
  },
  kucukTop: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: RENK.murekkep, marginRight: 10 },
  sepetUrun: { flex: 1, fontSize: 15, fontWeight: '600', color: RENK.murekkep },
  sepetTutar: { fontSize: 15, fontWeight: '700', color: RENK.murekkep, marginRight: 12 },
  azaltButon: { width: 32, height: 32, borderRadius: 16, backgroundColor: RENK.krema, borderWidth: 1.5, borderColor: RENK.murekkep, alignItems: 'center', justifyContent: 'center' },
  azaltMetin: { fontSize: 20, fontWeight: '700', color: RENK.murekkep },
  odemeSatiri: { flexDirection: 'row', gap: 8 },
  odemeButon: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut, alignItems: 'center' },
  odemeSecili: { backgroundColor: RENK.pembe },
  odemeMetin: { color: RENK.murekkep, fontWeight: '800', fontSize: 13 },
  odemeMetinSecili: { color: RENK.murekkep },
  toplamKutu: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  toplamEtiket: { fontSize: 18, fontWeight: '700', color: RENK.murekkepYumusak },
  toplamDeger: { fontSize: 30, fontWeight: '900', color: RENK.murekkep },
  tamamlaButon: {
    backgroundColor: RENK.murekkep,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tamamlaMetin: { color: RENK.sut, fontSize: 18, fontWeight: '900' },
});
