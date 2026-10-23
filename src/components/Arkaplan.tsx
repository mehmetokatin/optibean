import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { RENK } from '../constants/optibean';

// OptiBean arka planı: sitedeki konseptin uygulamadaki karşılığı.
//  • siyah inek benekleri (logodaki inekten)
//  • pastel dondurma topları, külahlarıyla, yavaşça süzülüyor
//  • renkli şekerleme serpintisi
// Kart ve yazıların okunabilirliği bozulmasın diye hepsi soluk tutuldu.
// Tüm ekranların arkasında tek bir kez çizilir (_layout.tsx).

const PASTELLER = ['#FF8FB3', '#FFD36E', '#B9E3A1', '#A9B8F0', '#FFB38A', '#D7B4F3'];

// Aynı tohumla her açılışta aynı "rastgele" yerleşim (ekran zıplamasın diye)
function tohumluRastgele(tohum: number) {
  let s = tohum;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// İnek beneği: köşe yarıçapları farklı iki-üç oval üst üste → düzensiz leke
function Benek({ x, y, boyut, aci }: { x: number; y: number; boyut: number; aci: number }) {
  return (
    <View style={[styles.benekKap, { left: x, top: y, width: boyut, height: boyut * 0.8, transform: [{ rotate: `${aci}deg` }] }]}>
      <View
        style={[
          styles.benek,
          {
            width: boyut,
            height: boyut * 0.7,
            borderTopLeftRadius: boyut * 0.5,
            borderTopRightRadius: boyut * 0.35,
            borderBottomLeftRadius: boyut * 0.3,
            borderBottomRightRadius: boyut * 0.55,
          },
        ]}
      />
      <View
        style={[
          styles.benek,
          {
            position: 'absolute',
            left: boyut * 0.45,
            top: boyut * 0.35,
            width: boyut * 0.55,
            height: boyut * 0.45,
            borderRadius: boyut * 0.3,
          },
        ]}
      />
    </View>
  );
}

function Dondurma({
  x,
  y,
  boyut,
  renk,
  aci,
  suzulme,
}: {
  x: number;
  y: number;
  boyut: number;
  renk: string;
  aci: number;
  suzulme: Animated.AnimatedInterpolation<number> | number;
}) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        alignItems: 'center',
        opacity: 0.5,
        transform: [{ translateY: suzulme }, { rotate: `${aci}deg` }],
      }}
    >
      {/* külah: kenarlıkla çizilmiş üçgen, topun altında kalsın diye önce çiziliyor */}
      <View
        style={{
          position: 'absolute',
          top: boyut * 0.78,
          width: 0,
          height: 0,
          borderLeftWidth: boyut * 0.42,
          borderRightWidth: boyut * 0.42,
          borderTopWidth: boyut * 0.95,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: RENK.kulah,
        }}
      />
      {/* top */}
      <View
        style={{
          width: boyut,
          height: boyut,
          borderRadius: boyut / 2,
          backgroundColor: renk,
          borderWidth: 2,
          borderColor: RENK.murekkep,
        }}
      />
      <View style={{ height: boyut * 0.75 }} />
    </Animated.View>
  );
}

export default function Arkaplan() {
  const { width, height } = useWindowDimensions();
  const [hareketAzalt, setHareketAzalt] = useState(false);
  const zaman = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setHareketAzalt);
  }, []);

  useEffect(() => {
    if (hareketAzalt) return;
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(zaman, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(zaman, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    dongu.start();
    return () => dongu.stop();
  }, [hareketAzalt, zaman]);

  const sahne = useMemo(() => {
    const r = tohumluRastgele(42);
    const benekler = [
      { x: -40, y: height * 0.06, boyut: 150 },
      { x: width - 90, y: height * 0.22, boyut: 120 },
      { x: width * 0.15, y: height * 0.5, boyut: 95 },
      { x: width - 130, y: height * 0.68, boyut: 160 },
      { x: -30, y: height * 0.85, boyut: 120 },
      { x: width * 0.55, y: -40, boyut: 110 },
    ].map((b) => ({ ...b, aci: Math.round(r() * 360) }));

    const dondurmalar = [
      { x: width * 0.72, y: height * 0.1, boyut: 34 },
      { x: width * 0.06, y: height * 0.33, boyut: 28 },
      { x: width * 0.8, y: height * 0.47, boyut: 26 },
      { x: width * 0.42, y: height * 0.78, boyut: 32 },
      { x: width * 0.1, y: height * 0.62, boyut: 24 },
      { x: width * 0.85, y: height * 0.9, boyut: 28 },
    ].map((d, i) => ({ ...d, renk: PASTELLER[i % PASTELLER.length], aci: Math.round(r() * 40 - 20), yon: i % 2 === 0 ? 1 : -1 }));

    const serpinti = Array.from({ length: 34 }, (_, i) => ({
      x: r() * width,
      y: r() * height,
      aci: Math.round(r() * 180),
      renk: PASTELLER[i % PASTELLER.length],
      uzun: 10 + Math.round(r() * 6),
    }));

    return { benekler, dondurmalar, serpinti };
  }, [width, height]);

  return (
    <View style={styles.zemin} pointerEvents="none">
      {sahne.benekler.map((b, i) => (
        <Benek key={`b${i}`} {...b} />
      ))}
      {sahne.serpinti.map((s, i) => (
        <View
          key={`s${i}`}
          style={[styles.serpinti, { left: s.x, top: s.y, height: s.uzun, backgroundColor: s.renk, transform: [{ rotate: `${s.aci}deg` }] }]}
        />
      ))}
      {sahne.dondurmalar.map((d, i) => (
        <Dondurma
          key={`d${i}`}
          {...d}
          suzulme={hareketAzalt ? 0 : zaman.interpolate({ inputRange: [0, 1], outputRange: [0, 8 * d.yon] })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  zemin: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: RENK.krema, overflow: 'hidden' },
  benekKap: { position: 'absolute', opacity: 0.07 },
  benek: { backgroundColor: RENK.murekkep },
  serpinti: { position: 'absolute', width: 4, borderRadius: 2, opacity: 0.55 },
});
