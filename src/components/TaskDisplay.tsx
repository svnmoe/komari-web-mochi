import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Flex, Card, Switch, Button, Text, SegmentedControl, Box } from "@radix-ui/themes";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "@/types/LiveData";
import type { LoadRecord, MetricType } from "@/types/LoadData";
import { METRIC_CONFIGS as MetricConfigs, isNetworkMetric } from "@/types/LoadData";
import Loading from "@/components/loading";
import { 
  Eye, EyeOff, Radar, CheckCircle, XCircle, Activity, Signal, 
  Zap, Camera, Cpu, HardDrive, Network, Gauge, Thermometer,
  Database, Server, GitBranch, Download, Upload, TrendingUp, TrendingDown, AlertCircle
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import domtoimage from "dom-to-image-more";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { motion } from "framer-motion";
import fillMissingTimePoints, {
  cutPeakValues,
  sampleDataByRetention,
} from "@/utils/RecordHelper";
import Flag from "@/components/Flag";
import { formatBytes, getTrafficPercentage } from "@/utils/formatHelper";
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
  loss?: number;
}

interface TaskDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
}

type TaskMode = "ping" | "load";

const nodeColorSchemes = [
  { 
    primary: "#3B82F6",
    secondary: "#60A5FA", 
    gradient: { from: "#3B82F6", to: "#1E40AF" },
    shadow: "rgba(59, 130, 246, 0.4)",
    light: "#DBEAFE"
  },
  { 
    primary: "#10B981",
    secondary: "#34D399", 
    gradient: { from: "#10B981", to: "#047857" },
    shadow: "rgba(16, 185, 129, 0.4)",
    light: "#D1FAE5"
  },
  { 
    primary: "#8B5CF6",
    secondary: "#A78BFA", 
    gradient: { from: "#8B5CF6", to: "#6D28D9" },
    shadow: "rgba(139, 92, 246, 0.4)",
    light: "#EDE9FE"
  },
  { 
    primary: "#F59E0B",
    secondary: "#FCD34D", 
    gradient: { from: "#F59E0B", to: "#D97706" },
    shadow: "rgba(245, 158, 11, 0.4)",
    light: "#FEF3C7"
  },
  { 
    primary: "#EF4444",
    secondary: "#F87171", 
    gradient: { from: "#EF4444", to: "#B91C1C" },
    shadow: "rgba(239, 68, 68, 0.4)",
    light: "#FEE2E2"
  },
  { 
    primary: "#14B8A6",
    secondary: "#5EEAD4", 
    gradient: { from: "#14B8A6", to: "#0F766E" },
    shadow: "rgba(20, 184, 166, 0.4)",
    light: "#CCFBF1"
  },
  { 
    primary: "#EC4899",
    secondary: "#F9A8D4", 
    gradient: { from: "#EC4899", to: "#BE185D" },
    shadow: "rgba(236, 72, 153, 0.4)",
    light: "#FCE7F3"
  },
  { 
    primary: "#6366F1",
    secondary: "#818CF8", 
    gradient: { from: "#6366F1", to: "#4338CA" },
    shadow: "rgba(99, 102, 241, 0.4)",
    light: "#E0E7FF"
  },
];

const getMetricIcon = (metric: MetricType) => {
  switch(metric) {
    case "cpu": return <Cpu size={16} />;
    case "gpu": return <Server size={16} />;
    case "ram": return <Database size={16} />;
    case "swap": return <HardDrive size={16} />;
    case "load": return <Gauge size={16} />;
    case "temp": return <Thermometer size={16} />;
    case "disk": return <HardDrive size={16} />;
    case "net_in": return <Download size={16} />;
    case "net_out": return <Upload size={16} />;
    case "net_total": return <Activity size={16} />;
    case "net_total_up": return <TrendingUp size={16} />;
    case "net_total_down": return <TrendingDown size={16} />;
    case "net_bandwidth": return <Network size={16} />;
    case "traffic_limit": return <AlertCircle size={16} />;
    case "process": return <Server size={16} />;
    case "connections": return <GitBranch size={16} />;
    case "tcp": return <GitBranch size={16} />;
    case "udp": return <Network size={16} />;
    default: return <Activity size={16} />;
  }
};

const formatMetricValue = (value: number, metric: MetricType): string => {
  const config = MetricConfigs[metric];
  
  if (!config) {
    console.warn(`No config found for metric: ${metric}`);
    return value.toFixed(1);
  }
  
  if (metric === "net_in" || metric === "net_out" || metric === "net_total") {
    return formatBytes(value) + "/s";
  }
  
  if (metric === "net_total_up" || metric === "net_total_down" || metric === "net_bandwidth") {
    return formatBytes(value);
  }
  
  if (metric === "traffic_limit") {
    return value.toFixed(1) + "%";
  }
  
  if (metric === "load") {
    return value.toFixed(2);
  }
  
  if (metric === "temp") {
    return value.toFixed(1) + config.unit;
  }
  
  if (config.unit === "%") {
    // For percentage metrics (CPU, GPU, RAM, etc.), API returns 0-100 values
    return value.toFixed(1) + "%";
  }
  
  return value.toFixed(0) + (config.unit || "");
};

