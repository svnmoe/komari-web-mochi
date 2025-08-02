import { useTranslation } from "react-i18next";
import { UpDownStack } from "./UpDownStack";
import { useNodeList } from "@/contexts/NodeListContext";
import { useLiveData } from "@/contexts/LiveDataContext";
import { formatBytes, formatUptime } from "./Node";
import { Flex, Text } from "@radix-ui/themes";

type DetailsGridProps = {
  uuid: string;
  gap?: string;
  align?: "start" | "center" | "end";
};

export const DetailsGrid = ({ uuid, gap, align }: DetailsGridProps) => {
  const { t } = useTranslation();

  const { nodeList } = useNodeList();
  const { live_data } = useLiveData();
  const node = nodeList?.find((n) => n.uuid === uuid);

  return (
    <div
      className={`flex flex-wrap gap-${gap ?? "4"} max-w-180 basis-full justify-center ${align === "center" ? "justify-between" : ""
        }`}
    >
      <UpDownStack
        className="md:w-128 flex-[0_0_calc(50%-0.5rem)]"
        up="CPU"
        down={`${node?.cpu_name} (x${node?.cpu_cores})`}
      />
      <label className={`flex flex-wrap gap-2 gap-x-8 flex-[0_0_calc(50%-0.5rem)] ${align === "center" ? "justify-end" : ""}`}>
        <UpDownStack up={t("nodeCard.arch")} down={node?.arch ?? "Unknown"} />

        <UpDownStack
          up={t("nodeCard.virtualization")}
          align={align === "center" ? "end" : "start"}
          down={node?.virtualization ?? "Unknown"}
        />
      </label>
      <UpDownStack up="GPU" down={node?.gpu_name ?? "Unknown"} className="flex-[0_0_calc(50%-0.5rem)]" />
      <UpDownStack
        className="md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
        up={t("nodeCard.os")}
        align={align === "center"?"end":"start"}
        down={node?.os ?? "Unknown"}
      />
      <UpDownStack
        className="md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
        up={t("nodeCard.kernelVersion")}
        align={align === "center"?"end":"start"}
        down={node?.kernel_version ?? "Unknown"}
      />

      <UpDownStack
        className="md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
        up={t("nodeCard.networkSpeed")}
        down={` ↑ ${formatBytes(
          live_data?.data.data[uuid ?? ""]?.network.up || 0
        )}/s
          ↓
          ${formatBytes(
          live_data?.data.data[uuid ?? ""]?.network.down || 0
        )}/s`}
      />
      <UpDownStack
        up={t("nodeCard.totalTraffic")}
        align={align === "center"?"end":"start"}
        className="flex-[0_0_calc(50%-0.5rem)]"
        down={`↑
          ${formatBytes(
          live_data?.data.data[uuid ?? ""]?.network.totalUp || 0
        )}
          ↓
          ${formatBytes(
          live_data?.data.data[uuid ?? ""]?.network.totalDown || 0
        )}`}
      />
      <UpDownStack
        className="md:w-70 w-full flex-[0_0_calc(50%-0.5rem)]"
        up={t("nodeCard.ram")}
        down={formatBytes(node?.mem_total || 0)}
      />
      <UpDownStack
        up={t("nodeCard.swap")}
        className="flex-[0_0_calc(50%-0.5rem)]"
        align={align === "center"?"end":"start"}
        down={formatBytes(node?.swap_total || 0)}
      />
      <UpDownStack
        className="md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
        up={t("nodeCard.disk")}
        down={formatBytes(node?.disk_total || 0)}
      />
      <div className="flex-[0_0_calc(50%-0.5rem)]" />
      <UpDownStack
        up={t("nodeCard.uptime")}
        className="flex-[0_0_calc(50%-0.5rem)]"
        down={
          live_data?.data.data[uuid ?? ""]?.uptime
            ? formatUptime(live_data?.data.data[uuid ?? ""]?.uptime, t)
            : "-"
        }
      />
      <label className={`flex flex-wrap gap-2 flex-[0_0_calc(50%-0.5rem)] ${align === "center" ? "justify-end" : ""}`}>
        <Flex align={"center"} gap="2">
          <Text size="2" weight="bold" wrap="nowrap">
            {t("nodeCard.last_updated")}
          </Text>
          <Text size="2">
            {node?.updated_at
              ? new Date(
                live_data?.data.data[uuid ?? ""]?.updated_at ||
                node.updated_at
              ).toLocaleString()
              : "-"}
          </Text>
        </Flex>
      </label>
    </div>
  );
};
