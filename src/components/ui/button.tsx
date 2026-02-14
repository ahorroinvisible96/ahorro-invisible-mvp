import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  onClick,
  type = "button",
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ahorro-500 focus:ring-opacity-50 rounded-pill";
  
  const variantStyles = {
    primary: "bg-ahorro-600 text-white hover:bg-ahorro-700 active:bg-ahorro-800",
    secondary: "bg-ahorro-100 text-ahorro-700 hover:bg-ahorro-200 active:bg-ahorro-300",
    outline: "border border-ahorro-600 text-ahorro-600 bg-transparent hover:bg-ahorro-50 active:bg-ahorro-100",
    ghost: "text-ahorro-600 hover:bg-ahorro-50 active:bg-ahorro-100",
    link: "text-ahorro-600 underline-offset-4 hover:underline",
  };
  
  const sizeStyles = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3",
  };
  
  const widthStyles = fullWidth ? "w-full" : "";
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${disabledStyles} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
