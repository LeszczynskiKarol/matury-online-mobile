# Matury Online — Aplikacja Mobilna (React Native / Expo)

Aplikacja mobilna do platformy matury-online.pl, spójna wizualnie z wersją webową.
Korzysta z tego samego backendu Fastify/Prisma/PostgreSQL.

## Stack

- **Expo SDK 52** (managed workflow)
- **React Navigation 7** — bottom tabs + native stacks
- **Expo Secure Store** — bezpieczne przechowywanie tokenu JWT
- **Expo Font** — Outfit, DM Sans, JetBrains Mono (identyczne z web)
- **TypeScript** strict

## Architektura

```
src/
├── api/          # HTTP client + moduły API (auth, subjects, questions, sessions)
├── components/   # Reusable UI (Button, Input, Card, Badge, OptionCard, ProgressBar)
├── context/      # React Context (Auth, Theme)
├── navigation/   # React Navigation (Root, Auth, Main tabs + nested stacks)
├── screens/      # Ekrany (auth/*, home/*, subjects/*, quiz/*, profile/*)
└── theme/        # Design tokens (colors, typography, spacing, radius, shadows)
```

## Design System

Kolory, fonty, border-radius, cienie — 1:1 z `tailwind.config.mjs` i `global.css` z wersji webowej.
Dark mode obsługiwany przez `ThemeContext` (system / manual toggle).

## Konfiguracja

### 1. API URL

Edytuj `src/api/client.ts` → `API_BASE_URL`:

```typescript
const API_BASE_URL = __DEV__
  ? 'http://192.168.0.100:3000'   // ← Twój lokalny IP
  : 'https://www.matury-online.pl';
```

### 2. CORS na backendzie

Backend (`app.ts`) ma `origin: true` — akceptuje wszystkie originy.
Dla mobile requests nie są wysyłane z przeglądarki, więc CORS nie blokuje.

### 3. Google OAuth

Wymaga konfiguracji `expo-auth-session` z Google Cloud Console.
Na razie placeholder — do dokończenia po stronie Google Console.

## Start

```bash
# Zainstaluj zależności
npm install

# Uruchom Expo dev server
npx expo start

# Skanuj QR kodem z Expo Go (Android/iOS)
# lub naciśnij 'a' dla Android emulatora, 'i' dla iOS symulatora
```

## Ekrany

| Ekran | Opis |
|-------|------|
| **Login** | Email/hasło + Google OAuth |
| **Register** | Rejestracja z walidacją siły hasła |
| **Verify** | 6-cyfrowy kod weryfikacyjny email |
| **Dashboard** | Statystyki, cel dnia, postęp przedmiotów, ostatnie sesje |
| **Subjects** | Lista przedmiotów z progress barami |
| **SubjectDetail** | Tematy + quick start quiz |
| **QuizSetup** | Wybór przedmiotu, trybu, liczby pytań |
| **QuizPlay** | Pytania (CLOSED, TRUE_FALSE, OPEN + fallback), submit, feedback |
| **QuizResult** | Podsumowanie sesji — accuracy, XP, czas |
| **Profile** | Dane użytkownika, plan, dark mode toggle, logout |

## Typy pytań obsługiwane w QuizPlay

- ✅ CLOSED (ABCD)
- ✅ TRUE_FALSE
- ✅ OPEN / ESSAY (textarea)
- 🔜 MULTI_SELECT, MATCHING, ORDERING, ERROR_FIND, WIAZKA, TABLE_DATA, GRAPH_INTERPRET, CLOZE, LISTENING

(do rozbudowy — dodaj renderery w `screens/quiz/QuizPlayScreen.tsx`)

## TODO

- [ ] Google OAuth via expo-auth-session
- [ ] Push notifications (expo-notifications)
- [ ] Stripe checkout (WebView)
- [ ] Spaced repetition (Review) screen
- [ ] Essay submission screen
- [ ] Achievements / gamification screen
- [ ] Offline cache (AsyncStorage + queue)
- [ ] App Store / Play Store assets (icon, splash, screenshots)
- [ ] KaTeX rendering for math formulas (react-native-webview)

## Ikony / Assets

Placeholder — dodaj:
- `assets/icon.png` (1024×1024)
- `assets/splash.png` (1284×2778)
- `assets/adaptive-icon.png` (1024×1024)
