// ============================================================================
// MathGraph — React Native SVG graph with dark theme + zoom
// ============================================================================

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import Svg, {
  Line as SvgLine,
  Circle as SvgCircle,
  Text as SvgText,
  Polyline,
  Rect,
  G,
  Path,
} from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphSegment {
  from: number;
  to: number;
  fn: string;
  style?: "solid" | "dashed";
  color?: string;
}

interface GraphPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
  open?: boolean;
}

interface GraphLine {
  from: [number, number];
  to: [number, number];
  style?: "solid" | "dashed";
  color?: string;
}

interface GraphCircle {
  center: [number, number];
  radius: number;
  color?: string;
}

interface GraphVector {
  from: [number, number];
  to: [number, number];
  color?: string;
}

interface GraphArea {
  fn: string;
  from: number;
  to: number;
  color?: string;
  opacity?: number;
}

export interface MathGraphProps {
  xRange?: [number, number];
  yRange?: [number, number];
  segments?: GraphSegment[];
  points?: GraphPoint[];
  lines?: GraphLine[];
  circles?: GraphCircle[];
  vectors?: GraphVector[];
  areas?: GraphArea[];
  height?: number;
}

// ── Safe math evaluator ───────────────────────────────────────────────────

function createFn(expr: string): (x: number) => number {
  const prepared = expr
    .replace(/([a-zA-Z0-9\)]+)\^([a-zA-Z0-9\.\(]+)/g, "Math.pow($1,$2)")
    .replace(/sqrt\(/g, "Math.sqrt(")
    .replace(/abs\(/g, "Math.abs(")
    .replace(/sin\(/g, "Math.sin(")
    .replace(/cos\(/g, "Math.cos(")
    .replace(/tan\(/g, "Math.tan(")
    .replace(/log\(/g, "Math.log(")
    .replace(/ln\(/g, "Math.log(")
    .replace(/pi/g, "Math.PI")
    .replace(/e(?![a-zA-Z])/g, "Math.E");
  return new Function(
    "x",
    `"use strict"; try { return ${prepared}; } catch { return NaN; }`,
  ) as (x: number) => number;
}

// ── Plot colors ───────────────────────────────────────────────────────────

const PLOT_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  red: "#ef4444",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  cyan: "#06b6d4",
  pink: "#ec4899",
  navy: "#6366f1",
};

function resolveColor(name?: string): string {
  if (!name) return PLOT_COLORS.blue;
  return PLOT_COLORS[name] || name;
}

// ── Component ─────────────────────────────────────────────────────────────

const PADDING = 32;
const SCREEN_WIDTH = Dimensions.get("window").width;

export function MathGraph({
  xRange = [-1, 6],
  yRange = [-1, 5],
  segments = [],
  points = [],
  lines = [],
  circles = [],
  vectors = [],
  areas = [],
  height = 300,
}: MathGraphProps) {
  const { isDark } = useTheme();
  const [zoomed, setZoomed] = useState(false);

  const baseW = SCREEN_WIDTH - 40;
  const svgW = zoomed ? baseW * 2 : baseW;
  const svgH = zoomed ? height * 2 : height;
  const plotW = svgW - PADDING * 2;
  const plotH = svgH - PADDING * 2;
  const [xMin, xMax] = xRange;
  const [yMin, yMax] = yRange;
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;

  const bg = isDark ? "#0f0f23" : "#ffffff";
  const grid = isDark ? "#2a2a3d" : "#e4e4e7";
  const axis = isDark ? "#a1a1aa" : "#71717a";
  const lbl = isDark ? "#71717a" : "#a1a1aa";

  const toX = (x: number) => PADDING + ((x - xMin) / xSpan) * plotW;
  const toY = (y: number) => PADDING + ((yMax - y) / ySpan) * plotH;
  const fs = zoomed ? 12 : 9;

  // ── Grid ────────────────────────────────────────────────────────────
  const gridEl: React.ReactNode[] = [];
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
    const isA = x === 0;
    gridEl.push(
      <SvgLine
        key={`gx${x}`}
        x1={toX(x)}
        y1={toY(yMin)}
        x2={toX(x)}
        y2={toY(yMax)}
        stroke={isA ? axis : grid}
        strokeWidth={isA ? 1.5 : 0.5}
      />,
    );
    if (x !== 0)
      gridEl.push(
        <SvgText
          key={`lx${x}`}
          x={toX(x)}
          y={toY(0) + fs + 3}
          fontSize={fs}
          fill={lbl}
          textAnchor="middle"
        >
          {x}
        </SvgText>,
      );
  }
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
    const isA = y === 0;
    gridEl.push(
      <SvgLine
        key={`gy${y}`}
        x1={toX(xMin)}
        y1={toY(y)}
        x2={toX(xMax)}
        y2={toY(y)}
        stroke={isA ? axis : grid}
        strokeWidth={isA ? 1.5 : 0.5}
      />,
    );
    if (y !== 0)
      gridEl.push(
        <SvgText
          key={`ly${y}`}
          x={toX(0) - 8}
          y={toY(y) + 3}
          fontSize={fs}
          fill={lbl}
          textAnchor="end"
        >
          {y}
        </SvgText>,
      );
  }
  gridEl.push(
    <SvgText
      key="o"
      x={toX(0) - 8}
      y={toY(0) + fs + 3}
      fontSize={fs}
      fill={lbl}
      textAnchor="end"
    >
      0
    </SvgText>,
  );

  // ── Areas ───────────────────────────────────────────────────────────
  const areaEl = areas.map((a, i) => {
    const fn = createFn(a.fn);
    const step = (a.to - a.from) / 150;
    let d = `M ${toX(a.from).toFixed(1)} ${toY(0).toFixed(1)}`;
    for (let x = a.from; x <= a.to; x += step) {
      const y = fn(x);
      if (isFinite(y)) d += ` L ${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`;
    }
    d += ` L ${toX(a.to).toFixed(1)} ${toY(0).toFixed(1)} Z`;
    return (
      <Path
        key={`a${i}`}
        d={d}
        fill={resolveColor(a.color)}
        fillOpacity={a.opacity ?? 0.15}
        stroke="none"
      />
    );
  });

  // ── Segments ────────────────────────────────────────────────────────
  const segEl = segments.map((s, i) => {
    const fn = createFn(s.fn);
    const n = zoomed ? 400 : 200;
    const step = (s.to - s.from) / n;
    const pts: string[] = [];
    for (let x = s.from; x <= s.to; x += step) {
      const y = fn(x);
      if (isFinite(y) && y >= yMin - 5 && y <= yMax + 5)
        pts.push(`${toX(x).toFixed(1)},${toY(y).toFixed(1)}`);
    }
    return (
      <Polyline
        key={`s${i}`}
        points={pts.join(" ")}
        fill="none"
        stroke={resolveColor(s.color)}
        strokeWidth={zoomed ? 3 : 2.5}
        strokeDasharray={s.style === "dashed" ? "8,5" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });

  // ── Lines ───────────────────────────────────────────────────────────
  const lineEl = lines.map((l, i) => (
    <SvgLine
      key={`l${i}`}
      x1={toX(l.from[0])}
      y1={toY(l.from[1])}
      x2={toX(l.to[0])}
      y2={toY(l.to[1])}
      stroke={resolveColor(l.color)}
      strokeWidth={1.5}
      strokeDasharray={l.style === "dashed" ? "6,4" : undefined}
    />
  ));

  // ── Circles ─────────────────────────────────────────────────────────
  const circEl = circles.map((c, i) => {
    const rx = (c.radius / xSpan) * plotW;
    const ry = (c.radius / ySpan) * plotH;
    return (
      <SvgCircle
        key={`c${i}`}
        cx={toX(c.center[0])}
        cy={toY(c.center[1])}
        r={(rx + ry) / 2}
        fill="none"
        stroke={resolveColor(c.color)}
        strokeWidth={2}
      />
    );
  });

  // ── Vectors ─────────────────────────────────────────────────────────
  const vecEl = vectors.map((v, i) => {
    const x1 = toX(v.from[0]),
      y1 = toY(v.from[1]),
      x2 = toX(v.to[0]),
      y2 = toY(v.to[1]);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const al = 10;
    const col = resolveColor(v.color);
    return (
      <G key={`v${i}`}>
        <SvgLine
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={col}
          strokeWidth={2.5}
        />
        <Path
          d={`M ${x2 - al * Math.cos(ang - 0.4)} ${y2 - al * Math.sin(ang - 0.4)} L ${x2} ${y2} L ${x2 - al * Math.cos(ang + 0.4)} ${y2 - al * Math.sin(ang + 0.4)}`}
          fill="none"
          stroke={col}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    );
  });

  // ── Points ──────────────────────────────────────────────────────────
  const ptEl = points.map((pt, i) => {
    const r = zoomed ? 6 : 4.5;
    const col = resolveColor(pt.color);
    return (
      <G key={`p${i}`}>
        <SvgCircle
          cx={toX(pt.x)}
          cy={toY(pt.y)}
          r={r + 2}
          fill={bg}
          fillOpacity={0.8}
        />
        <SvgCircle
          cx={toX(pt.x)}
          cy={toY(pt.y)}
          r={r}
          fill={pt.open ? bg : col}
          stroke={col}
          strokeWidth={pt.open ? 2.5 : 1}
        />
        {pt.label && (
          <>
            <Rect
              x={toX(pt.x) + 6}
              y={toY(pt.y) - (zoomed ? 18 : 14)}
              width={pt.label.length * (zoomed ? 7.5 : 6) + 8}
              height={zoomed ? 20 : 16}
              rx={4}
              fill={bg}
              fillOpacity={0.85}
            />
            <SvgText
              x={toX(pt.x) + 10}
              y={toY(pt.y) - (zoomed ? 3 : 2)}
              fontSize={zoomed ? 13 : 10}
              fill={col}
              fontWeight="600"
            >
              {pt.label}
            </SvgText>
          </>
        )}
      </G>
    );
  });

  const svg = (
    <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <Rect x={0} y={0} width={svgW} height={svgH} fill={bg} />
      {gridEl}
      {areaEl}
      {segEl}
      {lineEl}
      {circEl}
      {vecEl}
      {ptEl}
    </Svg>
  );

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? "#27272a" : "#e4e4e7",
        backgroundColor: bg,
      }}
    >
      {/* Toolbar */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <TouchableOpacity
          onPress={() => setZoomed(!zoomed)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            backgroundColor: zoomed
              ? isDark
                ? "rgba(99,102,241,0.2)"
                : "rgba(99,102,241,0.1)"
              : isDark
                ? "#27272a"
                : "#f4f4f5",
          }}
        >
          <Text style={{ fontSize: 12 }}>{zoomed ? "🔍" : "🔎"}</Text>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              color: zoomed ? "#6366f1" : isDark ? "#a1a1aa" : "#71717a",
            }}
          >
            {zoomed ? "Zmniejsz" : "Powiększ"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Graph */}
      {zoomed ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: height * 2 + 10 }}
          >
            {svg}
          </ScrollView>
        </ScrollView>
      ) : (
        <View style={{ alignItems: "center", paddingBottom: 4 }}>{svg}</View>
      )}
    </View>
  );
}
