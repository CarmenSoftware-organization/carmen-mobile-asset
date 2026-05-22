# Carmen Mobile Asset — Plan 1: Project Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a navigable Expo + TypeScript app shell — tab bar with placeholder screens, per-customer config, i18n (en + th), and CI running lint + typecheck + tests on every push.

**Architecture:** Expo SDK 51+ (managed workflow). `expo-router` for file-based navigation. Layered folder structure (`ui/`, `features/`, `data/`, `platform/`) with clear boundaries. Per-customer config selected at build time via `APP_CUSTOMER` env. No data layer or auth yet — those land in Plan 2.

**Tech Stack:** Expo SDK 51+, TypeScript 5.x, expo-router, i18next + react-i18next, Jest, @testing-library/react-native, ESLint, Prettier, GitHub Actions.

**Spec reference:** `docs/superpowers/specs/2026-05-22-carmen-mobile-asset-design.md` §§ 3, 4, 11.

---

## File structure

After this plan runs, the project layout is:

```
.
├── app/                          # expo-router file-based routes
│   ├── _layout.tsx               # root layout (i18n + theme providers)
│   ├── (tabs)/
│   │   ├── _layout.tsx           # tab bar
│   │   ├── index.tsx             # Home tab (placeholder)
│   │   ├── scan.tsx              # Scan tab (placeholder)
│   │   ├── documents.tsx         # Documents tab (placeholder)
│   │   └── more.tsx              # More tab (placeholder)
│   └── +not-found.tsx
├── src/
│   ├── platform/
│   │   ├── config/
│   │   │   ├── index.ts          # loadConfig(), default config
│   │   │   ├── types.ts          # CustomerConfig type
│   │   │   ├── config.default.ts # default customer config
│   │   │   └── __tests__/
│   │   │       └── config.test.ts
│   │   └── i18n/
│   │       ├── index.ts          # i18n init, useT() hook
│   │       ├── locales/
│   │       │   ├── en.json
│   │       │   └── th.json
│   │       └── __tests__/
│   │           └── i18n.test.ts
│   ├── ui/
│   │   └── Header.tsx            # top header with title + (placeholder) sync indicator
│   ├── features/                 # empty for now (placeholder README)
│   └── data/                     # empty for now (placeholder README)
├── app.config.ts                 # Expo dynamic config (reads APP_CUSTOMER)
├── babel.config.js
├── tsconfig.json
├── jest.config.ts
├── jest.setup.ts
├── eslint.config.mjs
├── .prettierrc
├── .github/workflows/ci.yml
├── package.json
└── README.md
```

Each `platform/*` module owns one concern (config or i18n). `src/features/` and `src/data/` get scaffolded with `README.md` files explaining the layer boundaries so Plan 2 has a place to land.

---

## Task 1: Initialize Expo project with TypeScript

**Files:**
- Create: `package.json`, `app.json`, `App.tsx` (will be replaced in Task 4), `tsconfig.json`, `babel.config.js`, `.gitignore` (additive merge)

- [ ] **Step 1: Initialize Expo project in current directory**

The project root already contains `.git`, `docs/`, `.gitignore`. We need to scaffold an Expo project alongside.

Run:
```bash
npx create-expo-app@latest . --template blank-typescript --no-install
```

If prompted, confirm overwriting only files we don't already own. Expected: scaffold writes `package.json`, `App.tsx`, `app.json`, `tsconfig.json`, `babel.config.js`, `assets/`. **Do not let it overwrite our `.gitignore`** — if it does, restore our entries (`.superpowers/`, `.playwright-mcp/`, `poc-home.png`).

- [ ] **Step 2: Merge .gitignore additions**

After init, ensure `.gitignore` contains both the Expo defaults and our existing entries. Open `.gitignore` and confirm it contains at minimum:
```
node_modules/
.expo/
dist/
.env*.local
ios/
android/
.superpowers/
.playwright-mcp/
poc-home.png
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install
```

