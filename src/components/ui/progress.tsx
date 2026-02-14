import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'yellow';
}

export function Progress({
  value,
  max = 100,
  className = "",
  showPercentage = false,
  size = "md",
  color = "blue"
}: ProgressProps) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);
  
  const sizeStyles = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };
  
  const colorStyles = {
    blue: "bg-ahorro-500",
    green: "bg-accent-green",
    red: "bg-accent-red",
    yellow: "bg-accent-yellow",
  };
  
  return (
    <div className={`w-full ${className}`}>
      {showPercentage && (
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium">{value}</span>
          <span>{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeStyles[size]}`}>
        <div 
          className={`${colorStyles[color]} ${sizeStyles[size]} rounded-full transition-all duration-300`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
