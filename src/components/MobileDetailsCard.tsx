import { Card, Flex, Text, Badge, SegmentedControl, Dialog, Button } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { formatBytes, formatUptime } from "./Node";
import { getTrafficStats } from "@/utils";
import { Activity, Cpu, HardDrive, Network, Server, Clock, Monitor, Microchip, Zap, Info } from "lucide-react";
import UsageBar from "./UsageBar";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { Record } from "@/types/LiveData";
import { useState } from "react";

interface MobileDetailsCardProps {
  node: NodeBasicInfo;
  liveData?: Record;
  isOnline: boolean;
}

export const MobileDetailsCard: React.FC<MobileDetailsCardProps> = ({
  node,
  liveData,
  isOnline,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"system" | "hardware" | "runtime">("system");

  const memoryUsagePercent = node.mem_total && liveData
    ? (liveData.ram.used / node.mem_total) * 100
    : 0;
  const diskUsagePercent = node.disk_total && liveData
    ? (liveData.disk.used / node.disk_total) * 100
    : 0;
  const swapUsagePercent = node.swap_total && liveData
    ? (liveData.swap.used / node.swap_total) * 100
    : 0;

  // 计算流量限制相关
  const trafficStats = liveData ? getTrafficStats(
    liveData.network.totalUp,
    liveData.network.totalDown,
    node.traffic_limit,
    node.traffic_limit_type
  ) : { percentage: 0, usage: 0 };

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

  return (
    <div className="w-full px-3">
      {/* 状态卡片 */}
      <Card className="mb-3" style={{ 
        borderRadius: "12px",
        backgroundColor: "var(--color-panel-solid)"
      }}>
        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            <Activity size={16} className="text-accent-9" />
            <Text size="2" weight="medium">{t("nodeCard.status")}</Text>
          </Flex>
          <Badge color={isOnline ? "green" : "red"} variant="soft">
            {isOnline ? t("nodeCard.online") : t("nodeCard.offline")}
          </Badge>
        </Flex>
      </Card>

      {/* 资源使用情况 */}
      <Card className="mb-3" style={{ 
        borderRadius: "12px",
        backgroundColor: "var(--color-panel-solid)"
      }}>
        <Flex direction="column" gap="3">
          <Text size="2" weight="bold" className="mb-1">
            {t("nodeCard.resource_usage")}
          </Text>
          
          {/* CPU */}
          <div>
            <Flex justify="between" align="center" className="mb-1">
              <Flex align="center" gap="2">
                <Cpu size={14} className="text-accent-9" />
                <Text size="1">{t("nodeCard.cpu")}</Text>
              </Flex>
              <Text size="1" color="gray">
                {liveData?.cpu.usage.toFixed(1) || 0}%
              </Text>
            </Flex>
            <UsageBar label="" value={liveData?.cpu.usage || 0} compact />
          </div>

          {/* 内存 */}
          <div>
            <Flex justify="between" align="center" className="mb-1">
              <Flex align="center" gap="2">
                <Server size={14} className="text-accent-9" />
                <Text size="1">{t("nodeCard.ram")}</Text>
              </Flex>
              <Text size="1" color="gray">
                {formatBytes(liveData?.ram.used || 0)} / {formatBytes(node.mem_total)}
              </Text>
            </Flex>
            <UsageBar label="" value={memoryUsagePercent} compact />
          </div>

          {/* 硬盘 */}
          <div>
            <Flex justify="between" align="center" className="mb-1">
              <Flex align="center" gap="2">
                <HardDrive size={14} className="text-accent-9" />
                <Text size="1">{t("nodeCard.disk")}</Text>
              </Flex>
              <Text size="1" color="gray">
                {formatBytes(liveData?.disk.used || 0)} / {formatBytes(node.disk_total)}
              </Text>
            </Flex>
            <UsageBar label="" value={diskUsagePercent} compact />
          </div>

          {/* Swap (如果有) */}
          {node.swap_total > 0 && (
            <div>
              <Flex justify="between" align="center" className="mb-1">
                <Flex align="center" gap="2">
                  <Server size={14} className="text-accent-9" />
                  <Text size="1">{t("nodeCard.swap")}</Text>
                </Flex>
                <Text size="1" color="gray">
                  {formatBytes(liveData?.swap.used || 0)} / {formatBytes(node.swap_total)}
                </Text>
              </Flex>
              <UsageBar label="" value={swapUsagePercent} compact />
            </div>
          )}
        </Flex>
      </Card>

      {/* 网络信息 */}
      <Card className="mb-3" style={{ 
        borderRadius: "12px",
        backgroundColor: "var(--color-panel-solid)"
      }}>
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Network size={16} className="text-accent-9" />
            <Text size="2" weight="bold">{t("nodeCard.network")}</Text>
          </Flex>
          
          <Flex justify="between">
            <Text size="1" color="gray">{t("nodeCard.networkSpeed")}</Text>
            <Text size="1">
              ↑ {formatBytes(liveData?.network.up || 0)}/s ↓ {formatBytes(liveData?.network.down || 0)}/s
            </Text>
          </Flex>
          
          <Flex justify="between">
            <Text size="1" color="gray">{t("nodeCard.totalTraffic")}</Text>
            <Text size="1">
              ↑ {formatBytes(liveData?.network.totalUp || 0)} ↓ {formatBytes(liveData?.network.totalDown || 0)}
            </Text>
          </Flex>
          
          {Number(node.traffic_limit) > 0 && node.traffic_limit_type && (
            <>
              <div style={{ height: "1px", backgroundColor: "var(--gray-a4)", margin: "4px 0" }} />
              <Flex justify="between" align="start">
                <Text size="1" color="gray">{t("nodeCard.trafficLimit")}</Text>
                <Flex direction="column" align="end" gap="1">
                  <Text size="1" weight="medium">
                    {getTrafficTypeDisplay(node.traffic_limit_type)}
                  </Text>
                  <Text size="1">
                    {formatBytes(trafficStats.usage)} / {formatBytes(node.traffic_limit || 0)}
                  </Text>
                  <Text size="1" color="gray">
                    ({trafficStats.percentage.toFixed(1)}%)
                  </Text>
                </Flex>
              </Flex>
            </>
          )}
        </Flex>
      </Card>

      {/* 系统信息标签页 */}
      <div className="mb-3">
        <SegmentedControl.Root
          radius="full"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "system" | "hardware" | "runtime")}
          className="w-full"
        >
          <SegmentedControl.Item value="system" className="flex-1">
            <Flex align="center" gap="1">
              <Monitor size={14} />
              {t("nodeCard.system")}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="hardware" className="flex-1">
            <Flex align="center" gap="1">
              <Microchip size={14} />
              {t("nodeCard.hardware")}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="runtime" className="flex-1">
            <Flex align="center" gap="1">
              <Zap size={14} />
              {t("nodeCard.runtime")}
            </Flex>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </div>

      <Card style={{ 
        borderRadius: "12px",
        backgroundColor: "var(--color-panel-solid)"
      }}>
        <div style={{ padding: "16px 0" }}>
          {activeTab === "system" && (
            <Flex direction="column" gap="3">
              <InfoRowWithIcon icon={<Monitor size={12} />} label={t("nodeCard.os")} value={node.os} />
              <InfoRowWithIcon icon={<Monitor size={12} />} label={t("nodeCard.kernelVersion")} value={node.kernel_version || "Unknown"} />
              <InfoRowWithIcon icon={<Cpu size={12} />} label={t("nodeCard.arch")} value={node.arch} />
              <InfoRowWithIcon icon={<Server size={12} />} label={t("nodeCard.virtualization")} value={node.virtualization || "Unknown"} />
            </Flex>
          )}
          
          {activeTab === "hardware" && (
            <Flex direction="column" gap="3">
              <InfoRowWithIcon icon={<Cpu size={12} />} label="CPU" value={`${node.cpu_name} (x${node.cpu_cores})`} />
              <InfoRowWithIcon icon={<Microchip size={12} />} label="GPU" value={node.gpu_name || "Unknown"} />
              <InfoRowWithIcon icon={<Server size={12} />} label={t("nodeCard.ram")} value={formatBytes(node.mem_total)} />
              <InfoRowWithIcon icon={<HardDrive size={12} />} label={t("nodeCard.disk")} value={formatBytes(node.disk_total)} />
            </Flex>
          )}
          
          {activeTab === "runtime" && (
            <Flex direction="column" gap="3">
              <InfoRowWithIcon 
                icon={<Clock size={12} />}
                label={t("nodeCard.uptime")} 
                value={liveData?.uptime ? formatUptime(liveData.uptime, t) : "-"} 
              />
              <InfoRowWithIcon 
                icon={<Activity size={12} />}
                label={t("nodeCard.process")} 
                value={liveData?.process?.toString() || "-"} 
              />
              <InfoRowWithIcon 
                icon={<Network size={12} />}
                label={t("nodeCard.connections")} 
                value={liveData ? `TCP: ${liveData.connections.tcp}, UDP: ${liveData.connections.udp}` : "-"} 
              />
              <InfoRowWithIcon 
                icon={<Clock size={12} />}
                label={t("nodeCard.last_updated")} 
                value={liveData?.updated_at ? new Date(liveData.updated_at).toLocaleString() : "-"} 
              />
            </Flex>
          )}
        </div>
      </Card>
    </div>
  );
};

