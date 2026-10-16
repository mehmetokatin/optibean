// OptiBean'in mağaza bilgileri, marka renkleri ve lezzet listesi.
// Kaynak: optibean-site (web sitesi).

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

// Lezzetler ve fiyatları artık Supabase'deki `urunler` tablosunda duruyor.
export type Urun = { id: number; ad: string; kategori: Kategori; renk: string; fiyat: number; not?: string };

export const ODEME_TURLERI = ['Nakit', 'Kart', 'Trendyol Yemek'];

// Mağaza şu an açık mı? (İstanbul saatiyle 11.00–24.00; Türkiye sürekli UTC+3)
export function magazaAcikMi(simdi = new Date()): boolean {
  const saat = (simdi.getUTCHours() + 3) % 24;
  return saat >= MAGAZA.acilisSaati && saat < MAGAZA.kapanisSaati;
}