Expected: completes with no errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: exits 0, no output. (A working bundle is verified later in Task 7 via `expo export`.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold expo + typescript project"
```

---

## Task 2: Configure ESLint and Prettier

**Files:**
- Create: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
- Modify: `package.json` (add scripts + devDependencies)

- [ ] **Step 1: Install lint/format toolchain**

Run:
```bash
npm install --save-dev eslint@^9 @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-native prettier eslint-config-prettier eslint-plugin-prettier
```

Expected: installs cleanly.

- [ ] **Step 2: Create ESLint flat config**

Create `eslint.config.mjs`:

```js
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactNativePlugin from 'eslint-plugin-react-native';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'ios/', 'android/', 'docs/', '.playwright-mcp/', '.superpowers/'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { __DEV__: 'readonly' },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prettier/prettier': 'error',
    },
    settings: { react: { version: 'detect' } },
  },
  prettierConfig,
];
```

- [ ] **Step 3: Create Prettier config**

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always"
}
```

Create `.prettierignore`:
```
node_modules/
.expo/
dist/
ios/
android/
docs/
package-lock.json
.playwright-mcp/
.superpowers/
```

- [ ] **Step 4: Add npm scripts**

Edit `package.json` and add these entries to `scripts`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix",
"format": "prettier --write .",
"format:check": "prettier --check .",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Run lint to verify config works**

Run:
```bash
npm run lint
```

Expected: exits 0 (the only `.ts`/`.tsx` file is `App.tsx` which is clean).

Run:
```bash
npm run format:check
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs .prettierrc .prettierignore package.json package-lock.json
git commit -m "chore: configure eslint + prettier"
```

---

## Task 3: Configure Jest and React Native Testing Library

**Files:**
- Create: `jest.config.ts`, `jest.setup.ts`
- Modify: `package.json` (add scripts + devDependencies)

- [ ] **Step 1: Install test toolchain**

Run:
```bash
npm install --save-dev jest @types/jest jest-expo @testing-library/react-native @testing-library/jest-native react-test-renderer
```

Expected: installs cleanly.

- [ ] **Step 2: Create Jest config**

Create `jest.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/app/**/__tests__/**/*.test.{ts,tsx}',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', '!**/__tests__/**'],
};

export default config;
```

- [ ] **Step 3: Create Jest setup**

Create `jest.setup.ts`:

```ts
import '@testing-library/jest-native/extend-expect';
```

- [ ] **Step 4: Add test script and write a smoke test**

Edit `package.json` and add to `scripts`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

Create `src/__tests__/smoke.test.ts`:
```ts
describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests**

Run:
```bash
npm test
```

Expected: 1 test passes, exits 0.

- [ ] **Step 6: Commit**

```bash
git add jest.config.ts jest.setup.ts src/__tests__/smoke.test.ts package.json package-lock.json
git commit -m "chore: configure jest + react native testing library"
```

---

## Task 4: Set up project folder structure with layer boundaries

**Files:**
- Create: `src/ui/README.md`, `src/features/README.md`, `src/data/README.md`, `src/platform/README.md`
- Modify: none

- [ ] **Step 1: Create layer directories with explanatory READMEs**

Create `src/ui/README.md`:
```markdown
# ui/

Presentational components and screens that don't own business logic.
May depend on `features/` for hooks and stores. Must NOT import directly from `data/` or `platform/`.
```

Create `src/features/README.md`:
```markdown
# features/

Per-domain modules — `auth/`, `asset/`, `count/`, `scan/`, `photo/`, `sync/`. Each owns its hooks, stores (Zustand), and feature-specific components.
May depend on `data/`. Must NOT import from `ui/`.
```

Create `src/data/README.md`:
```markdown
# data/

Persistence, networking, and sync. Owns SQLite repositories, the typed `CarmenApi`
interface and its mock/http implementations, the mutation queue, and the sync worker.
May depend on `platform/`. Must NOT import from `features/` or `ui/`.
```

Create `src/platform/README.md`:
```markdown
# platform/

