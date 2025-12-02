'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SystemHealthProvider } from '@/context/SystemHealthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { HelpOverlayProvider } from '@/context/HelpOverlayContext';
import { I18nProvider } from '@/context/I18nContext';
import SideNav from '@/components/layout/SideNav';
import TopNav from '@/components/layout/TopNav';
import SystemHealthBar from '@/components/system/SystemHealthBar';
import HelpOverlay from '@/components/help/HelpOverlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useEffect } from 'react';

function LayoutContent({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [user, isLoading, isLoginPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-indusia-bg flex items-center justify-center">
        <div className="text-indusia-textMuted">Loading...</div>
      </div>
    );
  }

  if (isLoginPage) {
    return children;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-indusia-bg flex items-center justify-center p-4">
        <div className="bg-indusia-surface rounded-xl shadow-xl border border-indusia-border p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-indusia-text mb-3">
            You are not logged in
          </h2>
          <p className="text-sm text-indusia-textMuted mb-6">
            Please login to access INDUSIA AI HMI.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-indusia-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const getContextFromPath = () => {
    if (pathname.startsWith('/inspection/result')) return 'HMI';
    if (pathname.startsWith('/inspection/overrides')) return 'Manager';
    if (pathname.startsWith('/engineering')) return 'Engineer';
    if (pathname.startsWith('/super-admin')) return 'SuperAdmin';
    if (pathname.startsWith('/settings')) return 'Engineer';
    if (pathname.startsWith('/event-log')) return 'Manager';
    return 'Global';
  };

  return (
    <ErrorBoundary>
      <I18nProvider>
        <HelpOverlayProvider defaultContext={getContextFromPath()}>
          <NotificationProvider>
            <SystemHealthProvider>
              <OfflineBanner />
              <div className="flex h-screen bg-indusia-bg">
                <SideNav />

                <div className="flex-1 ml-64 flex flex-col">
                  <TopNav />
                  <SystemHealthBar />

                  <main className="flex-1 overflow-y-auto px-8 py-6">
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </main>
                </div>
              </div>
              <HelpOverlay />
            </SystemHealthProvider>
          </NotificationProvider>
        </HelpOverlayProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default function LayoutClient({ children }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
