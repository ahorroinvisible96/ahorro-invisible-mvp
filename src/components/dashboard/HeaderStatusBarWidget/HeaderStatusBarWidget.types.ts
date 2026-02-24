export type HeaderStatusBarProps = {
  userName: string;
  systemActive: boolean;
  userAvatar?: string;
  motivationalPhrase?: string;
  streak?: number;
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
};
