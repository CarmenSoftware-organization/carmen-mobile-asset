import { useCallback } from 'react';
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './locales/en.json';
import th from './locales/th.json';

type Locale = 'en' | 'th';

export interface InitOptions {
  defaultLocale?: Locale;
}

function normalize(value: unknown, key: string): string {
  return typeof value === 'string' && value !== '' ? value : key;
}

export async function initI18n({ defaultLocale = 'en' }: InitOptions = {}): Promise<void> {
  if (i18next.isInitialized) return;
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, th: { translation: th } },
    lng: defaultLocale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });
}

export function t(key: string, opts?: Record<string, unknown>): string {
  return normalize(i18next.t(key, opts), key);
}

export async function setLocale(locale: Locale): Promise<void> {
  await i18next.changeLanguage(locale);
}

export function useT() {
  const { t: i18nT } = useTranslation();
  return useCallback(
    (key: string, opts?: Record<string, unknown>) => normalize(i18nT(key, opts), key),
    [i18nT],
  );
}
