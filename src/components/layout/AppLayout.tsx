import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import styles from './AppLayout.module.css';
import { analytics } from '@/services/analytics';

export interface AppLayoutProps {
  /**
   * Contenido principal
   */
  children: React.ReactNode;
  
  /**
   * Título de la página
   */
  title?: React.ReactNode;
  
  /**
   * Subtítulo de la página
   */
  subtitle?: React.ReactNode;
  
  /**
   * Mostrar patrón de fondo
   */
  withPattern?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title,
  subtitle,
  withPattern = true,
}) => {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  
  useEffect(() => {
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Verificar onboarding
    const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding");
    if (hasCompletedOnboarding !== "true") {
      router.replace("/onboarding");
      return;
    }
    
    // Cargar nombre de usuario
    const storedUserName = localStorage.getItem("userName");
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, [router]);

  const handleLogout = () => {
    try {
      analytics.logoutClicked('sidebar');
      localStorage.removeItem("isAuthenticated");
      analytics.logoutSuccess();
      router.replace("/signup");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar 
        userName={userName}
        onLogout={handleLogout}
      />
      <MainContent
        title={title}
        subtitle={subtitle}
        withPattern={withPattern}
      >
        {children}
      </MainContent>
    </div>
  );
};

export default AppLayout;
