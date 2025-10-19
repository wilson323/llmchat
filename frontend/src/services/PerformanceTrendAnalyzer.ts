/**
 * 性能趋势分析和预测系统
 * 基于历史数据进行趋势分析、异常检测和性能预测
 */

export interface TrendDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  slope: number; // 趋势斜率
  confidence: number; // 置信度(0-1)
  volatility: number; // 波动性
  seasonality: number; // 季节性指数(0-1)
  anomalies: Array<{
    timestamp: number;
    value: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export interface PerformancePrediction {
  metric: string;
  timeframe: string; // 预测时间范围
  predictions: Array<{
    timestamp: number;
    value: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }>;
  accuracy: number; // 预测准确度
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface PerformanceInsight {
  type: 'trend' | 'anomaly' | 'prediction' | 'correlation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  data: any;
  timestamp: number;
}

class PerformanceTrendAnalyzer {
  private static instance: PerformanceTrendAnalyzer;
  private dataHistory: Map<string, TrendDataPoint[]> = new Map();
  private analyses: Map<string, TrendAnalysis> = new Map();
  private predictions: Map<string, PerformancePrediction> = new Map();
  private insights: PerformanceInsight[] = [];

  // 分析配置
  private config = {
    minDataPoints: 10, // 最少数据点数量
    anomalyThreshold: 2, // 异常检测阈值(标准差倍数)
    predictionHorizon: 7, // 预测时间范围(天)
    confidenceThreshold: 0.7, // 置信度阈值
    trendWindow: 30, // 趋势分析窗口(数据点数量)
    correlationThreshold: 0.6 // 相关性阈值
  };

  private constructor() {}

  static getInstance(): PerformanceTrendAnalyzer {
    if (!PerformanceTrendAnalyzer.instance) {
      PerformanceTrendAnalyzer.instance = new PerformanceTrendAnalyzer();
    }
    return PerformanceTrendAnalyzer.instance;
  }

  /**
   * 添加性能数据点
   */
  addDataPoint(metric: string, value: number, metadata?: Record<string, any>): void {
    if (!this.dataHistory.has(metric)) {
      this.dataHistory.set(metric, []);
    }

    const dataPoints = this.dataHistory.get(metric)!;
    dataPoints.push({
      timestamp: Date.now(),
      value,
      metadata
    });

    // 保持最近1000个数据点
    if (dataPoints.length > 1000) {
      dataPoints.splice(0, dataPoints.length - 1000);
    }

    // 触发分析
    this.analyzeTrend(metric);
    this.detectAnomalies(metric);
    this.generatePrediction(metric);
  }

  /**
   * 批量添加数据点
   */
  addDataPoints(metric: string, points: Array<{ timestamp: number; value: number; metadata?: Record<string, any> }>): void {
    if (!this.dataHistory.has(metric)) {
      this.dataHistory.set(metric, []);
    }

    const dataPoints = this.dataHistory.get(metric)!;
    dataPoints.push(...points);

    // 按时间排序
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // 保持最近1000个数据点
    if (dataPoints.length > 1000) {
      dataPoints.splice(0, dataPoints.length - 1000);
    }

    // 触发分析
    this.analyzeTrend(metric);
    this.detectAnomalies(metric);
    this.generatePrediction(metric);
  }

  /**
   * 分析趋势
   */
  analyzeTrend(metric: string): TrendAnalysis {
    const dataPoints = this.dataHistory.get(metric);
    if (!dataPoints || dataPoints.length < this.config.minDataPoints) {
      return this.getEmptyAnalysis(metric);
    }

    const recentData = dataPoints.slice(-this.config.trendWindow);
    const values = recentData.map(point => point.value);

    // 计算线性回归
    const regression = this.calculateLinearRegression(recentData);

    // 计算趋势方向
    const trend = regression.slope > 0.1 ? 'improving' :
                  regression.slope < -0.1 ? 'degrading' : 'stable';

    // 计算波动性
    const volatility = this.calculateVolatility(values);

    // 计算季节性
    const seasonality = this.detectSeasonality(recentData);

    // 检测异常
    const anomalies = this.detectAnomaliesInData(recentData);

    const analysis: TrendAnalysis = {
      metric,
      trend,
      slope: regression.slope,
      confidence: regression.r2,
      volatility,
      seasonality,
      anomalies
    };

    this.analyses.set(metric, analysis);
    return analysis;
  }

  /**
   * 检测异常
   */
  detectAnomalies(metric: string): TrendDataPoint[] {
    const dataPoints = this.dataHistory.get(metric);
    if (!dataPoints || dataPoints.length < this.config.minDataPoints) {
      return [];
    }

    return this.detectAnomaliesInData(dataPoints);
  }

  /**
   * 生成性能预测
   */
  generatePrediction(metric: string, timeframeDays: number = this.config.predictionHorizon): PerformancePrediction | null {
    const dataPoints = this.dataHistory.get(metric);
    if (!dataPoints || dataPoints.length < this.config.minDataPoints) {
      return null;
    }

    const analysis = this.analyses.get(metric);
    if (!analysis || analysis.confidence < this.config.confidenceThreshold) {
      return null;
    }

    // 使用多种预测方法
    const linearPrediction = this.predictLinear(dataPoints, timeframeDays);
    const seasonalPrediction = this.predictSeasonal(dataPoints, timeframeDays);
    const arimaPrediction = this.predictARIMA(dataPoints, timeframeDays);

    // 集成预测结果
    const ensemblePrediction = this.ensemblePredictions([linearPrediction, seasonalPrediction, arimaPrediction]);

    // 计算风险等级
    const riskLevel = this.calculateRiskLevel(ensemblePrediction, analysis);

    // 生成建议
    const recommendations = this.generateRecommendations(analysis, ensemblePrediction);

    const prediction: PerformancePrediction = {
      metric,
      timeframe: `${timeframeDays}天`,
      predictions: ensemblePrediction,
      accuracy: analysis.confidence,
      riskLevel,
      recommendations
    };

    this.predictions.set(metric, prediction);
    return prediction;
  }

  /**
   * 计算线性回归
   */
  private calculateLinearRegression(dataPoints: TrendDataPoint[]): { slope: number; intercept: number; r2: number } {
    const n = dataPoints.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const x = dataPoints.map((_, index) => index);
    const y = dataPoints.map(point => point.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算R²
    const meanY = sumY / n;
    const totalSumSquares = y.reduce((total, yi) => total + Math.pow(yi - meanY, 2), 0);
    const residualSumSquares = y.reduce((total, yi, i) => {
      const predicted = slope * i + intercept;
      return total + Math.pow(yi - predicted, 2);
    }, 0);

    const r2 = 1 - (residualSumSquares / totalSumSquares);

    return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
  }

  /**
   * 计算波动性
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    return (standardDeviation / mean) * 100; // 变异系数百分比
  }

  /**
   * 检测季节性
   */
  private detectSeasonality(dataPoints: TrendDataPoint[]): number {
    if (dataPoints.length < 14) return 0; // 需要至少两周的数据

    // 简单的周期性检测
    const weeklyPattern = this.detectWeeklyPattern(dataPoints);
    const dailyPattern = this.detectDailyPattern(dataPoints);

    return Math.max(weeklyPattern, dailyPattern);
  }

  /**
   * 检测周模式
   */
  private detectWeeklyPattern(dataPoints: TrendDataPoint[]): number {
    const weeklyData = new Map<number, number[]>(); // dayOfWeek -> values

    dataPoints.forEach(point => {
      const dayOfWeek = new Date(point.timestamp).getDay();
      if (!weeklyData.has(dayOfWeek)) {
        weeklyData.set(dayOfWeek, []);
      }
      weeklyData.get(dayOfWeek)!.push(point.value);
    });

    // 计算每周各天的平均值
    const weeklyAverages = Array.from(weeklyData.entries()).map(([day, values]) => ({
      day,
      average: values.reduce((a, b) => a + b, 0) / values.length
    }));

    if (weeklyAverages.length < 7) return 0;

    // 计算变异系数
    const mean = weeklyAverages.reduce((total, item) => total + item.average, 0) / weeklyAverages.length;
    const variance = weeklyAverages.reduce((total, item) => total + Math.pow(item.average - mean, 2), 0) / weeklyAverages.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    return Math.min(1, coefficientOfVariation);
  }

  /**
   * 检测日模式
   */
  private detectDailyPattern(dataPoints: TrendDataPoint[]): number {
    const hourlyData = new Map<number, number[]>(); // hour -> values

    dataPoints.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(point.value);
    });

    if (hourlyData.size < 12) return 0;

    // 计算每小时平均值
    const hourlyAverages = Array.from(hourlyData.entries()).map(([hour, values]) => ({
      hour,
      average: values.reduce((a, b) => a + b, 0) / values.length
    }));

    const mean = hourlyAverages.reduce((total, item) => total + item.average, 0) / hourlyAverages.length;
    const variance = hourlyAverages.reduce((total, item) => total + Math.pow(item.average - mean, 2), 0) / hourlyAverages.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    return Math.min(1, coefficientOfVariation);
  }

  /**
   * 检测数据中的异常
   */
  private detectAnomaliesInData(dataPoints: TrendDataPoint[]): TrendDataPoint[] {
    if (dataPoints.length < 5) return [];

    const values = dataPoints.map(point => point.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    const anomalies: TrendDataPoint[] = [];
    const threshold = this.config.anomalyThreshold * standardDeviation;

    dataPoints.forEach(point => {
      const deviation = Math.abs(point.value - mean);
      if (deviation > threshold) {
        anomalies.push(point);
      }
    });

    return anomalies;
  }

  /**
   * 线性预测
   */
  private predictLinear(dataPoints: TrendDataPoint, days: number): Array<{ timestamp: number; value: number; confidence: number }> {
    const regression = this.calculateLinearRegression(dataPoints);
    const predictions: Array<{ timestamp: number; value: number; confidence: number }> = [];

    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    for (let i = 1; i <= days; i++) {
      const futureTimestamp = now + (i * msPerDay);
      const futureIndex = dataPoints.length + i;
      const predictedValue = regression.slope * futureIndex + regression.intercept;

      predictions.push({
        timestamp: futureTimestamp,
        value: predictedValue,
        confidence: regression.r2
      });
    }

    return predictions;
  }

  /**
   * 季节性预测
   */
  private predictSeasonal(dataPoints: TrendDataPoint, days: number): Array<{ timestamp: number; value: number; confidence: number }> {
    const seasonality = this.detectSeasonality(dataPoints);
    if (seasonality < 0.3) {
      return this.predictLinear(dataPoints, days);
    }

    const regression = this.calculateLinearRegression(dataPoints);
    const predictions: Array<{ timestamp: number; value: number; confidence: number }> = [];

    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    // 获取季节性因子
    const seasonalFactors = this.calculateSeasonalFactors(dataPoints);

    for (let i = 1; i <= days; i++) {
      const futureTimestamp = now + (i * msPerDay);
      const futureIndex = dataPoints.length + i;
      const dayOfWeek = new Date(futureTimestamp).getDay();

      const linearValue = regression.slope * futureIndex + regression.intercept;
      const seasonalFactor = seasonalFactors[dayOfWeek] || 1;
      const predictedValue = linearValue * seasonalFactor;

      predictions.push({
        timestamp: futureTimestamp,
        value: predictedValue,
        confidence: regression.r2 * seasonality
      });
    }

    return predictions;
  }

  /**
   * 计算季节性因子
   */
  private calculateSeasonalFactors(dataPoints: TrendDataPoint[]): Record<number, number> {
    const weeklyData = new Map<number, number[]>();

    dataPoints.forEach(point => {
      const dayOfWeek = new Date(point.timestamp).getDay();
      if (!weeklyData.has(dayOfWeek)) {
        weeklyData.set(dayOfWeek, []);
      }
      weeklyData.get(dayOfWeek)!.push(point.value);
    });

    const overallMean = dataPoints.reduce((total, point) => total + point.value, 0) / dataPoints.length;
    const factors: Record<number, number> = {};

    weeklyData.forEach((values, day) => {
      const dayMean = values.reduce((a, b) => a + b, 0) / values.length;
      factors[day] = dayMean / overallMean;
    });

    return factors;
  }

  /**
   * ARIMA预测（简化版）
   */
  private predictARIMA(dataPoints: TrendDataPoint, days: number): Array<{ timestamp: number; value: number; confidence: number }> {
    // 简化实现，实际应该使用更复杂的ARIMA模型
    const values = dataPoints.map(point => point.value);
    const recentValues = values.slice(-7); // 使用最近7天的值

    if (recentValues.length < 3) {
      return this.predictLinear(dataPoints, days);
    }

    const predictions: Array<{ timestamp: number; value: number; confidence: number }> = [];
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    // 简单的自回归预测
    for (let i = 1; i <= days; i++) {
      const futureTimestamp = now + (i * msPerDay);

      // 使用移动平均进行预测
      const recentMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const predictedValue = recentMean;

      predictions.push({
        timestamp: futureTimestamp,
        value: predictedValue,
        confidence: 0.6 // ARIMA通常比线性回归更准确
      });
    }

    return predictions;
  }

  /**
   * 集成多个预测结果
   */
  private ensemblePredictions(predictions: Array<{ timestamp: number; value: number; confidence: number }[]>): Array<{
    timestamp: number;
    value: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }> {
    if (predictions.length === 0) return [];

    const ensemblePredictions: Array<{
      timestamp: number;
      value: number;
      confidence: number;
      upperBound: number;
      lowerBound: number;
    }> = [];

    const days = Math.max(...predictions.map(p => p.length));

    for (let day = 0; day < days; day++) {
      const dayPredictions = predictions
        .filter(p => day < p.length)
        .map(p => p[day]);

      if (dayPredictions.length === 0) continue;

      // 加权平均
      const weights = dayPredictions.map(p => p.confidence);
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      const weightedValue = dayPredictions.reduce((total, p, i) => total + p.value * weights[i], 0) / totalWeight;
      const avgConfidence = weights.reduce((a, b) => a + b, 0) / weights.length;

      // 计算置信区间
      const values = dayPredictions.map(p => p.value);
      const variance = values.reduce((total, value) => total + Math.pow(value - weightedValue, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      ensemblePredictions.push({
        timestamp: dayPredictions[0].timestamp,
        value: weightedValue,
        confidence: avgConfidence,
        upperBound: weightedValue + (1.96 * stdDev), // 95% 置信区间
        lowerBound: weightedValue - (1.96 * stdDev)
      });
    }

    return ensemblePredictions;
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    prediction: Array<{ timestamp: number; value: number; confidence: number; upperBound: number; lowerBound: number }>,
    analysis: TrendAnalysis
  ): 'low' | 'medium' | 'high' {
    if (prediction.length === 0) return 'low';

    // 检查趋势方向
    if (analysis.trend === 'degrading' && Math.abs(analysis.slope) > 0.5) {
      return 'high';
    }

    // 检查预测的不确定性
    const avgConfidence = prediction.reduce((total, p) => total + p.confidence, 0) / prediction.length;
    if (avgConfidence < 0.5) {
      return 'high';
    }

    // 检查波动性
    if (analysis.volatility > 20) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    analysis: TrendAnalysis,
    prediction: Array<{ timestamp: number; value: number; confidence: number; upperBound: number; lowerBound: number }>
  ): string[] {
    const recommendations: string[] = [];

    if (analysis.trend === 'degrading') {
      recommendations.push('性能呈下降趋势，建议进行性能优化');
      recommendations.push('检查最近的代码变更，查找性能回归');
    }

    if (analysis.volatility > 15) {
      recommendations.push('性能波动较大，建议检查系统稳定性');
    }

    if (analysis.anomalies.length > 0) {
      recommendations.push(`检测到${analysis.anomalies.length}个异常点，建议深入调查`);
    }

    if (prediction.length > 0) {
      const lastPrediction = prediction[prediction.length - 1];
      if (lastPrediction.upperBound - lastPrediction.lowerBound > lastPrediction.value * 0.3) {
        recommendations.push('预测不确定性较高，建议增加监控频率');
      }
    }

    return recommendations;
  }

  /**
   * 获取趋势分析
   */
  getTrendAnalysis(metric: string): TrendAnalysis | null {
    return this.analyses.get(metric) || null;
  }

  /**
   * 获取性能预测
   */
  getPerformancePrediction(metric: string): PerformancePrediction | null {
    return this.predictions.get(metric) || null;
  }

  /**
   * 获取所有指标的分析结果
   */
  getAllAnalyses(): Map<string, TrendAnalysis> {
    return new Map(this.analyses);
  }

  /**
   * 获取所有指标的预测结果
   */
  getAllPredictions(): Map<string, PerformancePrediction> {
    return new Map(this.predictions);
  }

  /**
   * 获取性能洞察
   */
  getPerformanceInsights(): PerformanceInsight[] {
    return [...this.insights];
  }

  /**
   * 生成性能洞察
   */
  generateInsights(): void {
    this.insights = [];

    // 分析所有指标的趋势
    this.analyses.forEach((analysis, metric) => {
      if (analysis.confidence > 0.7) {
        if (analysis.trend === 'degrading') {
          this.insights.push({
            type: 'trend',
            title: `${metric}性能下降`,
            description: `${metric}呈下降趋势，斜率为${analysis.slope.toFixed(3)}`,
            impact: analysis.slope < -1 ? 'high' : 'medium',
            actionable: true,
            data: analysis,
            timestamp: Date.now()
          });
        }

        if (analysis.anomalies.length > 0) {
          this.insights.push({
            type: 'anomaly',
            title: `${metric}检测到异常`,
            description: `发现${analysis.anomalies.length}个异常数据点`,
            impact: analysis.anomalies.length > 3 ? 'high' : 'medium',
            actionable: true,
            data: analysis.anomalies,
            timestamp: Date.now()
          });
        }
      }
    });

    // 分析预测结果
    this.predictions.forEach((prediction, metric) => {
      if (prediction.riskLevel === 'high') {
        this.insights.push({
          type: 'prediction',
          title: `${metric}性能风险`,
          description: `${metric}在${prediction.timeframe}内可能存在性能问题`,
          impact: 'high',
          actionable: true,
          data: prediction,
          timestamp: Date.now()
        });
      }
    });

    // 按影响程度和时间排序
    this.insights.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;
      return b.timestamp - a.timestamp;
    });

    // 保持最近20个洞察
    if (this.insights.length > 20) {
      this.insights = this.insights.slice(-20);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.dataHistory.clear();
    this.analyses.clear();
    this.predictions.clear();
    this.insights = [];
  }

  /**
   * 获取空的分析结果
   */
  private getEmptyAnalysis(metric: string): TrendAnalysis {
    return {
      metric,
      trend: 'stable',
      slope: 0,
      confidence: 0,
      volatility: 0,
      seasonality: 0,
      anomalies: []
    };
  }
}

// 导出单例实例
export const performanceTrendAnalyzer = PerformanceTrendAnalyzer.getInstance();

// 导出类型和服务类
export default PerformanceTrendAnalyzer;