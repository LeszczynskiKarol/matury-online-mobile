#!/usr/bin/env node
// Podgląd na żywo na telefonie po USB (wariant debug `.dev`, obok apki ze Sklepu).
//
//   npm run phone          — API produkcyjne (konta testowe, prawdziwe dane)
//   npm run phone:local    — API lokalne (localhost:3000, wymaga backendu)
//
// Co robi: przekierowuje porty telefonu na komputer (adb reverse) i startuje
// Metro. Apka „Matury DEV" pobiera kod z Metro — zmiana w pliku .tsx widoczna
// na telefonie po 1–2 s (Fast Refresh), bez buildu. Build potrzebny tylko przy
// zmianach natywnych: `npx expo run:android --variant debug`.
const { spawnSync } = require("child_process");
const local = process.argv.includes("--local");

const adb = (args) => {
  const r = spawnSync("adb", args, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error("\nadb nie widzi telefonu — podłącz kabel i zaakceptuj debugowanie USB.");
    process.exit(1);
  }
};
adb(["reverse", "tcp:8081", "tcp:8081"]);
if (local) adb(["reverse", "tcp:3000", "tcp:3000"]);

const env = { ...process.env };
// Tylko tryb deweloperski czyta tę zmienną (src/api/client.ts) — release jej nie widzi.
env.EXPO_PUBLIC_API_URL = local ? "http://localhost:3000" : "https://www.matury-online.pl";
console.log(`\nAPI: ${env.EXPO_PUBLIC_API_URL}\nOtwórz na telefonie „Matury DEV". Zmiany w kodzie pojawią się same.\n`);
spawnSync("npx", ["expo", "start", "--port", "8081"], { stdio: "inherit", shell: true, env });
