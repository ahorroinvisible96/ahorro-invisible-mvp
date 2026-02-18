import { BUILD_VERSION } from '@/build-version';
// Build version: 2026-02-18T21:46:20.592Z
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/styles/tokens/index.css"; // Importar tokens CSS
import ThemeInit from '@/components/providers/ThemeInit';

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
        {children}
      </body>
    </html>
  );
}
