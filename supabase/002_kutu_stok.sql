-- OptiBean: lezzet başına KUTU stoğu (1 kutu = 6 kg)
-- Supabase > SQL Editor > New query: tamamını yapıştır, Run > "Run and enable RLS".

-- Her lezzetin elindeki kutu sayısı ve uyarı sınırı
alter table urunler add column if not exists kutu_sayisi int not null default 0 check (kutu_sayisi >= 0);
alter table urunler add column if not exists kritik_kutu int not null default 1 check (kritik_kutu >= 0);

-- Toplu üretim kaydı (örn. 100 kg sütten yapılan parti)
create table if not exists uretimler (
  id bigint generated always as identity primary key,
  tarih timestamptz not null default now(),
  sut_kg numeric(10,2),
  notu text
);

-- Kutu hareketleri: üretim (+), kutu bitti (-), sayım düzeltmesi (+/-)
create table if not exists kutu_hareketleri (
  id bigint generated always as identity primary key,
  urun_id bigint not null references urunler(id) on delete cascade,
  tur text not null check (tur in ('uretim','bitti','duzeltme')),
  miktar int not null,
  tarih timestamptz not null default now(),
  uretim_id bigint references uretimler(id) on delete set null
);

alter table uretimler enable row level security;
alter table kutu_hareketleri enable row level security;
create policy "sadece_giris_yapmis" on uretimler for all to authenticated using (true) with check (true);
create policy "sadece_giris_yapmis" on kutu_hareketleri for all to authenticated using (true) with check (true);

-- Üretimi tek işlemde kaydet: parti + her lezzete kutu ekleme + hareket kayıtları
create or replace function uretim_kaydet(p_sut_kg numeric, p_notu text, p_kutular jsonb)
returns bigint
language plpgsql
security invoker
as $$
declare
  v_uretim_id bigint;
begin
  if jsonb_array_length(p_kutular) = 0 then
    raise exception 'En az bir lezzet için kutu girilmeli';
  end if;

  insert into uretimler (sut_kg, notu) values (p_sut_kg, nullif(p_notu, '')) returning id into v_uretim_id;

  insert into kutu_hareketleri (urun_id, tur, miktar, uretim_id)
  select (k->>'urun_id')::bigint, 'uretim', (k->>'kutu')::int, v_uretim_id
  from jsonb_array_elements(p_kutular) k
  where (k->>'kutu')::int > 0;

  update urunler u set kutu_sayisi = u.kutu_sayisi + h.miktar
  from kutu_hareketleri h
  where h.uretim_id = v_uretim_id and h.urun_id = u.id;

  return v_uretim_id;
end;
$$;

-- Tek lezzette kutu değişimi: 'bitti' (-1) ya da 'duzeltme' (sayım farkı)
create or replace function kutu_degistir(p_urun_id bigint, p_tur text, p_degisim int)
returns int
language plpgsql
security invoker
as $$
declare
  v_yeni int;
begin
  if p_tur not in ('bitti','duzeltme') then
    raise exception 'Geçersiz hareket türü';
  end if;
  if p_degisim = 0 then
    select kutu_sayisi into v_yeni from urunler where id = p_urun_id;
    return v_yeni;
  end if;

  update urunler set kutu_sayisi = kutu_sayisi + p_degisim
  where id = p_urun_id
  returning kutu_sayisi into v_yeni;

  if v_yeni is null then
    raise exception 'Ürün bulunamadı';
  end if;

  insert into kutu_hareketleri (urun_id, tur, miktar) values (p_urun_id, p_tur, p_degisim);
  return v_yeni;
end;
$$;

revoke execute on function uretim_kaydet(numeric, text, jsonb) from public, anon;
revoke execute on function kutu_degistir(bigint, text, int) from public, anon;
grant execute on function uretim_kaydet(numeric, text, jsonb) to authenticated;
grant execute on function kutu_degistir(bigint, text, int) to authenticated;
