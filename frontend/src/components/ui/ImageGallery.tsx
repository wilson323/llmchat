/**
 * 优化图片画廊组件
 *
 * 支持懒加载、虚拟化、响应式布局
 */

'use client';


import { ChevronLeft, ChevronRight, Download, Grid3x3, Maximize2 } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { OptimizedImage } from './OptimizedImage';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';


import { cn } from '@/lib/utils';

interface ImageItem {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

interface ImageGalleryProps {
  images: ImageItem[];
  className?: string;
  height?: number;
  lazy?: boolean;
  quality?: number;
  layout?: 'grid' | 'masonry' | 'list';
  columns?: number;
  gap?: number;
  onImageClick?: (image: ImageItem, index: number) => void;
  showThumbnails?: boolean;
  showControls?: boolean;
  enableDownload?: boolean;
  enableFullscreen?: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  className = '',
  height = 600,
  lazy = true,
  quality = 80,
  layout = 'grid',
  columns = 3,
  gap = 16,
  onImageClick,
  showThumbnails = true,
  showControls = true,
  enableDownload = true,
  enableFullscreen = true,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState('gallery');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  // 当前选中的图片
  const selectedImage = useMemo(() => {
    return images[selectedIndex] || null;
  }, [images, selectedIndex]);

  // 虚拟滚动计算
  const {
    virtualItems,
    totalHeight,
    scrollToIndex,
  } = useVirtualScroll({
    itemHeight: useCallback((index: number) => {
      if (layout === 'list') {
        return 120; // 列表项高度
      }

      const image = images[index];
      if (!image) {
        return 200;
      }

      // 网格/瀑布流布局高度估算
      const aspectRatio = image.width && image.height ? image.height / image.width : 0.75;
      const itemWidth = (containerRef.current?.clientWidth || 800) / columns - gap * (columns - 1) / columns;
      return Math.round(itemWidth * aspectRatio) + 80; // 80px 为内容区域高度
    }, [images, layout, columns, gap]),
    containerHeight: height,
    itemCount: images.length,
    overscan: 3,
  });

  // 虚拟化数据
  const virtualItemsData = useMemo(() => {
    return virtualItems.map(({ index, key, start, size }) => ({
      index,
      key: key || `image-${index}`,
      data: images[index],
      start,
      size,
    }));
  }, [virtualItems, images]);

  // 处理图片点击
  const handleImageClick = useCallback((image: ImageItem, index: number) => {
    setSelectedIndex(index);
    setIsTransitioning(true);
    setTimeout(() => {
      setViewMode('viewer');
      setIsTransitioning(false);
    }, 100);
    onImageClick?.(image, index);
  }, [onImageClick]);

