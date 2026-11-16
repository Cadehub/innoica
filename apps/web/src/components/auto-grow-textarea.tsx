'use client';

import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export interface AutoGrowTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
  maxHeight?: number;
  submitOnEnter?: boolean;
  onEnterSubmit?: () => void;
}

export const AutoGrowTextarea = React.forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea(
    {
      minHeight = 44,
      maxHeight = 200,
      submitOnEnter = false,
      onEnterSubmit,
      onChange,
      onKeyDown,
      value,
      className = '',
      style,
      ...rest
    },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

    const adjustHeight = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
      el.style.height = `${nextHeight}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [minHeight, maxHeight]);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => adjustHeight());
      observer.observe(el);
      return () => observer.disconnect();
    }, [adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      requestAnimationFrame(adjustHeight);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        submitOnEnter &&
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault();
        onEnterSubmit?.();
        return;
      }
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={innerRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          ...style,
        }}
        className={`resize-none transition-[height] duration-100 ease-out ${className}`}
        {...rest}
      />
    );
  }
);
