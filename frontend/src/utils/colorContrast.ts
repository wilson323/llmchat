/**
 * 色彩对比度检测工具
 * 用于验证WCAG AA级别的色彩对比度要求
 */

export interface ContrastResult {
  ratio: number;
  wcagLevel: 'AAA' | 'AA' | 'fail';
  recommendation: string;
  passesNormalText: boolean;
  passesLargeText: boolean;
}

/**
 * 计算相对亮度 (Relative Luminance)
 * @param hex - 十六进制颜色值
 */
export function calculateRelativeLuminance(hex: string): number {
  // 移除 # 前缀
  const cleanHex = hex.replace('#', '');

  // 转换为RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // 应用sRGB到线性RGB的转换
  const toLinear = (value: number): number => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // 计算相对亮度
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * 计算对比度
 * @param color1 - 第一个颜色（十六进制）
 * @param color2 - 第二个颜色（十六进制）
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const luminance1 = calculateRelativeLuminance(color1);
  const luminance2 = calculateRelativeLuminance(color2);

  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 检查WCAG合规性
 * @param ratio - 对比度比值
 */
export function checkWCAGCompliance(ratio: number): {
  level: 'AAA' | 'AA' | 'fail';
  normalText: boolean;
  largeText: boolean;
} {
  const normalTextAA = ratio >= 4.5;
  const normalTextAAA = ratio >= 7;
  const largeTextAA = ratio >= 3;
  const largeTextAAA = ratio >= 4.5;

  let level: 'AAA' | 'AA' | 'fail';
  if (normalTextAAA && largeTextAAA) {
    level = 'AAA';
  } else if (normalTextAA && largeTextAA) {
    level = 'AA';
  } else {
    level = 'fail';
  }

  return {
    level,
    normalText: normalTextAA,
    largeText: largeTextAA
  };
}

/**
 * 完整的对比度分析
 * @param foreground - 前景色
 * @param background - 背景色
 */
export function analyzeContrast(foreground: string, background: string): ContrastResult {
  const ratio = calculateContrastRatio(foreground, background);
  const compliance = checkWCAGCompliance(ratio);

  let recommendation = '';
  if (compliance.level === 'AAA') {
    recommendation = '对比度优秀，符合AAA级别标准';
  } else if (compliance.level === 'AA') {
    recommendation = '对比度良好，符合AA级别标准';
  } else {
    recommendation = `对比度不足，当前为 ${ratio.toFixed(2)}:1，需要至少 4.5:1（普通文本）或 3:1（大文本）`;
  }

  return {
    ratio,
    wcagLevel: compliance.level,
    recommendation,
    passesNormalText: compliance.normalText,
    passesLargeText: compliance.largeText
  };
}

/**
 * 颜色优化建议
 * @param color - 需要优化的颜色
 * @param targetColor - 目标颜色
 * @param targetRatio - 目标对比度（默认4.5）
 */
export function optimizeColorForContrast(
  color: string,
  targetColor: string,
  targetRatio: number = 4.5
): string {
  const currentRatio = calculateContrastRatio(color, targetColor);

  if (currentRatio >= targetRatio) {
    return color; // 已经满足要求
  }

  // 将十六进制转换为HSL
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  // HSL转十六进制
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const hsl = hexToHSL(color);
  const targetHSL = hexToHSL(targetColor);

  // 优化亮度
  let optimizedL = hsl.l;
  let step = 1;

  // 判断是亮色还是暗色背景
  const targetL = targetHSL.l;
  const shouldDarken = targetL > 50; // 背景较亮，文字需要加深

  while (step < 100) { // 防止无限循环
    if (shouldDarken) {
      optimizedL = Math.max(0, hsl.l - step);
    } else {
      optimizedL = Math.min(100, hsl.l + step);
    }

    const optimizedColor = hslToHex(hsl.h, hsl.s, optimizedL);
    const newRatio = calculateContrastRatio(optimizedColor, targetColor);

    if (newRatio >= targetRatio) {
      return optimizedColor;
    }

    step += 1;
  }

  // 如果无法达到目标对比度，返回黑色或白色
  return shouldDarken ? '#000000' : '#ffffff';
}

/**
 * 项目色彩系统验证
 */
export function validateProjectColorSystem(): void {
  console.log('🎨 开始验证项目色彩系统...');

  const colorSystem = {
    // 亮色模式
    light: {
      brand: '#16a34a',
      text: '#111827',
      background: '#ffffff',
      muted: '#374151',
      border: '#d1d5db',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0891b2'
    },
    // 暗色模式
    dark: {
      brand: '#22c55e',
      text: '#f9fafb',
      background: '#111827',
      muted: '#d1d5db',
      border: '#374151',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4'
    }
  };

  const testCases = [
    { name: '品牌色文字', foreground: 'white', background: 'brand' },
    { name: '主要文字', foreground: 'text', background: 'background' },
    { name: '次要文字', foreground: 'muted', background: 'background' },
    { name: '边框对比', foreground: 'border', background: 'background' },
    { name: '成功文字', foreground: 'white', background: 'success' },
    { name: '警告文字', foreground: 'white', background: 'warning' },
    { name: '错误文字', foreground: 'white', background: 'error' },
    { name: '信息文字', foreground: 'white', background: 'info' }
  ];

  const results: Array<{ mode: string; test: string; result: ContrastResult }> = [];

  // 测试亮色模式
  Object.entries(colorSystem.light).forEach(([key, value]) => {
    testCases.forEach(testCase => {
      if (testCase.background === key) {
        const foreground = testCase.foreground === 'white' ? '#ffffff' : colorSystem.light[testCase.foreground as keyof typeof colorSystem.light];
        if (foreground) {
          const result = analyzeContrast(foreground, value);
          results.push({
            mode: 'light',
            test: testCase.name,
            result
          });
        }
      }
    });
  });

  // 测试暗色模式
  Object.entries(colorSystem.dark).forEach(([key, value]) => {
    testCases.forEach(testCase => {
      if (testCase.background === key) {
        const foreground = testCase.foreground === 'white' ? '#ffffff' : colorSystem.dark[testCase.foreground as keyof typeof colorSystem.dark];
        if (foreground) {
          const result = analyzeContrast(foreground, value);
          results.push({
            mode: 'dark',
            test: testCase.name,
            result
          });
        }
      }
    });
  });

  // 输出结果
  console.log('\n📊 色彩对比度验证结果：');
  console.log('=' .repeat(60));

  let passCount = 0;
  let totalCount = results.length;

  results.forEach(({ mode, test, result }) => {
    const status = result.passesNormalText ? '✅' : '❌';
    const level = result.wcagLevel;
    const ratio = result.ratio.toFixed(2);

    console.log(`${status} ${mode.toUpperCase()} - ${test}: ${ratio}:1 (${level})`);

    if (result.passesNormalText) {
      passCount++;
    } else {
      console.log(`   ⚠️  建议: ${result.recommendation}`);
    }
  });

  console.log('=' .repeat(60));
  console.log(`📈 合规率: ${passCount}/${totalCount} (${((passCount / totalCount) * 100).toFixed(1)}%)`);

  if (passCount === totalCount) {
    console.log('🎉 所有色彩对比度都符合WCAG AA标准！');
  } else {
    console.log('⚠️  部分色彩对比度需要优化以达到WCAG AA标准');
  }

  // 返回undefined，因为这是一个void函数
  return;
}

// 开发模式下自动验证色彩系统
if (process.env.NODE_ENV === 'development') {
  // 延迟执行，确保在模块加载后运行
  setTimeout(() => {
    try {
      validateProjectColorSystem();
    } catch (error) {
      console.error('色彩系统验证失败:', error);
    }
  }, 1000);
}