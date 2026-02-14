"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      router.replace("/onboarding/1");
      return;
    }
    
    // Cargar datos del usuario
    try {
      const storedName = localStorage.getItem("userName");
      const storedEmail = localStorage.getItem("userEmail");
      const storedProfileImage = localStorage.getItem("userProfileImage");
      
      if (storedName) setName(storedName);
      if (storedEmail) setEmail(storedEmail);
      if (storedProfileImage) setProfileImage(storedProfileImage);
      
      setIsLoading(false);
      
      // Evento de analytics: profile_viewed
      console.log("Analytics: profile_viewed");
    } catch (err) {
      console.error("Error al cargar datos del perfil:", err);
      setIsLoading(false);
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    // Validación
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Guardar datos en localStorage
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      if (profileImage) {
        localStorage.setItem("userProfileImage", profileImage);
      }
      
      setSuccess("Perfil actualizado correctamente");
      setIsSubmitting(false);
      
      // Evento de analytics: profile_updated
      console.log("Analytics: profile_updated");
    } catch (err) {
      console.error("Error al actualizar perfil:", err);
      setError("No se pudo actualizar el perfil. Intenta de nuevo.");
      setIsSubmitting(false);
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setError("Por favor selecciona una imagen válida");
      return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen es demasiado grande. Máximo 5MB.");
      return;
    }
    
    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProfileImage(event.target.result as string);
        
        // Evento de analytics: profile_photo_updated
        console.log("Analytics: profile_photo_updated");
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ahorro-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Mi Perfil</h1>
            <p className="text-text-secondary">Edita tu información personal</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push("/dashboard")}
          >
            Volver
          </Button>
        </div>
        
        <Card className="overflow-hidden mb-6">
          <CardContent className="p-6">
            {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
            {success && <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">{success}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Foto de perfil" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-ahorro-600 flex items-center justify-center text-white text-3xl font-semibold">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <label className="cursor-pointer">
                  <span className="text-sm text-ahorro-600 hover:underline">Cambiar foto</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Nombre*
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500"
                  placeholder="Tu nombre"
                  required
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:border-ahorro-500 bg-gray-50"
                  placeholder="tu@email.com"
                  readOnly
                />
                <p className="text-xs text-text-secondary mt-1">El email no se puede modificar</p>
              </div>
              
              <Button 
                type="submit" 
                variant="primary"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
