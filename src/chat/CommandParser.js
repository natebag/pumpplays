const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

class CommandParser {
    constructor() {
        this.loadConfig();
    }
    
    loadConfig() {
        try {
            const configPath = path.join(__dirname, '../../config/controls.gba.json');
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            log('Loaded GBA controls configuration', 'PARSER');
        } catch (error) {
            log(`Failed to load controls config: ${error.message}`, 'ERROR');
            // Fallback config
            this.config = {
                analog: { "up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT" },
                buttons: { "a": "X", "b": "Z", "l": "A", "r": "S", "start": "ENTER", "select": "BACKSPACE" },
                aliases: {},
                holdDefaultsMs: 500,
                momentumConfig: { "25": 100, "50": 200, "75": 300, "100": 400 }
            };
        }
    }
    
    /**
     * Parse a chat command into an executable command
     * @param {string} message - The chat message
     * @returns {Object|null} Parsed command or null if invalid
     */
    parseCommand(message) {
        if (!message || typeof message !== 'string') return null;
        
        const msg = message.trim().toLowerCase();
        
        // Must start with !
        if (!msg.startsWith('!')) return null;
        
        const command = msg.substring(1);
        
        // Release all held keys
        if (command === 'release') {
            return { type: 'releaseAll' };
        }
        
        // Hold commands: !holda 800 or !holdleft (uses default ms)
        const holdMatch = command.match(/^hold([a-z]+)(?:\s+(\d+))?$/);
        if (holdMatch) {
            const key = holdMatch[1];
            const ms = holdMatch[2] ? parseInt(holdMatch[2]) : this.config.holdDefaultsMs;
            
            if (this.isValidKey(key)) {
                return { 
                    type: 'hold', 
                    key: key, 
                    ms: ms,
                    mappedKey: this.resolveKey(key)
                };
            }
        }
        
        // Momentum/analog commands: !up25, !left100
        const momentumMatch = command.match(/^(up|down|left|right)(\d{1,3})$/);
        if (momentumMatch) {
            const direction = momentumMatch[1];
            const percentage = Math.min(100, Math.max(1, parseInt(momentumMatch[2])));
            
            return {
                type: 'momentum',
                direction: direction,
                percentage: percentage,
                duration: this.getMomentumDuration(percentage),
                mappedKey: this.resolveKey(direction)
            };
        }
        
        // Regular button press
        if (this.isValidKey(command)) {
            return {
                type: 'press',
                key: command,
                mappedKey: this.resolveKey(command)
            };
        }
        
        return null;
    }
    
    /**
     * Check if a key is valid (including aliases)
     * @param {string} key - The key to check
     * @returns {boolean}
     */
    isValidKey(key) {
        // Check if it's a direct key
        if (this.config.analog[key] || this.config.buttons[key]) return true;
        
        // Check if it's an alias
        if (this.config.aliases[key]) return true;
        
        return false;
    }
    
    /**
     * Resolve a key through aliases and get the mapped keyboard key
     * @param {string} key - The key to resolve
     * @returns {string|null} The keyboard key to press
     */
    resolveKey(key) {
        // Resolve alias first
        let resolvedKey = key;
        if (this.config.aliases[key]) {
            resolvedKey = this.config.aliases[key];
        }
        
        // Get mapped keyboard key
        if (this.config.analog[resolvedKey]) {
            return this.config.analog[resolvedKey];
        }
        
        if (this.config.buttons[resolvedKey]) {
            return this.config.buttons[resolvedKey];
        }
        
        return null;
    }
    
    /**
     * Get duration for momentum command based on percentage
     * @param {number} percentage - Momentum percentage (1-100)
     * @returns {number} Duration in milliseconds
     */
    getMomentumDuration(percentage) {
        const config = this.config.momentumConfig;
        
        // Find closest configured percentage
        const percentages = Object.keys(config).map(p => parseInt(p)).sort((a, b) => a - b);
        
        for (let i = 0; i < percentages.length; i++) {
            if (percentage <= percentages[i]) {
                return config[percentages[i]];
            }
        }
        
        // If higher than all configured, use the highest
        return config[percentages[percentages.length - 1]];
    }
    
    /**
     * Get all valid commands for display/help
     * @returns {Object} Commands organized by type
     */
    getValidCommands() {
        const commands = {
            primary: [],
            advanced: [],
            special: ['release'],
            examples: {
                hold: ['!holda', '!holdb 1000', '!holdleft 500'],
                momentum: ['!up25', '!left50', '!right100']
            }
        };
        
        // Add primary commands
        if (this.config.primary) {
            commands.primary = this.config.primary;
        }
        
        // Add advanced commands
        if (this.config.advanced) {
            commands.advanced = this.config.advanced;
        }
        
        // Add all aliases
        commands.aliases = this.config.aliases;
        
        return commands;
    }
    
    /**
     * Get command statistics for the overlay
     * @returns {Object} Command stats
     */
    getCommandStats() {
        const totalButtons = Object.keys(this.config.buttons).length;
        const totalAnalog = Object.keys(this.config.analog).length;
        const totalAliases = Object.keys(this.config.aliases).length;
        
        return {
            totalCommands: totalButtons + totalAnalog,
            aliases: totalAliases,
            holdDefault: this.config.holdDefaultsMs,
            momentumLevels: Object.keys(this.config.momentumConfig).length
        };
    }
}

module.exports = CommandParser;