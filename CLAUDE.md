# matury-online-mobile

## Wydanie do Sklepu Play — checklista (OBOWIĄZKOWA, każdy punkt)

1. Podbij wersję w **dwóch** miejscach: `app.json` (`version`, `android.versionCode`)
   i `android/app/build.gradle` (`versionCode`, `versionName`) — gradle czyta tylko ten drugi.
2. Commit `wydanie X.Y.Z (N): …`.
3. Build **lokalnie**: `cd android && ./gradlew bundleRelease` (~2 min) →
   `android/app/build/outputs/bundle/release/app-release.aab`. Nigdy `eas build` (chmura, kolejka).
4. Wysyłka (tylko upload gotowego pliku, bez budowania):
   `npx eas-cli submit --platform android --profile production --path android/app/build/outputs/bundle/release/app-release.aab --non-interactive`
5. **Synchronizacja wersji w bazie jest AUTOMATYCZNA (od 24.09.2026):** cron `app-version-watch`
   na serwerze `matury` (co godzinę, minuta 17, `~/bin/app-version-watch.sh`, log
   `~/logs/app-version-watch.log`) czyta wersję z publicznej strony Sklepu Play — widoczną dopiero
   po zatwierdzeniu przez Google — i podnosi `app_version:matury-mobile:latest` (także zdaj i osmo).
   Nic nie trzeba robić. Po wysyłce sprawdź następnego dnia log, czy wersja się podniosła.
   Ręcznie (awaryjnie), gdy wersja jest już w sklepie:

   ```bash
   bash D:/tools/app-version-sync.sh matury            # czyta tor production z Play API i zapisuje
   bash D:/tools/app-version-sync.sh matury --dry-run  # tylko podgląd
   ```

   Nie uruchamiaj ręcznie przed zatwierdzeniem przez Google — okienko „Jest nowa wersja”
   odsyłałoby do sklepu bez aktualizacji.
