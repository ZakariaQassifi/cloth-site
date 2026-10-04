import React, { useState } from 'react';
import { adminLogin, isThrottled } from '../services/adminApi';
import { startAdminSession } from './adminAuth';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n/useI18n';
import './AdminLogin.css';

export interface AdminLoginProps {
  onReturnToStore: () => void;
}

/** Pragmatic shape check — enough to catch typos without a heavy validator. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = { email?: string; password?: string };

export const AdminLogin: React.FC<AdminLoginProps> = ({ onReturnToStore }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Validate before contacting the API so obvious mistakes get an immediate,
   * field-level message instead of a round trip.
   */
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) next.email = t('admin.login.errEmailRequired');
    else if (!EMAIL_PATTERN.test(trimmedEmail)) next.email = t('admin.login.errEmailInvalid');

    if (!password) next.password = t('admin.login.errPasswordRequired');
    else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = t('admin.login.errPasswordShort');
    }

    return next;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const problems = validate();
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setLoading(true);
    const result = await adminLogin(email.trim(), password);
    setLoading(false);

    if (result.success && result.data?.token && result.data?.admin) {
      // Persist the token so a refresh keeps the admin signed in. Writing the
      // session is what notifies the guard, so no explicit callback is needed.
      startAdminSession({ token: result.data.token, admin: result.data.admin });
      setPassword('');
    } else if (isThrottled(result)) {
      // Too many failures — say so, rather than implying the password was wrong.
      setError(t('admin.login.tooManyAttempts'));
    } else {
      // Server rejected the credentials — report a single generic message.
      setError(t('admin.login.invalid'));
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div>
          <div className="admin-login__brand">{t('admin.login.brand')}</div>
          <h2 className="admin-login__title" style={{ marginTop: '0.5rem' }}>{t('admin.login.title')}</h2>
        </div>

        {error && (
          <div
            className="admin-login__alert"
            role="alert"
            aria-live="polite"
            style={{ padding: '0.75rem', backgroundColor: '#ffe4e6', color: '#9f1239', fontSize: '0.875rem' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="adminEmail">{t('admin.login.email')}</label>
            <input
              type="email"
              id="adminEmail"
              name="email"
              className={`form-input ${fieldErrors.email ? 'error' : ''}`}
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => {
                const problems = validate();
                if (problems.email) setFieldErrors((prev) => ({ ...prev, email: problems.email }));
              }}
              placeholder="admin@kinetic.com"
              autoComplete="username"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'adminEmailError' : undefined}
            />
            {fieldErrors.email && (
              <div id="adminEmailError" className="form-error" role="alert">
                {fieldErrors.email}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="adminPassword">{t('admin.login.password')}</label>
            <input
              type="password"
              id="adminPassword"
              name="password"
              className={`form-input ${fieldErrors.password ? 'error' : ''}`}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => {
                const problems = validate();
                if (problems.password) setFieldErrors((prev) => ({ ...prev, password: problems.password }));
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? 'adminPasswordError' : undefined}
            />
            {fieldErrors.password && (
              <div id="adminPasswordError" className="form-error" role="alert">
                {fieldErrors.password}
              </div>
            )}
          </div>

          <button type="submit" className="admin-btn" style={{ width: '100%', height: '48px', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? t('admin.login.signingIn') : t('admin.login.signIn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={onReturnToStore}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', fontWeight: 500 }}
          >
            <ArrowLeft size={14} className="admin-return-icon" /> {t('admin.login.returnToStore')}
          </button>
        </div>
      </div>
    </div>
  );
};