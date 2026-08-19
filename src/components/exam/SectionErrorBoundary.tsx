// =============================================================================
// SectionErrorBoundary — izolacja błędów renderowania w obrębie ekranu egzaminu
//
// Do 2026-08-19 apka miała TYLKO AppErrorBoundary (App.tsx). Pojedynczy wyjątek
// w rendererze materiału (np. `content` będący obiektem zamiast stringa —
// geografia PR #11) wywalał całą aplikację na ekran „Aplikacja uległa awarii"
// i wyrzucał ucznia ze zdawanego egzaminu.
//
// Tu izolujemy pojedynczą sekcję: psuje się jeden materiał, a reszta arkusza —
// nawigacja, timer, autozapis odpowiedzi — działa dalej.
//
// UWAGA (błąd popełniony na webie i tu naprawiony od razu): boundary MUSI się
// resetować przy zmianie zadania. React zachowuje instancję komponentu przy
// nawigacji, więc bez `resetKey` jedna awaria blokowała sekcję do końca arkusza.
// =============================================================================

import React from "react";
import { View, Text } from "react-native";

interface Props {
  label: string;
  /** Zmiana tej wartości czyści stan błędu (np. id zadania albo id materiału). */
  resetKey?: string;
  theme: any;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error(
      `[ExamPlayer] render sekcji "${this.props.label}" nie powiódł się`,
      error?.message,
      info?.componentStack,
    );
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children as any;
    const theme = this.props.theme || {};
    return (
      <View
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#f59e0b55",
          backgroundColor: "#f59e0b18",
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: theme.text || "#f4f4f5",
            marginBottom: 4,
          }}
        >
          Nie udało się wyświetlić: {this.props.label}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary || "#a1a1aa" }}>
          Zgłosiliśmy problem. Możesz rozwiązywać dalej — Twoje odpowiedzi są
          zapisywane normalnie.
        </Text>
      </View>
    );
  }
}
