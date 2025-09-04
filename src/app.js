require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const ChatCollector = require('./chat/ChatCollector');
const VoteManager = require('./voting/VoteManager');
const EmulatorController = require('./emulator/EmulatorController');
const EmulatorControllerN64 = require('./emulator/EmulatorControllerN64');
const EmulatorControllerGBA = require('./emulator/EmulatorControllerGBA');
const CommandParser = require('./chat/CommandParser');
const TradeMonitor = require('./trading/TradeMonitor');
const PumpFunAPI = require('./trading/PumpFunAPI');
const OverlayManager = require('./overlay/OverlayManager');
const GameBoyBridge = require('./emulator/GameBoyBridge');
const { log } = require('./utils/logger');

class PumpPlaysPokemon {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 4444;
        
        // Initialize components
        this.chatCollector = new ChatCollector();
        this.commandParser = new CommandParser();
        this.voteManager = new VoteManager();
        // Use GBA controller for Pokemon Emerald
        this.emulatorController = new EmulatorControllerGBA();
        this.tradeMonitor = new TradeMonitor();
        this.pumpFunAPI = new PumpFunAPI();
        this.overlayManager = new OverlayManager();
        this.gameBoyBridge = new GameBoyBridge();
        
        this.isRunning = false;
        this.setupRoutes();
        this.setupEventHandlers();
    }
    
    setupRoutes() {
        this.app.use(express.static('src/overlay/public'));
        
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
        // Chat message received - parse GBA commands
        this.chatCollector.on('command', (rawCommand, user, baseWeight = 1) => {
            log(`🎯 COMMAND RECEIVED IN APP.JS: ${rawCommand} from ${user}`, 'DEBUG');
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
                
                log(`📊 ADDING VOTE: ${voteCommand} from ${user} (weight: ${finalWeight})`, 'DEBUG');
                this.voteManager.addVote(voteCommand, user, finalWeight);
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
        });
        
        // All chat messages (including non-commands)
        this.chatCollector.on('message', (message, user) => {
            this.overlayManager.addChatMessage({
                user,
                message,
                isCommand: /^!(up|down|left|right|a|b|l|r|start|select)$/i.test(message),
                isTrade: false
            });
        });
        
        // Vote period ended - execute GBA command
        this.voteManager.on('voteComplete', (winningMove, voteResults) => {
            log(`Move chosen: ${winningMove}`, 'VOTE');
            
            // Send command to Game Boy controller via bridge
            this.gameBoyBridge.handleVoteComplete(winningMove, voteResults);
            
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
            
            this.overlayManager.updateLastMove(winningMove, voteResults);
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
    
    async start() {
        try {
            log('Starting Pump Plays Pokemon...', 'APP');
            
            // Start all services
            await this.chatCollector.connect();
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