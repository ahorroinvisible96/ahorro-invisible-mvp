"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analytics } from '@/services/analytics';

export default function ProfilePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('profile');
    
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Cargar datos
    loadUserData();
  }, [router]);
  
  const loadUserData = () => {
    try {
      setIsLoading(true);
      
      // Cargar nombre de usuario
      const storedName = localStorage.getItem("userName");
      if (storedName) {
        setUserName(storedName);
      }
      
      // Cargar email (simulado)
      setEmail(`${userName.toLowerCase().replace(/\s+/g, '.')}@example.com`);
      
      // Registrar evento de visualización
      analytics.profileViewed();
      
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveProfile = () => {
    try {
      // Guardar nombre de usuario
      localStorage.setItem("userName", userName);
      
      // Registrar evento
      analytics.profileUpdated(['userName']);
      
      // Mostrar mensaje de éxito (simulado)
      alert("Perfil actualizado correctamente");
      
    } catch (error) {
      console.error("Error al guardar perfil:", error);
    }
  };
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout
      title="Mi Perfil"
      subtitle="Gestiona tu información personal"
    >
      <AppLayout.Section title="Información Personal">
        <Card variant="default" size="md">
          <Card.Content>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  El email no se puede modificar
                </p>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveProfile}
                >
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </AppLayout.Section>
      
      <AppLayout.Section title="Preferencias">
        <Card variant="default" size="md">
          <Card.Content>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Notificaciones
                </label>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      id="notifications-email"
                      type="checkbox"
                      className="h-4 w-4 text-primary-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label htmlFor="notifications-email" className="ml-2 text-sm text-gray-700">
                      Recibir notificaciones por email
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      id="notifications-push"
                      type="checkbox"
                      className="h-4 w-4 text-primary-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label htmlFor="notifications-push" className="ml-2 text-sm text-gray-700">
                      Recibir notificaciones push
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Privacidad
                </label>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      id="privacy-analytics"
                      type="checkbox"
                      className="h-4 w-4 text-primary-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label htmlFor="privacy-analytics" className="ml-2 text-sm text-gray-700">
                      Compartir datos anónimos para mejorar el servicio
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                >
                  Guardar Preferencias
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </AppLayout.Section>
      
      <AppLayout.Section title="Cuenta">
        <Card variant="default" size="md">
          <Card.Content>
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                  Estado de la cuenta
                </h3>
                <div className="flex items-center mt-2">
                  <Badge variant="success" size="md" withDot>
                    Cuenta Activa
                  </Badge>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-red-600 mb-2">
                  Zona de peligro
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Una vez eliminada, toda tu información será borrada permanentemente.
                </p>
                <Button
                  variant="outline"
                  size="md"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Eliminar Cuenta
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </AppLayout.Section>
    </AppLayout>
  );
}
