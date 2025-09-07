const EventEmitter = require('events');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

class EmulatorControllerN64 extends EventEmitter {
    constructor() {
        super();
        this.windowTitle = process.env.EMULATOR_WINDOW_TITLE || 'Project64';
        this.emulatorPath = process.env.EMULATOR_PATH || 'F:\\coding\\PUMPPLAYSPOKEMON\\emulator\\N64\\Project64.exe';
        this.romPath = process.env.ROM_PATH || 'F:\\coding\\PUMPPLAYSPOKEMON\\ROM\\STADIUM\\Pokemon Stadium 2 (USA).z64';
        
        // Load controls configuration
        this.loadControlsConfig();
        
        // Track held keys for release functionality
        this.heldKeys = new Set();
        this.holdTimers = new Map();
        
        this.lastInput = null;
        this.inputCooldown = false;
        this.cooldownTime = 50; // Reduced for N64 responsiveness
        
        this.emit('status', 'initialized');
        log('N64 EmulatorController initialized', 'EMU_N64');
    }
    
    /**
     * Load controls configuration from JSON
     */
    loadControlsConfig() {
        try {
            const configPath = path.join(__dirname, '../../config/controls.n64.json');
            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            log('Loaded N64 controls configuration', 'EMU_N64');
        } catch (error) {
            log(`Failed to load controls config: ${error.message}`, 'ERROR');
            // Fallback to basic config
            this.config = {
                analog: { "up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT" },
                buttons: { "a": "X", "b": "Z", "start": "ENTER" },
                aliases: {},
                holdDefaultsMs: 800
            };
        }
    }
    
