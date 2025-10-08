import React, { useEffect, useState } from "react";
import { Card, Flex, Text, IconButton, Popover } from "@radix-ui/themes";
import { Activity, Globe, Network, Server, Settings, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/components/Node";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

export interface StatusCardsVisibility {
  currentTime: boolean;
  currentOnline: boolean;
  regionOverview: boolean;
  trafficOverview: boolean;
  networkSpeed: boolean;
  forceShowTrafficText?: boolean;
}

interface StatusBarProps {
  currentTime: string;
  onlineCount: number;
  totalCount: number;
  regionCount: number;
  uploadTotal: number;
  downloadTotal: number;
  uploadSpeed: number;
  downloadSpeed: number;
  statusCardsVisibility: StatusCardsVisibility;
  onVisibilityChange: (visibility: StatusCardsVisibility) => void;
}

// Speed history for the chart
interface SpeedData {
  time: number;
  upload: number;
  download: number;
}

const StatusBar: React.FC<StatusBarProps> = ({
  currentTime,
  onlineCount,
  totalCount,
  regionCount,
  uploadTotal,
  downloadTotal,
  uploadSpeed,
  downloadSpeed,
  statusCardsVisibility,
  onVisibilityChange,
}) => {
  const [t] = useTranslation();
  const [speedHistory, setSpeedHistory] = useState<SpeedData[]>([]);
  const maxDataPoints = 30; // Show last 30 seconds

  // Update speed history
  useEffect(() => {
    const newData: SpeedData = {
      time: Date.now(),
      upload: uploadSpeed,
      download: downloadSpeed,
    };

    setSpeedHistory((prev) => {
      const updated = [...prev, newData];
      if (updated.length > maxDataPoints) {
        return updated.slice(-maxDataPoints);
      }
      return updated;
    });
  }, [uploadSpeed, downloadSpeed]);

  // Format bytes for display with smart decimals
  const formatSpeed = (bytes: number): string => {
    if (bytes === 0) return "0 B/s";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    // Smart decimal places
    let decimals = 0;
    if (i === 2 && size < 10) decimals = 1; // MB/s: show decimal for < 10
    if (i === 3) decimals = 2; // GB/s: always show 2 decimals
    
    return `${size.toFixed(decimals)} ${units[i]}`;
  };

  // Calculate online percentage
  const onlinePercentage = totalCount > 0 ? (onlineCount / totalCount) * 100 : 0;

  // Get color based on online percentage
  const getOnlineColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981'; // green
    if (percentage >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <Card className="status-bar-container mx-4 mb-2 relative py-2 px-3">
      <Flex direction="column" gap="0">
        {/* Settings button */}
        <div className="status-settings-button absolute top-2 right-2 z-10">
          <Popover.Root>
            <Popover.Trigger>
              <IconButton variant="ghost" size="1" className="hover:bg-gray-3 transition-all">
                <Settings size={14} />
              </IconButton>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <StatusSettings
                visibility={statusCardsVisibility}
                onVisibilityChange={onVisibilityChange}
              />
            </Popover.Content>
          </Popover.Root>
        </div>

        {/* Status cards grid - Dynamic flex layout */}
        <div className="status-cards-grid">
          {/* Current Time */}
          {statusCardsVisibility.currentTime && (
            <div className="status-card-wrapper status-time-wrapper">
              <StatusCard
                icon={<Activity className="text-gray-11" size={16} />}
                title={t("current_time")}
                value={<span className="tabular-nums font-semibold text-base">{currentTime}</span>}
                className="status-time"
              />
            </div>
          )}

          {/* Online Status */}
          {statusCardsVisibility.currentOnline && (
            <div className="status-card-wrapper status-online-wrapper">
              <StatusCard
                icon={<Server className="text-gray-11" size={16} />}
                title={t("current_online")}
                value={
                  <Flex align="center" justify="between" className="w-full">
                    <span className="font-semibold tabular-nums text-base">{onlineCount}/{totalCount}</span>
                    <span className="text-xs tabular-nums opacity-60">{onlinePercentage.toFixed(0)}%</span>
                  </Flex>
                }
                subtitle={
                  <div className="w-full bg-gray-a4 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${onlinePercentage}%`,
                        backgroundColor: getOnlineColor(onlinePercentage)
                      }}
                    />
                  </div>
                }
                className="status-online"
              />
            </div>
          )}

          {/* Regions */}
          {statusCardsVisibility.regionOverview && (
            <div className="status-card-wrapper status-region-wrapper">
              <StatusCard
                icon={<Globe className="text-gray-11" size={16} />}
                title={t("region_overview")}
                value={<span className="font-semibold text-lg">{regionCount}</span>}
                className="status-region"
              />
            </div>
          )}

          {/* Traffic Overview */}
          {statusCardsVisibility.trafficOverview && (
            <div className="status-card-wrapper status-traffic-wrapper">
              <StatusCard
                icon={<Network className="text-gray-11" size={16} />}
                title={t("traffic_overview")}
                value={
                  <Flex direction="column" gap="0">
                    <Text size="2" className="leading-snug font-medium">
                      ↑ {formatBytes(uploadTotal)}
                    </Text>
                    <Text size="2" className="leading-snug font-medium">
                      ↓ {formatBytes(downloadTotal)}
                    </Text>
                  </Flex>
                }
                className="status-traffic"
              />
            </div>
          )}

          {/* Network Speed Chart */}
          {statusCardsVisibility.networkSpeed && (
            <div className="status-card-wrapper status-speed-wrapper">
              <StatusCard
                icon={<TrendingUp className="text-gray-11" size={16} />}
                title={t("network_speed")}
                value={
                  <div className="w-full h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={speedHistory} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-2 p-1.5 rounded shadow border border-gray-5">
                                  <Text size="1" style={{ color: '#10b981' }}>
                                    ↑ {formatSpeed(payload[0].value as number)}
                                  </Text>
                                  <br />
                                  <Text size="1" style={{ color: '#ef4444' }}>
                                    ↓ {formatSpeed(payload[1].value as number)}
                                  </Text>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="upload"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          dot={false}
                          animationDuration={0}
                        />
                        <Line
                          type="monotone"
                          dataKey="download"
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          dot={false}
                          animationDuration={0}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                }
                subtitle={
                  <Flex gap="3" justify="center" className="text-xs">
                    <Text size="1" style={{ color: '#10b981' }}>
                      ↑ {formatSpeed(uploadSpeed)}
                    </Text>
                    <Text size="1" style={{ color: '#ef4444' }}>
                      ↓ {formatSpeed(downloadSpeed)}
                    </Text>
                  </Flex>
                }
                className="status-speed"
              />
            </div>
          )}
        </div>
      </Flex>
    </Card>
  );
};

