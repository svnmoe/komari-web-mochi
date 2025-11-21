import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { RPC2Client } from "../lib/rpc2";
import type { RPC2ConnectionStateType } from "../types/rpc2";

interface RPC2ContextType {
  client: RPC2Client;
  connectionState: RPC2ConnectionStateType;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const RPC2Context = createContext<RPC2ContextType | undefined>(undefined);

// 模块级单例，避免在开发环境 StrictMode 或路由切换时产生多个连接
let __rpc2_singleton__: RPC2Client | null = null;
let __rpc2_refcount = 0;

export const RPC2Provider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [client] = useState(() => {
    if (!__rpc2_singleton__) {
      __rpc2_singleton__ = new RPC2Client("/api/rpc2", { autoConnect: true });
    }
    return __rpc2_singleton__;
  });
  const [connectionState, setConnectionState] = useState(client.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    __rpc2_refcount++;
    client.setEventListeners({
      onConnect: () => {
        setConnectionState(client.state);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionState(client.state);
      },
      onError: (err) => {
        setError(err.message);
        setConnectionState(client.state);
      },
      onReconnecting: () => {
        setConnectionState(client.state);
      },
      onMessage: (data) => {
        console.debug("RPC2 消息:", data);
      },
    });

    return () => {
      __rpc2_refcount = Math.max(0, __rpc2_refcount - 1);
      if (__rpc2_refcount === 0) {
        client.disconnect();
      }
    };
  }, [client]);

  // 页面加载即尝试建立 RPC2 WS，减少首次调用等待
  useEffect(() => {
    if (client.state === "disconnected") {
      client.connect().catch(() => {
        // 连接失败时静默，后续调用仍会按回退逻辑处理
      });
    }
  }, [client]);

  const connect = async () => {
    try {
      setError(null);
      await client.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接失败");
      throw err;
    }
  };

  const disconnect = () => {
    client.disconnect();
  };

  const isConnected = connectionState === "connected";

  return (
    <RPC2Context.Provider
      value={{
        client,
        connectionState,
        isConnected,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </RPC2Context.Provider>
  );
};

export const useRPC2 = (): RPC2ContextType => {
  const context = useContext(RPC2Context);
  if (context === undefined) {
    throw new Error("useRPC2 必须在 RPC2Provider 内使用");
  }
  return context;
};

export const useRPC2Call = () => {
  const { client, isConnected } = useRPC2();

  const call = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any
    ): Promise<TResult> => client.call(method, params, options),
    [client]
  );

  const callViaWebSocket = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any
    ): Promise<TResult> => client.callViaWebSocket(method, params, options),
    [client]
  );

  const callViaHTTP = useCallback(
    <TParams = any, TResult = any>(
      method: string,
      params?: TParams,
      options?: any
    ): Promise<TResult> => client.callViaHTTP(method, params, options),
    [client]
  );

  const batchCall = useCallback(
    (requests: Array<{ method: string; params?: any; notification?: boolean }>) =>
      client.batchCall(requests),
    [client]
  );

  return {
    call,
    callViaWebSocket,
    callViaHTTP,
    batchCall,
    isConnected,
  };
};
