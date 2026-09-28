// Znak marki Matury Online — to samo „M” co zdjęcie profilowe na socialach
// (matury-online.pl/scripts/fb-assets/pp-A.svg), favicon i ikona apki:
// gradient 135° #22c55e → #4f46e5, radialna poświata, białe „M” Arial Black
// jako ścieżka. Generator plików: matury-online.pl/scripts/brand-mark/build.mjs
// (tam ta sama ścieżka M_PATH).
import React, { useId } from "react";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

const M_PATH =
  "M226 260.8H453L540.6 600.6L627.8 260.8H854V819.2H713.1V393.4L603.8 819.2H476.2L367.3 393.4V819.2H226Z";

export function BrandMark({ size = 56, radius }: { size?: number; radius?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // zaokrąglenie w jednostkach viewBox (domyślnie 25% boku jak logo.png)
  const rx = radius != null ? (radius / size) * 1080 : 270;
  return (
    <Svg width={size} height={size} viewBox="0 0 1080 1080">
      <Defs>
        <LinearGradient id={`g${uid}`} x1="0" y1="0" x2="1080" y2="1080" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#22c55e" />
          <Stop offset="1" stopColor="#4f46e5" />
        </LinearGradient>
        <RadialGradient id={`h${uid}`} cx="540" cy="378" r="648" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.18} />
          <Stop offset="0.6" stopColor="#ffffff" stopOpacity={0.04} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="1080" height="1080" rx={rx} fill={`url(#g${uid})`} />
      <Rect width="1080" height="1080" rx={rx} fill={`url(#h${uid})`} />
      <Path d={M_PATH} fill="#ffffff" />
    </Svg>
  );
}
