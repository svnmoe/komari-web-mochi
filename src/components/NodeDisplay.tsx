import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Flex,
  Text,
  IconButton,
  TextField,
  SegmentedControl,
  Button,
} from "@radix-ui/themes";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "../types/LiveData";
import { NodeGrid } from "./Node";
import NodeTable from "./NodeTable";
import { isRegionMatch } from "@/utils/regionHelper";
import "./NodeDisplay.css";
import { ModernCard } from "./NodeModernCard";
import NodeCompactCard from "./NodeCompactCard";
import TaskDisplay from "./TaskDisplay";
import NodeEarthView from "./NodeEarthView";
import ViewModeSelector from "./ViewModeSelector";
import ModernGridVirtual from "./ModernGridVirtual";
import { usePublicInfo } from "@/contexts/PublicInfoContext";

export type ViewMode = "modern" | "compact" | "classic" | "detailed" | "task" | "earth";

const VIEW_MODES: ViewMode[] = [
  "modern",
  "compact",
  "classic",
  "detailed",
  "task",
  "earth",
];

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const parsePositiveNumber = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

const parseBooleanSetting = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

interface NodeDisplayProps {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  forceShowTrafficText?: boolean;
}

const NodeDisplay: React.FC<NodeDisplayProps> = ({ nodes, liveData, forceShowTrafficText }) => {
  const [t] = useTranslation();
  const isMobile = useIsMobile();
  const { publicInfo } = usePublicInfo();
  const paginationEnabled = parseBooleanSetting(
    publicInfo?.theme_settings?.enablePagination,
    true
  );
  const maxPageSize = 200;
  const pageSize = useMemo(() => {
    const parsed = parsePositiveNumber(
      publicInfo?.theme_settings?.paginationPageSize
    );
    const fallback = 24;
    const candidate = parsed ?? fallback;
    return clampNumber(candidate, 1, maxPageSize);
  }, [publicInfo]);
  // 获取配置的默认视图模式，并转换为小写
  const configDefaultMode = publicInfo?.theme_settings?.defaultViewMode?.toLowerCase() as ViewMode | undefined;
  const defaultMode: ViewMode = configDefaultMode && 
    ["modern", "compact", "classic", "detailed", "task", "earth"].includes(configDefaultMode) 
    ? configDefaultMode : "modern";
  
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "nodeViewMode",
    defaultMode
  );
  const safeViewMode = VIEW_MODES.includes(viewMode) ? viewMode : "modern";
  const enableVirtualScroll = publicInfo?.theme_settings?.enableVirtualScroll ?? true;

  // 组件初始化优化
  useEffect(() => {
    if (!VIEW_MODES.includes(viewMode)) {
      setViewMode("modern");
    }
  }, [viewMode, setViewMode]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useLocalStorage<string>(
    "nodeSelectedGroup",
    "all"
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const [pageIndexMap, setPageIndexMap] = useState<Record<ViewMode, number>>(() =>
    VIEW_MODES.reduce((acc, mode) => {
      acc[mode] = 1;
      return acc;
    }, {} as Record<ViewMode, number>)
  );

  useEffect(() => {
    setPageIndexMap((prev) => {
      if (prev[safeViewMode] !== undefined) return prev;
      return { ...prev, [safeViewMode]: 1 };
    });
  }, [safeViewMode]);

  const rawCurrentPage = pageIndexMap[safeViewMode] ?? 1;

  // 检测是否为电脑端（>=860px）
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 860 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 860);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // 初始化

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 获取所有的分组
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.group && node.group.trim()) {
        groupSet.add(node.group);
      }
    });
    return Array.from(groupSet).sort();
  }, [nodes]);

  // 判断是否显示分组选择器
  const showGroupSelector = groups.length >= 1;

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 按 "/" 键聚焦搜索框
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // 按 Escape 键清空搜索
      if (e.key === "Escape" && searchTerm) {
        setSearchTerm("");
        searchRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let result = nodes;

    // 先按分组过滤
    if (selectedGroup !== "all") {
      result = result.filter((node) => node.group === selectedGroup);
    }

    // 再按搜索条件过滤
    if (!searchTerm.trim()) return result;

    const term = searchTerm.toLowerCase().trim();
    return result.filter((node) => {
      // 基本信息搜索
      const basicMatch =
        node.name.toLowerCase().includes(term) ||
        node.os.toLowerCase().includes(term) ||
        node.arch.toLowerCase().includes(term);

      // 地区搜索（支持emoji和地区名称）
      const regionMatch = isRegionMatch(node.region, term);

      // 价格搜索（如果输入数字）
      const priceMatch =
        !isNaN(Number(term)) && node.price.toString().includes(term);

      // 状态搜索
      const isOnline = liveData?.online?.includes(node.uuid) || false;
      const statusMatch =
        ((term === "online" || term === "在线") && isOnline) ||
        ((term === "offline" || term === "离线") && !isOnline);

      return basicMatch || regionMatch || priceMatch || statusMatch;
    });
  }, [nodes, searchTerm, liveData, selectedGroup]);

  // 稳定在线节点列表：使用排序后的字符串作为依赖，避免数组引用变化
  const onlineNodesKey = useMemo(() =>
    (liveData?.online || []).slice().sort().join(','),
    [liveData?.online]
  );

  // 全局排序节点（应用权重+离线节点位置设置）
  const sortedFilteredNodes = useMemo(() => {
    const onlineSet = new Set(liveData?.online || []);
    const offlineNodePosition = publicInfo?.theme_settings?.offlineNodePosition ?? "后面";

    return [...filteredNodes].sort((a, b) => {
      const aOnline = onlineSet.has(a.uuid);
      const bOnline = onlineSet.has(b.uuid);

      // 根据配置决定离线节点位置
      if (offlineNodePosition === "前面") {
        // 离线节点在前
        if (aOnline !== bOnline) return aOnline ? 1 : -1;
      } else if (offlineNodePosition === "原位置") {
        // 不区分在线状态，只按权重排序
        // 继续执行下面的权重排序
      } else {
        // 默认：离线节点在后（后面）
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
      }

      return a.weight - b.weight;
    });
  }, [filteredNodes, onlineNodesKey, publicInfo]);

  const totalFiltered = sortedFilteredNodes.length;
  const paginationApplies =
    paginationEnabled && safeViewMode !== "task" && safeViewMode !== "earth";

  const totalPages = paginationApplies
    ? totalFiltered > 0
      ? Math.max(1, Math.ceil(totalFiltered / pageSize))
      : 1
    : 1;
  const currentPage = paginationApplies
    ? clampNumber(rawCurrentPage, 1, totalPages)
    : 1;
  const [pageInput, setPageInput] = useState<string>(() => String(currentPage));

  const updatePage = useCallback(
    (nextPage: number) => {
      if (!paginationApplies) return;
      const target = clampNumber(nextPage, 1, totalPages);
      setPageIndexMap((prev) => {
        if ((prev[safeViewMode] ?? 1) === target) return prev;
        return { ...prev, [safeViewMode]: target };
      });
    },
    [paginationApplies, safeViewMode, totalPages]
  );

  useEffect(() => {
    if (!paginationApplies) return;
    if (rawCurrentPage !== currentPage) {
      setPageIndexMap((prev) => {
        if ((prev[safeViewMode] ?? 1) === currentPage) return prev;
        return { ...prev, [safeViewMode]: currentPage };
      });
    }
  }, [currentPage, paginationApplies, rawCurrentPage, safeViewMode]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!paginationApplies) return;
    setPageIndexMap((prev) => {
      if ((prev[safeViewMode] ?? 1) === 1) return prev;
      return { ...prev, [safeViewMode]: 1 };
    });
  }, [searchTerm, selectedGroup, paginationApplies, safeViewMode]);

  const hasNodes = totalFiltered > 0;
  const pageRangeStart = paginationApplies && hasNodes
    ? (currentPage - 1) * pageSize + 1
    : hasNodes
      ? 1
      : 0;
  const pageRangeEnd = paginationApplies && hasNodes
    ? Math.min(totalFiltered, pageRangeStart + pageSize - 1)
    : hasNodes
      ? totalFiltered
      : 0;

  const paginatedNodes = useMemo(() => {
    if (!paginationApplies) return sortedFilteredNodes;
    if (!hasNodes) return [];
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredNodes.slice(start, start + pageSize);
  }, [sortedFilteredNodes, paginationApplies, hasNodes, currentPage, pageSize]);

  const handlePageInputChange = useCallback((value: string) => {
    if (/^\d*$/.test(value)) {
      setPageInput(value);
    }
  }, []);

  const commitPageInput = useCallback(() => {
    if (!paginationApplies) {
      setPageInput(String(currentPage));
      return;
    }
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInput(String(currentPage));
      return;
    }
    updatePage(parsed);
  }, [paginationApplies, pageInput, currentPage, updatePage]);

  return (
    <div className="w-full">
      {/* 控制栏 */}
      <Flex
        direction={{ initial: "column", sm: "row" }}
        justify="between"
        align={{ initial: "stretch", sm: "center" }}
        gap="4"
        className="control-bar mb-2 p-4 rounded-lg"
      >
        {/* 搜索框 */}
        <Flex
          align="center"
          gap="2"
          className="flex-1 max-w-md relative"
          wrap="wrap"
        >
          <TextField.Root
            ref={searchRef}
            placeholder={t("search.placeholder", {
              defaultValue: "搜索节点名称、地区、系统...",
            })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-box flex-1 pr-8 min-w-32"
          >
            <TextField.Slot>
              <Search size={16} />
            </TextField.Slot>
          </TextField.Root>
          {searchTerm && (
            <IconButton
              variant="ghost"
              size="1"
              className="absolute right-2 h-6 w-6 search-clear-button"
              onClick={() => {
                setSearchTerm("");
                searchRef.current?.focus();
              }}
            >
              <X size={12} />
            </IconButton>
          )}
        </Flex>

        {/* 视图模式切换 */}
        <div className={isMobile ? "w-full" : ""}>
          <ViewModeSelector 
            currentMode={safeViewMode}
            onModeChange={setViewMode}
            isMobile={isMobile}
          />
        </div>
      </Flex>
      {/* 分组选择器 */}
      {showGroupSelector && (
        <Flex align="center" gap="2" className="mx-4 mb-2 -mt-2 overflow-x-auto scrollbar-thin">
          <label className="whitespace-nowrap text-md text-muted-foreground flex-shrink-0">
            {t("common.group", { defaultValue: "分组" })}
          </label>
          <SegmentedControl.Root
            value={selectedGroup}
            onValueChange={setSelectedGroup}
            size="1"
            className="flex-shrink-0"
          >
            <SegmentedControl.Item value="all">
              {t("common.all", { defaultValue: "所有" })}
            </SegmentedControl.Item>
            {groups.map((group) => (
              <SegmentedControl.Item key={group} value={group}>
                {group}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </Flex>
      )}
      {/* 搜索结果统计 */}
      <Flex justify="between" align="center" className="mx-4 mb-2">
        {searchTerm.trim() ? (
          <Text size="2" color="gray">
            {t("search.results", {
              count: filteredNodes.length,
              total:
                selectedGroup === "all"
                  ? nodes.length
                  : nodes.filter((n) => n.group === selectedGroup).length,
              defaultValue: `找到 ${filteredNodes.length} 个服务器，共 ${
                selectedGroup === "all"
                  ? nodes.length
                  : nodes.filter((n) => n.group === selectedGroup).length
              } 个`,
            })}
          </Text>
        ) : (
          <Text size="2" color="gray">
            {selectedGroup === "all"
              ? t("nodeCard.totalNodes", {
                  total: nodes.length,
                  online: liveData?.online?.length || 0,
                  defaultValue: `共 ${nodes.length} 个节点，${
                    liveData?.online?.length || 0
                  } 个在线`,
                })
              : t("nodeCard.groupNodes", {
                  group: selectedGroup,
                  total: filteredNodes.length,
                  online: filteredNodes.filter((n) =>
                    liveData?.online?.includes(n.uuid)
                  ).length,
                  defaultValue: `${selectedGroup} 分组：共 ${
                    filteredNodes.length
                  } 个节点，${
                    filteredNodes.filter((n) =>
                      liveData?.online?.includes(n.uuid)
                    ).length
                  } 个在线`,
                })}
          </Text>
        )}
      </Flex>
      {/* 节点显示区域 */}
      {filteredNodes.length === 0 ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          className="py-16 mx-4"
        >
          <Text size="4" color="gray" className="mb-2">
            {searchTerm.trim()
              ? t("search.no_results", { defaultValue: "未找到匹配的节点" })
              : t("nodes.empty", { defaultValue: "暂无节点数据" })}
          </Text>
          {searchTerm.trim() && (
            <Text size="2" color="gray">
              {t("search.try_different", {
                defaultValue: "尝试不同的搜索关键词",
              })}
            </Text>
          )}
        </Flex>
      ) : (
        <>
          {safeViewMode === "modern" && (
            // 移动端（<860px）不使用虚拟滚动，电脑端（>=860px）一律使用虚拟滚动
            (enableVirtualScroll && isDesktop) ? (
              <ModernGridVirtual nodes={paginatedNodes} liveData={liveData} forceShowTrafficText={forceShowTrafficText} />
            ) : (
              <ModernGrid nodes={paginatedNodes} liveData={liveData} forceShowTrafficText={forceShowTrafficText} />
            )
          )}
          {safeViewMode === "compact" && (
            <CompactList nodes={paginatedNodes} liveData={liveData} />
          )}
          {safeViewMode === "classic" && (
            <NodeGrid nodes={paginatedNodes} liveData={liveData} />
          )}
          {safeViewMode === "detailed" && (
            <NodeTable nodes={paginatedNodes} liveData={liveData} />
          )}
          {safeViewMode === "task" && (
            <TaskDisplay nodes={sortedFilteredNodes} liveData={liveData} />
          )}
          {safeViewMode === "earth" && (
            <NodeEarthView nodes={sortedFilteredNodes} liveData={liveData} />
          )}
        </>
      )}

      {paginationApplies && (
        <div className="pagination-container mx-4 mt-6 mb-4">
          <Flex 
            direction={{ initial: "column", sm: "row" }}
            justify="between"
            align={{ initial: "center", sm: "center" }}
            gap="4"
            className="pagination-wrapper"
          >
            {/* 左侧信息区 */}
            <Flex 
              direction="column" 
              gap="1"
              align={{ initial: "center", sm: "start" }}
              className="pagination-info"
            >
              <Text size="2" weight="medium" color="gray">
                {hasNodes
                  ? t("pagination.showing", {
                      start: pageRangeStart,
                      end: pageRangeEnd,
                      defaultValue: `显示第 ${pageRangeStart}-${pageRangeEnd} 项`
                    })
                  : t("pagination.empty", {
                      defaultValue: "当前没有可显示的节点"
                    })}
              </Text>
              <Text size="1" color="gray">
                {hasNodes && t("pagination.totalInfo", {
                  total: totalFiltered,
                  pageSize,
                  defaultValue: `共 ${totalFiltered} 项 · 每页 ${pageSize} 项`
                })}
              </Text>
            </Flex>
            
            {/* 右侧分页控件 */}
            <Flex align="center" gap="2" className="pagination-controls-wrapper">
              {/* 快速跳转首页 */}
              {currentPage > 2 && (
                <IconButton
                  variant="soft"
                  size="2"
                  radius="full"
                  className="pagination-quick-nav"
                  onClick={() => updatePage(1)}
                  aria-label={t("pagination.first", { defaultValue: "首页" })}
                >
                  <ChevronLeft size={14} />
                  <ChevronLeft size={14} style={{ marginLeft: "-8px" }} />
                </IconButton>
              )}
              
              {/* 上一页 */}
              <IconButton
                variant="soft"
                size="2"
                radius="full"
                className="pagination-nav-button"
                disabled={currentPage <= 1}
                onClick={() => updatePage(currentPage - 1)}
                aria-label={t("pagination.prev", { defaultValue: "上一页" })}
              >
                <ChevronLeft size={16} />
              </IconButton>
              
              {/* 页码显示区 */}
              <Flex align="center" gap="1" className="pagination-numbers">
                {/* 显示页码按钮 */}
                {(() => {
                  const pages: (number | string)[] = [];
                  const showEllipsis = totalPages > 7;
                  
                  if (!showEllipsis) {
                    // 总页数小于等于7，显示所有页码
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // 总页数大于7，智能显示
                    if (currentPage <= 4) {
                      // 当前页靠近开始
                      for (let i = 1; i <= 5; i++) pages.push(i);
                      pages.push('...');
                      pages.push(totalPages);
                    } else if (currentPage >= totalPages - 3) {
                      // 当前页靠近结束
                      pages.push(1);
                      pages.push('...');
                      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                    } else {
                      // 当前页在中间
                      pages.push(1);
                      pages.push('...');
                      pages.push(currentPage - 1);
                      pages.push(currentPage);
                      pages.push(currentPage + 1);
                      pages.push('...');
                      pages.push(totalPages);
                    }
                  }
                  
                  return pages.map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                          ···
                        </span>
                      );
                    }
                    const pageNum = page as number;
                    return (
                      <Button
                        key={`page-${pageNum}`}
                        variant={pageNum === currentPage ? "solid" : "ghost"}
                        size="1"
                        radius="full"
                        className={`pagination-number ${pageNum === currentPage ? 'active' : ''}`}
                        onClick={() => updatePage(pageNum)}
                        data-page={pageNum}
                      >
                        {pageNum}
                      </Button>
                    );
                  });
                })()}
              </Flex>
              
              {/* 下一页 */}
              <IconButton
                variant="soft"
                size="2"
                radius="full"
                className="pagination-nav-button"
                disabled={currentPage >= totalPages}
                onClick={() => updatePage(currentPage + 1)}
                aria-label={t("pagination.next", { defaultValue: "下一页" })}
              >
                <ChevronRight size={16} />
              </IconButton>
              
              {/* 快速跳转末页 */}
              {currentPage < totalPages - 1 && (
                <IconButton
                  variant="soft"
                  size="2"
                  radius="full"
                  className="pagination-quick-nav"
                  onClick={() => updatePage(totalPages)}
                  aria-label={t("pagination.last", { defaultValue: "末页" })}
                >
                  <ChevronRight size={14} />
                  <ChevronRight size={14} style={{ marginLeft: "-8px" }} />
                </IconButton>
              )}
              
              {/* 页码输入框 - 移动端隐藏 */}
              <div className="pagination-goto hidden sm:flex">
                <TextField.Root
                  value={pageInput}
                  onChange={(event) => handlePageInputChange(event.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitPageInput();
                    }
                  }}
                  disabled={!hasNodes}
                  size="1"
                  placeholder={String(currentPage)}
                  style={{ width: "4rem" }}
                  className="pagination-input"
                />
                <Text size="1" color="gray" className="ml-2">
                  / {totalPages}
                </Text>
              </div>
            </Flex>
          </Flex>
        </div>
      )}
    </div>
  );
};

