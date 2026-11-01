import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/layout/BottomNav';
import SideRail from '@/components/layout/SideRail';
import ThemeSync, { themeBootScript } from '@/components/layout/ThemeSync';
import { ToastProvider } from '@/components/ui/Toast';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-barlow',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'TransMi — Rutas de Bogotá',
  description: 'Planea tus viajes, mira los buses en vivo y pregúntale al asistente sobre el sistema de transporte de Bogotá',
  keywords: ['TransMilenio', 'Bogotá', 'transporte público', 'rutas', 'SITP', 'buses', 'planeador'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TransMi',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <ThemeSync />
        <ToastProvider>
          <SideRail />
          <div className="min-h-dvh max-w-lg mx-auto relative lg:max-w-none lg:mx-0 lg:pl-[var(--rail)]">
            {children}
          </div>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
