// =============================================================================
// svgVectorArrows.ts — "F⃗", "g⃗" (litera + U+20D7) w <text> diagramów SVG
// rysowane jako litera + podniesiona strzałka „→”, bo fonty UI nie mają glifu
// łączącej strzałki (puste kwadraty). Kopia logiki z webu.
// =============================================================================

// ----------------------------------------------------------------------------
// Vector notation inside <text>: "F⃗", "g⃗", "B⃗₁" (letter + U+20D7 COMBINING
// RIGHT ARROW ABOVE, or U+20D1 harpoon). Diagram fonts (system-ui → Segoe UI,
// Roboto, Arial) have no glyph for the combining mark — Chrome on Windows
// draws an empty box after the letter, and fonts that do have it (Cambria
// Math, Segoe UI Symbol) place it off-centre. So the combining mark is
// replaced by a plain "→" (present in every UI font) in a raised tspan that
// is stretched to the letter's width with textLength and shifted back over
// the letter with dx; the following text gets the baseline back with dy.
// The net advance equals the letter's width, so text-anchor="middle" and the
// rest of the label stay where the author put them. Letter widths are
// estimates (sans-serif metrics) — accurate enough for an arrow over a symbol.
// Same code: matury-online.pl frontend/src/lib/svg-sanitize.ts (web).
// ----------------------------------------------------------------------------

const VEC_MARK = /[\u20D7\u20D1]/;
const VEC_RE = /([^\s<>])[\u20D7\u20D1]/g;

function glyphWidth(ch: string): number {
  if ("iljI|!.,:;'".includes(ch)) return 0.28;
  if ("ftrJ".includes(ch)) return 0.36;
  if ("mMW".includes(ch)) return 0.84;
  if ("wωΩ".includes(ch)) return 0.74;
  if ("sczx".includes(ch)) return 0.46;
  if ("EFLTPSZ".includes(ch)) return 0.57;
  if (/[A-ZĄĆĘŁŃÓŚŹŻΑ-Ω]/.test(ch)) return 0.68;
  if (/[0-9]/.test(ch)) return 0.55;
  return 0.54; // lowercase latin / greek
}

// Letters whose top reaches cap height (arrow sits higher) vs. x-height.
function isTall(ch: string): boolean {
  return /[A-ZĄĆĘŁŃÓŚŹŻ0-9bdfhklłtΑ-Ωβδζθλξ]/.test(ch);
}

function num(x: number): string {
  return String(Math.round(x * 100) / 100);
}

function textFontSize(attrs: string): number {
  const m =
    attrs.match(/font-size\s*=\s*["']?\s*([\d.]+)/) ||
    attrs.match(/font-size\s*:\s*([\d.]+)/);
  const v = m ? parseFloat(m[1]) : NaN;
  return v > 0 ? v : 16;
}

export function drawVectorArrows(svg: string): string {
  if (!VEC_MARK.test(svg)) return svg;
  return svg.replace(
    /<text\b([^>]*)>([\s\S]*?)<\/text>/g,
    (full, attrs: string, inner: string) => {
      if (!VEC_MARK.test(inner)) return full;
      const fs = textFontSize(attrs);
      const bold = /font-weight\s*[=:]\s*["']?\s*(bold|[6-9]00)/.test(attrs);
      const parts = inner.split(/(<[^>]*>)/);
      for (let p = 0; p < parts.length; p++) {
        const seg = parts[p];
        if (!seg || seg.startsWith("<") || !VEC_MARK.test(seg)) continue;
        const moreAfter = parts.slice(p + 1).some((x) => x && !x.startsWith("<") && x.trim());
        let out = "";
        let last = 0;
        let pendingDy = 0;
        let pendingDx = 0;
        VEC_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = VEC_RE.exec(seg))) {
          const between = seg.slice(last, m.index);
          out += pendingDy ? `<tspan dx="${num(pendingDx)}" dy="${num(pendingDy)}">${between}${m[1]}</tspan>` : between + m[1];
          const w = fs * glyphWidth(m[1]) * (bold ? 1.06 : 1);
          const aw = Math.max(w, fs * 0.5);
          const af = fs * 0.72;
          const raise = fs * (isTall(m[1]) ? 0.72 : 0.48);
          out +=
            `<tspan font-size="${num(af)}" font-weight="normal" dx="${num(-(w + aw) / 2)}" dy="${num(-raise)}"` +
            ` textLength="${num(aw)}" lengthAdjust="spacingAndGlyphs">\u2192</tspan>`;
          pendingDx = (w - aw) / 2;
          pendingDy = raise;
          last = m.index + m[0].length;
        }
        const rest = seg.slice(last);
        if (rest) out += `<tspan dx="${num(pendingDx)}" dy="${num(pendingDy)}">${rest}</tspan>`;
        else if (moreAfter) out += `<tspan dx="${num(pendingDx)}" dy="${num(pendingDy)}">\u200B</tspan>`;
        parts[p] = out;
      }
      return `<text${attrs}>${parts.join("")}</text>`;
    },
  );
}
