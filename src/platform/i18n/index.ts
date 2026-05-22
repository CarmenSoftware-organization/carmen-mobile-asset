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
