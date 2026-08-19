// =============================================================================
// MaterialRenderer — obsługuje wszystkie typy materiałów egzaminacyjnych:
// text, chart (SVG line/bar), table, map_poland, image
// =============================================================================

import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Image, Dimensions } from "react-native";
import Svg, {
  Line,
  Polyline,
  Rect,
  Circle,
  Text as SvgText,
  G,
} from "react-native-svg";
import { WebView } from "react-native-webview";
import { colors } from "../../theme/colors";
import { SvgViewer } from "./SvgViewer";
import { parseChemText } from "../../utils/chemText";
import { SqlSchemaView } from "./Tier2TaskRenderers";

interface MaterialProps {
  mat: any;
  theme: any;
  isDark: boolean;
}

// ── Wykres liniowy / słupkowy (chartData) ─────────────────────────────────

function ChartMaterial({ mat, theme, isDark }: MaterialProps) {
  // chartData / experimentChartData / diagramData — różne nazwy backendu
  const cd =
    mat.chartData || mat.experimentChartData || mat.diagramData || {};
  const chartType = cd.chartType || "line";
  const datasets: any[] = Array.isArray(cd.datasets) ? cd.datasets : [];

  const width = Math.min(Dimensions.get("window").width - 64, 480);
  const height = 240;
  const padL = 44;
  const padR = 12;
  const padT = 16;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Wszystkie punkty
  const allPoints = datasets.flatMap((d: any) => d.data || []);
  if (allPoints.length === 0) {
    return (
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
        Brak danych do wykresu.
      </Text>
    );
  }
  // X labels (z pierwszego datasetu)
  const xLabels: string[] = (datasets[0]?.data || []).map((p: any) =>
    String(p.x),
  );
  // Y range
  const yValues = allPoints.map((p: any) => Number(p.y) || 0);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yRange = yMax - yMin || 1;
  const yLow = yMin - yRange * 0.1;
  const yHigh = yMax + yRange * 0.1;
  const yToPx = (y: number) =>
    padT + plotH - ((y - yLow) / (yHigh - yLow)) * plotH;
  const xToPx = (i: number) =>
    padL + (xLabels.length > 1 ? (i / (xLabels.length - 1)) * plotW : plotW / 2);

  // Y-axis ticks (5)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(yLow + ((yHigh - yLow) * i) / 4);
    }
    return ticks;
  }, [yLow, yHigh]);

  const axisColor = isDark ? "#475569" : "#cbd5e1";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";
  const textColor = isDark ? "#cbd5e1" : "#475569";

  return (
    <View>
      <ScrollView horizontal>
        <Svg width={width} height={height}>
          {/* Grid + Y-axis ticks */}
          {yTicks.map((tv, i) => {
            const y = yToPx(tv);
            return (
              <G key={`y${i}`}>
                <Line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth={1}
                />
                <SvgText
                  x={padL - 6}
                  y={y + 4}
                  fontSize={9}
                  fill={textColor}
                  textAnchor="end"
                >
                  {Number.isInteger(tv) ? String(tv) : tv.toFixed(2)}
                </SvgText>
              </G>
            );
          })}
          {/* X axis */}
          <Line
            x1={padL}
            x2={width - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={axisColor}
            strokeWidth={1.5}
          />
          {/* X labels */}
          {xLabels.map((lbl, i) => (
            <SvgText
              key={`x${i}`}
              x={xToPx(i)}
              y={padT + plotH + 14}
              fontSize={9}
              fill={textColor}
              textAnchor="middle"
            >
              {lbl}
            </SvgText>
          ))}
          {/* Datasets */}
          {datasets.map((ds: any, di: number) => {
            const color = ds.color || colors.brand[500];
            if (chartType === "bar") {
              const barW = (plotW / xLabels.length) * 0.6;
              return (
                <G key={di}>
                  {(ds.data || []).map((p: any, i: number) => {
                    const yPx = yToPx(Number(p.y) || 0);
                    const xPx = xToPx(i);
                    return (
                      <Rect
                        key={i}
                        x={xPx - barW / 2}
                        y={yPx}
                        width={barW}
                        height={padT + plotH - yPx}
                        fill={color}
                        opacity={0.85}
                      />
                    );
                  })}
                </G>
              );
            }
            // line
            const points = (ds.data || [])
              .map((p: any, i: number) => `${xToPx(i)},${yToPx(Number(p.y) || 0)}`)
              .join(" ");
            return (
              <G key={di}>
                <Polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                />
                {(ds.data || []).map((p: any, i: number) => (
                  <Circle
                    key={i}
                    cx={xToPx(i)}
                    cy={yToPx(Number(p.y) || 0)}
                    r={3}
                    fill={color}
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      </ScrollView>

      {/* Y label */}
      {cd.yLabel && (
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: theme.textSecondary,
            marginTop: 4,
          }}
        >
          y: {cd.yLabel}
        </Text>
      )}
      {cd.xLabel && (
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: theme.textSecondary,
          }}
        >
          x: {cd.xLabel}
        </Text>
      )}

      {/* Legenda */}
      {datasets.length > 1 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 8,
          }}
        >
          {datasets.map((ds: any, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 3,
                  borderRadius: 1,
                  backgroundColor: ds.color || colors.brand[500],
                }}
              />
              <Text style={{ fontSize: 10, color: theme.text }}>
                {ds.name || `Seria ${i + 1}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Tabela (tableData) ─────────────────────────────────────────────────────

function TableMaterial({ mat, theme, isDark }: MaterialProps) {
  // Generator zapisuje tabele materiałów w mat.table ({headers, rows});
  // starsze materiały WoS/historia używają mat.tableData. Bez fallbacku
  // materiał typu "table" renderował się jako pusta ramka.
  const td = mat.tableData || mat.table || {};
  const headers: string[] = Array.isArray(td.headers) ? td.headers : [];
  const rows: string[][] = Array.isArray(td.rows) ? td.rows : [];

  return (
    <View>
      <ScrollView horizontal>
        <View
          style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {headers.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
              }}
            >
              {headers.map((h, i) => (
                <View
                  key={i}
                  style={{
                    minWidth: i === 0 ? 200 : 80,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRightWidth: i < headers.length - 1 ? 1 : 0,
                    borderColor: theme.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color: theme.text,
                    }}
                  >
                    {h}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {rows.map((row, ri) => (
            <View
              key={ri}
              style={{
                flexDirection: "row",
                borderTopWidth: 1,
                borderColor: theme.border,
              }}
            >
              {row.map((cell, ci) => (
                <View
                  key={ci}
                  style={{
                    minWidth: ci === 0 ? 200 : 80,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRightWidth: ci < row.length - 1 ? 1 : 0,
                    borderColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: theme.text }}>
                    {cell}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {td.caption && (
        <Text
          style={{
            fontSize: 10,
            fontStyle: "italic",
            color: theme.textTertiary,
            marginTop: 6,
          }}
        >
          {td.caption}
        </Text>
      )}
    </View>
  );
}

// ── Mapa Europy (europeMapData) i diagram władzy (govDiagramData) ─────────
// Oba typy leciały wcześniej w tekstowy fallback, więc na telefonie z całego
// materiału zostawał jednozdaniowy opis — a zadania odwołują się wprost do
// jego treści („na podstawie mapy…", „na podstawie diagramu…").
//
// Nie odtwarzamy SVG z wersji webowej. Web i tak renderuje mapę Europy jako
// skategoryzowaną LISTĘ państw, a nie realną mapę; diagram sprowadzamy do
// listy organów i relacji między nimi. Na ekranie telefonu lista jest
// czytelniejsza od ściśniętego schematu, a do odpowiedzi na te polecenia
// potrzebne są dokładnie te dane: kto w której grupie i kto kogo powołuje.

const NAZWY_PANSTW: Record<string, string> = {
  AUT: "Austria", AT: "Austria", BEL: "Belgia", BE: "Belgia",
  BGR: "Bułgaria", BG: "Bułgaria", BIH: "Bośnia i Hercegowina", BA: "Bośnia i Hercegowina",
  BLR: "Białoruś", BY: "Białoruś", CHE: "Szwajcaria", CH: "Szwajcaria",
  CYP: "Cypr", CY: "Cypr", CZE: "Czechy", CZ: "Czechy",
  DEU: "Niemcy", DE: "Niemcy", DNK: "Dania", DK: "Dania",
  ESP: "Hiszpania", ES: "Hiszpania", EST: "Estonia", EE: "Estonia",
  FIN: "Finlandia", FI: "Finlandia", FRA: "Francja", FR: "Francja",
  GBR: "Wielka Brytania", UK: "Wielka Brytania", GB: "Wielka Brytania",
  GRC: "Grecja", GR: "Grecja", HRV: "Chorwacja", HR: "Chorwacja",
  HUN: "Węgry", HU: "Węgry", IRL: "Irlandia", IE: "Irlandia",
  ISL: "Islandia", IS: "Islandia", ITA: "Włochy", IT: "Włochy",
  LTU: "Litwa", LT: "Litwa", LUX: "Luksemburg", LU: "Luksemburg",
  LVA: "Łotwa", LV: "Łotwa", MDA: "Mołdawia", MD: "Mołdawia",
  MKD: "Macedonia Północna", MK: "Macedonia Północna", MLT: "Malta", MT: "Malta",
  MNE: "Czarnogóra", ME: "Czarnogóra", NLD: "Holandia", NL: "Holandia",
  NOR: "Norwegia", NO: "Norwegia", POL: "Polska", PL: "Polska",
  PRT: "Portugalia", PT: "Portugalia", ROU: "Rumunia", RO: "Rumunia",
  RUS: "Rosja", RU: "Rosja", SRB: "Serbia", RS: "Serbia",
  SVK: "Słowacja", SK: "Słowacja", SVN: "Słowenia", SI: "Słowenia",
  SWE: "Szwecja", SE: "Szwecja", TUR: "Turcja", TR: "Turcja",
  UKR: "Ukraina", UA: "Ukraina", ALB: "Albania", AL: "Albania",
};

// Te same nazwy kolorów co w wersji webowej — dane w bazie trzymają „blue",
// „yellow" itd., a nie wartości heksadecymalne.
const KOLORY: Record<string, string> = {
  blue: "#3b82f6", red: "#ef4444", green: "#22c55e", yellow: "#fbbf24",
  gray: "#94a3b8", purple: "#a855f7", orange: "#f97316", navy: "#1e3a8a",
  emerald: "#10b981", pink: "#ec4899", cyan: "#06b6d4", lime: "#84cc16",
  amber: "#f59e0b",
};

const barwa = (c?: string, fallback = "#cbd5e1") =>
  !c ? fallback : c.startsWith("#") || c.startsWith("rgb") ? c : KOLORY[c] || fallback;

function MapEuropeMaterial({ mat, theme, isDark }: MaterialProps) {
  const md = mat.europeMapData || {};
  const countries: Record<string, any> = md.countries || {};
  const legend: any[] = Array.isArray(md.legend) ? md.legend : [];
  if (Object.keys(countries).length === 0) return null;

  type Wpis = { nazwa: string; since?: string | null };
  const grupy: { color: string; label: string; items: Wpis[] }[] = legend.map(
    (l: any) => ({ color: l.color, label: l.label, items: [] }),
  );
  const inne: Wpis[] = [];

  for (const [kod, c] of Object.entries(countries)) {
    const wpis: Wpis = {
      nazwa: NAZWY_PANSTW[kod.toUpperCase()] || kod,
      since: (c as any)?.since,
    };
    const g = grupy.find((x) => x.color === (c as any)?.color);
    (g ? g.items : inne).push(wpis);
  }
  const sortuj = (a: Wpis, b: Wpis) => a.nazwa.localeCompare(b.nazwa, "pl");
  grupy.forEach((g) => g.items.sort(sortuj));
  inne.sort(sortuj);

  const Grupa = ({ color, label, items }: { color?: string; label: string; items: Wpis[] }) =>
    items.length === 0 ? null : (
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 }}>
          {color && (
            <View
              style={{
                width: 12, height: 12, borderRadius: 3,
                backgroundColor: barwa(color),
                borderWidth: 1, borderColor: theme.border,
              }}
            />
          )}
          <Text style={{ fontSize: 12, fontWeight: "800", color: theme.text, flex: 1 }}>
            {label} ({items.length})
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 19 }}>
          {items
            .map((i) => (i.since ? `${i.nazwa} (od ${i.since})` : i.nazwa))
            .join(" · ")}
        </Text>
      </View>
    );

  return (
    <View>
      {grupy.map((g, i) => (
        <Grupa key={i} color={g.color} label={g.label} items={g.items} />
      ))}
      <Grupa label="Pozostałe państwa" items={inne} />
    </View>
  );
}

function GovDiagramMaterial({ mat, theme, isDark }: MaterialProps) {
  const gd = mat.govDiagramData || {};
  const nodes: any[] = Array.isArray(gd.nodes) ? gd.nodes : [];
  const edges: any[] = Array.isArray(gd.edges) ? gd.edges : [];
  if (nodes.length === 0) return null;

  const etykieta = (id: string) =>
    nodes.find((n) => n.id === id)?.label || id;

  // Grupowanie po `type` odwzorowuje piony władzy z wersji webowej; przy
  // braku typów lecimy jedną listą, zamiast zgadywać układ.
  const NAZWY_PIONOW: Record<string, string> = {
    people: "Naród",
    legislative: "Władza ustawodawcza",
    head_of_state: "Głowa państwa",
    executive: "Władza wykonawcza",
    judicial: "Władza sądownicza",
    supervisory: "Organy nadzoru",
    control: "Organy kontroli",
    local: "Samorząd",
    default: "Pozostałe organy",
  };
  const kolejnosc = [
    "people", "legislative", "head_of_state", "executive",
    "judicial", "supervisory", "control", "local", "default",
  ];
  const wgTypu: Record<string, any[]> = {};
  for (const n of nodes) {
    const t = n.type || "default";
    (wgTypu[t] ||= []).push(n);
  }
  const maTypy = nodes.some((n) => n.type);

  return (
    <View>
      {/* Organy */}
      {maTypy ? (
        kolejnosc
          .filter((t) => wgTypu[t]?.length)
          .map((t) => (
            <View key={t} style={{ marginBottom: 10 }}>
              <Text
                style={{
                  fontSize: 11, fontWeight: "800",
                  color: theme.textTertiary, marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                {NAZWY_PIONOW[t] || t}
              </Text>
              <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
                {wgTypu[t].map((n) => n.label).join(" · ")}
              </Text>
            </View>
          ))
      ) : (
        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 10 }}>
          {nodes.map((n) => n.label).join(" · ")}
        </Text>
      )}

      {/* Relacje — to z nich wynikają odpowiedzi na polecenia typu
          „kto kogo powołuje" */}
      {edges.length > 0 && (
        <View
          style={{
            marginTop: 6,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <Text
            style={{
              fontSize: 11, fontWeight: "800",
              color: theme.textTertiary, marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Zależności
          </Text>
          {edges.map((e, i) => (
            <Text
              key={i}
              style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 20 }}
            >
              <Text style={{ fontWeight: "700", color: theme.text }}>
                {etykieta(e.from)}
              </Text>
              {" → "}
              <Text style={{ fontWeight: "700", color: theme.text }}>
                {etykieta(e.to)}
              </Text>
              {e.label ? `  ·  ${e.label}` : ""}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Mapa Polski (polandMapData) — legenda + lista województw ──────────────

function MapPolandMaterial({ mat, theme, isDark }: MaterialProps) {
  const md = mat.polandMapData || {};
  const legend: any[] = Array.isArray(md.legend) ? md.legend : [];
  const voi: Record<string, any> = md.voivodeships || {};
  const voiEntries = Object.entries(voi).sort(([, a]: any, [, b]: any) =>
    (b?.value || 0) - (a?.value || 0),
  );

  // Pretty voivodeship name
  const niceName = (slug: string) =>
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("-");

  return (
    <View>
      {md.category && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: theme.textSecondary,
            marginBottom: 6,
          }}
        >
          {md.category}
        </Text>
      )}

      {/* Legenda */}
      {legend.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {legend.map((l: any, i: number) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: theme.inputBg,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  backgroundColor: l.color,
                }}
              />
              <Text style={{ fontSize: 10, color: theme.text }}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Lista województw (kolor + nazwa + wartość) */}
      <View style={{ gap: 4 }}>
        {voiEntries.map(([slug, v]: any) => (
          <View
            key={slug}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 8,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: theme.inputBg,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                backgroundColor: v.color || theme.border,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: theme.text,
                flex: 1,
              }}
            >
              {niceName(slug)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                color: theme.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {v.label || v.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Klimatogram (geografia) — bar opady + line temperatura, 2 osie Y ─────

function KlimatogramMaterial({ mat, theme, isDark }: MaterialProps) {
  const kd = mat.klimatogramData || {};
  const months: any[] = Array.isArray(kd.months) ? kd.months : [];
  if (months.length === 0)
    return (
      <Text style={{ fontSize: 12, color: theme.textSecondary }}>
        Brak danych klimatogramu.
      </Text>
    );

  const width = Math.min(Dimensions.get("window").width - 64, 480);
  const height = 260;
  const padL = 38;
  const padR = 38;
  const padT = 16;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const temps = months.map((m: any) => Number(m.temp) || 0);
  const precs = months.map((m: any) => Number(m.precip) || 0);

  // Temperature Y range (lewa oś, symetryczna z zerem widocznym jeśli ujemne)
  const tMin = Math.min(...temps, 0);
  const tMax = Math.max(...temps, 30);
  const tRange = tMax - tMin || 1;
  const tLow = tMin - tRange * 0.05;
  const tHigh = tMax + tRange * 0.05;
  // Precip Y range (prawa oś, zawsze od 0)
  const pMax = Math.max(...precs, 50);
  const pHigh = pMax * 1.15;

  const xToPx = (i: number) =>
    padL + (i + 0.5) * (plotW / months.length);
  const tToPx = (t: number) =>
    padT + plotH - ((t - tLow) / (tHigh - tLow)) * plotH;
  const pToPx = (p: number) =>
    padT + plotH - (p / pHigh) * plotH;

  const axisColor = isDark ? "#475569" : "#cbd5e1";
  const gridColor = isDark ? "#1e293b" : "#f1f5f9";
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const tempColor = "#dc2626";
  const precColor = "#2563eb";

  // Ticks na osiach
  const tTicks: number[] = [];
  for (let i = 0; i <= 4; i++) tTicks.push(tLow + ((tHigh - tLow) * i) / 4);
  const pTicks: number[] = [];
  for (let i = 0; i <= 4; i++) pTicks.push((pHigh * i) / 4);

  const barW = (plotW / months.length) * 0.55;

  return (
    <View>
      <ScrollView horizontal>
        <Svg width={width} height={height}>
          {/* Grid */}
          {tTicks.map((tv, i) => {
            const y = tToPx(tv);
            return (
              <Line
                key={`gr${i}`}
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
              />
            );
          })}
          {/* Bars (opady) */}
          {precs.map((p, i) => {
            const yPx = pToPx(p);
            return (
              <Rect
                key={`b${i}`}
                x={xToPx(i) - barW / 2}
                y={yPx}
                width={barW}
                height={padT + plotH - yPx}
                fill={precColor}
                opacity={0.55}
                rx={2}
              />
            );
          })}
          {/* Line (temperatura) */}
          <Polyline
            points={temps
              .map((t, i) => `${xToPx(i)},${tToPx(t)}`)
              .join(" ")}
            fill="none"
            stroke={tempColor}
            strokeWidth={2.5}
          />
          {temps.map((t, i) => (
            <Circle
              key={`pt${i}`}
              cx={xToPx(i)}
              cy={tToPx(t)}
              r={3}
              fill={tempColor}
            />
          ))}
          {/* Axes */}
          <Line
            x1={padL}
            x2={padL}
            y1={padT}
            y2={padT + plotH}
            stroke={axisColor}
            strokeWidth={1.5}
          />
          <Line
            x1={width - padR}
            x2={width - padR}
            y1={padT}
            y2={padT + plotH}
            stroke={axisColor}
            strokeWidth={1.5}
          />
          <Line
            x1={padL}
            x2={width - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={axisColor}
            strokeWidth={1.5}
          />
          {/* Y-left ticks (temperatura) */}
          {tTicks.map((tv, i) => (
            <SvgText
              key={`tl${i}`}
              x={padL - 5}
              y={tToPx(tv) + 4}
              fontSize={9}
              fill={tempColor}
              textAnchor="end"
            >
              {Math.round(tv)}
            </SvgText>
          ))}
          {/* Y-right ticks (opady) */}
          {pTicks.map((pv, i) => (
            <SvgText
              key={`tr${i}`}
              x={width - padR + 5}
              y={pToPx(pv) + 4}
              fontSize={9}
              fill={precColor}
              textAnchor="start"
            >
              {Math.round(pv)}
            </SvgText>
          ))}
          {/* X labels (miesiące) */}
          {months.map((m: any, i: number) => (
            <SvgText
              key={`xl${i}`}
              x={xToPx(i)}
              y={padT + plotH + 14}
              fontSize={9}
              fill={textColor}
              textAnchor="middle"
            >
              {m.month}
            </SvgText>
          ))}
        </Svg>
      </ScrollView>

      {/* Legenda */}
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          marginTop: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 14,
              height: 3,
              backgroundColor: tempColor,
              borderRadius: 1,
            }}
          />
          <Text style={{ fontSize: 10, color: textColor }}>
            Temperatura (°C, lewa oś)
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 8,
              backgroundColor: precColor,
              opacity: 0.55,
              borderRadius: 1,
            }}
          />
          <Text style={{ fontSize: 10, color: textColor }}>
            Opady (mm, prawa oś)
          </Text>
        </View>
      </View>

      {/* Statystyki stacji */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 8,
        }}
      >
        {kd.stationName && (
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.text }}>
            📍 {kd.stationName}
          </Text>
        )}
        {kd.elevation != null && (
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
            wys. {kd.elevation} m n.p.m.
          </Text>
        )}
        {kd.lat && (
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
            {kd.lat}
          </Text>
        )}
        {kd.yearTemp != null && (
          <Text style={{ fontSize: 11, color: tempColor, fontWeight: "700" }}>
            Tśr {kd.yearTemp}°C
          </Text>
        )}
        {kd.yearPrecip != null && (
          <Text style={{ fontSize: 11, color: precColor, fontWeight: "700" }}>
            Σ opadów {kd.yearPrecip} mm
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Cross-section / SVG diagram (geografia: przekroje geologiczne) ────────

function SvgMaterial({ mat, theme }: { mat: any; theme: any }) {
  const svg = mat.svg || mat.svgContent || "";
  if (!svg) return null;
  return <SvgViewer svg={svg} theme={theme} />;
}

// ── Map embed (geografia: Geoportal → WebView) ────────────────────────────

function MapEmbedMaterial({ mat, theme, isDark }: MaterialProps) {
  const url = mat.mapEmbed || mat.url || "";
  if (!url) return null;

  // Geoportal blokuje iframe → fallback przez OpenStreetMap
  // Parsuj URL Geoportal: pos=lon,lat,zoom
  let embedUrl = url;
  if (url.includes("geoportal.gov.pl")) {
    const m = url.match(/pos=([-\d.]+),([-\d.]+),(\d+)/);
    if (m) {
      const lon = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      const z = Math.min(18, Math.max(2, parseInt(m[3], 10) || 10));
      // OSM bbox dookoła punktu (~0.05° dla z=12)
      const span = 1 / Math.pow(2, z - 8);
      const bbox = [lon - span, lat - span * 0.6, lon + span, lat + span * 0.6];
      embedUrl =
        `https://www.openstreetmap.org/export/embed.html?` +
        `bbox=${bbox.join(",")}&layer=mapnik&marker=${lat},${lon}`;
    }
  }

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style></head><body><iframe src="${embedUrl}" allow="geolocation"></iframe></body></html>`;

  return (
    <View
      style={{
        height: 280,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}

// ── Image (np. historia obraz źródłowy) ───────────────────────────────────

function ImageMaterial({ mat, theme, isDark }: MaterialProps) {
  const url = mat.url || mat.imageUrl || mat.src;
  if (!url) return null;
  return (
    <View>
      <Image
        source={{ uri: url }}
        style={{ width: "100%", height: 260, borderRadius: 10 }}
        resizeMode="contain"
      />
      {/* Metadata obrazka (historia: autor/licencja/źródło) */}
      {(mat.imageAuthor || mat.imageLicense || mat.imageSource) && (
        <Text
          style={{
            fontSize: 10,
            color: theme.textTertiary,
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          {mat.imageAuthor ? mat.imageAuthor : ""}
          {mat.imageAuthor && (mat.imageLicense || mat.imageSource) ? " · " : ""}
          {mat.imageLicense ? mat.imageLicense : ""}
          {mat.imageLicense && mat.imageSource ? " · " : ""}
          {mat.imageSource ? mat.imageSource : ""}
        </Text>
      )}
      {mat.description && (
        <Text
          style={{
            fontSize: 11,
            color: theme.textSecondary,
            marginTop: 6,
          }}
        >
          {mat.description}
        </Text>
      )}
    </View>
  );
}

// ── Genealogy — proste drzewo (lista członków pogrupowana po generacjach) ─

function GenealogyMaterial({ mat, theme, isDark }: MaterialProps) {
  const data = mat.genealogyData || {};
  const members: any[] = Array.isArray(data.members) ? data.members : [];
  if (members.length === 0) return null;

  // Pogrupuj po generacjach (root, dzieci, wnuki…)
  const byId = new Map<string, any>(members.map((m) => [m.id, m]));
  const depth = (m: any): number => {
    let d = 0;
    let cur = m;
    while (cur?.parentId && byId.has(cur.parentId) && d < 10) {
      cur = byId.get(cur.parentId);
      d++;
    }
    return d;
  };
  const generations: Record<number, any[]> = {};
  members.forEach((m) => {
    const d = depth(m);
    (generations[d] = generations[d] || []).push(m);
  });

  return (
    <View style={{ gap: 8 }}>
      {Object.keys(generations)
        .map((k) => Number(k))
        .sort((a, b) => a - b)
        .map((d) => (
          <View key={d}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: theme.textTertiary,
                marginBottom: 4,
                letterSpacing: 0.5,
              }}
            >
              POKOLENIE {d + 1}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {generations[d].map((m: any) => (
                <View
                  key={m.id}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: theme.inputBg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    minWidth: 110,
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: "700", color: theme.text }}
                  >
                    {m.name}
                  </Text>
                  {m.title && (
                    <Text
                      style={{ fontSize: 10, color: theme.textSecondary }}
                    >
                      {m.title}
                    </Text>
                  )}
                  {(m.birthYear || m.deathYear) && (
                    <Text
                      style={{
                        fontSize: 10,
                        color: theme.textTertiary,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {m.birthYear || "?"}–{m.deathYear || "?"}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
    </View>
  );
}

// ── Data file (informatyka: plik z danymi — CSV/TSV/TXT) ─────────────────

function DataFileMaterial({ mat, theme, isDark }: MaterialProps) {
  const fileContent = mat.fileContent || mat.content || "";
  const fileName = mat.fileName || mat.name || "data.txt";
  // Liczba linii do orientacji
  const lineCount = fileContent ? fileContent.split("\n").length : 0;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "800",
            color: colors.brand[600],
            fontFamily: "monospace",
          }}
        >
          📄 {fileName}
        </Text>
        {lineCount > 0 && (
          <Text
            style={{
              fontSize: 10,
              color: theme.textTertiary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {lineCount} linii
          </Text>
        )}
      </View>
      {mat.description && (
        <Text
          style={{
            fontSize: 11,
            color: theme.textSecondary,
            marginBottom: 6,
          }}
        >
          {mat.description}
        </Text>
      )}
      <View
        style={{
          backgroundColor: isDark ? "#0f172a" : "#1e293b",
          borderRadius: 10,
          padding: 10,
          maxHeight: 260,
        }}
      >
        <ScrollView>
          <ScrollView horizontal>
            <Text
              style={{
                fontSize: 11,
                color: "#e2e8f0",
                fontFamily: "monospace",
                lineHeight: 16,
              }}
            >
              {fileContent}
            </Text>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

// ── Text source (historia: tekst źródłowy z autorem/rokiem) ───────────────

function TextSourceMaterial({ mat, theme, isDark }: MaterialProps) {
  return (
    <View>
      {/* Metadata: autor + rok */}
      {(mat.author || mat.year) && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: theme.textSecondary,
            marginBottom: 6,
          }}
        >
          {mat.author || ""}
          {mat.author && mat.year ? ", " : ""}
          {mat.year || ""}
        </Text>
      )}
      {mat.content && (
        <Text
          style={{
            fontSize: 13,
            color: theme.text,
            lineHeight: 21,
            fontStyle: mat.type === "document" ? "italic" : "normal",
          }}
        >
          {parseChemText(mat.content)}
        </Text>
      )}
    </View>
  );
}

// ── Main dispatcher ────────────────────────────────────────────────────────

// Typy wizualne (historia) — wszystkie idą do ImageMaterial
const IMAGE_TYPES = new Set([
  "image",
  "photo",
  "painting",
  "historical_map",
  "map", // generic
  "inscription",
  "sculpture",
  "drawing",
  "satirical",
]);

// Typy „dokumentowe" (tekst źródłowy z metadanymi historycznymi)
const TEXT_SOURCE_TYPES = new Set([
  "text_source",
  "document",
  "source",
  "letter",
  "law",
  "treaty",
]);

// Generator bywa, że zawija ładunek materiału w dodatkową warstwę:
//   content: { table: {...} }             zamiast  table: {...},  content: "…"
//   content: { experimentChartData: {…} }  zamiast experimentChartData: {…}
// Bez rozpakowania tabela/wykres w ogóle się nie rysowały, a `parseChemText`
// dostawał obiekt i wywracał ekran. Lustro `normalizeMaterials()` z backendu
// (exam-sanitize.ts) — admin dostaje content NIEsanityzowany, więc guard
// musi być też po stronie klienta.
const LIFTABLE_MATERIAL_KEYS = [
  "table",
  "tableData",
  "experimentChartData",
  "chartData",
  "diagramData",
  "klimatogramData",
  "svg",
  "imageUrl",
  "mapEmbed",
  "schema",
  "fileContent",
];

// Format „szeroki" wykresu ({type, categories, series, data}) → kanoniczny
// ({chartType, datasets}). Mobile go nie wywala (czyta `datasets` defensywnie),
// ale bez konwersji rysowałby PUSTY wykres. Lustro normalizeChart() z backendu.
function normalizeChart(chart: any): void {
  if (!chart || typeof chart !== "object") return;
  if (Array.isArray(chart.datasets)) return;
  if (!Array.isArray(chart.data) || !Array.isArray(chart.series)) return;
  const rows = chart.data.filter((r: any) => r && typeof r === "object");
  chart.datasets = chart.series
    .filter((se: any) => se && typeof se.name === "string")
    .map((se: any) => ({
      name: se.name,
      color: se.color,
      data: rows
        .filter((r: any) => typeof r[se.name] === "number")
        .map((r: any) => ({ x: r.category ?? r.x ?? r.label, y: r[se.name] })),
    }));
  if (chart.chartType === undefined && typeof chart.type === "string") {
    chart.chartType = chart.type === "line" ? "line" : "bar";
  }
}

function normalizeMaterial(mat: any): any {
  if (!mat || typeof mat !== "object") return mat;
  const c = mat.content;
  if (c == null || typeof c === "string") {
    // Materiały wizualne z pipeline'u obrazów (historia: poster/photo/cartoon)
    // niosą `description` + `imageQuery`, a `imageUrl` dostają dopiero z
    // fetchera Wikimediów. Zanim go dostaną — albo gdy legalnego zdjęcia nie
    // ma — mobile renderował PUSTĄ kartę, bo czyta wyłącznie `content`.
    // Web pokazuje w tej sytuacji opis; wyrównujemy zachowanie.
    if (!c || !String(c).trim()) {
      // `description` mówi CZYM jest źródło, `imageHints.fallbackDescription`
      // — JAK wygląda. Zadania typu „zinterpretuj dwa elementy graficzne"
      // potrzebują tego drugiego, więc łączymy oba, gdy nie ma obrazu.
      const parts = [
        typeof mat.description === "string" ? mat.description.trim() : "",
        typeof mat.text === "string" ? mat.text.trim() : "",
        typeof mat.imageHints?.fallbackDescription === "string"
          ? mat.imageHints.fallbackDescription.trim()
          : "",
      ].filter(Boolean);
      const uniq = parts.filter(
        (x, i) => !parts.some((y, j) => j !== i && j < i && y.includes(x)),
      );
      const fallback = uniq.join("\n\n");
      if (fallback) return { ...mat, content: fallback };
    }
    return mat;
  }

  const out = { ...mat };
  if (Array.isArray(c)) {
    out.content = c.every((x: any) => typeof x === "string")
      ? c.join("\n")
      : "";
    return out;
  }
  if (typeof c !== "object") {
    out.content = String(c);
    return out;
  }
  for (const k of LIFTABLE_MATERIAL_KEYS) {
    if (out[k] === undefined && c[k] !== undefined) out[k] = c[k];
  }
  if (out.table === undefined && Array.isArray(c.headers) && Array.isArray(c.rows)) {
    out.table = { headers: c.headers, rows: c.rows };
  }
  out.content =
    typeof c.text === "string" ? c.text : typeof c.content === "string" ? c.content : "";
  return out;
}

const CHART_FIELDS = ["experimentChartData", "chartData", "diagramData"];

export function MaterialRenderer({ mat: rawMat, theme, isDark }: MaterialProps) {
  if (!rawMat) return null;
  const mat = normalizeMaterial(rawMat);
  for (const f of CHART_FIELDS) normalizeChart(mat[f]);
  const type = mat.type || "text";

  // Aliasy chart datasource (różne nazwy w różnych przedmiotach)
  const chartDatasource =
    mat.chartData || mat.experimentChartData || mat.diagramData || null;

  // Detect kind
  const isDataFile =
    type === "data_file" || (!!mat.fileContent && !!(mat.fileName || mat.name));
  const isDbSchema =
    type === "db_schema" || type === "schema" || (!!mat.schema && !!mat.schema.tables);
  const isKlimatogram = type === "klimatogram" || !!mat.klimatogramData;
  // Wszystkie typy które przechowują surowy SVG w mat.svg (geografia
  // przekroje, biologia bio_diagram, chemia chem_diagram, schematy procesów,
  // VSEPR, orbital, ogniwa galwaniczne, profile energetyczne…)
  const isCrossSection =
    type === "cross_section" ||
    type === "svg" ||
    type === "bio_diagram" ||
    type === "chem_diagram" ||
    type === "process_diagram" ||
    type === "phylogenetic_tree" ||
    type === "diagram" ||
    type === "molecule" ||
    type === "reaction_scheme" ||
    type === "orbital" ||
    type === "vsepr" ||
    type === "cell" ||
    type === "energy_diagram" ||
    type === "titration_curve" ||
    (!!mat.svg && !chartDatasource);
  const isMapEmbed = type === "map_embed" || !!mat.mapEmbed;
  const isImage =
    !isDataFile &&
    !isDbSchema &&
    !isKlimatogram &&
    !isCrossSection &&
    !isMapEmbed &&
    (IMAGE_TYPES.has(type) ||
      (!!mat.imageUrl && !chartDatasource && !mat.tableData));
  const isTextSource = TEXT_SOURCE_TYPES.has(type);
  const isChart =
    !isKlimatogram &&
    (type === "chart" || type === "experiment_chart" || !!chartDatasource);
  const isTable =
    type === "table" ||
    (type === "statistics_table" && !!mat.tableData) ||
    // materiały innych typów (np. "text") ze strukturalną tabelą w mat.table
    !!(mat.table && Array.isArray(mat.table.headers));
  const isMapPoland = type === "map_poland" || !!mat.polandMapData;
  const isGenealogy = type === "genealogy" || !!mat.genealogyData;
  const isMapEurope = type === "map_europe" || !!mat.europeMapData;
  const isGovDiagram = type === "gov_diagram" || !!mat.govDiagramData;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 14,
        backgroundColor: isDark ? "#92400e10" : "#fffbeb",
        borderWidth: 1,
        borderColor: isDark ? "#92400e30" : "#fde68a",
        marginBottom: 12,
      }}
    >
      {/* Header */}
      {(mat.author || mat.title) && (
        <View style={{ marginBottom: 8 }}>
          {/* Author dla tekstów/dokumentów pokazujemy w TextSourceMaterial,
              tutaj tylko jeśli to NIE text_source */}
          {mat.author && !isTextSource && (
            <Text
              style={{ fontSize: 10, color: theme.textTertiary, marginBottom: 2 }}
            >
              {mat.author}
            </Text>
          )}
          {mat.title && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "800",
                fontStyle: isTextSource ? "italic" : "normal",
                color: theme.text,
              }}
            >
              {parseChemText(mat.title)}
            </Text>
          )}
        </View>
      )}

      {/* Body */}
      {isDataFile && (
        <DataFileMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isDbSchema && (
        <SqlSchemaView schema={mat.schema} theme={theme} isDark={isDark} />
      )}
      {isKlimatogram && (
        <KlimatogramMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isCrossSection && <SvgMaterial mat={mat} theme={theme} />}
      {isMapEmbed && (
        <MapEmbedMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isChart && <ChartMaterial mat={mat} theme={theme} isDark={isDark} />}
      {isTable && <TableMaterial mat={mat} theme={theme} isDark={isDark} />}
      {isMapPoland && (
        <MapPolandMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isGenealogy && (
        <GenealogyMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isMapEurope && (
        <MapEuropeMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isGovDiagram && (
        <GovDiagramMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {isImage && <ImageMaterial mat={mat} theme={theme} isDark={isDark} />}
      {isTextSource && (
        <TextSourceMaterial mat={mat} theme={theme} isDark={isDark} />
      )}
      {/* Fallback: zwykły tekst */}
      {!isDataFile &&
        !isDbSchema &&
        !isKlimatogram &&
        !isCrossSection &&
        !isMapEmbed &&
        !isChart &&
        !isTable &&
        !isMapPoland &&
        !isGenealogy &&
        !isMapEurope &&
        !isGovDiagram &&
        !isImage &&
        !isTextSource &&
        mat.content && (
          <Text style={{ fontSize: 13, color: theme.text, lineHeight: 21 }}>
            {parseChemText(mat.content)}
          </Text>
        )}

      {/* Optional content text under graficznymi materiałami */}
      {(isDataFile ||
        isDbSchema ||
        isKlimatogram ||
        isCrossSection ||
        isMapEmbed ||
        isChart ||
        isTable ||
        isMapPoland ||
        isGenealogy ||
        isMapEurope ||
        isGovDiagram) &&
        mat.content &&
        // dla data_file content jest opisem nad plikiem — już pokazaliśmy
        !isDataFile && (
          <Text
            style={{
              fontSize: 11,
              color: theme.textSecondary,
              marginTop: 8,
              fontStyle: "italic",
            }}
          >
            {parseChemText(mat.content)}
          </Text>
        )}

      {/* Source */}
      {mat.source && (
        <Text
          style={{
            fontSize: 10,
            color: theme.textTertiary,
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          Źródło: {mat.source}
        </Text>
      )}

      {/* Footnotes */}
      {Array.isArray(mat.footnotes) &&
        mat.footnotes.map((fn: string, i: number) => (
          <Text
            key={i}
            style={{
              fontSize: 10,
              color: theme.textTertiary,
              marginTop: 4,
            }}
          >
            {i + 1}. {fn}
          </Text>
        ))}
    </View>
  );
}
