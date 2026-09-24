# matury-online-mobile

## Wydanie do Sklepu Play — checklista (OBOWIĄZKOWA, każdy punkt)

1. Podbij wersję w **dwóch** miejscach: `app.json` (`version`, `android.versionCode`)
   i `android/app/build.gradle` (`versionCode`, `versionName`) — gradle czyta tylko ten drugi.
2. Commit `wydanie X.Y.Z (N): …`.
3. Build **lokalnie**: `cd android && ./gradlew bundleRelease` (~2 min) →
   `android/app/build/outputs/bundle/release/app-release.aab`. Nigdy `eas build` (chmura, kolejka).
4. Wysyłka (tylko upload gotowego pliku, bez budowania):
   `npx eas-cli submit --platform android --profile production --path android/app/build/outputs/bundle/release/app-release.aab --non-interactive`
5. **Gdy wersja jest już widoczna w Sklepie Play** — zsynchronizuj wersję w bazie,
   inaczej podpowiedź „Jest nowa wersja” (`UpdatePrompt`) nie pokaże się nikomu:

   ```bash
   bash D:/tools/app-version-sync.sh matury            # czyta tor production z Play API i zapisuje
   bash D:/tools/app-version-sync.sh matury --dry-run  # tylko podgląd
   ```

   Ustawia `app_version:matury-mobile:latest` w tabeli `Setting` (serwer `matury`, baza `matury_online`,
   wspólny backend `/api/app/version-policy`). Nie uruchamiaj przed zatwierdzeniem przez Google —
   okienko odsyłałoby do sklepu bez aktualizacji. Wydanie bez tego kroku jest NIEDOKOŃCZONE:
   po wysyłce zawsze przypomnij Karolowi i dopytaj, czy wersja już jest w sklepie.
