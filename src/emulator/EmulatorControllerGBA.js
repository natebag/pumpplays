const EventEmitter = require('events');
const { exec } = require('child_process');
const { log } = require('../utils/logger');

class EmulatorControllerGBA extends EventEmitter {
    constructor() {
        super();
        this.windowTitle = process.env.EMULATOR_WINDOW_TITLE || 'mGBA';
        this.keyMappings = {
            'up': 'up',
            'down': 'down', 
            'left': 'left',
            'right': 'right',
            'a': 'x',        // Default mGBA mapping
            'b': 'z',        // Default mGBA mapping
            'l': 'a',        // L shoulder button
            'r': 's',        // R shoulder button
            'start': 'enter',
            'select': 'tab'
        };
        
        this.lastInput = null;
        this.inputCooldown = false;
        this.cooldownTime = 100; // 100ms between inputs
        
        this.emit('status', 'initialized');
    }
    
    /**
     * Send input to the emulator window using PowerShell
     * @param {string} command - The command to send (up, down, left, right, a, b, l, r, start, select)
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
            // Use Windows API to send key directly to mGBA window
            const psScript = `
                Add-Type -TypeDefinition @"
                    using System;
                    using System.Runtime.InteropServices;
                    using System.Windows.Forms;
                    
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
                        
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        
                        [DllImport("user32.dll")]
                        public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
                        
                        public const uint WM_KEYDOWN = 0x0100;
                        public const uint WM_KEYUP = 0x0101;
                    }
"@
                try {
                    $proc = Get-Process -Name "mGBA" -ErrorAction Stop
                    $hwnd = $proc.MainWindowHandle
                    if ($hwnd -ne [IntPtr]::Zero) {
                        [Win32]::SetForegroundWindow($hwnd)
                        Start-Sleep -Milliseconds 50
                        
                        # Convert key to virtual key code
                        $vkCode = switch("${key}") {
                            "enter" { 0x0D }
                            "up" { 0x26 }
                            "down" { 0x28 }
                            "left" { 0x25 }
                            "right" { 0x27 }
                            "x" { 0x58 }
                            "z" { 0x5A }
                            "a" { 0x41 }
                            "s" { 0x53 }
                            "backspace" { 0x08 }
                            "tab" { 0x09 }
                            default { 0x0D }
                        }
                        
                        [Win32]::PostMessage($hwnd, [Win32]::WM_KEYDOWN, [IntPtr]$vkCode, [IntPtr]0)
                        Start-Sleep -Milliseconds 50
                        [Win32]::PostMessage($hwnd, [Win32]::WM_KEYUP, [IntPtr]$vkCode, [IntPtr]0)
                        Write-Host "Sent key: ${key} (VK: $vkCode)"
                    } else {
                        Write-Host "Could not get mGBA window handle"
                    }
                } catch {
                    Write-Host "Error: $_"
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
     * Execute a parsed command (for compatibility with N64 system)
     * @param {Object} parsedCommand - Command from CommandParser
     */
    executeCommand(parsedCommand) {
        if (!parsedCommand) return false;
        
        switch (parsedCommand.type) {
            case 'press':
                return this.sendInput(parsedCommand.key);
                
            case 'hold':
                // Hold the key for specified duration
                const holdKey = this.keyMappings[parsedCommand.key.toLowerCase()];
                if (!holdKey) return false;
                
                try {
                    const psScript = `
                        Add-Type -AssemblyName System.Windows.Forms
                        $window = Get-Process -Name "mGBA" -ErrorAction SilentlyContinue
                        if ($window) {
                            [System.Windows.Forms.SendKeys]::SendWait("${holdKey}")
                            Start-Sleep -Milliseconds ${parsedCommand.ms}
                        }
                    `;
                    
                    exec(`powershell -Command "${psScript}"`, (error) => {
                        if (error) {
                            log(`Hold command error: ${error.message}`, 'EMU');
                        } else {
                            log(`Held ${parsedCommand.key} for ${parsedCommand.ms}ms`, 'EMU');
                        }
                    });
                    
                    return true;
                } catch (error) {
                    log(`Failed to execute hold command: ${error.message}`, 'ERROR');
                    return false;
                }
                
            case 'momentum':
                // For GBA, treat momentum as regular directional input
                return this.sendInput(parsedCommand.direction);
                
            case 'releaseAll':
                // GBA doesn't have analog controls, so this is a no-op
                log('Release all keys (GBA - no action needed)', 'EMU');
                return true;
                
            default:
                log(`Unknown command type: ${parsedCommand.type}`, 'EMU');
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
                $window = Get-Process -Name "mGBA" -ErrorAction SilentlyContinue
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
        log('Testing GBA emulator inputs...', 'EMU');
        
        const testCommands = ['up', 'down', 'left', 'right', 'a', 'b', 'l', 'r'];
        
        for (let i = 0; i < testCommands.length; i++) {
            const command = testCommands[i];
            log(`Testing: ${command}`, 'EMU');
            
            this.sendInput(command);
            
            // Wait between inputs
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        log('GBA input test complete', 'EMU');
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

module.exports = EmulatorControllerGBA;