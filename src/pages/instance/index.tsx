import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveData } from "../../contexts/LiveDataContext";
import { useTranslation } from "react-i18next";
import type { Record } from "../../types/LiveData";
import Flag from "../../components/Flag";
import { SegmentedControl } from "@radix-ui/themes";
import { useNodeList } from "@/contexts/NodeListContext";
import { liveDataToRecords } from "@/utils/RecordHelper";
import EnhancedLoadChart from "./EnhancedLoadChart";
import PingChartV2 from "./PingChartV2";
import { MobileDetailsCard } from "@/components/MobileDetailsCard";
import { MobileLoadChart } from "@/components/MobileLoadChart";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopDetailsCard } from "@/components/DesktopDetailsCard";
import { getOSImage } from "@/utils";
import { formatUptime } from "@/components/Node";
import "./instance-detail.css";

export default function InstancePage() {
  const { t } = useTranslation();
  const { onRefresh, live_data } = useLiveData();
  const { uuid } = useParams<{ uuid: string }>();
  const [recent, setRecent] = useState<Record[]>([]);
  const { nodeList } = useNodeList();
  const length = 60 * 5;
  const [chartView, setChartView] = useState<"load" | "ping">("load");
  const isMobile = useIsMobile();
  // #region 初始数据加载
  const node = nodeList?.find((n) => n.uuid === uuid);
  const isOnline = live_data?.data?.online?.includes(uuid || "") || false;
  const liveNodeData = uuid ? live_data?.data?.data?.[uuid] : undefined;
  const nodeName = node?.name ?? uuid ?? "";
  const nodeUuid = node?.uuid ?? uuid ?? "";
  const osIcon = getOSImage(node?.os ?? "");
  const uptimeLabel = liveNodeData?.uptime ? formatUptime(liveNodeData.uptime, t) : "-";
  const updatedLabel = liveNodeData?.updated_at ? new Date(liveNodeData.updated_at).toLocaleString() : "-";
  const versionLabel = node?.version || "-";
  const statusText = isOnline ? t("nodeCard.online") : t("nodeCard.offline");

  useEffect(() => {
    fetch(`/api/recent/${uuid}`)
      .then((res) => res.json())
      .then((data) => setRecent(data.data.slice(-length)))
      .catch((err) => console.error("Failed to fetch recent data:", err));
  }, [uuid]);
  // 动态追加数据
  useEffect(() => {
    const unsubscribe = onRefresh((resp) => {
      if (!uuid) return;
      const data = resp.data.data[uuid];
      if (!data) return;

      setRecent((prev) => {
        const newRecord: Record = data;
        // 追加新数据，限制总长度为length（FIFO）
        // 检查是否已存在相同时间戳的记录
        const exists = prev.some(
          (item) => item.updated_at === newRecord.updated_at
        );
        if (exists) {
          return prev; // 如果已存在，不添加新记录
        }

        // 否则，追加新记录
        const updated = [...prev, newRecord].slice(-length);
        return updated;
      });
    });

    // 清理订阅
    return unsubscribe;
  }, [onRefresh, uuid]);
  // #region 布局
  if (isMobile && node) {
    return (
      <div className="node-detail-shell">
        <div className="node-detail-container">
          <div className="node-detail-hero node-detail-animate" style={{ ["--delay" as any]: "0ms" }}>
            <div className="node-detail-hero-top">
              <div className="node-detail-title">
                <Flag flag={node?.region ?? ""} />
                <img className="node-detail-os-icon" src={osIcon} alt={node?.os ?? "OS"} />
                <div className="node-detail-title-text">
                  <div className="node-detail-name-row">
                    <span className="node-detail-name">{nodeName}</span>
                    <span className="node-detail-mono node-detail-uuid-pill">{nodeUuid}</span>
                  </div>
                </div>
              </div>
              <div className={`node-detail-status ${isOnline ? "online" : "offline"}`}>
                {statusText}
              </div>
            </div>
            <div className="node-detail-hero-info">
              <div className="node-detail-hero-item">
                <span className="node-detail-hero-label">{t("nodeCard.version")}</span>
                <span className="node-detail-hero-value">{versionLabel}</span>
              </div>
              <div className="node-detail-hero-item">
                <span className="node-detail-hero-label">{t("nodeCard.uptime")}</span>
                <span className="node-detail-hero-value">{uptimeLabel}</span>
              </div>
              <div className="node-detail-hero-item">
                <span className="node-detail-hero-label">{t("nodeCard.last_updated")}</span>
                <span className="node-detail-hero-value">{updatedLabel}</span>
              </div>
            </div>
          </div>

          <MobileDetailsCard node={node} liveData={liveNodeData} />

          <div className="node-detail-chart-card node-detail-animate" style={{ ["--delay" as any]: "200ms" }}>
            <div className="node-detail-chart-header">
              <div className="node-detail-section-title">{t("nodeCard.chart")}</div>
              <SegmentedControl.Root
                radius="full"
                value={chartView}
                onValueChange={(value) => setChartView(value as "load" | "ping")}
                className="node-detail-toggle"
              >
                <SegmentedControl.Item value="load">
                  {t("nodeCard.load")}
                </SegmentedControl.Item>
                <SegmentedControl.Item value="ping">
                  {t("nodeCard.ping")}
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </div>
            <div className="node-detail-chart-body">
              {chartView === "load" ? (
                <MobileLoadChart
                  data={liveDataToRecords(uuid ?? "", recent)}
                  liveData={liveNodeData}
                  node={node}
                  uuid={uuid}
                />
              ) : (
                <PingChartV2 uuid={uuid ?? ""} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="node-detail-shell">
      <div className="node-detail-container">
        <div className="node-detail-hero node-detail-animate" style={{ ["--delay" as any]: "0ms" }}>
          <div className="node-detail-hero-top">
            <div className="node-detail-title">
              <Flag flag={node?.region ?? ""} />
              <img className="node-detail-os-icon" src={osIcon} alt={node?.os ?? "OS"} />
              <div className="node-detail-title-text">
                <div className="node-detail-name-row">
                  <span className="node-detail-name">{nodeName}</span>
                  <span className="node-detail-mono node-detail-uuid-pill">{nodeUuid}</span>
                </div>
              </div>
            </div>
            <div className={`node-detail-status ${isOnline ? "online" : "offline"}`}>
              {statusText}
            </div>
          </div>
          <div className="node-detail-hero-info">
            <div className="node-detail-hero-item">
              <span className="node-detail-hero-label">{t("nodeCard.version")}</span>
              <span className="node-detail-hero-value">{versionLabel}</span>
            </div>
            <div className="node-detail-hero-item">
              <span className="node-detail-hero-label">{t("nodeCard.uptime")}</span>
              <span className="node-detail-hero-value">{uptimeLabel}</span>
            </div>
            <div className="node-detail-hero-item">
              <span className="node-detail-hero-label">{t("nodeCard.last_updated")}</span>
              <span className="node-detail-hero-value">{updatedLabel}</span>
            </div>
          </div>
        </div>

        {node && <DesktopDetailsCard node={node} liveData={liveNodeData} />}

        <div className="node-detail-chart-card node-detail-animate" style={{ ["--delay" as any]: "320ms" }}>
          <div className="node-detail-chart-header">
            <div className="node-detail-section-title">{t("nodeCard.chart")}</div>
            <SegmentedControl.Root
              radius="full"
              value={chartView}
              onValueChange={(value) => setChartView(value as "load" | "ping")}
              size="2"
              className="node-detail-toggle"
            >
              <SegmentedControl.Item value="load">
                {t("nodeCard.load")}
              </SegmentedControl.Item>
              <SegmentedControl.Item value="ping">
                {t("nodeCard.ping")}
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </div>
          <div className="node-detail-chart-body">
            {chartView === "load" ? (
              <EnhancedLoadChart data={liveDataToRecords(uuid ?? "", recent)} />
            ) : (
              <PingChartV2 uuid={uuid ?? ""} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
