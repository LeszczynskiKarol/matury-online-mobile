// ============================================================================
// Bramka kształtów zadań: czy KAŻDY typ zadania z produkcji da się rozwiązać
// w aplikacji po przejściu przez normalizator.
// matury-online-mobile/scripts/check-exam-shapes.ts
//
//   npx tsx scripts/check-exam-shapes.ts <samples.jsonl>
//
// Próbki (jedna na każdą parę typ+kształt pól) zrzuca się z produkcji tym
// zapytaniem (psql -tA, wynik do pliku, jedna linia = jedno zadanie):
//
//   WITH t AS (
//     SELECT s.slug, e.id AS exam_id, e."createdAt" AS created,
//            tk->>'id' AS task_id, tk->>'type' AS typ, tk->'content' AS content,
//            (SELECT string_agg(k, ',' ORDER BY k)
//               FROM jsonb_object_keys(tk->'content') k) AS keys
//     FROM "Exam" e JOIN "Subject" s ON s.id = e."subjectId",
//          jsonb_array_elements(e.content->'parts') p,
//          jsonb_array_elements(p->'tasks') tk
//     WHERE s.slug IN ('angielski','angielski-osmoklasista','niemiecki')
//       AND e."isActive" = true)
//   SELECT DISTINCT ON (slug, typ, keys)
//          jsonb_build_object('subject', slug, 'examId', exam_id,
//                             'taskId', task_id, 'type', typ,
//                             'content', content)::text
//   FROM t ORDER BY slug, typ, keys, created DESC;
//
// Dlaczego to istnieje (28.08.2026): normalizator był portem z weba i
// ujednolicał dane DO kształtu webowego (text, gaps, originalSentence…), a
// renderery mobilne czytają INNE pola (question, passage, blanks, prompt…).
// Angielskie zadania przychodzą już w kształcie webowym, więc normalizator
// nic z nimi nie robił, a renderery nie miały co pokazać — uczeń widział
// odtwarzacz i numer „2.1" bez pytania, tekst bez luk, luki bez tekstu.
// Predykaty niżej odzwierciedlają pola, które renderery FAKTYCZNIE czytają
// (NiemieckiTaskRenderers.tsx), nie żaden kształt „kanoniczny". Gdy zmieniasz
// renderer albo normalizator, zmień predykat — i odpal to na świeżym zrzucie.
// ============================================================================

import { readFileSync } from "node:fs";
import { normalizeEnglishContent } from "../src/utils/normalizeEnglishContent";

const file = process.argv[2];
if (!file) {
  console.error("Użycie: npx tsx scripts/check-exam-shapes.ts <samples.jsonl>");
  process.exit(2);
}

// Egzamin ósmoklasisty żyje w innej aplikacji (zdaj-angielski) — jego typy
// zadań nie mają tu rendererów i nie mają ich mieć. Zrzut z prod może je
// zawierać, więc odpadają tutaj, a nie w SQL-u.
const OUT_OF_SCOPE_SUBJECTS = new Set(["angielski-osmoklasista"]);

const rows = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => !OUT_OF_SCOPE_SUBJECTS.has(r.subject));

const ne = (v: any) => typeof v === "string" && v.trim().length > 0;
const arr = (v: any) => (Array.isArray(v) ? v : []);
const optsOk = (o: any) =>
  (Array.isArray(o) && o.length > 0) ||
  (o && typeof o === "object" && Object.keys(o).length > 0);

// To samo mapowanie typu, którego używa dispatcher rendererów.
function norm(t: string) {
  if (t === "writing_eng" || t === "writing_de") return "writing";
  if (t === "writing_eng_pr" || t === "writing_de_pr") return "writing_pr";
  return t.replace(/_de$/, "");
}

