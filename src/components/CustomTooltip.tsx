import React from 'react';
import { Card } from '@radix-ui/themes';
import { Activity, Clock, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';

interface TooltipData {
  label: string;
  datasets: {
    label: string;
    value: number | null;
    color: string;
  }[];
  lossRate?: number;
}

export const CustomTooltip: React.FC<TooltipData> = ({ label, datasets, lossRate }) => {
  // 计算平均延迟
  const validValues = datasets.filter(d => d.value !== null).map(d => d.value as number);
  const avgLatency = validValues.length > 0 
    ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length)
    : null;

  // 判断延迟状态
  const getLatencyStatus = (value: number | null) => {
    if (value === null) return { color: '#666', icon: AlertCircle, text: '无数据' };
    if (value < 50) return { color: '#10B981', icon: TrendingDown, text: '优秀' };
    if (value < 100) return { color: '#F59E0B', icon: TrendingUp, text: '良好' };
    return { color: '#EF4444', icon: AlertCircle, text: '较差' };
  };

  // 使用纯色背景,确保最佳兼容性
  const cardStyle = {
    minWidth: '280px',
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  };

  return (
    <Card className="p-3 shadow-xl border border-gray-200" style={cardStyle}>
      {/* 时间标题 */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <Clock size={14} className="text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>

      {/* 数据项列表 */}
      <div className="space-y-2">
        {datasets.map((dataset, index) => {
          const status = getLatencyStatus(dataset.value);
          return (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dataset.color }}
                />
                <span className="text-sm text-gray-600">{dataset.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <status.icon size={14} style={{ color: status.color }} />
                <span className="text-sm font-medium" style={{ color: status.color }}>
                  {dataset.value !== null ? `${dataset.value} ms` : status.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 统计信息 */}
      {(avgLatency !== null || lossRate !== undefined) && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex justify-between text-xs text-gray-500">
            {avgLatency !== null && (
              <div className="flex items-center gap-1">
                <Activity size={12} />
                <span>平均: {avgLatency} ms</span>
              </div>
            )}
            {lossRate !== undefined && (
              <div className="flex items-center gap-1">
                <TrendingDown size={12} />
                <span>丢包率: {lossRate}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};