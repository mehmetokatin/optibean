import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import GirisEkrani from '../components/GirisEkrani';
import SatisEkrani, { type SepetKalemi } from '../components/SatisEkrani';
import RaporlarEkrani from '../components/RaporlarEkrani';
import GiderlerEkrani from '../components/GiderlerEkrani';
import StokEkrani from '../components/StokEkrani';
import UrunlerEkrani from '../components/UrunlerEkrani';
import { MAGAZA, RENK, magazaAcikMi, type Kategori, type Urun } from '../constants/optibean';
import { supabase } from '../lib/supabase';

const moduller = [
  { baslik: 'Satış', aciklama: 'Yeni satış gir' },
  { baslik: 'Ürünler', aciklama: 'Menü ve fiyatlar' },
  { baslik: 'Stok', aciklama: 'Malzeme takibi' },
  { baslik: 'Giderler', aciklama: 'Kira, fatura, alımlar' },
  { baslik: 'Raporlar', aciklama: 'Ciro ve kâr' },
  { baslik: 'Kampanyalar', aciklama: 'İndirim ve duyurular' },
];

// İstanbul'da bugünün başlangıcı (gece 00.00), UTC zaman damgası olarak.
// Türkiye sürekli UTC+3 olduğu için 3 saat kaydırmak yeterli.
function bugununBaslangici(): string {
  const istanbul = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const gece = Date.UTC(istanbul.getUTCFullYear(), istanbul.getUTCMonth(), istanbul.getUTCDate()) - 3 * 60 * 60 * 1000;
  return new Date(gece).toISOString();
}

