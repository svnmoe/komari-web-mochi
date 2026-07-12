import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useLiveData } from "../../contexts/LiveDataContext";
import { useTranslation } from "react-i18next";
import { Card, Flex, SegmentedControl, Switch, Text } from "@radix-ui/themes";
import { formatBytes } from "../../components/Node";
import { useNodeList } from "@/contexts/NodeListContext";
import fillMissingTimePoints, { type RecordFormat } from "@/utils/RecordHelper";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import Loading from "@/components/loading";
import { Cpu, HardDrive, Server, Network, Activity, Link } from "lucide-react";
import "@/components/DesktopChart.css";

type EnhancedLoadChartProps = {
  data: RecordFormat[];
  intervalSec?: number;
};

const EnhancedLoadChart = ({ data = [] }: EnhancedLoadChartProps) => {
  const { t } = useTranslation();
  const { live_data: all_live_data } = useLiveData();
  const { uuid } = useParams<{ uuid: string }>();
  const { nodeList } = useNodeList();
  const { publicInfo } = usePublicInfo();
  const max_record_preserve_time = publicInfo?.record_preserve_time || 0;
  
  const [hoursView, setHoursView] = useState<string>(t("common.real_time"));
  const [remoteData, setRemoteData] = useState<RecordFormat[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectNulls, setConnectNulls] = useState(true);

  const availableView = useMemo(() => {
    // 计算可用视图
    const presetViews = [
      { label: t("chart.hours", { count: 1 }), hours: 1 },
      { label: t("chart.hours", { count: 6 }), hours: 6 },
      { label: t("chart.days", { count: 1 }), hours: 24 },
      { label: t("chart.days", { count: 7 }), hours: 168 },
    ];

    const views: { label: string; hours?: number }[] = [
      { label: t("common.real_time") },
    ];

    if (typeof max_record_preserve_time === "number" && max_record_preserve_time > 0) {
      for (const v of presetViews) {
        if (max_record_preserve_time >= v.hours) {
          views.push({ label: v.label, hours: v.hours });
        }
      }

      if (
        max_record_preserve_time > 168 &&
        !presetViews.some(v => v.hours === max_record_preserve_time)
      ) {
        views.push({
          label: t("chart.hours", { count: max_record_preserve_time }),
          hours: max_record_preserve_time,
        });
      }
    }

    return views;
  }, [max_record_preserve_time, t]);

  // 获取历史数据
  useEffect(() => {
    const selected = availableView.find((v) => v.label === hoursView);
    if (!uuid) return;
    
    if (hoursView === t("common.real_time") || !selected || !selected.hours) {
      const frame = requestAnimationFrame(() => {
        setRemoteData(null);
        setError(null);
        setLoading(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    
    const frame = requestAnimationFrame(() => {
      setLoading(true);
      setError(null);
    });
    
    const timeoutId = setTimeout(() => {
      fetch(`/api/records/load?uuid=${uuid}&hours=${selected.hours}`)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((resp) => {
          const records = resp.data?.records || [];
          records.sort(
            (a: RecordFormat, b: RecordFormat) =>
              new Date(a.time).getTime() - new Date(b.time).getTime()
          );
          setRemoteData(records);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Error");
          setLoading(false);
        });
    }, 300);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeoutId);
    };
  }, [hoursView, uuid, availableView, t]);

  const node = nodeList?.find((n) => n.uuid === uuid);
  const live_data = all_live_data?.data?.data[uuid ?? ""];

  // 处理图表数据
  const chartData = useMemo(() => {
    if (hoursView === t("common.real_time") || hoursView === "real-time") {
      return data;
    }
    
    if (!remoteData || remoteData.length === 0) {
      return [];
    }
    
    const selectedHours = availableView.find((v) => v.label === hoursView)?.hours || 1;
    const minute = 60;
    const hour = minute * 60;
    
    let interval, maxGap;
    
    // 4小时以内：1分钟间隔，1分钟容差
    // 4小时以上：原有间隔逻辑，容差 = interval * 1
    if (selectedHours <= 4) {
      interval = minute;  // 1分钟间隔
      maxGap = minute;    // 1分钟容差
    } else if (selectedHours <= 6) {
      // 4-6小时,显示间隔15分钟
      interval = minute * 15;
      maxGap = interval;  // 容差 = interval * 1
    } else if (selectedHours <= 24) {
      // 6-24小时，显示间隔30分钟
      interval = minute * 30;
      maxGap = interval;  // 容差 = interval * 1
    } else {
      // 超过24小时,显示间隔60分钟
      interval = hour;
      maxGap = interval;  // 容差 = interval * 1
    }
    
    return fillMissingTimePoints(
      remoteData,
      interval,
      hour * selectedHours,
      maxGap
    );
  }, [hoursView, remoteData, data, availableView, t]);

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="desktop-chart-tooltip">
        <div className="tooltip-time">
          {new Date(label).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        {payload.map((entry: any, index: number) => {
          let displayValue = entry.value;
          let displayName = entry.dataKey;
          
          if (entry.name === "cpu") {
            displayValue = `${entry.value.toFixed(1)}%`;
            displayName = "CPU";
          } else if (entry.name === "ram") {
            displayValue = `${entry.value.toFixed(1)}%`;
            displayName = t("nodeCard.ram");
          } else if (entry.name === "swap") {
            displayValue = `${entry.value.toFixed(1)}%`;
            displayName = t("nodeCard.swap");
          } else if (entry.name === "disk") {
            displayValue = formatBytes(entry.value);
            displayName = t("nodeCard.disk");
          } else if (entry.name === "net_in") {
            displayValue = `${formatBytes(entry.value)}/s`;
            displayName = `↓ ${t("chart.network_down")}`;
          } else if (entry.name === "net_out") {
            displayValue = `${formatBytes(entry.value)}/s`;
            displayName = `↑ ${t("chart.network_up")}`;
          } else if (entry.name === "connections") {
            displayValue = Math.round(entry.value);
            displayName = "TCP";
          } else if (entry.name === "connections_udp") {
            displayValue = Math.round(entry.value);
            displayName = "UDP";
          } else if (entry.name === "process") {
            displayValue = Math.round(entry.value);
            displayName = t("nodeCard.process");
          }
          
          return (
            <div key={index} className="tooltip-item">
              <span 
                className="tooltip-dot" 
                style={{ backgroundColor: entry.color }}
              />
              <span>{displayName}: {displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // 使用主题色变量，保持浅色/深色模式下的对比一致。
  const colors = {
    cpu: "var(--red-9)",
    ram: "var(--amber-9)",
    disk: "var(--jade-9)",
    network: {
      up: "var(--red-9)",
      down: "var(--jade-9)"
    },
    connections: {
      tcp: "var(--red-9)",
      udp: "var(--violet-9)"
    },
    process: "var(--red-9)"
  };

  const chartConfig = {
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    strokeWidth: 2,
  };

  const charts = [
    {
      title: "CPU",
      icon: <Cpu size={16} />,
      value: live_data?.cpu?.usage ? `${live_data.cpu.usage.toFixed(1)}%` : "-",
      data: chartData,
      dataKey: "cpu",
      color: colors.cpu,
      domain: [0, 100],
      formatter: (value: number) => `${value.toFixed(1)}%`,
      type: "area",
    },
    {
      title: t("nodeCard.ram"),
      icon: <Server size={16} />,
      value: (
        <Flex direction="column" align="end" gap="0">
          <Text size="1">
            {live_data?.ram?.used
              ? `${formatBytes(live_data.ram.used)} / ${formatBytes(node?.mem_total || 0)}`
              : "-"}
          </Text>
          {node?.swap_total && node.swap_total > 0 && (
            <Text size="1" color="gray">
              Swap: {formatBytes(live_data?.swap?.used || 0)} / {formatBytes(node?.swap_total || 0)}
            </Text>
          )}
        </Flex>
      ),
      data: chartData.map((item) => ({
        ...item,
        ram: ((item.ram ?? 0) / (node?.mem_total ?? 1)) * 100,
        swap: ((item.swap ?? 0) / (node?.swap_total ?? 1)) * 100,
      })),
      dataKey: ["ram", "swap"],
      color: [colors.ram, colors.ram],
      domain: [0, 100],
      formatter: (value: number) => `${value.toFixed(1)}%`,
      type: "area",
      isMultiLine: true,
    },
    {
      title: t("nodeCard.disk"),
      icon: <HardDrive size={16} />,
      value: live_data?.disk?.used
        ? `${formatBytes(live_data.disk.used)} / ${formatBytes(node?.disk_total || 0)}`
        : "-",
      data: chartData,
      dataKey: "disk",
      color: colors.disk,
      domain: [0, node?.disk_total || 100],
      formatter: (value: number) => formatBytes(value),
      type: "area",
    },
    {
      title: t("nodeCard.networkSpeed"),
      icon: <Network size={16} />,
      value: (
        <Flex direction="column" align="end" gap="0">
          <Text size="1">↑ {formatBytes(live_data?.network.up || 0)}/s</Text>
          <Text size="1">↓ {formatBytes(live_data?.network.down || 0)}/s</Text>
        </Flex>
      ),
      data: chartData,
      dataKey: ["net_in", "net_out"],
      color: [colors.network.up, colors.network.down],
      formatter: (value: number) => `${formatBytes(value)}/s`,
      type: "line",
      isMultiLine: true,
    },
    {
      title: t("nodeCard.connections"),
      icon: <Link size={16} />,
      value: (
        <Flex direction="column" align="end" gap="0">
          <Text size="1">TCP: {live_data?.connections.tcp || 0}</Text>
          <Text size="1">UDP: {live_data?.connections.udp || 0}</Text>
        </Flex>
      ),
      data: chartData,
      dataKey: ["connections", "connections_udp"],
      color: [colors.connections.tcp, colors.connections.udp],
      formatter: (value: number) => Math.round(value),
      type: "line",
      isMultiLine: true,
    },
    {
      title: t("nodeCard.process"),
      icon: <Activity size={16} />,
      value: live_data?.process || "-",
      data: chartData,
      dataKey: "process",
      color: colors.process,
      formatter: (value: number) => Math.round(value),
      type: "line",
    },
  ];

  return (
    <div className="desktop-chart-wrapper">
      {/* 时间周期选择器 */}
      {availableView.length > 1 && (
        <div className="w-full mb-2">
          <div 
            className="w-full overflow-x-auto md:overflow-x-visible pb-2 md:pb-0"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "var(--gray-a6) var(--gray-a3)",
              WebkitOverflowScrolling: "touch",
              maxWidth: "100%",
            }}
          >
            <Flex justify="start" className="w-full min-w-max md:min-w-0">
              <SegmentedControl.Root
                radius="small"
                value={hoursView}
                onValueChange={setHoursView}
                className="node-detail-toggle flex-shrink-0"
                style={{ 
                  height: "38px",
                  minWidth: "fit-content"
                }}
              >
                {availableView.map((view) => (
                  <SegmentedControl.Item
                    key={view.label}
                    value={view.label}
                    className="whitespace-nowrap px-3 py-1"
                    style={{ 
                      fontSize: "13px",
                      minWidth: "70px",
                      height: "100%"
                    }}
                  >
                    {view.label}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Flex>
          </div>
        </div>
      )}
      <div className="flex justify-center mb-2">
        <div className="flex items-center gap-2">
          <Switch
            id="connect-nulls"
            checked={connectNulls}
            onCheckedChange={setConnectNulls}
            size="1"
          />
          <label htmlFor="connect-nulls" className="text-xs font-medium">
            {t("chart.connectNulls")}
          </label>
        </div>
      </div>
      
      {/* Loading 和 Error 状态 */}
      {loading && (
        <div className="desktop-chart-loading">
          <Loading />
        </div>
      )}
      
      {error && (
        <div className="desktop-chart-error">
          {error}
        </div>
      )}
      
      {/* 图表网格 */}
      {!loading && !error && (
        <div className="desktop-chart-grid">
          {charts.map((chart, index) => (
            <Card key={index} className="desktop-chart-card">
              <div className="desktop-chart-header">
                <div className="desktop-chart-title">
                  {chart.icon}
                  {chart.title}
                </div>
                <div className="desktop-chart-value">{chart.value}</div>
              </div>
              <div className="desktop-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.type === "area" ? (
                    <AreaChart data={chart.data} margin={chartConfig.margin}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--gray-a3)" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(value, index) => {
                          if (index === 0 || index === chart.data.length - 1) {
                            return new Date(value).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          }
                          return "";
                        }}
                        interval={0}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={chart.domain}
                        tickFormatter={(value) => {
                          if (chart.dataKey === "disk") return formatBytes(value);
                          if (value === 0) return "";
                          return chart.formatter ? chart.formatter(value) : value;
                        }}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {chart.isMultiLine && Array.isArray(chart.dataKey) ? (
                        chart.dataKey.map((key, i) => (
                          <Area
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={Array.isArray(chart.color) ? chart.color[i] : chart.color}
                            fill={Array.isArray(chart.color) ? chart.color[i] : chart.color}
                            fillOpacity={0.3}
                            strokeWidth={chartConfig.strokeWidth}
                            dot={false}
                            animationDuration={0}
                            connectNulls={connectNulls}
                          />
                        ))
                      ) : (
                        <Area
                          type="monotone"
                          dataKey={chart.dataKey as string}
                          stroke={chart.color as string}
                          fill={chart.color as string}
                          fillOpacity={0.3}
                          strokeWidth={chartConfig.strokeWidth}
                          dot={false}
                          animationDuration={0}
                          connectNulls={connectNulls}
                        />
                      )}
                    </AreaChart>
                  ) : (
                    <LineChart data={chart.data} margin={chartConfig.margin}>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--gray-a3)" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(value, index) => {
                          if (index === 0 || index === chart.data.length - 1) {
                            return new Date(value).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          }
                          return "";
                        }}
                        interval={0}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(value) => {
                          if (value === 0) return "";
                          return chart.formatter ? chart.formatter(value) : value;
                        }}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={45}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      {chart.isMultiLine && Array.isArray(chart.dataKey) ? (
                        chart.dataKey.map((key, i) => (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={Array.isArray(chart.color) ? chart.color[i] : chart.color}
                            strokeWidth={chartConfig.strokeWidth}
                            dot={false}
                            animationDuration={0}
                            connectNulls={connectNulls}
                          />
                        ))
                      ) : (
                        <Line
                          type="monotone"
                          dataKey={chart.dataKey as string}
                          stroke={chart.color as string}
                          strokeWidth={chartConfig.strokeWidth}
                          dot={false}
                          animationDuration={0}
                          connectNulls={connectNulls}
                        />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedLoadChart;
