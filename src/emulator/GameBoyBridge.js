const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

/**
 * Bridge between the voting system and the Game Boy controller
 * Sends winning vote commands to the Game Boy Lua scripts
 */
class GameBoyBridge {
    constructor(gameboyPath = 'F:\\coding\\automated gameboyu') {
        this.gameboyPath = gameboyPath;
        this.commandsFile = path.join(gameboyPath, 'commands.txt');
        this.isConnected = false;
        
        // Map vote commands to Game Boy commands
        this.commandMap = {
            // Basic directions
            'up': '!up',
            'down': '!down', 
            'left': '!left',
            'right': '!right',
            
            // Buttons
            'a': '!a',
            'b': '!b',
            'start': '!start',
            'select': '!select',
            
            // Aliases
            'enter': '!start',
            
            // Hold commands - convert to basic presses for Game Boy
            'holdup': '!up',
            'holddown': '!down',
            'holdleft': '!left', 
            'holdright': '!right',
            'holda': '!a',
            'holdb': '!b',
            
            // Release commands
            'release': '!release_all'
        };
    }
    
    /**
     * Initialize the bridge and verify Game Boy controller path
     */
    async connect() {
        try {
            // Check if the Game Boy directory exists
            if (!fs.existsSync(this.gameboyPath)) {
                throw new Error(`Game Boy path does not exist: ${this.gameboyPath}`);
            }
            
            // Check if the lua script exists
            const luaScript = path.join(this.gameboyPath, 'gameboy_controller_with_tcp.lua');
            if (!fs.existsSync(luaScript)) {
                throw new Error(`Game Boy controller script not found: ${luaScript}`);
            }
            
            this.isConnected = true;
            log('Game Boy Bridge connected successfully', 'GAMEBOY');
            log(`Commands will be written to: ${this.commandsFile}`, 'GAMEBOY');
            
        } catch (error) {
            log(`Failed to connect Game Boy Bridge: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Send a command to the Game Boy controller
     * @param {string} command - The vote command to execute
     * @param {Object} parsedCommand - Optional parsed command data with timing
     * @returns {boolean} True if command was sent successfully
     */
    sendCommand(command, parsedCommand = null) {
        if (!this.isConnected) {
            log('Game Boy Bridge not connected', 'ERROR');
            return false;
        }
        
        // Normalize command
        const normalizedCommand = command.toLowerCase().trim();
        
        // Check if this is a hold command with custom timing
        if (parsedCommand && parsedCommand.type === 'hold') {
            const baseKey = parsedCommand.mappedKey || this.commandMap[parsedCommand.key];
            if (baseKey) {
                const holdDuration = Math.min(5000, Math.max(100, parsedCommand.ms || 500)); // Limit 100ms-5000ms
                const gameBoyCom = `!hold${parsedCommand.key}${holdDuration}`;
                
                try {
                    fs.appendFileSync(this.commandsFile, gameBoyCom + '\n');
                    log(`Sent hold command to Game Boy: ${gameBoyCom} (${holdDuration}ms)`, 'GAMEBOY');
                    return true;
                } catch (error) {
                    log(`Failed to send hold command: ${error.message}`, 'ERROR');
                    return false;
                }
            }
        }
        
        // Map to Game Boy command (regular commands)
        const gameBoyCom = this.commandMap[normalizedCommand];
        if (!gameBoyCom) {
            log(`Unknown command for Game Boy: ${command}`, 'GAMEBOY');
            return false;
        }
        
        try {
            // Append command to the commands.txt file
            fs.appendFileSync(this.commandsFile, gameBoyCom + '\n');
            log(`Sent to Game Boy: ${gameBoyCom} (from vote: ${command})`, 'GAMEBOY');
            return true;
            
        } catch (error) {
            log(`Failed to send Game Boy command: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    /**
     * Handle vote completion from the main voting system
     * @param {string} winningMove - The winning command from votes
     * @param {Object} voteResults - Vote tally results
     * @param {Object} parsedCommand - Optional parsed command data with timing/type info
     */
    handleVoteComplete(winningMove, voteResults, parsedCommand = null) {
        const totalVotes = Object.values(voteResults).reduce((a, b) => a + b, 0);
        log(`Vote completed: ${winningMove} won with ${voteResults[winningMove] || 0}/${totalVotes} votes`, 'GAMEBOY');
        
        const success = this.sendCommand(winningMove, parsedCommand);
        if (success) {
            log(`Successfully executed Game Boy command for: ${winningMove}`, 'GAMEBOY');
        } else {
            log(`Failed to execute Game Boy command for: ${winningMove}`, 'ERROR');
        }
    }
    
    /**
     * Send multiple commands in sequence (useful for combos)
     * @param {Array} commands - Array of commands to send
     * @param {number} delay - Delay between commands in ms
     */
    async sendSequence(commands, delay = 100) {
        for (const command of commands) {
            this.sendCommand(command);
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    /**
     * Clear the commands file (useful for cleanup)
     */
    clearCommands() {
        try {
            if (fs.existsSync(this.commandsFile)) {
                fs.writeFileSync(this.commandsFile, '');
                log('Cleared Game Boy commands file', 'GAMEBOY');
            }
        } catch (error) {
            log(`Failed to clear commands file: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Get current status of the bridge
     */
    getStatus() {
        return {
            connected: this.isConnected,
            gameboyPath: this.gameboyPath,
            commandsFile: this.commandsFile,
            supportedCommands: Object.keys(this.commandMap)
        };
    }
    
    /**
     * Take a screenshot of the current game state
     * @returns {Promise<string>} Path to the screenshot file
     */
    async takeScreenshot() {
        try {
            const screenshotPath = path.join(this.gameboyPath, 'party_screenshot.png');
            
            // Send screenshot command to emulator
            fs.appendFileSync(this.commandsFile, '!party_screenshot\n');
            log('Screenshot command sent to emulator', 'GAMEBOY');
            
            // Wait a moment for screenshot to be saved
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if screenshot file exists
            if (fs.existsSync(screenshotPath)) {
                log(`Screenshot captured: ${screenshotPath}`, 'GAMEBOY');
                return screenshotPath;
            } else {
                log('Screenshot file not found after capture attempt', 'GAMEBOY');
                return null;
            }
        } catch (error) {
            log(`Failed to take screenshot: ${error.message}`, 'ERROR');
            return null;
        }
    }
    
    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.isConnected = false;
        log('Game Boy Bridge disconnected', 'GAMEBOY');
    }
}

module.exports = GameBoyBridge;