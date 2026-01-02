import { Tooltip } from "@radix-ui/themes";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatBytes, formatUptime } from "./Node";
import { getTrafficStats } from "@/utils";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { Record } from "@/types/LiveData";
import { MetricBar } from "./MetricBar";
import { TrafficLimitChart } from "./TrafficLimitChart";
import { usePingSummary } from "@/hooks/use-ping-summary";

interface DesktopDetailsCardProps {
  node: NodeBasicInfo;
  liveData?: Record;
}

export const DesktopDetailsCard: React.FC<DesktopDetailsCardProps> = ({
  node,
  liveData,
}) => {
  const { t } = useTranslation();
  const runtimeStackRef = useRef<HTMLDivElement | null>(null);
  const [runtimeStackHeight, setRuntimeStackHeight] = useState<number | null>(null);
  const cpuUsage = liveData?.cpu.usage ?? 0;
  const memoryUsagePercent = node.mem_total && liveData ? (liveData.ram.used / node.mem_total) * 100 : 0;
  const diskUsagePercent = node.disk_total && liveData ? (liveData.disk.used / node.disk_total) * 100 : 0;
  const swapUsagePercent = node.swap_total && liveData ? (liveData.swap.used / node.swap_total) * 100 : 0;

  // 计算流量限制相关
  const trafficStats = liveData
    ? getTrafficStats(
        liveData.network.totalUp,
        liveData.network.totalDown,
        node.traffic_limit,
        node.traffic_limit_type
      )
    : { percentage: 0, usage: 0 };
  const hasTrafficLimit = Number(node.traffic_limit) > 0 && node.traffic_limit_type;
  const pingSummary = usePingSummary(node.uuid);

  // 获取流量限制类型的显示文本
  const getTrafficTypeDisplay = (type?: string) => {
    switch(type) {
      case 'max': return 'MAX';
      case 'min': return 'MIN';
      case 'sum': return 'SUM';
      case 'up': return 'UP';
      case 'down': return 'DOWN';
      default: return '';
    }
  };

  const cpuDisplay = liveData ? `${cpuUsage.toFixed(1)}%` : "-";
  const memoryDisplay = liveData
    ? `${formatBytes(liveData.ram.used || 0)} / ${formatBytes(node.mem_total)}`
    : formatBytes(node.mem_total);
  const diskDisplay = liveData
    ? `${formatBytes(liveData.disk.used || 0)} / ${formatBytes(node.disk_total)}`
    : formatBytes(node.disk_total);
  const swapDisplay = liveData
    ? `${formatBytes(liveData.swap.used || 0)} / ${formatBytes(node.swap_total)}`
    : formatBytes(node.swap_total);
  const networkSpeedLines = liveData
    ? [`↑ ${formatBytes(liveData.network.up || 0)}/s`, `↓ ${formatBytes(liveData.network.down || 0)}/s`]
    : "-";
  const totalTrafficLines = liveData
    ? [`↑ ${formatBytes(liveData.network.totalUp || 0)}`, `↓ ${formatBytes(liveData.network.totalDown || 0)}`]
    : "-";

  const formatLatency = (value: number | null) =>
    value == null ? "-" : `${Math.round(value)} ms`;
  const formatLoss = (value: number | null) =>
    value == null ? "-" : `${value.toFixed(1)}%`;
  const formatLoad = (value?: number) =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
  const loadLines = [
    `1m: ${formatLoad(liveData?.load?.load1)}`,
    `5m: ${formatLoad(liveData?.load?.load5)}`,
    `15m: ${formatLoad(liveData?.load?.load15)}`,
  ];
  const latencyRows = pingSummary.items.map((item) => ({
    name: item.name,
    current: formatLatency(item.current),
    avg: formatLatency(item.avg),
    loss: formatLoss(item.loss),
  }));

  useLayoutEffect(() => {
    const runtimeStack = runtimeStackRef.current;
    if (!runtimeStack) return;
    let frameId: number | null = null;

    const updateHeight = () => {
      const nextHeight = runtimeStack.getBoundingClientRect().height;
      setRuntimeStackHeight((prev) =>
        prev && Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight
      );
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateHeight);
    });
    observer.observe(runtimeStack);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="node-detail-body">
      <div className="node-detail-section-grid">
        <div className="node-detail-card node-detail-animate" style={{ ["--delay" as any]: "120ms" }}>
          <div className="node-detail-section-title">{t("nodeCard.resource_usage")}</div>
          <div className="node-detail-metric">
            <div className="node-detail-metric-head">
              <span className="node-detail-metric-label">{t("nodeCard.cpu")}</span>
              <span className="node-detail-metric-value">{cpuDisplay}</span>
            </div>
            <MetricBar value={cpuUsage} />
          </div>
          <div className="node-detail-metric">
            <div className="node-detail-metric-head">
              <span className="node-detail-metric-label">{t("nodeCard.ram")}</span>
              <span className="node-detail-metric-value">{memoryDisplay}</span>
            </div>
            <MetricBar value={memoryUsagePercent} />
          </div>
          <div className="node-detail-metric">
            <div className="node-detail-metric-head">
              <span className="node-detail-metric-label">{t("nodeCard.disk")}</span>
              <span className="node-detail-metric-value">{diskDisplay}</span>
            </div>
            <MetricBar value={diskUsagePercent} />
          </div>
          {node.swap_total > 0 && (
            <div className="node-detail-metric">
              <div className="node-detail-metric-head">
                <span className="node-detail-metric-label">{t("nodeCard.swap")}</span>
                <span className="node-detail-metric-value">{swapDisplay}</span>
              </div>
              <MetricBar value={swapUsagePercent} />
            </div>
          )}
          {hasTrafficLimit && (
            <TrafficLimitChart
              label={t("nodeCard.trafficLimit")}
              type={getTrafficTypeDisplay(node.traffic_limit_type)}
              percentage={trafficStats.percentage}
              usedLabel={formatBytes(trafficStats.usage)}
              limitLabel={formatBytes(node.traffic_limit || 0)}
            />
          )}
        </div>

        <div className="node-detail-card node-detail-animate" style={{ ["--delay" as any]: "160ms" }}>
          <div className="node-detail-section-title">{t("nodeCard.system_info")}</div>
          <DetailRow label={t("nodeCard.os")} value={node.os} />
          <DetailRow label={t("nodeCard.kernelVersion")} value={node.kernel_version || "Unknown"} />
          <DetailRow label={t("nodeCard.arch")} value={node.arch} />
          <DetailRow label={t("nodeCard.virtualization")} value={node.virtualization || "Unknown"} />
        </div>

        <div className="node-detail-card node-detail-animate" style={{ ["--delay" as any]: "200ms" }}>
          <div className="node-detail-section-title">{t("nodeCard.hardware_info")}</div>
          <DetailRow label={t("nodeCard.cpu")} value={`${node.cpu_name} (x${node.cpu_cores})`} />
          <DetailRow label={t("admin.nodeDetail.gpu")} value={node.gpu_name || "Unknown"} />
          <DetailRow label={t("nodeCard.ram")} value={formatBytes(node.mem_total)} />
          <DetailRow label={t("nodeCard.disk")} value={formatBytes(node.disk_total)} />
        </div>

        <div className="node-detail-card node-detail-animate" style={{ ["--delay" as any]: "240ms" }}>
          <div className="node-detail-section-title">{t("nodeCard.network_info")}</div>
          <DetailRow
            label={t("nodeCard.networkSpeed")}
            value={networkSpeedLines}
          />
          <DetailRow
            label={t("nodeCard.totalTraffic")}
            value={totalTrafficLines}
          />
          <DetailRow
            label={t("nodeCard.connections")}
            value={liveData ? `TCP: ${liveData.connections.tcp}, UDP: ${liveData.connections.udp}` : "-"}
          />
        </div>

        <div className="node-detail-runtime-row node-detail-animate" style={{ ["--delay" as any]: "280ms" }}>
          <div className="node-detail-card">
          <div className="node-detail-section-title">{t("nodeCard.runtime_info")}</div>
          <div className="node-detail-runtime-stack" ref={runtimeStackRef}>
            <DetailRow label={t("nodeCard.uptime")} value={liveData?.uptime ? formatUptime(liveData.uptime, t) : "-"} />
            <DetailRow label={t("nodeCard.process")} value={liveData?.process?.toString() || "-"} />
            <DetailRow label={t("nodeCard.load")} value={loadLines} />
            <DetailRow
              label={t("nodeCard.last_updated")}
              value={liveData?.updated_at ? new Date(liveData.updated_at).toLocaleString() : "-"}
            />
          </div>
        </div>
        <div className="node-detail-card node-detail-latency-inline">
          <div className="node-detail-section-title">{t("nodeCard.ping")}</div>
          <div
            className="node-detail-latency-table"
            style={runtimeStackHeight ? { height: runtimeStackHeight } : undefined}
          >
            <div className="node-detail-latency-row node-detail-latency-header">
              <span className="node-detail-latency-cell name">{t("Task Name")}</span>
              <span className="node-detail-latency-cell">{t("Current")}</span>
              <span className="node-detail-latency-cell">{t("Avg")}</span>
                <span className="node-detail-latency-cell">{t("Loss")}</span>
              </div>
              <div className="node-detail-latency-body">
                {latencyRows.length ? (
                  latencyRows.map((row) => (
                    <div key={row.name} className="node-detail-latency-row">
                      <span className="node-detail-latency-cell name">{row.name}</span>
                      <span className="node-detail-latency-cell">{row.current}</span>
                      <span className="node-detail-latency-cell">{row.avg}</span>
                      <span className="node-detail-latency-cell">{row.loss}</span>
                    </div>
                  ))
                ) : (
                  <div className="node-detail-latency-row">
                    <span className="node-detail-latency-cell name">-</span>
                    <span className="node-detail-latency-cell">-</span>
                    <span className="node-detail-latency-cell">-</span>
                    <span className="node-detail-latency-cell">-</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string | string[] }) => {
  const valueLines = Array.isArray(value) ? value : [value];
  const tooltipValue = Array.isArray(value) ? value.join(" ") : value;
  const isStacked = valueLines.length > 1;

  return (
    <div className="node-detail-row">
      <div className="node-detail-row-label">{label}</div>
      <Tooltip content={tooltipValue}>
        <div className={`node-detail-row-value${isStacked ? " stack" : ""}`}>
          {isStacked ? (
            <div className="node-detail-value-stack">
              {valueLines.map((line) => (
                <span key={line} className="node-detail-value-line">
                  {line}
                </span>
              ))}
            </div>
          ) : (
            valueLines[0]
          )}
        </div>
      </Tooltip>
    </div>
  );
};
