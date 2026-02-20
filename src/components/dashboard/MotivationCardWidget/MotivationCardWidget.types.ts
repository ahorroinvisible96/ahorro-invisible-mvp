export type MotivationIntensity = 'low' | 'medium' | 'high' | 'unknown';

export type MotivationCardWidgetProps = {
  intensity: MotivationIntensity;
  onAdjustRules: () => void;
};
