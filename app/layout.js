import './globals.css';
import { Inter } from 'next/font/google';
import LayoutClient from './layout-client';
import { ToastProvider } from '@/hooks/useToast';

const inter = Inter({ subsets: ['latin'] });

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
