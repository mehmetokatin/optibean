<p align="center">
  <img src="assets/images/optibean-logo.png" alt="OptiBean" width="220">
</p>

<h1 align="center">OptiBean Yönetim Uygulaması</h1>

<p align="center">
  İstanbul Çekmeköy'deki dondurma mağazam <b>OptiBean</b> için geliştirdiğim, mağazada her gün kullandığım mobil işletme yönetim sistemi.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/platform-iOS-lightgrey?logo=apple" alt="iOS">
</p>

---

## Problem

Mağazada satışlar bir deftere yalnızca **gün sonu toplamı** olarak yazılıyordu. Bu yüzden şu sorulara cevap verilemiyordu:

- Hangi lezzet ne kadar satıyor, hangisi menüden çıkmalı?
- Günün hangi saatleri yoğun?
- Nakit, kart ve Trendyol Yemek satışlarının payı ne?
- Ay sonunda giderler düşüldükten sonra gerçekte ne kadar kâr kalıyor?
- Hangi lezzetin kutusu bitmek üzere, ne zaman üretim yapılmalı?

## Çözüm

Kağıt üzerindeki süreci dijitale taşıyan, tek kullanıcılı bir mobil uygulama. Her satış tek tek kayda giriyor; raporlar, stok uyarıları ve kâr hesabı bu ayrıntılı veriden otomatik üretiliyor.

## Ekran görüntüleri

| Ana ekran | Satış | Raporlar |
|:---:|:---:|:---:|
| <img src="docs/ekranlar/ana-ekran.png" width="230"> | <img src="docs/ekranlar/satis.png" width="230"> | <img src="docs/ekranlar/raporlar.png" width="230"> |

| Stok | Giderler | Giriş |
|:---:|:---:|:---:|
| <img src="docs/ekranlar/stok.png" width="230"> | <img src="docs/ekranlar/giderler.png" width="230"> | <img src="docs/ekranlar/giris.png" width="230"> |

## Özellikler

**Satış (kasa ekranı)**
- İki dokunuşla satış: lezzetlere dokun, ödeme türüne dokun
- Lezzetler son 30 günün satışına göre sıralanır; en çok satanlar hep en üstte
- Kayıt arka planda yapılır; bağlantı koparsa sepet geri gelir, satış kaybolmaz

**Raporlar**
- Bugün / son 7 gün / son 30 gün için ciro, satış sayısı, ortalama sepet
- Günlük ciro grafiği, saatlere göre yoğunluk, en çok satan 10 lezzet
- Ödeme türü ve kategori dağılımı
- **Net kâr** ve kâr marjı (ciro − giderler)

**Kutu bazlı stok**
- Dondurmalar 6 kg'lık kutularda üretiliyor; stok lezzet başına kutu olarak tutulur
- Toplu üretim girişi (örn. 100 kg sütten hangi lezzetten kaç kutu çıktı)
- Kutu bitince tek dokunuşla düşüm, sayım düzeltmesi
- Kritik seviyenin altına düşen lezzetler için ana ekranda uyarı

**Giderler ve ürünler**
- Kategorili gider kaydı, aylık toplam ve dağılım
- Fiyat güncelleme, kategoriye toplu fiyat, lezzeti pasife alma

## Teknik mimari

```mermaid
flowchart LR
  A["iPhone<br/>React Native (Expo)"] -- "supabase-js<br/>HTTPS + JWT" --> B["Supabase Auth"]
  A -- "REST / RPC" --> C[("PostgreSQL<br/>Row Level Security")]
  C --- D["satis_kaydet()<br/>uretim_kaydet()<br/>kutu_degistir()"]
  E["EAS Update"] -. "kod güncellemeleri" .-> A
```

| Katman | Teknoloji |
|---|---|
| Mobil uygulama | React Native, Expo SDK 57, Expo Router, TypeScript |
| Veritabanı | PostgreSQL (Supabase) |
| Kimlik doğrulama | Supabase Auth (e-posta/şifre, kayıt kapalı) |
| Dağıtım | EAS Update |
| Sürüm kontrolü | Git, GitHub |

## Veritabanı tasarımı