    /**
     * Execute a parsed command
     * @param {Object} command - Parsed command from CommandParser
     */
    executeCommand(command) {
        if (!command || this.inputCooldown) {
            return false;
        }
        
        try {
            switch (command.type) {
                case 'press':
                    return this.pressKey(command.mappedKey, command.key);
                    
                case 'hold':
                    return this.holdKey(command.mappedKey, command.ms, command.key);
                    
                case 'momentum':
                    return this.momentumInput(command.mappedKey, command.duration, command.direction, command.percentage);
                    
                case 'releaseAll':
                    return this.releaseAllKeys();
                    
                default:
                    log(`Unknown command type: ${command.type}`, 'EMU_N64');
                    return false;
            }
        } catch (error) {
            log(`Error executing command: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    /**
     * Send a key press to the emulator
     * @param {string} key - The keyboard key to press
     * @param {string} originalCommand - Original command for logging
     */
    pressKey(key, originalCommand) {
        if (!key) {
            log(`Invalid key mapping for command: ${originalCommand}`, 'EMU_N64');
            return false;
        }
        
        try {
            // Use the working direct PowerShell approach that successfully sent START
            const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue; if ($process) { [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id); Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('{${key}}'); }`;
            
            exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
                if (error) {
                    log(`PowerShell error: ${error.message}`, 'EMU_N64');
                } else {
                    this.lastInput = originalCommand;
                    this.emit('inputSent', originalCommand, key);
                    log(`Input sent: ${originalCommand} (${key})`, 'EMU_N64');
                }
            });
            
            // Set cooldown
            this.setCooldown();
            return true;
            
        } catch (error) {
            log(`Failed to send input ${originalCommand}: ${error.message}`, 'ERROR');
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Hold a key for a specific duration
     * @param {string} key - The keyboard key to hold
     * @param {number} duration - Duration in milliseconds
     * @param {string} originalCommand - Original command for logging
     */
    holdKey(key, duration, originalCommand) {
        if (!key) {
            log(`Invalid key mapping for hold command: ${originalCommand}`, 'EMU_N64');
            return false;
        }
        
        try {
            // Key down
            const keyDownScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName Microsoft.VisualBasic
                $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
                if ($process) {
                    [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
                    Start-Sleep -Milliseconds 50
                    [System.Windows.Forms.SendKeys]::SendWait("{${key} down}")
                }
            `;
            
            exec(`powershell -Command "${keyDownScript}"`, (error) => {
                if (error) {
                    log(`Key down error: ${error.message}`, 'EMU_N64');
                    return;
                }
                
                // Track the held key
                this.heldKeys.add(key);
                log(`Holding key: ${originalCommand} (${key}) for ${duration}ms`, 'EMU_N64');
                
                // Set timer to release the key
                const timer = setTimeout(() => {
                    this.releaseKey(key, originalCommand);
                    this.holdTimers.delete(key);
                }, duration);
                
                this.holdTimers.set(key, timer);
            });
            
            this.lastInput = originalCommand;
            this.emit('inputSent', originalCommand, key);
            this.setCooldown();
            return true;
            
        } catch (error) {
            log(`Failed to hold key ${originalCommand}: ${error.message}`, 'ERROR');
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Release a specific held key
     * @param {string} key - The keyboard key to release
     * @param {string} originalCommand - Original command for logging
     */
    releaseKey(key, originalCommand) {
        if (!this.heldKeys.has(key)) return;
        
        try {
            const keyUpScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName Microsoft.VisualBasic
                $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
                if ($process) {
                    [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
                    Start-Sleep -Milliseconds 50
                    [System.Windows.Forms.SendKeys]::SendWait("{${key} up}")
                }
            `;
            
            exec(`powershell -Command "${keyUpScript}"`, (error) => {
                if (error) {
                    log(`Key up error: ${error.message}`, 'EMU_N64');
                } else {
                    log(`Released key: ${originalCommand} (${key})`, 'EMU_N64');
                }
            });
            
            this.heldKeys.delete(key);
            
        } catch (error) {
            log(`Failed to release key ${key}: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Momentum/analog input simulation
     * @param {string} key - The keyboard key (arrow key)
     * @param {number} duration - Hold duration based on momentum percentage
     * @param {string} direction - Direction name for logging
     * @param {number} percentage - Momentum percentage
     */
    momentumInput(key, duration, direction, percentage) {
        if (!key) {
            log(`Invalid key mapping for momentum: ${direction}${percentage}`, 'EMU_N64');
            return false;
        }
        
        log(`Momentum input: ${direction} ${percentage}% (${duration}ms)`, 'EMU_N64');
        
        // For now, treat momentum as a hold command
        // Future: integrate with ViGEmBus for real analog input
        return this.holdKey(key, duration, `${direction}${percentage}`);
    }
    
    /**
     * Release all currently held keys
     */
    releaseAllKeys() {
        if (this.heldKeys.size === 0) {
            log('No keys to release', 'EMU_N64');
            return true;
        }
        
        log(`Releasing ${this.heldKeys.size} held keys`, 'EMU_N64');
        
        // Clear all hold timers
        for (const timer of this.holdTimers.values()) {
            clearTimeout(timer);
        }
        this.holdTimers.clear();
        
        // Release all held keys
        const keysToRelease = Array.from(this.heldKeys);
        for (const key of keysToRelease) {
            this.releaseKey(key, 'release');
        }
        
        this.emit('inputSent', 'release', 'all');
        return true;
    }
    
    /**
     * Set input cooldown to prevent rapid inputs
     */
    setCooldown() {
        this.inputCooldown = true;
        setTimeout(() => {
            this.inputCooldown = false;
        }, this.cooldownTime);
    }
    
    /**
     * Focus the emulator window
     */
    focusEmulatorWindow() {
        try {
            const psScript = `
                Add-Type -AssemblyName Microsoft.VisualBasic
                $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
                if ($process) {
                    [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
                } else {
                    Write-Output "Project64 not running"
                }
            `;
            
            exec(`powershell -Command "${psScript}"`, (error, stdout) => {
                if (error) {
                    log(`Could not focus emulator window: ${error.message}`, 'EMU_N64');
                } else if (stdout.includes('not running')) {
                    log('Project64 is not running', 'EMU_N64');
                } else {
                    log(`Focused emulator window: ${this.windowTitle}`, 'EMU_N64');
                }
            });
            
        } catch (error) {
            log(`Could not focus emulator window: ${error.message}`, 'EMU_N64');
        }
    }
    
    /**
     * Launch Project64 with the ROM if not already running
     */
    async launchEmulator() {
        try {
            log('Launching Project64...', 'EMU_N64');
            
            const command = `"${this.emulatorPath}" "${this.romPath}"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    log(`Failed to launch Project64: ${error.message}`, 'ERROR');
                    this.emit('error', error);
                } else {
                    log('Project64 launched successfully', 'EMU_N64');
                    this.emit('launched');
                    
                    // Focus window after a delay
                    setTimeout(() => {
                        this.focusEmulatorWindow();
                    }, 3000);
                }
            });
            
        } catch (error) {
            log(`Could not launch emulator: ${error.message}`, 'ERROR');
            this.emit('error', error);
        }
    }
    
    /**
     * Test N64 inputs to make sure they work
     */
    async testInputs() {
        log('Testing N64 emulator inputs...', 'EMU_N64');
        
        const testCommands = [
            { type: 'press', key: 'a', mappedKey: 'X' },
            { type: 'press', key: 'b', mappedKey: 'Z' },
            { type: 'press', key: 'start', mappedKey: 'ENTER' },
            { type: 'press', key: 'up', mappedKey: 'UP' },
            { type: 'press', key: 'down', mappedKey: 'DOWN' }
        ];
        
        for (let i = 0; i < testCommands.length; i++) {
            const command = testCommands[i];
            log(`Testing: ${command.key}`, 'EMU_N64');
            
            this.executeCommand(command);
            
            // Wait between inputs
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        log('N64 input test complete', 'EMU_N64');
    }
    
    /**
     * Get current controller configuration
     */
    getConfig() {
        return {
            windowTitle: this.windowTitle,
            emulatorPath: this.emulatorPath,
            romPath: this.romPath,
            config: this.config,
            lastInput: this.lastInput,
            cooldownTime: this.cooldownTime,
            heldKeysCount: this.heldKeys.size
        };
    }
    
    /**
     * Get controller status
     */
    getStatus() {
        return {
            type: 'N64',
            emulator: 'Project64',
            rom: 'Pokemon Stadium 2',
            lastInput: this.lastInput,
            heldKeys: Array.from(this.heldKeys),
            cooldown: this.inputCooldown
        };
    }
}

module.exports = EmulatorControllerN64;