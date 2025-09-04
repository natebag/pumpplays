const EventEmitter = require('events');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const { log } = require('../utils/logger');

class OverlayManager extends EventEmitter {
    constructor() {
        super();
        this.app = express();
        this.server = null;
        this.io = null;
        this.port = process.env.OVERLAY_PORT || 3001;
        
        this.state = {
            votes: {},
            lastMove: null,
            recentTrades: [],
            isVoting: false,
            timeRemaining: 0,
            stats: {
                totalMoves: 0,
                totalVotes: 0,
                popularCommands: {}
            }
        };
        
        this.setupRoutes();
        log('Overlay manager initialized', 'OVERLAY');
    }
    
    /**
     * Set up Express routes for overlay
     */
    setupRoutes() {
        // Serve static overlay files
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // API endpoint for current state
        this.app.get('/api/state', (req, res) => {
            res.json(this.state);
        });
        
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: Date.now(),
                uptime: process.uptime()
            });
        });
    }
    
    /**
     * Start the overlay server
     */
    start() {
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        // Handle WebSocket connections
        this.io.on('connection', (socket) => {
            log('Overlay client connected', 'OVERLAY');
            
            // Send current state to new client
            socket.emit('stateUpdate', this.state);
            
            socket.on('disconnect', () => {
                log('Overlay client disconnected', 'OVERLAY');
            });
        });
        
        this.server.listen(this.port, () => {
            log(`Overlay server running on http://localhost:${this.port}`, 'OVERLAY');
        }).on('error', (err) => {
            log(`Failed to start overlay server: ${err.message}`, 'ERROR');
            if (err.code === 'EADDRINUSE') {
                log(`Port ${this.port} is already in use`, 'ERROR');
            }
        });
    }
    
    /**
     * Stop the overlay server
     */
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        if (this.io) {
            this.io.close();
            this.io = null;
        }
        log('Overlay server stopped', 'OVERLAY');
    }
    
    /**
     * Update voting display
     * @param {Object} votes - Current vote tallies
     */
    updateVotes(votes) {
        this.state.votes = votes.votes || {};
        this.state.isVoting = votes.isActive || false;
        this.state.timeRemaining = votes.timeRemaining || 0;
        
        this.broadcastUpdate();
    }
    
    /**
     * Add a command to be displayed in real-time
     * @param {string} command - The command (e.g., "up", "a", "start")
     * @param {string} user - Username who sent the command
     * @param {number} weight - Vote weight of the command
     */
    addCommand(command, user, weight = 1) {
        // Emit individual command event to overlay for real-time display
        this.io.emit('commandReceived', {
            command: command,
            user: user,
            weight: weight,
            timestamp: Date.now()
        });
        
        log(`📨 Command sent to overlay: ${command} from ${user} (weight: ${weight})`, 'OVERLAY');
    }
    
    /**
     * Update last move display
     * @param {string} move - The winning move
     * @param {Object} results - Vote results
     */
    updateLastMove(move, results) {
        const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);
        
        this.state.lastMove = {
            command: move,
            timestamp: Date.now(),
            votes: results[move] || 0,
            totalVotes: totalVotes,
            results: results
        };
        
        // Update stats
        this.state.stats.totalMoves++;
        this.state.stats.totalVotes += totalVotes;
        this.state.stats.popularCommands[move] = (this.state.stats.popularCommands[move] || 0) + 1;
        
        log(`Stats updated: ${this.state.stats.totalMoves} moves, ${this.state.stats.totalVotes} votes`, 'OVERLAY');
        this.broadcastUpdate();
        log(`Updated overlay with move: ${move}`, 'OVERLAY');
    }
    
    /**
     * Trigger visual effect for token trades
     * @param {Object} tradeData - Trade information
     */
    triggerTradeEffect(tradeData) {
        // Add to recent trades (keep last 5)
        this.state.recentTrades.unshift({
            type: tradeData.is_buy ? 'buy' : 'sell',
            amount: tradeData.sol_amount,
            user: tradeData.user,
            timestamp: Date.now()
        });
        
        if (this.state.recentTrades.length > 5) {
            this.state.recentTrades = this.state.recentTrades.slice(0, 5);
        }
        
        // Emit special trade effect event
        this.io?.emit('tradeEffect', {
            type: tradeData.is_buy ? 'buy' : 'sell',
            amount: tradeData.sol_amount,
            user: tradeData.user
        });
        
        this.broadcastUpdate();
        log(`Trade effect triggered: ${tradeData.is_buy ? 'BUY' : 'SELL'} ${tradeData.sol_amount} SOL`, 'OVERLAY');
    }
    
    /**
     * Broadcast state update to all connected clients
     */
    broadcastUpdate() {
        if (this.io) {
            this.io.emit('stateUpdate', this.state);
        }
    }
    
    /**
     * Get current overlay state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Update overlay configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.theme) {
            this.io?.emit('themeUpdate', config.theme);
        }
        
        if (config.layout) {
            this.io?.emit('layoutUpdate', config.layout);
        }
        
        log('Overlay configuration updated', 'OVERLAY');
    }
    
    /**
     * Send custom animation/effect
     * @param {string} effectType - Type of effect
     * @param {Object} data - Effect data
     */
    triggerCustomEffect(effectType, data) {
        this.io?.emit('customEffect', { type: effectType, data });
        log(`Custom effect triggered: ${effectType}`, 'OVERLAY');
    }
    
    /**
     * Add chat message to overlay
     * @param {Object} messageData - Chat message data
     */
    addChatMessage(messageData) {
        if (this.io) {
            this.io.emit('chatMessage', messageData);
        }
        log(`Chat: ${messageData.user}: ${messageData.message}`, 'OVERLAY');
    }
    
    /**
     * Get overlay statistics
     * @returns {Object} Overlay stats
     */
    getOverlayStats() {
        const connectedClients = this.io ? this.io.engine.clientsCount : 0;
        
        return {
            connectedClients,
            port: this.port,
            uptime: process.uptime(),
            state: {
                isVoting: this.state.isVoting,
                lastMoveAge: this.state.lastMove ? Date.now() - this.state.lastMove.timestamp : null,
                recentTradesCount: this.state.recentTrades.length
            }
        };
    }
}

module.exports = OverlayManager;