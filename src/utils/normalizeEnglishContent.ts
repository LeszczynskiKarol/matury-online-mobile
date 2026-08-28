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
//
// UWAGA (28.08.2026): ten plik ujednolica dane w DWIE strony. Web czyta
// `text`/`gaps`/`originalSentence`, a renderery mobilne
// (NiemieckiTaskRenderers.tsx) czytają `question`/`passage`/`blanks`/`prompt`.
// Sam port z weba zostawiał angielskie zadania bez pytań i tekstów, bo te
// przychodzą już w kształcie webowym. Typy `_de` wchodzą do tego samego
// switcha (sufiks jest zdejmowany). Bramka: scripts/check-exam-shapes.ts.
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

/**
 * Renderery szukają luk wzorcem `7.1. ____`. Generator zapisuje je też jako
 * `[7.1] ____`, `(7.1) ____` albo `7.1 ____` — bez ujednolicenia luka
 * jest w tekście, ale nie ma przy niej pola do wpisania.
 */
function canonGapMarkers(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/[\[(]?(\d+(?:\.\d+)?)[\])]?\.?\s*(_{3,})/g, "$1. $2");
}

export function normalizeEnglishContent(type: string, raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const c: any = { ...raw };
  // Warianty niemieckie mają DOKŁADNIE te same rozjazdy kształtu co angielskie,
  // a wpadały w `default` i wracały nietknięte — przez co zadania renderowały
  // się bez sekcji odpowiedzi (sam odtwarzacz, luki bez fragmentów).
  const key = type
    .replace(/_de$/, "")
    .replace(/^writing_(eng|de)_pr$/, "writing_pr")
    .replace(/^writing_(eng|de)$/, "writing");
  switch (key) {
    case "listening_mcq":
    case "listening_mcq_pr": {
      // Wariant z texts[]: pytanie siedzi pod `text`, renderer czyta
      // `question` — na ekranie zostawał sam numer „2.1" nad opcjami.
      if (Array.isArray(c.texts)) {
        c.texts = c.texts.map((tx: any, i: number) => ({
          ...tx,
          label:
            tx.label ??
            (tx.title ? tx.title : `Tekst ${String(tx.id ?? i + 1).replace(/^text/i, "")}`),
          questions: Array.isArray(tx.questions)
            ? tx.questions.map((q: any) => ({
                ...q,
                question: q.question ?? q.text ?? q.statement ?? "",
                options: Array.isArray(q.options) ? q.options.map(labeledOption) : q.options,
              }))
            : tx.questions,
        }));
      }
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
        // renderer mobilny czyta `question`, web czyta `text` — trzymamy oba
        question: q.question ?? q.text ?? q.statement ?? "",
        options: Array.isArray(q.options) ? q.options.map(labeledOption) : q.options,
      }));
      if (Array.isArray(c.items) && c.items.length)
        c.items = c.items.map((q: any) => ({
          ...q,
          question: q.question ?? q.text ?? q.statement ?? "",
          options: Array.isArray(q.options) ? q.options.map(labeledOption) : q.options,
        }));
      c.text = c.text ?? c.passage ?? "";
      c.passage = c.passage ?? c.text ?? "";
      c.textTitle = c.textTitle ?? c.title;
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
      c.textWithGaps = canonGapMarkers(c.textWithGaps ?? c.passage ?? "");
      c.passage = c.textWithGaps;
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
      // renderer ReadingHeadingMatch czyta `sections` (albo `texts`) — po
      // samym `paragraphs` rysował nagłówki A–F i ani jednego akapitu
      if (!Array.isArray(c.sections) || !c.sections.length) c.sections = c.paragraphs;
      c.textTitle = c.textTitle ?? c.title;
      break;
    }
    case "writing": {
      // Bez `topics` renderer bierze brief z contentu i czyta scenario /
      // bulletPoints / form / signOff — angielskie zadanie PP trzyma to pod
      // situationPL / bulletPointsPL / startingSentence, więc pokazywała się
      // sama forma („W blogu do kolegi") bez treści polecenia.
      if (!Array.isArray(c.topics) || !c.topics.length) {
        const start = c.startingSentence
          ? "\n\nZacznij od: „" + c.startingSentence + "”"
          : "";
        c.scenario = c.scenario ?? (c.situationPL ? c.situationPL + start : c.topic);
        c.bulletPoints = c.bulletPoints ?? c.bulletPointsPL ?? c.bullets ?? [];
        c.wordCount = c.wordCount ?? c.wordLimit;
      }
      break;
    }
    case "reading_two_texts": {
      // Renderer wypisuje `texts[]`; PR-owy wariant trzyma oba teksty jako
      // osobne obiekty text1/text2, więc na ekranie nie było ŻADNEGO tekstu,
      // a pytania odsyłały do „Tekstu 1" i „Tekstu 2".
      if (!c.texts?.length && (c.text1 || c.text2)) {
        c.texts = [c.text1, c.text2]
          .filter(Boolean)
          .map((t: any, i: number) => ({
            id: String(i + 1),
            title: t.title ?? "",
            text: t.content ?? t.text ?? "",
          }));
      }
      if (Array.isArray(c.items)) {
        c.items = c.items.map((it: any) => ({
          ...it,
          // Pytania otwarte niosą treść w `sentenceWithGap`.
          question: it.question ?? it.sentenceWithGap ?? "",
          options: Array.isArray(it.options)
            ? it.options.map(labeledOption)
            : it.options,
        }));
      }
      break;
    }
    case "mcq_cloze": {
      c.passage = canonGapMarkers(c.passage ?? c.text ?? "");
      // Warianty odpowiedzi przychodzą jako "A. geschenkt" — bez rozbicia na
      // literę i treść renderer numerowałby je pozycyjnie (0,1,2), a klucz
      // odpowiedzi mówi "A".
      if (Array.isArray(c.items)) {
        c.items = c.items.map((it: any) => ({
          ...it,
          options: Array.isArray(it.options)
            ? it.options.map(labeledOption)
            : it.options,
        }));
      }
      break;
    }
    case "word_three_sentences": {
      // Renderer transformacji czyta `prompt`; tutaj treścią zadania są trzy
      // zdania, do których pasuje jeden wyraz — bez tego zostawał sam numer
      // i puste pole.
      if (!Array.isArray(c.items) || !c.items.length) {
        const simple = Array.isArray(c.simpleItems) && c.simpleItems.length
          ? c.simpleItems
          : Array.isArray(c.sentences) ? c.sentences : [];
        c.items = simple.map((it: any) => ({
          ...it,
          prompt: it.prompt ?? it.sentence ?? it.text ?? "",
        }));
      }
      if (Array.isArray(c.items)) {
        c.items = c.items.map((it: any) => ({
          ...it,
          prompt:
            it.prompt ??
            (Array.isArray(it.sentences) ? it.sentences.join("\n") : ""),
        }));
      }
      // renderery Transformation/BothSentences sklejaja items z sentences — po zbudowaniu items stare sentences dublowalyby wiersze (drugi raz puste)
      c.sentences = [];
      break;
    }
    case "sentence_transform_pr":
    case "sentence_transform": {
      // Para zdań: wyjściowe + docelowe z luką. Renderer pokazuje `prompt`.
      {
        // wariant z samymi `sentences` (2 arkusze) — bez tego zostawal pusty
        const src = Array.isArray(c.items) && c.items.length
          ? c.items
          : Array.isArray(c.sentences) ? c.sentences : [];
        c.items = src.map((it: any) => ({
          ...it,
          prompt:
            it.prompt ??
            // wariant `sentences` ma `original`; pusty string ze sklejenia
            // przeszedłby przez `??` w rendererze i zasłonił to pole
            ([it.sourceSentence, it.targetSentence].filter(Boolean).join("\n") ||
              (it.original ?? it.sentence ?? it.text ?? "")),
          hint: it.hint ?? it.givenWords ?? it.keyword ?? "",
        }));
      }
      // renderery Transformation/BothSentences sklejaja items z sentences — po zbudowaniu items stare sentences dublowalyby wiersze (drugi raz puste)
      c.sentences = [];
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
      // Wariant PP/PR z dwiema częściami: dopasowanie zdań do tekstów
      // (matchingQuestions) i uzupełnianie polskiego streszczenia
      // (fillQuestions). Renderer czyta wyłącznie `items` i rozpoznaje typ po
      // obecności `options`, więc bez tego mapowania widok kończył się na
      // ostatnim tekście — samo czytanie, bez czego odpowiadać.
      if (
        !c.items?.length &&
        (Array.isArray(c.matchingQuestions) ||
          Array.isArray(c.fillQuestions) ||
          Array.isArray(c.fillGaps))
      ) {
        // Notatka z lukami (EN: fillContext) idzie nad pytania jako passage.
        if (!c.passage && typeof c.fillContext === "string") c.passage = c.fillContext;
        const options = (c.texts || []).map((t: any) => ({
          id: String(t.id ?? ""),
          text: t.title ? `${t.id} — ${t.title}` : String(t.id ?? ""),
        }));
        const matching = (c.matchingQuestions || []).map((m: any) => ({
          id: String(m.id ?? ""),
          type: "mcq",
          question: m.statement ?? m.text ?? "",
          options,
        }));
        const fill = (c.fillQuestions || c.fillGaps || []).map((f: any) => {
          const before = String(f.contextBefore ?? "").trim();
          const after = String(f.contextAfter ?? "").trim();
          // Bez kontekstu zostaje samo „5.4." — uczeń nie wie, czego szukać.
          // Gdy kontekstu nie ma (EN fillGaps), luka jest w notatce wyżej.
          const prompt = before || after
            ? [before, "______", after].filter(Boolean).join(" ")
            : "Luka " + f.id + (f.maxWords ? " (maks. " + f.maxWords + " wyr.)" : "");
          return {
            id: String(f.id ?? ""),
            type: "open",
            question: prompt.trim(),
          };
        });
        c.items = [...matching, ...fill];
      }
      break;
    }
    case "open_cloze": {
      const src = c.gaps || c.blanks || c.items || [];
      c.gaps = src.map((g: any) => ({
        ...g,
        correctAnswers:
          g.correctAnswers ||
          (g.correctAnswer != null ? [g.correctAnswer] : []),
      }));
      c.text = c.text ?? c.passage ?? "";
      // renderer OpenCloze czyta `passage` i `blanks` — bez tego tekst z lukami
      // w ogóle się nie pokazywał
      c.passage = canonGapMarkers(c.passage ?? c.text ?? "");
      c.blanks = Array.isArray(c.blanks) && c.blanks.length ? c.blanks : c.gaps;
      break;
    }
    case "word_formation": {
      // Uczeń musi widzieć wyraz bazowy przy każdej luce — renderer OpenCloze
      // rysuje same pola, więc doklejamy go do markera luki w tekście.
      const items = Array.isArray(c.items) ? c.items : [];
      let passage = String(c.passage ?? c.text ?? "");
      for (const it of items) {
        const base = it.baseWord ?? it.hint ?? it.word;
        if (!base || !it.id) continue;
        const escaped = String(it.id).replace(/[.]/g, "\\.");
        const re = new RegExp("(" + escaped + "\\.?\\s*_{3,})");
        passage = passage.replace(re, "$1 (" + String(base).toUpperCase() + ")");
      }
      if (Array.isArray(c.wordBox) && c.wordBox.length)
        passage = "Wyrazy: " + c.wordBox.join(", ") + "\n\n" + passage;
      c.passage = passage;
      c.blanks = Array.isArray(c.blanks) && c.blanks.length ? c.blanks : items;
      break;
    }
    case "sentence_completion_pr": {
      if (Array.isArray(c.items))
        c.items = c.items.map((it: any) => ({
          ...it,
          prompt: it.prompt ?? it.sentence ?? it.gappedSentence ?? "",
        }));
      break;
    }
    case "transformation": {
      const src = c.items || c.transformations || c.sentences || [];
      c.items = src.map((it: any) => ({
        ...it,
        // renderer Transformation pokazuje `prompt` i `hint` — zdanie
        // wyjściowe, zdanie z luką i słowo klucz siedzą w innych polach
        prompt:
          it.prompt ??
          [it.originalSentence ?? it.original, it.gappedSentence ?? it.promptSentence]
            .filter(Boolean)
            .join("\n"),
        hint: it.hint ?? it.keyword ?? it.givenWords ?? "",
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
      // renderery Transformation/BothSentences sklejaja items z sentences — po zbudowaniu items stare sentences dublowalyby wiersze (drugi raz puste)
      c.sentences = [];
      break;
    }
    case "both_sentences": {
      const src = c.items || c.pairs || c.sentences || [];
      c.items = src.map((it: any) => ({
        ...it,
        // Wariant jednozdaniowy (samo `text` z luką, bez opcji) nie jest
        // „oba zdania" — dispatcher kieruje go do renderera z polem
        // tekstowym, który czyta `prompt`.
        prompt: it.prompt ?? (it.sentence1 ? undefined : it.text ?? it.sentence),
        correctAnswers:
          it.correctAnswers ||
          it.acceptableAnswers ||
          (it.correctAnswer != null ? [it.correctAnswer] : []),
      }));
      // renderery Transformation/BothSentences sklejaja items z sentences — po zbudowaniu items stare sentences dublowalyby wiersze (drugi raz puste)
      c.sentences = [];
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
          if (typeof exchanges === "string" && exchanges.trim()) {
            context = setup + exchanges;
          } else if (Array.isArray(d.lines) && d.lines.length) {
            context =
              setup +
              d.lines
                .map((ln: any) => `${ln.speaker ?? ""}: ${ln.text ?? ln.line ?? ""}`)
                .join("\n");
          } else if (Array.isArray(exchanges) && exchanges.length) {
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
