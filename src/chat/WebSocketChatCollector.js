const EventEmitter = require('events');
const WebSocket = require('ws');
const { log } = require('../utils/logger');

/**
 * Direct WebSocket connection to pump.fun live chat
 * Uses wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket
 */
class WebSocketChatCollector extends EventEmitter {
    constructor(tokenAddress = null) {
        super();
        this.tokenAddress = tokenAddress || process.env.TOKEN_CA || '7ATvZZo2mp4t5rv7gA3sQi3SJPnMjzJXSpzsVzKipump';
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.messageQueue = [];
        this.userWeights = new Map();
        this.lastActivity = Date.now();
        this.stats = {
            messagesReceived: 0,
            commandsReceived: 0,
            connectionTime: null,
            lastMessage: null
        };
    }

    async connect() {
        try {
            log(`Connecting to pump.fun WebSocket for token: ${this.tokenAddress}`, 'WS_CHAT');
            
            // Direct WebSocket connection with proper headers
            this.ws = new WebSocket('wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket', {
                headers: {
                    'Origin': 'https://pump.fun',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            this.ws.on('open', () => {
                log('WebSocket connected to pump.fun live chat', 'WS_CHAT');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.stats.connectionTime = Date.now();
                
                // Send initial handshake
                this.sendHandshake();
                
                // Start ping interval to keep connection alive
                this.startPingInterval();
                
                this.emit('connected');
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('close', (code, reason) => {
                log(`WebSocket closed: ${code} - ${reason}`, 'WS_CHAT');
                this.isConnected = false;
                this.cleanup();
                this.emit('disconnected');
                
                // Auto-reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            });

            this.ws.on('error', (error) => {
                log(`WebSocket error: ${error.message}`, 'ERROR');
                this.emit('error', error);
            });

            this.ws.on('ping', () => {
                this.ws.pong();
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
        } catch (error) {
            log(`Failed to connect to WebSocket: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    sendHandshake() {
        // Socket.IO handshake
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Send connection message
            this.ws.send('40');
            
            // Subscribe to token room
            setTimeout(() => {
                const subscribeMsg = `42["subscribe","token:${this.tokenAddress}"]`;
                this.ws.send(subscribeMsg);
                log(`Subscribed to token room: ${this.tokenAddress}`, 'WS_CHAT');
            }, 100);
        }
    }

    handleMessage(rawData) {
        try {
            this.lastActivity = Date.now();
            
            // Debug log all messages
            log(`Raw WebSocket message: ${rawData.substring(0, 100)}...`, 'WS_DEBUG');
            
            // Socket.IO protocol handling
            if (rawData.startsWith('0')) {
                // Connection acknowledgment
                log('Received connection acknowledgment', 'WS_CHAT');
                return;
            }
            
            if (rawData.startsWith('3')) {
                // Pong response
                return;
            }
            
            if (rawData.startsWith('42')) {
                // Socket.IO message event
                const jsonStr = rawData.slice(2);
                const data = JSON.parse(jsonStr);
                
                // Log the actual message structure to understand format
                log(`Socket.IO message type: ${data[0]}, data: ${JSON.stringify(data[1]).substring(0, 200)}`, 'WS_DEBUG');
                
                if (Array.isArray(data) && data[0] === 'message') {
                    this.processMessage(data[1]);
                } else if (Array.isArray(data) && data[0] === 'chat') {
                    this.processChatMessage(data[1]);
                } else if (Array.isArray(data) && data.length > 1) {
                    // Try processing any message with data
                    this.processMessage(data[1]);
                }
            }
            
            if (rawData.startsWith('40')) {
                // Connection established
                log('Socket.IO connection established', 'WS_CHAT');
            }
            
        } catch (error) {
            log(`Error handling message: ${error.message}`, 'ERROR');
        }
    }

    processMessage(messageData) {
        try {
            // Handle different message types from pump.fun
            if (messageData.type === 'chat' || messageData.message) {
                this.processChatMessage(messageData);
            }
        } catch (error) {
            log(`Error processing message: ${error.message}`, 'ERROR');
        }
    }

    processChatMessage(data) {
        try {
            const message = data.message || data.text || data.content;
            const user = data.username || data.user || data.from || 'anonymous';
            
            if (!message) return;
            
            this.stats.messagesReceived++;
            this.stats.lastMessage = Date.now();
            
            // Emit all messages
            this.emit('message', message, user);
            
            // Check if it's a command (starts with ! or /)
            if (message.match(/^[!\/]/)) {
                const command = message.substring(1).toLowerCase().trim();
                const validCommands = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select', 'l', 'r', 'party'];
                
                // Check for hold commands
                const holdMatch = command.match(/^hold\s*(.+?)(?:\s+(\d+))?$/);
                if (holdMatch) {
                    const key = holdMatch[1];
                    let duration = holdMatch[2] ? parseInt(holdMatch[2]) : 1500;
                    // Cap hold duration at 5000ms (5 seconds)
                    duration = Math.min(5000, Math.max(100, duration));
                    if (validCommands.includes(key)) {
                        const holdCommand = `hold${key}_${duration}`;
                        this.stats.commandsReceived++;
                        const weight = this.getUserWeight(user);
                        log(`📨 WS Command: ${holdCommand} from ${user} (weight: ${weight})`, 'WS_CHAT');
                        this.emit('command', holdCommand, user, weight);
                    }
                } else if (validCommands.includes(command)) {
                    this.stats.commandsReceived++;
                    const weight = this.getUserWeight(user);
                    log(`📨 WS Command: ${command} from ${user} (weight: ${weight})`, 'WS_CHAT');
                    this.emit('command', command, user, weight);
                }
            }
            
        } catch (error) {
            log(`Error processing chat message: ${error.message}`, 'ERROR');
        }
    }

    startPingInterval() {
        // Send ping every 25 seconds to keep connection alive
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('2'); // Socket.IO ping
            }
        }, 25000);
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);
        log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`, 'WS_CHAT');
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect().catch(error => {
                    log(`Reconnect failed: ${error.message}`, 'ERROR');
                });
            }
        }, delay);
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    async disconnect() {
        log('Disconnecting WebSocket...', 'WS_CHAT');
        this.cleanup();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.emit('disconnected');
    }

    setUserWeight(user, weight, duration = 60000) {
        this.userWeights.set(user, weight);
        setTimeout(() => {
            this.userWeights.delete(user);
        }, duration);
        log(`Set weight for ${user} to ${weight} for ${duration}ms`, 'WS_CHAT');
    }

    getUserWeight(user) {
        return this.userWeights.get(user) || 1;
    }

    getStats() {
        return {
            ...this.stats,
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            lastActivity: this.lastActivity,
            uptime: this.stats.connectionTime ? Date.now() - this.stats.connectionTime : 0
        };
    }

    // Test method to simulate commands
    simulateCommand(command, user = 'test_user') {
        if (this.isConnected) {
            this.emit('command', command, user, 1);
            log(`Simulated command: ${command} from ${user}`, 'WS_CHAT');
        }
    }
}

module.exports = WebSocketChatCollector;