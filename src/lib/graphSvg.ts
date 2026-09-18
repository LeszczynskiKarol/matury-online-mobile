// ============================================================================
// Wykres jako SVG (tekst) — jedno źródło dla podglądu i powiększenia
// src/lib/graphSvg.ts
//
// Do 18.09.2026 wykresy (pytania GRAPH_INTERPRET, zadania z funkcjami) rysował
// komponent pisany pod wykresy FUNKCJI wokół zera: siatka co 1, a podpisy osi
// przy osi zerowej. Dla wykresu danych — lata 1965–2023 na osi X, wartości
// 80–140 na osi Y — zero leży daleko poza rysunkiem, więc WSZYSTKIE liczby
// lądowały poza ekranem. Uczeń dostawał linię bez skali i pytanie „odczytaj
// wartość z wykresu" (zgłoszone na geografii). Do tego „Powiększ" miało jeden
// sztywny poziom 2×.
//
// Tu powstaje kompletny SVG jako tekst, dzięki czemu wykres idzie przez ten
// sam podgląd co pozostałe grafiki (SvgViewer → ZoomableSvgModal): szczypanie,
// przesuwanie, podwójne stuknięcie.
//
// Zasady skali:
//   • podziałka „ładna" (1 / 2 / 2,5 / 5 × 10ⁿ), ok. 6 kresek na oś — także
//     ułamkowa (zakres 1–2,1 dostaje 1,0 / 1,2 / 1,4…),
//   • wartości ZAWSZE na dolnej i lewej krawędzi, niezależnie od tego, gdzie
//     wypada zero; osie zerowe rysujemy dodatkowo, gdy mieszczą się w zakresie,
//   • lata bez separatora tysięcy, ułamki z przecinkiem.
// ============================================================================

export interface GraphSpec {
  xRange?: [number, number];
  yRange?: [number, number];
  segments?: { fn: string; from: number; to: number; color?: string; style?: string }[];
  points?: { x: number; y: number; label?: string; color?: string; filled?: boolean }[];
  lines?: { from: [number, number]; to: [number, number]; style?: string; color?: string }[];
  circles?: { center: [number, number]; radius: number; color?: string }[];
  vectors?: { from: [number, number]; to: [number, number]; color?: string }[];
  areas?: { fn: string; from: number; to: number; color?: string; opacity?: number }[];
}

const FN_NAMES =
  "sqrt|abs|sin|cos|tan|asin|acos|atan|log2|log10|log|ln|exp|pow|min|max|floor|ceil|round|sign";

/** Ten sam bezpieczny parser wyrażeń co w dawnym MathGraph (lustro wersji web). */
export function createFn(expr: string): (x: number) => number {
  const prepared = String(expr || "NaN")
    .replace(/Math\./g, "")
    .replace(/([a-zA-Z0-9\)]+)\^([a-zA-Z0-9\.\(]+)/g, "pow($1,$2)")
    .replace(new RegExp(`\\b(${FN_NAMES})\\s*\\(`, "g"), (_m, name: string) =>
      `Math.${name === "ln" ? "log" : name}(`,
    )
    .replace(/\b(pi|PI)\b/g, "Math.PI")
    .replace(/(^|[^0-9.A-Za-z_])(e|E)(?![A-Za-z0-9_])/g, "$1Math.E");
  try {
    return new Function(
      "x",
      `"use strict"; try { return ${prepared}; } catch { return NaN; }`,
    ) as (x: number) => number;
  } catch {
    return () => NaN;
  }
}

const PLOT_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  cyan: "#06b6d4",
  pink: "#ec4899",
  navy: "#6366f1",
  brown: "#b45309",
  black: "#52525b",
  gray: "#71717a",
};
const colorOf = (name?: string) => (name ? PLOT_COLORS[name] || name : PLOT_COLORS.blue);

/** Krok podziałki: 1 / 2 / 2,5 / 5 × 10ⁿ tak, by wyszło ok. `target` kresek. */
export function niceStep(span: number, target = 6): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * pow;
}

