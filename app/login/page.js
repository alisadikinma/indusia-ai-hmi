'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { Eye, EyeOff, Loader2, Shield, AlertTriangle, Terminal } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [bootSequence, setBootSequence] = useState(0);
  const { t } = useI18n();

  // Boot sequence animation
  useEffect(() => {
    const steps = ['INITIALIZING', 'LOADING MODULES', 'ESTABLISHING CONNECTION', 'READY'];
    let step = 0;
    const interval = setInterval(() => {
      if (step < steps.length) {
        setBootSequence(step);
        step++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.emailRequired'));
      return;
    }

    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(`${t('auth.authFailed')}: ${result.error || t('auth.invalidCredentials')}`);
        setIsLoading(false);
        return;
      }

      // Redirect based on role
      const user = result.user;
      if (user.role === 'operator' || user.role_id === 'operator') {
        // Check if operator has active line session
        const storedActiveLine = localStorage.getItem('indusia_active_line');
        if (storedActiveLine) {
          try {
            const { lineId } = JSON.parse(storedActiveLine);
            if (lineId) {
              router.push(`/inspection/live/${lineId}`);
              return;
            }
          } catch (e) {
            localStorage.removeItem('indusia_active_line');
          }
        }
        router.push('/inspection/select-line');
      } else if (user.role === 'manager' || user.role_id === 'manager') {
        router.push('/inspection/overrides');
      } else if (user.role === 'engineer' || user.role_id === 'engineer') {
        router.push('/engineering/master-data');
      } else if (user.role === 'superadmin' || user.role_id === 'superadmin') {
        router.push('/engineering/master-data');
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('auth.systemError'));
      setIsLoading(false);
    }
  };

  const bootMessages = [
    t('auth.bootInit'),
    t('auth.bootModules'),
    t('auth.bootConnection'),
    t('auth.bootReady')
  ];

  return (
    <div className="min-h-screen bg-void grid-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative grid overlay */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />

      {/* Radial vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-void/80" />

      {/* Technical corner decorations */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-phosphor-teal/30" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-phosphor-teal/30" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-phosphor-teal/30" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-phosphor-teal/30" />

      {/* System status bar - top */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-panel/80 border-b border-surface-border flex items-center justify-between px-4 text-xxs font-mono">
        <div className="flex items-center gap-4">
          <span className="text-phosphor-teal">SYS://INDUSIA.HMI.AUTH</span>
          <span className="text-text-tertiary">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-phosphor-green animate-pulse-glow" />
            <span className="text-phosphor-green">{t('auth.online')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-text-tertiary">UTC</span>
          <span className="text-phosphor-teal font-semibold tracking-wider">{currentTime}</span>
        </div>
      </div>

      {/* Main login panel */}
      <div className="relative w-full max-w-md animate-fade-in">
        {/* Panel container */}
        <div className="panel tech-corner shadow-panel">
          {/* Panel header */}
          <div className="panel-header">
            <Shield className="w-4 h-4" />
            <span>{t('auth.authTerminal')}</span>
            <span className="ml-auto text-text-tertiary font-mono text-xxs">v2.4.1</span>
          </div>

          {/* Logo section */}
          <div className="px-8 pt-8 pb-6 border-b border-surface-border">
            <div className="flex items-center gap-4">
              {/* Logo mark */}
              <div className="relative">
                <div className="w-16 h-16 border-2 border-phosphor-teal flex items-center justify-center bg-terminal relative overflow-hidden">
                  <div className="absolute inset-0 bg-phosphor-teal/5" />
                  <img src="/indusiaai-logo.png" alt="INDUSIA AI" className="w-12 h-12 object-contain" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-phosphor-green animate-pulse-glow" />
              </div>

              {/* Logo text */}
              <div>
                <h1 className="font-display font-bold text-3xl tracking-wider text-text-primary">
                  INDUSIA
                </h1>
                <p className="font-mono text-xs text-phosphor-teal tracking-widest">
                  {t('auth.aiVisualInspection')}
                </p>
              </div>
            </div>

            {/* Boot sequence terminal */}
            <div className="mt-6 bg-terminal border border-surface-border p-3">
              {bootMessages.slice(0, bootSequence + 1).map((msg, i) => (
                <div
                  key={i}
                  className="font-mono text-xs animate-slide-up"
                  style={{
                    color: i === bootSequence ? '#FFAA00' : '#8B949E',
                    animationDelay: `${i * 0.1}s`
                  }}
                >
                  {msg}
                  {i === bootSequence && bootSequence < 3 && (
                    <span className="inline-block w-2 h-3 bg-phosphor-teal ml-1 animate-typing-cursor" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form section */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email field */}
              <div>
                <label className="data-label flex items-center gap-2 mb-2">
                  <Terminal className="w-3 h-3" />
                  {t('auth.operatorId')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@indusia.ai"
                    className="w-full px-4 py-3 bg-terminal border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:border-phosphor-teal focus:shadow-glow-teal transition-all"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-phosphor-teal/50" />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="data-label flex items-center gap-2 mb-2">
                  <Shield className="w-3 h-3" />
                  {t('auth.accessCode')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 pr-12 bg-terminal border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:border-phosphor-teal focus:shadow-glow-teal transition-all"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-phosphor-teal/50" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-phosphor-teal transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-3 p-3 bg-phosphor-red/10 border border-phosphor-red/50 animate-slide-up">
                  <AlertTriangle className="w-4 h-4 text-phosphor-red flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono text-xs text-phosphor-red font-semibold">{error}</p>
                    <p className="font-mono text-xxs text-text-tertiary mt-1">
                      {t('auth.checkCredentials')}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading || bootSequence < 3}
                className="w-full py-4 btn-primary font-display text-lg tracking-widest flex items-center justify-center gap-3 disabled:opacity-40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('auth.authenticating')}</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span>{t('auth.authorizeAccess')}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Panel footer */}
          <div className="px-8 py-4 bg-terminal border-t border-surface-border">
            <div className="flex items-center justify-between font-mono text-xxs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="status-indicator ok" />
                  <span className="text-text-tertiary">{t('auth.secure')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="status-indicator ok" />
                  <span className="text-text-tertiary">{t('auth.encrypted')}</span>
                </div>
              </div>
              <span className="text-text-tertiary">SESSION: {Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Bottom system info */}
        <div className="mt-6 text-center">
          <p className="font-mono text-xxs text-text-tertiary tracking-wider">
            {t('auth.systemInfo')}
          </p>
          <p className="font-mono text-xxs text-text-tertiary/50 mt-1">
            {t('auth.authorizedOnly')}
          </p>
        </div>
      </div>

      {/* Decorative scan line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-phosphor-teal/50 to-transparent animate-scan" />
    </div>
  );
}
