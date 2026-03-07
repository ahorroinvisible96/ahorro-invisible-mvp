// Archivo layout.tsx limpiado para despliegue
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/tokens/index.css"; // Importar tokens CSS
import ThemeInit from '@/components/providers/ThemeInit';
import PostHogProvider from '@/components/providers/PostHogProvider';
import SyncProvider from '@/components/providers/SyncProvider';
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ahorro Invisible - Ahorra de forma inteligente",
  description: "Plataforma para ahorrar dinero de forma inteligente y automática",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Inicializa el tema en el cliente */}
        <ThemeInit />
        <PostHogProvider>
          <SyncProvider>{children}</SyncProvider>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
