// ============================================================================
// Linki z powiadomień → ekrany apki (Centrum komunikatów, 7.10.2026)
// ----------------------------------------------------------------------------
// Backend podaje w powiadomieniu (push `data.url` albo wpis w liście
// powiadomień) ŚCIEŻKĘ WEBOWĄ, np. "/dashboard/egzamin-live/wyniki/<id>".
// Jedno miejsce tłumaczy ją na ekran apki. Nieznana ścieżka → pulpit,
// zewnętrzny adres http(s) → przeglądarka.
// ============================================================================

import { Linking } from "react-native";
import { navigate } from "../navigation/navigationRef";

/** Domeny marki — pełny adres z nich traktujemy jak ścieżkę w apce. */
const OWN_HOSTS = ["matury-online.pl", "www.matury-online.pl"];

function toTab(tab: string, screen: string, params?: Record<string, unknown>) {
  navigate("Main", { screen: tab, params: { screen, params } });
}

/** Wyciąga ścieżkę z pełnego adresu marki; zewnętrzny adres zwraca jako null. */
function ownPath(url: string): string | null {
  if (url.startsWith("/")) return url;
  // Bez `new URL` — polyfill URL w React Native nie ma hostname.
  const m = url.match(/^https?:\/\/([^/?#]+)([^#]*)/i);
  if (!m) return null;
  return OWN_HOSTS.includes(m[1].toLowerCase()) ? m[2] || "/" : null;
}

/** Otwiera ekran dla ścieżki webowej. Zwraca false, gdy nic nie zrobiono. */
export function routeFromUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const path = ownPath(url.trim());
  if (path === null) {
    if (/^https?:\/\//i.test(url)) {
      Linking.openURL(url).catch(() => {});
      return true;
    }
    return false;
  }
  const pathname = path.split("?")[0];
  const p = pathname.replace(/\/+$/, "") || "/";
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/dashboard\/egzamin-live\/wyniki\/([^/]+)$/))) {
    toTab("ExamTab", "ExamResults", { attemptId: m[1] });
  } else if ((m = p.match(/^\/dashboard\/egzamin-live\/egzamin\/([^/]+)$/))) {
    toTab("ExamTab", "ExamPlay", { examId: m[1], subjectId: "" });
  } else if (/^\/dashboard\/egzamin-live/.test(p) || /^\/darmowy-arkusz/.test(p) || /^\/arkusze/.test(p)) {
    toTab("ExamTab", "ExamSelector");
  } else if ((m = p.match(/^\/diagnoza(?:\/([^/]+))?$/))) {
    const subjectSlug = m[1] && m[1] !== "wynik" ? m[1] : undefined;
    toTab("HomeTab", "Diagnosis", subjectSlug ? { subjectSlug } : undefined);
  } else if (/^\/dashboard\/(sesja|quiz|zadania|pisanie|wypracowania)/.test(p)) {
    toTab("QuizTab", "QuizSetup");
  } else if (/^\/dashboard\/sluchanie/.test(p)) {
    toTab("ListeningTab", "ListeningHubTab");
  } else if (/^\/dashboard\/(subskrypcja|premium)/.test(p) || /^\/cennik/.test(p)) {
    toTab("ProfileTab", "Subscription");
  } else if (/^\/dashboard\/powiadomienia/.test(p)) {
    toTab("HomeTab", "Notifications");
  } else if (/^\/dashboard\/profil/.test(p)) {
    toTab("ProfileTab", "ProfileMain");
  } else {
    // „/dashboard”, „/” i wszystko nieznane — pulpit.
    toTab("HomeTab", "Dashboard");
  }
  return true;
}
