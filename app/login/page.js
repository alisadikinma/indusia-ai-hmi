'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(result.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Redirect based on role
      const user = result.user;
      if (user.role === 'operator' || user.role_id === 'operator') {
        router.push('/inspection/result/current');
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
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indusia-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-indusia-surface rounded-xl shadow-2xl border border-indusia-border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indusia-primary to-indusia-primary/80 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <LogIn className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">INDUSIA AI</h1>
                <p className="text-white/80 text-sm">Login</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-indusia-text mb-2">User Login</h2>
              <p className="text-sm text-indusia-textMuted">
                Enter your email and password to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-indusia-text mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 bg-indusia-bg border border-indusia-border rounded-lg text-indusia-text focus:outline-none focus:ring-2 focus:ring-indusia-primary focus:border-transparent pr-12"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indusia-textMuted hover:text-indusia-text transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-indusia-fail/10 border border-indusia-fail rounded-lg px-4 py-3">
                  <p className="text-indusia-fail text-sm">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-4 bg-indusia-primary text-white rounded-lg font-semibold text-base hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Login
                  </>
                )}
              </button>
            </form>

            {/* Dev Credentials Hint */}
            <div className="mt-6 p-4 bg-indusia-bg rounded-lg border border-indusia-border">
              <p className="text-xs text-indusia-textMuted mb-2 font-semibold">Development Credentials:</p>
              <div className="text-xs text-indusia-textMuted space-y-1">
                <p><span className="text-indusia-text">Super Admin:</span> admin@indusia.com / admin123</p>
                <p><span className="text-indusia-text">Manager:</span> manager@indusia.com / manager123</p>
                <p><span className="text-indusia-text">Operator:</span> operator@indusia.com / operator123</p>
                <p><span className="text-indusia-text">Engineer:</span> engineer@indusia.com / engineer123</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-indusia-surfaceMuted border-t border-indusia-border">
            <p className="text-xs text-indusia-textMuted text-center">
              INDUSIA AI Visual Inspection System v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
