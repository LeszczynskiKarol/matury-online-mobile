// ============================================================================
// chemText.ts — Converts LaTeX/mhchem notation to readable Unicode
//
// Handles both chemistry (\ce{}) and math ($...$) notation for
// React Native where we can't render LaTeX natively.
// ============================================================================

const SUBSCRIPT: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

const SUPERSCRIPT: Record<string, string> = {
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "2+": "²⁺",
  "3+": "³⁺",
  "2-": "²⁻",
  "3-": "³⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  a: "ᵃ",
  b: "ᵇ",
  c: "ᶜ",
  d: "ᵈ",
  e: "ᵉ",
  f: "ᶠ",
  g: "ᵍ",
  h: "ʰ",
  i: "ⁱ",
  j: "ʲ",
  k: "ᵏ",
  l: "ˡ",
  m: "ᵐ",
  n: "ⁿ",
  o: "ᵒ",
  p: "ᵖ",
  r: "ʳ",
  s: "ˢ",
  t: "ᵗ",
  u: "ᵘ",
  v: "ᵛ",
  w: "ʷ",
  x: "ˣ",
  y: "ʸ",
  z: "ᶻ",
};

// ── Math symbol replacements (used inside $...$ blocks) ──────────────────

const MATH_SYMBOLS: [RegExp, string][] = [
  // Functions (trailing space prevents merging with argument: \sin a → sin a)
  [/\\log_(\d)/g, ((_: string, b: string) => `log${SUBSCRIPT[b] || b}`) as any],
  [/\\log\b/g, "log "],
  [/\\ln\b/g, "ln "],
  [/\\sin\b/g, "sin "],
  [/\\cos\b/g, "cos "],
  [/\\tan\b/g, "tan "],
  [/\\cot\b/g, "cot "],
  [/\\arcsin\b/g, "arcsin "],
  [/\\arccos\b/g, "arccos "],
  [/\\arctan\b/g, "arctan "],
  [/\\lim\b/g, "lim "],
  [/\\max\b/g, "max "],
  [/\\min\b/g, "min "],

  // Operators
  [/\\cdot/g, "·"],
  [/\\times/g, "×"],
  [/\\div/g, "÷"],
  [/\\pm/g, "±"],
  [/\\mp/g, "∓"],

  // Relations
  [/\\approx/g, "≈"],
  [/\\neq/g, "≠"],
  [/\\ne/g, "≠"],
  [/\\leq/g, "≤"],
  [/\\le/g, "≤"],
  [/\\geq/g, "≥"],
  [/\\ge/g, "≥"],
  [/\\ll/g, "≪"],
  [/\\gg/g, "≫"],
  [/\\equiv/g, "≡"],
  [/\\sim/g, "∼"],
  [/\\propto/g, "∝"],

  // Arrows
  [/\\Rightarrow/g, "⇒"],
  [/\\Leftarrow/g, "⇐"],
  [/\\Leftrightarrow/g, "⇔"],
  [/\\rightarrow/g, "→"],
  [/\\leftarrow/g, "←"],
  [/\\leftrightarrow/g, "↔"],
  [/\\to/g, "→"],
  [/\\implies/g, "⇒"],
  [/\\iff/g, "⇔"],

  // Set theory & logic
  [/\\in/g, "∈"],
  [/\\notin/g, "∉"],
  [/\\subset/g, "⊂"],
  [/\\subseteq/g, "⊆"],
  [/\\supset/g, "⊃"],
  [/\\supseteq/g, "⊇"],
  [/\\cup/g, "∪"],
  [/\\cap/g, "∩"],
  [/\\emptyset/g, "∅"],
  [/\\setminus/g, "∖"],
  [/\\forall/g, "∀"],
  [/\\exists/g, "∃"],
  [/\\neg/g, "¬"],
  [/\\land/g, "∧"],
  [/\\lor/g, "∨"],

  // Special sets
  [/\\mathbb\{R\}/g, "ℝ"],
  [/\\mathbb\{N\}/g, "ℕ"],
  [/\\mathbb\{Z\}/g, "ℤ"],
  [/\\mathbb\{Q\}/g, "ℚ"],
  [/\\mathbb\{C\}/g, "ℂ"],

  // Greek letters
  [/\\alpha/g, "α"],
  [/\\beta/g, "β"],
  [/\\gamma/g, "γ"],
  [/\\delta/g, "δ"],
  [/\\epsilon/g, "ε"],
  [/\\varepsilon/g, "ε"],
  [/\\zeta/g, "ζ"],
  [/\\eta/g, "η"],
  [/\\theta/g, "θ"],
  [/\\vartheta/g, "ϑ"],
  [/\\iota/g, "ι"],
  [/\\kappa/g, "κ"],
  [/\\lambda/g, "λ"],
  [/\\mu/g, "μ"],
  [/\\nu/g, "ν"],
  [/\\xi/g, "ξ"],
  [/\\pi/g, "π"],
  [/\\rho/g, "ρ"],
  [/\\sigma/g, "σ"],
  [/\\tau/g, "τ"],
  [/\\upsilon/g, "υ"],
  [/\\phi/g, "φ"],
  [/\\varphi/g, "φ"],
  [/\\chi/g, "χ"],
  [/\\psi/g, "ψ"],
  [/\\omega/g, "ω"],
  [/\\Delta/g, "Δ"],
  [/\\Gamma/g, "Γ"],
  [/\\Lambda/g, "Λ"],
  [/\\Sigma/g, "Σ"],
  [/\\Phi/g, "Φ"],
  [/\\Psi/g, "Ψ"],
  [/\\Omega/g, "Ω"],
  [/\\Pi/g, "Π"],
  [/\\Theta/g, "Θ"],

  // Misc
  [/\\infty/g, "∞"],
  [/\\partial/g, "∂"],
  [/\\nabla/g, "∇"],
  [/\\angle/g, "∠"],
  [/\\perp/g, "⊥"],
  [/\\parallel/g, "∥"],
  [/\\triangle/g, "△"],
  [/\\circ/g, "°"],
  [/\\degree/g, "°"],
  [/\\%/g, "%"],

  // Spacing & delimiters
  [/\\quad/g, "  "],
  [/\\qquad/g, "    "],
  [/\\,/g, " "],
  [/\\;/g, " "],
  [/\\!/g, ""],
  [/\\left\s*/g, ""],
  [/\\right\s*/g, ""],
  [/\\big\s*/g, ""],
  [/\\Big\s*/g, ""],
  [/\\bigg\s*/g, ""],
  [/\\Bigg\s*/g, ""],
  [/\\lfloor/g, "⌊"],
  [/\\rfloor/g, "⌋"],
  [/\\lceil/g, "⌈"],
  [/\\rceil/g, "⌉"],
  [/\\langle/g, "⟨"],
  [/\\rangle/g, "⟩"],
  [/\\{/g, "{"],
  [/\\}/g, "}"],
];