// 保留原始InfoRow以防其他地方使用
// const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
//   <Flex justify="between" align="center">
//     <Text size="1" color="gray" className="min-w-0">
//       {label}
//     </Text>
//     <Text size="1" className="text-right truncate" style={{ maxWidth: "60%" }}>
//       {value}
//     </Text>
//   </Flex>
// );

const InfoRowWithIcon: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // 检测文本是否被截断
  const isTruncated = value.length > 20;

  const handleTouchStart = () => {
    if (isTruncated) {
      const timer = setTimeout(() => {
        setDialogOpen(true);
      }, 500); // 长按500ms触发
      setLongPressTimer(timer);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleClick = () => {
    if (isTruncated) {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          backgroundColor: "var(--gray-a2)",
          borderRadius: "8px",
          border: "1px solid var(--gray-a4)",
          transition: "all 0.2s ease",
          cursor: isTruncated ? "pointer" : "default",
          position: "relative",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <Flex align="center" gap="2" className="min-w-0">
          <div style={{ color: "var(--accent-9)", flexShrink: 0 }}>
            {icon}
          </div>
          <Text size="1" color="gray">
            {label}
          </Text>
        </Flex>
        <Flex align="center" gap="1" style={{ maxWidth: "60%" }}>
          <Text size="1" className="text-right truncate" style={{
            fontWeight: "500"
          }}>
            {value}
          </Text>
          {isTruncated && (
            <Info size={12} className="text-gray-400 flex-shrink-0" />
          )}
        </Flex>
      </div>

      {/* 移动端信息对话框 */}
      {isTruncated && (
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Content style={{ maxWidth: "90vw" }}>
            <Dialog.Title>
              <Flex align="center" gap="2">
                {icon}
                {label}
              </Flex>
            </Dialog.Title>
            <Dialog.Description size="2" mb="4">
              <Text style={{
                wordBreak: "break-all",
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: "1.5"
              }}>
                {value}
              </Text>
            </Dialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">关闭</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </>
  );
};