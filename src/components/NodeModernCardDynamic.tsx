import React, { useMemo } from "react";
import { Card, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { Activity, HardDrive, Cpu, MemoryStick, Network, Clock, TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { Record } from "@/types/LiveData";
import { formatUptime } from "./Node";
import { formatBytes, getTrafficStats } from "@/utils";
import "./NodeModernCard.css";

interface ModernCardDynamicProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
  forceShowTrafficText?: boolean;
  children: React.ReactNode; // 静态内容插槽
}

const ModernCardDynamicComponent: React.FC<ModernCardDynamicProps> = ({ 
  basic, 
  live, 
  online, 
  forceShowTrafficText = false,
  children
}) => {
  const { t } = useTranslation();

  // 默认值
  const defaultLive: Record = {
    cpu: { usage: 0 },
    ram: { used: 0 },
    swap: { used: 0 },
    load: { load1: 0, load5: 0, load15: 0 },
    disk: { used: 0 },
    network: { up: 0, down: 0, totalUp: 0, totalDown: 0 },
    connections: { tcp: 0, udp: 0 },
    uptime: 0,
    process: 0,
    message: "",
    updated_at: ""
  };

  const liveData = live || defaultLive;

  // 直接计算使用率百分比
  const memoryPercent = basic.mem_total ? (liveData.ram.used / basic.mem_total) * 100 : 0;
  const diskPercent = basic.disk_total ? (liveData.disk.used / basic.disk_total) * 100 : 0;

  // 使用缓存的流量计算
  const trafficStats = getTrafficStats(
    liveData.network.totalUp,
    liveData.network.totalDown,
    basic.traffic_limit,
    basic.traffic_limit_type
  );
  const trafficPercentage = trafficStats.percentage;
  const trafficUsage = trafficStats.usage;

  // 缓存静态的格式化值
  const staticFormattedBytes = useMemo(() => ({
    ramTotal: formatBytes(basic.mem_total, false, 1), // 桌面端保留1位小数
    ramTotalCompact: formatBytes(basic.mem_total, true),
    diskTotal: formatBytes(basic.disk_total, false, 1), // 桌面端保留1位小数
    diskTotalCompact: formatBytes(basic.disk_total, true),
    trafficLimit: formatBytes(basic.traffic_limit || 0, false, 1), // 桌面端保留1位小数
    trafficLimitCompact: formatBytes(basic.traffic_limit || 0, true)
  }), [basic.mem_total, basic.disk_total, basic.traffic_limit]);

  // 进度条颜色函数
  const getProgressColor = (value: number) => {
    if (value > 90) return "#ef4444";
    if (value > 70) return "#f59e0b";
    if (value > 50) return "#3b82f6";
    return "#10b981";
  };

  // 进度条颜色
  const progressColors = {
    cpu: getProgressColor(liveData.cpu.usage),
    memory: getProgressColor(memoryPercent),
    disk: getProgressColor(diskPercent),
    traffic: getProgressColor(trafficPercentage)
  };

  // 动态计算状态颜色
  const getStatusColor = () => {
    if (!online) return "from-gray-500/5 to-gray-600/5";
    if (liveData.cpu.usage > 90 || memoryPercent > 90) {
      return "from-red-500/5 to-orange-500/5";
    }
    if (liveData.cpu.usage > 70 || memoryPercent > 70) {
      return "from-orange-500/5 to-yellow-500/5";
    }
    return "from-green-500/5 to-emerald-500/5";
  };

  const getStatusGlow = () => {
    if (!online) return "";
    if (liveData.cpu.usage > 90 || memoryPercent > 90) {
      return "shadow-lg shadow-red-500/20";
    }
    if (liveData.cpu.usage > 70 || memoryPercent > 70) {
      return "shadow-lg shadow-orange-500/20";
    }
    return "shadow-lg shadow-green-500/20";
  };

  return (
    <Card
      className={`
        modern-card modern-card-hover modern-card-shadow
        relative overflow-visible
        bg-gradient-to-br ${getStatusColor()}
        border border-accent-5 hover:border-accent-8
        cursor-pointer ${getStatusGlow()}
        h-full min-h-fit
        ${!online ? 'modern-card-offline' : ''}
      `}
      style={{
        transform: 'scale(1)',
        transformOrigin: 'center'
      }}
    >
      {/* 状态指示条 */}
      <div 
        className={`absolute top-0 left-0 right-0 h-1 ${
          online ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-green-500' : 'bg-gray-500'
        }`}
        style={{
          boxShadow: online ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
        }}
      />

      {/* 主体内容 */}
      <Flex direction="column" gap="3" className="p-3 sm:p-4 relative z-10">
        {/* 静态内容插槽（包含头部信息） */}
        {children}

        {/* 资源使用情况网格 - 移动端 2x2 紧凑布局，桌面端 2x2 */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 relative">
          {/* CPU 使用率 */}
          <div className="bg-accent-2/50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-accent-4 hover:bg-accent-3/50 min-w-0">
            <Flex justify="between" align="center" mb="2">
              <Flex gap="1" align="center">
                <Cpu size={14} className="text-accent-10" />
                <Text size="1" weight="medium">CPU</Text>
              </Flex>
              <Text size="2" weight="bold" style={{ color: progressColors.cpu }}>
                {liveData.cpu.usage.toFixed(1)}%
              </Text>
            </Flex>
            <div className="w-full bg-accent-4 rounded-full h-2 overflow-hidden">
              <div
                className="usage-fill-modern h-full rounded-full relative"
                style={{
                  '--progress-width': `${liveData.cpu.usage}%`,
                  '--progress-color': progressColors.cpu
                } as React.CSSProperties}
              />
            </div>
            {basic.cpu_cores && (
              <Text size="1" color="gray" className="mt-1 hidden sm:block">
                {basic.cpu_cores} Cores
              </Text>
            )}
          </div>

          {/* 内存使用率 */}
          <div className="bg-accent-2/50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-accent-4 hover:bg-accent-3/50 min-w-0">
            <Flex justify="between" align="center" mb="2">
              <Flex gap="1" align="center">
                <MemoryStick size={14} className="text-accent-10" />
                <Text size="1" weight="medium">RAM</Text>
              </Flex>
              <Text size="2" weight="bold" style={{ color: progressColors.memory }}>
                {memoryPercent.toFixed(1)}%
              </Text>
            </Flex>
            <div className="w-full bg-accent-4 rounded-full h-2 overflow-hidden">
              <div
                className="usage-fill-modern h-full rounded-full relative"
                style={{
                  '--progress-width': `${memoryPercent}%`,
                  '--progress-color': progressColors.memory
                } as React.CSSProperties}
              />
            </div>
            <div className="mt-1 text-[10px] sm:text-sm whitespace-nowrap overflow-hidden">
              <div className="transform origin-left scale-[0.85] sm:scale-100 inline-block">
                <Text size="1" color="gray">
                  <span className="inline sm:hidden">{formatBytes(liveData.ram.used, true)}/{staticFormattedBytes.ramTotalCompact}</span>
                  <span className="hidden sm:inline">{formatBytes(liveData.ram.used, false, 1)} / {staticFormattedBytes.ramTotal}</span>
                </Text>
              </div>
            </div>
          </div>

          {/* 磁盘使用率和总流量 */}
          <div className="bg-accent-2/50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-accent-4 hover:bg-accent-3/50 min-w-0 flex flex-col gap-2 min-h-[9rem] sm:min-h-[10rem]">
            {/* 磁盘使用率 */}
            <div className="flex-1">
              <Flex justify="between" align="center" mb="1">
                <Flex gap="1" align="center">
                  <HardDrive size={12} className="text-accent-10" />
                  <Text size="1" weight="medium" className="text-xs">Disk</Text>
                </Flex>
                <Text size="1" weight="bold" style={{ color: progressColors.disk }}>
                  {diskPercent.toFixed(1)}%
                </Text>
              </Flex>
              <div className="w-full bg-accent-4 rounded-full h-1.5 overflow-hidden">
                <div
                  className="usage-fill-modern h-full rounded-full relative"
                  style={{
                    '--progress-width': `${diskPercent}%`,
                    '--progress-color': progressColors.disk
                  } as React.CSSProperties}
                />
              </div>
              <div className="mt-0.5 text-[10px] sm:text-xs whitespace-nowrap overflow-hidden">
                <div className="transform origin-left scale-[0.75] sm:scale-100 inline-block">
                  <Text size="1" color="gray">
                    <span className="inline sm:hidden">{formatBytes(liveData.disk.used, true)}/{staticFormattedBytes.diskTotalCompact}</span>
                    <span className="hidden sm:inline">{formatBytes(liveData.disk.used, false, 1)} / {staticFormattedBytes.diskTotal}</span>
                  </Text>
                </div>
              </div>
            </div>
            
            {/* 分隔线 */}
            <div className="w-full h-[1px] bg-accent-4" />
            
            {/* 总流量 */}
            <div className="flex-1 min-h-[4rem]">
              <Flex justify="between" align="center" mb="1">
                <Flex gap="1" align="center">
                  <Activity size={12} className="text-accent-10" />
                  <Text size="1" weight="medium" className="text-xs">Traffic</Text>
                </Flex>
                {Number(basic.traffic_limit) > 0 && !forceShowTrafficText && basic.traffic_limit_type && (
                  <Text size="1" weight="bold" style={{ 
                    color: progressColors.traffic
                  }}>
                    {trafficPercentage.toFixed(1)}%
                  </Text>
                )}
              </Flex>
              {Number(basic.traffic_limit) > 0 && !forceShowTrafficText && basic.traffic_limit_type ? (
                <>
                  <div className="w-full bg-accent-4 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="usage-fill-modern h-full rounded-full relative"
                      style={{
                        '--progress-width': `${Math.min(trafficPercentage, 100)}%`,
                        '--progress-color': progressColors.traffic
                      } as React.CSSProperties}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] sm:text-xs whitespace-nowrap overflow-hidden">
                    <div className="transform origin-left scale-[0.75] sm:scale-100 inline-block">
                      <Text size="1" color="gray">
                        <span className="inline sm:hidden">
                          {formatBytes(trafficUsage, true)}/{staticFormattedBytes.trafficLimitCompact}
                        </span>
                        <span className="hidden sm:inline">
                          {formatBytes(trafficUsage, false, 1)} / {staticFormattedBytes.trafficLimit}
                        </span>
                      </Text>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-0.5 text-[10px] sm:text-xs whitespace-nowrap overflow-hidden">
                  <div className="transform origin-left scale-[0.75] sm:scale-100 inline-block">
                    <Text size="1" color="gray">
                      <span className="inline sm:hidden">↑{formatBytes(liveData.network.totalUp, true)} ↓{formatBytes(liveData.network.totalDown, true)}</span>
                      <span className="hidden sm:inline">↑ {formatBytes(liveData.network.totalUp, false, 1)} ↓ {formatBytes(liveData.network.totalDown, false, 1)}</span>
                    </Text>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 网络速度 */}
          <div className="bg-accent-2/50 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-accent-4 hover:bg-accent-3/50 min-w-0">
            <Flex gap="1" align="center" mb="2">
              <Network size={14} className="text-accent-10" />
              <Text size="1" weight="medium">Speed</Text>
            </Flex>
            <Flex direction="column" gap="1" className="sm:gap-2">
              <Flex justify="between" align="center" className="bg-green-500/10 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 min-w-0">
                <Flex gap="1" align="center">
                  <TrendingUp size={10} className="text-green-500 sm:w-3 sm:h-3" />
                  <Text size="1" weight="medium" className="text-xs sm:text-sm hidden sm:inline">Up</Text>
                </Flex>
                <div className="overflow-hidden">
                  <div className="transform origin-right scale-[0.85] sm:scale-100 inline-block">
                    <Text size="1" weight="bold" className="text-green-600 text-xs sm:text-sm whitespace-nowrap">
                      <span className="inline sm:hidden">{formatBytes(liveData.network.up, true)}/s</span>
                      <span className="hidden sm:inline">{formatBytes(liveData.network.up, false, 1)}/s</span>
                    </Text>
                  </div>
                </div>
              </Flex>
              <Flex justify="between" align="center" className="bg-blue-500/10 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 min-w-0">
                <Flex gap="1" align="center">
                  <TrendingDown size={10} className="text-blue-500 sm:w-3 sm:h-3" />
                  <Text size="1" weight="medium" className="text-xs sm:text-sm hidden sm:inline">Down</Text>
                </Flex>
                <div className="overflow-hidden">
                  <div className="transform origin-right scale-[0.85] sm:scale-100 inline-block">
                    <Text size="1" weight="bold" className="text-blue-600 text-xs sm:text-sm whitespace-nowrap">
                      <span className="inline sm:hidden">{formatBytes(liveData.network.down, true)}/s</span>
                      <span className="hidden sm:inline">{formatBytes(liveData.network.down, false, 1)}/s</span>
                    </Text>
                  </div>
                </div>
              </Flex>
            </Flex>
          </div>
        </div>

        {/* 底部信息 - 移动端显示但缩小 */}
        <Flex justify="between" align="center" className="pt-2 sm:pt-3 border-t border-accent-4">
          <Flex gap="2 sm:gap-3" align="center" className="min-w-0 flex-1">
            <Flex gap="1" align="center" className="min-w-0">
              <Clock size={10} className="text-accent-10 sm:w-3 sm:h-3 flex-shrink-0" />
              <div className="transform origin-left scale-[0.8] sm:scale-100 inline-block">
                <Text size="1" color="gray" className="whitespace-nowrap">
                  {online ? formatUptime(liveData.uptime, t) : t("nodeCard.offline")}
                </Text>
              </div>
            </Flex>
          </Flex>
          {online && (
            <Flex gap="2 sm:gap-3" align="center" className="flex-shrink-0">
              <Flex gap="1" align="center" className="min-w-0 mr-0 sm:mr-3">
                <Zap size={10} className="text-yellow-500 sm:w-3 sm:h-3 flex-shrink-0" />
                <div className="transform origin-left scale-[0.8] sm:scale-100 inline-block">
                  <Text size="1" color="gray" className="whitespace-nowrap">
                    Load: {liveData.load?.load1?.toFixed(2) || "0.00"}
                  </Text>
                </div>
              </Flex>
              <Flex gap="1" align="center" className="flex-shrink-0">
                <Activity size={10} className="text-green-500 sm:w-3 sm:h-3" />
                <div className="transform origin-right scale-[0.8] sm:scale-100 inline-block">
                  <Text size="1" weight="medium" className="text-green-600 whitespace-nowrap">
                    Active
                  </Text>
                </div>
              </Flex>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Card>
  );
};

// 动态内容比较函数 - 只比较实际显示的数据
export const ModernCardDynamic = React.memo(ModernCardDynamicComponent, (prev, next) => {
  // 基本信息变化需要重新渲染（影响计算）
  if (prev.basic.uuid !== next.basic.uuid) return false;
  if (prev.basic.mem_total !== next.basic.mem_total) return false;
  if (prev.basic.disk_total !== next.basic.disk_total) return false;
  if (prev.basic.traffic_limit !== next.basic.traffic_limit) return false;
  if (prev.basic.traffic_limit_type !== next.basic.traffic_limit_type) return false;
  if (prev.basic.cpu_cores !== next.basic.cpu_cores) return false;
  
  // 在线状态变化需要重新渲染
  if (prev.online !== next.online) return false;
  
  // 强制显示流量文本的设置
  if (prev.forceShowTrafficText !== next.forceShowTrafficText) return false;
  
  // 比较实时数据的关键字段
  if (!prev.live && !next.live) return true;
  if (!prev.live || !next.live) return false;
  
  const prevLive = prev.live;
  const nextLive = next.live;
  
  return (
    prevLive.cpu.usage === nextLive.cpu.usage &&
    prevLive.ram.used === nextLive.ram.used &&
    prevLive.disk.used === nextLive.disk.used &&
    prevLive.network.up === nextLive.network.up &&
    prevLive.network.down === nextLive.network.down &&
    prevLive.network.totalUp === nextLive.network.totalUp &&
    prevLive.network.totalDown === nextLive.network.totalDown &&
    prevLive.load.load1 === nextLive.load.load1 &&
    prevLive.uptime === nextLive.uptime &&
    prevLive.message === nextLive.message
  );
});