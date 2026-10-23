import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KATEGORILER, MAGAZA, ODEME_TURLERI, RENK } from '../constants/optibean';
import { supabase } from '../lib/supabase';

// ---- Veri tipleri (Supabase'in iç içe sorgusundan gelen şekil) ----
type KalemSatiri = {
  adet: number;
  birim_fiyat: number;
  urunler: { ad: string; renk: string | null; kategori: string } | null;
};
type SatisSatiri = {
  id: number;
  tarih_saat: string;
  odeme_turu: string;
  toplam_tutar: number;
  satis_kalemleri: KalemSatiri[];
};

const DONEMLER = [
  { id: 'bugun', ad: 'Bugün', gun: 1 },
  { id: 'hafta', ad: 'Son 7 gün', gun: 7 },
  { id: 'ay', ad: 'Son 30 gün', gun: 30 },
] as const;
type DonemId = (typeof DONEMLER)[number]['id'];

const SAAT_FARKI = 3 * 60 * 60 * 1000; // Türkiye = UTC+3
const ODEME_RENK: Record<string, string> = { Nakit: '#9BCB5A', Kart: '#3D8BD9', 'Trendyol Yemek': '#FF9A3C' };

// İstanbul'a göre "n gün önceki gece yarısı"
function donemBaslangici(gun: number): Date {
  const istanbul = new Date(Date.now() + SAAT_FARKI);
  const bugunGece = Date.UTC(istanbul.getUTCFullYear(), istanbul.getUTCMonth(), istanbul.getUTCDate()) - SAAT_FARKI;
  return new Date(bugunGece - (gun - 1) * 24 * 60 * 60 * 1000);
}

// Bir zaman damgasının İstanbul'daki günü ("2026-10-16") ve saati (0-23)
function istanbulGun(tarih: string): string {
  return new Date(new Date(tarih).getTime() + SAAT_FARKI).toISOString().slice(0, 10);
}
function istanbulSaat(tarih: string): number {
  return new Date(new Date(tarih).getTime() + SAAT_FARKI).getUTCHours();
}

