
/**
 * WebSocket service for audio streaming
 */

class WebSocketService {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private onMessageCallback: ((data: ArrayBuffer) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
        
        this.socket.binaryType = 'arraybuffer'; // For audio data
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          if (this.onConnectCallback) this.onConnectCallback();
          resolve();
        };
        
        this.socket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer && this.onMessageCallback) {
            this.onMessageCallback(event.data);
          }
        };
        
        this.socket.onclose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          if (this.onDisconnectCallback) this.onDisconnectCallback();
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket && this.isConnected) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch(() => {
          // Error handling is already done in connect()
        });
      }, delay);
    }
  }

  sendAudioData(audioData: Float32Array | ArrayBuffer): void {
    if (this.socket && this.isConnected) {
      // If it's a Float32Array, convert to ArrayBuffer before sending
      const dataToSend = audioData instanceof Float32Array 
        ? audioData.buffer 
        : audioData;
      
      this.socket.send(dataToSend);
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  onMessage(callback: (data: ArrayBuffer) => void): void {
    this.onMessageCallback = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }
}

export default WebSocketService;
