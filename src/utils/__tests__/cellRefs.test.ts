// Adresy komórek arkusza a wykrywanie LaTeX-a (utils/cellRefs.ts).
//   npx tsx src/utils/__tests__/cellRefs.test.ts
// Ten sam plik (poza ścieżką importu) jest w webach zdaj/osmo i w apkach
// (src/utils/__tests__/cellRefs.test.ts).
import { CELL_DOLLAR, protectCellRefs, restoreCellRefs } from "../cellRefs";

let failed = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};
const D = CELL_DOLLAR;
// Wzory `$…$` po ochronie adresów — to, co wydzieli renderer.
const maths = (s: string) => protectCellRefs(s).match(/\$[^$]+\$/g) ?? [];

check(protectCellRefs("=SUMA($B$2:$B$10)") === `=SUMA(${D}B${D}2:${D}B${D}10)`, "zakres bezwzględny $B$2:$B$10");
check(maths("=SUMA($B$2:$B$10)").length === 0, "…i żadnego wzoru");
check(maths("W komórce C2 wpisano =$A1*B$1 i skopiowano").length === 0, "adresy mieszane $A1 i B$1");
check(maths("Formuła =JEŻELI($C$3>10;$D2;0)").length === 0, "adresy w JEŻELI");
check(protectCellRefs("kolumna $AB$12") === `kolumna ${D}AB${D}12`, "dwuliterowa kolumna");
check(JSON.stringify(maths("Oblicz $x^2$ dla $B$2 = 3")) === JSON.stringify(["$x^2$"]), "wzór obok adresu zostaje wzorem");
check(JSON.stringify(maths("pole $P = a^2$")) === JSON.stringify(["$P = a^2$"]), "zwykły wzór bez zmian");
check(JSON.stringify(maths("$A1$")) === JSON.stringify(["$A1$"]), "„$A1$” (adres zamknięty dolarem) traktowany jak wzór");
check(protectCellRefs("$=\\$A\\$1$") === "$=\\$A\\$1$", "escapowany \\$A\\$1 wewnątrz wzoru nietknięty");
check(protectCellRefs("koszt $5 i $10") === "koszt $5 i $10", "kwoty w dolarach nietknięte");
check(protectCellRefs("A1 i B2") === "A1 i B2", "adresy względne bez $ bez zmian");
check(restoreCellRefs(protectCellRefs("=$A$1+$B2")) === "=$A$1+$B2", "restore odwraca protect");


// parseChemText (apka): adresy przeżywają, wzór obok nadal parsowany.
import("../chemText").then(({ parseChemText }) => {
  const out = parseChemText("=SUMA($B$2:$B$10) oraz $A1");
  if (out !== "=SUMA($B$2:$B$10) oraz $A1") { console.log("FAIL parseChemText:", out); process.exit(1); }
  console.log("ok  parseChemText zachowuje adresy komórek");
});
setTimeout(() => { console.log(failed ? `\n${failed} FAIL` : "\nwszystko ok"); process.exit(failed ? 1 : 0); }, 500);
