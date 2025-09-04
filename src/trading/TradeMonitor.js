const EventEmitter = require('events');
const WebSocket = require('ws');
const { log } = require('../utils/logger');

class TradeMonitor extends EventEmitter {
    constructor() {
        super();
        this.tokenMint = process.env.TOKEN_MINT;
        this.pumpPortalWs = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
        this.tradeCount = 0;
        this.lastTrades = [];
    }
    
    /**
     * Connect to PumpPortal WebSocket for trade monitoring
     */
    async connect() {
        try {
            log('Connecting to PumpPortal WebSocket...', 'TRADE');
            
            this.pumpPortalWs = new WebSocket(process.env.PUMPPORTAL_WS_URL || 'wss://pumpportal.fun/api/data');
            
            this.pumpPortalWs.on('open', () => {
                log('Connected to PumpPortal', 'TRADE');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Subscribe to token trades
                this.subscribeToTokenTrades();
                this.emit('connected');
            });
            
            this.pumpPortalWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleTradeMessage(message);
                } catch (error) {
                    log(`Error parsing trade message: ${error.message}`, 'ERROR');
                }
            });
            
            this.pumpPortalWs.on('close', () => {
                log('PumpPortal connection closed', 'TRADE');
                this.isConnected = false;
                this.emit('disconnected');
                
                // Attempt reconnection
                this.attemptReconnect();
            });
            
            this.pumpPortalWs.on('error', (error) => {
                log(`PumpPortal WebSocket error: ${error.message}`, 'ERROR');
                this.emit('error', error);
            });
            
        } catch (error) {
            log(`Failed to connect to PumpPortal: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Subscribe to trades for our specific token
     */
    subscribeToTokenTrades() {
        if (!this.pumpPortalWs || this.pumpPortalWs.readyState !== WebSocket.OPEN) {
            log('WebSocket not ready for subscription', 'TRADE');
            return;
        }
        
        const subscribeMessage = {
            method: 'subscribeTokenTrade',
            keys: [this.tokenMint]
        };
        
        this.pumpPortalWs.send(JSON.stringify(subscribeMessage));
        log(`Subscribed to trades for token: ${this.tokenMint}`, 'TRADE');
    }
    
    /**
     * Handle incoming trade message from PumpPortal
     * @param {Object} message - Trade data from WebSocket
     */
    handleTradeMessage(message) {
        if (!message || message.mint !== this.tokenMint) {
            return;
        }
        
        const tradeData = {
            mint: message.mint,
            sol_amount: parseFloat(message.sol_amount || 0),
            token_amount: parseFloat(message.token_amount || 0),
            is_buy: message.is_buy,
            user: message.user || 'anonymous',
            signature: message.signature,
            timestamp: Date.now(),
            price_impact: message.price_impact || 0
        };
        
        // Store recent trades (keep last 50)
        this.lastTrades.unshift(tradeData);
        if (this.lastTrades.length > 50) {
            this.lastTrades = this.lastTrades.slice(0, 50);
        }
        
        this.tradeCount++;
        
        const action = tradeData.is_buy ? 'BUY' : 'SELL';
        const solAmount = tradeData.sol_amount.toFixed(4);
        
        log(`${action}: ${solAmount} SOL by ${tradeData.user}`, 'TRADE');
        
        // Emit trade event
        this.emit('trade', tradeData);
        
        // For buys, also emit special buy event (for vote weight boosts)
        if (tradeData.is_buy && tradeData.sol_amount > 0.01) { // Minimum 0.01 SOL for vote boost
            this.emit('buyEvent', tradeData);
        }
    }
    
    /**
     * Attempt to reconnect to PumpPortal
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log('Max reconnection attempts reached', 'ERROR');
            return;
        }
        
        this.reconnectAttempts++;
        log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s`, 'TRADE');
        
        setTimeout(() => {
            this.connect().catch(error => {
                log(`Reconnection attempt failed: ${error.message}`, 'ERROR');
            });
        }, this.reconnectDelay);
    }
    
    /**
     * Disconnect from PumpPortal
     */
    async disconnect() {
        if (this.pumpPortalWs) {
            this.pumpPortalWs.close();
            this.pumpPortalWs = null;
        }
        this.isConnected = false;
        this.reconnectAttempts = 0;
        log('Trade monitor disconnected', 'TRADE');
    }
    
    /**
     * Get recent trading activity
     * @returns {Array} Array of recent trades
     */
    getRecentTrades() {
        return [...this.lastTrades];
    }
    
    /**
     * Get trading statistics
     * @returns {Object} Trading stats
     */
    getStats() {
        const recentBuys = this.lastTrades.filter(t => t.is_buy);
        const recentSells = this.lastTrades.filter(t => !t.is_buy);
        
        const totalBuyVolume = recentBuys.reduce((sum, t) => sum + t.sol_amount, 0);
        const totalSellVolume = recentSells.reduce((sum, t) => sum + t.sol_amount, 0);
        
        return {
            connected: this.isConnected,
            totalTrades: this.tradeCount,
            recentTrades: this.lastTrades.length,
            recentBuys: recentBuys.length,
            recentSells: recentSells.length,
            buyVolume: Math.round(totalBuyVolume * 10000) / 10000,
            sellVolume: Math.round(totalSellVolume * 10000) / 10000,
            netVolume: Math.round((totalBuyVolume - totalSellVolume) * 10000) / 10000
        };
    }
    
    /**
     * Check if a user has made recent trades (for vote weight calculation)
     * @param {string} user - User to check
     * @param {number} timeWindowMs - Time window to check (default 5 minutes)
     * @returns {Object|null} Recent trade info or null
     */
    getUserRecentTrade(user, timeWindowMs = 300000) {
        const cutoff = Date.now() - timeWindowMs;
        
        const recentTrade = this.lastTrades.find(trade => 
            trade.user === user && 
            trade.timestamp > cutoff &&
            trade.is_buy // Only count buys for vote weight
        );
        
        return recentTrade || null;
    }
    
    /**
     * Calculate vote weight based on recent trading activity
     * @param {string} user - User to check
     * @returns {number} Vote weight multiplier
     */
    calculateVoteWeight(user) {
        const recentTrade = this.getUserRecentTrade(user);
        
        if (!recentTrade) return 1;
        
        // Scale vote weight based on SOL amount
        if (recentTrade.sol_amount >= 1.0) return 5;      // 1+ SOL = 5x weight
        if (recentTrade.sol_amount >= 0.5) return 3;      // 0.5+ SOL = 3x weight
        if (recentTrade.sol_amount >= 0.1) return 2;      // 0.1+ SOL = 2x weight
        
        return 1.5; // Any buy = 1.5x weight
    }
}

module.exports = TradeMonitor;