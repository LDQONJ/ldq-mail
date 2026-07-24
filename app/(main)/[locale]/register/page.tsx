'use client';

import { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Ticket,
  User,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
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
      <div className="w-full max-w-[460px] mx-auto">
        <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur-sm shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          
          {/* Header */}
          <div className="px-8 pt-10 pb-4 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img
                src={withBasePath(resolvedTheme === 'dark' ? loginLogoDarkUrl : loginLogoLightUrl)}
                alt={appName}
                className="max-w-16 max-h-16 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              {t('subtitle')}
            </p>
          </div>

          {/* Body */}
          <div className="px-8 pb-10 pt-4">
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
                  <p className="text-base font-mono font-semibold text-primary mt-1 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20 inline-block">
                    {successEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(loginPath)}
                  className="w-full h-12 font-medium text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  {t('proceed_to_login')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Register Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div
                    className={cn(
                      'p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex items-start gap-3 text-sm text-destructive',
                      shakeError && 'animate-shake'
                    )}
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                  </div>
                )}

                {/* Invite Code */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('invite_code_label')}
                  </label>
                  <div className="relative">
                    <Ticket className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder={t('invite_code_placeholder')}
                      value={formData.inviteCode}
                      onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background/50 font-mono text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                </div>

                {/* Username & Fixed Domain */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('email_label')}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        placeholder={t('username_placeholder')}
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                      />
                    </div>
                    <div className="h-11 px-3.5 rounded-xl border border-border bg-muted/50 flex items-center text-sm font-semibold text-foreground select-none shrink-0 shadow-inner">
                      @{FIXED_DOMAIN}
                    </div>
                  </div>
                </div>

                {/* Display Name / Real Name (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('display_name_label')} <span className="text-muted-foreground/60 font-normal lowercase">{t('display_name_optional')}</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={t('display_name_placeholder')}
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background/50 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('password_label')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('password_placeholder')}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full h-11 pl-9 pr-10 rounded-xl border border-input bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {t('confirm_password_label')}
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('confirm_password_placeholder')}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 font-semibold text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('submit_button')
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Link to Login */}
        <div className="mt-6 text-center">
          <Link
            href={loginPath}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('already_have_account')}{' '}
            <span className="text-primary underline underline-offset-4">{t('login_link')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
