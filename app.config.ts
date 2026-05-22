/* eslint-disable @typescript-eslint/no-require-imports */
// Register a `.ts` extension handler so child requires from this build-time
// config file can resolve TypeScript sources. Expo's config loader only
// transpiles this entry file; transitive `require()` calls fall back to
// Node's default CJS resolver which does not know about `.ts`.
const Module = require('node:module') as typeof import('node:module');
const fs = require('node:fs') as typeof import('node:fs');
const tsRuntime = require('typescript') as typeof import('typescript');

type CompileFn = (code: string, filename: string) => void;
const tsExtensions = (
  Module as unknown as {
    _extensions: Record<string, (mod: NodeJS.Module, filename: string) => void>;
  }
)._extensions;
if (!tsExtensions['.ts']) {
  tsExtensions['.ts'] = (mod, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = tsRuntime.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: tsRuntime.ModuleKind.CommonJS,
        moduleResolution: tsRuntime.ModuleResolutionKind.Node10,
        target: tsRuntime.ScriptTarget.ES2022,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
    });
    (mod as unknown as { _compile: CompileFn })._compile(outputText, filename);
  };
}

import { ExpoConfig } from 'expo/config';
import { loadConfig } from './src/platform/config';

const customer = loadConfig();

const config: ExpoConfig = {
  name: customer.brandName,
  slug: `carmen-asset-${customer.customerSlug}`,
  version: '0.1.0',
  scheme: 'carmenasset',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  plugins: ['expo-router'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: `com.carmen.asset.${customer.customerSlug}`,
  },
  android: {
    package: `com.carmen.asset.${customer.customerSlug}`,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    customer,
  },
};

export default config;
