export type SidebarRoute = 'dashboard' | 'perfil' | 'historial' | 'ajustes' | 'daily';

export type SidebarNavigationProps = {
  userName: string;
  activeRoute: SidebarRoute;
  onNavigate: (route: SidebarRoute) => void;
  onLogout: () => Promise<void>;
};

export type NavItem = {
  route: SidebarRoute;
  label: string;
  href: string;
};
