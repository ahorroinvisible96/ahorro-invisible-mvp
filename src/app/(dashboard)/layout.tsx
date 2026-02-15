"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analytics } from '@/services/analytics';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('Invitado');
  
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

  const isActive = (path: string) => {
    return pathname === path;
  };

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
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col" style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-ahorro-500 flex items-center justify-center text-white font-bold">
            AI
          </div>
          <div className="font-semibold">
            <div>Ahorro</div>
            <div className="text-xs opacity-80">INVISIBLE</div>
          </div>
        </div>
        
        {/* Menu */}
        <div className="px-3 py-6">
          <div className="text-xs font-medium uppercase tracking-wider text-light/60 mb-3 px-3">
            MENU PRINCIPAL
          </div>
          
          <nav className="space-y-1">
            <Link 
              href="/dashboard" 
              className={`flex items-center px-3 py-2 rounded-lg ${
                isActive('/dashboard') || pathname === '/'
                  ? 'bg-ahorro-600 text-white' 
                  : 'text-light/80 hover:bg-ahorro-600/50 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Dashboard
            </Link>
            
            <Link 
              href="/profile" 
              className={`flex items-center px-3 py-2 rounded-lg ${
                isActive('/profile')
                  ? 'bg-ahorro-600 text-white' 
                  : 'text-light/80 hover:bg-ahorro-600/50 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Perfil
            </Link>
            
            <Link 
              href="/history" 
              className={`flex items-center px-3 py-2 rounded-lg ${
                isActive('/history')
                  ? 'bg-ahorro-600 text-white' 
                  : 'text-light/80 hover:bg-ahorro-600/50 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Historial
            </Link>
            
            <Link 
              href="/settings" 
              className={`flex items-center px-3 py-2 rounded-lg ${
                isActive('/settings')
                  ? 'bg-ahorro-600 text-white' 
                  : 'text-light/80 hover:bg-ahorro-600/50 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Ajustes
            </Link>
          </nav>
        </div>
        
        {/* User info - bottom */}
        <div className="mt-auto border-t border-ahorro-600/50">
          <div className="p-4 flex items-center">
            <div className="w-8 h-8 rounded-full bg-ahorro-500 flex items-center justify-center text-white font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{userName}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="w-full p-4 text-left text-sm text-light/70 hover:bg-ahorro-600/30 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zm7 5a1 1 0 10-2 0v4a1 1 0 102 0V8zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#F5F5F0', backgroundImage: 'linear-gradient(#F5F5F0 1px, transparent 1px), linear-gradient(90deg, #F5F5F0 1px, #F5F5F0 1px)', backgroundSize: '20px 20px', backgroundPosition: '0 0', color: '#1F2937' }}>
        {children}
      </main>
    </div>
  );
}
