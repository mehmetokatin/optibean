// OptiBean'in mağaza bilgileri, marka renkleri ve lezzet listesi.
// Kaynak: optibean-site (web sitesi). Uygulamanın her ekranı bilgiyi buradan okur,
// bir şeyi değiştirmek istersen sadece bu dosyayı düzenlemen yeterli.

export const MAGAZA = {
  ad: 'OptiBean',
  telefon: '0539 301 34 12',
  adres: 'Aydınlar Mah. Kazım Karabekir Cad. No: 15/B, Çekmeköy/İstanbul',
  acilisSaati: 11,
  kapanisSaati: 24,
  instagram: '@optibean.ice',
};

// Sitedeki renkler (index.html :root)
export const RENK = {
  sut: '#FFFFFF',
  murekkep: '#151414',
  murekkepYumusak: '#4A4645',
  krema: '#FFF6E6',
  kulah: '#EDB96B',
  pembe: '#FF8FB3',
  cizgi: 'rgba(21,20,20,0.12)',
};

export type Kategori = 'meyveli' | 'klasik' | 'ozel' | 'kahve' | 'vegan';

export const KATEGORILER: { id: Kategori | 'hepsi'; ad: string }[] = [
  { id: 'hepsi', ad: 'Tümü' },
  { id: 'meyveli', ad: 'Meyveli' },
  { id: 'klasik', ad: 'Klasikler' },
  { id: 'ozel', ad: 'Özel' },
  { id: 'kahve', ad: 'Kahveli' },
  { id: 'vegan', ad: 'Vegan' },
];

// ⚠️ Sitede fiyat yok. Bunlar ÖRNEK top (porsiyon) fiyatları:
// gerçek fiyatlarını buraya yaz, tüm lezzetler otomatik güncellenir.
export const TOP_FIYATI: Record<Kategori, number> = {
  meyveli: 60,
  klasik: 60,
  ozel: 70,
  kahve: 80,
  vegan: 70,
};

export type Urun = { id: number; ad: string; kategori: Kategori; renk: string; fiyat: number; not?: string };

const lezzetler: { ad: string; kategori: Kategori; renk: string; not?: string }[] = [
  { ad: 'Yaban Mersini', kategori: 'meyveli', renk: '#3D8BD9' },
  { ad: 'Böğürtlen', kategori: 'meyveli', renk: '#9B5BC8' },
  { ad: 'Kivi', kategori: 'meyveli', renk: '#9BCB5A' },
  { ad: 'Mango', kategori: 'meyveli', renk: '#FFBE3D' },
  { ad: 'Muz', kategori: 'meyveli', renk: '#FFE27A' },
  { ad: 'Vişne', kategori: 'meyveli', renk: '#B3263E' },
  { ad: 'Şeftali', kategori: 'meyveli', renk: '#FFAE85' },
  { ad: 'Karadut', kategori: 'meyveli', renk: '#B86B86' },
  { ad: 'Karamuk', kategori: 'meyveli', renk: '#8E8C8F' },
  { ad: 'Limon', kategori: 'meyveli', renk: '#FFF07A' },
  { ad: 'Portakal', kategori: 'meyveli', renk: '#FF9A3C' },
  { ad: 'Ejder Meyvesi', kategori: 'meyveli', renk: '#FF5FA2' },
  { ad: 'Çilek', kategori: 'meyveli', renk: '#FF7A90' },
  { ad: 'Kavun', kategori: 'meyveli', renk: '#F2C98A' },
  { ad: 'Vanilya', kategori: 'klasik', renk: '#FFF0C2' },
  { ad: 'Çikolata', kategori: 'klasik', renk: '#6B3E26' },
  { ad: 'Karamel', kategori: 'klasik', renk: '#D9963F' },
  { ad: 'Krokan', kategori: 'klasik', renk: '#C98A4B' },
  { ad: 'Oreo', kategori: 'klasik', renk: '#8A8A8A' },
  { ad: 'Nutella', kategori: 'klasik', renk: '#7A4A2A' },
  { ad: 'Antep Fıstığı', kategori: 'klasik', renk: '#A8C66C' },
  { ad: 'Hindistan Cevizi', kategori: 'klasik', renk: '#E9E1CF' },
  { ad: 'Damla Sakızı', kategori: 'klasik', renk: '#DDE6CF' },
  { ad: 'Matcha ve Yeşil Çay', kategori: 'ozel', renk: '#B5D94A' },
  { ad: 'Balbadem', kategori: 'ozel', renk: '#E8C27A' },
  { ad: 'Dadu', kategori: 'ozel', renk: '#B0204F', not: 'Bize özel' },
  { ad: 'Brown Sugar Theory', kategori: 'kahve', renk: '#A8754A', not: 'Esmer şeker + espresso' },
  { ad: 'Midnight Mocha', kategori: 'kahve', renk: '#4A2C20', not: 'Espresso + çikolata' },
  { ad: 'Golden Hour', kategori: 'kahve', renk: '#D9A04F', not: 'Espresso + karamel' },
  { ad: 'White Almond', kategori: 'vegan', renk: '#EFE6D2' },
  { ad: 'Oat Cream', kategori: 'vegan', renk: '#E6D9BC' },
];

// id'ler sırayla 1'den başlar; fiyat kategoriden gelir.
export const URUNLER: Urun[] = lezzetler.map((l, i) => ({ id: i + 1, ...l, fiyat: TOP_FIYATI[l.kategori] }));

export const ODEME_TURLERI = ['Nakit', 'Kart', 'Trendyol Yemek'];

// Mağaza şu an açık mı? (İstanbul saatiyle 11.00–24.00; Türkiye sürekli UTC+3)
export function magazaAcikMi(simdi = new Date()): boolean {
  const saat = (simdi.getUTCHours() + 3) % 24;
  return saat >= MAGAZA.acilisSaati && saat < MAGAZA.kapanisSaati;
}