export default function AnaSayfa() {
  const [oturum, setOturum] = useState<Session | null>(null);
  const [oturumKontrolEdildi, setOturumKontrolEdildi] = useState(false);
  const [ekran, setEkran] = useState('ana');
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [bugununCirosu, setBugununCirosu] = useState(0);
  const [satisSayisi, setSatisSayisi] = useState(0);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [azalanlar, setAzalanlar] = useState<{ ad: string; kutu: number }[]>([]);

  // 1) Oturumu takip et: giriş/çıkış olunca ekran kendini günceller.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setOturum(data.session);
      setOturumKontrolEdildi(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_olay, yeniOturum) => setOturum(yeniOturum));
    return () => data.subscription.unsubscribe();
  }, []);

  // 2) Veritabanından ürünleri ve bugünkü satışları çek.
  const verileriYukle = useCallback(async () => {
    const [urunCevap, satisCevap] = await Promise.all([
      supabase.from('urunler').select('id, ad, kategori, renk, satis_fiyati, notu, kutu_sayisi, kritik_kutu').eq('aktif', true).order('id'),
      supabase.from('satislar').select('toplam_tutar').gte('tarih_saat', bugununBaslangici()),
    ]);

    if (urunCevap.error || satisCevap.error) {
      Alert.alert('Bağlantı hatası', 'Veriler yüklenemedi. İnternet bağlantını kontrol et.');
      return;
    }

    setUrunler(
      urunCevap.data.map((u) => ({
        id: u.id,
        ad: u.ad,
        kategori: u.kategori as Kategori,
        renk: u.renk ?? '#DDDDDD',
        fiyat: Number(u.satis_fiyati),
        not: u.notu ?? undefined,
        kutu: u.kutu_sayisi,
      }))
    );
    setAzalanlar(
      urunCevap.data
        .filter((u) => u.kutu_sayisi <= u.kritik_kutu)
        .sort((a, b) => a.kutu_sayisi - b.kutu_sayisi)
        .map((u) => ({ ad: u.ad, kutu: u.kutu_sayisi }))
    );
    setBugununCirosu(satisCevap.data.reduce((t, s) => t + Number(s.toplam_tutar), 0));
    setSatisSayisi(satisCevap.data.length);
  }, []);

  useEffect(() => {
    if (oturum) verileriYukle();
  }, [oturum, verileriYukle]);

  // 3) Satışı veritabanına kaydet (fiş + kalemler + stok tek işlemde).
  async function satisKaydet(kalemler: SepetKalemi[], odemeTuru: string): Promise<boolean> {
    const { error } = await supabase.rpc('satis_kaydet', {
      p_odeme_turu: odemeTuru,
      p_kalemler: kalemler.map((k) => ({ urun_id: k.urun.id, adet: k.adet })),
    });
    if (error) {
      Alert.alert('Satış kaydedilemedi', error.message);
      return false;
    }
    await verileriYukle();
    return true;
  }

  async function yenile() {
    setYenileniyor(true);
    await verileriYukle();
    setYenileniyor(false);
  }

  function cikisYap() {
    Alert.alert('Çıkış yap', 'Hesaptan çıkmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (!oturumKontrolEdildi) {
    return (
      <View style={[styles.ekran, styles.ortala]}>
        <ActivityIndicator color={RENK.murekkep} />
      </View>
    );
  }

  if (!oturum) {
    return <GirisEkrani />;
  }

  if (ekran === 'satis') {
    return <SatisEkrani urunler={urunler} onSatisTamamla={satisKaydet} onGeri={() => setEkran('ana')} />;
  }

  if (ekran === 'giderler') {
    return <GiderlerEkrani onGeri={() => setEkran('ana')} />;
  }

  if (ekran === 'stok') {
    return (
      <StokEkrani
        onGeri={() => {
          setEkran('ana');
          verileriYukle();
        }}
      />
    );
  }

  if (ekran === 'raporlar') {
    return <RaporlarEkrani onGeri={() => setEkran('ana')} />;
  }

  if (ekran === 'urunler') {
    return (
      <UrunlerEkrani
        onGeri={() => {
          setEkran('ana');
          verileriYukle(); // fiyat değiştiyse satış ekranı güncel listeyi alsın
        }}
      />
    );
  }

  const acik = magazaAcikMi();

  return (
    <ScrollView
      style={styles.ekran}
      contentContainerStyle={styles.icerik}
      refreshControl={<RefreshControl refreshing={yenileniyor} onRefresh={yenile} />}
    >
      <Image source={require('../../assets/images/optibean-logo.png')} style={styles.logo} resizeMode="contain" />
      <View style={styles.baslikSatiri}>
        <Text style={styles.altBaslik}>Yönetim Paneli</Text>
        <View style={[styles.durum, { backgroundColor: acik ? '#C8F0C0' : '#F4D3D3' }]}>
          <Text style={styles.durumMetin}>{acik ? 'Şu an açık' : 'Şu an kapalı'}</Text>
        </View>
      </View>

      <View style={styles.ozetKarti}>
        <Text style={styles.ozetEtiket}>Bugünün cirosu</Text>
        <Text style={styles.ozetDeger}>{bugununCirosu} ₺</Text>
        <Text style={styles.ozetEtiket}>{satisSayisi} satış</Text>
      </View>

      {azalanlar.length > 0 && (
        <Pressable style={styles.uyari} onPress={() => setEkran('stok')}>
          <Text style={styles.uyariBaslik}>⚠ {azalanlar.length} lezzet azaldı</Text>
          <Text style={styles.uyariMetin} numberOfLines={3}>
            {azalanlar.map((a) => `${a.ad} (${a.kutu} kutu)`).join(', ')}
          </Text>
        </Pressable>
      )}

      {moduller.map((modul) => (
        <Pressable
          key={modul.baslik}
          style={styles.modulKarti}
          onPress={() => {
            if (modul.baslik === 'Satış') {
              setEkran('satis');
            } else if (modul.baslik === 'Ürünler') {
              setEkran('urunler');
            } else if (modul.baslik === 'Giderler') {
              setEkran('giderler');
            } else if (modul.baslik === 'Stok') {
              setEkran('stok');
            } else if (modul.baslik === 'Raporlar') {
              setEkran('raporlar');
            } else {
              Alert.alert(modul.baslik, 'Bu ekranı yakında birlikte yapacağız.');
            }
          }}
        >
          <Text style={styles.modulBaslik}>{modul.baslik}</Text>
          <Text style={styles.modulAciklama}>{modul.aciklama}</Text>
        </Pressable>
      ))}

      <View style={styles.magazaKarti}>
        <Text style={styles.magazaBaslik}>Mağaza</Text>
        <Text style={styles.magazaSatir}>{MAGAZA.adres}</Text>
        <Text style={styles.magazaSatir}>
          Her gün {MAGAZA.acilisSaati}.00 – {MAGAZA.kapanisSaati}.00
        </Text>
        <View style={styles.magazaButonlar}>
          <Pressable style={styles.kucukButon} onPress={() => Linking.openURL(`tel:${MAGAZA.telefon.replace(/\s/g, '')}`)}>
            <Text style={styles.kucukButonMetin}>{MAGAZA.telefon}</Text>
          </Pressable>
          <Pressable
            style={styles.kucukButon}
            onPress={() => Linking.openURL(`https://instagram.com/${MAGAZA.instagram.replace('@', '')}`)}
          >
            <Text style={styles.kucukButonMetin}>{MAGAZA.instagram}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={cikisYap} style={styles.cikis}>
        <Text style={styles.cikisMetin}>Çıkış yap ({oturum.user.email})</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: RENK.krema },
  ortala: { alignItems: 'center', justifyContent: 'center' },
  icerik: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  logo: { width: 170, height: 138, alignSelf: 'flex-start' },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 18 },
  altBaslik: { fontSize: 18, fontWeight: '800', color: RENK.murekkepYumusak },
  durum: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep },
  durumMetin: { fontWeight: '800', fontSize: 13, color: RENK.murekkep },
  ozetKarti: {
    backgroundColor: RENK.murekkep,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    shadowColor: RENK.pembe,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  ozetEtiket: { color: '#E8E4E3', fontSize: 14, fontWeight: '600' },
  ozetDeger: { color: RENK.sut, fontSize: 38, fontWeight: '900', marginVertical: 6 },
  uyari: { backgroundColor: '#FCE4E4', borderWidth: 2, borderColor: '#B3263E', borderRadius: 18, padding: 14, marginBottom: 14 },
  uyariBaslik: { fontWeight: '900', color: '#B3263E', fontSize: 16 },
  uyariMetin: { color: '#7A1A2B', fontWeight: '600', marginTop: 4, lineHeight: 20 },
  modulKarti: {
    backgroundColor: RENK.sut,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: RENK.murekkep,
  },
  modulBaslik: { fontSize: 18, fontWeight: '900', color: RENK.murekkep },
  modulAciklama: { fontSize: 14, fontWeight: '600', color: RENK.murekkepYumusak, marginTop: 2 },
  magazaKarti: { marginTop: 12, backgroundColor: RENK.sut, borderRadius: 18, padding: 16, borderWidth: 2, borderColor: RENK.cizgi },
  magazaBaslik: { fontSize: 16, fontWeight: '900', color: RENK.murekkep, marginBottom: 6 },
  magazaSatir: { fontSize: 14, color: RENK.murekkepYumusak, marginBottom: 2 },
  magazaButonlar: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  kucukButon: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: RENK.murekkep, backgroundColor: RENK.krema },
  kucukButonMetin: { fontWeight: '800', fontSize: 13, color: RENK.murekkep },
  cikis: { alignSelf: 'center', marginTop: 24, padding: 8 },
  cikisMetin: { color: RENK.murekkepYumusak, fontWeight: '700', fontSize: 13 },
});
