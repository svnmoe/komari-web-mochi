import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveData } from "../../contexts/LiveDataContext";
import { useTranslation } from "react-i18next";
import type { Record } from "../../types/LiveData";
import Flag from "../../components/Flag";
import { Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { useNodeList } from "@/contexts/NodeListContext";
import { liveDataToRecords } from "@/utils/RecordHelper";
import LoadChart from "./LoadChart";
import PingChart from "./PingChart";
import { DetailsGrid } from "@/components/DetailsGrid";
import { MobileDetailsCard } from "@/components/MobileDetailsCard";
import { MobileLoadChart } from "@/components/MobileLoadChart";
import { useIsMobile } from "@/hooks/use-mobile";

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
      <Flex className="items-center" direction={"column"} gap="2" style={{ width: "100%" }}>
        {/* 移动端标题栏 */}
        <div className="w-full px-3 py-2" style={{ backgroundColor: "var(--accent-2)", borderRadius: "12px", margin: "0 12px" }}>
          <Flex align="center" gap="2" className="mb-2">
            <Flag flag={node?.region ?? ""} />
            <Text size="3" weight="bold" className="truncate flex-1">
              {node?.name ?? uuid}
            </Text>
          </Flex>
          <Text size="1" color="gray" className="px-2">
            {node?.uuid}
          </Text>
        </div>

        {/* 移动端详情卡片 */}
        <MobileDetailsCard 
          node={node} 
          liveData={liveNodeData} 
          isOnline={isOnline}
        />

        {/* 图表切换 */}
        <div className="w-full px-3 mb-2">
          <SegmentedControl.Root
            radius="full"
            value={chartView}
            onValueChange={(value) => setChartView(value as "load" | "ping")}
            className="w-full"
          >
            <SegmentedControl.Item value="load" className="flex-1">
              {t("nodeCard.load")}
            </SegmentedControl.Item>
            <SegmentedControl.Item value="ping" className="flex-1">
              {t("nodeCard.ping")}
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>

        {/* 图表 */}
        <div className="w-full px-3 pb-4">
          {chartView === "load" ? (
            <MobileLoadChart 
              data={liveDataToRecords(uuid ?? "", recent)} 
              liveData={liveNodeData}
              node={node}
            />
          ) : (
            <PingChart uuid={uuid ?? ""} />
          )}
        </div>
      </Flex>
    );
  }

  // 桌面端布局
  return (
    <Flex className="items-center" direction={"column"} gap="2">
      <div className="flex flex-col gap-1 md:p-4 p-3 border-0 rounded-md">
        <h1 className="flex items-center flex-wrap">
          <Flag flag={node?.region ?? ""} />
          <Text size="3" weight="bold" wrap="nowrap">
            {node?.name ?? uuid}
          </Text>
          <Text
            size="1"
            style={{
              marginLeft: "8px",
            }}
            className="text-accent-6"
            wrap="nowrap"
          >
            {node?.uuid}
          </Text>
        </h1>
        <DetailsGrid align="center" uuid={uuid ?? ""} />
      </div>
      <SegmentedControl.Root
        radius="full"
        value={chartView}
        onValueChange={(value) => setChartView(value as "load" | "ping")}
      >
        <SegmentedControl.Item value="load">
          {t("nodeCard.load")}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="ping">
          {t("nodeCard.ping")}
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      {/* Recharts */}
      {chartView === "load" ? (
        <LoadChart data={liveDataToRecords(uuid ?? "", recent)} />
      ) : (
        <PingChart uuid={uuid ?? ""} />
      )}
      <div className="grid w-full items-center justify-center mx-auto h-full gap-4 p-1 md:grid-cols-[repeat(auto-fit,minmax(620px,1fr))] grid-cols-[repeat(auto-fit,minmax(320px,1fr))]"></div>
    </Flex>
  );
}
// #region 详情网格

// // 递归补0工具
// function deepZeroFill(obj: any): any {
//   if (obj === null || obj === undefined) return 0;
//   if (typeof obj === "number") return 0;
//   if (typeof obj === "string" || typeof obj === "boolean") return obj;
//   if (Array.isArray(obj)) return obj.map(deepZeroFill);
//   if (typeof obj === "object") {
//     const res: any = {};
//     for (const k in obj) {
//       if (k === "updated_at") continue;
//       res[k] = deepZeroFill(obj[k]);
//     }
//     return res;
//   }
//   return 0;
// }

// function fillMissingTimePoints<T extends { updated_at: string }>(
//   data: T[],
//   intervalSec: number = 10,
//   totalSeconds: number = 180,
//   matchToleranceSec?: number
// ): T[] {
//   if (!data.length) return [];
//   // 按时间升序排序
//   const sorted = [...data].sort(
//     (a, b) =>
//       new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
//   );
//   const end = new Date(sorted[sorted.length - 1].updated_at).getTime();
//   const interval = intervalSec * 1000;
//   const start = end - totalSeconds * 1000 + interval;
//   const timePoints: number[] = [];
//   for (let t = start; t <= end; t += interval) {
//     timePoints.push(t);
//   }
//   // 生成补齐后的数据：允许时间点在 matchToleranceMs 容忍范围内匹配原始数据
//   const zeroTemplate = deepZeroFill(sorted[sorted.length - 1]);
//   let dataIdx = 0;
//   const matchToleranceMs = (matchToleranceSec ?? intervalSec) * 1000;
//   const filled: T[] = timePoints.map((t) => {
//     // 找到最近的原始数据点（在 matchToleranceMs 容忍范围内）
//     let found: T | undefined = undefined;
//     while (
//       dataIdx < sorted.length &&
//       new Date(sorted[dataIdx].updated_at).getTime() < t - matchToleranceMs
//     ) {
//       dataIdx++;
//     }
//     if (
//       dataIdx < sorted.length &&
//       Math.abs(new Date(sorted[dataIdx].updated_at).getTime() - t) <=
//         matchToleranceMs
//     ) {
//       found = sorted[dataIdx];
//     }
//     if (found) {
//       return { ...found, updated_at: new Date(t).toISOString() };
//     }
//     // 没有数据，递归补0
//     return { ...zeroTemplate, updated_at: new Date(t).toISOString() } as T;
//   });
//   return filled;
// }


