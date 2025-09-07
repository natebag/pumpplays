const EventEmitter = require('events');
const { exec } = require('child_process');
const { log } = require('../utils/logger');

class EmulatorController extends EventEmitter {
    constructor() {
        super();
        this.windowTitle = process.env.EMULATOR_WINDOW_TITLE || 'BGB';
        this.keyMappings = {
            'up': 'up',
            'down': 'down', 
            'left': 'left',
            'right': 'right',
            'a': 'x',        // Default BGB mapping
            'b': 'z',        // Default BGB mapping
            'start': 'enter',
            'select': 'backspace'
        };
        
        this.lastInput = null;
        this.inputCooldown = false;
        this.cooldownTime = 100; // 100ms between inputs
        
        this.emit('status', 'initialized');
    }
    
    /**
     * Send input to the emulator window using PowerShell
     * @param {string} command - The command to send (up, down, left, right, a, b, start, select)
     */
    sendInput(command) {
        if (!command || this.inputCooldown) {
            return false;
        }
        
        const key = this.keyMappings[command.toLowerCase()];
        if (!key) {
            log(`Invalid command: ${command}`, 'EMU');
            return false;
        }
        
        try {
            // Focus emulator window and send key using PowerShell
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                $window = Get-Process -Name "bgb" -ErrorAction SilentlyContinue
                if ($window) {
                    [System.Windows.Forms.SendKeys]::SendWait("${key}")
                }
            `;
            
            exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
                if (error) {
                    log(`PowerShell error: ${error.message}`, 'EMU');
                } else {
                    this.lastInput = command;
                    this.emit('inputSent', command, key);
                    log(`Input sent: ${command} (${key})`, 'EMU');
                }
            });
            
            // Set cooldown to prevent rapid inputs
            this.inputCooldown = true;
            setTimeout(() => {
                this.inputCooldown = false;
            }, this.cooldownTime);
            
            return true;
            
        } catch (error) {
            log(`Failed to send input ${command}: ${error.message}`, 'ERROR');
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * Focus the emulator window using PowerShell
     */
    focusEmulatorWindow() {
        try {
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                $window = Get-Process -Name "bgb" -ErrorAction SilentlyContinue
                if ($window) {
                    $window.MainWindowHandle | ForEach-Object {
                        [Microsoft.VisualBasic.Interaction]::AppActivate($window.Id)
                    }
                }
            `;
            
            exec(`powershell -Command "${psScript}"`, (error) => {
                if (error) {
                    log(`Could not focus emulator window: ${error.message}`, 'EMU');
                } else {
                    log(`Focused emulator window: ${this.windowTitle}`, 'EMU');
                }
            });
            
        } catch (error) {
            log(`Could not focus emulator window: ${error.message}`, 'EMU');
        }
    }
    
    /**
     * Test all inputs to make sure they work
     */
    async testInputs() {
        log('Testing emulator inputs...', 'EMU');
        
        const testCommands = ['up', 'down', 'left', 'right', 'a', 'b'];
        
        for (let i = 0; i < testCommands.length; i++) {
            const command = testCommands[i];
            log(`Testing: ${command}`, 'EMU');
            
            this.sendInput(command);
            
            // Wait between inputs
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        log('Input test complete', 'EMU');
    }
    
    /**
     * Get current configuration
     */
    getConfig() {
        return {
            windowTitle: this.windowTitle,
            keyMappings: this.keyMappings,
            lastInput: this.lastInput,
            cooldownTime: this.cooldownTime
        };
    }
    
    /**
     * Update key mappings if needed
     */
    updateKeyMapping(command, key) {
        if (this.keyMappings.hasOwnProperty(command)) {
            this.keyMappings[command] = key;
            log(`Updated mapping: ${command} -> ${key}`, 'EMU');
            return true;
        }
        return false;
    }
}

module.exports = EmulatorController;