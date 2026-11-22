<p align="center">
<<<<<<< HEAD
  <img src="assets/images/gg-shaka-icon.png" width="120" alt="Official Gastos Gang logo">
=======
  <img src="assets/images/GG Shaka LOGO.png" width="120" alt="Official Gastos Gang logo">
>>>>>>> 7ba94450d234e324712b0f640e887a3c452f2db8
</p>

# Gastos Gang

**Track your gastos. Know where your money goes.**

Gastos Gang is an offline-first personal expense tracker. Log an expense with a few taps, review your spending, and manage a daily budget without an account or internet connection.

## Download for Android

**[Download Gastos Gang v1.0.0 Beta 2 for Android](https://github.com/accelvivas/gastos-gang/releases/download/v1.0.0-beta.2/GastosGang-v1.0.0-beta.2.apk)** · Android 7.0+

This is a beta release. See the [release notes](https://github.com/accelvivas/gastos-gang/releases/tag/v1.0.0-beta.2) for details.

1. Download the APK attached to an official Gastos Gang release.
2. Open the downloaded file. If Android prompts you, allow installation from the trusted app you used to open it.
3. Finish installation and launch **Gastos Gang**. The standalone app runs without Expo Go or Metro.

## Features

| Screen | What you can do |
| --- | --- |
| Entry | Enter an amount on the keypad, add an optional note, and tap a category to save. See today's spending and undo a recent save. |
| History | Browse expenses by day, search notes and categories, filter by date or category, and edit or delete entries. |
| Summary | Compare weekly and monthly spending, explore category and daily charts, and see spending insights. Future expenses count once their scheduled time arrives. |
| Settings | Manage categories, set a daily budget, switch between light, dark, and system appearance, export CSV, and create or restore JSON backups. |

## Privacy and backups

Expenses are stored in a local SQLite database. The app has no sign-in requirement or cloud sync. Uninstalling the app or switching phones can leave you without your records, so keep a current JSON backup outside the app. JSON backups can be restored in Settings. CSV exports are for spreadsheets.

SQLite has no app-level encryption, and exported JSON and CSV files contain readable financial information. Keep exports somewhere private. Restore replaces the current dataset and requires a safety backup and confirmation.

## Development

Use Node.js 22.13+ on the 22.x line or Node.js 24.3+ on the 24.x line, with npm. Install from the lockfile and start Expo.

```bash
npm ci
npx expo start
```

Open the project in an Expo Go version compatible with SDK 58. In Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is restricted.

```bash
npx expo install --check
npx --yes expo-doctor@latest
npx tsc --noEmit
npx eslint .
npx jest --runInBand
```

## Stack and project layout

Expo SDK 58, React Native, TypeScript, Expo Router, Expo SQLite, Zustand, Reanimated, Gesture Handler, and React Native Gifted Charts. Jest and React Native Testing Library cover application behavior, with isolated SQLite databases for repository tests.

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router layouts and routes |
| `src/features/` | Entry, History, Summary, Settings, and expense editing |
| `src/db/`, `src/repositories/` | SQLite initialization, migrations, and queries. Amounts are stored as integer centavos. |
| `src/components/`, `src/theme/` | Shared UI, branding, startup animation, and theme tokens |
| `tests/` | Component, SQLite, and regression tests |

## Build from source

The EAS profiles in [eas.json](eas.json) produce a standalone APK for preview distribution and an Android App Bundle for production. For the linked Expo project, sign in with an authorized EAS account and run:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

The Android package is `com.accelvivas.gastosgang`. The app version is `1.0.0`, with Android version code `2`. Increase the version code before each subsequent distributed build and keep the same package ID and signing key so Android can install updates over existing data. Keep signing credentials out of Git and manage them through EAS.

## Known limitations

- Offline tracking is local to the device. Use JSON backup and restore to move records between devices.
- Local export creation works offline. Sharing to an online destination depends on that service and the device's connectivity.

## License

[MIT](LICENSE)