function para(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ₺`;
}

type Props = { onGeri: () => void };

export default function RaporlarEkrani({ onGeri }: Props) {
  const [donem, setDonem] = useState<DonemId>('hafta');
  const [satislar, setSatislar] = useState<SatisSatiri[]>([]);
  const [giderToplami, setGiderToplami] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);

  const gunSayisi = DONEMLER.find((d) => d.id === donem)!.gun;

  const yukle = useCallback(async () => {
    const baslangic = donemBaslangici(gunSayisi);
    // Giderler gün bazında tutuluyor: dönemin ilk günü (İstanbul) ve sonrası
    const baslangicGunu = istanbulGun(baslangic.toISOString());
    const [satisCevap, giderCevap] = await Promise.all([
      supabase
        .from('satislar')
        .select('id, tarih_saat, odeme_turu, toplam_tutar, satis_kalemleri(adet, birim_fiyat, urunler(ad, renk, kategori))')
        .gte('tarih_saat', baslangic.toISOString())
        .order('tarih_saat')
        .limit(5000),
      supabase.from('giderler').select('tutar').gte('tarih', baslangicGunu),
    ]);
    setYukleniyor(false);
    if (satisCevap.error || giderCevap.error) {
      Alert.alert('Hata', 'Rapor verileri yüklenemedi.');
      return;
    }
    setSatislar(satisCevap.data as unknown as SatisSatiri[]);
    setGiderToplami(giderCevap.data.reduce((t, g) => t + Number(g.tutar), 0));
  }, [gunSayisi]);

  useEffect(() => {
    setYukleniyor(true);
    yukle();
  }, [yukle]);

  async function yenile() {
    setYenileniyor(true);
    await yukle();
    setYenileniyor(false);
  }

  // ---- Hesaplamalar ----
  const ciro = satislar.reduce((t, s) => t + Number(s.toplam_tutar), 0);
  const satisSayisi = satislar.length;
  const topSayisi = satislar.reduce((t, s) => t + s.satis_kalemleri.reduce((a, k) => a + k.adet, 0), 0);
  const netKar = ciro - giderToplami;
  const karMarji = ciro > 0 ? Math.round((netKar / ciro) * 100) : 0;

  // Günlük ciro (dönemdeki her gün, satış olmasa da 0 ile)
  const gunluk: { etiket: string; deger: number }[] = [];
  for (let i = 0; i < gunSayisi; i++) {
    const gunTarihi = new Date(donemBaslangici(gunSayisi).getTime() + i * 24 * 60 * 60 * 1000);
    const anahtar = istanbulGun(gunTarihi.toISOString());
    const deger = satislar.filter((s) => istanbulGun(s.tarih_saat) === anahtar).reduce((t, s) => t + Number(s.toplam_tutar), 0);
    const [, ay, gun] = anahtar.split('-');
    gunluk.push({ etiket: `${Number(gun)}.${Number(ay)}`, deger });
  }

  // Saatlik yoğunluk (çalışma saatleri içinde, satış sayısı)
  const saatlik: { etiket: string; deger: number }[] = [];
  for (let saat = MAGAZA.acilisSaati; saat < MAGAZA.kapanisSaati; saat++) {
    saatlik.push({ etiket: String(saat), deger: satislar.filter((s) => istanbulSaat(s.tarih_saat) === saat).length });
  }
  const enYogunSaat = saatlik.reduce((en, s) => (s.deger > en.deger ? s : en), { etiket: '-', deger: 0 });

  // En çok satan lezzetler (top adedine göre)
  const lezzetMap = new Map<string, { ad: string; renk: string; adet: number; ciro: number }>();
  const kategoriMap = new Map<string, number>();
  for (const s of satislar) {
    for (const k of s.satis_kalemleri) {
      const ad = k.urunler?.ad ?? 'Bilinmeyen';
      const kayit = lezzetMap.get(ad) ?? { ad, renk: k.urunler?.renk ?? '#DDD', adet: 0, ciro: 0 };
      kayit.adet += k.adet;
      kayit.ciro += k.adet * Number(k.birim_fiyat);
      lezzetMap.set(ad, kayit);
      const kat = k.urunler?.kategori ?? 'diger';
      kategoriMap.set(kat, (kategoriMap.get(kat) ?? 0) + k.adet * Number(k.birim_fiyat));
    }
  }
  const lezzetler = [...lezzetMap.values()].sort((a, b) => b.adet - a.adet).slice(0, 10);

  // Ödeme türü dağılımı (ciroya göre)
  const odemeler = ODEME_TURLERI.map((tur) => ({
    tur,
    tutar: satislar.filter((s) => s.odeme_turu === tur).reduce((t, s) => t + Number(s.toplam_tutar), 0),
  }));

  const kategoriler = KATEGORILER.filter((k) => k.id !== 'hepsi')
    .map((k) => ({ ad: k.ad, tutar: kategoriMap.get(k.id) ?? 0 }))
    .filter((k) => k.tutar > 0)
    .sort((a, b) => b.tutar - a.tutar);

  return (
    <ScrollView
      style={styles.ekran}
      contentContainerStyle={styles.icerik}
      refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} />}
    >
      <Pressable onPress={onGeri}>
        <Text style={styles.geri}>‹ Ana sayfa</Text>
      </Pressable>
      <Text style={styles.baslik}>Raporlar</Text>

      <View style={styles.donemler}>
        {DONEMLER.map((d) => (
          <Pressable key={d.id} style={[styles.donem, donem === d.id && styles.donemSecili]} onPress={() => setDonem(d.id)}>
            <Text style={[styles.donemMetin, donem === d.id && styles.donemMetinSecili]}>{d.ad}</Text>
          </Pressable>
        ))}
      </View>

      {yukleniyor ? (
        <ActivityIndicator color={RENK.murekkep} style={{ marginTop: 40 }} />
      ) : satisSayisi === 0 && giderToplami === 0 ? (
        <View style={styles.kart}>
          <Text style={styles.bos}>Bu dönemde satış yok. Satış girdikçe raporlar burada oluşacak.</Text>
        </View>
      ) : (
        <>
          {/* Özet kutuları */}
          <View style={styles.ozetIzgara}>
            <OzetKutu etiket="Ciro" deger={para(ciro)} koyu />
            <OzetKutu etiket="Günlük ortalama" deger={para(ciro / gunSayisi)} />
            <OzetKutu etiket="Giderler" deger={para(giderToplami)} />
            <OzetKutu etiket="Net kâr" deger={para(netKar)} />
          </View>

          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>Kâr</Text>
            <View style={styles.karSatir}>
              <Text style={styles.karEtiket}>Ciro</Text>
              <Text style={styles.karDeger}>{para(ciro)}</Text>
            </View>
            <View style={styles.karSatir}>
              <Text style={styles.karEtiket}>Giderler</Text>
              <Text style={[styles.karDeger, { color: '#B3263E' }]}>− {para(giderToplami)}</Text>
            </View>
            <View style={[styles.karSatir, styles.karToplamSatir]}>
              <Text style={styles.karToplamEtiket}>Net kâr</Text>
              <Text style={[styles.karToplamDeger, { color: netKar >= 0 ? '#1E7A3C' : '#B3263E' }]}>
                {netKar < 0 ? '− ' : ''}
                {para(Math.abs(netKar))}
              </Text>
            </View>
            {ciro > 0 && <Text style={styles.kartAlt}>Kâr marjı: %{karMarji}</Text>}
            <Text style={styles.karNot}>
              Kira gibi aylık giderler girildiği güne yazılır. Kısa dönemlerde kâr bu yüzden olduğundan düşük ya da yüksek görünebilir; en doğru tablo “Son 30 gün”de.
            </Text>
          </View>

          {gunSayisi > 1 && (
            <View style={styles.kart}>
              <Text style={styles.kartBaslik}>Günlük ciro</Text>
              <SutunGrafik veri={gunluk} renk={RENK.murekkep} etiketAraligi={gunSayisi > 7 ? 5 : 1} degerGoster={gunSayisi <= 7} paraBirimi />
            </View>
          )}

          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>Saatlere göre kayıt sayısı</Text>
            <Text style={styles.kartAlt}>
              En yoğun saat: {enYogunSaat.deger > 0 ? `${enYogunSaat.etiket}.00 – ${Number(enYogunSaat.etiket) + 1}.00` : '-'}
            </Text>
            <SutunGrafik veri={saatlik} renk={RENK.pembe} etiketAraligi={2} degerGoster />
          </View>

          {lezzetler.length > 0 && (
          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>En çok satan lezzetler</Text>
            {lezzetler.map((l, i) => (
              <View key={l.ad} style={styles.lezzetSatir}>
                <Text style={styles.sira}>{i + 1}</Text>
                <View style={[styles.top, { backgroundColor: l.renk }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.lezzetUst}>
                    <Text style={styles.lezzetAd}>{l.ad}</Text>
                    <Text style={styles.lezzetDeger}>
                      {l.adet} top · {para(l.ciro)}
                    </Text>
                  </View>
                  <View style={styles.cubukZemin}>
                    <View style={[styles.cubuk, { width: `${(l.adet / lezzetler[0].adet) * 100}%`, backgroundColor: l.renk }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
          )}

          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>Ödeme türleri</Text>
            <View style={styles.yiginCubuk}>
              {odemeler
                .filter((o) => o.tutar > 0)
                .map((o) => (
                  <View key={o.tur} style={{ flex: o.tutar, backgroundColor: ODEME_RENK[o.tur] ?? '#CCC' }} />
                ))}
            </View>
            {odemeler.map((o) => (
              <View key={o.tur} style={styles.lejantSatir}>
                <View style={[styles.lejantKare, { backgroundColor: ODEME_RENK[o.tur] ?? '#CCC' }]} />
                <Text style={styles.lejantAd}>{o.tur}</Text>
                <Text style={styles.lejantDeger}>
                  {para(o.tutar)} · %{ciro ? Math.round((o.tutar / ciro) * 100) : 0}
                </Text>
              </View>
            ))}
          </View>

          {kategoriler.length > 0 && (
          <View style={styles.kart}>
            <Text style={styles.kartBaslik}>Kategorilere göre ciro</Text>
            {kategoriler.map((k) => (
              <View key={k.ad} style={styles.lejantSatir}>
                <Text style={[styles.lejantAd, { flex: 0, width: 80 }]}>{k.ad}</Text>
                <View style={[styles.cubukZemin, { flex: 1, marginHorizontal: 10, marginTop: 0 }]}>
                  <View style={[styles.cubuk, { width: `${(k.tutar / kategoriler[0].tutar) * 100}%`, backgroundColor: RENK.kulah }]} />
                </View>
                <Text style={styles.lejantDeger}>{para(k.tutar)}</Text>
              </View>
            ))}
          </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ---- Küçük yardımcı bileşenler ----

function OzetKutu({ etiket, deger, koyu }: { etiket: string; deger: string; koyu?: boolean }) {
  return (
    <View style={[styles.ozetKutu, koyu && styles.ozetKutuKoyu]}>
      <Text style={[styles.ozetEtiket, koyu && { color: '#E8E4E3' }]}>{etiket}</Text>
      <Text style={[styles.ozetDeger, koyu && { color: RENK.sut }]} numberOfLines={1} adjustsFontSizeToFit>
        {deger}
      </Text>
    </View>
  );
}

// Kütüphanesiz sütun grafik: her sütun, en büyük değere oranla yükseklik alan bir View.
function SutunGrafik({
  veri,
  renk,
  etiketAraligi,
  degerGoster,
  paraBirimi,
}: {
  veri: { etiket: string; deger: number }[];
  renk: string;
  etiketAraligi: number;
  degerGoster?: boolean;
  paraBirimi?: boolean;
}) {
  const enBuyuk = Math.max(1, ...veri.map((v) => v.deger));
  const YUKSEKLIK = 130;
  return (
    <View>
      <View style={[styles.grafik, { height: YUKSEKLIK + 18 }]}>
        {veri.map((v, i) => (
          <View key={i} style={styles.sutunKap}>
            {degerGoster && v.deger > 0 ? (
              <Text style={styles.sutunDeger} numberOfLines={1}>
                {paraBirimi ? Math.round(v.deger) : v.deger}
              </Text>
            ) : null}
            <View
              style={[
                styles.sutun,
                { height: Math.max(v.deger > 0 ? 3 : 0, (v.deger / enBuyuk) * YUKSEKLIK), backgroundColor: renk },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.eksen}>
        {veri.map((v, i) => (
          <Text key={i} style={styles.eksenMetin} numberOfLines={1}>
            {i % etiketAraligi === 0 ? v.etiket : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: 'transparent' },
  icerik: { padding: 20, paddingTop: 70, paddingBottom: 80 },
  geri: { color: RENK.murekkepYumusak, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  baslik: { fontSize: 30, fontWeight: '900', color: RENK.murekkep, marginBottom: 12 },
  donemler: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  donem: { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.sut, alignItems: 'center' },
  donemSecili: { backgroundColor: RENK.murekkep },
  donemMetin: { fontWeight: '800', color: RENK.murekkep, fontSize: 13 },
  donemMetinSecili: { color: RENK.sut },
  ozetIzgara: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  ozetKutu: { width: '48%', backgroundColor: RENK.sut, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, padding: 14, marginBottom: 12 },
  ozetKutuKoyu: { backgroundColor: RENK.murekkep },
  ozetEtiket: { fontSize: 13, fontWeight: '700', color: RENK.murekkepYumusak },
  ozetDeger: { fontSize: 24, fontWeight: '900', color: RENK.murekkep, marginTop: 4 },
  karSatir: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  karEtiket: { fontWeight: '700', color: RENK.murekkepYumusak, fontSize: 15 },
  karDeger: { fontWeight: '800', color: RENK.murekkep, fontSize: 15 },
  karToplamSatir: { borderTopWidth: 1.5, borderTopColor: RENK.murekkep, paddingTop: 8, marginBottom: 4 },
  karToplamEtiket: { fontWeight: '900', color: RENK.murekkep, fontSize: 17 },
  karToplamDeger: { fontWeight: '900', fontSize: 22 },
  karNot: { fontSize: 12, color: RENK.murekkepYumusak, marginTop: 8, lineHeight: 17 },
  kart: { backgroundColor: RENK.sut, borderRadius: 18, borderWidth: 2, borderColor: RENK.murekkep, padding: 16, marginBottom: 14 },
  kartBaslik: { fontSize: 17, fontWeight: '900', color: RENK.murekkep, marginBottom: 4 },
  kartAlt: { fontSize: 13, fontWeight: '600', color: RENK.murekkepYumusak, marginBottom: 6 },
  bos: { color: RENK.murekkepYumusak, fontWeight: '600', textAlign: 'center' },
  grafik: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, gap: 3 },
  sutunKap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sutun: { width: '80%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  sutunDeger: { fontSize: 9, fontWeight: '700', color: RENK.murekkepYumusak, marginBottom: 2 },
  eksen: { flexDirection: 'row', gap: 3, borderTopWidth: 1.5, borderTopColor: RENK.murekkep, paddingTop: 4 },
  eksenMetin: { flex: 1, fontSize: 10, color: RENK.murekkepYumusak, textAlign: 'center' },
  lezzetSatir: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sira: { width: 18, fontWeight: '900', color: RENK.murekkepYumusak },
  top: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: RENK.murekkep },
  lezzetUst: { flexDirection: 'row', justifyContent: 'space-between' },
  lezzetAd: { fontWeight: '800', color: RENK.murekkep, fontSize: 14 },
  lezzetDeger: { fontWeight: '600', color: RENK.murekkepYumusak, fontSize: 12 },
  cubukZemin: { height: 8, backgroundColor: RENK.krema, borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  cubuk: { height: 8, borderRadius: 4 },
  yiginCubuk: { flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', borderWidth: 1.5, borderColor: RENK.murekkep, marginVertical: 10 },
  lejantSatir: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  lejantKare: { width: 12, height: 12, borderRadius: 3, marginRight: 8 },
  lejantAd: { flex: 1, fontWeight: '700', color: RENK.murekkep },
  lejantDeger: { fontWeight: '700', color: RENK.murekkepYumusak, fontSize: 13 },
});