// ── Main parser ─────────────────────────────────────────────────────────

export function parseChemText(text: string): string {
  if (!text) return "";

  let result = text;

  // ── Step 1: Handle \ce{...} chemistry blocks ──
  result = result.replace(/\$\\ce\{([^}]+)\}\$/g, (_, inner) =>
    parseCeBlock(inner),
  );
  result = result.replace(/\\ce\{([^}]+)\}/g, (_, inner) =>
    parseCeBlock(inner),
  );

  // ── Step 2: Handle $...$ math blocks ──
  result = result.replace(/\$([^$]+)\$/g, (_, inner) => parseMathBlock(inner));

  // ── Step 3: Handle bare LaTeX (outside $...$) ──
  if (result.includes("\\")) {
    result = parseMathBlock(result);
  }

  return result;
}

// ── Parse a single $...$ math block ─────────────────────────────────────

function parseMathBlock(raw: string): string {
  let m = raw;

  // \text{...} → plain text
  m = m.replace(/\\text\{([^}]*)\}/g, "$1");
  m = m.replace(/\\textbf\{([^}]*)\}/g, "$1");
  m = m.replace(/\\textit\{([^}]*)\}/g, "$1");
  m = m.replace(/\\mathrm\{([^}]*)\}/g, "$1");
  m = m.replace(/\\mathbf\{([^}]*)\}/g, "$1");
  m = m.replace(/\\operatorname\{([^}]*)\}/g, "$1");

  // \frac{a}{b} → a/b  (handle nested braces with simple approach)
  // Process from innermost out (max 3 nesting levels)
  for (let i = 0; i < 3; i++) {
    m = m.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      // Simple fractions like \frac{1}{2} → ½ etc.
      const simple = getSimpleFraction(num.trim(), den.trim());
      if (simple) return simple;
      // Otherwise: (num)/(den) or num/den
      const needParensNum = num.includes("+") || num.includes("-");
      const needParensDen = den.includes("+") || den.includes("-");
      return `${needParensNum ? "(" + num + ")" : num}/${needParensDen ? "(" + den + ")" : den}`;
    });
  }

  // \sqrt[n]{x} → ⁿ√(x)
  m = m.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (_, n, inner) => {
    const sup = [...n].map((c: string) => SUPERSCRIPT[c] || c).join("");
    return `${sup}√(${inner})`;
  });
  // \sqrt{x} → √x (single char) or √(x+1) (multi char)
  m = m.replace(/\\sqrt\{([^}]+)\}/g, (_, inner) =>
    inner.trim().length <= 2 ? `√${inner.trim()}` : `√(${inner.trim()})`,
  );
  // \sqrt followed by single token
  m = m.replace(/\\sqrt\s+(\w)/g, (_, c) => `√${c}`);

  // Apply all symbol replacements
  for (const [pattern, replacement] of MATH_SYMBOLS) {
    m = m.replace(pattern, replacement as string);
  }

  // \overline{x} → x̄  (combining overline)
  m = m.replace(/\\overline\{([^}]+)\}/g, (_, inner) =>
    [...inner].map((c: string) => c + "\u0304").join(""),
  );
  m = m.replace(/\\bar\{([^}]+)\}/g, (_, inner) =>
    [...inner].map((c: string) => c + "\u0304").join(""),
  );

  // \vec{x} → x⃗
  m = m.replace(/\\vec\{([^}]+)\}/g, (_, inner) => inner + "\u20D7");

  // \hat{x} → x̂
  m = m.replace(/\\hat\{([^}]+)\}/g, (_, inner) => inner + "\u0302");

  // |x| — absolute value (already fine as-is)

  // \binom{n}{k} → (n choose k) or C(n,k)
  m = m.replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, "C($1,$2)");

  // Superscripts: ^{...} → Unicode superscript
  m = m.replace(/\^{([^}]+)}/g, (_, sup) => {
    // Multi-char lookup first
    if (SUPERSCRIPT[sup]) return SUPERSCRIPT[sup];
    return [...sup].map((c: string) => SUPERSCRIPT[c] || c).join("");
  });
  // Single char: ^x
  m = m.replace(/\^(.)/g, (_, c) => SUPERSCRIPT[c] || c);

  // Subscripts: _{...} → Unicode subscript
  m = m.replace(/_{([^}]+)}/g, (_, sub) => {
    if (SUBSCRIPT[sub]) return SUBSCRIPT[sub];
    return [...sub].map((c: string) => SUBSCRIPT[c] || c).join("");
  });
  // Single char: _x
  m = m.replace(/_(.)/g, (_, c) => SUBSCRIPT[c] || c);

  // \begin{cases}...\end{cases} → readable piecewise
  m = m.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, body) => {
    const lines = body
      .split("\\\\")
      .map((line: string) => line.trim())
      .filter(Boolean);
    return lines
      .map((line: string) => {
        const parts = line.split("&").map((p: string) => p.trim());
        return parts.join("  ");
      })
      .join("\n");
  });

  // Clean up remaining backslashes (but not before known chars)
  m = m.replace(/\\([^a-zA-Z])/g, "$1"); // \. \, etc → just the char
  m = m.replace(/\\[a-zA-Z]+/g, ""); // unknown \commands → remove

  // Clean up extra whitespace
  m = m.replace(/\s+/g, " ").trim();

  return m;
}

