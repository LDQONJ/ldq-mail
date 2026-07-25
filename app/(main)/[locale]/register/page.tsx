'use client';

import { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfig } from '@/hooks/use-config';
import { useThemeStore } from '@/stores/theme-store';
import { apiFetch, withBasePath, toRouterPath, getPathPrefix } from '@/lib/browser-navigation';

const FIXED_DOMAIN = 'lidaqian.com';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('register');
  const locale = (params.locale as string) || 'en';
  const initialCode = searchParams.get('code') || '';

  const { appName, loginLogoLightUrl, loginLogoDarkUrl } = useConfig();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const [formData, setFormData] = useState({
    inviteCode: initialCode,
    username: '',
    displayName: '',
    domain: FIXED_DOMAIN,
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShakeError(false);

    if (!formData.inviteCode.trim()) {
      setError(t('error.invite_required'));
      setShakeError(true);
      return;
    }
    if (!formData.username.trim()) {
      setError(t('error.username_required'));
      setShakeError(true);
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(formData.username.trim())) {
      setError(t('error.username_invalid'));
      setShakeError(true);
      return;
    }
    if (!formData.password) {
      setError(t('error.password_required'));
      setShakeError(true);
      return;
    }
    if (formData.password.length < 6) {
      setError(t('error.password_short'));
      setShakeError(true);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('error.password_mismatch'));
      setShakeError(true);
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: formData.inviteCode.trim(),
          username: formData.username.trim(),
          displayName: formData.displayName.trim() || undefined,
          domain: FIXED_DOMAIN,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccessEmail(data.email || `${formData.username.trim()}@${FIXED_DOMAIN}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
      setShakeError(true);
    } finally {
      setLoading(false);
    }
  };

  const loginPath = toRouterPath(`${getPathPrefix(locale)}/${locale}/login`);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/30 relative px-4 py-12">
      <div className="w-full max-w-[400px] mx-auto">
        <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          
          {/* Header with logo - exact match with login page */}
          <div className="px-6 sm:px-8 pt-10 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-5">
              <img
                src={withBasePath(resolvedTheme === 'dark' ? loginLogoDarkUrl : loginLogoLightUrl)}
                alt={appName}
                className="max-w-16 max-h-16 object-contain"
              />
            </div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          {/* Body - exact match with login page padding & input sizes */}
          <div className="px-6 sm:px-8 pb-8">
            {successEmail ? (
              /* Success Card */
              <div className="text-center space-y-6 py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{t('success_title')}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('success_subtitle')}
                  </p>
                  <p className="text-base font-mono font-semibold text-primary mt-1 bg-primary/5 px-3.5 py-1.5 rounded-xl border border-primary/20 inline-block">
                    {successEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(loginPath)}
                  className="w-full h-11 font-medium text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  {t('proceed_to_login')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Register Form - matching login form styling */
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {error && (
                  <div
                    className={cn(
                      'p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3 text-sm text-destructive',
                      shakeError && 'animate-shake'
                    )}
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 self-center leading-relaxed">{error}</div>
                  </div>
                )}

                {/* Invite Code */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('invite_code_label')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('invite_code_placeholder')}
                    value={formData.inviteCode}
                    onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                    className="h-11 w-full px-3.5 bg-muted/40 border border-border/60 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 text-sm font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Username & Fixed Domain */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('email_label')}
                  </label>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <input
                      type="text"
                      required
                      placeholder={t('username_placeholder')}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="h-11 flex-1 min-w-0 px-3 sm:px-3.5 bg-muted/40 border border-border/60 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="h-11 px-2.5 sm:px-3 bg-muted/40 border border-border/60 rounded-xl flex items-center text-xs sm:text-sm font-medium text-muted-foreground select-none shrink-0">
                      @{FIXED_DOMAIN}
                    </div>
                  </div>
                </div>

                {/* Display Name / Real Name (Optional) */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('display_name_label')}{' '}
                    <span className="text-xs text-muted-foreground font-normal">{t('display_name_optional')}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('display_name_placeholder')}
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="h-11 w-full px-3.5 bg-muted/40 border border-border/60 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('password_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('password_placeholder')}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 w-full px-3.5 pe-11 bg-muted/40 border border-border/60 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('confirm_password_label')}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={t('confirm_password_placeholder')}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="h-11 w-full px-3.5 bg-muted/40 border border-border/60 rounded-xl focus:bg-background focus:border-primary/50 transition-all duration-200 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Submit Button - exact match with login button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 font-medium text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 rounded-xl shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('submitting')}
                      </>
                    ) : (
                      t('submit_button')
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer Link to Login */}
        <div className="mt-6 text-center">
          <Link
            href={loginPath}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            {t('already_have_account')}{' '}
            <span className="text-primary font-semibold underline underline-offset-4">{t('login_link')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
