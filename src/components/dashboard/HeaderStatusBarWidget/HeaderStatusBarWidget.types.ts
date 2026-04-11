export type HeaderStatusBarProps = {
  userName: string;
  userAvatar?: string;
  streak?: number;
  totalSaved?: number;
  onOpenProfile: () => void;
  onOpenMedalDetail?: () => void;
};
