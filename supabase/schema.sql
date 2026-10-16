-- OptiBean yönetim uygulaması: veritabanı şeması (PostgreSQL / Supabase)
-- Supabase > SQL Editor > New query: bu dosyanın tamamını yapıştır ve Run'a bas.

-- 1) ÜRÜNLER (lezzetler)
create table urunler (
  id bigint generated always as identity primary key,
  ad text not null unique,
  kategori text not null check (kategori in ('meyveli','klasik','ozel','kahve','vegan')),
  renk text,
  satis_fiyati numeric(10,2) not null check (satis_fiyati >= 0),
  notu text,
  aktif boolean not null default true
);

-- 2) SATIŞLAR (fiş) ve 3) SATIŞ KALEMLERİ (fişin satırları)
create table satislar (
  id bigint generated always as identity primary key,
  tarih_saat timestamptz not null default now(),
  odeme_turu text not null check (odeme_turu in ('Nakit','Kart','Trendyol Yemek')),
  toplam_tutar numeric(10,2) not null default 0
);

create table satis_kalemleri (
  id bigint generated always as identity primary key,
  satis_id bigint not null references satislar(id) on delete cascade,
  urun_id bigint not null references urunler(id),
  adet int not null check (adet > 0),
  birim_fiyat numeric(10,2) not null  -- satış anındaki fiyat (zam olsa da geçmiş değişmez)
);

-- 4) MALZEMELER, 5) REÇETELER, 6) STOK HAREKETLERİ
create table malzemeler (
  id bigint generated always as identity primary key,
  ad text not null unique,
  birim text not null,                       -- kg, lt, adet...
  stok_miktari numeric(12,3) not null default 0,
  kritik_seviye numeric(12,3) not null default 0,
  birim_maliyet numeric(10,2) not null default 0
);

create table receteler (
  urun_id bigint not null references urunler(id) on delete cascade,
  malzeme_id bigint not null references malzemeler(id) on delete cascade,
  miktar numeric(12,3) not null check (miktar > 0),  -- 1 top için gereken miktar
  primary key (urun_id, malzeme_id)
);

create table stok_hareketleri (
  id bigint generated always as identity primary key,
  malzeme_id bigint not null references malzemeler(id) on delete cascade,
  tur text not null check (tur in ('giris','satis','fire','duzeltme')),
  miktar numeric(12,3) not null,             -- giriş +, çıkış -
  tarih timestamptz not null default now(),
  satis_id bigint references satislar(id) on delete set null
);

-- 7) GİDERLER, 8) GEÇMİŞ KAZANÇ (defterdeki gün sonu toplamları)
create table giderler (
  id bigint generated always as identity primary key,
  tarih date not null default current_date,
  kategori text not null,                    -- kira, fatura, malzeme, diğer...
  aciklama text,
  tutar numeric(10,2) not null check (tutar >= 0)
);

create table gecmis_kazanc (
  tarih date primary key,
  tutar numeric(10,2) not null
);

-- SATIŞI TEK SEFERDE KAYDEDEN FONKSİYON
-- Fiş + kalemler + stok düşümü tek işlemde (transaction) yapılır:
-- biri başarısız olursa hiçbiri kaydedilmez. Fiyatlar uygulamadan değil veritabanından alınır.
create or replace function satis_kaydet(p_odeme_turu text, p_kalemler jsonb)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_satis_id bigint;
  v_toplam numeric(10,2);
begin
  insert into satislar (odeme_turu) values (p_odeme_turu) returning id into v_satis_id;

  insert into satis_kalemleri (satis_id, urun_id, adet, birim_fiyat)
  select v_satis_id, u.id, (k->>'adet')::int, u.satis_fiyati
  from jsonb_array_elements(p_kalemler) k
  join urunler u on u.id = (k->>'urun_id')::bigint;

  select coalesce(sum(adet * birim_fiyat), 0) into v_toplam
  from satis_kalemleri where satis_id = v_satis_id;

  if v_toplam = 0 then
    raise exception 'Sepet boş ya da ürün bulunamadı';
  end if;

  update satislar set toplam_tutar = v_toplam where id = v_satis_id;

  -- reçetesi tanımlı ürünler için stoktan düş
  insert into stok_hareketleri (malzeme_id, tur, miktar, satis_id)
  select r.malzeme_id, 'satis', -sum(r.miktar * sk.adet), v_satis_id
  from satis_kalemleri sk join receteler r on r.urun_id = sk.urun_id
  where sk.satis_id = v_satis_id
  group by r.malzeme_id;

  update malzemeler m set stok_miktari = m.stok_miktari + h.miktar
  from stok_hareketleri h
  where h.satis_id = v_satis_id and h.malzeme_id = m.id;

  return v_satis_id;
end;
$$;

-- GÜVENLİK: Row Level Security
-- Uygulamadaki anahtar herkese açık sayılır; bu yüzden tablolara SADECE giriş yapmış kullanıcı (sen) erişebilir.
do $$
declare t text;
begin
  foreach t in array array['urunler','satislar','satis_kalemleri','malzemeler','receteler','stok_hareketleri','giderler','gecmis_kazanc']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "sadece_giris_yapmis" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke execute on function satis_kaydet(text, jsonb) from public, anon;
grant execute on function satis_kaydet(text, jsonb) to authenticated;

-- BAŞLANGIÇ VERİSİ: sitedeki 31 lezzet (fiyatlar ÖRNEK, Ürünler ekranından değiştirilecek)
insert into urunler (ad, kategori, renk, satis_fiyati, notu) values
('Yaban Mersini','meyveli','#3D8BD9',60,null),
('Böğürtlen','meyveli','#9B5BC8',60,null),
('Kivi','meyveli','#9BCB5A',60,null),
('Mango','meyveli','#FFBE3D',60,null),
('Muz','meyveli','#FFE27A',60,null),
('Vişne','meyveli','#B3263E',60,null),
('Şeftali','meyveli','#FFAE85',60,null),
('Karadut','meyveli','#B86B86',60,null),
('Karamuk','meyveli','#8E8C8F',60,null),
('Limon','meyveli','#FFF07A',60,null),
('Portakal','meyveli','#FF9A3C',60,null),
('Ejder Meyvesi','meyveli','#FF5FA2',60,null),
('Çilek','meyveli','#FF7A90',60,null),
('Kavun','meyveli','#F2C98A',60,null),
('Vanilya','klasik','#FFF0C2',60,null),
('Çikolata','klasik','#6B3E26',60,null),
('Karamel','klasik','#D9963F',60,null),
('Krokan','klasik','#C98A4B',60,null),
('Oreo','klasik','#8A8A8A',60,null),
('Nutella','klasik','#7A4A2A',60,null),
('Antep Fıstığı','klasik','#A8C66C',60,null),
('Hindistan Cevizi','klasik','#E9E1CF',60,null),
('Damla Sakızı','klasik','#DDE6CF',60,null),
('Matcha ve Yeşil Çay','ozel','#B5D94A',70,null),
('Balbadem','ozel','#E8C27A',70,null),
('Dadu','ozel','#B0204F',70,'Bize özel'),
('Brown Sugar Theory','kahve','#A8754A',80,'Esmer şeker + espresso'),
('Midnight Mocha','kahve','#4A2C20',80,'Espresso + çikolata'),
('Golden Hour','kahve','#D9A04F',80,'Espresso + karamel'),
('White Almond','vegan','#EFE6D2',70,null),
('Oat Cream','vegan','#E6D9BC',70,null);
