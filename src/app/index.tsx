import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const moduller = [
  { baslik: 'Satış', aciklama: 'Yeni satış gir' },
  { baslik: 'Ürünler', aciklama: 'Menü ve fiyatlar' },
  { baslik: 'Stok', aciklama: 'Malzeme takibi' },
  { baslik: 'Giderler', aciklama: 'Kira, fatura, alımlar' },
  { baslik: 'Raporlar', aciklama: 'Ciro ve kâr' },
  { baslik: 'Kampanyalar', aciklama: 'İndirim ve duyurular' },
];

export default function AnaSayfa() {
  const bugununCirosu = 1250;
  const satisSayisi = 0;

  return (
    <ScrollView style={styles.ekran} contentContainerStyle={styles.icerik}>
      <Text style={styles.baslik}>OptiBean</Text>
      <Text style={styles.altBaslik}>Yönetim Paneli</Text>

      <View style={styles.ozetKarti}>
        <Text style={styles.ozetEtiket}>Bugünün cirosu</Text>
        <Text style={styles.ozetDeger}>{bugununCirosu} ₺</Text>
        <Text style={styles.ozetEtiket}>{satisSayisi} satış</Text>
      </View>

      {moduller.map((modul) => (
        <Pressable
          key={modul.baslik}
          style={styles.modulKarti}
          onPress={() => Alert.alert(modul.baslik, 'Bu ekranı yakında birlikte yapacağız.')}
        >
          <Text style={styles.modulBaslik}>{modul.baslik}</Text>
          <Text style={styles.modulAciklama}>{modul.aciklama}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ekran: { flex: 1, backgroundColor: '#FFF8F0' },
  icerik: { padding: 20, paddingTop: 70 },
  baslik: { fontSize: 32, fontWeight: 'bold', color: '#4E342E' },
  altBaslik: { fontSize: 16, color: '#8D6E63', marginBottom: 20 },
  ozetKarti: { backgroundColor: '#6D4C41', borderRadius: 16, padding: 20, marginBottom: 20 },
  ozetEtiket: { color: '#EFEBE9', fontSize: 14 },
  ozetDeger: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginVertical: 6 },
  modulKarti: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#D7CCC8' },
  modulBaslik: { fontSize: 18, fontWeight: '600', color: '#4E342E' },
  modulAciklama: { fontSize: 14, color: '#8D6E63', marginTop: 2 },
})