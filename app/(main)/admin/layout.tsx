import { getLocale } from 'next-intl/server';
import { IntlProvider } from '@/components/providers/intl-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TourProvider } from '@/components/tour/tour-provider';
import { defaultLocale } from '@/i18n/routing';
import { AdminLayoutClient } from './_layout-client';
import { AdminI18nProvider } from '@/components/admin/admin-i18n-provider';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  let messages;
  try {
    messages = (await import(`@/locales/${locale}/common.json`)).default;
  } catch {
    messages = (await import(`@/locales/${defaultLocale}/common.json`)).default;
  }
  return (
    <IntlProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <TourProvider>
          <AdminI18nProvider initialLocale={locale}>
            <AdminLayoutClient>{children}</AdminLayoutClient>
          </AdminI18nProvider>
        </TourProvider>
      </ThemeProvider>
    </IntlProvider>
  );
}
