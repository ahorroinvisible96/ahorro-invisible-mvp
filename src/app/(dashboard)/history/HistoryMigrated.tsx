"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { analytics } from '@/services/analytics';

interface Decision {
  id: string;
  date: string;
  question: string;
  decision: string;
  saved_amount: number;
  impact: {
    trees: number;
    co2: number;
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Establecer el nombre de la pantalla para analytics
    analytics.setScreen('history');
    
    // Verificar autenticación
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.replace("/signup");
      return;
    }
    
    // Cargar datos
    loadDecisions();
  }, [router]);
  
  const loadDecisions = () => {
    try {
      setIsLoading(true);
      
      // Cargar decisiones del localStorage
      const storedDecisions = localStorage.getItem("dailyDecisions");
      if (storedDecisions) {
        const parsedDecisions = JSON.parse(storedDecisions);
        // Ordenar por fecha (más reciente primero)
        const sortedDecisions = parsedDecisions.sort((a: Decision, b: Decision) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setDecisions(sortedDecisions);
      }
      
      // Registrar evento de visualización
      analytics.historyViewed();
      
    } catch (error) {
      console.error("Error al cargar decisiones:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewImpact = (decisionId: string) => {
    router.push(`/impact/${decisionId}`);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
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
      title="Historial de Decisiones"
      subtitle="Revisa todas tus decisiones de ahorro y su impacto"
    >
      <div className="space-y-6">
        {decisions.length > 0 ? (
          decisions.map((decision) => (
            <Card 
              key={decision.id}
              variant="default"
              size="md"
              interactive
              onClick={() => handleViewImpact(decision.id)}
            >
              <Card.Content>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="primary" size="sm">
                        {formatDate(decision.date)}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-1">
                      {decision.question}
                    </h3>
                    <p className="text-gray-600">
                      {decision.decision}
                    </p>
                  </div>
                  
                  <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end">
                    <div className="text-xl font-bold text-primary-500">
                      {formatCurrency(decision.saved_amount)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-500">
                        {decision.impact.trees} árboles
                      </span>
                      <span className="text-xs">•</span>
                      <span className="text-sm text-gray-500">
                        {decision.impact.co2} kg CO₂
                      </span>
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Card variant="default" size="md">
            <Card.Content>
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">
                  Aún no has tomado ninguna decisión de ahorro.
                </p>
                <p className="text-gray-500">
                  Completa tu primera decisión diaria para comenzar a ver tu historial.
                </p>
              </div>
            </Card.Content>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
