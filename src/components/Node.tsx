import {
  Card,
  Flex,
  Text,
  Badge,
  Separator,
  Tooltip,
} from "@radix-ui/themes";
import type { LiveData, Record } from "../types/LiveData";
import UsageBar from "./UsageBar";
import Flag from "./Flag";
import { useTranslation } from "react-i18next";
import Tips from "./ui/tips";

/** 将字节转换为人类可读的大小 */

/** 格式化秒*/
export function formatUptime(seconds: number, t: TFunction): string {
  if (!seconds || seconds < 0) return t("nodeCard.time_second", { val: 0 });
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d} ${t("nodeCard.time_day")}`);
  if (h) parts.push(`${h} ${t("nodeCard.time_hour")}`);
  if (m) parts.push(`${m} ${t("nodeCard.time_minute")}`);
  if (s || parts.length === 0) parts.push(`${s} ${t("nodeCard.time_second")}`);
  return parts.join(" ");
}
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
}
const Node = ({ basic, live, online }: NodeProps) => {
  const [t] = useTranslation();
  const isMobile = useIsMobile();
  const defaultLive = {
    cpu: { usage: 0 },
    ram: { used: 0 },
    disk: { used: 0 },
    network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
  } as Record;

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

  const liveData = live || defaultLive;

  const memoryUsagePercent = basic.mem_total
    ? (liveData.ram.used / basic.mem_total) * 100
    : 0;
  const diskUsagePercent = basic.disk_total
    ? (liveData.disk.used / basic.disk_total) * 100
    : 0;

  const uploadSpeed = formatBytes(liveData.network.up);
  const downloadSpeed = formatBytes(liveData.network.down);
  const totalUpload = formatBytes(liveData.network.totalUp);
  const totalDownload = formatBytes(liveData.network.totalDown);
  //const totalTraffic = formatBytes(liveData.network.totalUp + liveData.network.totalDown);
  return (
    <Card
      style={{
        width: "100%",
        margin: "0 auto",
        transition: "all 0.2s ease-in-out",
      }}
      className={`node-card hover:cursor-pointer hover:shadow-lg hover:bg-accent-2 ${!online ? 'node-card-offline' : ''}`}
    >
      <Flex direction="column" gap="2">
        <Flex justify="between" align="center" my={isMobile ? "-1" : "0"}>
          <Flex justify="start" align="center">
            <Flag flag={basic.region} />
            {(() => {
              const linkContent = (titleSize: "2" | "4") => (
                <Link to={`/instance/${basic.uuid}`}>
                  <Flex direction="column">
                    <Text
                      weight="bold"
                      size={titleSize}
                      truncate
                      style={{ maxWidth: "200px" }}
                    >
                      {basic.name}
                    </Text>
                    {isMobile && (
                      <Text
                        color="gray"
                        style={{
                          marginTop: "-3px",
                          fontSize: "0.728rem",
                        }}
                        className="text-sm"
                      >
                        {formatUptime(liveData.uptime, t)}
                      </Text>
                    )}
                    {!isMobile && (
                      <PriceTags
                        price={basic.price}
                        billing_cycle={basic.billing_cycle}
                        expired_at={basic.expired_at}
                        currency={basic.currency}
                        tags={basic.tags}
                      />
                    )}
                  </Flex>
                </Link>
              );

              if (isMobile) {
                return linkContent("2");
              }

              return (
                <Tooltip content={basic.name}>
                  {linkContent("4")}
                </Tooltip>
              );
            })()}
          </Flex>
          <Flex gap="2" align="center">
            {live?.message && <Tips color="#CE282E">{live.message}</Tips>}
            <Badge color={online ? "green" : "red"} variant="soft">
              {online ? t("nodeCard.online") : t("nodeCard.offline")}
            </Badge>
          </Flex>
        </Flex>

        <Separator size="4" className="-mt-1" />

        <Flex direction="column" gap="2">
          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              OS
            </Text>
            <Flex align="center">
              <img
                src={getOSImage(basic.os)}
                alt={basic.os}
                className="w-5 h-5 mr-2"
              />
              <Text size="2">{getOSName(basic.os)} / {basic.arch}</Text>
            </Flex>
          </Flex>
          <Flex className="md:flex-col flex-row md:gap-1 gap-4">
            {/* CPU Usage */}
            <UsageBar label={t("nodeCard.cpu")} value={liveData.cpu.usage} />

            {/* Memory Usage */}
            <UsageBar label={t("nodeCard.ram")} value={memoryUsagePercent} />
            <Text
              className="md:block hidden"
              size="1"
              color="gray"
              style={{ marginTop: "-4px" }}
            >
              ({formatBytes(liveData.ram.used)} / {formatBytes(basic.mem_total)}
              )
            </Text>

            {/* Disk Usage */}
            <UsageBar label={t("nodeCard.disk")} value={diskUsagePercent} />
            <Text
              size="1"
              className="md:block hidden"
              color="gray"
              style={{ marginTop: "-4px" }}
            >
              ({formatBytes(liveData.disk.used)} /{" "}
              {formatBytes(basic.disk_total)})
            </Text>
          </Flex>

          {/* 流量显示 - 有限制时显示进度条，无限制时显示文本 */}
          {Number(basic.traffic_limit) > 0 && basic.traffic_limit_type ? (
            <>
              <UsageBar 
                label={t("nodeCard.totalTraffic")} 
                value={getTrafficPercentage(
                  liveData.network.totalUp,
                  liveData.network.totalDown,
                  basic.traffic_limit,
                  basic.traffic_limit_type
                )} 
              />
              {isMobile ? (
                <>
                  <Flex justify="between" gap="2">
                    <Text size="1" color="gray" style={{ marginTop: "-4px" }}>
                      {getTrafficTypeDisplay(basic.traffic_limit_type)}
                    </Text>
                    <Text size="1" color="gray" style={{ marginTop: "-4px", textAlign: "right" }}>
                      {formatBytes(getTrafficUsage(
                        liveData.network.totalUp,
                        liveData.network.totalDown,
                        basic.traffic_limit_type
                      ))} / {formatBytes(basic.traffic_limit || 0)}
                    </Text>
                  </Flex>
                  <Flex justify="end">
                    <Text size="1" color="gray" style={{ marginTop: "-4px", textAlign: "right" }}>
                      ↑ {totalUpload} ↓ {totalDownload}
                    </Text>
                  </Flex>
                </>
              ) : (
                <Text
                  size="1"
                  color="gray"
                  style={{ marginTop: "-4px" }}
                >
                  ({formatBytes(getTrafficUsage(
                    liveData.network.totalUp,
                    liveData.network.totalDown,
                    basic.traffic_limit_type
                  ))} / {formatBytes(basic.traffic_limit || 0)}) • ↑ {totalUpload} ↓ {totalDownload}
                </Text>
              )}
            </>
          ) : (
            <Flex justify="between" hidden={isMobile}>
              <Text size="2" color="gray">
                {t("nodeCard.totalTraffic")}
              </Text>
              <Text size="2">
                ↑ {totalUpload} ↓ {totalDownload}
              </Text>
            </Flex>
          )}

          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              {t("nodeCard.networkSpeed")}
            </Text>
            <Text size="2">
              ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
            </Text>
          </Flex>
          <Flex justify="between" gap="2" hidden={!isMobile}>
            <Text size="2">{t("nodeCard.networkSpeed")}</Text>
            <Text size="2">
              ↑ {uploadSpeed}/s ↓ {downloadSpeed}/s
            </Text>
          </Flex>
          {/* 移动端无限制流量时的文本显示 */}
          {isMobile && !(Number(basic.traffic_limit) > 0 && basic.traffic_limit_type) && (
            <Flex justify="between" gap="2">
              <Text size="2">{t("nodeCard.totalTraffic")}</Text>
              <Text size="2" style={{ textAlign: "right" }}>
                ↑ {totalUpload} ↓ {totalDownload}
              </Text>
            </Flex>
          )}
          <Flex justify="between" hidden={isMobile}>
            <Text size="2" color="gray">
              {t("nodeCard.uptime")}
            </Text>
            {online ? (
              <Text size="2">{formatUptime(liveData.uptime, t)}</Text>
            ) : (
              <Text size="2" color="gray">
                -
              </Text>
            )}
          </Flex>
        </Flex>
        <PriceTags
          hidden={!isMobile}
          price={basic.price}
          billing_cycle={basic.billing_cycle}
          expired_at={basic.expired_at}
          currency={basic.currency}
          tags={basic.tags || ""}
        />
      </Flex>
    </Card>
  );
};

export default Node;

type NodeGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
};

import { Box } from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import PriceTags from "./PriceTags";
import { getOSImage, getOSName } from "@/utils";
import { getTrafficPercentage, getTrafficUsage } from "@/utils/formatHelper";

export const NodeGrid = ({ nodes, liveData }: NodeGridProps) => {
  // 确保liveData是有效的
  const onlineNodes = liveData && liveData.online ? liveData.online : [];

  // 节点已在父组件排序，直接使用
  return (
    <Box
      className="gap-2 md:gap-4"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        padding: "1rem",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {nodes.map((node) => {
        const isOnline = onlineNodes.includes(node.uuid);
        const nodeData =
          liveData && liveData.data ? liveData.data[node.uuid] : undefined;

        return (
          <Node
            key={node.uuid}
            basic={node}
            live={nodeData}
            online={isOnline}
          />
        );
      })}
    </Box>
  );
};
