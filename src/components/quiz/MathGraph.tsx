// ============================================================================
// MathGraph — wykres funkcji / danych w pytaniach i arkuszach
// src/components/quiz/MathGraph.tsx
//
// Od 18.09.2026 to cienka nakładka: SVG buduje lib/graphSvg.ts, a wyświetla je
// SvgViewer — ten sam podgląd co inne grafiki, z pełnoekranowym powiększeniem
// (szczypanie, przesuwanie, podwójne stuknięcie).
//
// Poprzednia wersja rysowała przez react-native-svg i miała dwa błędy, które
// razem robiły z pytań „odczytaj z wykresu" zadania nie do rozwiązania:
//   • podpisy osi stały przy osi ZEROWEJ, więc na wykresach danych (lata
//     1965–2023, wartości 80–140) wszystkie liczby wypadały poza rysunek,
//   • „Powiększ" przełączało na jeden sztywny poziom 2× z przewijaniem.
// Interfejs (propsy) został ten sam, więc miejsca użycia się nie zmieniają.
// ============================================================================

import React, { useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { SvgViewer } from "../exam/SvgViewer";
import { buildGraphSvg, type GraphSpec } from "../../lib/graphSvg";

export interface MathGraphProps extends GraphSpec {
  /** Zostawione dla zgodności — wysokość podglądu ustala SvgViewer. */
  height?: number;
}

export function MathGraph({
  xRange,
  yRange,
  segments,
  points,
  lines,
  circles,
  vectors,
  areas,
}: MathGraphProps) {
  const { isDark, colors: theme } = useTheme();

  const svg = useMemo(
    () =>
      buildGraphSvg(
        { xRange, yRange, segments, points, lines, circles, vectors, areas },
        isDark,
      ),
    // Treść pytania jest niezmienna w trakcie jego wyświetlania — JSON jako
    // klucz wystarcza i nie przelicza 240 punktów krzywej przy każdym renderze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isDark,
      JSON.stringify([xRange, yRange, segments, points, lines, circles, vectors, areas]),
    ],
  );

  return <SvgViewer svg={svg} theme={theme} />;
}

export default MathGraph;
