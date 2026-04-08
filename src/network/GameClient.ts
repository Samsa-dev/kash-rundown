type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

type MessageHandler = (msg: ServerMessage) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  public connected = false;
  public offline = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);
      } catch {
        console.log('[GameClient] WebSocket not available, going offline');
        this.offline = true;
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[GameClient] Connection timeout, going offline');
        this.offline = true;
        this.ws?.close();
        resolve();
      }, 3000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;
        this.offline = false;
        console.log('[GameClient] Connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          const handlers = this.handlers.get(msg.type);
          if (handlers) {
            for (const h of handlers) h(msg);
          }
        } catch (e) {
          console.error('[GameClient] Parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (!this.offline) {
          console.log('[GameClient] Disconnected, reconnecting in 2s...');
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        if (!this.connected) {
          console.log('[GameClient] Connection failed, going offline');
          this.offline = true;
          resolve();
        }
      };
    });
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  send(msg: { type: string; [key: string]: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  placeBet(amount: number): void {
    this.send({ type: 'placeBet', amount });
  }

  cashOut(): void {
    this.send({ type: 'cashOut' });
  }

  cancelBet(): void {
    this.send({ type: 'cancelBet' });
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
