import React, { createContext, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";

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

  // 注册刷新回调函数
  const onRefresh = (callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
  };

  // 当数据更新时通知所有回调函数
  const notifyRefreshCallbacks = (data: LiveDataResponse) => {
    refreshCallbacks.forEach(callback => callback(data));
  };

  // WebSocket connection effect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: number;

    const connect = () => {
      ws = new WebSocket(
        window.location.protocol.replace("http", "ws") +
        "//" +
        window.location.host +
        "/api/clients"
      );
      ws.onopen = () => {
        // 连接成功时，隐藏 Callout
        setShowCallout(true);
        ws?.send("get");
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
          // 当收到新数据时，通知所有已注册的回调函数
          notifyRefreshCallbacks(data);
        } catch (e) {
          console.error(e);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        // 断开连接时，显示 Callout
        setShowCallout(false);
        reconnectTimeout = window.setTimeout(connect, 2000);
      };
    };

    connect();

    const interval = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("get");
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  return (
    <LiveDataContext.Provider value={{ live_data, showCallout, onRefresh }}>
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);

export default LiveDataContext;
