require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const ChatCollector = require('./chat/ChatCollector');
const WebSocketChatCollector = require('./chat/WebSocketChatCollector');
const VoteManager = require('./voting/VoteManager');
const EmulatorController = require('./emulator/EmulatorController');
const EmulatorControllerN64 = require('./emulator/EmulatorControllerN64');
const EmulatorControllerGBA = require('./emulator/EmulatorControllerGBA');
const CommandParser = require('./chat/CommandParser');
const TradeMonitor = require('./trading/TradeMonitor');
const PumpFunAPI = require('./trading/PumpFunAPI');
const OverlayManager = require('./overlay/OverlayManager');
const GameBoyBridge = require('./emulator/GameBoyBridge');
const LeaderboardManager = require('./stats/LeaderboardManager');
const PartyManager = require('./party/PartyManager');
const { log } = require('./utils/logger');

class PumpPlaysPokemon {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 8080;
        
        // Initialize components
        // Try WebSocket first, fall back to Puppeteer if needed
        const tokenMint = process.env.TOKEN_MINT || 'DxKwgDV2NZapgrpdvCHNdWcAByWuXvohKsdUAxcrpump';
        this.webSocketCollector = new WebSocketChatCollector(tokenMint);
        this.chatCollector = new ChatCollector();
        this.activeCollector = null; // Will be set based on what connects
        this.commandParser = new CommandParser();
        this.voteManager = new VoteManager();
        // Use GBA controller for Pokemon Emerald
        this.emulatorController = new EmulatorControllerGBA();
        this.tradeMonitor = new TradeMonitor();
        this.pumpFunAPI = new PumpFunAPI();
        this.overlayManager = new OverlayManager();
        this.gameBoyBridge = new GameBoyBridge();
        this.leaderboard = new LeaderboardManager();
        this.partyManager = new PartyManager(this.gameBoyBridge);
        
        // Track original parsed commands for hold functionality
        this.originalParsedCommands = new Map();
        
