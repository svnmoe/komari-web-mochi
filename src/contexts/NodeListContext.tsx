import React from "react";
import { useRPC2Call } from "./RPC2Context";

export type NodeBasicInfo = {
  /** 节点唯一标识符 */
  uuid: string;
  /** 节点名称 */
  name: string;
  /** CPU型号 */
  cpu_name: string;
  /** 虚拟化 */
  virtualization: string;
  /** 系统架构 */
  arch: string;
  /** CPU核心数 */
  cpu_cores: number;
  /** 操作系统 */
  os: string;
  /** 内核版本 */
  kernel_version: string;
  /** GPU型号 */
  gpu_name: string;
  /** GPU内存总量(字节) */
  gpu_mem_total?: number;
  /** 地区标识 */
  region: string;
  /** 总内存(字节) */
  mem_total: number;
  /** 总交换空间(字节) */
  swap_total: number;
  /** 总磁盘空间(字节) */
  disk_total: number;
  /** 版本号 */
  version: string;
  /** 权重 */
  weight: number;
  /** 价格 */
  price: number;
  tags: string;
  /** 账单周期（天）*/
  billing_cycle: number;
  currency: string;
  
  group: string;
  /** 流量限制（字节） */
  traffic_limit?: number;
  /** 流量限制类型 */
  traffic_limit_type?: "sum" | "max" | "min" | "up" | "down";
  /** 过期时间 */
  expired_at: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
};

interface NodeListContextType {
  nodeList: NodeBasicInfo[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const NodeListContext = React.createContext<NodeListContextType | undefined>(
  undefined
);

export const NodeListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [nodeList, setNodeList] = React.useState<NodeBasicInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const { call } = useRPC2Call();

  const refresh = () => {
    setIsLoading(true);
    setError(null);

    const fallbackFetch = () =>
      fetch("/api/nodes")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch node data");
          }
          return response.json();
        })
        .then((resp) => {
          if (resp && Array.isArray(resp.data)) {
            setNodeList(resp.data);
          } else {
            setNodeList([]);
          }
        });

    // 先尝试 RPC2，失败时回退 REST
    call<{ uuid?: string }, Record<string, any>>("common:getNodes")
      .then((result) => {
        if (!result || typeof result !== "object") {
          setNodeList([]);
          return;
        }
        const list: NodeBasicInfo[] = Object.values(result).map((n: any) => ({
          uuid: n.uuid,
          name: n.name,
          cpu_name: n.cpu_name,
          virtualization: n.virtualization,
          arch: n.arch,
          cpu_cores: n.cpu_cores,
          os: n.os,
          kernel_version: n.kernel_version,
          gpu_name: n.gpu_name,
          region: n.region,
          mem_total: n.mem_total,
          swap_total: n.swap_total,
          disk_total: n.disk_total,
          version: n.version ?? "",
          weight: n.weight ?? 0,
          price: n.price ?? 0,
          tags: n.tags ?? "",
          billing_cycle: n.billing_cycle ?? 0,
          currency: n.currency ?? "",
          group: n.group ?? "",
          traffic_limit: n.traffic_limit ?? 0,
          traffic_limit_type: n.traffic_limit_type,
          expired_at: n.expired_at ?? "",
          created_at: n.created_at ?? "",
          updated_at: n.updated_at ?? "",
        }));
        setNodeList(list);
      })
      .catch(async (err: any) => {
        console.warn("RPC2 获取节点列表失败，回退 REST:", err?.message || err);
        try {
          await fallbackFetch();
        } catch (restErr: any) {
          setError(
            restErr?.message ||
              err?.message ||
              "An error occurred while fetching data"
          );
          setNodeList([]);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  React.useEffect(() => {
    refresh();
  }, []);
  return (
    <NodeListContext.Provider value={{ nodeList, isLoading, error, refresh }}>
      {children}
    </NodeListContext.Provider>
  );
};

export const useNodeList = () => {
  const context = React.useContext(NodeListContext);
  if (!context) {
    throw new Error("useNodeList must be used within a NodeListProvider");
  }
  return context;
};
