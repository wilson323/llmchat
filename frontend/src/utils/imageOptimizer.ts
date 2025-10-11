/**
 * 图片优化工具类
 *
 * 提供图片压缩、格式转换、批量处理等功能
 */

interface ImageOptimizationOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  progressive?: boolean;
}

interface ImageInfo {
  width: number;
  height: number;
  size: number;
  format: string;
  quality?: number;
}

export class ImageOptimizer {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  constructor() {
    if (typeof window !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  /**
   * 检测浏览器支持的图片格式
   */
  static async getSupportedFormats(): Promise<{
    webp: boolean;
    avif: boolean;
  }> {
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

    return {
      webp: await checkWebP(),
      avif: await checkAVIF(),
    };
  }

  /**
   * 获取图片信息
   */
  static async getImageInfo(src: string): Promise<ImageInfo> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: 0, // 需要通过其他方式获取
          format: src.split('.').pop()?.toLowerCase() || 'unknown',
        });
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * 压缩图片
   */
  async compressImage(
    file: File,
    options: ImageOptimizationOptions = {}
  ): Promise<{ blob: Blob; info: ImageInfo }> {
    const {
      quality = 0.8,
      maxWidth = 1920,
      maxHeight = 1080,
      format = 'webp',
      // progressive = true, // 暂时未使用
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 计算新尺寸
          let { width, height } = this.calculateDimensions(
            img.naturalWidth,
            img.naturalHeight,
            maxWidth,
            maxHeight
          );

          // 设置画布尺寸
          this.canvas.width = width;
          this.canvas.height = height;

          // 绘制图片
          this.ctx.drawImage(img, 0, 0, width, height);

          // 转换为指定格式
          this.canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({
                  blob,
                  info: {
                    width,
                    height,
                    size: blob.size,
                    format,
                    quality,
                  },
                });
              } else {
                reject(new Error('图片压缩失败'));
              }
            },
            this.getMimeType(format),
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 批量压缩图片
   */
  async compressImages(
    files: File[],
    options: ImageOptimizationOptions = {}
  ): Promise<Array<{ file: File; blob: Blob; info: ImageInfo }>> {
    const promises = files.map(async (file) => {
      try {
        const { blob, info } = await this.compressImage(file, options);
        const compressedFile = new File([blob], file.name, {
          type: blob.type,
          lastModified: Date.now(),
        });

        return {
          file: compressedFile,
          blob,
          info,
        };
      } catch (error) {
        console.error(`压缩图片失败 ${file.name}:`, error);
        throw error;
      }
    });

    return Promise.all(promises);
  }

