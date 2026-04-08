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

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
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
        console.log('[GameClient] Disconnected, reconnecting in 2s...');
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      };

      this.ws.onerror = (e) => {
        console.error('[GameClient] Error', e);
        reject(e);
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
