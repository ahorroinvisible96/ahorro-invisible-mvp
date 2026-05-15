// Archivo layout.tsx limpiado para despliegue
import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import "@/styles/tokens/index.css"; // Importar tokens CSS
import ThemeInit from '@/components/providers/ThemeInit';
import PostHogProvider from '@/components/providers/PostHogProvider';
import SyncProvider from '@/components/providers/SyncProvider';
import { ToastProvider } from '@/components/ui/Toast/Toast';
import { Analytics } from "@vercel/analytics/next";

/**
 * Geist — sans-serif geométrica premium (Vercel)
 * Rol: Display, títulos, métricas, botones, labels, nav
 */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

/**
 * Inter — sans-serif humanista
 * Rol: Body, small, caption, textos de apoyo y lectura larga
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Ahorro Invisible - Ahorra de forma inteligente",
  description: "Toma mejores decisiones de ahorro cada día. Registra, visualiza y mejora tus hábitos financieros.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ahorro Invisible",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/api/icon?size=180" />
        {/* Script síncrono: aplica data-theme antes de pintar (previene FOUC) */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('theme');
            if (t === 'light') {
              document.documentElement.setAttribute('data-theme', 'light');
            } else {
              document.documentElement.setAttribute('data-theme', 'dark');
            }
          } catch(e) {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        ` }} />
      </head>
      <body className={`${geist.variable} ${inter.variable} antialiased`}>
        {/* Inicializa el tema en el cliente */}
        <ThemeInit />
        <PostHogProvider>
          <SyncProvider>
            <ToastProvider>{children}</ToastProvider>
          </SyncProvider>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
