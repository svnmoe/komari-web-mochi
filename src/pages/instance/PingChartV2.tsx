import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Flex, SegmentedControl, Card, Switch, Button } from "@radix-ui/themes";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import Loading from "@/components/loading";
import { Eye, EyeOff, Signal, Camera } from "lucide-react";
import domtoimage from "dom-to-image-more";
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  AreaChart,
  ComposedChart,
} from "recharts";
import { motion } from "framer-motion";
import fillMissingTimePoints, {
  cutPeakValues,
  calculateLossRate,
  sampleDataByRetention,
} from "@/utils/RecordHelper";
import Tips from "@/components/ui/tips";
import "@/components/MobileChart.css";
import "@/components/DesktopChart.css";
import "@/styles/chart-fix.css";

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface TaskInfo {
  id: number;
  name: string;
  interval: number;
  loss?: number; // 后端计算的丢包率（新版本API提供）
}

interface PingApiResp {
  status: string;
  message: string;
  data: {
    count: number;
    records: PingRecord[];
    tasks: TaskInfo[];
  };
}

// 专业的配色方案 - 渐变色系
const colorSchemes = [
  { 
    primary: "#8B5CF6", 
    secondary: "#A78BFA", 
    gradient: { from: "#8B5CF6", to: "#EC4899" },
    shadow: "rgba(139, 92, 246, 0.3)"
  },
  { 
    primary: "#06B6D4", 
    secondary: "#22D3EE", 
    gradient: { from: "#06B6D4", to: "#3B82F6" },
    shadow: "rgba(6, 182, 212, 0.3)"
  },
  { 
    primary: "#10B981", 
    secondary: "#34D399", 
    gradient: { from: "#10B981", to: "#84CC16" },
    shadow: "rgba(16, 185, 129, 0.3)"
  },
  { 
    primary: "#F59E0B", 
    secondary: "#FCD34D", 
    gradient: { from: "#F59E0B", to: "#EF4444" },
    shadow: "rgba(245, 158, 11, 0.3)"
  },
  { 
    primary: "#EC4899", 
    secondary: "#F9A8D4", 
    gradient: { from: "#EC4899", to: "#F43F5E" },
    shadow: "rgba(236, 72, 153, 0.3)"
  },
  { 
    primary: "#14B8A6", 
    secondary: "#5EEAD4", 
    gradient: { from: "#14B8A6", to: "#0EA5E9" },
    shadow: "rgba(20, 184, 166, 0.3)"
  },
];

