import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';

const messagesMap: Record<string, any> = {
  fr: frMessages,
  en: enMessages,
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (messagesMap[locale] || frMessages) as any,
  };
});