// Individual status card component
interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, title, value, subtitle, className }) => {
  // 所有卡片使用统一的垂直布局
  return (
    <div className={`status-card rounded-md min-h-[5.5rem] w-full ${className || ''}`}>
      <Flex direction="column" gap="1" className="h-full justify-center">
        <Flex align="center" gap="2">
          <div className="status-icon flex-shrink-0">{icon}</div>
          <Text size="1" color="gray" className="text-xs">
            {title}
          </Text>
        </Flex>
        <div className="status-value w-full">{value}</div>
        {subtitle && <div className="status-subtitle">{subtitle}</div>}
      </Flex>
    </div>
  );
};

// Settings component
interface StatusSettingsProps {
  visibility: StatusCardsVisibility;
  onVisibilityChange: (visibility: StatusCardsVisibility) => void;
}

const StatusSettings: React.FC<StatusSettingsProps> = ({ visibility, onVisibilityChange }) => {
  const [t] = useTranslation();

  const toggleVisibility = (key: keyof StatusCardsVisibility) => {
    onVisibilityChange({
      ...visibility,
      [key]: !visibility[key],
    });
  };

  const settings: { key: keyof StatusCardsVisibility; label: string }[] = [
    { key: "currentTime", label: t("current_time") },
    { key: "currentOnline", label: t("current_online") },
    { key: "regionOverview", label: t("region_overview") },
    { key: "trafficOverview", label: t("traffic_overview") },
    { key: "networkSpeed", label: t("network_speed") },
    { key: "forceShowTrafficText", label: t("statusBar.forceShowTrafficText") },
  ];

  return (
    <Flex direction="column" gap="3">
      <Text size="2" weight="bold">
        {t("status_settings")}
      </Text>
      <Flex direction="column" gap="2">
        {settings.map((setting) => (
          <label key={setting.key} className="flex items-center justify-between cursor-pointer group">
            <Text size="2">{setting.label}</Text>
            <button
              type="button"
              role="switch"
              aria-checked={!!(visibility[setting.key] ?? true)}
              onClick={() => toggleVisibility(setting.key)}
              className={`
                relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200
                ${(visibility[setting.key] ?? true) ? 'bg-accent-9' : 'bg-gray-5'}
                focus:outline-none focus:ring-2 focus:ring-accent-8 focus:ring-offset-2
                group-hover:shadow-sm
              `}
            >
              <span className="sr-only">Toggle {setting.label}</span>
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-all duration-200
                  ${(visibility[setting.key] ?? true) ? 'translate-x-[18px]' : 'translate-x-[2px]'}
                `}
              />
            </button>
          </label>
        ))}
      </Flex>
    </Flex>
  );
};

export default StatusBar;