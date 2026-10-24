import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ODEME_TURLERI, RENK } from '../constants/optibean';
import { supabase } from '../lib/supabase';

// TUTARLA SATIŞ GİRİŞİ
// Lezzet seçmeden, ödeme türüne göre tutar girilir: "Nakit 1.500 · Kart 2.300 · Trendyol 800".
// Her dolu alan `satislar` tablosuna kalemsiz bir kayıt olarak eklenir.
// Tek bir satış için de (sadece bir alanı doldurarak), gün sonu toplamı için de kullanılabilir.

type Kayit = { id: number; tarih_saat: string; odeme_turu: string; toplam_tutar: number };

const SAAT = 60 * 60 * 1000;
const ODEME_RENK: Record<string, string> = { Nakit: '#9BCB5A', Kart: '#3D8BD9', 'Trendyol Yemek': '#FF9A3C' };
const ODEME_KISA: Record<string, string> = { Nakit: 'Nakit', Kart: 'Kart', 'Trendyol Yemek': 'Trendyol' };

// İstanbul'a göre gün aralığı (gunFarki: 0 = bugün, -1 = dün), UTC zaman damgaları olarak
function gunAraligi(gunFarki: number): { baslangic: Date; bitis: Date } {
  const istanbul = new Date(Date.now() + 3 * SAAT);
  const gece = Date.UTC(istanbul.getUTCFullYear(), istanbul.getUTCMonth(), istanbul.getUTCDate()) - 3 * SAAT + gunFarki * 24 * SAAT;
  return { baslangic: new Date(gece), bitis: new Date(gece + 24 * SAAT) };
}

