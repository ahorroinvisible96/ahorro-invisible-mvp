import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import styles from './AppLayout.module.css';
import { analytics } from '@/services/analytics';

export interface AppLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  withPattern?: boolean;
  onOpenDailyDecision?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title,
  subtitle,
  withPattern = true,
  onOpenDailyDecision,
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
        onOpenDailyDecision={onOpenDailyDecision}
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
