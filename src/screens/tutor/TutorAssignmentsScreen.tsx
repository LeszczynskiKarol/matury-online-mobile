// ============================================================================
// Zadania od korepetytora — lista (strona ucznia)
// Lustro webowego StudentAssignments.tsx. Dane: GET /api/tutor/my.
// ============================================================================

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Card } from "../../components/ui/Card";
import { colors } from "../../theme/colors";
import { spacing, radius } from "../../theme";
import {
  getMyAssignments,
  KIND_LABEL,
  type MyAssignment,
  type MyAssignmentsResponse,
} from "../../api/tutor";
import { setEmailPrefs } from "../../api/auth";
import { ApiError } from "../../api/client";

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function scoreColor(pct: number | null | undefined) {
  if (pct == null) return colors.zinc[500];
  return pct >= 70 ? colors.brand[500] : pct >= 40 ? colors.orange[500] : colors.red[500];
}

export function Pill({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg?: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.full ?? 999,
        backgroundColor: bg ?? color + "18",
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: "DMSans_600SemiBold", color }}>{label}</Text>
    </View>
  );
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "do zrobienia", color: colors.zinc[500] },
  IN_PROGRESS: { label: "w trakcie", color: colors.orange[500] },
  DONE: { label: "zrobione", color: colors.brand[500] },
};

export function TutorAssignmentsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: theme } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<MyAssignmentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getMyAssignments();
      setData(r);
      setError(null);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Nie udało się pobrać zadań.");
    }
  }, []);

  // Po powrocie z quizu / arkusza lista ma pokazać świeży status.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleEmail = async (v: boolean) => {
    if (!data) return;
    const prev = data.emailNotify;
    setData({ ...data, emailNotify: v });
    setEmailBusy(true);
    try {
      await setEmailPrefs({ emailTutorZone: v });
    } catch {
      setData((d) => (d ? { ...d, emailNotify: prev } : d));
    } finally {
      setEmailBusy(false);
    }
  };

  const todo = data?.assignments.filter((a) => a.status !== "DONE") ?? [];
  const done = data?.assignments.filter((a) => a.status === "DONE") ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: spacing[5],
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />
      }
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontFamily: "Outfit_700Bold", color: theme.text, flex: 1 }}>
          Zadania od korepetytora
        </Text>
      </View>
      {data && data.tutors.length > 0 && (
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 18, marginLeft: 34 }}>
          {data.tutors
            .map((t) => `${t.displayName}${t.hasSeat ? ` · dostęp do ${fmtDate(t.seatEnd)}` : ""}`)
            .join(" · ")}
        </Text>
      )}

      {!data && !error && (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
        </View>
      )}

      {error && (
        <Card style={{ borderColor: colors.red[500] + "60", marginTop: 12 }}>
          <Text style={{ color: colors.red[500], fontSize: 14 }}>{error}</Text>
        </Card>
      )}

      {data && data.tutors.length === 0 && (
        <Card style={{ alignItems: "center", marginTop: 12 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>👩‍🏫</Text>
          <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: "center" }}>
            Nie należysz do żadnej grupy. Zaproszenie od korepetytora przychodzi mailem — otwórz link z
            wiadomości.
          </Text>
        </Card>
      )}

      {data && data.tutors.length > 0 && !data.seatActive && !data.ownPremium && (
        <View
          style={{
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: colors.orange[500] + "80",
            backgroundColor: colors.orange[500] + "14",
            padding: spacing[4],
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: theme.text }}>
            <Text style={{ fontFamily: "DMSans_700Bold" }}>Korepetytor nie przydzielił Ci jeszcze miejsca.</Text>{" "}
            Miejsce daje dostęp do rozwiązywania jego zadań — napisz do korepetytora, a gdy je dostaniesz,
            zadania odblokują się same.
          </Text>
        </View>
      )}

      {todo.length > 0 && (
        <Section title={`Do zrobienia (${todo.length})`} theme={theme}>
          {todo.map((a) => (
            <Row key={a.targetId} a={a} theme={theme} onPress={() => navigation.navigate("TutorAssignment", { targetId: a.targetId })} />
          ))}
        </Section>
      )}
      {done.length > 0 && (
        <Section title={`Zrobione (${done.length})`} theme={theme}>
          {done.map((a) => (
            <Row
              key={a.targetId}
              a={a}
              theme={theme}
              onPress={() =>
                a.kind === "EXAM" && a.examAttemptId
                  ? navigation.getParent()?.navigate("ExamTab", {
                      screen: "ExamResults",
                      params: { attemptId: a.examAttemptId },
                    })
                  : navigation.navigate("TutorAssignment", { targetId: a.targetId })
              }
            />
          ))}
        </Section>
      )}
      {data && data.tutors.length > 0 && data.assignments.length === 0 && (
        <Card style={{ alignItems: "center", marginTop: 4 }}>
          <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: "center" }}>
            Korepetytor nie zadał jeszcze niczego.
          </Text>
        </Card>
      )}

      {data && data.tutors.length > 0 && (
        <Card style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: "DMSans_600SemiBold", color: theme.text }}>
              Mail, gdy korepetytor zada coś nowego
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
              Jeden mail zbiorczy, nie osobny do każdego zadania.
            </Text>
          </View>
          <Switch
            value={data.emailNotify !== false}
            onValueChange={toggleEmail}
            disabled={emailBusy}
            trackColor={{ false: colors.zinc[300], true: colors.brand[500] }}
            thumbColor="#fff"
          />
        </Card>
      )}
    </ScrollView>
  );
}

function Section({ title, theme, children }: { title: string; theme: any; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "DMSans_700Bold",
          color: theme.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Row({ a, theme, onPress }: { a: MyAssignment; theme: any; onPress: () => void }) {
  const st = STATUS[a.status] ?? STATUS.PENDING;
  const overdue = !!a.dueAt && a.status !== "DONE" && new Date(a.dueAt) < new Date();
  const generating = a.setStatus === "GENERATING" && a.status !== "DONE";
  const meta = [
    KIND_LABEL[a.kind],
    a.questionCount ? `${a.questionCount} pytań` : null,
    a.dueAt ? `termin ${fmtDate(a.dueAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card variant="stat" style={{ padding: spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 26 }}>{a.subject?.icon ?? "📘"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Outfit_600SemiBold", color: theme.text }} numberOfLines={2}>
              {a.title}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
              {a.tutorName} · {meta}
            </Text>
            {a.note ? (
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }} numberOfLines={2}>
                {a.note}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {generating && <Pill label="pytania w przygotowaniu" color={colors.orange[500]} />}
              {overdue && <Pill label="po terminie" color={colors.red[500]} />}
              <Pill label={st.label} color={st.color} />
              {a.status === "DONE" && a.scorePct != null && (
                <Pill label={`${a.scorePct}%`} color={scoreColor(a.scorePct)} />
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}
