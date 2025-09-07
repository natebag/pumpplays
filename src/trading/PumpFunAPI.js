const EventEmitter = require('events');
const https = require('https');
const { log } = require('../utils/logger');

class PumpFunAPI extends EventEmitter {
    constructor() {
        super();
        this.baseUrl = 'https://pump.fun';
        this.apiUrl = 'https://pump.fun/api';
        this.cookies = this.getCookiesFromEnv();
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.tokenMint = process.env.TOKEN_MINT;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 10000; // 10 seconds
        this.pollInterval = 5000; // 5 seconds between API calls
        this.pollTimer = null;
        
        // Cache for rate limiting
        this.lastTokenData = null;
        this.lastTradeData = [];
        this.lastUpdate = 0;
    }
    
    /**
     * Get cookies from environment variables
     * @returns {string} Cookie string for requests
     */
    getCookiesFromEnv() {
        // Using the cookies you provided
        return [
            '__cf_bm=LRt1T0kOUnz8PJUYAOlG0kYf2DcYWvN9ZhJN.8W4-1756943695-1.0.1.1-ZflxixrJ0Co2ZAMC9v4OhqY2Nzq7ZeY_nCWpOKJl.Gms.PpY5n1gJQvNdqQOK0BE6g.Ova6tUtwZmNG4.jBVb3hZLFsahe_OFQbrb.TzZ614amz9C.AEzVWmizWzwC.4',
            '_cfuvid=vAIs5Vhc7YxoonuC7dpNLC7Bh604-1756934694362-0.0.1.1-604800000',
            'vid=fGoVt03ALn6iBHaV85P9SZRcyzrsdqMbyyZZV2uocvI56934691932-0.0.1.1-604800000',
            'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiSERlazJhb1g0NW1jbW9TdXZiWFVnSDI1c2YyRGtUZTR5cVh6RVN0bVpmUnAiLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTc1NjkzNDkxOSwiZXhwIjoxNzU5NTI2OTE5fQ.aChJ6Ib3UGUEzBp_C6FcztzjwLfR0PoG2E78N0--sPo',
            'cf_clearance=ByzN6LtkNE8WzyvemiH4tVTK1ccQ0iTR9OO6tzKmbfc-1756942895-1.2.1.1-PfElB8UshpKSDWSBxlBOSJeNGo2r1YlbM9h.vE5LRswXW_wbS.kgeTzyQV0ThBcoOLHRVjqEwMYhKnxqJar5Q3eWoFYSbFQzRgFYvPQ11k62LYMyxmhw6Nm8U3Gd967vqmWhQG1CmGUdLSn8hX_o0Npc.Wazoombr1Dl2D.dvG66_T1wSQACxF0QnO8ZFHRorskdLFb45pXiqEDvVfnIpz3c8Hpinr6bvK4LmAr3ODA'
        ].join('; ');
    }
    
    /**
     * Make authenticated request to pump.fun API using Node.js built-in https
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            const url = endpoint.startsWith('http') ? new URL(endpoint) : new URL(`${this.apiUrl}${endpoint}`);
            
            const requestOptions = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cookie': this.cookies,
                    'Referer': 'https://pump.fun/',
                    'Origin': 'https://pump.fun',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    ...options.headers
                }
            };
            
            const req = https.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                            return;
                        }
                        
                        const contentType = res.headers['content-type'];
                        if (contentType && contentType.includes('application/json')) {
                            resolve(JSON.parse(data));
                        } else {
                            resolve(data);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', (error) => {
                log(`API request failed: ${error.message}`, 'ERROR');
                reject(error);
            });
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }
    
    /**
     * Connect and start polling pump.fun API
     */
    async connect() {
        try {
            log('Connecting to pump.fun API...', 'PUMPFUN');
            
            // Test connection with a basic request
            await this.getTokenInfo(this.tokenMint);
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            
            // Start polling for updates
            this.startPolling();
            
            log('Connected to pump.fun API', 'PUMPFUN');
            
        } catch (error) {
            log(`Failed to connect to pump.fun API: ${error.message}`, 'ERROR');
            this.attemptReconnect();
        }
    }
    
    /**
     * Start polling for token updates
     */
    startPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        
        this.pollTimer = setInterval(async () => {
            try {
                await this.pollTokenData();
            } catch (error) {
                log(`Polling error: ${error.message}`, 'ERROR');
                this.attemptReconnect();
            }
        }, this.pollInterval);
        
