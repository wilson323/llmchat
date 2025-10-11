/**
 * 优化图片组件
 *
 * 功能特性：
 * - 懒加载支持
 * - 现代图片格式（WebP/AVIF）支持
 * - 响应式图片
 * - 加载状态和错误处理
 * - 性能优化
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  lazy?: boolean;
  placeholder?: string;
  fallbackFormat?: 'png' | 'jpg' | 'jpeg';
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: (error: React.SyntheticEvent<HTMLImageElement>) => void;
  style?: React.CSSProperties;
  priority?: boolean; // 高优先级图片（如首屏图片）
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  lazy = true,
  placeholder,
  fallbackFormat = 'jpg',
  quality = 80,
  sizes = '100vw',
  onLoad,
  onError,
  style,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 生成现代格式URL
  const generateModernFormatUrl = useCallback((originalSrc: string, format: 'webp' | 'avif') => {
    // 如果是外部URL，直接返回
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }

    // 本地图片处理
    if (originalSrc.startsWith('/')) {
      // 尝试使用现代格式
      const webpSrc = originalSrc.replace(/\.(png|jpg|jpeg)$/i, `.${format}`);
      return webpSrc;
    }

    // Base64 或其他格式直接返回
    return originalSrc;
  }, []);

  // 检测浏览器支持的格式
  const [supportedFormat, setSupportedFormat] = useState<'avif' | 'webp' | 'fallback'>('fallback');

  useEffect(() => {
    const checkFormatSupport = async () => {
      // 检测 AVIF 支持
      const avif = new Image();
      avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpY2FzAAAAAAHAAAAAApbWFhZAAAAAA=' +
        'AAAAAAAAAAAAAAAAAAoAAFBhY3FwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      await new Promise((resolve) => {
        avif.onload = () => {
          setSupportedFormat('avif');
          resolve(true);
        };
        avif.onerror = () => {
          resolve(false);
        };
        setTimeout(() => resolve(false), 100);
      });

      // 检测 WebP 支持
      const webp = new Image();
      webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';

      await new Promise((resolve) => {
        webp.onload = () => {
          if (supportedFormat === 'fallback') {
            setSupportedFormat('webp');
          }
          resolve(true);
        };
        webp.onerror = () => {
          resolve(false);
        };
        setTimeout(() => resolve(false), 100);
      });
    };

    checkFormatSupport();
  }, [supportedFormat]);

  // 设置图片源
  useEffect(() => {
    if (!src) return;

    const setImageSource = () => {
      let finalSrc = src;

      // 根据浏览器支持选择最佳格式
      if (supportedFormat === 'avif') {
        finalSrc = generateModernFormatUrl(src, 'avif');
      } else if (supportedFormat === 'webp') {
        finalSrc = generateModernFormatUrl(src, 'webp');
      }

      setCurrentSrc(finalSrc);
    };

    setImageSource();
  }, [src, supportedFormat, generateModernFormatUrl]);

  // 懒加载设置
  useEffect(() => {
    if (!lazy || priority || !imgRef.current) {
      if (imgRef.current && currentSrc) {
        imgRef.current.src = currentSrc;
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current) {
            imgRef.current.src = currentSrc;
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.01,
      }
    );

    observerRef.current = observer;
    observer.observe(imgRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [lazy, priority, currentSrc]);

  // 加载完成处理
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    setIsError(false);
    onLoad?.();
  }, [onLoad]);

  // 错误处理
  const handleError = useCallback((error: React.SyntheticEvent<HTMLImageElement>) => {
    if (!currentSrc.includes(fallbackFormat) && supportedFormat !== 'fallback') {
      // 尝试使用原始格式
      setCurrentSrc(src);
    } else {
      setIsError(true);
      setIsLoaded(false);
      onError?.(error);
    }
  }, [currentSrc, fallbackFormat, src, supportedFormat, onError]);

  // 生成响应式srcset
  const generateSrcSet = useCallback(() => {
    if (currentSrc.startsWith('data:')) {
      return '';
    }

    const baseSrc = currentSrc.split('?')[0];
    const query = currentSrc.includes('?') ? currentSrc.split('?')[1] : '';
    const baseUrl = baseSrc.includes('/') ? baseSrc.substring(0, baseSrc.lastIndexOf('/') + 1) : '';
    const filename = baseSrc.includes('/') ? baseSrc.substring(baseSrc.lastIndexOf('/') + 1) : baseSrc;
    const nameWithoutExt = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;

    // 生成不同尺寸的图片URL
    const sizes = [320, 640, 768, 1024, 1280, 1536];
    return sizes
      .map(size => {
        const sizedFilename = `${nameWithoutExt}_${size}w${filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : ''}`;
        return `${baseUrl}${sizedFilename}${query ? '?' + query : ''} ${size}w`;
      })
      .join(', ');
  }, [currentSrc]);

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'transition-all duration-300 ease-in-out',
        isLoaded ? 'opacity-100' : 'opacity-0',
        isError && 'bg-gray-200 dark:bg-gray-700',
        className
      )}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
        aspectRatio: width && height ? `${width}/${height}` : undefined,
        ...style,
      }}
    >
      {/* 占位符 */}
      {placeholder && !isLoaded && !isError && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 animate-pulse"
          style={{
            backgroundImage: `url(${placeholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(10px)',
          }}
        />
      )}

      {/* 加载指示器 */}
      {!isLoaded && !isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {/* 错误状态 */}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
          <div className="text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              图片加载失败
            </p>
          </div>
        </div>
      )}

      {/* 优化后的图片 */}
      <img
        ref={imgRef}
        alt={alt}
        className={cn(
          'w-full h-full object-contain transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        src={(!lazy || priority) ? currentSrc : undefined}
        srcSet={generateSrcSet()}
        sizes={sizes}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* 性能标记（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-0 left-0 bg-black/50 text-white text-xs p-1 rounded-br">
          {supportedFormat.toUpperCase()}
          {isLoaded && ' ✓'}
        </div>
      )}
    </div>
  );
};

// 高阶组件：为现有图片添加优化
export const withOptimization = (ImgComponent: React.ComponentType<any>) => {
  return React.memo(function OptimizedWrapper(props: any) {
    return (
      <OptimizedImage
        src={props.src}
        alt={props.alt || ''}
        width={props.width}
        height={props.height}
        className={props.className}
        priority={props.priority}
      />
    );
  });
};

export default OptimizedImage;