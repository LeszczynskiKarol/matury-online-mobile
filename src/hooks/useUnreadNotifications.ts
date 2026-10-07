// Licznik nieprzeczytanych powiadomień przy dzwonku na pulpicie
// (Centrum komunikatów, 7.10.2026). Odświeżany przy każdym wejściu na ekran;
// błąd sieci = 0, bez komunikatu.
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { listNotifications } from "../api/notifications";

export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listNotifications({ limit: 20 })
        .then((page) => {
          if (alive) setUnread(page.unreadCount ?? page.items.filter((i) => !i.isRead).length);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  return unread;
}
