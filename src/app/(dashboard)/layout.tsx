"use client";

import { AppLayout } from '@/components/layout';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { analytics } from '@/services/analytics';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Función para manejar el cierre de sesión
  const handleLogout = () => {
    try {
      analytics.logoutClicked('sidebar');
      localStorage.removeItem("isAuthenticated");
      analytics.logoutSuccess();
      window.location.href = "/signup";
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  return (
    <AppLayout onLogout={handleLogout}>
      {children}
    </AppLayout>
  );
}