  // 导航控制
  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex);
    }
  }, [selectedIndex, scrollToIndex]);

  const handleNext = useCallback(() => {
    if (selectedIndex < images.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex);
    }
  }, [selectedIndex, images.length, scrollToIndex]);

  // 缩略图导航
  const handleThumbnailClick = useCallback((index: number) => {
    setSelectedIndex(index);
    scrollToIndex(index);
  }, [scrollToIndex]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'viewer') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'Escape':
          e.preventDefault();
          setViewMode('gallery');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, handlePrevious, handleNext]);

  // 下载功能
  const handleDownload = useCallback(() => {
    if (!selectedImage) {
      return;
    }

    const link = document.createElement('a');
    link.href = selectedImage.src;
    link.download = selectedImage.title || `image-${selectedImage.id}`;
    link.click();
  }, [selectedImage]);

  // 全屏功能
  const handleFullscreen = useCallback(() => {
    if (!viewerRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      viewerRef.current.requestFullscreen();
    }
  }, []);

  // 渲染图片项
  const renderImageItem = useCallback((item: typeof virtualItemsData[0]) => {
    const { index, data: image } = item;

    if (!image) {
      return null;
    }

    const isList = layout === 'list';
    const itemStyle = {
      position: 'absolute' as const,
      top: item.start,
      left: isList ? 0 : undefined,
      right: isList ? 0 : undefined,
      width: isList ? '100%' : undefined,
      height: item.size,
      marginBottom: gap,
    };

    return (
      <div
        key={item.key}
        style={itemStyle}
        className={cn(
          'group cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02]',
          isList ? 'flex gap-4 p-4 bg-card rounded-lg shadow-sm' : 'relative',
          !isList && 'rounded-lg overflow-hidden bg-card shadow-sm',
        )}
        onClick={() => handleImageClick(image, index)}
        >
        {isList ? (
          <>
            <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden">
              <OptimizedImage
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover"
                lazy={lazy}
                quality={quality}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate mb-1">
                {image.title || image.alt}
              </h3>
              {image.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {image.description}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="relative aspect-video">
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
              lazy={lazy}
              quality={quality}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-medium truncate mb-1">
                  {image.title || image.alt}
                </h3>
                {image.description && (
                  <p className="text-sm opacity-90 line-clamp-2">
                    {image.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [layout, gap, lazy, quality, handleImageClick]);

  // 渲染缩略图
  const renderThumbnails = useCallback(() => {
    if (!showThumbnails) {
      return null;
    }

    return (
      <div className="flex gap-2 p-4 overflow-x-auto">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => handleThumbnailClick(index)}
            className={cn(
              'flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all',
              index === selectedIndex
                ? 'border-primary ring-2 ring-primary/50'
                : 'border-transparent hover:border-gray-300',
            )}
          >
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover"
              quality={60}
            />
          </button>
        ))}
      </div>
    );
  }, [images, selectedIndex, showThumbnails, handleThumbnailClick]);

  // 查看器模式
  if (viewMode === 'viewer' && selectedImage) {
    return (
      <div
        ref={viewerRef}
        className={cn(
          'fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col',
          'transition-opacity duration-300',
          isTransitioning ? 'opacity-0' : 'opacity-100',
        )}
        >
        {/* 头部控制栏 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <button
            onClick={() => setViewMode('gallery')}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            返回画廊
          </button>

          <div className="flex items-center gap-4">
            <span className="text-white text-sm">
              {selectedIndex + 1} / {images.length}
            </span>

            {enableDownload && (
              <button
                onClick={handleDownload}
                className="text-white hover:text-gray-300 transition-colors"
                title="下载图片"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {enableFullscreen && (
              <button
                onClick={handleFullscreen}
                className="text-white hover:text-gray-300 transition-colors"
                title="全屏"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 主图片区域 */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative max-w-full max-h-full">
            <OptimizedImage
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-w-full max-h-full object-contain"
              priority
              quality={90}
            />

            {/* 图片信息 */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="text-white">
                <h2 className="text-xl font-semibold mb-2">
                  {selectedImage.title || selectedImage.alt}
                </h2>
                {selectedImage.description && (
                  <p className="text-sm opacity-90">
                    {selectedImage.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 导航控制 */}
        {showControls && images.length > 1 && (
          <div className="flex items-center justify-between p-4">
            <button
              onClick={handlePrevious}
              disabled={selectedIndex === 0}
              className={cn(
                'text-white hover:text-gray-300 transition-colors',
                selectedIndex === 0 && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {renderThumbnails()}

            <button
              onClick={handleNext}
              disabled={selectedIndex === images.length - 1}
              className={cn(
                'text-white hover:text-gray-300 transition-colors',
                selectedIndex === images.length - 1 && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 画廊模式
  return (
    <div
      ref={containerRef}
      className={cn('relative bg-background', className)}
      style={{ height }}
      >
      {/* 视图切换按钮 */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => {
            setViewMode(viewMode === 'gallery' ? 'viewer' : 'gallery');
          }}
          className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-2 rounded-lg shadow-md hover:bg-white dark:hover:bg-gray-700 transition-colors"
          title={viewMode === 'gallery' ? '查看器模式' : '画廊模式'}
        >
          {viewMode === 'gallery' ? <Maximize2 className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
        </button>
      </div>

      {/* 虚拟滚动容器 */}
      <div className="h-full relative">
        <div style={{ height: totalHeight, position: 'relative' }}>
          {virtualItemsData.map(renderImageItem)}
        </div>
      </div>

      {/* 图片计数 */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-md text-sm">
        共 {images.length} 张图片
      </div>
    </div>
  );
};

export default ImageGallery;