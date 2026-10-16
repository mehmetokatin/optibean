import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import SatisEkrani, { type Satis } from '../components/SatisEkrani';
import { MAGAZA, RENK, magazaAcikMi } from '../constants/optibean';

const moduller = [
  { baslik: 'Satış', aciklama: 'Yeni satış gir' },
  { baslik: 'Ürünler', aciklama: 'Menü ve fiyatlar' },
  { baslik: 'Stok', aciklama: 'Malzeme takibi' },
  { baslik: 'Giderler', aciklama: 'Kira, fatura, alımlar' },
  { baslik: 'Raporlar', aciklama: 'Ciro ve kâr' },
  { baslik: 'Kampanyalar', aciklama: 'İndirim ve duyurular' },
];

export default function AnaSayfa() {
  const [ekran, setEkran] = useState('ana');
  const [satislar, setSatislar] = useState<Satis[]>([]);

  const bugununCirosu = satislar.reduce((t, s) => t + s.toplam, 0);
  const satisSayisi = satislar.length;
  const acik = magazaAcikMi();

  if (ekran === 'satis') {
    return (
      <SatisEkrani
        onSatisTamamla={(satis) => setSatislar([...satislar, satis])}
        onGeri={() => setEkran('ana')}
      />
    );
  }

  return (
    <ScrollView style={styles.ekran} contentContainerStyle={styles.icerik}>
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

      {moduller.map((modul) => (
        <Pressable
          key={modul.baslik}
          style={styles.modulKarti}
          onPress={() => {
            if (modul.baslik === 'Satış') {
              setEkran('satis');
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: RENK.krema },
  icerik: { padding: 20, paddingTop: 60, paddingBottom: 140 },
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
});