```mermaid
erDiagram
  URUNLER ||--o{ SATIS_KALEMLERI : "satılır"
  SATISLAR ||--|{ SATIS_KALEMLERI : "içerir"
  URUNLER ||--o{ KUTU_HAREKETLERI : "stok değişir"
  URETIMLER ||--o{ KUTU_HAREKETLERI : "üretir"
  URUNLER ||--o{ RECETELER : "kullanır"
  MALZEMELER ||--o{ RECETELER : "gerekir"
  MALZEMELER ||--o{ STOK_HAREKETLERI : "değişir"

  URUNLER {
    bigint id PK
    text ad
    text kategori
    numeric satis_fiyati
    int kutu_sayisi
    int kritik_kutu
    bool aktif
  }
  SATISLAR {
    bigint id PK
    timestamptz tarih_saat
    text odeme_turu
    numeric toplam_tutar
  }
  SATIS_KALEMLERI {
    bigint id PK
    bigint satis_id FK
    bigint urun_id FK
    int adet
    numeric birim_fiyat
  }
  URETIMLER {
    bigint id PK
    timestamptz tarih
    numeric sut_kg
  }
  KUTU_HAREKETLERI {
    bigint id PK
    bigint urun_id FK
    text tur
    int miktar
    bigint uretim_id FK
  }
  GIDERLER {
    bigint id PK
    date tarih
    text kategori
    numeric tutar
  }
  MALZEMELER {
    bigint id PK
    text ad
    numeric stok_miktari
  }
  RECETELER {
    bigint urun_id FK
    bigint malzeme_id FK
    numeric miktar
  }
  STOK_HAREKETLERI {
    bigint id PK
    bigint malzeme_id FK
    text tur
    numeric miktar
  }
```

### Tasarım kararları

- **Satış ve satış kalemleri ayrı tablolar (normalizasyon).** Bir satış birden fazla lezzet içerebilir; fişe ait bilgiler (tarih, ödeme türü) her satırda tekrar edilmez.
- **Satış anındaki fiyat kalemde saklanır (`birim_fiyat`).** Fiyat güncellendiğinde geçmiş satışların tutarı ve raporlar değişmez.
- **Stok bir sayı değil, hareket kaydı.** Üretim, kutu bitişi ve sayım düzeltmeleri ayrı satırlar olarak tutulur; stok geçmişi ve tüketim hızı bu kayıtlardan çıkarılabilir.
- **İşlemler (transaction) veritabanı fonksiyonlarında.** `satis_kaydet()` fiş, kalemler ve stok düşümünü tek işlemde yapar; biri başarısız olursa hiçbiri kaydedilmez. Fiyatlar istemciden değil veritabanından alınır.
- **Kısıtlar veritabanında.** `CHECK` kısıtları negatif stoğu, geçersiz ödeme türünü ve sıfır adetli kalemi engeller.

## Güvenlik

- Tüm tablolarda **Row Level Security** açık; veriye yalnızca giriş yapmış kullanıcı erişebilir.
- Yeni kullanıcı kaydı kapalı; sistemin tek kullanıcısı mağaza sahibi.
- Uygulamadaki Supabase anahtarı, istemcide kullanılmak üzere tasarlanmış *publishable* anahtardır. Tek başına veri erişimi sağlamaz.
- Veritabanı fonksiyonlarını çalıştırma yetkisi anonim kullanıcılardan alınmıştır.

## Proje yapısı

```
src/
├── app/
│   ├── _layout.tsx        # Kök düzen
│   └── index.tsx          # Oturum kontrolü, ana ekran, ekranlar arası geçiş
├── components/
│   ├── GirisEkrani.tsx
│   ├── SatisEkrani.tsx
│   ├── UrunlerEkrani.tsx
│   ├── StokEkrani.tsx
│   ├── GiderlerEkrani.tsx
│   └── RaporlarEkrani.tsx
├── constants/
│   ├── optibean.ts        # Mağaza bilgileri, marka renkleri, kategoriler
│   └── supabaseAyar.ts    # Supabase bağlantı bilgileri
└── lib/
    └── supabase.ts        # Supabase istemcisi
supabase/
├── schema.sql             # Tablolar, fonksiyonlar, RLS, başlangıç verisi
└── 002_kutu_stok.sql      # Kutu bazlı stok
```

## Kurulum

```bash
git clone https://github.com/mehmetokatin/optibean-app.git
cd optibean-app
npm install
```

1. [Supabase](https://supabase.com)'de bir proje oluşturun; SQL Editor'de sırasıyla `supabase/schema.sql` ve `supabase/002_kutu_stok.sql` dosyalarını çalıştırın.
2. Authentication bölümünden bir kullanıcı oluşturun ve yeni kayıtları kapatın.
3. `src/constants/supabaseAyar.ts` dosyasına kendi proje URL'nizi ve publishable anahtarınızı yazın.
4. `npx expo start` ile başlatın, iPhone'daki Expo Go ile QR kodu okutun.

## Yol haritası

- [ ] Trendyol Yemek komisyonunun otomatik hesaplanması
- [ ] Haftalık kutu tüketimine göre üretim önerisi
- [ ] Aylık rapor özetinin PDF olarak dışa aktarımı
- [ ] App Store / TestFlight dağıtımı

---

<p align="center">
  <b>Mehmet</b> (<a href="https://github.com/mehmetokatin">@mehmetokatin</a>) · Yeditepe Üniversitesi, Yönetim Bilişim Sistemleri<br>
  <a href="https://instagram.com/optibean.ice">@optibean.ice</a>
</p>