        log(`Started polling pump.fun API every ${this.pollInterval/1000}s`, 'PUMPFUN');
    }
    
    /**
     * Poll for token data updates
     */
    async pollTokenData() {
        if (!this.tokenMint) {
            log('No token mint specified, skipping poll', 'PUMPFUN');
            return;
        }
        
        try {
            // Get current token info
            const tokenInfo = await this.getTokenInfo(this.tokenMint);
            
            // Get recent trades
            const trades = await this.getTokenTrades(this.tokenMint, 10);
            
            // Check for new trades since last update
            if (trades && trades.length > 0) {
                const newTrades = this.getNewTrades(trades);
                
                for (const trade of newTrades) {
                    this.handleNewTrade(trade);
                }
                
                this.lastTradeData = trades;
            }
            
            // Update token info if changed
            if (tokenInfo && JSON.stringify(tokenInfo) !== JSON.stringify(this.lastTokenData)) {
                this.lastTokenData = tokenInfo;
                this.emit('tokenUpdate', tokenInfo);
            }
            
            this.lastUpdate = Date.now();
            
        } catch (error) {
            log(`Error polling token data: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Get token information
     * @param {string} mint - Token mint address
     * @returns {Promise<Object>} Token info
     */
    async getTokenInfo(mint) {
        try {
            const data = await this.makeRequest(`/coins/${mint}`);
            return data;
        } catch (error) {
            log(`Error fetching token info: ${error.message}`, 'ERROR');
            return null;
        }
    }
    
    /**
     * Get recent trades for a token
     * @param {string} mint - Token mint address  
     * @param {number} limit - Number of trades to fetch
     * @returns {Promise<Array>} Recent trades
     */
    async getTokenTrades(mint, limit = 20) {
        try {
            const data = await this.makeRequest(`/trades/${mint}?limit=${limit}`);
            return data || [];
        } catch (error) {
            log(`Error fetching token trades: ${error.message}`, 'ERROR');
            return [];
        }
    }
    
    /**
     * Get new trades since last check
     * @param {Array} currentTrades - Current trades from API
     * @returns {Array} New trades
     */
    getNewTrades(currentTrades) {
        if (!this.lastTradeData || this.lastTradeData.length === 0) {
            return currentTrades.slice(0, 5); // First 5 trades on startup
        }
        
        const lastTradeId = this.lastTradeData[0]?.signature || this.lastTradeData[0]?.id;
        if (!lastTradeId) return currentTrades.slice(0, 5);
        
        const newTrades = [];
        for (const trade of currentTrades) {
            const tradeId = trade.signature || trade.id;
            if (tradeId === lastTradeId) break;
            newTrades.push(trade);
        }
        
        return newTrades;
    }
    
    /**
     * Handle new trade detection
     * @param {Object} trade - Trade data from API
     */
    handleNewTrade(trade) {
        // Normalize trade data to match existing format
        const tradeData = {
            mint: trade.mint || this.tokenMint,
            sol_amount: parseFloat(trade.sol_amount || trade.amount || 0),
            token_amount: parseFloat(trade.token_amount || 0),
            is_buy: trade.is_buy || trade.type === 'buy',
            user: trade.user || trade.trader || 'anonymous',
            signature: trade.signature || trade.id,
            timestamp: Date.now(),
            price_impact: trade.price_impact || 0
        };
        
        const action = tradeData.is_buy ? 'BUY' : 'SELL';
        const solAmount = tradeData.sol_amount.toFixed(4);
        
        log(`${action}: ${solAmount} SOL by ${tradeData.user}`, 'PUMPFUN');
        
        // Emit trade event
        this.emit('trade', tradeData);
        
        // For buys, also emit special buy event (for vote weight boosts)
        if (tradeData.is_buy && tradeData.sol_amount > 0.01) {
            this.emit('buyEvent', tradeData);
        }
    }
    
    /**
     * Attempt to reconnect to pump.fun API
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log('Max reconnection attempts reached for pump.fun API', 'ERROR');
            this.isConnected = false;
            this.emit('error', new Error('Max reconnection attempts reached'));
            return;
        }
        
        this.isConnected = false;
        this.reconnectAttempts++;
        
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        
        log(`Attempting pump.fun API reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s`, 'PUMPFUN');
        
        setTimeout(() => {
            this.connect().catch(error => {
                log(`Pump.fun API reconnection attempt failed: ${error.message}`, 'ERROR');
            });
        }, this.reconnectDelay);
    }
    
    /**
     * Disconnect from pump.fun API
     */
    async disconnect() {
        this.isConnected = false;
        this.reconnectAttempts = 0;
        
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        
        log('Pump.fun API disconnected', 'PUMPFUN');
        this.emit('disconnected');
    }
    
    /**
     * Get recent trading activity
     * @returns {Array} Array of recent trades
     */
    getRecentTrades() {
        return [...(this.lastTradeData || [])];
    }
    
    /**
     * Get current token stats
     * @returns {Object} Token statistics
     */
    getTokenStats() {
        if (!this.lastTokenData) {
            return {
                connected: this.isConnected,
                price: 0,
                volume: 0,
                marketCap: 0,
                lastUpdate: this.lastUpdate
            };
        }
        
        return {
            connected: this.isConnected,
            mint: this.tokenMint,
            name: this.lastTokenData.name,
            symbol: this.lastTokenData.symbol,
            price: this.lastTokenData.usd_market_cap || 0,
            volume: this.lastTokenData.volume || 0,
            marketCap: this.lastTokenData.market_cap || 0,
            lastUpdate: this.lastUpdate,
            recentTrades: this.lastTradeData.length
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
        
        const recentTrade = this.lastTradeData.find(trade => 
            (trade.user === user || trade.trader === user) && 
            (trade.timestamp || Date.now()) > cutoff &&
            (trade.is_buy || trade.type === 'buy') // Only count buys for vote weight
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
        
        const solAmount = parseFloat(recentTrade.sol_amount || recentTrade.amount || 0);
        
        // Scale vote weight based on SOL amount
        if (solAmount >= 1.0) return 5;      // 1+ SOL = 5x weight
        if (solAmount >= 0.5) return 3;      // 0.5+ SOL = 3x weight  
        if (solAmount >= 0.1) return 2;      // 0.1+ SOL = 2x weight
        
        return 1.5; // Any buy = 1.5x weight
    }
}

module.exports = PumpFunAPI;