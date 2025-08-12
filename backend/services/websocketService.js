const WebSocket = require('ws');

class WebSocketService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  initialize() {
    if (this.socket) {
      return;
    }

    this.socket = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

    this.socket.on('open', () => {
      console.log('WebSocket connected to Finnhub');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Resubscribe to all symbols after reconnection
      for (const symbol of this.subscribers.keys()) {
        this.subscribe(symbol);
      }
    });

    this.socket.on('message', (data) => {
      try {
        const parsedData = JSON.parse(data);
        if (parsedData.type === 'trade') {
          const { s: symbol, p: price, t: timestamp } = parsedData.data[0];
          const callbacks = this.subscribers.get(symbol) || [];
          callbacks.forEach(callback => callback({ symbol, price, timestamp }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    this.socket.on('close', () => {
      console.log('WebSocket connection closed');
      this.isConnected = false;
      this.attemptReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.attemptReconnect();
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.initialize(), 5000 * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  subscribe(symbol, callback) {
    if (!this.isConnected) {
      this.initialize();
    }

    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
      if (this.isConnected) {
        this.socket.send(JSON.stringify({ type: 'subscribe', symbol }));
      }
    }

    const callbacks = this.subscribers.get(symbol);
    if (callback && !callbacks.includes(callback)) {
      callbacks.push(callback);
    }
  }

  unsubscribe(symbol, callback) {
    if (!this.subscribers.has(symbol)) {
      return;
    }

    if (callback) {
      const callbacks = this.subscribers.get(symbol);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }

      if (callbacks.length === 0) {
        this.subscribers.delete(symbol);
        if (this.isConnected) {
          this.socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        }
      }
    } else {
      this.subscribers.delete(symbol);
      if (this.isConnected) {
        this.socket.send(JSON.stringify({ type: 'unsubscribe', symbol }));
      }
    }
  }

  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.subscribers.clear();
    }
  }
}

module.exports = new WebSocketService(); 