/** Lista problemów; pusta = renderer ma co pokazać i czym odpowiadać. */
function check(type: string, c: any): string[] {
  const t = norm(type);
  const p: string[] = [];

  if (t === "listening_matching") {
    if (!arr(c.speakers).length) p.push("brak speakers");
    if (!optsOk(c.statements)) p.push("brak statements");
    return p;
  }
  if (t === "listening_mcq" || t === "listening_mcq_pr") {
    const qs = arr(c.texts).flatMap((x: any) => arr(x.questions));
    if (!qs.length) return ["brak texts[].questions[]"];
    for (const q of qs) {
      if (!ne(q.question)) p.push(`${q.id}: brak question`);
      if (!optsOk(q.options)) p.push(`${q.id}: brak options`);
    }
    return p;
  }
  if (t === "listening_fill") {
    const items = arr(c.gaps).length ? arr(c.gaps) : arr(c.questions);
    if (!items.length) return ["brak gaps/questions"];
    const tpl = String(c.noteTemplate || "");
    const tplHasGaps = items.some((it: any) => tpl.includes(String(it.id)));
    if (!tplHasGaps)
      for (const q of items)
        if (!ne(q.questionDE ?? q.question ?? q.text ?? q.prompt) && !ne(q.blankLabel))
          p.push(`${q.id}: bez szablonu i bez treści pytania`);
    return p;
  }
  if (["reading_mcq", "reading_two_texts", "reading_mixed", "mcq_cloze"].includes(t)) {
    const items = arr(c.items).length ? arr(c.items) : arr(c.questions);
    if (!ne(c.passage) && !arr(c.texts).length) p.push("brak passage i texts");
    if (!items.length) return [...p, "brak items/questions"];
    for (const q of items) {
      const isMcq = q.type ? q.type === "mcq" : optsOk(q.options);
      if (t !== "mcq_cloze" && !ne(q.question ?? q.statement)) p.push(`${q.id}: brak question`);
      if (isMcq && !optsOk(q.options)) p.push(`${q.id}: brak options`);
    }
    return p;
  }
  if (t === "reading_heading_match" || t === "reading_paragraph_match") {
    if (!optsOk(c.headings)) p.push("brak headings");
    const secs = arr(c.sections).length ? arr(c.sections) : arr(c.texts);
    if (!secs.length) p.push("brak sections/texts");
    else for (const s of secs) if (!ne(s.text ?? s.content)) p.push(`${s.id}: pusta sekcja`);
    return p;
  }
  if (t === "reading_gapped_text" || t === "reading_gapped_text_pr") {
    const fr = c.fragments || c.sentences || c.options;
    if (!optsOk(fr)) p.push("brak fragments");
    else if (Array.isArray(fr))
      for (const f of fr) if (!(f && f.id != null && ne(f.text))) p.push("fragment bez id/text");
    const pass = String(c.passage || c.textWithGaps || "");
    if (!/(\d+(?:\.\d+)?)\.\s*_{3,}/.test(pass)) p.push("passage bez markerów luk");
    return p;
  }
  if (t === "mini_dialogues") {
    const ds = arr(c.dialogues);
    if (!ds.length) return ["brak dialogues"];
    for (const d of ds) {
      if (!ne(d.context) && !arr(d.lines).length) p.push(`${d.id}: brak context/lines`);
      if (!optsOk(d.options)) p.push(`${d.id}: brak options`);
    }
    return p;
  }
  if (t === "both_sentences") {
    const items = [...arr(c.items), ...arr(c.sentences)];
    if (!items.length) return ["brak items"];
    const hasChoices = items.some((r: any) => r.options || r.sentence1);
    for (const it of items) {
      if (hasChoices) {
        if (!ne(it.sentence1) || !ne(it.sentence2)) p.push(`${it.id}: brak sentence1/2`);
        if (!optsOk(it.options)) p.push(`${it.id}: brak options`);
      } else if (!ne(it.prompt)) p.push(`${it.id}: brak prompt (wariant jednozdaniowy)`);
    }
    return p;
  }
  if (t === "open_cloze" || t === "word_formation") {
    const sentenceItems = arr(c.items).some((it: any) => arr(it.sentences).length);
    if (!ne(c.passage) && !sentenceItems) p.push("brak passage");
    if (!arr(c.blanks).length && !arr(c.items).length) p.push("brak blanks/items");
    return p;
  }
  if (["transformation", "sentence_completion_pr", "sentence_transform_pr", "word_three_sentences"].includes(t)) {
    const rows2 = [...arr(c.items), ...arr(c.sentences)];
    if (!rows2.length) return ["brak items"];
    for (const r of rows2) if (!ne(r.prompt ?? r.original)) p.push(`${r.id}: brak prompt`);
    return p;
  }
  if (t === "writing" || t === "writing_pr") {
    const topics = arr(c.topics);
    if (topics.length) {
      for (const tp of topics) if (!ne(tp.promptPL) && !ne(tp.title)) p.push(`temat ${tp.id}: brak promptPL`);
    } else if (!ne(c.scenario) && !arr(c.bulletPoints).length) p.push("brak topics i brak scenario/bulletPoints");
    return p;
  }
  return ["TYP NIEOBSŁUGIWANY w mobile"];
}

let fail = 0;
for (const r of rows) {
  const problems = check(r.type, normalizeEnglishContent(r.type, r.content));
  if (problems.length) {
    fail++;
    console.log(
      `✗ ${r.subject} ${r.type} ${r.examId}/${r.taskId}: ${problems.slice(0, 3).join(" | ")}${problems.length > 3 ? ` (+${problems.length - 3})` : ""}`,
    );
  }
}
console.log(`\n${rows.length - fail}/${rows.length} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
