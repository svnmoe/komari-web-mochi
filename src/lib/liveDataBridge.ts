import type { LiveDataResponse } from "../types/LiveData";

type RPC2Caller = <TParams = any, TResult = any>(
  method: string,
  params?: TParams
) => Promise<TResult>;

type Mode = "rpc" | "ws";

interface LiveDataBridgeOptions {
  rpcIntervalMs?: number;
  rpcFailureThreshold?: number;
  wsUrl?: string;
}

export class LiveDataBridge {
  private readonly call: RPC2Caller;
  private readonly options: Required<LiveDataBridgeOptions>;
  private readonly onData: (data: LiveDataResponse) => void;
  private readonly onStatus: (connected: boolean, mode: Mode) => void;

  private rpcTimer?: number;
  private rpcRunning = false;
  private rpcFailureCount = 0;

  private ws: WebSocket | null = null;
  private wsPingTimer?: number;
  private wsReconnectTimer?: number;

  private mode: Mode = "rpc";

  constructor(
    call: RPC2Caller,
    onData: (data: LiveDataResponse) => void,
    onStatus: (connected: boolean, mode: Mode) => void,
    options: LiveDataBridgeOptions = {}
  ) {
    this.call = call;
    this.onData = onData;
    this.onStatus = onStatus;
    this.options = {
      rpcIntervalMs: options.rpcIntervalMs ?? 2000,
      rpcFailureThreshold: options.rpcFailureThreshold ?? 3,
      wsUrl:
        options.wsUrl ??
        `${window.location.protocol.replace("http", "ws")}//${
          window.location.host
        }/api/clients`,
    };
  }

  start() {
    this.mode = "rpc";
    this.rpcFailureCount = 0;
    // 首次启动立即尝试获取一次 RPC 数据，避免必须等到下一个计时周期
    this.fetchRpcLatest().catch((e) => {
      // 错误在内部处理并会在后续调度中重试
      console.debug("LiveDataBridge: initial fetchRpcLatest failed:", e);
    });
    this.scheduleRpc();
  }

  stop() {
    if (this.rpcTimer) {
      window.clearTimeout(this.rpcTimer);
      this.rpcTimer = undefined;
    }
    this.rpcRunning = false;
    this.teardownWS();
  }

  private scheduleRpc() {
    if (this.mode !== "rpc") return;
    this.rpcTimer = window.setTimeout(
      () => this.fetchRpcLatest(),
      this.options.rpcIntervalMs
    );
  }

  private async fetchRpcLatest() {
    if (this.rpcRunning || this.mode !== "rpc") return;
    this.rpcRunning = true;
    try {
      const result: Record<string, any> = await this.call(
        "common:getNodesLatestStatus"
      );
      const live = this.fromRpc(result);
      this.rpcFailureCount = 0;
      this.onStatus(true, "rpc");
      this.onData(live);
    } catch (error) {
      console.error("RPC2 获取最新状态失败:", error);
      this.rpcFailureCount += 1;
      this.onStatus(false, "rpc");
      if (this.rpcFailureCount >= this.options.rpcFailureThreshold) {
        this.switchToWS();
        return;
      }
    } finally {
      this.rpcRunning = false;
      if (this.mode === "rpc") {
        this.scheduleRpc();
      }
    }
  }

  private switchToWS() {
    this.mode = "ws";
    if (this.rpcTimer) {
      window.clearTimeout(this.rpcTimer);
      this.rpcTimer = undefined;
    }
    this.startWS();
  }

  private startWS() {
    this.teardownWS();
    try {
      this.ws = new WebSocket(this.options.wsUrl);
    } catch (e) {
      console.error("创建 WebSocket 失败，重试中:", e);
      this.scheduleWsReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.onStatus(true, "ws");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveDataResponse;
        this.onData(data);
      } catch (e) {
        console.error("解析 WebSocket 数据失败:", e);
      }
    };

    this.ws.onerror = () => {
      this.onStatus(false, "ws");
      this.ws?.close();
    };

    this.ws.onclose = () => {
      this.onStatus(false, "ws");
      this.scheduleWsReconnect();
    };

    this.wsPingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send("get");
        } catch (e) {
          console.error("发送 WS 心跳失败:", e);
        }
      }
    }, this.options.rpcIntervalMs);
  }

  private scheduleWsReconnect() {
    if (this.wsReconnectTimer) return;
    this.wsReconnectTimer = window.setTimeout(() => {
      this.wsReconnectTimer = undefined;
      this.startWS();
    }, 2000);
  }

  private teardownWS() {
    if (this.wsPingTimer) {
      window.clearInterval(this.wsPingTimer);
      this.wsPingTimer = undefined;
    }
    if (this.wsReconnectTimer) {
      window.clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private fromRpc(result: Record<string, any>): LiveDataResponse {
    const online = Object.values(result)
      .filter((v: any) => v?.online)
      .map((v: any) => v.client as string);

    const dataMap: Record<string, any> = {};
    for (const [uuid, v] of Object.entries(result)) {
      const rec = v as any;
      dataMap[uuid] = {
        cpu: { usage: typeof rec.cpu === "number" ? rec.cpu : 0 },
        ram: { used: rec.ram ?? 0 },
        swap: { used: rec.swap ?? 0 },
        load: {
          load1: rec.load ?? 0,
          load5: rec.load5 ?? 0,
          load15: rec.load15 ?? 0,
        },
        disk: { used: rec.disk ?? 0 },
        network: {
          up: rec.net_out ?? 0,
          down: rec.net_in ?? 0,
          totalUp: rec.net_total_up ?? 0,
          totalDown: rec.net_total_down ?? 0,
        },
        connections: {
          tcp: rec.connections ?? 0,
          udp: rec.connections_udp ?? 0,
        },
        gpu:
          rec.gpu !== undefined
            ? { count: 0, average_usage: rec.gpu, detailed_info: [] }
            : undefined,
        uptime: rec.uptime ?? 0,
        process: rec.process ?? 0,
        message: "",
        updated_at: rec.time ?? new Date().toISOString(),
      };
    }

    return {
      data: {
        online,
        data: dataMap,
      },
      status: "ok",
    };
  }
}