Thin adapters over device capabilities and global config: secure storage, camera permissions,
netinfo, config, i18n. The most stable layer; everything else builds on it.
```

- [ ] **Step 2: Verify lint still passes**

Run:
```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "chore: scaffold layered folder structure with boundaries"
```

---

## Task 5: Per-customer config system

**Files:**
- Create: `src/platform/config/types.ts`
- Create: `src/platform/config/config.default.ts`
- Create: `src/platform/config/index.ts`
- Create: `src/platform/config/__tests__/config.test.ts`
- Modify: `app.config.ts` (new file replacing `app.json` for dynamic config)
- Delete: `app.json` (replaced by `app.config.ts`)

- [ ] **Step 1: Write failing test for config loader**

Create `src/platform/config/__tests__/config.test.ts`:

```ts
import { loadConfig } from '../index';

describe('loadConfig', () => {
  it('returns default config when APP_CUSTOMER is unset', () => {
    const cfg = loadConfig({ APP_CUSTOMER: undefined });
    expect(cfg.customerSlug).toBe('default');
    expect(cfg.serverBaseUrl).toBe('http://localhost:4000');
    expect(cfg.brandName).toBe('Carmen Asset');
  });

  it('overrides serverBaseUrl from env', () => {
    const cfg = loadConfig({
      APP_CUSTOMER: 'default',
      APP_SERVER_BASE_URL: 'https://api.example.com',
    });
    expect(cfg.serverBaseUrl).toBe('https://api.example.com');
  });

  it('throws on unknown customer slug', () => {
    expect(() => loadConfig({ APP_CUSTOMER: 'nonexistent' })).toThrow(
      /Unknown customer/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/platform/config
```

Expected: FAIL with "Cannot find module '../index'".

- [ ] **Step 3: Define config types**

Create `src/platform/config/types.ts`:

```ts
export type AuthStrategyKind = 'password' | 'oidc';

export interface CustomerConfig {
  customerSlug: string;
  brandName: string;
  serverBaseUrl: string;
  primaryColor: string;
  authStrategy: AuthStrategyKind;
  featureFlags: {
    scannerTestPage: boolean;
  };
}

export interface ConfigEnv {
  APP_CUSTOMER?: string;
  APP_SERVER_BASE_URL?: string;
}
```

- [ ] **Step 4: Create default config**

Create `src/platform/config/config.default.ts`:

```ts
import type { CustomerConfig } from './types';

export const defaultConfig: CustomerConfig = {
  customerSlug: 'default',
  brandName: 'Carmen Asset',
  serverBaseUrl: 'http://localhost:4000',
  primaryColor: '#2563eb',
  authStrategy: 'password',
  featureFlags: {
    scannerTestPage: true,
  },
};
```

- [ ] **Step 5: Implement loader**

Create `src/platform/config/index.ts`:

```ts
import { defaultConfig } from './config.default';
import type { ConfigEnv, CustomerConfig } from './types';

const REGISTRY: Record<string, CustomerConfig> = {
  default: defaultConfig,
};

export function loadConfig(env: ConfigEnv = process.env as ConfigEnv): CustomerConfig {
  const slug = env.APP_CUSTOMER ?? 'default';
  const base = REGISTRY[slug];
  if (!base) {
    throw new Error(`Unknown customer slug: ${slug}`);
  }
  return {
    ...base,
    serverBaseUrl: env.APP_SERVER_BASE_URL ?? base.serverBaseUrl,
  };
}

export type { CustomerConfig } from './types';
```

- [ ] **Step 6: Run test to verify it passes**

Run:
```bash
npm test -- src/platform/config
```

Expected: 3 tests pass.

- [ ] **Step 7: Convert app.json → app.config.ts**

Read `app.json` first to capture the values Expo generated, then create `app.config.ts`:

```ts
import { ExpoConfig } from 'expo/config';
import { loadConfig } from './src/platform/config';

const customer = loadConfig();

const config: ExpoConfig = {
  name: customer.brandName,
  slug: `carmen-asset-${customer.customerSlug}`,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: customer.primaryColor },
  assetBundlePatterns: ['**/*'],
  ios: { supportsTablet: true, bundleIdentifier: `com.carmen.asset.${customer.customerSlug}` },
  android: { package: `com.carmen.asset.${customer.customerSlug}` },
  extra: {
    customer,
  },
};

export default config;
```

Delete `app.json`:
```bash
rm app.json
```

- [ ] **Step 8: Verify typecheck + Expo config**

Run:
```bash
npm run typecheck
```

Expected: exits 0.

Run:
```bash
npx expo config --type public 2>&1 | head -30
```

Expected: prints JSON including `"name": "Carmen Asset"`.

- [ ] **Step 9: Commit**

```bash
git add src/platform/config/ app.config.ts package.json
git rm app.json
git commit -m "feat(config): per-customer config with env override"
```

---

## Task 6: i18n setup with English + Thai locales

**Files:**
- Create: `src/platform/i18n/locales/en.json`
- Create: `src/platform/i18n/locales/th.json`
- Create: `src/platform/i18n/index.ts`
- Create: `src/platform/i18n/__tests__/i18n.test.ts`
- Modify: `package.json` (add deps)

- [ ] **Step 1: Install i18n libraries**

Run:
```bash
npm install i18next react-i18next
npm install --save-dev @types/react-i18next
```

Expected: installs cleanly.

- [ ] **Step 2: Write failing test**

Create `src/platform/i18n/__tests__/i18n.test.ts`:

```ts
import { initI18n, t, setLocale } from '../index';

describe('i18n', () => {
  beforeAll(() => initI18n({ defaultLocale: 'en' }));

  it('returns English string by default', () => {
    expect(t('home.title')).toBe('Asset Checker');
  });

  it('switches to Thai', async () => {
    await setLocale('th');
    expect(t('home.title')).toBe('ตรวจนับสินทรัพย์');
  });

  it('falls back to key when missing', async () => {
    await setLocale('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npm test -- src/platform/i18n
```

Expected: FAIL with "Cannot find module '../index'".

- [ ] **Step 4: Create locale files**

Create `src/platform/i18n/locales/en.json`:
```json
{
  "home": {
    "title": "Asset Checker",
    "scanQr": "Scan QR Code",
    "newDocument": "Create New Counting Document",
    "viewDocuments": "View All Counting Documents"
  },
  "tabs": {
    "home": "Home",
    "scan": "Scan",
    "documents": "Documents",
    "more": "More"
  },
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "loading": "Loading…"
  }
}
```

Create `src/platform/i18n/locales/th.json`:
```json
{
  "home": {
    "title": "ตรวจนับสินทรัพย์",
    "scanQr": "สแกน QR Code",
    "newDocument": "สร้างใบตรวจนับใหม่",
    "viewDocuments": "ดูใบตรวจนับทั้งหมด"
  },
  "tabs": {
    "home": "หน้าหลัก",
    "scan": "สแกน",
    "documents": "ใบตรวจนับ",
    "more": "เพิ่มเติม"
  },
  "common": {
    "cancel": "ยกเลิก",
    "save": "บันทึก",
    "loading": "กำลังโหลด…"
  }
}
```

- [ ] **Step 5: Implement i18n module**

Create `src/platform/i18n/index.ts`:

```ts
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './locales/en.json';
import th from './locales/th.json';

type Locale = 'en' | 'th';

interface InitOptions {
  defaultLocale?: Locale;
}

export async function initI18n({ defaultLocale = 'en' }: InitOptions = {}): Promise<void> {
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, th: { translation: th } },
    lng: defaultLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });
}

export function t(key: string): string {
  const value = i18next.t(key);
  return typeof value === 'string' && value !== '' ? value : key;
}

export async function setLocale(locale: Locale): Promise<void> {
  await i18next.changeLanguage(locale);
}

export function useT() {
  const { t: i18nT } = useTranslation();
  return (key: string) => {
    const v = i18nT(key);
    return typeof v === 'string' && v !== '' ? v : key;
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:
```bash
npm test -- src/platform/i18n
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/platform/i18n/ package.json package-lock.json
git commit -m "feat(i18n): english + thai locales with i18next"
```

---

## Task 7: Install expo-router and set up tab navigation skeleton

**Files:**
- Delete: `App.tsx` (replaced by expo-router app/ directory)
- Create: `app/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/scan.tsx`
- Create: `app/(tabs)/documents.tsx`
- Create: `app/(tabs)/more.tsx`
- Create: `app/+not-found.tsx`
- Create: `app/(tabs)/__tests__/tabs.test.tsx`
- Modify: `package.json` (entry), `babel.config.js`, `app.config.ts` (scheme + plugins)

- [ ] **Step 1: Install expo-router and friends**

Run:
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

Expected: installs cleanly.

- [ ] **Step 2: Update package.json entry point**

Edit `package.json` and change/add:
```json
"main": "expo-router/entry"
```

(Remove `"main": "index.js"` or `"main": "node_modules/expo/AppEntry.js"` if present.)

- [ ] **Step 3: Update babel.config.js**

Replace `babel.config.js` with:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 4: Add router scheme + plugin to app.config.ts**

Edit `app.config.ts`, adding to the `config` object:

```ts
scheme: 'carmenasset',
plugins: ['expo-router'],
```

- [ ] **Step 5: Write failing test for tab labels**

Create `app/(tabs)/__tests__/tabs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n } from '../../../src/platform/i18n';
import HomeScreen from '../index';

describe('Home tab', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
  });

  it('renders the localized title', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run:
```bash
npm test -- app/\(tabs\)/__tests__
```

Expected: FAIL with "Cannot find module '../index'".

- [ ] **Step 7: Implement root layout**

Create `app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initI18n } from '../src/platform/i18n';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Slot />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 8: Implement tab layout**

Create `app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { useT } from '../../src/platform/i18n';

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="scan" options={{ title: t('tabs.scan') }} />
      <Tabs.Screen name="documents" options={{ title: t('tabs.documents') }} />
      <Tabs.Screen name="more" options={{ title: t('tabs.more') }} />
    </Tabs>
  );
}
```

- [ ] **Step 9: Implement Home screen (placeholder)**

Create `app/(tabs)/index.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function HomeScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('home.title')}</Text>
      <View style={styles.body}>
        <Text>{t('home.scanQr')}</Text>
        <Text>{t('home.newDocument')}</Text>
        <Text>{t('home.viewDocuments')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  title: { fontSize: 22, fontWeight: '700', padding: 16, color: '#fff', backgroundColor: '#2563eb' },
  body: { padding: 16, gap: 8 },
});
```

- [ ] **Step 10: Implement remaining placeholder screens**

Create `app/(tabs)/scan.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function ScanScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text>{t('tabs.scan')} — placeholder</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16 },
});
```

Create `app/(tabs)/documents.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function DocumentsScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text>{t('tabs.documents')} — placeholder</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16 },
});
```

Create `app/(tabs)/more.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';

export default function MoreScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text>{t('tabs.more')} — placeholder</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16 },
});
```

Create `app/+not-found.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text>Screen not found</Text>
      <Link href="/" style={styles.link}>
        Go home
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  link: { marginTop: 12, color: '#2563eb' },
});
```

- [ ] **Step 11: Delete old App.tsx**

Run:
```bash
rm App.tsx
```

- [ ] **Step 12: Run the test to verify it passes**

Run:
```bash
npm test -- app/\(tabs\)/__tests__
```

Expected: 1 test passes.

- [ ] **Step 13: Verify Expo bundles successfully**

Run:
```bash
npx expo export --platform web --output-dir dist 2>&1 | tail -20
```

Expected: prints "Exported: dist" or equivalent success message.

Clean up the temporary export:
```bash
rm -rf dist
```

- [ ] **Step 14: Commit**

```bash
git add app/ package.json package-lock.json babel.config.js app.config.ts
git rm App.tsx
git commit -m "feat(nav): tab bar skeleton with expo-router + localized labels"
```

---

## Task 8: Header component with placeholder sync indicator

**Files:**
- Create: `src/ui/Header.tsx`
- Create: `src/ui/__tests__/Header.test.tsx`
- Modify: `app/(tabs)/index.tsx` (use Header)

- [ ] **Step 1: Write failing test**

Create `src/ui/__tests__/Header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { initI18n } from '../../platform/i18n';
import { Header } from '../Header';

describe('Header', () => {
  beforeAll(async () => {
    await initI18n({ defaultLocale: 'en' });
  });

  it('renders the title', () => {
    render(<Header title="Asset Checker" />);
    expect(screen.getByText('Asset Checker')).toBeOnTheScreen();
  });

  it('renders the sync indicator placeholder', () => {
    render(<Header title="Asset Checker" />);
    expect(screen.getByLabelText('sync-status')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/ui
```

Expected: FAIL with "Cannot find module '../Header'".

- [ ] **Step 3: Implement Header**

Create `src/ui/Header.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <View accessibilityLabel="sync-status" style={styles.indicator}>
        <Text style={styles.indicatorText}>●</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  indicator: { paddingHorizontal: 6 },
  indicatorText: { color: '#bbf7d0', fontSize: 14 },
});
```

- [ ] **Step 4: Use Header in Home screen**

Modify `app/(tabs)/index.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../src/platform/i18n';
import { Header } from '../../src/ui/Header';

export default function HomeScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('home.title')} />
      <View style={styles.body}>
        <Text>{t('home.scanQr')}</Text>
        <Text>{t('home.newDocument')}</Text>
        <Text>{t('home.viewDocuments')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  body: { padding: 16, gap: 8 },
});
```

- [ ] **Step 5: Run tests to verify all pass**

Run:
```bash
npm test
```

Expected: all tests pass (smoke + config + i18n + tabs + header).

- [ ] **Step 6: Commit**

```bash
git add src/ui/ app/\(tabs\)/index.tsx
git commit -m "feat(ui): header with placeholder sync indicator"
```

---

## Task 9: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    name: Lint, Typecheck, Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --ci --reporters=default
```

- [ ] **Step 2: Run the same commands locally to make sure CI will pass**

Run:
```bash
npm run lint && npm run typecheck && npm test -- --ci --reporters=default
```

Expected: all three succeed sequentially.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint + typecheck + tests on push and pr"
```

---

## Task 10: Update README with quick-start

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the README**

Replace the contents of `README.md`:

```markdown
# Carmen Mobile Asset

Cross-platform mobile app (iOS + Android) for hotel/restaurant staff to perform physical asset counts. Built with Expo + TypeScript.

## Quick start

```bash
npm install
npx expo start
```

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Run Jest tests |
| `npm run lint` | ESLint over the project |
| `npm run typecheck` | TypeScript no-emit compile |
| `npm run format` | Format with Prettier |

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: project readme with quick-start"
```

---

## Self-review checklist (run after writing all tasks)

- [ ] All spec sections covered by Plan 1's scope? Plan 1 covers spec §3 (stack), §4 (nav), parts of §11 (config, i18n, deployment), and §12 (testing setup). Data model, API contract, sync, scanner, photos, auth — deferred to Plans 2–4.
- [ ] No placeholders. Each step has full code, exact files, exact commands, expected output.
- [ ] Type consistency check: `CustomerConfig` is defined in Task 5 and used in Tasks 5/7; `useT` exported in Task 6 and consumed in Tasks 7/8; `Header` defined in Task 8 and used in Task 8's home modification.
- [ ] Commits at every task boundary.