const PingChartV2 = ({ uuid }: { uuid: string }) => {
  const { t } = useTranslation();
  const { publicInfo } = usePublicInfo();
  const max_record_preserve_time = publicInfo?.ping_record_preserve_time || 0;
  
  // 视图选项
  const presetViews = [
    { label: t("chart.hours", { count: 1 }), hours: 1 },
    { label: t("chart.hours", { count: 6 }), hours: 6 },
    { label: t("chart.hours", { count: 12 }), hours: 12 },
    { label: t("chart.days", { count: 1 }), hours: 24 },
    { label: t("chart.days", { count: 7 }), hours: 168 }, // 1 week = 168 hours
  ];
  
  const avaliableView: { label: string; hours?: number }[] = [];
  if (typeof max_record_preserve_time === "number" && max_record_preserve_time > 0) {
    for (const v of presetViews) {
      if (max_record_preserve_time >= v.hours) {
        avaliableView.push({ label: v.label, hours: v.hours });
      }
    }
    // 如果最大保存时间超过了所有预设值，添加最大时间选项
    const maxPreset = presetViews[presetViews.length - 1];
    if (max_record_preserve_time > maxPreset.hours) {
      avaliableView.push({
        label: `${t("chart.hours", { count: max_record_preserve_time })}`,
        hours: max_record_preserve_time,
      });
    }
  }

  const initialView = avaliableView.find((v) => v.hours === 1)?.label || avaliableView[0]?.label || "";
  const [view, setView] = useState<string>(initialView);
  const [hours, setHours] = useState<number>(
    avaliableView.find((v) => v.label === initialView)?.hours || 1
  );

  const [remoteData, setRemoteData] = useState<PingRecord[] | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cutPeak, setCutPeak] = useState(false);
  const [connectNulls, setConnectNulls] = useState(true); // 连接空值开关，默认连接
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});
  const [renderedDataCount, setRenderedDataCount] = useState(0);
  const [isRenderingComplete, setIsRenderingComplete] = useState(false);
  const renderingRef = useRef<boolean>(false);
  const chartCardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [chartType, setChartType] = useState<"line" | "area" | "composed">("line");
  
  // 检测是否为 Safari 浏览器
  const isSafari = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
  }, []);

  // 检测是否为移动设备（更全面的判断）
  const isMobile = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    // 检查多种移动设备标识
    const mobileKeywords = [
      'mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry',
      'windows phone', 'webos', 'opera mini', 'opera mobi'
    ];

    // 检查触摸设备
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // 检查屏幕宽度
    const isSmallScreen = window.innerWidth <= 768;

    // 检查 UA 字符串
    const hasMobileUA = mobileKeywords.some(keyword => ua.includes(keyword));

    return hasMobileUA || (hasTouch && isSmallScreen);
  }, []);


  // 更新时间范围
  useEffect(() => {
    const selected = avaliableView.find((v) => v.label === view);
    if (selected && selected.hours !== undefined) {
      setHours(selected.hours);
    }
  }, [view, avaliableView]);

  // 拉取历史数据
  useEffect(() => {
    if (!uuid || !hours) return;
    
    setLoading(true);
    setError(null);
    fetch(`/api/records/ping?uuid=${uuid}&hours=${hours}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((resp: PingApiResp) => {
        console.log('[PingChartV2] Raw API Response:', resp);
        console.log('[PingChartV2] Records count:', resp.data?.records?.length);
        console.log('[PingChartV2] Tasks:', resp.data?.tasks);
        console.log('[PingChartV2] Sample records (first 5):', resp.data?.records?.slice(0, 5));
        
        const records = resp.data?.records || [];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setRemoteData(records);
        setTasks(resp.data?.tasks || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Error");
        setLoading(false);
      });
  }, [hours, uuid]);

  // 处理数据
  const midData = useMemo(() => {
    const data = remoteData || [];
    if (!data.length) return [];

    const grouped: Record<string, any> = {};
    const timeKeys: number[] = [];
    
    // 根据任务间隔动态设置容差（interval * 1000毫秒）
    const taskInterval = tasks[0]?.interval || 60;
    const groupingTolerance = taskInterval * 1000;

    for (const rec of data) {
      const t = new Date(rec.time).getTime();
      let foundKey = null;
      // 使用动态容差，以合并相近的时间点
      for (const key of timeKeys) {
        if (Math.abs(key - t) <= groupingTolerance) {
          foundKey = key;
          break;
        }
      }
      const useKey = foundKey !== null ? foundKey : t;
      if (!grouped[useKey]) {
        grouped[useKey] = { time: new Date(useKey).toISOString() };
        if (foundKey === null) timeKeys.push(useKey);
      }
      grouped[useKey][rec.task_id] = rec.value === -1 ? null : rec.value;
    }

    let full = Object.values(grouped).sort(
      (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    const full1 = fillMissingTimePoints(
      full,
      tasks[0]?.interval || 60,
      hours * 60 * 60,
      tasks[0]?.interval || 60  // 容差改为 interval * 1
    );
    
    return full1;
  }, [remoteData, tasks, hours]);

  // 完整图表数据
  const fullChartData = useMemo(() => {
    let full = midData;
    
    // 应用数据采样以减少渲染的点数
    // 传入任务间隔作为最小采样间隔，防止过度采样
    const taskInterval = tasks[0]?.interval || 60;
    full = sampleDataByRetention(full, hours, false, taskInterval);
    
    // 如果开启削峰，应用削峰处理
    if (cutPeak && tasks.length > 0) {
      const taskKeys = tasks.map((task) => String(task.id));
      full = cutPeakValues(full, taskKeys);
    }
    
    return full;
  }, [midData, cutPeak, tasks, hours]);

  // 分批渲染数据
  const chartData = useMemo(() => {
    if (!fullChartData.length || renderedDataCount === 0) return [];
    const data = fullChartData.slice(0, renderedDataCount);
    
    // 调试：检查实际渲染的数据
    if (data.length > 0 && data.length === fullChartData.length) {
      console.log('[PingChartV2] Chart data ready:', {
        dataLength: data.length,
        samplePoint: data[0],
        hasTaskData: tasks.map(t => ({
          id: t.id,
          name: t.name,
          hasData: data.some(d => d[t.id] !== null && d[t.id] !== undefined)
        }))
      });
    }
    
    return data;
  }, [fullChartData, renderedDataCount, tasks]);

  // 分批渲染实现
  useEffect(() => {
    if (renderingRef.current) return;
    
    if (fullChartData.length === 0) {
      setRenderedDataCount(0);
      setIsRenderingComplete(true);
      return;
    }

    renderingRef.current = true;
    setRenderedDataCount(0);
    setIsRenderingComplete(false);

    const batchSize = 50;
    let currentIndex = 0;

    const renderBatch = () => {
      if (currentIndex >= fullChartData.length) {
        setIsRenderingComplete(true);
        renderingRef.current = false;
        return;
      }

      const nextIndex = Math.min(currentIndex + batchSize, fullChartData.length);
      setRenderedDataCount(nextIndex);
      currentIndex = nextIndex;

      requestAnimationFrame(renderBatch);
    };

    renderBatch();

    return () => {
      renderingRef.current = false;
    };
  }, [fullChartData]);

  // 最新值
  const latestValues = useMemo(() => {
    if (!remoteData || !tasks.length) return [];
    const map = new Map<number, PingRecord>();
    for (let i = remoteData.length - 1; i >= 0; i--) {
      const rec = remoteData[i];
      if (!map.has(rec.task_id)) {
        map.set(rec.task_id, rec);
      }
    }
    return tasks.map((task, idx) => {
      const rawValue = map.get(task.id)?.value ?? null;
      return {
        ...task,
        value: rawValue === -1 ? null : rawValue,
        time: map.get(task.id)?.time ?? null,
        color: colorSchemes[idx % colorSchemes.length],
      };
    });
  }, [remoteData, tasks]);

  // 计算统计信息
  const statistics = useMemo(() => {
    if (!chartData.length || !tasks.length) return null;
    
    const stats: any = {};
    tasks.forEach(task => {
      const values = chartData
        .map(d => d[task.id])
        .filter(v => v != null && v > 0);
      
      if (values.length > 0) {
        stats[task.id] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          current: values[values.length - 1] || null,
        };
      }
    });
    
    return stats;
  }, [chartData, tasks]);

  const handleLegendClick = useCallback((taskId: string) => {
    setHiddenLines((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const toggleAllLines = useCallback(() => {
    const allHidden = tasks.every((task) => hiddenLines[String(task.id)]);
    const newHiddenState: Record<string, boolean> = {};
    tasks.forEach((task) => {
      newHiddenState[String(task.id)] = !allHidden;
    });
    setHiddenLines(newHiddenState);
  }, [tasks, hiddenLines]);

  // 导出图片功能
  const handleExportImage = useCallback(async () => {
    if (!chartCardRef.current) {
      console.error('Chart card ref not found');
      return;
    }
    
    setIsExporting(true);
    
    try {
      console.log('Starting chart export...');
      
      // 获取当前主题以设置正确的背景色
      const isDarkMode = document.documentElement.classList.contains('dark');
      const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
      
      // 配置选项
      const options = {
        quality: 1.0,
        bgcolor: backgroundColor,
        width: chartCardRef.current.scrollWidth * 2,
        height: chartCardRef.current.scrollHeight * 2,
        style: {
          transform: 'scale(2)',
          transformOrigin: 'top left',
        },
        filter: (node: Element) => {
          // 过滤掉可能导致问题的元素
          return !node.classList?.contains('ignore-export');
        },
        // 处理字体
        fontEmbedCSS: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { font-family: 'Inter', system-ui, -apple-system, sans-serif !important; }
        `,
      };
      
      console.log('Generating image with dom-to-image...');
      
      // 使用 dom-to-image 生成图片
      const dataUrl = await domtoimage.toPng(chartCardRef.current, options);
      
      console.log('Image generated, triggering download...');
      
      // 创建下载链接
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      link.download = `ping-chart-${timestamp}.png`;
      link.href = dataUrl;
      link.style.display = 'none';
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      console.log('Download triggered successfully');
      
    } catch (error) {
      console.error('Failed to export chart:', error);
      
      // 如果 dom-to-image 也失败，尝试备用方案
      try {
        console.log('Trying fallback method...');
        
        // 使用更简单的 toBlob 方法
        const blob = await domtoimage.toBlob(chartCardRef.current, {
          bgcolor: '#ffffff',
          quality: 0.95,
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        link.download = `ping-chart-${timestamp}.png`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Fallback download successful');
        
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        alert('Failed to export chart. This might be due to browser compatibility issues. Please try using a different browser or take a screenshot instead.');
      }
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    }
  }, []);

  // 时间格式化
  const timeFormatter = (value: any) => {
    if (!value) return "";
    const date = new Date(value);
    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], {
      month: "2-digit",
      day: "2-digit",
    });
  };

  const tooltipFormatter = (value: any) => {
    const date = new Date(value);
    if (hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return date.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 自定义 Tooltip - 使用 useCallback 优化
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    // 过滤并去重
    const seen = new Set<string>();
    const filteredPayload = payload.filter((entry: any) => {
      const taskId = String(entry.dataKey);
      if (hiddenLines[taskId]) return false;
      if (entry.value == null) return false;
      if (seen.has(taskId)) return false;
      seen.add(taskId);
      return true;
    });

    if (!filteredPayload.length) return null;

    // 使用纯色背景,确保最佳兼容性
    const tooltipStyle = {
      minWidth: "200px",
      backgroundColor: "rgba(0, 0, 0, 0.95)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
    };

    const tooltipClassName = "p-3 rounded-xl shadow-2xl";

    return (
      <div
        className={tooltipClassName}
        style={tooltipStyle}
      >
        <p className="text-white font-medium text-sm mb-2">
          {tooltipFormatter(label)}
        </p>
        {filteredPayload.map((entry: any, index: number) => {
          const task = tasks.find(t => String(t.id) === entry.dataKey);
          if (!task) return null;
          
          const colorScheme = colorSchemes[tasks.indexOf(task) % colorSchemes.length];
          
          return (
            <div key={index} className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    background: colorScheme.primary,
                    boxShadow: `0 0 8px ${colorScheme.shadow}`
                  }}
                />
                <span className="text-gray-300 text-xs">{task.name}</span>
              </div>
              <span className="text-white font-semibold text-xs">
                {entry.value.toFixed(1)} ms
              </span>
            </div>
          );
        })}
        {statistics && filteredPayload.length > 0 && filteredPayload.length < 5 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            {filteredPayload.map((entry: any) => {
              const task = tasks.find(t => String(t.id) === entry.dataKey);
              if (!task) return null;
              const stat = statistics[task.id];
              if (!stat) return null;
              
              return (
                <div key={task.id} className="text-xs text-gray-400 mb-1">
                  <span className="text-gray-500">{task.name}: </span>
                  <span>Avg {stat.avg.toFixed(1)}ms</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [hiddenLines, tasks, statistics]);


  return (
    <Flex direction="column" align="center" gap="3" className="w-full">
      {/* 时间范围选择器 - 增强移动端检测 */}
      <div className="w-full px-3 md:px-0 mb-2">
        <div 
          className={`w-full pb-2 md:pb-0 ${isMobile ? 'overflow-x-auto' : 'overflow-x-visible'}`}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "var(--gray-a6) var(--gray-a3)",
            WebkitOverflowScrolling: "touch",
            maxWidth: "100%",
          }}
        >
          <Flex justify="center" className={`w-full ${isMobile ? 'min-w-max' : 'min-w-0'}`}>
            <SegmentedControl.Root
              radius="full"
              value={view}
              onValueChange={(newView) => {
                setView(newView);
                const selected = avaliableView.find((v) => v.label === newView);
                if (selected && selected.hours !== undefined) {
                  setHours(selected.hours);
                }
              }}
              className="flex-shrink-0"
              style={{ 
                transform: isMobile ? "scale(0.95)" : "scale(0.95)",
                transformOrigin: "center",
                height: isMobile ? "36px" : "36px",
                minWidth: "fit-content"
              }}
            >
              {avaliableView.map((v) => (
                <SegmentedControl.Item
                  key={v.label}
                  value={v.label}
                  className="whitespace-nowrap px-3 py-1"
                  style={{ 
                    fontSize: isMobile ? "13px" : "13px",
                    minWidth: isMobile ? "65px" : "65px",
                    height: "100%"
                  }}
                >
                  {v.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          </Flex>
        </div>
      </div>

      {/* 加载和错误状态 */}
      {loading && (
        <div className="w-full flex justify-center items-center h-64">
          <Loading />
        </div>
      )}
      
      {error && (
        <div className="w-full text-center text-red-500 py-4">
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      {!loading && !error && latestValues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Card
            className="w-full mb-3"
            style={{
              borderRadius: "16px",
              padding: "1.25rem",
              background: "linear-gradient(135deg, var(--color-panel-solid) 0%, var(--gray-a2) 100%)",
              border: "1px solid var(--gray-a3)",
              backdropFilter: "blur(20px)",
            }}
          >
            <Tips className="absolute top-0 right-0 m-2">
              <div className="text-sm space-y-2 min-w-[280px]">
                <div className="font-semibold mb-2">{t("chart.data_explanation")}</div>
                <div className="flex gap-2">
                  <span className="font-medium text-nowrap">Current:</span>
                  <span className="text-muted-foreground">{t("chart.current_explanation")}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-nowrap">Loss:</span>
                  <span className="text-muted-foreground">{t("chart.loss_explanation")}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-nowrap">Avg:</span>
                  <span className="text-muted-foreground">{t("chart.avg_explanation")}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-nowrap">Range:</span>
                  <span className="text-muted-foreground">{t("chart.range_explanation")}</span>
                </div>
                {isMobile && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">{t("chart.mobile_format_title")}</div>
                      <div>{t("chart.mobile_format_desc")}</div>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-amber-600 dark:text-amber-400">
                  <div>⚠️ {t("chart.loss_tips")}</div>
                </div>
              </div>
            </Tips>
            
            {/* 移动端Chart Type选择器 - 放在时间轴和节点列表之间 */}
            {isMobile && (
              <div className="mb-3">
                <div 
                  className="overflow-x-auto pb-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "var(--gray-a6) var(--gray-a3)",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div className="inline-flex w-full">
                    <SegmentedControl.Root
                      value={chartType}
                      onValueChange={(value) => setChartType(value as "line" | "area" | "composed")}
                      size="2"
                      className="w-full"
                    >
                      <SegmentedControl.Item value="line" className="flex-1">Line</SegmentedControl.Item>
                      <SegmentedControl.Item value="area" className="flex-1">Area</SegmentedControl.Item>
                      <SegmentedControl.Item value="composed" className="flex-1">Combined</SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </div>
                </div>
              </div>
            )}
            
            {/* 根据设备类型显示不同布局 */}
            {isMobile ? (
              // 移动端：紧凑的网格布局
              <div className="grid grid-cols-2 gap-2 mb-2">
                {latestValues.map((task) => {
                  const isHidden = hiddenLines[String(task.id)];
                  const stat = statistics?.[task.id];
                
                  return (
                    <motion.button
                      key={task.id}
                      className="relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all w-full"
                      style={{
                        background: isHidden
                          ? "var(--gray-a2)"
                          : `linear-gradient(135deg, ${task.color.primary}15 0%, ${task.color.secondary}10 100%)`,
                        border: `1px solid ${isHidden ? "var(--gray-a4)" : task.color.primary}30`,
                        opacity: isHidden ? 0.5 : 1,
                        minHeight: "44px", // 固定最小高度防止跳动
                      }}
                      onClick={() => handleLegendClick(String(task.id))}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          background: task.color.primary,
                          opacity: isHidden ? 0.3 : 1,
                          boxShadow: isHidden ? 'none' : `0 2px 4px ${task.color.shadow}`,
                        }}
                      />
                      
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <div className="flex items-center gap-1 w-full">
                          <span 
                            className="font-medium text-[11px] truncate"
                            style={{
                              textDecoration: isHidden ? "line-through" : "none",
                            }}
                          >
                            {task.name}
                          </span>
                          {!isHidden && task.value !== null && (
                            <Signal size={9} className="text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground whitespace-nowrap">
                          <span className="tabular-nums">{task.value !== null ? `${Math.round(task.value)}ms` : "-"}</span>
                          <span className="opacity-50">•</span>
                          <span className="tabular-nums">
                            {(() => {
                              const backendLoss = task.loss;
                              const frontendLoss = midData && midData.length > 0 ? calculateLossRate(midData, task.id) : 0;
                              const displayLoss = typeof backendLoss === 'number' 
                                ? Math.round(backendLoss * 10) / 10  // 后端数据也保留1位小数
                                : frontendLoss;
                              
                              console.log(`[PingChartV2] Task: ${task.name} (ID: ${task.id})`, {
                                displayLoss,
                                source: typeof backendLoss === 'number' ? 'Backend API' : 'Frontend Calculation',
                                backendRawValue: backendLoss,
                                backendFormattedValue: typeof backendLoss === 'number' ? Math.round(backendLoss * 10) / 10 : undefined,
                                frontendValue: frontendLoss
                              });
                              
                              return `${displayLoss}%`;
                            })()}
                          </span>
                          {stat && (
                            <>
                              <span className="opacity-50">•</span>
                              <span className="tabular-nums">{Math.round(stat.avg)}ms</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {isHidden && (
                        <EyeOff size={12} className="text-muted-foreground flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              // 桌面端：完整的卡片布局
              <div
                className="grid gap-3 mb-1 w-full"
                style={{
                  gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
                }}
              >
                {latestValues.map((task) => {
                  const isHidden = hiddenLines[String(task.id)];
                  const stat = statistics?.[task.id];
                  
                  return (
                    <motion.div
                      key={task.id}
                      className="relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all"
                      style={{
                        background: isHidden
                          ? "var(--gray-a2)"
                          : `linear-gradient(135deg, ${task.color.primary}10 0%, ${task.color.secondary}05 100%)`,
                        border: `1px solid ${isHidden ? "var(--gray-a4)" : task.color.primary}20`,
                        opacity: isHidden ? 0.5 : 1,
                        minHeight: "108px", // 固定最小高度防止内容变化时换行
                      }}
                      onClick={() => handleLegendClick(String(task.id))}
                      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* 背景装饰 */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          background: `radial-gradient(circle at top right, ${task.color.primary}40, transparent 70%)`,
                        }}
                      />
                      
                      <div className="relative flex items-start gap-3">
                        <div
                          className="w-1.5 h-12 rounded-full flex-shrink-0"
                          style={{
                            background: `linear-gradient(180deg, ${task.color.primary}, ${task.color.secondary})`,
                            opacity: isHidden ? 0.3 : 1,
                            boxShadow: isHidden ? 'none' : `0 4px 12px ${task.color.shadow}`,
                          }}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <label
                              className="font-semibold text-sm cursor-pointer truncate"
                              style={{
                                textDecoration: isHidden ? "line-through" : "none",
                              }}
                            >
                              {task.name}
                            </label>
                            {!isHidden && task.value !== null && (
                              <Signal size={12} className="text-green-500 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="whitespace-nowrap">
                              <span className="text-muted-foreground">Current:</span>
                              <span className="ml-1 font-semibold tabular-nums" style={{ color: task.color.primary }}>
                                {task.value !== null ? `${task.value}ms` : "-"}
                              </span>
                            </div>
                            <div className="whitespace-nowrap">
                              <span className="text-muted-foreground">Loss:</span>
                              <span className="ml-1 font-medium tabular-nums">
                                {(() => {
                                  const backendLoss = task.loss;
                                  const frontendLoss = midData && midData.length > 0 ? calculateLossRate(midData, task.id) : null;
                                  const displayLoss = typeof backendLoss === 'number' 
                                    ? Math.round(backendLoss * 10) / 10  // 后端数据也保留1位小数
                                    : frontendLoss;
                                  
                                  console.log(`[PingChartV2 Detail] Task: ${task.name} (ID: ${task.id})`, {
                                    displayLoss,
                                    source: typeof backendLoss === 'number' ? 'Backend API' : 'Frontend Calculation',
                                    backendRawValue: backendLoss,
                                    backendFormattedValue: typeof backendLoss === 'number' ? Math.round(backendLoss * 10) / 10 : undefined,
                                    frontendValue: frontendLoss
                                  });
                                  
                                  return displayLoss !== null ? `${displayLoss}%` : "-";
                                })()}
                              </span>
                            </div>
                            {stat && (
                              <>
                                <div className="whitespace-nowrap">
                                  <span className="text-muted-foreground">Avg:</span>
                                  <span className="ml-1 tabular-nums">{stat.avg.toFixed(1)}ms</span>
                                </div>
                                <div className="whitespace-nowrap">
                                  <span className="text-muted-foreground">Range:</span>
                                  <span className="ml-1 tabular-nums">{stat.min.toFixed(1)}-{stat.max.toFixed(1)}ms</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {isHidden && (
                          <EyeOff size={16} className="text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* 主图表 */}
      {!loading && !error && fullChartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          <Card
            ref={chartCardRef}
            className="w-full"
            data-chart-export="true"
            style={{
              borderRadius: "16px",
              padding: "1.5rem",
              background: "linear-gradient(135deg, var(--color-panel-solid) 0%, var(--gray-a1) 100%)",
              border: "1px solid var(--gray-a3)",
              backdropFilter: "blur(20px)",
              minHeight: "450px",
            }}
          >
            <div className="relative">
              {!isRenderingComplete && fullChartData.length > 0 && (
                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-lg">
                  <Loading size={3} />
                </div>
              )}
              
              {/* 图例 - 显示曲线名称和颜色（桌面端显示，包含在截图中） */}
              {!isMobile && (
                <div className="flex flex-wrap gap-3 mb-3 justify-center chart-legend">
                  {tasks.map((task, idx) => {
                  const isHidden = hiddenLines[String(task.id)];
                  const colorScheme = colorSchemes[idx % colorSchemes.length];
                  
                  if (isHidden) return null;
                  
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 px-3 py-1 rounded-md"
                      style={{
                        background: `${colorScheme.primary}10`,
                        border: `1px solid ${colorScheme.primary}30`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          background: colorScheme.primary,
                          boxShadow: `0 0 6px ${colorScheme.shadow}`,
                        }}
                      />
                      <span className="text-sm font-medium">{task.name}</span>
                    </div>
                  );
                  })}
                </div>
              )}
              
              <ResponsiveContainer width="100%" height={400}>
                {(() => {
                  const ChartComponent = chartType === "line" ? LineChart : 
                                        chartType === "area" ? AreaChart : 
                                        ComposedChart;
                  
                  // 生成唯一的key来强制重新渲染图表，避免残影
                  const chartKey = `${chartType}-${Object.keys(hiddenLines).filter(k => hiddenLines[k]).join('-')}`;
                  
                  return (
                    <ChartComponent
                      key={chartKey}
                      data={chartData}
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      className={`chart-${chartType}`}
                    >
                      <defs>
                        <clipPath id="chart-clip">
                          <rect x={0} y={0} width="100%" height="100%" />
                        </clipPath>
                        {colorSchemes.map((scheme, idx) => (
                          <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={scheme.primary} stopOpacity={0.5} />
                            <stop offset="50%" stopColor={scheme.primary} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={scheme.secondary} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--gray-a3)"
                        strokeOpacity={0.3}
                        vertical={false}
                      />
                      
                      <XAxis
                        dataKey="time"
                        tickFormatter={timeFormatter}
                        stroke="var(--gray-a6)"
                        tick={{ fill: "var(--gray-a11)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      
                      <YAxis
                        stroke="var(--gray-a6)"
                        tick={{ fill: "var(--gray-a11)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        unit="ms"
                      />
                      
                      <Tooltip
                        content={CustomTooltip}
                        cursor={{
                          stroke: "var(--gray-a6)",
                          strokeWidth: 1,
                          strokeDasharray: "3 3",
                        }}
                        wrapperStyle={{ zIndex: 1000 }}
                        isAnimationActive={false}
                        filterNull={false}
                      />
                      
                      {/* Render based on chart type */}
                      {(() => {
                        // 计算当前显示的曲线数量
                        const visibleCount = tasks.filter(task => !hiddenLines[String(task.id)]).length;
                        const showFill = visibleCount === 1 || chartType === "area";
                        
                        if (chartType === "line") {
                          return tasks.map((task, idx) => {
                            const isHidden = hiddenLines[String(task.id)];
                            const colorScheme = colorSchemes[idx % colorSchemes.length];
                            
                            return (
                              <Line
                                key={task.id}
                                type={cutPeak ? "monotone" : "linear"}
                                dataKey={String(task.id)}
                                stroke={colorScheme.primary}
                                strokeWidth={showFill && !isHidden ? 2.5 : 2}
                                dot={false}
                                hide={isHidden}
                                isAnimationActive={false}
                                animationDuration={300}
                                strokeOpacity={1}
                                fill="none"
                                connectNulls={connectNulls}
                                clipPath="url(#chart-clip)"
                              />
                            );
                          });
                        } else if (chartType === "area") {
                          return tasks.map((task, idx) => {
                            const isHidden = hiddenLines[String(task.id)];
                            const colorScheme = colorSchemes[idx % colorSchemes.length];
                            
                            return (
                              <Area
                                key={task.id}
                                type={cutPeak ? "monotone" : "linear"}
                                dataKey={String(task.id)}
                                stroke={colorScheme.primary}
                                fill={`url(#gradient-${idx % colorSchemes.length})`}
                                strokeWidth={2}
                                fillOpacity={isHidden ? 0 : 0.4}
                                hide={isHidden}
                                isAnimationActive={false}
                                animationDuration={300}
                                strokeOpacity={0.9}
                                connectNulls={connectNulls}
                              />
                            );
                          });
                        } else {
                          // Combined mode
                          return tasks.map((task, idx) => {
                            const isHidden = hiddenLines[String(task.id)];
                            const colorScheme = colorSchemes[idx % colorSchemes.length];
                            
                            // 固定规则：前半部分使用Area，后半部分使用Line
                            // 这样不会因为隐藏/显示而改变渲染方式
                            const visibleTasks = tasks.filter(t => !hiddenLines[String(t.id)]);
                            const visibleIndex = visibleTasks.findIndex(t => t.id === task.id);
                            const useArea = visibleIndex >= 0 && visibleIndex < Math.ceil(visibleTasks.length / 2);
                            
                            if (useArea && !isHidden) {
                              return (
                                <Area
                                  key={task.id}
                                  type={cutPeak ? "monotone" : "linear"}
                                  dataKey={String(task.id)}
                                  stroke={colorScheme.primary}
                                  fill={`url(#gradient-${idx % colorSchemes.length})`}
                                  strokeWidth={2.5}
                                  fillOpacity={0.3}
                                  hide={isHidden}
                                  isAnimationActive={false}
                                  animationDuration={300}
                                  strokeOpacity={1}
                                  connectNulls={connectNulls}
                                />
                              );
                            } else {
                              return (
                                <Line
                                  key={task.id}
                                  type={cutPeak ? "monotone" : "linear"}
                                  dataKey={String(task.id)}
                                  stroke={colorScheme.primary}
                                  strokeWidth={2}
                                  dot={false}
                                  hide={isHidden}
                                  isAnimationActive={false}
                                  animationDuration={300}
                                  strokeOpacity={1}
                                  fill="none"
                                  connectNulls={connectNulls}
                                  clipPath="url(#chart-clip)"
                                />
                              );
                            }
                          });
                        }
                      })()}
                    </ChartComponent>
                  );
                })()}
              </ResponsiveContainer>
            </div>

            {/* 移动端：曲线开关快捷键 */}
            {isMobile && (
              <div className="flex flex-wrap gap-1 mb-3 mt-3 justify-center">
                {tasks.map((task, idx) => {
                  const isHidden = hiddenLines[String(task.id)];
                  const colorScheme = colorSchemes[idx % colorSchemes.length];
                  
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleLegendClick(String(task.id))}
                      className="px-2 py-1 rounded-md flex items-center gap-1 transition-all"
                      style={{
                        background: isHidden ? "var(--gray-a3)" : `${colorScheme.primary}20`,
                        border: `1px solid ${isHidden ? "var(--gray-a5)" : colorScheme.primary}40`,
                        opacity: isHidden ? 0.5 : 1,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: colorScheme.primary,
                          opacity: isHidden ? 0.3 : 1,
                        }}
                      />
                      <span className="text-[10px] font-medium">
                        {task.name}
                      </span>
                      {isHidden && <EyeOff size={10} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 控制按钮 - 添加 ignore-export 类以在导出时忽略 */}
            <div className="flex items-center justify-between gap-4 mt-4 flex-wrap ignore-export">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    id="cut-peak"
                    checked={cutPeak}
                    onCheckedChange={setCutPeak}
                    size="1"
                  />
                  <label
                    htmlFor="cut-peak"
                    className="text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {t("chart.cutPeak")}
                    <Tips>
                      <span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} />
                    </Tips>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="connect-nulls"
                    checked={connectNulls}
                    onCheckedChange={setConnectNulls}
                    size="1"
                  />
                  <label
                    htmlFor="connect-nulls"
                    className="text-xs font-medium cursor-pointer"
                  >
                    {t("chart.connectNulls")}
                  </label>
                </div>
                
                {/* Chart Type Selector - 桌面端 */}
                {!isMobile && (
                  <div>
                    <SegmentedControl.Root
                      value={chartType}
                      onValueChange={(value) => setChartType(value as "line" | "area" | "composed")}
                      size="1"
                    >
                      <SegmentedControl.Item value="line">Line</SegmentedControl.Item>
                      <SegmentedControl.Item value="area">Area</SegmentedControl.Item>
                      <SegmentedControl.Item value="composed">Combined</SegmentedControl.Item>
                    </SegmentedControl.Root>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* 只在桌面端显示截图按钮 */}
                {!isMobile && !isSafari && (
                  <Button
                    variant="soft"
                    size="1"
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="flex items-center gap-1"
                  >
                    {isExporting ? (
                      <Loading size={1} />
                    ) : (
                      <>
                        <Camera size={14} />
                        {t("chart.export")}
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  variant="soft"
                  size="1"
                  onClick={toggleAllLines}
                  className="flex items-center gap-1"
                >
                  {tasks.every((task) => hiddenLines[String(task.id)]) ? (
                    <>
                      <Eye size={14} />
                      {t("chart.showAll")}
                    </>
                  ) : (
                    <>
                      <EyeOff size={14} />
                      {t("chart.hideAll")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </Flex>
  );
};

export default PingChartV2;