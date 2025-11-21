import React, { createContext, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";
import { useRPC2Call } from "./RPC2Context";
import { LiveDataBridge } from "../lib/liveDataBridge";

// 创建Context
interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  showCallout: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => void;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  showCallout: true,
  onRefresh: () => {},
});

// 创建Provider组件
export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [showCallout, setShowCallout] = useState(false);
  const [refreshCallbacks] = useState<Set<(data: LiveDataResponse) => void>>(new Set());
  const { call } = useRPC2Call();

  // 注册刷新回调函数
  const onRefresh = (callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
  };

  // 当数据更新时通知所有回调函数
  const notifyRefreshCallbacks = (data: LiveDataResponse) => {
    refreshCallbacks.forEach(callback => callback(data));
  };

  // 优先 RPC2，失败回退 WS 的数据桥
  useEffect(() => {
    const bridge = new LiveDataBridge(
      call,
      (live) => {
        setLiveData(live);
        notifyRefreshCallbacks(live);
      },
      (connected) => {
        setShowCallout(connected);
      }
    );

    bridge.start();

    return () => {
      bridge.stop();
    };
  }, [call]);

  return (
    <LiveDataContext.Provider value={{ live_data, showCallout, onRefresh }}>
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);

export default LiveDataContext;