function ticksFor(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-6 && out.length < 40; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/** 1985 → „1985", 1.4500001 → „1,45", 0.5 → „0,5". Bez separatora tysięcy. */
export function formatTick(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9) + (String(step).includes("25") ? 1 : 0));
  const s = v.toFixed(decimals);
  return (decimals > 0 ? s.replace(/0+$/, "").replace(/\.$/, "") || "0" : s).replace(".", ",");
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildGraphSvg(
  spec: GraphSpec,
  isDark: boolean,
  opts: { responsive?: boolean } = {},
): string {
  const [xMin, xMax] = spec.xRange ?? [-1, 6];
  const [yMin, yMax] = spec.yRange ?? [-1, 5];
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  // Rozmiar zbliżony do szerokości telefonu, żeby czcionki w podglądzie
  // wychodziły ~1:1; w powiększeniu skaluje się całość.
  const W = 420;
  const H = 300;
  const PL = 50; // lewy margines na wartości osi Y
  const PR = 16;
  const PT = 18;
  const PB = 34; // dolny margines na wartości osi X
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const toX = (x: number) => PL + ((x - xMin) / xSpan) * plotW;
  const toY = (y: number) => PT + ((yMax - y) / ySpan) * plotH;

  const bg = isDark ? "#0f0f23" : "#ffffff";
  const grid = isDark ? "#2a2a3d" : "#e4e4e7";
  const axis = isDark ? "#a1a1aa" : "#52525b";
  const text = isDark ? "#d4d4d8" : "#3f3f46";
  const labelBg = isDark ? "#1e1e38" : "#ffffff";

  const xStep = niceStep(xSpan);
  const yStep = niceStep(ySpan);
  const xt = ticksFor(xMin, xMax, xStep);
  const yt = ticksFor(yMin, yMax, yStep);

  const p: string[] = [];
  p.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"${opts.responsive ? ' style="width:100%;max-width:640px;height:auto"' : ""} font-family="-apple-system,Roboto,Arial,sans-serif">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`,
    `<defs><clipPath id="plot"><rect x="${PL}" y="${PT}" width="${plotW}" height="${plotH}"/></clipPath>`,
    `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>`,
  );

  // ── siatka + wartości na krawędziach ──────────────────────────────────
  for (const v of xt) {
    const X = r1(toX(v));
    p.push(`<line x1="${X}" y1="${PT}" x2="${X}" y2="${PT + plotH}" stroke="${grid}" stroke-width="1"/>`);
    p.push(`<text x="${X}" y="${PT + plotH + 16}" font-size="12" fill="${text}" text-anchor="middle">${esc(formatTick(v, xStep))}</text>`);
  }
  for (const v of yt) {
    const Y = r1(toY(v));
    p.push(`<line x1="${PL}" y1="${Y}" x2="${PL + plotW}" y2="${Y}" stroke="${grid}" stroke-width="1"/>`);
    p.push(`<text x="${PL - 7}" y="${r1(Y + 4)}" font-size="12" fill="${text}" text-anchor="end">${esc(formatTick(v, yStep))}</text>`);
  }

  // ── ramka (lewa + dolna) i osie zerowe, gdy mieszczą się w zakresie ───
  p.push(`<line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + plotH}" stroke="${axis}" stroke-width="1.5"/>`);
  p.push(`<line x1="${PL}" y1="${PT + plotH}" x2="${PL + plotW}" y2="${PT + plotH}" stroke="${axis}" stroke-width="1.5"/>`);
  if (xMin < 0 && xMax > 0) {
    const X = r1(toX(0));
    p.push(`<line x1="${X}" y1="${PT}" x2="${X}" y2="${PT + plotH}" stroke="${axis}" stroke-width="1.5"/>`);
  }
  if (yMin < 0 && yMax > 0) {
    const Y = r1(toY(0));
    p.push(`<line x1="${PL}" y1="${Y}" x2="${PL + plotW}" y2="${Y}" stroke="${axis}" stroke-width="1.5"/>`);
  }

  p.push(`<g clip-path="url(#plot)">`);

  // ── pola pod wykresem ─────────────────────────────────────────────────
  const baseY = yMin <= 0 && yMax >= 0 ? 0 : yMin;
  for (const a of spec.areas ?? []) {
    const f = createFn(a.fn);
    const n = 120;
    const pts: string[] = [`${r1(toX(a.from))},${r1(toY(baseY))}`];
    for (let i = 0; i <= n; i++) {
      const x = a.from + ((a.to - a.from) * i) / n;
      const y = f(x);
      if (Number.isFinite(y)) pts.push(`${r1(toX(x))},${r1(toY(y))}`);
    }
    pts.push(`${r1(toX(a.to))},${r1(toY(baseY))}`);
    p.push(`<polygon points="${pts.join(" ")}" fill="${colorOf(a.color)}" opacity="${a.opacity ?? 0.2}"/>`);
  }

  // ── krzywe ────────────────────────────────────────────────────────────
  for (const s of spec.segments ?? []) {
    const f = createFn(s.fn);
    const n = 240;
    let d = "";
    let pen = false;
    for (let i = 0; i <= n; i++) {
      const x = s.from + ((s.to - s.from) * i) / n;
      const y = f(x);
      // Poza rozsądnym zakresem (asymptoty) podnosimy pióro, żeby nie
      // rysować pionowych kresek przez cały wykres.
      if (!Number.isFinite(y) || y > yMax + ySpan * 3 || y < yMin - ySpan * 3) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${r1(toX(x))},${r1(toY(y))} `;
      pen = true;
    }
    if (d) {
      p.push(
        `<path d="${d.trim()}" fill="none" stroke="${colorOf(s.color)}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"${s.style === "dashed" ? ' stroke-dasharray="6 5"' : ""}/>`,
      );
    }
  }

  // ── odcinki, okręgi, wektory ──────────────────────────────────────────
  for (const l of spec.lines ?? []) {
    p.push(
      `<line x1="${r1(toX(l.from[0]))}" y1="${r1(toY(l.from[1]))}" x2="${r1(toX(l.to[0]))}" y2="${r1(toY(l.to[1]))}" stroke="${colorOf(l.color)}" stroke-width="2"${l.style === "dashed" ? ' stroke-dasharray="6 5"' : ""}/>`,
    );
  }
  for (const c of spec.circles ?? []) {
    p.push(
      `<ellipse cx="${r1(toX(c.center[0]))}" cy="${r1(toY(c.center[1]))}" rx="${r1((c.radius / xSpan) * plotW)}" ry="${r1((c.radius / ySpan) * plotH)}" fill="none" stroke="${colorOf(c.color)}" stroke-width="2"/>`,
    );
  }
  for (const v of spec.vectors ?? []) {
    p.push(
      `<line x1="${r1(toX(v.from[0]))}" y1="${r1(toY(v.from[1]))}" x2="${r1(toX(v.to[0]))}" y2="${r1(toY(v.to[1]))}" stroke="${colorOf(v.color || "red")}" stroke-width="2.5" marker-end="url(#arr)"/>`,
    );
  }
  p.push(`</g>`);

  // ── punkty z podpisami (poza clipPath, żeby podpis przy krawędzi nie był cięty) ──
  for (const pt of spec.points ?? []) {
    const X = toX(pt.x);
    const Y = toY(pt.y);
    const col = colorOf(pt.color || "red");
    p.push(
      `<circle cx="${r1(X)}" cy="${r1(Y)}" r="4.5" fill="${pt.filled === false ? bg : col}" stroke="${col}" stroke-width="2"/>`,
    );
    if (pt.label) {
      const label = String(pt.label);
      const w = Math.min(label.length * 6.4 + 10, plotW);
      const h = 18;
      // Nad punktem; gdy za blisko góry — pod punktem. W poziomie trzymamy
      // podpis w obrębie wykresu, żeby długie etykiety nie wychodziły za ekran.
      let ly = Y - 10 - h;
      if (ly < PT) ly = Y + 10;
      let lx = X - w / 2;
      lx = Math.max(PL + 2, Math.min(lx, PL + plotW - w - 2));
      p.push(
        `<rect x="${r1(lx)}" y="${r1(ly)}" width="${r1(w)}" height="${h}" rx="5" fill="${labelBg}" stroke="${col}" stroke-width="1" opacity="0.95"/>`,
        `<text x="${r1(lx + w / 2)}" y="${r1(ly + 13)}" font-size="11.5" font-weight="600" fill="${text}" text-anchor="middle">${esc(label)}</text>`,
      );
    }
  }

  p.push(`</svg>`);
  return p.join("");
}
