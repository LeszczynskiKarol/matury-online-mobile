// ============================================================================
// SCHEMA NORMALIZER — port 1:1 z webowego
// frontend/src/components/exam/AngielskiTaskRenderers.tsx (matury-online.pl)
// ----------------------------------------------------------------------------
// Generator AI produkuje dla tego samego typu zadania różne kształty pól
// (np. PP egzaminy z polami w stylu PR: `items`/`passage`/`blanks`/`fragments`
// zamiast `questions`/`text`/`gaps`/`sentences`). Bez tej normalizacji część
// angielskich zadań renderowała się na mobile jako puste (web miał normalizer,
// mobile nie). Idempotentna: kanoniczne kształty przechodzą bez zmian.
// LUSTRA tej logiki: web AngielskiTaskRenderers.tsx + backend
// angielski-exam-grading.ts — zmieniając jedno, zmień pozostałe.
// Typy _de trafiają w `default` i wracają nietknięte.
// ============================================================================

// Rozbija tekst z markerami "4.1.\n…\n4.2.\n…" na akapity [{id,text}].
function splitNumberedSections(
  passage: string,
): Array<{ id: string; text: string }> {
  const re = /(?:^|\n)\s*(\d+\.\d+)\.?[ \t]*/g;
  const marks: Array<{ id: string; end: number; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage)))
    marks.push({ id: m[1], end: re.lastIndex, start: m.index });
  return marks.map((mk, i) => ({
    id: mk.id,
    text: passage
      .slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined)
      .trim(),
  }));
}

// Rozbija passage z etykietami "TEXT A - …, TEXT B - …" na [{id,text}].
function splitLabeledTexts(
  passage: string,
): Array<{ id: string; text: string }> {
  const re = /TEXT\s+([A-F])\s*[-–—:]\s*/gi;
  const marks: Array<{ id: string; end: number; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage)))
    marks.push({ id: m[1].toUpperCase(), end: re.lastIndex, start: m.index });
  return marks.map((mk, i) => ({
    id: mk.id,
    text: passage
      .slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined)
      .trim(),
  }));
}

/** "A. erklaren, warum..." → { id: "A", text: "erklaren, warum..." }. */
function labeledOption(o: any, i: number): { id: string; text: string } {
  if (o && typeof o === "object")
    return { id: String(o.id ?? o.key ?? o.label ?? i), text: String(o.text ?? o.content ?? "") };
  const str = String(o ?? "");
  const m = str.match(/^\s*([A-H])[.)]\s+(.*)$/s);
  return m ? { id: m[1], text: m[2].trim() } : { id: String(i), text: str };
}