// "1.500", "1500", "1500,50", "1500.50" → sayı; boşsa 0, geçersizse NaN
function tutarOku(metin: string): number {
  let temiz = metin.trim().replace(/\s/g, '');
  if (temiz === '') return 0;
  if (temiz.includes(',')) {
    // Türkçe biçim: nokta binlik ayracı, virgül ondalık
    temiz = temiz.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(temiz)) {
    // "1.500" ya da "12.300" gibi: nokta binlik ayracı
    temiz = temiz.replace(/\./g, '');
  }
  return Number(temiz);
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const EN_ESKI_GUN = -365;

// 0 → "Bugün", -1 → "Dün", diğerleri → "21 Ekim Salı"
function gunAdi(gunFarki: number, uzun = false): string {
  const d = new Date(gunAraligi(gunFarki).baslangic.getTime() + 3 * SAAT);
  const tarih = `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]}`;
  const tam = `${tarih} ${d.getUTCFullYear()}, ${GUNLER[d.getUTCDay()]}`;
  if (uzun) return tam;
  if (gunFarki === 0) return 'Bugün';
  if (gunFarki === -1) return 'Dün';
  return `${tarih} ${GUNLER[d.getUTCDay()]}`;
}

function para(n: number): string {
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
}

function saatYaz(tarih: string): string {
  const d = new Date(new Date(tarih).getTime() + 3 * SAAT);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

type Props = { onGeri: () => void; onLezzetModu: () => void; onKaydedildi: () => void };

export default function TutarSatisEkrani({ onGeri, onLezzetModu, onKaydedildi }: Props) {
  const [gun, setGun] = useState(0); // 0 = bugün, -1 = dün, -2 = önceki gün...
  const [tutarlar, setTutarlar] = useState<Record<string, string>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bildirim, setBildirim] = useState('');
  const bildirimOpaklik = useRef(new Animated.Value(0)).current;

  const yukle = useCallback(async () => {
    const { baslangic, bitis } = gunAraligi(gun);
    const { data, error } = await supabase
      .from('satislar')
      .select('id, tarih_saat, odeme_turu, toplam_tutar')
      .gte('tarih_saat', baslangic.toISOString())
      .lt('tarih_saat', bitis.toISOString())
      .order('tarih_saat', { ascending: false });
    setYukleniyor(false);
    if (error) {
      Alert.alert('Hata', 'Kayıtlar yüklenemedi.');
      return;
    }
    setKayitlar(data.map((k) => ({ ...k, toplam_tutar: Number(k.toplam_tutar) })));
  }, [gun]);

  useEffect(() => {
    setYukleniyor(true);
    yukle();
  }, [yukle]);

  const girilenler = ODEME_TURLERI.map((tur) => ({ tur, tutar: tutarOku(tutarlar[tur] ?? '') }));
  const gecersizVar = girilenler.some((g) => isNaN(g.tutar) || g.tutar < 0);
  const girisToplami = girilenler.reduce((t, g) => t + (isNaN(g.tutar) ? 0 : g.tutar), 0);

  const gunToplami = kayitlar.reduce((t, k) => t + k.toplam_tutar, 0);
  const turToplamlari = ODEME_TURLERI.map((tur) => ({
    tur,
    tutar: kayitlar.filter((k) => k.odeme_turu === tur).reduce((t, k) => t + k.toplam_tutar, 0),
  }));

  function bildirimGoster(metin: string) {
    setBildirim(metin);
    bildirimOpaklik.setValue(1);
    Animated.timing(bildirimOpaklik, { toValue: 0, duration: 600, delay: 1800, useNativeDriver: true }).start();
  }

  async function kaydet() {
    if (gecersizVar) {
      Alert.alert('Geçersiz tutar', 'Tutarları sayı olarak yaz, örn. 1500 ya da 1.500');
      return;
    }
    const dolu = girilenler.filter((g) => g.tutar > 0);
    if (dolu.length === 0) {
      Alert.alert('Tutar yok', 'En az bir ödeme türüne tutar gir.');
      return;
    }
    // Geçmiş bir gün için girilen kayıtlar o günün 23.00'üne yazılır
    const tarih = gun === 0 ? new Date() : new Date(gunAraligi(gun).bitis.getTime() - SAAT);
    setKaydediliyor(true);
    const { error } = await supabase.from('satislar').insert(
      dolu.map((g) => ({ odeme_turu: g.tur, toplam_tutar: g.tutar, tarih_saat: tarih.toISOString() }))
    );
    setKaydediliyor(false);
    if (error) {
      Alert.alert('Kaydedilemedi', error.message);
      return;
    }
    setTutarlar({});
    bildirimGoster(`✓ ${para(girisToplami)} kaydedildi`);
    yukle();
    onKaydedildi();
  }

  function sil(k: Kayit) {
    Alert.alert('Kaydı sil', `${saatYaz(k.tarih_saat)} · ${ODEME_KISA[k.odeme_turu] ?? k.odeme_turu} · ${para(k.toplam_tutar)} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('satislar').delete().eq('id', k.id);
          if (error) {
            Alert.alert('Silinemedi', error.message);
            return;
          }
          yukle();
          onKaydedildi();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.ekran} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
        <View style={styles.ustSatir}>
          <Pressable onPress={onGeri} hitSlop={10}>
            <Text style={styles.geri}>‹ Ana sayfa</Text>
          </Pressable>
          <Pressable onPress={onLezzetModu} hitSlop={10}>
            <Text style={styles.modLink}>Lezzet seçerek ›</Text>
          </Pressable>
        </View>
        <Text style={styles.baslik}>Satış Gir</Text>

        <View style={styles.gunler}>
          {[
            { deger: 0, ad: 'Bugün' },
            { deger: -1, ad: 'Dün' },
          ].map((g) => (
            <Pressable key={g.ad} style={[styles.gun, gun === g.deger && styles.gunSecili]} onPress={() => setGun(g.deger)}>
              <Text style={[styles.gunMetin, gun === g.deger && styles.gunMetinSecili]}>{g.ad}</Text>
            </Pressable>
          ))}
        </View>

        {/* Daha eski bir güne gitmek için oklar */}
        <View style={styles.tarihSecici}>
          <Pressable
            style={[styles.okButon, gun <= EN_ESKI_GUN && { opacity: 0.25 }]}
            onPress={() => setGun((g) => Math.max(EN_ESKI_GUN, g - 1))}
            disabled={gun <= EN_ESKI_GUN}
            hitSlop={8}
          >
            <Text style={styles.ok}>‹</Text>
          </Pressable>
          <Text style={styles.tarihMetin}>{gunAdi(gun, true)}</Text>
          <Pressable
            style={[styles.okButon, gun >= 0 && { opacity: 0.25 }]}
            onPress={() => setGun((g) => Math.min(0, g + 1))}
            disabled={gun >= 0}
            hitSlop={8}
          >
            <Text style={styles.ok}>›</Text>
          </Pressable>
        </View>
        {gun < 0 && <Text style={styles.gecmisUyari}>Girdiğin tutarlar {gunAdi(gun, true)} tarihine kaydedilecek.</Text>}

        <View style={styles.kart}>
          {ODEME_TURLERI.map((tur, i) => {
            const deger = tutarlar[tur] ?? '';
            const hatali = isNaN(tutarOku(deger));
            return (
              <View key={tur} style={[styles.girisSatir, i > 0 && styles.girisAyrac]}>
                <View style={[styles.turNokta, { backgroundColor: ODEME_RENK[tur] ?? '#CCC' }]} />
                <Text style={styles.turAd}>{ODEME_KISA[tur] ?? tur}</Text>
                <TextInput
                  style={[styles.girdi, hatali && styles.girdiHatali]}
                  value={deger}
                  onChangeText={(t) => setTutarlar((x) => ({ ...x, [tur]: t }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#B8B2AF"
                  returnKeyType="done"
                />
                <Text style={styles.tl}>₺</Text>
              </View>
            );
          })}
          <View style={styles.toplamSatir}>
            <Text style={styles.toplamEtiket}>Toplam</Text>
            <Text style={styles.toplamDeger}>{para(girisToplami)}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.kaydetButon, (girisToplami === 0 || gecersizVar) && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.97 }] }]}
          onPress={kaydet}
          disabled={kaydediliyor || girisToplami === 0}
        >
          {kaydediliyor ? <ActivityIndicator color={RENK.sut} /> : <Text style={styles.kaydetMetin}>Kaydet</Text>}
        </Pressable>
        <Text style={styles.ipucu}>
          Tek satış için sadece bir alanı, gün sonu için hepsini doldurabilirsin. Gün içinde birden fazla kez girebilirsin; hepsi toplanır.
        </Text>

        <View style={styles.ozetKart}>
          <Text style={styles.ozetEtiket}>{gunAdi(gun)} toplamı</Text>
          <Text style={styles.ozetDeger}>{para(gunToplami)}</Text>
          <View style={styles.ozetTurler}>
            {turToplamlari.map((t) => (
              <Text key={t.tur} style={styles.ozetTur}>
                {ODEME_KISA[t.tur] ?? t.tur} {para(t.tutar)}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.bolumBaslik}>{gunAdi(gun)} girilenler</Text>
        {yukleniyor ? (
          <ActivityIndicator color={RENK.murekkep} style={{ marginTop: 16 }} />
        ) : kayitlar.length === 0 ? (
          <Text style={styles.bos}>Henüz kayıt yok.</Text>
        ) : (
          kayitlar.map((k) => (
            <Pressable key={k.id} style={styles.kayit} onLongPress={() => sil(k)}>
              <Text style={styles.kayitSaat}>{saatYaz(k.tarih_saat)}</Text>
              <View style={[styles.turNokta, { backgroundColor: ODEME_RENK[k.odeme_turu] ?? '#CCC' }]} />
              <Text style={styles.kayitTur}>{ODEME_KISA[k.odeme_turu] ?? k.odeme_turu}</Text>
              <Text style={styles.kayitTutar}>{para(k.toplam_tutar)}</Text>
            </Pressable>
          ))
        )}
        {kayitlar.length > 0 && <Text style={styles.ipucu}>Yanlış girilen kaydı silmek için üzerine uzun bas.</Text>}
      </ScrollView>

      <Animated.View pointerEvents="none" style={[styles.bildirim, { opacity: bildirimOpaklik }]}>
        <Text style={styles.bildirimMetin}>{bildirim}</Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: 'transparent' },
  icerik: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  ustSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700' },
  modLink: { color: RENK.murekkepYumusak, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep, marginBottom: 12 },
  gunler: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tarihSecici: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  okButon: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut, alignItems: 'center', justifyContent: 'center' },
  ok: { fontSize: 24, fontWeight: '900', color: RENK.murekkep, marginTop: -3 },
  tarihMetin: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '900', color: RENK.murekkep },
  gecmisUyari: { backgroundColor: '#FFF1C9', borderWidth: 1.5, borderColor: '#D9A04F', borderRadius: 12, padding: 10, color: '#6B4A12', fontWeight: '700', textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
  gun: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut, alignItems: 'center' },
  gunSecili: { backgroundColor: RENK.murekkep },
  gunMetin: { fontWeight: '800', color: RENK.murekkep },
  gunMetinSecili: { color: RENK.sut },
  kart: { backgroundColor: RENK.sut, borderRadius: 20, borderWidth: 2, borderColor: RENK.murekkep, paddingHorizontal: 16, paddingVertical: 6 },
  girisSatir: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  girisAyrac: { borderTopWidth: 1.5, borderTopColor: RENK.cizgi },
  turNokta: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: RENK.murekkep, marginRight: 10 },
  turAd: { width: 90, fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  girdi: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: RENK.murekkep,
    textAlign: 'right',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: RENK.krema,
    borderRadius: 12,
  },
  girdiHatali: { borderWidth: 2, borderColor: '#B3263E' },
  tl: { fontSize: 22, fontWeight: '900', color: RENK.murekkepYumusak, marginLeft: 8 },
  toplamSatir: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 2, borderTopColor: RENK.murekkep, paddingTop: 10, paddingBottom: 6, marginTop: 4 },
  toplamEtiket: { fontSize: 16, fontWeight: '800', color: RENK.murekkepYumusak },
  toplamDeger: { fontSize: 26, fontWeight: '900', color: RENK.murekkep },
  kaydetButon: {
    backgroundColor: RENK.murekkep,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  kaydetMetin: { color: RENK.sut, fontSize: 20, fontWeight: '900' },
  ipucu: { color: RENK.murekkepYumusak, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  ozetKart: {
    backgroundColor: RENK.murekkep,
    borderRadius: 20,
    padding: 16,
    marginTop: 22,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  ozetEtiket: { color: '#E8E4E3', fontSize: 14, fontWeight: '600' },
  ozetDeger: { color: RENK.sut, fontSize: 32, fontWeight: '900', marginVertical: 4 },
  ozetTurler: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ozetTur: { color: '#E8E4E3', fontSize: 13, fontWeight: '700' },
  bolumBaslik: { fontSize: 17, fontWeight: '900', color: RENK.murekkep, marginTop: 22, marginBottom: 8 },
  bos: { color: RENK.murekkepYumusak, fontStyle: 'italic' },
  kayit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RENK.sut,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RENK.cizgi,
    padding: 12,
    marginBottom: 6,
  },
  kayitSaat: { width: 52, fontWeight: '700', color: RENK.murekkepYumusak },
  kayitTur: { flex: 1, fontWeight: '800', color: RENK.murekkep, fontSize: 15 },
  kayitTutar: { fontWeight: '900', color: RENK.murekkep, fontSize: 16 },
  bildirim: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    backgroundColor: '#1E7A3C',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bildirimMetin: { color: RENK.sut, fontWeight: '900', fontSize: 15 },
});
