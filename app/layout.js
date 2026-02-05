import './globals.css';
import localFont from 'next/font/local';
import LayoutClient from './layout-client';
import { ToastProvider } from '@/hooks/useToast';

const inter = localFont({
  src: '../public/fonts/inter/Inter-Variable.woff2',
  weight: '400 700',
  display: 'swap',
});

export const metadata = {
  title: 'INDUSIA AI - Visual Inspection HMI',
  description: 'Industrial AI Visual Inspection Human-Machine Interface',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <LayoutClient>{children}</LayoutClient>
        </ToastProvider>
      </body>
    </html>
  );
}