export function normalizeEnglishContent(type: string, raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const c: any = { ...raw };
  // Warianty niemieckie mają DOKŁADNIE te same rozjazdy kształtu co angielskie,
  // a wpadały w `default` i wracały nietknięte — przez co zadania renderowały
  // się bez sekcji odpowiedzi (sam odtwarzacz, luki bez fragmentów).
  switch (type.replace(/_de$/, "")) {
    case "listening_mcq":
    case "listening_mcq_pr": {
      // Renderer czyta texts[].questions[]; generator bywa, że daje płaskie
      // items[] (wszystkie pytania do wszystkich nagrań naraz).
      const hasTexts =
        Array.isArray(c.texts) &&
        c.texts.some((t: any) => Array.isArray(t?.questions) && t.questions.length);
      if (!hasTexts && Array.isArray(c.items) && c.items.length) {
        c.texts = [
          {
            id: "1",
            questions: c.items.map((it: any) => ({
              id: String(it.id ?? ""),
              question: it.question ?? it.text ?? "",
              options: (it.options || []).map(labeledOption),
            })),
          },
        ];
      }
      break;
    }
    case "reading_mcq": {
      const src = c.questions || c.items || [];
      c.questions = src.map((q: any) => ({
        ...q,
        text: q.text ?? q.question ?? "",
      }));
      c.text = c.text ?? c.passage ?? "";
      break;
    }
    case "reading_gapped_text":
    case "reading_gapped_text_pr": {
      const src = c.sentences || c.fragments || [];
      // Renderer buduje mapę fragmentów po polach id/text; generator dla PR
      // opisuje je jako label/content, przez co lista do wyboru była pusta
      // i luk nie dało się wypełnić.
      c.fragments = Array.isArray(src)
        ? src.map((f: any, i: number) =>
            f && typeof f === "object"
              ? { id: String(f.id ?? f.label ?? i), text: String(f.text ?? f.content ?? "") }
              : labeledOption(f, i),
          )
        : src;
      c.sentences = c.fragments;
      c.textWithGaps = c.textWithGaps ?? c.passage ?? "";
      break;
    }
    case "reading_paragraph_match": {
      // Tu kierunek dopasowania jest ODWROTNY niż w heading_match: to zdania
      // (items) są wierszami, a częściami do wyboru są fragmenty tekstu.
      // Renderer wyświetla `headings` u góry i pyta o nie przy każdej
      // `section`, więc mapujemy zdania → sections, części tekstu → headings.
      const parts =
        (Array.isArray(c.passage?.parts) && c.passage.parts) ||
        (Array.isArray(c.parts) && c.parts) ||
        [];
      if (parts.length && !c.headings) {
        c.headings = Object.fromEntries(
          parts.map((p: any, i: number) => [
            String(p?.label ?? p?.id ?? i),
            String(p?.content ?? p?.text ?? ""),
          ]),
        );
      }
      if (!c.sections?.length && Array.isArray(c.items) && c.items.length) {
        const stem = typeof c.questionStem === "string" ? c.questionStem.trim() : "";
        c.sections = c.items.map((it: any) => ({
          id: String(it.id ?? ""),
          text: [stem, String(it.question ?? it.text ?? "")]
            .filter(Boolean)
            .join(" "),
        }));
      }
      break;
    }
    case "reading_heading_match": {
      let src = c.paragraphs?.length ? c.paragraphs : c.texts;
      // Wariant z akapitami wklejonymi w `passage` (markery "4.1.\n…").
      if ((!src || !src.length) && typeof c.passage === "string") {
        src = splitNumberedSections(c.passage);
      }
      c.paragraphs = (src || []).map((p: any) => ({
        id: p.id,
        text: p.text ?? p.content ?? "",
      }));
      break;
    }
    case "reading_mixed": {
      // Wariant `items`+`passage` (mcq+open) — obsługiwany gałęzią renderera,
      // zostaw bez zmian.
      if (Array.isArray(c.items) && c.items.length) break;
      // Wariant `matchingItems`/`fillItems`+`passage` (teksty "TEXT A - …").
      if (Array.isArray(c.matchingItems) || Array.isArray(c.fillItems)) {
        c.matchingQuestions = (c.matchingItems || []).map((mi: any) => ({
          id: mi.id,
          text: mi.text ?? mi.prompt ?? "",
          correctAnswer: mi.correctAnswer,
        }));
        c.fillGaps = (c.fillItems || []).map((fi: any) => ({
          id: fi.id,
          prompt: fi.prompt,
          maxWords: fi.maxWords,
          correctAnswers:
            fi.correctAnswers ||
            fi.acceptableAnswers ||
            (fi.correctAnswer != null ? [fi.correctAnswer] : []),
        }));
        if ((!c.texts || !c.texts.length) && typeof c.passage === "string") {
          c.texts = splitLabeledTexts(c.passage);
        }
      }
      break;
    }
    case "open_cloze": {
      const src = c.gaps || c.blanks || [];
      c.gaps = src.map((g: any) => ({
        ...g,
        correctAnswers:
          g.correctAnswers ||
          (g.correctAnswer != null ? [g.correctAnswer] : []),
      }));
      c.text = c.text ?? c.passage ?? "";
      break;
    }
    case "transformation": {
      const src = c.items || c.transformations || c.sentences || [];
      c.items = src.map((it: any) => ({
        ...it,
        originalSentence: it.originalSentence ?? it.original ?? "",
        keyword: it.keyword ?? it.hint ?? "",
        gappedSentence: it.gappedSentence ?? it.promptSentence ?? "",
        correctAnswers:
          it.correctAnswers ||
          it.acceptableAnswers ||
          it.alternatives ||
          (it.correctAnswer != null
            ? [it.correctAnswer]
            : it.expectedTransformation != null
              ? [it.expectedTransformation]
              : []),
      }));
      break;
    }
    case "both_sentences": {
      const src = c.items || c.pairs || c.sentences || [];
      c.items = src.map((it: any) => ({
        ...it,
        correctAnswers:
          it.correctAnswers ||
          it.acceptableAnswers ||
          (it.correctAnswer != null ? [it.correctAnswer] : []),
      }));
      break;
    }
    case "mini_dialogues": {
      // Trzy układy dialogu — context (gotowy tekst), lineA/setup/lineAafter,
      // lineX/lineXafter. Sklejamy do jednego `context`.
      c.dialogues = (c.dialogues || []).map((d: any) => {
        let context = d.context;
        if (!context) {
          const setup = d.setup ? `${d.setup}\n` : "";
          const exchanges = d.exchanges || d.exchange;
          if (Array.isArray(exchanges) && exchanges.length) {
            context =
              setup +
              exchanges
                .map((ex: any) => `${ex.speaker}: ${ex.line}`)
                .join("\n");
          } else if (d.lineA != null) {
            context =
              `${setup}A: ${d.lineA}\nB: _____` +
              (d.lineAafter ? `\nA: ${d.lineAafter}` : "");
          } else if (d.lineX != null) {
            context =
              `${setup}X: ${d.lineX}\nY: _____` +
              (d.lineXafter ? `\nX: ${d.lineXafter}` : "");
          }
        }
        return { ...d, context: context || "" };
      });
      break;
    }
    default:
      break;
  }
  return c;
}
