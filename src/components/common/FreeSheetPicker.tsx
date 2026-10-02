// ============================================================================
// FreeSheetPicker — wybór przedmiotu (i poziomu) darmowego arkusza
// src/components/common/FreeSheetPicker.tsx
//
// Port /darmowy-arkusz → /darmowy-arkusz/<przedmiot> → /odbierz z webu
// (29.09.2026): najpierw przedmiot, potem poziom (tylko gdy są dwa) z budową
// arkusza, a przycisk „Odbierz darmowy arkusz z <przedmiotu> →” odbiera
// ofertę i od razu otwiera arkusz — bez drugiego wyboru w katalogu.
//
// Lista to GET /api/public/free-sheet — tylko przedmioty i poziomy, które mają
// dziś arkusze w puli oferty, więc wybór nie spali jedynej oferty na
// przedmiocie bez arkuszy. Konto, które ma już przypięty arkusz (examId),
// w ogóle tu nie trafia — FreePanel/TrialOfferCard pokazują wtedy sam stan.
// ============================================================================

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { radius } from "../../theme";
import { claimTrial, type TrialStatus } from "../../api/premium";
import {
  getFreeSheet,
  findFreeExam,
  subjectName,
  subjectIcon,
  subjectFrom,
  ctaClaim,
  formatThousands,
  arkuszeWord,
  punktyWord,
  COUNT_MIN_SHOWN,
  examLoc,
  LEVEL_SHORT,
  LEVEL_LABEL,
  LEVEL_LOC,
  FS_NOTE_CLAIMABLE,
  FS_PICK_TITLE,
  FS_PICK_BACK,
  type FreeSheetSubject,
  type FreeLevel,
} from "../../lib/freeSheet";

const FREE_PACK_CODE = "FREE_PACK_USED_NETWORK";
const cleanPart = (name: string) => name.replace(/^(Część|Part|Arkusz)\s*[IVX\d]+\.\s*/i, "");

