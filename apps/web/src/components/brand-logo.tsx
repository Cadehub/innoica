import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  compact?: boolean;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BrandLogo({
  compact = false,
  subtitle = 'Agent Studio',
  size = 'md',
  className = '',
}: BrandLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }[size];

  const imgPx = size === 'sm' ? 24 : size === 'lg' ? 40 : 32;

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <div
        className={`relative shrink-0 overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-zinc-800/80 shadow-xs flex items-center justify-center ${sizeClasses}`}
      >
        <Image
          src="/images/innoica-logo.jpg"
          alt="INNOICA"
          width={imgPx}
          height={imgPx}
          priority
          className="h-full w-full object-cover object-center"
        />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-tight text-zinc-900 leading-none truncate">
            INNOICA
          </div>
          <div className="hidden sm:block text-[10px] font-medium text-zinc-500 leading-tight mt-0.5 truncate font-mono">
            {subtitle}
          </div>
        </div>
      )}
    </div>
  );
}

