'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { SystemHealthProvider } from '@/context/SystemHealthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { HelpOverlayProvider } from '@/context/HelpOverlayContext';
import { I18nProvider } from '@/context/I18nContext';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import SideNav from '@/components/layout/SideNav';
import TopNav from '@/components/layout/TopNav';
import HelpOverlay from '@/components/help/HelpOverlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

function LayoutContent({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { isCollapsed, isHidden, isFullscreenMode, navigatingTo } = useSidebar();
  const { isDark } = useTheme();
  const logoSrc = isDark ? '/indusiaai-logo.png' : '/indusiaai-light.png';

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [user, isLoading, isLoginPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <img src={logoSrc} alt="INDUSIA AI" className="w-48 h-48 object-contain animate-pulse-glow mx-auto mb-4" />
          <div className="font-mono text-sm text-text-tertiary">INITIALIZING...</div>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <I18nProvider>{children}</I18nProvider>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-4">
        <div className="bg-panel border border-surface-border p-8 max-w-md text-center">
          <h2 className="text-xl font-display font-bold text-text-primary mb-3">
            ACCESS DENIED
          </h2>
          <p className="text-sm text-text-secondary mb-6 font-mono">
            Authentication required to access INDUSIA HMI.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-phosphor-teal text-void font-display font-bold tracking-wider hover:shadow-glow-teal transition-all"
          >
            AUTHENTICATE
          </button>
        </div>
      </div>
    );
  }

  const getContextFromPath = () => {
    if (pathname.startsWith('/inspection/live')) return 'HMI';
    if (pathname.startsWith('/inspection/result')) return 'HMI';
    if (pathname.startsWith('/inspection/overrides')) return 'Manager';
    if (pathname.startsWith('/engineering')) return 'Engineer';
    if (pathname.startsWith('/super-admin')) return 'SuperAdmin';
    if (pathname.startsWith('/settings')) return 'Engineer';
    if (pathname.startsWith('/event-log')) return 'Manager';
    return 'Global';
  };

  // Fullscreen mode - LiveView manages its own layout
  // Sidebar overlays on top when visible, doesn't change layout
  if (isFullscreenMode) {
    return (
      <ErrorBoundary>
        <I18nProvider>
          <HelpOverlayProvider defaultContext={getContextFromPath()}>
            <NotificationProvider userId={user?.id}>
              <SystemHealthProvider>

                <div className="h-screen bg-void relative">
                  {/* Main content - always full screen */}
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                  
                  {/* Sidebar overlay - slides in from left */}
                  {!isHidden && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 bg-void/60 backdrop-blur-sm z-40 animate-fade-in"
                        onClick={() => {
                          // Close sidebar when clicking backdrop
                          const event = new CustomEvent('closeSidebar');
                          window.dispatchEvent(event);
                        }}
                      />
                      {/* Sidebar */}
                      <div className="fixed left-0 top-0 h-full z-50 animate-slide-in-left">
                        <SideNav />
                      </div>
                    </>
                  )}
                </div>
                <HelpOverlay />
              </SystemHealthProvider>
            </NotificationProvider>
          </HelpOverlayProvider>
        </I18nProvider>
      </ErrorBoundary>
    );
  }

  // Normal mode - standard layout with sidebar
  const getMainMargin = () => {
    if (isHidden) return 'ml-0';
    if (isCollapsed) return 'ml-16';
    return 'ml-64';
  };

  return (
    <ErrorBoundary>
      <I18nProvider>
        <HelpOverlayProvider defaultContext={getContextFromPath()}>
          <NotificationProvider userId={user?.id}>
            <SystemHealthProvider>
              <div className="flex h-screen bg-void">
                <SideNav />

                <div className={cn(
                  "flex-1 flex flex-col transition-all duration-300",
                  getMainMargin()
                )}>
                {!isHidden && <TopNav />}

                  <main className={cn(
                    "flex-1 overflow-y-auto",
                    !isHidden && "px-8 py-6"
                  )}>
                    {navigatingTo ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <img src={logoSrc} alt="Loading" className="w-48 h-48 object-contain animate-pulse-glow mx-auto mb-4" />
                          <div className="font-mono text-xs text-text-tertiary tracking-wider">Loading...</div>
                        </div>
                      </div>
                    ) : (
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                    )}
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

function LayoutWithSidebar({ children }) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}

export default function LayoutClient({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LayoutWithSidebar>{children}</LayoutWithSidebar>
      </ThemeProvider>
    </AuthProvider>
  );
}