export default NodeDisplay;

// Modern Grid View
type ModernGridProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  forceShowTrafficText?: boolean;
};

const ModernGrid: React.FC<ModernGridProps> = ({ nodes, liveData, forceShowTrafficText }) => {
  const onlineNodes = liveData?.online || [];

  // 节点已在父组件排序，直接使用
  return (
    <div
      className="modern-grid-container"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))",
        gap: "1rem",
        padding: "1rem",
        gridAutoRows: "min-content",
        alignItems: "start",
        contain: "layout style",
        willChange: "contents",
        overflowX: "hidden"
      }}
    >
        {nodes.map((node) => {
          const isOnline = onlineNodes.includes(node.uuid);
          const nodeData = liveData?.data?.[node.uuid];
          return (
            <div
              key={node.uuid}
              style={{
                contain: "layout style paint",
                willChange: "auto"
              }}
            >
              <ModernCard
                basic={node}
                live={nodeData}
                online={isOnline}
                forceShowTrafficText={forceShowTrafficText}
              />
            </div>
          );
        })}
    </div>
  );
};

// Compact List View
type CompactListProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
};

const CompactList: React.FC<CompactListProps> = ({ nodes, liveData }) => {
  const onlineNodes = liveData?.online || [];

  // 节点已在父组件排序，直接使用
  return (
    <Flex direction="column" gap="2" className="p-4">
      {nodes.map((node) => {
        const isOnline = onlineNodes.includes(node.uuid);
        const nodeData = liveData?.data?.[node.uuid];
        return (
          <NodeCompactCard
            key={node.uuid}
            basic={node}
            live={nodeData}
            online={isOnline}
          />
        );
      })}
    </Flex>
  );
};
