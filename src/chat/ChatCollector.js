const EventEmitter = require('events');
const { log } = require('../utils/logger');
const LiveKitCollector = require('./LiveKitCollector');
const BrowserCollector = require('./BrowserCollector');

class ChatCollector extends EventEmitter {
    constructor() {
        super();
        this.tokenMint = process.env.TOKEN_MINT;
        this.collector = null;
        this.userWeights = new Map(); // Store temporary user vote weights
        // N64 Pokemon Stadium 2 command regex - matches all valid N64 commands
        this.commandRegex = /^!(up|down|left|right|a|b|start|z|l|r|cup|cdown|cleft|cright|cu|cd|cl|cr|dpadup|dpaddown|dpadleft|dpadright|du|dd|dl|dr|release|hold[a-z]+(?:\s+\d+)?|(?:up|down|left|right)\d{1,3})$/i;
        this.isConnected = false;
        
        // Choose collector based on available credentials
        this.useWebBrowser = !process.env.LIVEKIT_URL || !process.env.LIVEKIT_TOKEN;
        
        log(`Chat collector initialized for token: ${this.tokenMint}`, 'CHAT');
    }
    
    /**
     * Connect to Pump.fun chat
     */
    async connect() {
        try {
            if (this.useWebBrowser) {
                log('Using browser-based chat collection (fallback mode)', 'CHAT');
                this.collector = new BrowserCollector(this.tokenMint);
            } else {
                log('Using LiveKit chat collection', 'CHAT');
                this.collector = new LiveKitCollector();
            }
            
            // Forward events from collector
            this.collector.on('message', (message, user) => {
                this.processMessage(message, user);
            });
            
            // Forward command events directly (for browser-based commands)
            this.collector.on('command', (command, user, weight = 1) => {
                this.emit('command', command, user, weight);
            });
            
            this.collector.on('connected', () => {
                this.isConnected = true;
                log('Connected to Pump.fun chat', 'CHAT');
                this.emit('connected');
            });
            
            this.collector.on('disconnected', () => {
                this.isConnected = false;
                log('Disconnected from Pump.fun chat', 'CHAT');
                this.emit('disconnected');
            });
            
            this.collector.on('error', (error) => {
                log(`Chat collector error: ${error.message}`, 'ERROR');
                this.emit('error', error);
            });
            
            await this.collector.connect();
            
        } catch (error) {
            log(`Failed to connect to chat: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Disconnect from chat
     */
    async disconnect() {
        if (this.collector) {
            await this.collector.disconnect();
            this.collector = null;
        }
        this.isConnected = false;
        this.userWeights.clear();
        log('Chat collector disconnected', 'CHAT');
    }
    
    /**
     * Process incoming chat message
     * @param {string} message - The chat message
     * @param {string} user - Username who sent the message
     */
    processMessage(message, user) {
        if (!message || !user) return;
        
        const trimmedMessage = message.trim();
        const match = trimmedMessage.match(this.commandRegex);
        
        if (match) {
            const command = match[1].toLowerCase();
            const weight = this.getUserWeight(user);
            
            log(`Command: ${command} from ${user} (weight: ${weight})`, 'CHAT');
            this.emit('command', command, user, weight);
        }
        
        // Also emit all messages for potential future features
        this.emit('message', message, user);
    }
    
    /**
     * Get the vote weight for a user
     * @param {string} user - Username
     * @returns {number} Vote weight (1 by default, higher for token holders)
     */
    getUserWeight(user) {
        const userWeight = this.userWeights.get(user);
        
        if (userWeight && userWeight.expires > Date.now()) {
            return userWeight.weight;
        }
        
        // Clean up expired weight
        if (userWeight) {
            this.userWeights.delete(user);
        }
        
        return 1; // Default weight
    }
    
    /**
     * Set temporary increased vote weight for a user (e.g., after token purchase)
     * @param {string} user - Username
     * @param {number} weight - Vote weight multiplier
     * @param {number} durationMs - How long the weight boost lasts (milliseconds)
     */
    setUserWeight(user, weight, durationMs = 60000) {
        const expires = Date.now() + durationMs;
        this.userWeights.set(user, { weight, expires });
        
        log(`Set user ${user} weight to ${weight} for ${durationMs/1000}s`, 'CHAT');
        
        // Clean up expired weights periodically
        setTimeout(() => {
            const userWeight = this.userWeights.get(user);
            if (userWeight && userWeight.expires <= Date.now()) {
                this.userWeights.delete(user);
            }
        }, durationMs + 1000);
    }
    
    /**
     * Get current connection status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            connected: this.isConnected,
            collector: this.useWebBrowser ? 'browser' : 'livekit',
            tokenMint: this.tokenMint,
            activeUserWeights: this.userWeights.size
        };
    }
    
    /**
     * Send a message to chat (if supported by collector)
     * @param {string} message - Message to send
     */
    async sendMessage(message) {
        if (this.collector && typeof this.collector.sendMessage === 'function') {
            try {
                await this.collector.sendMessage(message);
                log(`Sent message: ${message}`, 'CHAT');
            } catch (error) {
                log(`Failed to send message: ${error.message}`, 'ERROR');
            }
        } else {
            log('Message sending not supported by current collector', 'CHAT');
        }
    }
    
    /**
     * Get chat statistics
     * @returns {Object} Chat stats
     */
    getStats() {
        const activeWeights = Array.from(this.userWeights.values())
            .filter(w => w.expires > Date.now());
            
        return {
            connected: this.isConnected,
            activeUserBoosts: activeWeights.length,
            averageBoostWeight: activeWeights.length > 0 
                ? activeWeights.reduce((sum, w) => sum + w.weight, 0) / activeWeights.length
                : 1
        };
    }
}

module.exports = ChatCollector;