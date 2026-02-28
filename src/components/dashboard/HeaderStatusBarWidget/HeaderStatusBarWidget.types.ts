export type HeaderStatusBarProps = {
  userName: string;
  userAvatar?: string;
  streak?: number;
  onOpenProfile: () => void;
  onOpenSettings?: () => void;
};
