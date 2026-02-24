export type MotivationIntensity = 'low' | 'medium' | 'high' | 'unknown';

export type MotivationLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

export type MotivationCardWidgetProps = {
  intensity: MotivationIntensity;
  streak: number;          // días consecutivos con decisión completada
  totalSaved: number;      // euros totales ahorrados
  moneyFeeling?: string | null;
  onAdjustRules: () => void;
};