export function FreeSheetPicker({
  visible,
  onClose,
  trial,
  trigger,
  onFreePackBlocked,
}: {
  visible: boolean;
  onClose: () => void;
  /** Stan oferty: aktywna (odebrana, bez arkusza) → bez ponownego claim. */
  trial: TrialStatus | null;
  trigger: string;
  /** Claim odbity FREE_PACK_USED_NETWORK — rodzic przełącza się na komunikat. */
  onFreePackBlocked?: () => void;
}) {
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState<FreeSheetSubject[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [picked, setPicked] = useState<FreeSheetSubject | null>(null);
  const [level, setLevel] = useState<FreeLevel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPicked(null);
    setError(null);
    setLoadError(false);
    getFreeSheet()
      .then((s) => {
        setSubjects(s);
        // Jeden przedmiot w marce — od razu jego ekran.
        if (s.length === 1) pick(s[0]);
      })
      .catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pick = (s: FreeSheetSubject) => {
    setPicked(s);
    setLevel(s.levels[0]?.level ?? null);
    setError(null);
  };

  const goExamTab = (screen: string, params?: any) => {
    const parent = navigation.getParent?.();
    (parent ?? navigation).navigate("ExamTab", { screen, params });
  };

  const onClaim = async () => {
    if (!picked || !level) return;
    setBusy(true);
    setError(null);
    try {
      // Oferta odebrana wcześniej (bez arkusza) — nie wołamy claim drugi raz.
      if (!trial?.active) {
        try {
          await claimTrial(`${trigger}:${picked.slug}`.slice(0, 60), picked.slug);
        } catch (e: any) {
          if (e?.code === FREE_PACK_CODE || e?.data?.code === FREE_PACK_CODE) {
            onClose();
            onFreePackBlocked?.();
            return;
          }
          // ALREADY_CLAIMED — oferta już jest, idziemy dalej do arkusza.
          if (e?.code !== "ALREADY_CLAIMED") {
            setError(e?.message || "Nie udało się odebrać darmowego arkusza.");
            return;
          }
        }
      }
      const found = await findFreeExam(picked, level).catch(() => null);
      onClose();
      if (found) {
        goExamTab("ExamPlay", { examId: found.examId, subjectId: found.subjectId });
      } else {
        // Oferta odebrana, ale arkusza nie udało się otworzyć samoczynnie —
        // katalog Egzaminu Live pokaże przedmioty z ofertą.
        goExamTab("ExamSelector");
      }
    } finally {
      setBusy(false);
    }
  };

  const lv = picked?.levels.find((l) => l.level === level) ?? null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          {picked && subjects && subjects.length > 1 ? (
            <TouchableOpacity onPress={() => setPicked(null)} hitSlop={12}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.brand[500] }}>
                {FS_PICK_BACK}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 22, color: theme.textSecondary }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
        >
          {!subjects && !loadError && (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand[500]} />
          )}
          {loadError && (
            <Text style={{ marginTop: 40, textAlign: "center", color: theme.textSecondary }}>
              Nie udało się pobrać listy przedmiotów. Sprawdź połączenie i spróbuj ponownie.
            </Text>
          )}

          {subjects && !picked && (
            <>
              <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text, marginBottom: 6 }}>
                {FS_PICK_TITLE}
              </Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 18, lineHeight: 19 }}>
                {FS_NOTE_CLAIMABLE}
              </Text>
              {subjects.length === 0 && (
                <Text style={{ color: theme.textSecondary }}>
                  Darmowe arkusze są teraz niedostępne. Spróbuj później.
                </Text>
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {subjects.map((s) => (
                  <TouchableOpacity
                    key={s.slug}
                    onPress={() => pick(s)}
                    style={{
                      width: "48%",
                      flexGrow: 1,
                      padding: 14,
                      borderRadius: radius["2xl"],
                      borderWidth: 1,
                      borderColor: theme.cardBorder,
                      backgroundColor: theme.card,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>{subjectIcon(s)}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: theme.text, textAlign: "center" }}>
                      {subjectName(s)}
                    </Text>
                    {s.levels.length > 1 || s.levels[0]?.level === "ROZSZERZONY" ? (
                      <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
                        {s.levels.map((l) => (
                          <View
                            key={l.level}
                            style={{
                              paddingHorizontal: 7,
                              paddingVertical: 1,
                              borderRadius: 6,
                              backgroundColor: theme.backgroundSecondary,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary }}>
                              {LEVEL_SHORT[l.level]}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {s.count >= COUNT_MIN_SHOWN && (
                      <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 5 }}>
                        {formatThousands(s.count)} {arkuszeWord(s.count)} w bazie
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {picked && (
            <>
              <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 6 }}>
                {subjectIcon(picked)}
              </Text>
              <Text
                style={{ fontSize: 24, fontWeight: "800", color: theme.text, textAlign: "center", marginBottom: 6 }}
              >
                Darmowy arkusz {subjectFrom(picked)}
              </Text>
              <Text
                style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", marginBottom: 18, lineHeight: 19 }}
              >
                Pełny arkusz — zadanie po zadaniu, z punktacją według klucza i oceną zadań otwartych według kryteriów CKE.
                Bez zegara: możesz przerwać i wrócić.
              </Text>

              {picked.levels.length > 1 ? (
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                  {picked.levels.map((l) => {
                    const on = l.level === level;
                    return (
                      <TouchableOpacity
                        key={l.level}
                        onPress={() => setLevel(l.level)}
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: radius.xl,
                          borderWidth: 2,
                          borderColor: on ? colors.brand[500] : theme.border,
                          backgroundColor: on ? colors.brand[500] + "14" : "transparent",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
                          {LEVEL_SHORT[l.level]}
                        </Text>
                        <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                          {LEVEL_LABEL[l.level]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : level === "ROZSZERZONY" ? (
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, textAlign: "center", marginBottom: 12 }}>
                  Dostępny poziom: {LEVEL_LABEL[level]}
                </Text>
              ) : null}

              {lv && (
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", marginBottom: 10, lineHeight: 19 }}>
                    Budowa jak {examLoc(picked)}
                    {picked.levels.length > 1 || lv.level === "ROZSZERZONY" ? ` ${LEVEL_LOC[lv.level]}` : ""}:{" "}
                    <Text style={{ fontWeight: "800", color: theme.text }}>
                      {lv.maxPoints} {punktyWord(lv.maxPoints)}
                    </Text>
                    . Na egzaminie masz na to{" "}
                    <Text style={{ fontWeight: "800", color: theme.text }}>{lv.timeMinutes} minut</Text>
                    {" "}— darmowy arkusz rozwiązujesz bez zegara.
                  </Text>
                  <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radius.xl }}>
                    {lv.parts.map((p, i) => (
                      <View
                        key={p.name + i}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: theme.border,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 13, color: theme.text }}>{cleanPart(p.name)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text }}>{p.maxPoints} pkt</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={onClaim}
                disabled={busy || !level}
                style={{
                  backgroundColor: colors.brand[500],
                  opacity: busy ? 0.7 : 1,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: radius.xl,
                  alignItems: "center",
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center" }}>
                    {ctaClaim(picked)}
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: "center", marginTop: 10, lineHeight: 18 }}>
                {FS_NOTE_CLAIMABLE}
              </Text>
              {error && (
                <Text style={{ fontSize: 12, color: colors.red[500], textAlign: "center", marginTop: 8 }}>
                  {error}
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
