import React from "react";
import { Card, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { formatBytes } from "./Node";
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { RecordFormat } from "@/utils/RecordHelper";
import "./MobileChart.css";

interface MobileLoadChartProps {
  data: RecordFormat[];
  liveData?: any;
  node?: any;
}

export const MobileLoadChart: React.FC<MobileLoadChartProps> = ({
  data,
  liveData,
  node,
}) => {
  const { t } = useTranslation();

  // 简化的图表配置
  const chartConfig = {
    margin: { top: 5, right: 5, bottom: 5, left: 5 },
    strokeWidth: 2,
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload, label, chartTitle }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="mobile-chart-tooltip">
        <Text size="1" className="block mb-1">
          {new Date(label).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        {payload.map((entry: any, index: number) => {
          let displayName = entry.name;
          let displayValue = entry.value.toFixed(1);
          
          // 处理网络速度的特殊情况
          if (entry.name === "net_in") {
            displayName = `↑ ${t("nodeCard.networkUploadSpeed")}`;
            displayValue = formatBytes(entry.value) + "/s";
          } else if (entry.name === "net_out") {
            displayName = `↓ ${t("nodeCard.networkDownloadSpeed")}`;
            displayValue = formatBytes(entry.value) + "/s";
          } else if (chartTitle === t("nodeCard.disk")) {
            displayValue = formatBytes(entry.value);
          } else if (entry.name === "CPU" || entry.name === "ram") {
            displayValue = entry.value.toFixed(1) + "%";
          }
          
          return (
            <Text key={index} size="1" style={{ color: entry.color }}>
              {chartTitle && !entry.name.includes("net") ? chartTitle : displayName}: {displayValue}
            </Text>
          );
        })}
      </div>
    );
  };

  const charts = [
    {
      title: "CPU",
      value: liveData?.cpu?.usage ? `${liveData.cpu.usage.toFixed(1)}%` : "-",
      data: data,
      dataKey: "cpu",
      color: "#F38181",
      formatter: (value: number) => `${value.toFixed(1)}%`,
      domain: [0, 100],
    },
    {
      title: t("nodeCard.ram"),
      value: liveData?.ram?.used
        ? `${formatBytes(liveData.ram.used)} / ${formatBytes(node?.mem_total || 0)}`
        : "-",
      data: data.map((item) => ({
        ...item,
        ram: ((item.ram ?? 0) / (node?.mem_total ?? 1)) * 100,
      })),
      dataKey: "ram",
      color: "#FCE38A",
      formatter: (value: number) => `${value.toFixed(1)}%`,
      domain: [0, 100],
    },
    {
      title: t("nodeCard.disk"),
      value: liveData?.disk?.used
        ? `${formatBytes(liveData.disk.used)} / ${formatBytes(node?.disk_total || 0)}`
        : "-",
      data: data,
      dataKey: "disk",
      color: "#95E1D3",
      formatter: (value: number) => formatBytes(value),
      domain: [0, node?.disk_total || 100],
    },
    {
      title: t("nodeCard.networkSpeed"),
      value: (
        <Flex direction="column" align="end" gap="0">
          <Text size="1">↑ {formatBytes(liveData?.network.up || 0)}/s</Text>
          <Text size="1">↓ {formatBytes(liveData?.network.down || 0)}/s</Text>
        </Flex>
      ),
      data: data,
      dataKey: ["net_in", "net_out"],
      color: ["#F38181", "#95E1D3"],
      formatter: (value: number) => `${formatBytes(value)}/s`,
      isMultiLine: true,
    },
  ];

  return (
    <div className="mobile-chart-wrapper">
      <div className="mobile-chart-grid">
        {charts.map((chart, index) => (
          <Card key={index} className="mobile-chart-card" style={{ 
            borderRadius: "12px",
            backgroundColor: "var(--color-panel-solid)"
          }}>
            <div className="mobile-chart-header">
              <Text size="2" weight="medium" className="mobile-chart-title">{chart.title}</Text>
              <div className="mobile-chart-value">{chart.value}</div>
            </div>
            <div className="mobile-chart">
              <ResponsiveContainer width="100%" height="100%">
                {chart.isMultiLine ? (
                  <LineChart data={chart.data} margin={chartConfig.margin}>
                    <XAxis
                      dataKey="time"
                      hide
                    />
                    <YAxis hide />
                    <Tooltip
                      content={(props) => <CustomTooltip {...props} chartTitle={chart.title} />}
                      wrapperStyle={{ outline: "none" }}
                    />
                    {Array.isArray(chart.dataKey) &&
                      chart.dataKey.map((key, i) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={Array.isArray(chart.color) ? chart.color[i] : chart.color}
                          strokeWidth={chartConfig.strokeWidth}
                          dot={false}
                          animationDuration={0}
                        />
                      ))}
                  </LineChart>
                ) : (
                  <AreaChart data={chart.data} margin={chartConfig.margin}>
                    <XAxis
                      dataKey="time"
                      hide
                    />
                    <YAxis
                      hide
                      domain={chart.domain}
                    />
                    <Tooltip
                      content={(props) => <CustomTooltip {...props} chartTitle={chart.title} />}
                      wrapperStyle={{ outline: "none" }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chart.dataKey as string}
                      stroke={chart.color as string}
                      fill={chart.color as string}
                      fillOpacity={0.3}
                      strokeWidth={chartConfig.strokeWidth}
                      dot={false}
                      animationDuration={0}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};