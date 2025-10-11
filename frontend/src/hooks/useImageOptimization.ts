/**
 * 图片优化Hook
 *
 * 提供图片优化相关的工具函数和状态管理
 */

import { useState, useCallback, useEffect } from 'react';

interface ImageOptimizationOptions {
  lazy?: boolean;
  priority?: boolean;
  quality?: number;
  formats?: ('webp' | 'avif' | 'fallback')[];
  placeholder?: string;
}

interface OptimizedImageState {
  isLoaded: boolean;
  isError: boolean;
  isLoading: boolean;
  src: string;
  supportedFormat: 'avif' | 'webp' | 'fallback';
}

export const useImageOptimization = (initialSrc: string, options: ImageOptimizationOptions = {}) => {
  const [state, setState] = useState<OptimizedImageState>({
    isLoaded: false,
    isError: false,
    isLoading: true,
    src: initialSrc,
    supportedFormat: 'fallback',
  });

  const {
    formats = ['avif', 'webp', 'fallback'],
    placeholder,
  } = options;

  // 检测浏览器支持的图片格式
  const checkFormatSupport = useCallback(async () => {
    const checkAVIF = (): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => {
          setTimeout(() => resolve(false), 100);
        };
        img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpY2FzAAAAAAHAAAAAApbWFhZAAAAAA=' +
          'AAAAAAAAAAAAAAAAAAoAAFBhY3FwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      });
    };

    const checkWebP = (): Promise<boolean> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => {
          setTimeout(() => resolve(false), 100);
        };
        img.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
      });
    };

    try {
      // 检查 AVIF 支持
      if (formats.includes('avif') && await checkAVIF()) {
        setState(prev => ({ ...prev, supportedFormat: 'avif' }));
        return 'avif';
      }

      // 检查 WebP 支持
      if (formats.includes('webp') && await checkWebP()) {
        setState(prev => ({ ...prev, supportedFormat: 'webp' }));
        return 'webp';
      }

      // 使用回退格式
      setState(prev => ({ ...prev, supportedFormat: 'fallback' }));
      return 'fallback';
    } catch (error) {
      console.warn('图片格式检测失败:', error);
      setState(prev => ({ ...prev, supportedFormat: 'fallback' }));
      return 'fallback';
    }
  }, [formats]);

  // 生成优化后的图片URL
  const generateOptimizedUrl = useCallback((originalSrc: string, format: string): string => {
    // 外部URL直接返回
    if (originalSrc.startsWith('http')) {
      return originalSrc;
    }

    // Base64 图片直接返回
    if (originalSrc.startsWith('data:')) {
      return originalSrc;
    }

    // 本地图片格式转换
    if (originalSrc.startsWith('/')) {
      const url = new URL(originalSrc, window.location.origin);
      const pathname = url.pathname;
      const extension = pathname.split('.').pop()?.toLowerCase();

      if (['png', 'jpg', 'jpeg'].includes(extension || '')) {
        return pathname.replace(/\.(png|jpg|jpeg)$/i, `.${format}`);
      }
    }

    return originalSrc;
  }, []);

  // 更新图片源
  const updateSrc = useCallback(async (newSrc: string) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      isLoaded: false,
      isError: false,
      src: newSrc,
    }));

    const format = await checkFormatSupport();
    const optimizedSrc = generateOptimizedUrl(newSrc, format === 'fallback' ? 'jpg' : format);

    setState(prev => ({ ...prev, src: optimizedSrc }));
  }, [checkFormatSupport, generateOptimizedUrl]);

  // 处理图片加载成功
  const handleLoad = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoaded: true,
      isLoading: false,
      isError: false,
    }));
  }, []);

  // 处理图片加载失败
  const handleError = useCallback(() => {
    setState(prev => ({
      ...prev,
      isLoaded: false,
      isLoading: false,
      isError: true,
    }));
  }, []);

  // 预加载图片
  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
      img.src = src;
    });
  }, []);

  // 生成响应式图片集
  const generateSrcSet = useCallback((baseSrc: string): string => {
    if (baseSrc.startsWith('data:') || baseSrc.startsWith('http')) {
      return '';
    }

    const baseUrl = baseSrc.split('?')[0];
    const query = baseSrc.includes('?') ? '?' + baseSrc.split('?')[1] : '';
    const url = new URL(baseUrl, window.location.origin);
    const pathname = url.pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();

    if (!['png', 'jpg', 'jpeg'].includes(extension || '')) {
      return '';
    }

    const nameWithoutExt = pathname.substring(0, pathname.lastIndexOf('.'));
    const sizes = [320, 640, 768, 1024, 1280, 1536, 1920];

    return sizes
      .map(size => `${nameWithoutExt}_${size}w.${extension}${query} ${size}w`)
      .join(', ');
  }, []);

  // 计算图片占位符
  const generatePlaceholder = useCallback((_src: string, width?: number, height?: number): string => {
    if (placeholder) {
      return placeholder;
    }

    // 创建简单的SVG占位符
    const w = width || 300;
    const h = height || 200;

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="14" fill="#9ca3af">
          Loading...
        </text>
      </svg>
    `.trim())}`;
  }, [placeholder]);

  // 初始化
  useEffect(() => {
    if (initialSrc) {
      updateSrc(initialSrc);
    }
  }, [initialSrc, updateSrc]);

  return {
    ...state,
    updateSrc,
    handleLoad,
    handleError,
    preloadImage,
    generateSrcSet,
    generatePlaceholder,
    checkFormatSupport,
  };
};

