"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analytics } from "@/services/analytics";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('profile');
    
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
    
    // Cargar datos del usuario
    loadUserData();
    
    // Registrar evento de visualización del perfil
    analytics.profileViewed();
  }, [router]);
  
  const loadUserData = () => {
    try {
      setIsLoading(true);
      
      // Cargar datos del usuario desde localStorage
      const storedName = localStorage.getItem("userName");
      const storedEmail = localStorage.getItem("userEmail");
      const storedPhotoUrl = localStorage.getItem("userProfilePhoto");
      
      if (storedName) setName(storedName);
      if (storedEmail) setEmail(storedEmail);
      if (storedPhotoUrl) setProfilePhotoUrl(storedPhotoUrl);
      
    } catch (error) {
      console.error("Error al cargar datos del usuario:", error);
      setError("No se pudieron cargar los datos del usuario");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    
    try {
      setIsSaving(true);
      
      // Validar datos
      if (!name.trim()) {
        setError("El nombre es obligatorio");
        setIsSaving(false);
        return;
      }
      
      // Guardar datos en localStorage
      localStorage.setItem("userName", name);
      if (email) localStorage.setItem("userEmail", email);
      if (profilePhotoUrl) localStorage.setItem("userProfilePhoto", profilePhotoUrl);
      
      // Determinar qué campos se cambiaron
      const changedFields = ["name", "email"].filter(field => field === "name" || (field === "email" && email));
      
      // Registrar evento de actualización de perfil
      analytics.profileUpdated(changedFields);
      
      // Mostrar mensaje de éxito
      setSuccessMessage("Cambios guardados.");
      
    } catch (error) {
      console.error("Error al guardar datos:", error);
      setError("No se pudo guardar. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      // En un entorno real, aquí se subiría la imagen a un servidor
      // Para el MVP, simularemos usando URL.createObjectURL
      const objectUrl = URL.createObjectURL(file);
      setProfilePhotoUrl(objectUrl);
      
      // Registrar evento de actualización de foto
      analytics.profilePhotoUpdated();
      
    } catch (error) {
      console.error("Error al procesar la imagen:", error);
      setError("No se pudo procesar la imagen");
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 bg-background">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Perfil</h1>
        <p className="text-text-secondary">Gestiona tu información personal.</p>
      </div>
      
      <Card className="p-6">
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
            {successMessage}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Foto de perfil */}
          <div className="flex flex-col items-center mb-6">
            <div 
              className="w-24 h-24 rounded-full bg-gray-200 mb-3 overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={triggerFileInput}
            >
              {profilePhotoUrl ? (
                <img 
                  src={profilePhotoUrl} 
                  alt="Foto de perfil" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-4xl text-gray-400 font-light">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            <button 
              type="button"
              onClick={triggerFileInput}
              className="text-sm text-ahorro-600 hover:underline"
            >
              Añadir foto de perfil
            </button>
          </div>
          
          {/* Campos de formulario */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
              readOnly={true} // En el MVP, el email no es editable después del registro
            />
          </div>
          
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
