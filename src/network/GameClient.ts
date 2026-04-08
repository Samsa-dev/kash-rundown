type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

type MessageHandler = (msg: ServerMessage) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private url: string;
  public connected = false;
  public offline = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      // If no URL or empty, go offline immediately
      if (!this.url || this.url === 'ws://:3001' || this.url === 'wss://:3001') {
        console.log('[GameClient] No server URL, going offline');
        this.offline = true;
        resolve();
        return;
      }

      let resolved = false;
      const done = (online: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        this.offline = !online;
        this.connected = online;
        console.log(`[GameClient] ${online ? 'Connected' : 'Offline mode'}`);
        resolve();
      };

      const timeout = setTimeout(() => done(false), 3000);

      try {
        this.ws = new WebSocket(this.url);
      } catch {
        done(false);
        return;
      }

      this.ws.onopen = () => {
        done(true);
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
        // If we already resolved as online and then disconnected, don't go offline
        // Just log it — the game keeps running with last state
        if (!this.offline && resolved) {
          console.log('[GameClient] Disconnected');
        } else {
          done(false);
        }
      };

      this.ws.onerror = () => {
        done(false);
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
    this.ws?.close();
    this.ws = null;
  }
}