// 图片预加载工具
export const preloadImages = async (urls: string[]): Promise<void> => {
  const promises = urls.map(url => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
      img.src = url;
    });
  });

  await Promise.allSettled(promises);
};

// 批量图片优化
export const useBatchImageOptimization = (imageUrls: string[], options: ImageOptimizationOptions = {}) => {
  const [optimizedUrls, setOptimizedUrls] = useState<Record<string, string>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errorStates, setErrorStates] = useState<Record<string, boolean>>({});

  const optimizeImages = useCallback(async () => {
    const formatPromises = imageUrls.map(async (url) => {
      try {
        setLoadingStates(prev => ({ ...prev, [url]: true }));
        setErrorStates(prev => ({ ...prev, [url]: false }));

        // 检测格式支持
        const checkAVIF = (): Promise<boolean> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => setTimeout(() => resolve(false), 100);
            img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpY2FzAAAAAAHAAAAAApbWFhZAAAAAA=' +
              'AAAAAAAAAAAAAAAAAAoAAFBhY3FwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
          });
        };

        const checkWebP = (): Promise<boolean> => {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => setTimeout(() => resolve(false), 100);
            img.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
          });
        };

        let format = 'fallback';
        if (options.formats?.includes('avif') && await checkAVIF()) {
          format = 'avif';
        } else if (options.formats?.includes('webp') && await checkWebP()) {
          format = 'webp';
        }

        // 生成优化URL
        let optimizedUrl = url;
        if (!url.startsWith('http') && !url.startsWith('data:')) {
          const extension = url.split('.').pop()?.toLowerCase();
          if (['png', 'jpg', 'jpeg'].includes(extension || '')) {
            optimizedUrl = url.replace(/\.(png|jpg|jpeg)$/i, `.${format}`);
          }
        }

        setOptimizedUrls(prev => ({ ...prev, [url]: optimizedUrl }));
      } catch (error) {
        console.error(`图片优化失败 ${url}:`, error);
        setErrorStates(prev => ({ ...prev, [url]: true }));
      } finally {
        setLoadingStates(prev => ({ ...prev, [url]: false }));
      }
    });

    await Promise.all(formatPromises);
  }, [imageUrls, options.formats]);

  useEffect(() => {
    if (imageUrls.length > 0) {
      optimizeImages();
    }
  }, [imageUrls, optimizeImages]);

  return {
    optimizedUrls,
    loadingStates,
    errorStates,
    optimizeImages,
  };
};

export default useImageOptimization;