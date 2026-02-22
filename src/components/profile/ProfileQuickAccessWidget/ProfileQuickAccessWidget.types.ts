export type QuickAccessItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
};

export type ProfileQuickAccessWidgetProps = {
  onGoToSettings: () => void;
  onGoToGoals: () => void;
  onGoToHistory: () => void;
};