  /**
   * 创建响应式图片集
   */
  async createResponsiveImageSet(
    file: File,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1536],
    options: ImageOptimizationOptions = {}
  ): Promise<Array<{ size: number; blob: Blob; info: ImageInfo }>> {
    const promises = sizes.map(async (size) => {
      const optimizedOptions = {
        ...options,
        maxWidth: size,
        maxHeight: Math.round(size * 0.75), // 4:3 比例
      };

      const { blob, info } = await this.compressImage(file, optimizedOptions);
      return {
        size,
        blob,
        info,
      };
    });

    return Promise.all(promises);
  }

  /**
   * 生成WebP格式的回退方案
   */
  async generateWebPFallback(src: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 支持跨域图片

      img.onload = () => {
        try {
          this.canvas.width = img.naturalWidth;
          this.canvas.height = img.naturalHeight;
          this.ctx.drawImage(img, 0, 0);

          const webpDataUrl = this.canvas.toDataURL('image/webp', 0.8);
          resolve(webpDataUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  }

  /**
   * 生成低质量占位符 (LQIP)
   */
  async generateLQIP(src: string, quality: number = 0.1): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const targetWidth = Math.min(img.naturalWidth, 64);
          const targetHeight = Math.min(img.naturalHeight, 64);
          const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);

          this.canvas.width = Math.round(img.naturalWidth * scale);
          this.canvas.height = Math.round(img.naturalHeight * scale);

          // 降低图片质量
          this.ctx.imageSmoothingEnabled = false;
          this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

          const lqipUrl = this.canvas.toDataURL('image/jpeg', quality);
          resolve(lqipUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('LQIP生成失败'));
      img.src = src;
    });
  }

  /**
   * 生成SVG占位符
   */
  static generateSVGPlaceholder(width: number, height: number, text?: string): string {
    const svgContent = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="14" fill="#9ca3af">
          ${text || 'Loading...'}
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
  }

  /**
   * 计算压缩后的尺寸
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    // 按宽度限制
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    // 按高度限制
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  /**
   * 获取MIME类型
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      webp: 'image/webp',
      avif: 'image/avif',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };

    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }

  /**
   * 估算压缩后的大小
   */
  static estimateCompressedSize(
    originalSize: number,
    originalFormat: string,
    targetFormat: string,
    quality: number = 0.8
  ): number {
    // 基于经验的压缩比例
    const compressionRatios: Record<string, Record<string, number>> = {
      webp: {
        png: 0.25,
        jpg: 0.85,
        jpeg: 0.85,
      },
      avif: {
        png: 0.15,
        jpg: 0.75,
        jpeg: 0.75,
      },
      jpg: {
        png: 0.8,
        jpg: 1,
        jpeg: 1,
      },
      png: {
        png: 1,
        jpg: 1.2,
        jpeg: 1.2,
      },
    };

    const baseRatio = compressionRatios[targetFormat]?.[originalFormat] || 1;
    const qualityFactor = targetFormat === 'webp' || targetFormat === 'avif' ? quality : 1;

    return Math.round(originalSize * baseRatio * qualityFactor);
  }

  /**
   * 分析图片优化潜力
   */
  static analyzeOptimizationPotential(
    width: number,
    height: number,
    format: string,
    size: number
  ): {
      webpPotential: number;
      avifPotential: number;
      resizePotential: number;
      totalPotential: number;
      recommendations: string[];
    } {
    const recommendations: string[] = [];

    // WebP 优化潜力
    const webpPotential = this.estimateCompressedSize(size, format, 'webp');
    if (webpPotential < size * 0.8) {
      recommendations.push('使用WebP格式可减少 ' + Math.round((1 - webpPotential / size) * 100) + '% 文件大小');
    }

    // AVIF 优化潜力
    const avifPotential = this.estimateCompressedSize(size, format, 'avif');
    if (avifPotential < size * 0.6) {
      recommendations.push('使用AVIF格式可减少 ' + Math.round((1 - avifPotential / size) * 100) + '% 文件大小');
    }

    // 尺寸优化潜力
    let resizePotential = 0;
    if (width > 1920 || height > 1080) {
      const targetWidth = Math.min(width, 1920);
      const targetHeight = Math.min(height, 1080);
      const scale = Math.min(targetWidth / width, targetHeight / height);
      resizePotential = Math.round(size * (1 - scale * scale));

      if (resizePotential > 0) {
        recommendations.push('调整尺寸到 ' + targetWidth + 'x' + targetHeight + ' 可减少 ' + Math.round((resizePotential / size) * 100) + '% 文件大小');
      }
    }

    const totalPotential = Math.max(webpPotential, avifPotential) - resizePotential;

    return {
      webpPotential,
      avifPotential,
      resizePotential,
      totalPotential,
      recommendations,
    };
  }
}

// 导出便捷方法
export const optimizeImage = (file: File, options?: ImageOptimizationOptions) => {
  const optimizer = new ImageOptimizer();
  return optimizer.compressImage(file, options);
};

export const optimizeImages = (files: File[], options?: ImageOptimizationOptions) => {
  const optimizer = new ImageOptimizer();
  return optimizer.compressImages(files, options);
};

export const createResponsiveSet = (file: File, sizes?: number[], options?: ImageOptimizationOptions) => {
  const optimizer = new ImageOptimizer();
  return optimizer.createResponsiveImageSet(file, sizes, options);
};

export default ImageOptimizer;