const TaskDisplay: React.FC<TaskDisplayProps> = ({ nodes, liveData }) => {
  const { t } = useTranslation();
  const { publicInfo } = usePublicInfo();
  const max_record_preserve_time = publicInfo?.record_preserve_time || 0;
  const max_ping_record_preserve_time = publicInfo?.ping_record_preserve_time || 0;
  const isMobile = useIsMobile();
  const chartCardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const isSafari = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
  }, []);
  
  // 统一的节点颜色获取函数 - 始终基于原始节点列表的索引
  const getNodeColorScheme = useCallback((nodeUuid: string) => {
    const nodeIndex = nodes.findIndex(n => n.uuid === nodeUuid);
    return nodeColorSchemes[nodeIndex % nodeColorSchemes.length];
  }, [nodes]);
  
  // Y-axis formatter based on metric type
  const getYAxisFormatter = () => {
    if (taskMode === "ping") {
      return (value: number) => `${value}ms`;
    }
    
    // For load mode, determine the formatter based on selected metrics
    if (selectedMetrics.length === 0) return undefined;
    
    // Check if all selected metrics are percentages
    const allPercentages = selectedMetrics.every(m => 
      ['cpu', 'gpu', 'ram', 'disk', 'swap'].includes(m)
    );
    
    // Check if all selected metrics are network metrics
    const allNetwork = selectedMetrics.every(m => 
      ['net_in', 'net_out', 'net_total', 'net_total_up', 'net_total_down', 'net_bandwidth'].includes(m)
    );
    
    if (allPercentages) {
      return (value: number) => `${value}%`;
    } else if (allNetwork) {
      return (value: number) => formatBytes(value, true) + (
        selectedMetrics.some(m => ['net_in', 'net_out', 'net_total'].includes(m)) ? '/s' : ''
      );
    } else if (selectedMetrics.includes('temp')) {
      return (value: number) => `${value}°C`;
    } else if (selectedMetrics.includes('load')) {
      return (value: number) => value.toFixed(2);
    }
    
    return (value: number) => value.toFixed(0);
  };
  
  // Task mode: ping or load
  const [taskMode, setTaskMode] = useState<TaskMode>("load");
  
  // Ping task states
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [taskData, setTaskData] = useState<Record<number, PingRecord[]>>({});
  const [taskLossRates, setTaskLossRates] = useState<Record<string, number>>({});
  
  // Load metric states
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>(["cpu"]);
  const [loadData, setLoadData] = useState<Record<string, LoadRecord[]>>({});
  
  // Server-side statistics for ping tasks (from new API)
  const [serverPingStats, setServerPingStats] = useState<Record<string, any>>({});
  
  // Common states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cutPeak, setCutPeak] = useState(false);
  const [hiddenNodes, setHiddenNodes] = useState<Record<string, boolean>>({});
  const [chartType, setChartType] = useState<"line" | "area" | "composed">("line");
  const [connectNulls, setConnectNulls] = useState(true);

  // 稳定节点列表：使用节点 UUID 列表作为依赖，避免数组引用变化触发数据重新获取
  const nodesKey = useMemo(() =>
    (nodes || []).map(n => n.uuid).sort().join(','),
    [nodes]
  );

  // 稳定在线节点列表：避免 liveData 引用变化导致不必要的重渲染
  const onlineNodesKey = useMemo(() =>
    (liveData?.online || []).slice().sort().join(','),
    [liveData?.online]
  );

  // 创建稳定的在线状态 Map
  const onlineStatusMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    const onlineSet = new Set(liveData?.online || []);
    nodes?.forEach(node => {
      map[node.uuid] = onlineSet.has(node.uuid);
    });
    return map;
  }, [onlineNodesKey, nodes]);

  // Time range selection
  const presetViews = taskMode === "ping" 
    ? [
        { label: t("chart.hours", { count: 1 }), hours: 1 },
        { label: t("chart.hours", { count: 6 }), hours: 6 },
        { label: t("chart.hours", { count: 12 }), hours: 12 },
        { label: t("chart.days", { count: 1 }), hours: 24 },
        { label: t("chart.days", { count: 7 }), hours: 168 },
      ]
    : [
        { label: t("chart.hours", { count: 4 }), hours: 4 },
        { label: t("chart.days", { count: 1 }), hours: 24 },
        { label: t("chart.days", { count: 7 }), hours: 168 },
        { label: t("chart.days", { count: 30 }), hours: 720 },
      ];
  
  const maxPreserveTime = taskMode === "ping" ? max_ping_record_preserve_time : max_record_preserve_time;
  const availableViews: { label: string; hours: number }[] = [];
  
  if (typeof maxPreserveTime === "number" && maxPreserveTime > 0) {
    // Add preset views that are within the preserve time limit
    for (const v of presetViews) {
      if (v.hours <= maxPreserveTime) {
        availableViews.push({ label: v.label, hours: v.hours });
      }
    }
    
    // If preserve time is greater than the last preset (30 days/720 hours for load mode),
    // add it as an additional option
    const maxPreset = presetViews[presetViews.length - 1];
    if (maxPreserveTime > maxPreset.hours) {
      // Add the actual preserve time as an option
      const days = Math.floor(maxPreserveTime / 24);
      const hours = maxPreserveTime % 24;
      let label: string;
      
      if (days > 0 && hours === 0) {
        label = t("chart.days", { count: days });
      } else if (days > 0 && hours > 0) {
        label = `${days}d ${hours}h`;
      } else {
        label = t("chart.hours", { count: maxPreserveTime });
      }
      
      availableViews.push({
        label,
        hours: maxPreserveTime,
      });
    }
  } else {
    // If no preserve time is set, show all preset views
    availableViews.push(...presetViews);
  }
  
  const initialView = availableViews.find((v) => v.hours === (taskMode === "ping" ? 6 : 24)) || availableViews[0];
  const [viewHours, setViewHours] = useState(initialView?.hours || 6);

  // Fetch ping tasks
  useEffect(() => {
    if (taskMode !== "ping" || !nodes || nodes.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    // Try new global API first
    fetch('/api/task/ping')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Global API failed with status: ${res.status}`);
        }
        return res.json();
      })
      .then(resp => {
        const taskList = resp?.data || [];
        if (Array.isArray(taskList) && taskList.length > 0) {
          // Filter tasks that have at least one client from our nodes
          const nodeUuids = nodes.map(n => n.uuid);
          const relevantTasks = taskList.filter((task: any) => 
            !task.clients || task.clients.length === 0 || 
            task.clients.some((clientId: string) => nodeUuids.includes(clientId))
          );
          
          if (relevantTasks.length > 0) {
            setTasks(relevantTasks);
            if (!selectedTaskId) {
              setSelectedTaskId(relevantTasks[0].id);
            }
            setLoading(false);
          } else {
            throw new Error("No relevant tasks for current nodes");
          }
        } else {
          throw new Error("Empty task list from global API");
        }
      })
      .catch(globalErr => {
        console.log("Global task API failed, falling back to node-based fetch:", globalErr.message);
        
        // Fallback: Fetch tasks directly from nodes
        const taskPromises = nodes.map(node => 
          fetch(`/api/records/ping?uuid=${node.uuid}&hours=1`)
            .then(res => res.ok ? res.json() : null)
            .then(resp => resp?.data?.tasks || [])
            .catch(() => [])
        );
        
        Promise.all(taskPromises)
          .then(allTaskLists => {
            const taskMap = new Map<number, TaskInfo>();
            
            allTaskLists.forEach(taskList => {
              if (Array.isArray(taskList)) {
                taskList.forEach((task: TaskInfo) => {
                  if (task && task.id && !taskMap.has(task.id)) {
                    taskMap.set(task.id, task);
                  }
                });
              }
            });
            
            const mergedTasks = Array.from(taskMap.values()).sort((a, b) => a.id - b.id);
            
            if (mergedTasks.length > 0) {
              setTasks(mergedTasks);
              if (!selectedTaskId) {
                setSelectedTaskId(mergedTasks[0].id);
              }
              setLoading(false);
            } else {
              // No tasks found
              setError("No ping tasks configured");
              setLoading(false);
            }
          })
          .catch(() => {
            setError("Failed to fetch ping tasks");
            setLoading(false);
          });
      });
  }, [taskMode, nodesKey]);

  // Fetch ping data
  useEffect(() => {
    if (taskMode !== "ping" || !selectedTaskId || !nodes || nodes.length === 0) return;
    
    setLoading(true);
    
    // Try new task_id based API first
    fetch(`/api/records/ping?task_id=${selectedTaskId}&hours=${viewHours}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Task-based API failed with status: ${res.status}`);
        }
        return res.json();
      })
      .then(resp => {
        const records = resp?.data?.records || [];
        const basicInfo = resp?.data?.basic_info || [];
        
        // Process records - they already have client field
        const newData: Record<number, PingRecord[]> = {};
        if (records.length > 0) {
          newData[selectedTaskId] = records;
        }
        
        // Process basic_info for statistics
        const allLossRates: Record<string, number> = {};
        const serverStats: Record<string, any> = {};
        
        basicInfo.forEach((info: any) => {
          if (info.client) {
            // Store loss rate
            if (typeof info.loss === 'number') {
              allLossRates[`${info.client}_${selectedTaskId}`] = info.loss;
            }
            // Store server statistics
            serverStats[info.client] = {
              loss: info.loss,
              min: info.min,
              max: info.max
            };
          }
        });
        
        setTaskData(newData);
        setTaskLossRates(allLossRates);
        setServerPingStats(serverStats);
        setLoading(false);
      })
      .catch(taskErr => {
        console.log("Task-based API failed, falling back to UUID-based fetch:", taskErr.message);
        
        // Fallback: Original UUID-based fetching
        const promises = nodes.map(node => 
          fetch(`/api/records/ping?uuid=${node.uuid}&hours=${viewHours}`)
            .then(res => res.ok ? res.json() : null)
            .then(resp => {
              const tasks = resp?.data?.tasks || [];
              const lossRates: Record<string, number> = {};
              tasks.forEach((task: TaskInfo) => {
                if (task.id && typeof task.loss === 'number') {
                  lossRates[`${node.uuid}_${task.id}`] = task.loss;
                }
              });
              
              return {
                nodeId: node.uuid,
                records: resp?.data?.records?.filter((r: PingRecord) => r.task_id === selectedTaskId) || [],
                lossRates
              };
            })
            .catch(() => ({ nodeId: node.uuid, records: [], lossRates: {} }))
        );
        
        Promise.all(promises)
          .then(results => {
            const newData: Record<number, PingRecord[]> = {};
            const allLossRates: Record<string, number> = {};
            
            results.forEach(result => {
              Object.assign(allLossRates, result.lossRates);
              
              if (result.records.length > 0) {
                result.records.forEach((record: PingRecord) => {
                  if (!newData[selectedTaskId]) {
                    newData[selectedTaskId] = [];
                  }
                  newData[selectedTaskId].push({
                    ...record,
                    client: result.nodeId
                  });
                });
              }
            });
            
            setTaskData(newData);
            setTaskLossRates(allLossRates);
            setServerPingStats({}); // Clear server stats when using fallback
            setLoading(false);
          })
          .catch(err => {
            console.error("Error fetching ping data:", err);
            setLoading(false);
          });
      });
  }, [taskMode, selectedTaskId, nodesKey, viewHours]);

  // Fetch load data
  useEffect(() => {
    if (taskMode !== "load" || !nodes || nodes.length === 0 || selectedMetrics.length === 0) return;
    
    setLoading(true);
    const promises = nodes.map(node => 
      fetch(`/api/records/load?uuid=${node.uuid}&hours=${viewHours}`)
        .then(res => res.ok ? res.json() : null)
        .then(resp => ({
          nodeId: node.uuid,
          records: resp?.data?.records || []
        }))
        .catch(() => ({ nodeId: node.uuid, records: [] }))
    );
    
    Promise.all(promises)
      .then(results => {
        const newData: Record<string, LoadRecord[]> = {};
        
        results.forEach(result => {
          if (result.records.length > 0) {
            newData[result.nodeId] = result.records;
          }
        });
        
        setLoadData(newData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching load data:", err);
        setLoading(false);
      });
  }, [taskMode, nodesKey, viewHours, selectedMetrics]);

  // Process chart data
  const chartData = useMemo(() => {
    if (taskMode === "ping") {
      if (!selectedTaskId || !taskData[selectedTaskId]) return [];
      
      const records = taskData[selectedTaskId];
      if (!records.length) return [];
      
      const grouped: Record<string, any> = {};
      const timeKeys: number[] = [];
      
      // Get task interval for tolerance calculation
      const selectedTask = tasks.find(t => t.id === selectedTaskId);
      const taskInterval = selectedTask?.interval || 60;
      // Task模式下使用更宽松的容差，取任务间隔的100%或最小60秒
      const tolerance = Math.max(60, taskInterval) * 1000; // 时间点匹配容差（用于多节点数据分组）
      
      records.forEach(record => {
        const t = new Date(record.time).getTime();
        let foundKey = null;
        
        for (const key of timeKeys) {
          if (Math.abs(key - t) <= tolerance) {
            foundKey = key;
            break;
          }
        }
        
        const useKey = foundKey !== null ? foundKey : t;
        if (!grouped[useKey]) {
          grouped[useKey] = { time: new Date(useKey).toISOString() };
          if (foundKey === null) timeKeys.push(useKey);
        }
        
        const value = record.value === -1 ? null : record.value;
        grouped[useKey][record.client] = value;
      });
      
      let data = Object.values(grouped).sort(
        (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      
      data = fillMissingTimePoints(
        data,
        taskInterval,
        viewHours * 60 * 60,
        taskInterval  // 数据填充容差改为 interval * 1
      );
      
      // Pass taskInterval as minimum interval to prevent sampling below data generation rate
      data = sampleDataByRetention(data, viewHours, false, taskInterval);
      
      if (cutPeak && nodes) {
        const nodeKeys = nodes.map(n => n.uuid);
        data = cutPeakValues(data, nodeKeys);
      }
      
      return data;
    } else {
      // Load mode
      if (!Object.keys(loadData).length || selectedMetrics.length === 0) return [];
      
      const grouped: Record<number, any> = {};
      const timeKeys: number[] = [];
      
      // Group records by time with tolerance (similar to ping mode)
      Object.entries(loadData).forEach(([nodeId, records]) => {
        records.forEach(record => {
          const t = new Date(record.time).getTime();
          let foundKey = null;
          
          // Find if there's an existing time key within interval tolerance
          // 使用与数据填充相同的容差（interval * 1）
          const groupingTolerance = (viewHours <= 4 ? 60 : 60 * 15) * 1000; // 转换为毫秒
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
          
          selectedMetrics.forEach(metric => {
            const key = `${nodeId}_${metric}`;
            let value = record[metric as keyof LoadRecord] as number;
            
            // Handle special composite metrics and mappings
            if (metric === 'net_total') {
              // Net total is the sum of net_in and net_out at the same time point (current bandwidth)
              value = (record.net_in || 0) + (record.net_out || 0);
            } else if (metric === 'net_bandwidth') {
              // Total bandwidth is the sum of cumulative uploads and downloads
              value = (record.net_total_up || 0) + (record.net_total_down || 0);
            } else if (metric === 'traffic_limit') {
              // Traffic limit percentage calculation
              const node = nodes?.find(n => n.uuid === nodeId);
              if (node && Number(node.traffic_limit) > 0 && node.traffic_limit_type) {
                value = getTrafficPercentage(
                  record.net_total_up || 0,
                  record.net_total_down || 0,
                  node.traffic_limit,
                  node.traffic_limit_type
                );
              } else {
                value = 0; // No traffic limit set
              }
            } else if (metric === 'tcp') {
              // TCP connections maps to 'connections' field
              value = record.connections || 0;
            } else if (metric === 'udp') {
              // UDP connections maps to 'connections_udp' field
              value = record.connections_udp || 0;
            } else {
              // Handle metrics that might not exist in the record
              if (value === undefined || value === null) {
                console.warn(`Missing value for metric ${metric} in record`);
                value = 0;
              }
              
              // Convert values to appropriate format
              // API returns bytes for ram/disk/swap, need to convert to percentage
              if (metric === 'ram' && record.ram_total > 0) {
                value = (value / record.ram_total) * 100;
              } else if (metric === 'disk' && record.disk_total > 0) {
                value = (value / record.disk_total) * 100;
              } else if (metric === 'swap' && record.swap_total > 0) {
                value = (value / record.swap_total) * 100;
              }
              // CPU, GPU and other metrics keep original values from API
            }
            
            grouped[useKey][key] = value;
          });
        });
      });
      
      // Convert to array and sort by time
      let data = Object.values(grouped).sort(
        (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      
      // Fill missing time points based on time range
      // Backend records: <= 4 hours: 1 minute interval, > 4 hours: 15 minutes interval
      let interval, maxGap;
      
      if (viewHours <= 4) {
        interval = 60;     // 1分钟间隔
        maxGap = 60;       // 1分钟容差
      } else {
        interval = 60 * 15;  // 15分钟间隔
        maxGap = interval;   // 容差 = interval * 1
      }
      
      data = fillMissingTimePoints(data, interval, viewHours * 60 * 60, maxGap);
      
      // Sample data
      data = sampleDataByRetention(data, viewHours);
      
      // Apply peak cutting if enabled
      if (cutPeak && nodes) {
        const dataKeys: string[] = [];
        nodes.forEach(node => {
          selectedMetrics.forEach(metric => {
            dataKeys.push(`${node.uuid}_${metric}`);
          });
        });
        data = cutPeakValues(data, dataKeys);
      }
      
      return data;
    }
  }, [taskMode, taskData, loadData, selectedTaskId, selectedMetrics, cutPeak, nodes, viewHours, tasks]);

  // Calculate statistics
  const nodeStatistics = useMemo(() => {
    if (!chartData.length || !nodes) return {};
    
    const stats: Record<string, any> = {};
    
    if (taskMode === "ping") {
      nodes.forEach(node => {
        const values = chartData
          .map(d => d[node.uuid])
          .filter(v => v != null && v > 0);
        
        if (values.length > 0) {
          // Check for server-side statistics first
          const serverStats = serverPingStats[node.uuid];
          const backendLossRate = selectedTaskId ? taskLossRates[`${node.uuid}_${selectedTaskId}`] : undefined;
          
          // Use server stats if available, otherwise calculate from data
          const min = serverStats?.min !== undefined ? serverStats.min : Math.min(...values);
          const max = serverStats?.max !== undefined ? serverStats.max : Math.max(...values);
          const lossRate = serverStats?.loss !== undefined
            ? Math.round(serverStats.loss * 10) / 10
            : typeof backendLossRate === 'number'
              ? Math.round(backendLossRate * 10) / 10
              : Math.round((1 - values.length / chartData.length) * 1000) / 10;

          stats[node.uuid] = {
            min,
            max,
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            current: values[values.length - 1] || null,
            lossRate,
            totalSamples: chartData.length,
            validSamples: values.length,
            isBackendCalculated: serverStats?.loss !== undefined || typeof backendLossRate === 'number',
            hasServerStats: !!serverStats,
          };
        } else if (serverPingStats[node.uuid]) {
          // Even if no chart data, use server stats if available
          const serverStats = serverPingStats[node.uuid];

          stats[node.uuid] = {
            min: serverStats.min || 0,
            max: serverStats.max || 0,
            avg: 0, // No data to calculate average
            current: null,
            lossRate: Math.round((serverStats.loss || 0) * 10) / 10,
            totalSamples: 0,
            validSamples: 0,
            isBackendCalculated: true,
            hasServerStats: true,
          };
        }
      });
    } else {
      // Load mode statistics
      nodes.forEach(node => {
        const nodeStats: any = {
          metrics: {}
        };
        
        selectedMetrics.forEach(metric => {
          const key = `${node.uuid}_${metric}`;
          const values = chartData
            .map(d => d[key])
            .filter(v => v != null);
          
          if (values.length > 0) {
            const min = Math.min(...values);
            const max = Math.max(...values);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            
            nodeStats.metrics[metric] = {
              min,
              max,
              avg,
              range: max - min,  // Add range calculation
              current: values[values.length - 1] || null,
            };
          }
        });
        
        if (Object.keys(nodeStats.metrics).length > 0) {
          stats[node.uuid] = nodeStats;
        }
      });
    }
    
    return stats;
  }, [chartData, nodes, taskMode, selectedTaskId, taskLossRates, selectedMetrics, serverPingStats]);

  const toggleNode = useCallback((nodeId: string) => {
    setHiddenNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const toggleAllNodes = useCallback(() => {
    if (!nodes) return;
    const allHidden = nodes.every(node => hiddenNodes[node.uuid]);
    const newHiddenState: Record<string, boolean> = {};
    nodes.forEach(node => {
      newHiddenState[node.uuid] = !allHidden;
    });
    setHiddenNodes(newHiddenState);
  }, [nodes, hiddenNodes]);

  const handleExportImage = useCallback(async () => {
    if (!chartCardRef.current) {
      console.error('Chart card ref not found');
      return;
    }
    
    setIsExporting(true);
    
    try {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
      
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
          return !node.classList?.contains('ignore-export');
        },
      };
      
      const dataUrl = await domtoimage.toPng(chartCardRef.current, options);
      
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      link.download = `task-chart-${timestamp}.png`;
      link.href = dataUrl;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
    } catch (error) {
      console.error('Failed to export chart:', error);
      
      try {
        const blob = await domtoimage.toBlob(chartCardRef.current, {
          bgcolor: '#ffffff',
          quality: 0.95,
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        link.download = `task-chart-${timestamp}.png`;
        link.href = url;
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        alert('Failed to export chart. Please try using a different browser or take a screenshot instead.');
      }
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
    }
  }, []);

  const timeFormatter = (value: any) => {
    if (!value) return "";
    const date = new Date(value);
    if (viewHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
  };

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length || !nodes) return null;

    const validPayload = payload.filter((entry: any) => {
      if (taskMode === "ping") {
        return !hiddenNodes[entry.dataKey] && entry.value != null;
      } else {
        const [nodeId] = entry.dataKey.split('_');
        return !hiddenNodes[nodeId] && entry.value != null;
      }
    });

    if (!validPayload.length) return null;

    const displayPayload = validPayload.slice(0, 10);
    const hasMore = validPayload.length > 10;

    // 使用纯色背景,确保最佳兼容性
    const tooltipStyle = {
      minWidth: "180px",
      maxWidth: "300px",
      backgroundColor: "rgba(0, 0, 0, 0.95)",
      border: "1px solid rgba(255, 255, 255, 0.15)",
    };

    const tooltipClassName = "p-3 rounded-lg shadow-xl";

    return (
      <div className={tooltipClassName} style={tooltipStyle}>
        <p className="text-white font-medium text-xs mb-2">
          {new Date(label).toLocaleString([], { 
            month: "short",
            day: "numeric",
            hour: "2-digit", 
            minute: "2-digit",
            second: "2-digit"
          })}
        </p>
        <div className="space-y-1">
          {displayPayload.map((entry: any, index: number) => {
            if (taskMode === "ping") {
              const node = nodes.find(n => n.uuid === entry.dataKey);
              if (!node) return null;
              
              const colorScheme = getNodeColorScheme(node.uuid);
              
              return (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: colorScheme.primary }}
                    />
                    <span className="text-gray-300 text-xs truncate">
                      {node.name}
                    </span>
                  </div>
                  <span className="text-white font-semibold text-xs tabular-nums flex-shrink-0">
                    {entry.value.toFixed(1)}ms
                  </span>
                </div>
              );
            } else {
              const [nodeId, ...metricParts] = entry.dataKey.split('_');
              const metricKey = metricParts.join('_'); // Handle metrics like net_total_up
              const node = nodes.find(n => n.uuid === nodeId);
              if (!node) return null;
              
              const metric = metricKey as MetricType;
              const nodeIdx = nodes.indexOf(node);
              const colorScheme = nodeColorSchemes[nodeIdx % nodeColorSchemes.length];
              
              // Determine the actual color used in the chart
              let displayColor: string;
              const selectedMetrics = Object.keys(MetricConfigs).filter(m => 
                validPayload.some((p: any) => p.dataKey.endsWith(`_${m}`))
              ) as MetricType[];
              
              if (selectedMetrics.length === 1) {
                // Single metric: use node colors
                displayColor = colorScheme.primary;
              } else if (nodes.length === 1) {
                // Single node: use metric colors
                displayColor = MetricConfigs[metric]?.color || colorScheme.primary;
              } else {
                // Multiple nodes and metrics: use metric colors
                displayColor = MetricConfigs[metric]?.color || colorScheme.primary;
              }
              
              return (
                <div key={index} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: displayColor }}
                    />
                    <span className="text-gray-300 text-xs truncate">
                      {node.name} - {MetricConfigs[metric]?.label || metric}
                    </span>
                  </div>
                  <span className="text-white font-semibold text-xs tabular-nums flex-shrink-0">
                    {formatMetricValue(entry.value, metric)}
                  </span>
                </div>
              );
            }
          })}
          {hasMore && (
            <div className="text-gray-400 text-xs pt-1 border-t border-white/10">
              +{validPayload.length - 10} more...
            </div>
          )}
        </div>
      </div>
    );
  }, [hiddenNodes, nodes, taskMode]);

  if (error && taskMode === "ping") {
    return (
      <Box className="flex items-center justify-center h-96">
        <Card style={{ padding: "2rem", textAlign: "center" }}>
          <Text size="3" color="red" className="mb-2">{t("Error loading ping tasks")}</Text>
          <Text size="2" color="gray">{error}</Text>
        </Card>
      </Box>
    );
  }

  return (
    <Flex direction="column" gap="4" className="w-full px-4">
      {/* Mode selector and control panel */}
      <Card style={{ borderRadius: "12px", padding: "1.25rem", background: "var(--color-panel-solid)" }}>
        <Flex direction="column" gap="4">
          {/* Title and mode selector */}
          <Flex align="center" justify="between">
            <Flex align="center" gap="3">
              <Radar className="text-accent-9" size={isMobile ? 20 : 24} />
              <Text size={isMobile ? "3" : "4"} weight="bold">{t("Task Monitor")}</Text>
            </Flex>
            <SegmentedControl.Root
              value={taskMode}
              onValueChange={(value) => {
                setTaskMode(value as TaskMode);
                if (value === "ping") {
                  setTasks([]);
                  setSelectedTaskId(null);
                  setTaskData({});
                }
              }}
              size={isMobile ? "1" : "2"}
            >
              <SegmentedControl.Item value="ping">{t("Ping Tasks")}</SegmentedControl.Item>
              <SegmentedControl.Item value="load">{t("Load Metrics")}</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          
          {/* Task/Metric selector */}
          {taskMode === "ping" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {tasks.map(task => (
                <motion.button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`p-3 rounded-lg border-2 transition-all overflow-hidden ${
                    selectedTaskId === task.id
                      ? "bg-accent-3 border-accent-7 shadow-lg"
                      : "bg-gray-a2 border-gray-a4 hover:bg-gray-a3 hover:border-gray-a5"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Flex direction="column" align="start" gap="2">
                    <Text size="2" weight="bold" className="truncate w-full" title={task.name}>{task.name}</Text>
                    <Flex align="center" gap="1">
                      <Activity size={12} className="text-gray-9" />
                      <Text size="1" color="gray" className="whitespace-nowrap">
                        {task.interval}s
                      </Text>
                    </Flex>
                  </Flex>
                </motion.button>
              ))}
            </div>
          ) : (
            <Flex direction="column" gap="3">
              {/* Metric selector - organized by category */}
              <div className="space-y-3">
                {/* System Metrics */}
                <div>
                  <Text size="1" weight="medium" color="gray" className="mb-2 block">System</Text>
                  <div className={isMobile ? "flex flex-col gap-2" : "grid grid-cols-3 md:grid-cols-6 gap-2"}>
                    {["cpu", "gpu", "ram", "swap", "load", "temp"].map(key => {
                      const metric = key as MetricType;
                      const config = MetricConfigs[metric];
                      const isSelected = selectedMetrics.includes(metric);
                      
                      return (
                        <motion.button
                          key={metric}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMetrics(prev => prev.filter(m => m !== metric));
                            } else {
                              setSelectedMetrics([metric]);
                            }
                          }}
                          className={`${isMobile ? 'p-3 justify-start' : 'p-2 justify-center'} rounded-lg border transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-accent-3 border-accent-7"
                              : "bg-gray-a2 border-gray-a4 hover:bg-gray-a3"
                          }`}
                          whileHover={{ scale: isMobile ? 1 : 1.02 }}
                          whileTap={{ scale: isMobile ? 0.99 : 0.98 }}
                        >
                          {getMetricIcon(metric)}
                          <Text size={isMobile ? "2" : "1"} weight="medium">{config.label}</Text>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Network Metrics */}
                <div>
                  <Text size="1" weight="medium" color="gray" className="mb-2 block">Network</Text>
                  <div className={isMobile ? "flex flex-col gap-2" : "grid grid-cols-3 md:grid-cols-6 gap-2"}>
                    {["net_in", "net_out", "net_total", "net_total_up", "net_total_down", "net_bandwidth", "traffic_limit"].map(key => {
                      const metric = key as MetricType;
                      const config = MetricConfigs[metric];
                      const isSelected = selectedMetrics.includes(metric);
                      
                      return (
                        <motion.button
                          key={metric}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMetrics(prev => prev.filter(m => m !== metric));
                            } else {
                              const nonNetworkMetrics = selectedMetrics.filter(m => !isNetworkMetric(m));
                              if (nonNetworkMetrics.length > 0) {
                                setSelectedMetrics([metric]);
                              } else {
                                setSelectedMetrics(prev => [...prev, metric]);
                              }
                            }
                          }}
                          className={`${isMobile ? 'p-3 justify-start' : 'p-2 justify-center'} rounded-lg border transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-accent-3 border-accent-7"
                              : "bg-gray-a2 border-gray-a4 hover:bg-gray-a3"
                          }`}
                          whileHover={{ scale: isMobile ? 1 : 1.02 }}
                          whileTap={{ scale: isMobile ? 0.99 : 0.98 }}
                        >
                          {getMetricIcon(metric)}
                          <Text size={isMobile ? "2" : "1"} weight="medium">{config.label}</Text>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Storage & Process */}
                <div>
                  <Text size="1" weight="medium" color="gray" className="mb-2 block">Storage & Process</Text>
                  <div className={isMobile ? "flex flex-col gap-2" : "grid grid-cols-3 md:grid-cols-6 gap-2"}>
                    {["disk", "process", "tcp", "udp"].map(key => {
                      const metric = key as MetricType;
                      const config = MetricConfigs[metric];
                      const isSelected = selectedMetrics.includes(metric);
                      
                      return (
                        <motion.button
                          key={metric}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMetrics(prev => prev.filter(m => m !== metric));
                            } else {
                              setSelectedMetrics([metric]);
                            }
                          }}
                          className={`${isMobile ? 'p-3 justify-start' : 'p-2 justify-center'} rounded-lg border transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-accent-3 border-accent-7"
                              : "bg-gray-a2 border-gray-a4 hover:bg-gray-a3"
                          }`}
                          whileHover={{ scale: isMobile ? 1 : 1.02 }}
                          whileTap={{ scale: isMobile ? 0.99 : 0.98 }}
                        >
                          {getMetricIcon(metric)}
                          <Text size={isMobile ? "2" : "1"} weight="medium">{config.label}</Text>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Flex>
          )}

          {/* Control options */}
          {isMobile ? (
            <Flex direction="column" gap="3">
              <div>
                <Flex align="center" justify="between" className="mb-2">
                  <Text size="1" weight="medium">{t("Time Range")}</Text>
                  <Flex gap="2" align="center">
                    <Switch
                      id="cut-peak"
                      checked={cutPeak}
                      onCheckedChange={setCutPeak}
                      size="1"
                    />
                    <label htmlFor="cut-peak" className="text-xs whitespace-nowrap">
                      {t("chart.cutPeak")}
                    </label>
                  </Flex>
                  <Flex gap="2" align="center">
                    <Switch
                      id="connect-nulls-mobile"
                      checked={connectNulls}
                      onCheckedChange={setConnectNulls}
                      size="1"
                    />
                    <label htmlFor="connect-nulls-mobile" className="text-xs whitespace-nowrap">
                      {t("chart.connectNulls")}
                    </label>
                  </Flex>
                </Flex>
                <div 
                  className="overflow-x-auto pb-2 -mx-2 px-2"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "var(--gray-a6) var(--gray-a3)",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div className="inline-flex">
                    <SegmentedControl.Root
                      value={String(viewHours)}
                      onValueChange={(value) => setViewHours(Number(value))}
                      size="1"
                      style={{ minWidth: "max-content" }}
                    >
                      {availableViews.map(view => (
                        <SegmentedControl.Item 
                          key={view.hours} 
                          value={String(view.hours)}
                          className="whitespace-nowrap px-2"
                          style={{ fontSize: "12px" }}
                        >
                          {view.label}
                        </SegmentedControl.Item>
                      ))}
                    </SegmentedControl.Root>
                  </div>
                </div>
              </div>
            </Flex>
          ) : (
            <Flex justify="between" align="center" gap="4" wrap="wrap">
              <Flex gap="3" align="center">
                <Text size="2" weight="medium">{t("Time Range")}:</Text>
                <SegmentedControl.Root
                  value={String(viewHours)}
                  onValueChange={(value) => setViewHours(Number(value))}
                  size="2"
                >
                  {availableViews.map(view => (
                    <SegmentedControl.Item key={view.hours} value={String(view.hours)}>
                      {view.label}
                    </SegmentedControl.Item>
                  ))}
                </SegmentedControl.Root>
              </Flex>
              
              <Flex gap="3" align="center">
                <Text size="2" weight="medium">{t("Chart Type")}:</Text>
                <SegmentedControl.Root
                  value={chartType}
                  onValueChange={(value) => setChartType(value as any)}
                  size="2"
                >
                  <SegmentedControl.Item value="line">Line</SegmentedControl.Item>
                  <SegmentedControl.Item value="area">Area</SegmentedControl.Item>
                  <SegmentedControl.Item value="composed">Combined</SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>

              <Flex gap="3" align="center">
                <Switch
                  id="cut-peak"
                  checked={cutPeak}
                  onCheckedChange={setCutPeak}
                  size="2"
                />
                <label htmlFor="cut-peak" className="text-sm font-medium cursor-pointer">
                  {t("chart.cutPeak")}
                </label>
              </Flex>
              <Flex gap="3" align="center">
                <Switch
                  id="connect-nulls"
                  checked={connectNulls}
                  onCheckedChange={setConnectNulls}
                  size="2"
                />
                <label htmlFor="connect-nulls" className="text-sm font-medium cursor-pointer">
                  {t("chart.connectNulls")}
                </label>
              </Flex>
            </Flex>
          )}
        </Flex>
      </Card>

      {/* Mobile Chart Type selector */}
      {isMobile && (
        <Card style={{ 
          borderRadius: "12px", 
          padding: "0.75rem",
          background: "var(--color-panel-solid)",
          border: "1px solid var(--gray-a3)"
        }}>
          <div>
            <Text size="2" weight="medium" className="mb-2">{t("Chart Type")}</Text>
            <div 
              className="overflow-x-auto pb-2 -mx-2 px-2"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "var(--gray-a6) var(--gray-a3)",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div className="inline-flex w-full">
                <SegmentedControl.Root
                  value={chartType}
                  onValueChange={(value) => setChartType(value as any)}
                  size="2"
                  className="w-full"
                >
                  <SegmentedControl.Item value="line" className="flex-1">
                    Line
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="area" className="flex-1">
                    Area
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="composed" className="flex-1">
                    Combined
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Node statistics cards */}
      {nodes && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card style={{ 
            borderRadius: "16px", 
            padding: "1.5rem",
            background: "linear-gradient(135deg, var(--color-panel-solid) 0%, var(--gray-a2) 100%)",
            border: "1px solid var(--gray-a3)"
          }}>
            <Flex direction="column" gap="4">
              <Flex align="center" justify="between">
                <Flex align="center" gap="3">
                  <Signal className="text-accent-9" size={20} />
                  <Text size="3" weight="bold" className="truncate max-w-md">
                    {taskMode === "ping" 
                      ? `${tasks.find(t => t.id === selectedTaskId)?.name || ""} - ${t("Node Statistics")}`
                      : `${t("Node Metrics Overview")}`
                    }
                  </Text>
                </Flex>
                <Button
                  variant="soft"
                  size="2"
                  onClick={toggleAllNodes}
                >
                  {nodes.every(n => hiddenNodes[n.uuid]) ? (
                    <><Eye size={16} /> {t("Show All")}</>
                  ) : (
                    <><EyeOff size={16} /> {t("Hide All")}</>
                  )}
                </Button>
              </Flex>
              
              <div className={
                isMobile 
                  ? 'grid grid-cols-2 gap-2' 
                  : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3'
              }>
                {nodes.filter(node => {
                  const stats = nodeStatistics[node.uuid];
                  return stats && (taskMode === "ping" ? stats.validSamples > 0 : Object.keys(stats.metrics || {}).length > 0);
                }).map((node) => {
                  const stats = nodeStatistics[node.uuid];
                  const isHidden = hiddenNodes[node.uuid];
                  const colorScheme = getNodeColorScheme(node.uuid);
                  const isOnline = onlineStatusMap[node.uuid] || false;
                  
                  return (
                    <motion.div
                      key={node.uuid}
                      className={`relative overflow-hidden rounded-xl cursor-pointer transition-all ${
                        isMobile ? 'p-2.5' : 'p-3'
                      }`}
                      style={{
                        background: isHidden
                          ? "var(--gray-a2)"
                          : `linear-gradient(135deg, ${colorScheme.primary}15 0%, ${colorScheme.secondary}10 100%)`,
                        border: `2px solid ${isHidden ? "var(--gray-a4)" : colorScheme.primary}30`,
                        opacity: isHidden ? 0.6 : 1,
                      }}
                      onClick={() => toggleNode(node.uuid)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          background: `radial-gradient(circle at top right, ${colorScheme.primary}40, transparent 70%)`,
                        }}
                      />
                      
                      <div className="relative">
                        <Flex align="center" gap={isMobile ? "1" : "2"} className={isMobile ? "mb-2" : "mb-3"}>
                          <div
                            className={`${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full animate-pulse`}
                            style={{
                              background: isOnline ? colorScheme.primary : "#6B7280",
                              opacity: isHidden ? 0.3 : 1,
                              boxShadow: isHidden ? 'none' : `0 0 12px ${isOnline ? colorScheme.shadow : "rgba(107, 114, 128, 0.3)"}`,
                            }}
                          />
                          {!isMobile && <Flag flag={node.region} />}
                          <Text size={isMobile ? "1" : "2"} weight="bold" className="truncate flex-1" style={{ maxWidth: isMobile ? "80px" : "120px" }}>
                            {node.name}
                          </Text>
                          {!isHidden && (
                            isOnline ? (
                              <CheckCircle size={isMobile ? 12 : 16} className="text-green-500 flex-shrink-0" />
                            ) : (
                              <XCircle size={isMobile ? 12 : 16} className="text-red-500 flex-shrink-0" />
                            )
                          )}
                        </Flex>
                        
                        {taskMode === "ping" ? (
                          <div className={isMobile ? "space-y-1.5" : "space-y-2"}>
                            <div className="flex items-center justify-between">
                              <Text size="1" color="gray">{isMobile ? "Now" : t("Current")}:</Text>
                              <Text size={isMobile ? "1" : "2"} weight="bold" style={{ color: colorScheme.primary }}>
                                {stats.current ? `${stats.current.toFixed(1)}ms` : "-"}
                              </Text>
                            </div>
                            
                            <div className={`w-full ${isMobile ? 'h-1' : 'h-1.5'} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
                              <div 
                                className="h-full transition-all duration-500"
                                style={{
                                  width: stats.current ? `${Math.min((stats.current / 200) * 100, 100)}%` : '0%',
                                  background: `linear-gradient(90deg, ${colorScheme.primary}, ${colorScheme.secondary})`,
                                }}
                              />
                            </div>
                            
                            {isMobile ? (
                              <div className="grid grid-cols-2 gap-x-1 text-xs">
                                <div>
                                  <Text color="gray" size="1">Loss:</Text>
                                  <Text size="1" weight="medium" className={stats.lossRate > 10 ? "text-red-500" : ""}>
                                    {stats.lossRate}%
                                  </Text>
                                </div>
                                <div>
                                  <Text color="gray" size="1">Avg:</Text>
                                  <Text size="1" weight="medium">{stats.avg.toFixed(1)}ms</Text>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-1 text-xs">
                                <div>
                                  <Text color="gray" size="1">Loss:</Text>
                                  <Text size="1" weight="medium" className={stats.lossRate > 10 ? "text-red-500" : ""}>
                                    {stats.lossRate}%
                                  </Text>
                                </div>
                                <div>
                                  <Text color="gray" size="1">Avg:</Text>
                                  <Text size="1" weight="medium">{stats.avg.toFixed(1)}ms</Text>
                                </div>
                                <div>
                                  <Text color="gray" size="1">Min:</Text>
                                  <Text size="1">{stats.min.toFixed(0)}ms</Text>
                                </div>
                                <div>
                                  <Text color="gray" size="1">Max:</Text>
                                  <Text size="1">{stats.max.toFixed(0)}ms</Text>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={isMobile ? "space-y-1" : "space-y-1.5"}>
                            {/* Show current value */}
                            <div className="flex items-center justify-between">
                              <Text size="1" color="gray">{isMobile ? "Now" : t("Current")}:</Text>
                              <Text size={isMobile ? "1" : "2"} weight="bold" style={{ color: colorScheme.primary }}>
                                {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]] 
                                  ? formatMetricValue(stats.metrics[selectedMetrics[0]].current || 0, selectedMetrics[0])
                                  : "-"}
                              </Text>
                            </div>
                            
                            {/* Progress bar for percentage metrics */}
                            {selectedMetrics[0] && ['cpu', 'gpu', 'ram', 'disk', 'swap', 'traffic_limit'].includes(selectedMetrics[0]) && stats.metrics?.[selectedMetrics[0]] && (
                              <div className={`w-full ${isMobile ? 'h-1' : 'h-1.5'} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
                                <div 
                                  className="h-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(stats.metrics[selectedMetrics[0]].current || 0, 100)}%`,
                                    background: `linear-gradient(90deg, ${colorScheme.primary}, ${colorScheme.secondary})`,
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Show metrics stats */}
                            {isMobile ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <Text color="gray" size="1">Avg:</Text>
                                  <Text size="1" weight="medium" className="tabular-nums">
                                    {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                      ? formatMetricValue(stats.metrics[selectedMetrics[0]].avg, selectedMetrics[0])
                                      : "-"}
                                  </Text>
                                </div>
                                {/* Range on separate line */}
                                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                                  <Text color="gray" size="1" className="text-xs">Range:</Text>
                                  <Text size="1" weight="medium" className="text-xs tabular-nums text-center block mt-0.5">
                                    {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                      ? `${formatMetricValue(stats.metrics[selectedMetrics[0]].min, selectedMetrics[0])} - ${formatMetricValue(stats.metrics[selectedMetrics[0]].max, selectedMetrics[0])}`
                                      : "-"}
                                  </Text>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1 text-xs">
                                  <div>
                                    <Text color="gray" size="1">Avg:</Text>
                                    <Text size="1" weight="medium" className="tabular-nums">
                                      {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                        ? formatMetricValue(stats.metrics[selectedMetrics[0]].avg, selectedMetrics[0])
                                        : "-"}
                                    </Text>
                                  </div>
                                  <div>
                                    <Text color="gray" size="1">Min:</Text>
                                    <Text size="1" className="tabular-nums">
                                      {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                        ? formatMetricValue(stats.metrics[selectedMetrics[0]].min, selectedMetrics[0])
                                        : "-"}
                                    </Text>
                                  </div>
                                  <div>
                                    <Text color="gray" size="1">Max:</Text>
                                    <Text size="1" className="tabular-nums">
                                      {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                        ? formatMetricValue(stats.metrics[selectedMetrics[0]].max, selectedMetrics[0])
                                        : "-"}
                                    </Text>
                                  </div>
                                </div>
                                {/* Range on separate line */}
                                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                                  <Text color="gray" size="1" className="text-xs">Range:</Text>
                                  <Text size="1" weight="medium" className="text-xs tabular-nums block mt-0.5">
                                    {stats.metrics && selectedMetrics[0] && stats.metrics[selectedMetrics[0]]
                                      ? `${formatMetricValue(stats.metrics[selectedMetrics[0]].min, selectedMetrics[0])} - ${formatMetricValue(stats.metrics[selectedMetrics[0]].max, selectedMetrics[0])}`
                                      : "-"}
                                  </Text>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isHidden && (
                          <div className="absolute top-2 right-2">
                            <EyeOff size={16} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Flex>
          </Card>
        </motion.div>
      )}

      {/* Main chart */}
      {loading && (
        <Card style={{ borderRadius: "16px", padding: "4rem" }}>
          <Flex justify="center" align="center">
            <Loading />
          </Flex>
        </Card>
      )}
      
      {error && (
        <Card style={{ borderRadius: "16px", padding: "2rem" }}>
          <Flex justify="center" align="center">
            <Text color="red">{error}</Text>
          </Flex>
        </Card>
      )}
      
      {!loading && !error && chartData.length > 0 && nodes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card 
            ref={chartCardRef}
            style={{ 
              borderRadius: "16px", 
              padding: "2rem",
              background: "linear-gradient(135deg, var(--color-panel-solid) 0%, var(--gray-a1) 100%)",
              border: "1px solid var(--gray-a3)",
              minHeight: "500px",
              margin: "8px"
            }}
          >
            <Flex direction="column" gap="3">
              <Flex align="center" justify="between">
                <Flex align="center" gap="3">
                  <Zap className="text-accent-9" size={20} />
                  <Text size="3" weight="bold" className="truncate max-w-md">
                    {taskMode === "ping" 
                      ? `${tasks.find(t => t.id === selectedTaskId)?.name || ""} - ${t("Latency Chart")}`
                      : `${t("Metrics Chart")}`
                    }
                  </Text>
                </Flex>
                {!isMobile && !isSafari && (
                  <Button
                    variant="soft"
                    size="2"
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="ignore-export"
                  >
                    {isExporting ? (
                      <Loading />
                    ) : (
                      <>
                        <Camera size={16} />
                        {t("Export")}
                      </>
                    )}
                  </Button>
                )}
              </Flex>
              
              {/* Legend */}
              {!isMobile && (
                <div className="flex flex-wrap gap-2 mb-3 justify-center">
                  {taskMode === "ping" ? (
                    (() => {
                      const visibleNodes = nodes.filter(node => {
                        const stats = nodeStatistics[node.uuid];
                        return stats && stats.validSamples > 0 && !hiddenNodes[node.uuid];
                      });
                      const displayNodes = visibleNodes.slice(0, 10);
                      const remaining = visibleNodes.length - 10;
                      
                      return (
                        <>
                          {displayNodes.map((node) => {
                      const colorScheme = getNodeColorScheme(node.uuid);
                      const stats = nodeStatistics[node.uuid];
                      const hasData = stats && stats.current !== null;
                      
                      return (
                        <div
                          key={node.uuid}
                          className="flex items-center gap-2 px-3 py-1 rounded-md"
                          style={{
                            background: `${colorScheme.primary}10`,
                            border: `1px solid ${colorScheme.primary}30`,
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              background: hasData ? colorScheme.primary : "var(--gray-a5)",
                              boxShadow: hasData ? `0 0 6px ${colorScheme.shadow}` : 'none',
                            }}
                          />
                          <span className="text-sm font-medium">{node.name}</span>
                        </div>
                      );
                    })}
                    {remaining > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">+{remaining} more</span>
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
                    // Load mode: show node-metric combinations
                    (() => {
                      const allCombinations = nodes.filter(node => !hiddenNodes[node.uuid]).flatMap((node) => 
                        selectedMetrics.map(metric => ({
                          node,
                          metric,
                          key: `${node.uuid}_${metric}`
                        }))
                      );
                      
                      const displayCombinations = allCombinations.slice(0, 10);
                      const remaining = allCombinations.length - 10;
                      
                      return (
                        <>
                          {displayCombinations.map(({ node, metric, key }) => {
                            const nodeColorScheme = getNodeColorScheme(node.uuid);
                            
                            // Determine display color based on selection
                            let displayColor: string;
                            let strokeDash: string | undefined;
                            
                            if (selectedMetrics.length === 1) {
                              // Single metric: use different colors for each node
                              displayColor = nodeColorScheme.primary;
                            } else if (nodes.length === 1) {
                              // Single node: use different colors for each metric
                              displayColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                            } else {
                              // Multiple nodes and metrics: use metric colors with dash variation
                              displayColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                              strokeDash = nodes.findIndex(n => n.uuid === node.uuid) > 0 ? "5 3" : undefined;
                            }
                            
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer transition-opacity opacity-100"
                                style={{
                                  background: `${displayColor}10`,
                                  border: `1px solid ${displayColor}30`,
                                }}
                                onClick={() => toggleNode(node.uuid)}
                              >
                                <div className="flex items-center gap-1">
                                  {strokeDash ? (
                                    <svg width="16" height="3" className="flex-shrink-0">
                                      <line
                                        x1="0"
                                        y1="1.5"
                                        x2="16"
                                        y2="1.5"
                                        stroke={displayColor}
                                        strokeWidth="2"
                                        strokeDasharray={strokeDash}
                                      />
                                    </svg>
                                  ) : (
                                    <div
                                      className="w-4 h-0.5 flex-shrink-0"
                                      style={{ background: displayColor }}
                                    />
                                  )}
                                </div>
                                <span className="text-xs font-medium">
                                  {node.name} - {MetricConfigs[metric]?.label || metric}
                                </span>
                              </div>
                            );
                          })}
                          {remaining > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">+{remaining} more</span>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              )}
              
              <ResponsiveContainer width="100%" height={450}>
                {chartType === "line" ? (
                  <LineChart 
                    key={`line-${Object.keys(hiddenNodes).filter(k => hiddenNodes[k]).join('-')}`}
                    data={chartData} 
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    className="chart-line">
                    <defs>
                      <clipPath id="task-chart-clip">
                        <rect x={0} y={0} width="100%" height="100%" />
                      </clipPath>
                      {nodeColorSchemes.map((scheme, idx) => (
                        <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={scheme.primary} stopOpacity={0.8} />
                          <stop offset="100%" stopColor={scheme.secondary} stopOpacity={0.1} />
                        </linearGradient>
                      ))}
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-a3)" strokeOpacity={0.3} />
                    <XAxis dataKey="time" tickFormatter={timeFormatter} stroke="var(--gray-a6)" />
                    <YAxis stroke="var(--gray-a6)" tickFormatter={getYAxisFormatter()} />
                    <Tooltip content={CustomTooltip} />
                    
                    {taskMode === "ping" ? (
                      nodes.filter(node => {
                        const stats = nodeStatistics[node.uuid];
                        return stats && stats.validSamples > 0 && !hiddenNodes[node.uuid];
                      }).map((node) => {
                        const colorScheme = getNodeColorScheme(node.uuid);
                        
                        return (
                          <Line
                            key={node.uuid}
                            type={cutPeak ? "monotone" : "linear"}
                            dataKey={node.uuid}
                            stroke={colorScheme.primary}
                            strokeWidth={2}
                            dot={false}
                            strokeOpacity={1}
                            fill="none"
                            connectNulls={connectNulls}
                            isAnimationActive={false}
                            clipPath="url(#task-chart-clip)"
                          />
                        );
                      })
                    ) : (
                      nodes.filter(node => !hiddenNodes[node.uuid]).flatMap((node) => 
                        selectedMetrics.map((metric) => {
                          const key = `${node.uuid}_${metric}`;
                          const nodeIdx = nodes.findIndex(n => n.uuid === node.uuid);
                          
                          // Create unique color for each node-metric combination
                          const nodeColorScheme = getNodeColorScheme(node.uuid);
                          
                          // If only one metric selected, use different colors for different nodes
                          // If multiple metrics selected, use metric colors but with node variations
                          let color: string;
                          if (selectedMetrics.length === 1) {
                            // Single metric: use different colors for each node
                            color = nodeColorScheme.primary;
                          } else if (nodes.length === 1) {
                            // Single node: use different colors for each metric
                            color = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                          } else {
                            // Multiple nodes and metrics: combine both approaches
                            // Use metric color as base but add opacity/lightness variation per node
                            color = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                            // Add stroke dash for additional differentiation
                          }
                          
                          return (
                            <Line
                              key={key}
                              type={cutPeak ? "monotone" : "linear"}
                              dataKey={key}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                              strokeOpacity={nodes.length > 1 && selectedMetrics.length > 1 ? 0.7 + (nodeIdx * 0.1) : 1}
                              strokeDasharray={nodes.length > 1 && selectedMetrics.length > 1 && nodeIdx > 0 ? "5 3" : undefined}
                              fill="none"
                              connectNulls={connectNulls}
                              isAnimationActive={false}
                              clipPath="url(#task-chart-clip)"
                            />
                          );
                        })
                      )
                    )}
                  </LineChart>
                ) : chartType === "area" ? (
                  <AreaChart 
                    key={`area-${Object.keys(hiddenNodes).filter(k => hiddenNodes[k]).join('-')}`}
                    data={chartData} 
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    className="chart-area">
                    <defs>
                      <clipPath id="task-chart-clip">
                        <rect x={0} y={0} width="100%" height="100%" />
                      </clipPath>
                      {nodeColorSchemes.map((scheme, idx) => (
                        <linearGradient key={idx} id={`area-gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={scheme.primary} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={scheme.secondary} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                      {Object.entries(MetricConfigs).map(([key, config]) => (
                        <linearGradient key={key} id={`metric-gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={config.color} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={config.color} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-a3)" strokeOpacity={0.3} />
                    <XAxis dataKey="time" tickFormatter={timeFormatter} stroke="var(--gray-a6)" />
                    <YAxis stroke="var(--gray-a6)" tickFormatter={getYAxisFormatter()} />
                    <Tooltip content={CustomTooltip} />
                    
                    {taskMode === "ping" ? (
                      nodes.filter(node => {
                        const stats = nodeStatistics[node.uuid];
                        return stats && stats.validSamples > 0 && !hiddenNodes[node.uuid];
                      }).map((node) => {
                        const colorScheme = getNodeColorScheme(node.uuid);
                        const nodeIndex = nodes.findIndex(n => n.uuid === node.uuid);
                        
                        return (
                          <Area
                            key={node.uuid}
                            type={cutPeak ? "monotone" : "linear"}
                            dataKey={node.uuid}
                            stroke={colorScheme.primary}
                            fill={`url(#area-gradient-${nodeIndex % nodeColorSchemes.length})`}
                            strokeWidth={1.5}
                            stackId="1"
                          />
                        );
                      })
                    ) : (
                      nodes.filter(node => !hiddenNodes[node.uuid]).flatMap((node) => 
                        selectedMetrics.map(metric => {
                          const key = `${node.uuid}_${metric}`;
                          const nodeColorScheme = getNodeColorScheme(node.uuid);
                          
                          let strokeColor: string;
                          if (selectedMetrics.length === 1) {
                            strokeColor = nodeColorScheme.primary;
                          } else if (nodes.length === 1) {
                            strokeColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                          } else {
                            strokeColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                          }
                          
                          return (
                            <Area
                              key={key}
                              type={cutPeak ? "monotone" : "linear"}
                              dataKey={key}
                              stroke={strokeColor}
                              fill={`url(#metric-gradient-${metric})`}
                              strokeWidth={1.5}
                              stackId={metric}
                              connectNulls={connectNulls}
                            />
                          );
                        })
                      )
                    )}
                  </AreaChart>
                ) : (
                  <ComposedChart 
                    key={`composed-${Object.keys(hiddenNodes).filter(k => hiddenNodes[k]).join('-')}`}
                    data={chartData} 
                    margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    className="chart-composed">
                    <defs>
                      <clipPath id="task-chart-clip">
                        <rect x={0} y={0} width="100%" height="100%" />
                      </clipPath>
                      {nodeColorSchemes.map((scheme, idx) => (
                        <linearGradient key={idx} id={`composed-gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={scheme.primary} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={scheme.secondary} stopOpacity={0.1} />
                        </linearGradient>
                      ))}
                      {Object.entries(MetricConfigs).map(([key, config]) => (
                        <linearGradient key={key} id={`metric-composed-gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={config.color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={config.color} stopOpacity={0.1} />
                        </linearGradient>
                      ))}
                    </defs>
                    
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-a3)" strokeOpacity={0.3} />
                    <XAxis dataKey="time" tickFormatter={timeFormatter} stroke="var(--gray-a6)" />
                    <YAxis stroke="var(--gray-a6)" tickFormatter={getYAxisFormatter()} />
                    <Tooltip content={CustomTooltip} />
                    
                    {taskMode === "ping" ? (
                      nodes.filter(node => {
                        const stats = nodeStatistics[node.uuid];
                        return stats && stats.validSamples > 0 && !hiddenNodes[node.uuid];
                      }).map((node) => {
                        const colorScheme = getNodeColorScheme(node.uuid);
                        const nodeIndex = nodes.findIndex(n => n.uuid === node.uuid);
                        
                        // 统一的规则：前半部分使用Area，后半部分使用Line
                        const visibleNodes = nodes.filter(n => {
                          const s = nodeStatistics[n.uuid];
                          return s && s.validSamples > 0 && !hiddenNodes[n.uuid];
                        });
                        const visibleIndex = visibleNodes.findIndex(n => n.uuid === node.uuid);
                        const useArea = visibleIndex < Math.ceil(visibleNodes.length / 2);
                        
                        if (useArea) {
                          return (
                            <Area
                              key={node.uuid}
                              type={cutPeak ? "monotone" : "linear"}
                              dataKey={node.uuid}
                              stroke={colorScheme.primary}
                              fill={`url(#composed-gradient-${nodeIndex % nodeColorSchemes.length})`}
                              strokeWidth={1.5}
                              isAnimationActive={false}
                              connectNulls={connectNulls}
                            />
                          );
                        } else {
                          return (
                            <Line
                              key={node.uuid}
                              type={cutPeak ? "monotone" : "linear"}
                              dataKey={node.uuid}
                              stroke={colorScheme.primary}
                              strokeWidth={2}
                              dot={false}
                              strokeOpacity={1}
                              fill="none"
                              connectNulls={connectNulls}
                              isAnimationActive={false}
                              clipPath="url(#task-chart-clip)"
                            />
                          );
                        }
                      })
                    ) : (
                      nodes.filter(node => !hiddenNodes[node.uuid]).flatMap((node) => 
                        selectedMetrics.map((metric, metricIdx) => {
                          const key = `${node.uuid}_${metric}`;
                          const nodeIdx = nodes.findIndex(n => n.uuid === node.uuid);
                          const totalItems = nodes.length * selectedMetrics.length;
                          const currentIdx = nodeIdx * selectedMetrics.length + metricIdx;
                          const nodeColorScheme = getNodeColorScheme(node.uuid);
                          
                          let strokeColor: string;
                          if (selectedMetrics.length === 1) {
                            strokeColor = nodeColorScheme.primary;
                          } else if (nodes.length === 1) {
                            strokeColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                          } else {
                            strokeColor = MetricConfigs[metric]?.color || nodeColorScheme.primary;
                          }
                          
                          if (currentIdx < totalItems / 2) {
                            return (
                              <Area
                                key={key}
                                type={cutPeak ? "monotone" : "linear"}
                                dataKey={key}
                                stroke={strokeColor}
                                fill={`url(#metric-composed-gradient-${metric})`}
                                strokeWidth={1.5}
                                connectNulls={connectNulls}
                                isAnimationActive={false}
                              />
                            );
                          } else {
                            return (
                              <Line
                                key={key}
                                type={cutPeak ? "monotone" : "linear"}
                                dataKey={key}
                                stroke={strokeColor}
                                strokeWidth={2}
                                dot={false}
                                strokeOpacity={1}
                                fill="none"
                                strokeDasharray={nodes.length > 1 && selectedMetrics.length > 1 && nodeIdx > 0 ? "5 3" : undefined}
                                connectNulls={connectNulls}
                                isAnimationActive={false}
                                clipPath="url(#task-chart-clip)"
                              />
                            );
                          }
                        })
                      )
                    )}
                  </ComposedChart>
                )}
              </ResponsiveContainer>
              
              {/* Mobile node toggles */}
              {isMobile && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {nodes.filter(node => {
                    const stats = nodeStatistics[node.uuid];
                    return stats && (taskMode === "ping" ? stats.validSamples > 0 : Object.keys(stats.metrics || {}).length > 0);
                  }).slice(0, 20).map((node) => {
                    const isHidden = hiddenNodes[node.uuid];
                    const colorScheme = getNodeColorScheme(node.uuid);
                    const stats = nodeStatistics[node.uuid];
                    const hasData = stats && (taskMode === "ping" ? stats.current !== null : Object.keys(stats.metrics || {}).length > 0);
                    
                    return (
                      <button
                        key={node.uuid}
                        onClick={() => toggleNode(node.uuid)}
                        className="px-3 py-2 rounded-md flex items-center gap-2 transition-all"
                        style={{
                          background: isHidden ? "var(--gray-a3)" : `${colorScheme.primary}20`,
                          border: `1px solid ${isHidden ? "var(--gray-a5)" : colorScheme.primary}40`,
                          opacity: isHidden ? 0.5 : (hasData ? 1 : 0.7),
                        }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            background: hasData ? colorScheme.primary : "var(--gray-a5)",
                            opacity: isHidden ? 0.3 : 1,
                          }}
                        />
                        <span className="text-xs font-medium truncate flex-1 text-left">
                          {node.name}
                        </span>
                        {isHidden && <EyeOff size={12} className="flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </Flex>
          </Card>
        </motion.div>
      )}
    </Flex>
  );
};

export default TaskDisplay;