        this.isRunning = false;
        this.setupRoutes();
        this.setupEventHandlers();
    }
    
    setupRoutes() {
        this.app.use(express.static('src/overlay/public'));
        this.app.use('/leaderboard-page', express.static('website/leaderboard'));
        
        this.app.get('/status', (req, res) => {
            res.json({
                running: this.isRunning,
                currentVotes: this.voteManager.getCurrentVotes(),
                lastMove: this.voteManager.getLastMove(),
                uptime: process.uptime()
            });
        });
        
        this.app.get('/state', (req, res) => {
            res.json(this.overlayManager.getState());
        });
        
        // Leaderboard endpoints
        this.app.get('/leaderboard', (req, res) => {
            const limit = parseInt(req.query.limit) || 10;
            res.json({
                topUsers: this.leaderboard.getTopUsers(limit),
                generated: new Date().toISOString()
            });
        });

        // Detailed leaderboard API for the website
        this.app.get('/api/leaderboard', (req, res) => {
            try {
                const topUsers = this.leaderboard.getTopUsers(12);
                const totalStats = this.leaderboard.getTotalStats();
                const commandStats = this.leaderboard.getCommandStats();
                
                res.json({
                    totalUsers: topUsers.length,
                    totalVotes: totalStats.totalVotes || 0,
                    lastUpdated: new Date().toISOString(),
                    topUsers: topUsers,
                    commandStats: commandStats,
                    generated: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to generate leaderboard data' });
            }
        });
        
        this.app.get('/leaderboard/user/:username', (req, res) => {
            const username = req.params.username;
            const userStats = this.leaderboard.getUserStats(username);
            if (userStats) {
                res.json({ username, stats: userStats });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        });
        
        this.app.post('/leaderboard/report', (req, res) => {
            const reportFile = this.leaderboard.generateManualReport();
            if (reportFile) {
                res.json({ 
                    success: true, 
                    reportFile: reportFile,
                    message: 'CEO report generated successfully!' 
                });
            } else {
                res.status(500).json({ error: 'Failed to generate report' });
            }
        });
        
        // Party endpoints
        this.app.get('/party', (req, res) => {
            const partyData = this.partyManager.getCurrentParty();
            res.json(partyData);
        });
        
        this.app.post('/party/scan', async (req, res) => {
            try {
                const partyData = await this.partyManager.scanParty();
                res.json({ 
                    success: true, 
                    party: partyData,
                    scannedAt: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
        
        // Manual command endpoint for testing
        this.app.post('/command/:cmd', (req, res) => {
            const cmd = req.params.cmd;
            const user = req.query.user || 'manual_user';
            
            // Emit the command as if it came from chat
            this.chatCollector.emit('command', cmd, user, 1);
            
            res.json({ 
                success: true, 
                command: cmd, 
                user: user,
                message: `Command ${cmd} sent successfully!`
            });
        });
        
        // GET endpoint for browser testing
        this.app.get('/command/:cmd', (req, res) => {
            const cmd = req.params.cmd.replace('!', ''); // Remove ! if present
            const user = req.query.user || 'browser_user';
            
            // Emit the command as if it came from chat
            this.chatCollector.emit('command', cmd, user, 1);
            
            res.json({ 
                success: true, 
                command: cmd, 
                user: user,
                message: `Command ${cmd} sent successfully via GET!`
            });
        });
    }
    
    setupEventHandlers() {
        // Setup handlers for both collectors
        const setupCollectorHandlers = (collector, collectorName) => {
            collector.on('command', (rawCommand, user, baseWeight = 1) => {
                this.handleCommand(rawCommand, user, baseWeight, collectorName);
            });
            
            collector.on('message', (message, user) => {
                this.handleMessage(message, user, collectorName);
            });
            
            collector.on('connected', () => {
                log(`${collectorName} connected successfully`, 'APP');
            });
            
            collector.on('error', (error) => {
                log(`${collectorName} error: ${error.message}`, 'ERROR');
            });
        };
        
        setupCollectorHandlers(this.webSocketCollector, 'WebSocket');
        setupCollectorHandlers(this.chatCollector, 'Puppeteer');
        
        // Vote period ended - execute GBA command
        this.voteManager.on('voteComplete', (winningMove, voteResults, lastMoveData) => {
            log(`Move chosen: ${winningMove}`, 'VOTE');
            
            // Get the original parsed command for hold functionality
            const originalParsedCommand = this.originalParsedCommands.get(winningMove);
            
            // Send command to Game Boy controller via bridge with parsed command data
            this.gameBoyBridge.handleVoteComplete(winningMove, voteResults, originalParsedCommand);
            
            // Parse the winning command for execution (legacy GBA emulator)
            const parsedCommand = this.commandParser.parseCommand(`!${winningMove}`);
            if (parsedCommand) {
                // Execute the parsed command on the GBA emulator
                const success = this.emulatorController.executeCommand(parsedCommand);
                if (success) {
                    log(`Executed GBA command: ${winningMove}`, 'GBA');
                } else {
                    log(`Failed to execute command: ${winningMove}`, 'ERROR');
                }
            } else {
                log(`Could not parse winning command: ${winningMove}`, 'ERROR');
            }
            
            // Clean up the stored parsed command
            this.originalParsedCommands.delete(winningMove);
            
            // Pass the first voter data to overlay
            const firstVoter = lastMoveData ? lastMoveData.firstVoter : null;
            this.overlayManager.updateLastMove(winningMove, voteResults, firstVoter);
        });
        
        // Token trade detected (from both old TradeMonitor and new PumpFunAPI)
        this.tradeMonitor.on('trade', (tradeData) => {
            log(`Trade detected (PumpPortal): ${tradeData.sol_amount} SOL`, 'TRADE');
            this.overlayManager.triggerTradeEffect(tradeData);
            
            // Give trade participants extra vote weight for 60 seconds
            this.chatCollector.setUserWeight(tradeData.user, 2, 60000);
        });
        
        // Real pump.fun trades
        this.pumpFunAPI.on('trade', (tradeData) => {
            log(`Trade detected (pump.fun): ${tradeData.sol_amount} SOL`, 'PUMPFUN');
            this.overlayManager.triggerTradeEffect(tradeData);
            
            // Give trade participants extra vote weight for 60 seconds  
            this.chatCollector.setUserWeight(tradeData.user, 2, 60000);
        });
        
        // Emulator status
        this.emulatorController.on('status', (status) => {
            log(`Emulator: ${status}`, 'EMU');
        });
    }
    
    handleCommand(rawCommand, user, baseWeight = 1, source = 'Unknown') {
        // Chat message received - parse GBA commands
        log(`🎯 COMMAND RECEIVED IN APP.JS: ${rawCommand} from ${user} (via ${source})`, 'DEBUG');
        
        // Handle party command specially (disabled temporarily)
        if (rawCommand.toLowerCase() === 'party') {
            log(`Party command disabled temporarily - ignored from ${user}`, 'PARTY');
            return;
        }
        
        // Parse the command to handle GBA syntax (hold, etc.)
        const parsedCommand = this.commandParser.parseCommand(`!${rawCommand}`);
        
        if (parsedCommand) {
                // Calculate final vote weight using pump.fun API data
                const pumpfunWeight = this.pumpFunAPI.calculateVoteWeight(user);
                const finalWeight = Math.max(baseWeight, pumpfunWeight);
                
                // For voting, use the base command (e.g., "hold a" votes as "a")
                let voteCommand = rawCommand;
                if (parsedCommand.type === 'hold') {
                    voteCommand = parsedCommand.key;
                } else if (parsedCommand.type === 'momentum') {
                    voteCommand = parsedCommand.direction;
                }
                
                // Store the original parsed command for hold functionality
                this.originalParsedCommands.set(voteCommand, parsedCommand);
                
                log(`📊 ADDING VOTE: ${voteCommand} from ${user} (weight: ${finalWeight})`, 'DEBUG');
                this.voteManager.addVote(voteCommand, user, finalWeight);
                
                // Record command in leaderboard
                this.leaderboard.recordCommand(user, voteCommand, finalWeight);
                this.overlayManager.updateVotes(this.voteManager.getCurrentVotes());
                
                // Send individual command to overlay for real-time display
                this.overlayManager.addCommand(rawCommand, user, finalWeight);
                
                // Send command to chat overlay with weight indicator and command type
                let displayMessage = `!${rawCommand}`;
                if (parsedCommand.type === 'hold') {
                    displayMessage += ` (${parsedCommand.ms}ms)`;
                } else if (parsedCommand.type === 'momentum') {
                    displayMessage += ` (${parsedCommand.percentage}%)`;
                }
                if (finalWeight > 1) {
                    displayMessage += ` (${finalWeight}x)`;
                }
                
                this.overlayManager.addChatMessage({
                    user,
                    message: displayMessage,
                    isCommand: true,
                    isTrade: false
                });
            }
        }
    
    handleMessage(message, user, source = 'Unknown') {
        // All chat messages (including non-commands)
        this.overlayManager.addChatMessage({
            user,
            message,
            isCommand: /^[!\/](up|down|left|right|a|b|l|r|start|select|party)$/i.test(message),
            isTrade: false
        });
    }

    async handlePartyCommand(user) {
        try {
            log(`🎉 Party command triggered by ${user}`, 'PARTY');
            
            // Add chat message showing party command
            this.overlayManager.addChatMessage({
                user,
                message: '!party',
                isCommand: true,
                isTrade: false
            });
            
            // Trigger party scan
            const partyData = await this.partyManager.scanParty();
            
            // Update overlay with party data
            this.overlayManager.updateParty(partyData);
            
            log(`Party scan completed for ${user}: ${partyData.length} Pokemon found`, 'PARTY');
            
        } catch (error) {
            log(`Party command failed for ${user}: ${error.message}`, 'ERROR');
            
            // Add error message to chat
            this.overlayManager.addChatMessage({
                user: 'System',
                message: `Party scan failed: ${error.message}`,
                isCommand: false,
                isTrade: false
            });
        }
    }
    
    async start() {
        try {
            log('Starting Pump Plays Pokemon...', 'APP');
            
            // Start all services - try WebSocket first, but also start Puppeteer as backup
            try {
                await this.webSocketCollector.connect();
                this.activeCollector = 'WebSocket';
                log('WebSocket connected successfully', 'APP');
                log('Using WebSocket for chat collection', 'APP');
                
                // Also start Puppeteer as backup in case WebSocket doesn't receive messages
                try {
                    await this.chatCollector.connect();
                    log('Puppeteer also connected as backup', 'APP');
                } catch (puppeteerError) {
                    log(`Puppeteer backup failed: ${puppeteerError.message}`, 'APP');
                }
            } catch (wsError) {
                log(`WebSocket failed, falling back to Puppeteer: ${wsError.message}`, 'APP');
                await this.chatCollector.connect();
                this.activeCollector = 'Puppeteer';
            }
            await this.tradeMonitor.connect();
            await this.pumpFunAPI.connect(); // Connect to real pump.fun API
            await this.gameBoyBridge.connect(); // Connect to Game Boy controller
            this.voteManager.start();
            this.overlayManager.start();
            
            // Start web server
            this.app.listen(this.port, () => {
                log(`Server running on port ${this.port}`, 'APP');
            });
            
            this.isRunning = true;
            log('All systems online! Ready for Pokemon Emerald!', 'APP');
            
        } catch (error) {
            log(`Failed to start: ${error.message}`, 'ERROR');
            process.exit(1);
        }
    }
    
    async stop() {
        log('Shutting down...', 'APP');
        
        this.isRunning = false;
        this.voteManager.stop();
        this.overlayManager.stop();
        
        await this.webSocketCollector.disconnect();
        await this.chatCollector.disconnect();
        await this.tradeMonitor.disconnect();
        await this.pumpFunAPI.disconnect();
        this.gameBoyBridge.disconnect();
        
        log('Shutdown complete', 'APP');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    if (app) {
        await app.stop();
    }
    process.exit(0);
});

// Start the application
const app = new PumpPlaysPokemon();
app.start();