// ── Simple fraction Unicode lookup ──────────────────────────────────────

function getSimpleFraction(num: string, den: string): string | null {
  const key = `${num}/${den}`;
  const fractions: Record<string, string> = {
    "1/2": "½",
    "1/3": "⅓",
    "2/3": "⅔",
    "1/4": "¼",
    "3/4": "¾",
    "1/5": "⅕",
    "2/5": "⅖",
    "3/5": "⅗",
    "4/5": "⅘",
    "1/6": "⅙",
    "5/6": "⅚",
    "1/7": "⅐",
    "1/8": "⅛",
    "3/8": "⅜",
    "5/8": "⅝",
    "7/8": "⅞",
    "1/9": "⅑",
    "1/10": "⅒",
  };
  return fractions[key] || null;
}

// ── Chemistry \ce{} block parser ────────────────────────────────────────

function parseCeBlock(raw: string): string {
  let s = raw;

  // Arrows
  s = s.replace(/<=>|\\rightleftharpoons/g, "⇌");
  s = s.replace(/->/g, "→");
  s = s.replace(/<-/g, "←");

  // Charges: ^{2+}, ^{-}, ^+, ^-
  s = s.replace(/\^{([^}]+)}/g, (_, sup) => {
    if (SUPERSCRIPT[sup]) return SUPERSCRIPT[sup];
    return [...sup].map((c: string) => SUPERSCRIPT[c] || c).join("");
  });
  s = s.replace(/\^(\d*[+-])/g, (_, sup) => {
    if (SUPERSCRIPT[sup]) return SUPERSCRIPT[sup];
    return [...sup].map((c: string) => SUPERSCRIPT[c] || c).join("");
  });

  // Subscripts
  s = s.replace(/_{([^}]+)}/g, (_, sub) =>
    [...sub].map((c: string) => SUBSCRIPT[c] || c).join(""),
  );

  // Implicit subscripts: letter(s) followed by digit(s)
  s = s.replace(
    /([A-Za-z)])(\d+)/g,
    (_, prefix, nums) =>
      prefix + [...nums].map((c: string) => SUBSCRIPT[c] || c).join(""),
  );

  // Clean up
  s = s.replace(/\\,/g, " ");
  s = s.replace(/\\/g, "");

  return s;
}
