import { Card, Flex, Text, Badge, SegmentedControl } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { formatBytes, formatUptime } from "./Node";
import { 
  Activity, Cpu, HardDrive, Network, Server, Clock, 
  Monitor, Microchip, Zap, Wifi, Database, MemoryStick 
} from "lucide-react";
import UsageBar from "./UsageBar";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { Record } from "@/types/LiveData";
import { useState } from "react";

interface DesktopDetailsCardProps {
  node: NodeBasicInfo;
  liveData?: Record;
  isOnline: boolean;
  uuid: string;
}

export const DesktopDetailsCard: React.FC<DesktopDetailsCardProps> = ({
  node,
  liveData,
  isOnline,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"overview" | "hardware" | "network" | "runtime">("overview");

  const memoryUsagePercent = node.mem_total && liveData
    ? (liveData.ram.used / node.mem_total) * 100
    : 0;
  const diskUsagePercent = node.disk_total && liveData
    ? (liveData.disk.used / node.disk_total) * 100
    : 0;
  const swapUsagePercent = node.swap_total && liveData
    ? (liveData.swap.used / node.swap_total) * 100
    : 0;

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* 状态和标签切换区域 */}
      <Flex justify="between" align="center" className="mb-4">
        <Flex align="center" gap="3">
          <Activity size={20} className="text-accent-9" />
          <Text size="3" weight="bold">{t("nodeCard.details")}</Text>
          <Badge color={isOnline ? "green" : "red"} variant="soft" size="2">
            {isOnline ? t("nodeCard.online") : t("nodeCard.offline")}
          </Badge>
        </Flex>
        
        <SegmentedControl.Root
          radius="full"
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
          size="2"
        >
          <SegmentedControl.Item value="overview">
            <Flex align="center" gap="1">
              <Monitor size={16} />
              {t("nodeCard.overview")}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="hardware">
            <Flex align="center" gap="1">
              <Microchip size={16} />
              {t("nodeCard.hardware")}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="network">
            <Flex align="center" gap="1">
              <Network size={16} />
              {t("nodeCard.network")}
            </Flex>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="runtime">
            <Flex align="center" gap="1">
              <Zap size={16} />
              {t("nodeCard.runtime")}
            </Flex>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Flex>

      {/* 内容区域 */}
      <div className="grid gap-4">
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* 资源使用情况 */}
            <Card style={{ borderRadius: "12px" }}>
              <Flex direction="column" gap="4">
                <Text size="3" weight="bold">{t("nodeCard.resource_usage")}</Text>
                
                {/* CPU */}
                <div>
                  <Flex justify="between" align="center" className="mb-2">
                    <Flex align="center" gap="2">
                      <Cpu size={16} className="text-accent-9" />
                      <Text size="2">{t("nodeCard.cpu")}</Text>
                    </Flex>
                    <Text size="2" color="gray">
                      {liveData?.cpu.usage.toFixed(1) || 0}%
                    </Text>
                  </Flex>
                  <UsageBar label="" value={liveData?.cpu.usage || 0} />
                </div>

                {/* 内存 */}
                <div>
                  <Flex justify="between" align="center" className="mb-2">
                    <Flex align="center" gap="2">
                      <MemoryStick size={16} className="text-accent-9" />
                      <Text size="2">{t("nodeCard.ram")}</Text>
                    </Flex>
                    <Text size="2" color="gray">
                      {formatBytes(liveData?.ram.used || 0)} / {formatBytes(node.mem_total)}
                    </Text>
                  </Flex>
                  <UsageBar label="" value={memoryUsagePercent} />
                </div>

                {/* 硬盘 */}
                <div>
                  <Flex justify="between" align="center" className="mb-2">
                    <Flex align="center" gap="2">
                      <HardDrive size={16} className="text-accent-9" />
                      <Text size="2">{t("nodeCard.disk")}</Text>
                    </Flex>
                    <Text size="2" color="gray">
                      {formatBytes(liveData?.disk.used || 0)} / {formatBytes(node.disk_total)}
                    </Text>
                  </Flex>
                  <UsageBar label="" value={diskUsagePercent} />
                </div>

                {/* Swap (如果有) */}
                {node.swap_total > 0 && (
                  <div>
                    <Flex justify="between" align="center" className="mb-2">
                      <Flex align="center" gap="2">
                        <Database size={16} className="text-accent-9" />
                        <Text size="2">{t("nodeCard.swap")}</Text>
                      </Flex>
                      <Text size="2" color="gray">
                        {formatBytes(liveData?.swap.used || 0)} / {formatBytes(node.swap_total)}
                      </Text>
                    </Flex>
                    <UsageBar label="" value={swapUsagePercent} />
                  </div>
                )}
              </Flex>
            </Card>

            {/* 系统信息 */}
            <Card style={{ borderRadius: "12px" }}>
              <Flex direction="column" gap="4">
                <Text size="3" weight="bold">{t("nodeCard.system_info")}</Text>
                <InfoRow icon={<Monitor size={14} />} label={t("nodeCard.os")} value={node.os} />
                <InfoRow icon={<Monitor size={14} />} label={t("nodeCard.kernelVersion")} value={node.kernel_version || "Unknown"} />
                <InfoRow icon={<Cpu size={14} />} label={t("nodeCard.arch")} value={node.arch} />
                <InfoRow icon={<Server size={14} />} label={t("nodeCard.virtualization")} value={node.virtualization || "Unknown"} />
                <InfoRow icon={<Zap size={14} />} label={t("nodeCard.version")} value={node.version} />
              </Flex>
            </Card>
          </div>
        )}

        {activeTab === "hardware" && (
          <Card style={{ borderRadius: "12px" }}>
            <Flex direction="column" gap="4">
              <Text size="3" weight="bold">{t("nodeCard.hardware_info")}</Text>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow icon={<Cpu size={14} />} label="CPU" value={`${node.cpu_name} (x${node.cpu_cores})`} />
                <InfoRow icon={<Microchip size={14} />} label="GPU" value={node.gpu_name || "Unknown"} />
                <InfoRow icon={<MemoryStick size={14} />} label={t("nodeCard.ram")} value={formatBytes(node.mem_total)} />
                <InfoRow icon={<HardDrive size={14} />} label={t("nodeCard.disk")} value={formatBytes(node.disk_total)} />
              </div>
            </Flex>
          </Card>
        )}

        {activeTab === "network" && (
          <Card style={{ borderRadius: "12px" }}>
            <Flex direction="column" gap="4">
              <Text size="3" weight="bold">{t("nodeCard.network_info")}</Text>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow 
                  icon={<Wifi size={14} />} 
                  label={t("nodeCard.networkSpeed")} 
                  value={`↑ ${formatBytes(liveData?.network.up || 0)}/s ↓ ${formatBytes(liveData?.network.down || 0)}/s`} 
                />
                <InfoRow 
                  icon={<Network size={14} />} 
                  label={t("nodeCard.totalTraffic")} 
                  value={`↑ ${formatBytes(liveData?.network.totalUp || 0)} ↓ ${formatBytes(liveData?.network.totalDown || 0)}`} 
                />
                <InfoRow 
                  icon={<Server size={14} />} 
                  label={t("nodeCard.connections")} 
                  value={liveData ? `TCP: ${liveData.connections.tcp}, UDP: ${liveData.connections.udp}` : "-"} 
                />
              </div>
            </Flex>
          </Card>
        )}

        {activeTab === "runtime" && (
          <Card style={{ borderRadius: "12px" }}>
            <Flex direction="column" gap="4">
              <Text size="3" weight="bold">{t("nodeCard.runtime_info")}</Text>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoRow 
                  icon={<Clock size={14} />}
                  label={t("nodeCard.uptime")} 
                  value={liveData?.uptime ? formatUptime(liveData.uptime, t) : "-"} 
                />
                <InfoRow 
                  icon={<Activity size={14} />}
                  label={t("nodeCard.process")} 
                  value={liveData?.process?.toString() || "-"} 
                />
                <InfoRow 
                  icon={<Clock size={14} />}
                  label={t("nodeCard.last_updated")} 
                  value={liveData?.updated_at ? new Date(liveData.updated_at).toLocaleString() : "-"} 
                />
              </div>
            </Flex>
          </Card>
        )}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "var(--gray-a2)",
    borderRadius: "8px",
    border: "1px solid var(--gray-a4)",
    transition: "all 0.2s ease"
  }}>
    <Flex align="center" gap="2" className="min-w-0">
      <div style={{ color: "var(--accent-9)", flexShrink: 0 }}>
        {icon}
      </div>
      <Text size="2" color="gray">
        {label}
      </Text>
    </Flex>
    <Text size="2" className="text-right truncate" style={{ 
      maxWidth: "60%", 
      fontWeight: "500"
    }}>
      {value}
    </Text>
  </div>
);