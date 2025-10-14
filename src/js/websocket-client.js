class WebSocketClient {
    constructor(url) {
      this.url = url;
      this.socket = null;
    }
  
    sendMessage(message) {
      try {
        this.socket = new WebSocket(this.url);
  
        this.socket.onopen = () => {
          console.log('WebSocket接続を確立しました');
          this.socket.send(message);
          console.log(`メッセージを送信しました: ${message}`);
          this.close();
        };
  
        this.socket.onerror = (error) => {
          console.error('WebSocketエラー:', error);
          this.close();
        };
  
        setTimeout(() => {
          if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            console.warn('WebSocket接続がタイムアウトしました');
            this.close();
          }
        }, 5000);
      } catch (error) {
        console.error('WebSocket接続エラー:', error);
        this.close();
      }
    }
  
    close() {
      if (this.socket) {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.close();
        }
        this.socket = null;
      }
    }
  }
  
  const webSocketClient = new WebSocketClient('ws://localhost:8888');
  
  function sendReloadMessage() {
    webSocketClient.sendMessage('reload');
  }
  
  export { webSocketClient, sendReloadMessage };
  