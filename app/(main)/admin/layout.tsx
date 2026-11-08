import { getLocale } from 'next-intl/server';
import { IntlProvider } from '@/components/providers/intl-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TourProvider } from '@/components/tour/tour-provider';
import { defaultLocale } from '@/i18n/routing';
import { loadCatalog } from '@/i18n/catalog';
import { AdminLayoutClient } from './_layout-client';
import { AdminI18nProvider } from '@/components/admin/admin-i18n-provider';
import { WindowMenuBar } from '@/components/layout/window-menu-bar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  let messages;
  try {
    messages = await loadCatalog(locale);
  } catch {
    messages = await loadCatalog(defaultLocale);
  }
  return (
    <IntlProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <TourProvider>
          <WindowMenuBar />
          <AdminI18nProvider initialLocale={locale}>
            <AdminLayoutClient>{children}</AdminLayoutClient>
          </AdminI18nProvider>
        </TourProvider>
      </ThemeProvider>
    </IntlProvider>
  );
}
