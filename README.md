# Carmen Mobile Asset

Cross-platform mobile app (iOS + Android) for hotel/restaurant staff to perform physical asset counts. Built with Expo + TypeScript.

## Quick start

```bash
npm install
npx expo start
```

## Scripts

| Command             | What it does               |
| ------------------- | -------------------------- |
| `npm test`          | Run Jest tests             |
| `npm run lint`      | ESLint over the project    |
| `npm run typecheck` | TypeScript no-emit compile |
| `npm run format`    | Format with Prettier       |

## Per-customer builds

Configuration is selected at build time via the `APP_CUSTOMER` env variable:

```bash
APP_CUSTOMER=acme-hotel npx expo run:ios
```

Customer configs live in `src/platform/config/`.

## Layout

```
app/             expo-router routes (tab bar, screens)
src/
  ui/            presentational components
  features/      per-domain modules (auth, asset, count, …) — added in later plans
  data/          persistence + networking — added in later plans
  platform/      config, i18n, secure storage, camera, netinfo
```

## Design & plans

- Design spec: `docs/superpowers/specs/`
- Implementation plans: `docs/superpowers/plans/`
