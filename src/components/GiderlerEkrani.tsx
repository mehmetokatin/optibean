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
import { RENK } from '../constants/optibean';
import { supabase } from '../lib/supabase';

type Gider = { id: number; tarih: string; kategori: string; aciklama: string | null; tutar: number };

export const GIDER_KATEGORILERI = [
  { ad: 'Kira', renk: '#6C7BD9' },
  { ad: 'Fatura', renk: '#3D8BD9' },
  { ad: 'Süt', renk: '#E9E1CF' },
  { ad: 'Malzeme', renk: '#FFBE3D' },
  { ad: 'Ambalaj', renk: '#EDB96B' },
  { ad: 'Personel', renk: '#9B5BC8' },
  { ad: 'Komisyon', renk: '#FF9A3C' },
  { ad: 'Vergi', renk: '#B3263E' },
  { ad: 'Diğer', renk: '#8E8C8F' },
];
const KATEGORI_IPUCU: Record<string, string> = {
  Fatura: 'örn. Elektrik Ekim',
  Malzeme: 'örn. 20 kg şeker, salep, kahve',
  Ambalaj: 'örn. 1000 külah',
  Komisyon: 'örn. Trendyol Ekim kesintisi',
};
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// İstanbul'a göre bugünün tarihi: "2026-10-16"
function istanbulBugun(gunFarki = 0): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000 + gunFarki * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function para(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ₺`;
}
function gunYaz(tarih: string): string {
  const [, ay, gun] = tarih.split('-');
  if (tarih === istanbulBugun()) return 'Bugün';
  if (tarih === istanbulBugun(-1)) return 'Dün';
  return `${Number(gun)} ${AYLAR[Number(ay) - 1]}`;
}

type Props = { onGeri: () => void };

export default function GiderlerEkrani({ onGeri }: Props) {
  // Görüntülenen ay: {yil, ay(0-11)}
  const bugun = istanbulBugun();
  const [yil, setYil] = useState(Number(bugun.slice(0, 4)));
  const [ay, setAy] = useState(Number(bugun.slice(5, 7)) - 1);
  const [giderler, setGiderler] = useState<Gider[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  // Yeni gider formu
  const [formAcik, setFormAcik] = useState(false);
  const [tutar, setTutar] = useState('');
  const [kategori, setKategori] = useState('Süt');
  const [aciklama, setAciklama] = useState('');
  const [tarih, setTarih] = useState(bugun);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ayBasi = `${yil}-${String(ay + 1).padStart(2, '0')}-01`;
  const sonrakiAyBasi = ay === 11 ? `${yil + 1}-01-01` : `${yil}-${String(ay + 2).padStart(2, '0')}-01`;

  const yukle = useCallback(async () => {
    const { data, error } = await supabase
      .from('giderler')
      .select('id, tarih, kategori, aciklama, tutar')
      .gte('tarih', ayBasi)
      .lt('tarih', sonrakiAyBasi)
      .order('tarih', { ascending: false })
      .order('id', { ascending: false });
    setYukleniyor(false);
    if (error) {
      Alert.alert('Hata', 'Giderler yüklenemedi.');
      return;
    }
    setGiderler(data.map((g) => ({ ...g, tutar: Number(g.tutar) })));
  }, [ayBasi, sonrakiAyBasi]);

  useEffect(() => {
    setYukleniyor(true);
    yukle();
  }, [yukle]);

  async function yenile() {
    setYenileniyor(true);
    await yukle();
    setYenileniyor(false);
  }

  function ayDegistir(fark: number) {
    let yeniAy = ay + fark;
    let yeniYil = yil;
    if (yeniAy < 0) {
      yeniAy = 11;
      yeniYil--;
    } else if (yeniAy > 11) {
      yeniAy = 0;
      yeniYil++;
    }
    setAy(yeniAy);
    setYil(yeniYil);
  }

  const buAyMi = ayBasi === `${bugun.slice(0, 7)}-01`;
  const toplam = giderler.reduce((t, g) => t + g.tutar, 0);
  const kategoriToplamlari = GIDER_KATEGORILERI.map((k) => ({
    ...k,
    tutar: giderler.filter((g) => g.kategori === k.ad).reduce((t, g) => t + g.tutar, 0),
  }))
    .filter((k) => k.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar);

  // Listeyi günlere göre grupla
  const gunler: { tarih: string; kalemler: Gider[] }[] = [];
  for (const g of giderler) {
    const son = gunler[gunler.length - 1];
    if (son && son.tarih === g.tarih) son.kalemler.push(g);
    else gunler.push({ tarih: g.tarih, kalemler: [g] });
  }

  function formAc() {
    setTutar('');
    setAciklama('');
    setTarih(buAyMi ? bugun : ayBasi);
    setFormAcik(true);
  }

  async function kaydet() {
    const sayi = Number(tutar.replace(/\./g, '').replace(',', '.'));
    if (!tutar || isNaN(sayi) || sayi <= 0) {
      Alert.alert('Geçersiz tutar', 'Tutarı sayı olarak yaz, örn. 2500');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || isNaN(new Date(tarih).getTime())) {
      Alert.alert('Geçersiz tarih', 'Tarihi YYYY-AA-GG biçiminde yaz, örn. 2026-10-16');
      return;
    }
    setKaydediliyor(true);
    const { error } = await supabase.from('giderler').insert({ tarih, kategori, aciklama: aciklama.trim() || null, tutar: sayi });
    setKaydediliyor(false);
    if (error) {
      Alert.alert('Kaydedilemedi', error.message);
      return;
    }
    setFormAcik(false);
    yukle();
  }

  function sil(g: Gider) {
    Alert.alert('Gideri sil', `${g.kategori} · ${para(g.tutar)} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('giderler').delete().eq('id', g.id);
          if (error) Alert.alert('Silinemedi', error.message);
          else yukle();
        },
      },
    ]);
  }

  const renkBul = (ad: string) => GIDER_KATEGORILERI.find((k) => k.ad === ad)?.renk ?? '#CCC';

  return (
    <View style={styles.ekran}>
      <ScrollView contentContainerStyle={styles.icerik} refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} />}>
        <Pressable onPress={onGeri}>
          <Text style={styles.geri}>‹ Ana sayfa</Text>
        </Pressable>
        <View style={styles.baslikSatiri}>
          <Text style={styles.baslik}>Giderler</Text>
          <Pressable style={styles.ekleButon} onPress={formAc}>
            <Text style={styles.ekleMetin}>+ Gider ekle</Text>
          </Pressable>
        </View>

        <View style={styles.aySecici}>
          <Pressable onPress={() => ayDegistir(-1)} hitSlop={10} style={styles.okButon}>
            <Text style={styles.ok}>‹</Text>
          </Pressable>
          <Text style={styles.ayAdi}>
            {AYLAR[ay]} {yil}
          </Text>
          <Pressable onPress={() => ayDegistir(1)} hitSlop={10} style={[styles.okButon, buAyMi && { opacity: 0.25 }]} disabled={buAyMi}>
            <Text style={styles.ok}>›</Text>
          </Pressable>
        </View>

        <View style={styles.toplamKart}>
          <Text style={styles.toplamEtiket}>Bu ayın toplam gideri</Text>
          <Text style={styles.toplamDeger}>{para(toplam)}</Text>
          <Text style={styles.toplamEtiket}>{giderler.length} kayıt</Text>
        </View>

        {kategoriToplamlari.length > 0 && (
          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>Kategorilere göre</Text>
            {kategoriToplamlari.map((k) => (
              <View key={k.ad} style={styles.katSatir}>
                <Text style={styles.katAd}>{k.ad}</Text>
                <View style={styles.cubukZemin}>
                  <View style={[styles.cubuk, { width: `${(k.tutar / kategoriToplamlari[0].tutar) * 100}%`, backgroundColor: k.renk }]} />
                </View>
                <Text style={styles.katTutar}>{para(k.tutar)}</Text>
              </View>
            ))}
          </View>
        )}

        {yukleniyor ? (
          <ActivityIndicator color={RENK.murekkep} style={{ marginTop: 30 }} />
        ) : giderler.length === 0 ? (
          <Text style={styles.bos}>Bu ay için gider girilmemiş.</Text>
        ) : (
          gunler.map((gun) => (
            <View key={gun.tarih}>
              <Text style={styles.gunBaslik}>{gunYaz(gun.tarih)}</Text>
              {gun.kalemler.map((g) => (
                <Pressable key={g.id} style={styles.satir} onLongPress={() => sil(g)}>
                  <View style={[styles.katNokta, { backgroundColor: renkBul(g.kategori) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.satirKategori}>{g.kategori}</Text>
                    {g.aciklama ? <Text style={styles.satirAciklama}>{g.aciklama}</Text> : null}
                  </View>
                  <Text style={styles.satirTutar}>{para(g.tutar)}</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
        <Text style={styles.ipucu}>Silmek için bir gidere uzun bas.</Text>
      </ScrollView>

      <Modal visible={formAcik} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormAcik(false)}>
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalIcerik} keyboardShouldPersistTaps="handled">
            <View style={styles.modalUst}>
              <Pressable onPress={() => setFormAcik(false)}>
                <Text style={styles.vazgec}>Vazgeç</Text>
              </Pressable>
              <Text style={styles.modalBaslik}>Yeni gider</Text>
              <View style={{ width: 60 }} />
            </View>

            <Text style={styles.etiket}>Tutar (₺)</Text>
            <TextInput
              style={[styles.girdi, styles.tutarGirdi]}
              value={tutar}
              onChangeText={setTutar}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={RENK.murekkepYumusak}
              autoFocus
            />

            <Text style={styles.etiket}>Kategori</Text>
            <View style={styles.secenekler}>
              {GIDER_KATEGORILERI.map((k) => (
                <Pressable key={k.ad} style={[styles.cip, kategori === k.ad && styles.cipSecili]} onPress={() => setKategori(k.ad)}>
                  <View style={[styles.katNokta, { backgroundColor: k.renk, width: 12, height: 12 }]} />
                  <Text style={[styles.cipMetin, kategori === k.ad && styles.cipMetinSecili]}>{k.ad}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.etiket}>Tarih</Text>
            <View style={styles.tarihSatir}>
              {[
                { ad: 'Bugün', deger: istanbulBugun() },
                { ad: 'Dün', deger: istanbulBugun(-1) },
              ].map((t) => (
                <Pressable key={t.ad} style={[styles.cip, tarih === t.deger && styles.cipSecili]} onPress={() => setTarih(t.deger)}>
                  <Text style={[styles.cipMetin, tarih === t.deger && styles.cipMetinSecili]}>{t.ad}</Text>
                </Pressable>
              ))}
              <TextInput
                style={[styles.girdi, { flex: 1, paddingVertical: 8 }]}
                value={tarih}
                onChangeText={setTarih}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={RENK.murekkepYumusak}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Text style={styles.etiket}>Açıklama (isteğe bağlı)</Text>
            <TextInput
              style={styles.girdi}
              value={aciklama}
              onChangeText={setAciklama}
              placeholder={KATEGORI_IPUCU[kategori] ?? 'Kısa bir not'}
              placeholderTextColor={RENK.murekkepYumusak}
            />

            <Pressable style={styles.kaydetButon} onPress={kaydet} disabled={kaydediliyor}>
              {kaydediliyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.kaydetMetin}>Kaydet</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: RENK.krema },
  icerik: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep },
  ekleButon: { backgroundColor: RENK.pembe, borderWidth: 2, borderColor: RENK.murekkep, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  ekleMetin: { fontWeight: '900', color: RENK.murekkep },
  aySecici: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 14 },
  okButon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, alignItems: 'center', justifyContent: 'center', backgroundColor: RENK.sut },
  ok: { fontSize: 22, fontWeight: '900', color: RENK.murekkep, marginTop: -2 },
  ayAdi: { fontSize: 18, fontWeight: '900', color: RENK.murekkep, minWidth: 130, textAlign: 'center' },
  toplamKart: {
    backgroundColor: RENK.murekkep,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  toplamEtiket: { color: '#E8E4E3', fontSize: 14, fontWeight: '600' },
  toplamDeger: { color: RENK.sut, fontSize: 34, fontWeight: '900', marginVertical: 4 },
  kart: { backgroundColor: RENK.sut, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, padding: 14, marginBottom: 14 },
  kartBaslik: { fontSize: 16, fontWeight: '900', color: RENK.murekkep, marginBottom: 4 },
  katSatir: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  katAd: { width: 76, fontWeight: '700', color: RENK.murekkep },
  cubukZemin: { flex: 1, height: 8, backgroundColor: RENK.krema, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  cubuk: { height: 8, borderRadius: 4 },
  katTutar: { fontWeight: '700', color: RENK.murekkepYumusak, fontSize: 13 },
  bos: { color: RENK.murekkepYumusak, fontWeight: '600', textAlign: 'center', marginTop: 20 },
  gunBaslik: { fontWeight: '900', color: RENK.murekkepYumusak, marginTop: 12, marginBottom: 6 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RENK.sut,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RENK.cizgi,
    padding: 12,
    marginBottom: 6,
  },
  katNokta: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: RENK.murekkep },
  satirKategori: { fontWeight: '800', color: RENK.murekkep, fontSize: 15 },
  satirAciklama: { color: RENK.murekkepYumusak, fontSize: 13, marginTop: 1 },
  satirTutar: { fontWeight: '900', color: RENK.murekkep, fontSize: 15 },
  ipucu: { color: RENK.murekkepYumusak, fontSize: 12, textAlign: 'center', marginTop: 14 },
  modal: { flex: 1, backgroundColor: RENK.krema },
  modalIcerik: { padding: 20, paddingBottom: 60 },
  modalUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  vazgec: { color: RENK.murekkepYumusak, fontWeight: '700', fontSize: 16, width: 60 },
  modalBaslik: { fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  etiket: { fontWeight: '800', color: RENK.murekkep, marginTop: 16, marginBottom: 6 },
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
  tutarGirdi: { fontSize: 30, fontWeight: '900', textAlign: 'center' },
  secenekler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: RENK.murekkep,
    backgroundColor: RENK.sut,
  },
  cipSecili: { backgroundColor: RENK.murekkep },
  cipMetin: { fontWeight: '800', color: RENK.murekkep },
  cipMetinSecili: { color: RENK.sut },
  tarihSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
