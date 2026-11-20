# Gastos Gang

Gastos Gang is a personal, offline-first expense logger built with Expo, React Native, and TypeScript. The app is designed for one-tap expense entry and runs in Expo Go.

## Development

```bash
npm install
npx expo start
```

Quality checks:

```bash
npm run lint
npx tsc --noEmit
npm test
```

## Architecture decisions

- Routes live in `src/app` and stay thin; feature logic belongs in `src/features`.
- Expense data will use SQLite as its source of truth. Zustand is limited to lightweight UI and settings state.
- Money is represented as integer centavos throughout the app.
- Stored timestamps will use epoch milliseconds. Display and day grouping will use the device's local timezone.
- Charts will begin with dependency-free React Native views; a chart package will only be added if Phase 4 needs it.

The project is being delivered in verified phases. The full setup, usage, and troubleshooting guide will be completed during Phase 6.
