// Converts LaTeX/mhchem notation to readable Unicode
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
};
const SUPERSCRIPT: Record<string, string> = {
  "+": "⁺",
  "-": "⁻",
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
};

export function parseChemText(text: string): string {
  if (!text) return "";

  let result = text;

  // Strip \ce{...} wrappers but keep content
  result = result.replace(/\$\\ce\{([^}]+)\}\$/g, (_, inner) =>
    parseCeBlock(inner),
  );
  result = result.replace(/\\ce\{([^}]+)\}/g, (_, inner) =>
    parseCeBlock(inner),
  );

  // If no $...$ delimiters at all, try bare LaTeX cleanup
  if (!result.includes("$")) {
    result = result.replace(/\\log/g, "log");
    result = result.replace(/\\ln/g, "ln");
    result = result.replace(/\\sin/g, "sin");
    result = result.replace(/\\cos/g, "cos");
    result = result.replace(/\\tan/g, "tan");
    result = result.replace(/\\sqrt/g, "√");
    result = result.replace(/\\cdot/g, "·");
    result = result.replace(/\\times/g, "×");
    result = result.replace(/\\div/g, "÷");
    result = result.replace(/\\pm/g, "±");
    result = result.replace(/\\approx/g, "≈");
    result = result.replace(/\\neq/g, "≠");
    result = result.replace(/\\leq/g, "≤");
    result = result.replace(/\\geq/g, "≥");
    result = result.replace(/\\rightarrow/g, "→");
    result = result.replace(/\\leftarrow/g, "←");
    result = result.replace(/\\leftrightarrow/g, "⇌");
    result = result.replace(/\\infty/g, "∞");
    result = result.replace(/\\Delta/g, "Δ");
    result = result.replace(/\\alpha/g, "α");
    result = result.replace(/\\beta/g, "β");
    result = result.replace(/\\gamma/g, "γ");
    result = result.replace(/\\pi/g, "π");
    result = result.replace(/\^{([^}]+)}/g, (__, sup) =>
      [...sup].map((c) => SUPERSCRIPT[c] || c).join(""),
    );
    result = result.replace(/_{([^}]+)}/g, (__, sub) =>
      [...sub].map((c) => SUBSCRIPT[c] || c).join(""),
    );
    result = result.replace(/\^(.)/g, (__, c) => SUPERSCRIPT[c] || c);
    result = result.replace(/_(.)/g, (__, c) => SUBSCRIPT[c] || c);
    result = result.replace(/\\\s/g, " ");
    result = result.replace(/\\/g, "");
  }

  // Strip remaining $...$ (simple math)
  result = result.replace(/\$([^$]+)\$/g, (_, inner) => {
    let m = inner;
    m = m.replace(/\\text\{([^}]+)\}/g, "$1");
    m = m.replace(/\\cdot/g, "·");
    m = m.replace(/\\times/g, "×");
    m = m.replace(/\\div/g, "÷");
    m = m.replace(/\\pm/g, "±");
    m = m.replace(/\\approx/g, "≈");
    m = m.replace(/\\neq/g, "≠");
    m = m.replace(/\\leq/g, "≤");
    m = m.replace(/\\geq/g, "≥");
    m = m.replace(/\\rightarrow/g, "→");
    m = m.replace(/\\leftarrow/g, "←");
    m = m.replace(/\\leftrightarrow/g, "⇌");
    m = m.replace(/\^{([^}]+)}/g, (__, sup) =>
      [...sup].map((c) => SUPERSCRIPT[c] || c).join(""),
    );
    m = m.replace(/_{([^}]+)}/g, (__, sub) =>
      [...sub].map((c) => SUBSCRIPT[c] || c).join(""),
    );
    m = m.replace(/\^(.)/g, (__, c) => SUPERSCRIPT[c] || c);
    m = m.replace(/_(.)/g, (__, c) => SUBSCRIPT[c] || c);
    m = m.replace(/\\/g, "");
    return m;
  });

  return result;
}

function parseCeBlock(raw: string): string {
  let s = raw;

  // Arrows
  s = s.replace(/<=>|\\rightleftharpoons/g, "⇌");
  s = s.replace(/<=>/g, "⇌");
  s = s.replace(/->/g, "→");
  s = s.replace(/<-/g, "←");

  // Charges: ^{2+}, ^{-}, ^+, ^-, etc.
  s = s.replace(/\^{([^}]+)}/g, (_, sup) => {
    if (SUPERSCRIPT[sup]) return SUPERSCRIPT[sup];
    return [...sup].map((c) => SUPERSCRIPT[c] || c).join("");
  });
  s = s.replace(/\^(\d*[+-])/g, (_, sup) => {
    if (SUPERSCRIPT[sup]) return SUPERSCRIPT[sup];
    return [...sup].map((c) => SUPERSCRIPT[c] || c).join("");
  });

  // Subscripts: _{...} or implicit (letters followed by digits)
  s = s.replace(/_{([^}]+)}/g, (_, sub) =>
    [...sub].map((c) => SUBSCRIPT[c] || c).join(""),
  );

  // Implicit subscripts: letter(s) followed by digit(s) in chemical formulas
  // e.g. CH3COOH -> CH₃COOH, H2O -> H₂O, Ca(OH)2 -> Ca(OH)₂
  s = s.replace(
    /([A-Za-z\)])(\d+)/g,
    (_, prefix, nums) =>
      prefix + [...nums].map((c: string) => SUBSCRIPT[c] || c).join(""),
  );

  // Clean up remaining LaTeX
  s = s.replace(/\\,/g, " ");
  s = s.replace(/\\/g, "");

  return s;
}
