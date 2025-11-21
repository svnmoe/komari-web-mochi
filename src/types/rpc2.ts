/**
 * JSON-RPC 2.0 类型定义与连接状态
 */

export interface JSONRPC2Request<T = any> {
  jsonrpc: "2.0";
  method: string;
  params?: T;
  id?: string | number | null;
}

export interface JSONRPC2SuccessResponse<T = any> {
  jsonrpc: "2.0";
  result: T;
  id: string | number | null;
}

export interface JSONRPC2Error {
  code: number;
  message: string;
  data?: any;
}

export interface JSONRPC2ErrorResponse {
  jsonrpc: "2.0";
  error: JSONRPC2Error;
  id: string | number | null;
}

export type JSONRPC2Response<T = any> =
  | JSONRPC2SuccessResponse<T>
  | JSONRPC2ErrorResponse;

export type JSONRPC2BatchRequest = JSONRPC2Request[];
export type JSONRPC2BatchResponse = JSONRPC2Response[];

export const JSONRPC2ErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type JSONRPC2ErrorCodeType =
  (typeof JSONRPC2ErrorCode)[keyof typeof JSONRPC2ErrorCode];

export const RPC2ConnectionState = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
} as const;

export type RPC2ConnectionStateType =
  (typeof RPC2ConnectionState)[keyof typeof RPC2ConnectionState];

export interface RPC2ConnectionOptions {
  autoConnect?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  requestTimeout?: number;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
  /** 是否允许在 WS 失败时自动回退 HTTP */
  enableHttpFallback?: boolean;
}

export interface RPC2CallOptions {
  timeout?: number;
  notification?: boolean;
}

export interface RPC2EventListeners {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: (attempt: number) => void;
  onMessage?: (data: any) => void;
}
