// ============================================================================
// Push notifications (Expo Push Service) — rejestracja tokenu + routing tapów
// ----------------------------------------------------------------------------
// Zasady:
// - O zgodę systemową NIE pytamy na starcie apki, tylko w momencie wartości
//   (pierwszy ukończony quiz/egzamin) — askForPushPermissionOnce(). Android 13+
//   pyta systemowo tylko raz, więc nie palimy tej szansy na cold-starcie.
// - syncPushRegistration() woła się przy każdym zalogowanym starcie: odświeża
//   token na backendzie (lastSeenAt) bez pytania o cokolwiek.
// - Lazy importy natywnych modułów — stare buildy bez expo-notifications nie
//   mogą się wywalić na require (patrz lekcja z expo-store-review).
// ============================================================================

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { api } from "../api/client";
import { navigate } from "../navigation/navigationRef";

const ASKED_KEY = "mo_push_perm_asked";
let cachedPushToken: string | null = null;

async function getNotifications() {
  return await import("expo-notifications");
}

async function ensureAndroidChannel(
  Notifications: Awaited<ReturnType<typeof getNotifications>>,
): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Powiadomienia",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function fetchAndRegisterToken(
  Notifications: Awaited<ReturnType<typeof getNotifications>>,
): Promise<void> {
  await ensureAndroidChannel(Notifications);
  const projectId: string | undefined = (Constants as any)?.expoConfig?.extra
    ?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  cachedPushToken = tokenData.data;
  await api("/push/register", {
    method: "POST",
    body: { token: cachedPushToken, platform: Platform.OS },
  });
}

/** Cichy sync przy zalogowanym starcie — tylko gdy zgoda już wyrażona. */
export async function syncPushRegistration(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== "granted") return;
    await fetchAndRegisterToken(Notifications);
  } catch {
    // push jest opcjonalny — brak modułu/Play Services = po prostu nic
  }
}

/**
 * Jednorazowa prośba o zgodę — wołana po pierwszym ukończonym quizie /
 * egzaminie (moment wartości). Flaga w SecureStore pilnuje jednorazowości
 * niezależnie od decyzji.
 */
export async function askForPushPermissionOnce(): Promise<void> {
  try {
    const asked = await SecureStore.getItemAsync(ASKED_KEY);
    if (asked) return;
    await SecureStore.setItemAsync(ASKED_KEY, "1");

    const Notifications = await getNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") {
      await fetchAndRegisterToken(Notifications);
      return;
    }
    if (!current.canAskAgain) return;

    const res = await Notifications.requestPermissionsAsync();
    if (res.status === "granted") {
      await fetchAndRegisterToken(Notifications);
    }
  } catch {}
}

/** Przy wylogowaniu — odepnij token od konta (wołać PRZED clearToken). */
export async function unregisterPush(): Promise<void> {
  try {
    if (!cachedPushToken) {
      const Notifications = await getNotifications();
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== "granted") return;
      const projectId: string | undefined = (Constants as any)?.expoConfig
        ?.extra?.eas?.projectId;
      cachedPushToken = (
        await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        )
      ).data;
    }
    await api("/push/unregister", {
      method: "POST",
      body: { token: cachedPushToken },
    });
  } catch {}
}

/**
 * Handler zachowania w foreground + routing tapnięć. Wołane raz z App.tsx.
 * Zwraca cleanup.
 */
export function setupNotificationHandlers(): () => void {
  let cleanup: (() => void) | null = null;

  (async () => {
    try {
      const Notifications = await getNotifications();

      // W foreground pokazuj banner (domyślnie Android nic nie pokazuje)
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const routeFromData = (data: any) => {
        if (data?.type === "exam_graded" && data.attemptId) {
          navigate("Main", {
            screen: "ExamTab",
            params: {
              screen: "ExamResults",
              params: { attemptId: String(data.attemptId) },
            },
          });
        }
      };

      const sub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          routeFromData(response.notification.request.content.data);
        },
      );

      // Cold start z tapnięcia w powiadomienie
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) routeFromData(last.notification.request.content.data);

      cleanup = () => sub.remove();
    } catch {}
  })();

  return () => cleanup?.();
}
