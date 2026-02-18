"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { analytics } from '@/services/analytics';

// Iconos SVG
const SparkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clipRule="evenodd" />
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
    <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
  </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
  </svg>
);

const GearIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9a.75.75 0 01-1.5 0V5.25a1.5 1.5 0 00-1.5-1.5h-6z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M15.75 9a.75.75 0 01.75-.75h5.25a.75.75 0 010 1.5H16.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M20.663 9.75a.75.75 0 010 1.06l-3 3a.75.75 0 01-1.06-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M16.5 14.25a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H17.25a.75.75 0 01-.75-.75z" clipRule="evenodd" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
  </svg>
);

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
      <aside className="w-64 flex flex-col text-white" style={{ backgroundColor: '#0B1E3B' }}>
        {/* Logo */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shadow-[0_10px_30px_rgba(47,99,255,0.35)]" style={{ backgroundColor: '#2F63FF' }}>
              <SparkIcon className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold">Ahorro</div>
              <div className="text-xs tracking-[0.18em] opacity-80 -mt-0.5">INVISIBLE</div>
            </div>
          </div>
        </div>
        
        {/* Menu */}
        <div className="px-3 py-6">
          <div className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3 px-3">
            MENU PRINCIPAL
          </div>
          
          <nav className="space-y-2">
            {[
              { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
              { href: "/profile", label: "Perfil", icon: UserIcon },
              { href: "/history", label: "Historial", icon: ClockIcon },
              { href: "/settings", label: "Ajustes", icon: GearIcon },
            ].map((item) => {
              const active = isActive(item.href) || (item.href === "/dashboard" && pathname === "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group relative flex items-center gap-3 rounded-xl px-4 py-3 transition",
                    active
                      ? "shadow-[0_14px_30px_rgba(47,99,255,0.28)]"
                      : "text-white/85 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                  style={active ? { backgroundColor: '#2F63FF' } : {}}
                >
                  <span
                    className={[
                      "grid place-items-center h-9 w-9 rounded-xl transition",
                      active ? "bg-white/10" : "bg-white/0 group-hover:bg-white/5",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <span className="text-[15px] font-medium">{item.label}</span>

                  {active && (
                    <span className="ml-auto opacity-90">
                      <ChevronRightIcon className="h-4 w-4" />
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        
        {/* User info - bottom */}
        <div className="mt-auto px-4 pb-5">
          <div className="mt-6 rounded-2xl bg-white/5 px-4 py-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{userName}</div>
              <div className="text-xs text-white/60 truncate">{userName}</div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="mt-3 w-full rounded-xl bg-white/5 hover:bg-white/10 transition px-4 py-3 text-left text-sm flex items-center gap-3"
          >
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-white/5">
              <LogoutIcon className="h-5 w-5" />
            </span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto text-gray-800" style={{ backgroundColor: '#F5F5F0', backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: '0 0' }}>
        {children}
      </main>
    </div>
  );
}
