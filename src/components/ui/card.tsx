import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
  highlight?: boolean;
}

export function Card({ 
  children, 
  className = "", 
  bordered = false,
  highlight = false 
}: CardProps) {
  return (
    <div 
      className={`
        bg-white rounded-xl shadow-card 
        ${bordered ? 'border border-ahorro-100' : ''} 
        ${highlight ? 'border-2 border-ahorro-500' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ 
  children, 
  className = "" 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-5 border-b border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ 
  children, 
  className = "" 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-lg font-medium text-text-primary ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ 
  children, 
  className = "" 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-text-secondary mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ 
  children, 
  className = "" 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ 
  children, 
  className = "" 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-5 border-t border-gray-100 ${className}`}>
      {children}
    </div>
  );
}
