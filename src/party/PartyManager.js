const EventEmitter = require('events');
const { log } = require('../utils/logger');

class PartyManager extends EventEmitter {
    constructor(gameBoyBridge) {
        super();
        this.gameBoyBridge = gameBoyBridge;
        this.currentParty = [];
        this.lastPartyCheck = null;
        this.isScanning = false;
        this.autoScanInterval = null;
        this.autoScanEnabled = false;
    }

    async scanParty() {
        if (this.isScanning) {
            log('Party scan already in progress', 'PARTY');
            return this.currentParty;
        }

        try {
            this.isScanning = true;
            log('Starting party scan...', 'PARTY');

            // Navigate to party menu if not already there
            const wasInParty = await this.navigateToParty();
            
            // Take screenshot of party screen
            await this.delay(500); // Wait for screen to load
            const partyScreenshot = await this.takeScreenshot();
            
            if (!partyScreenshot) {
                throw new Error('Failed to capture party screenshot');
            }

            // Parse Pokemon data from screenshot
            const partyData = await this.parsePartyFromImage(partyScreenshot);
            
            // Navigate back if we opened party
            if (!wasInParty) {
                await this.navigateBackFromParty();
            }

            this.currentParty = partyData;
            this.lastPartyCheck = Date.now();
            this.emit('partyUpdated', this.currentParty);
            
            log(`Party scan complete: ${this.currentParty.length} Pokemon found`, 'PARTY');
            return this.currentParty;

        } catch (error) {
            log(`Party scan failed: ${error.message}`, 'ERROR');
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    async takeScreenshot() {
        try {
            log('Taking emulator screenshot for party analysis...', 'PARTY');
            
            // Use GameBoyBridge to capture screenshot from emulator
            const screenshotPath = await this.gameBoyBridge.takeScreenshot();
            
            if (!screenshotPath) {
                throw new Error('Failed to capture screenshot from emulator');
            }
            
            log(`Screenshot captured successfully: ${screenshotPath}`, 'PARTY');
            return screenshotPath;
        } catch (error) {
            log(`Screenshot failed: ${error.message}`, 'ERROR');
            return null;
        }
    }

    async navigateToParty() {
        try {
            log('Navigating to party menu...', 'PARTY');
            
            // Send Start button to open menu
            this.gameBoyBridge.sendCommand('start');
            await this.delay(300);
            
            // Navigate to Pokemon option (usually first option)
            // This might need adjustment based on menu layout
            this.gameBoyBridge.sendCommand('a');
            await this.delay(300);
            
            return true; // Return true if we navigated to party
        } catch (error) {
            log(`Failed to navigate to party: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async navigateBackFromParty() {
        try {
            log('Navigating back from party...', 'PARTY');
            
            // Press B button twice to go back to overworld
            this.gameBoyBridge.sendCommand('b');
            await this.delay(200);
            this.gameBoyBridge.sendCommand('b');
            await this.delay(200);
            
        } catch (error) {
            log(`Failed to navigate back from party: ${error.message}`, 'ERROR');
        }
    }

    async parsePartyFromImage(screenshotPath) {
        try {
            log('Analyzing emulator screen for party data...', 'PARTY');
            
            if (!screenshotPath) {
                log('No screenshot path provided for party analysis', 'PARTY');
                return [];
            }
            
            const fs = require('fs');
            if (!fs.existsSync(screenshotPath)) {
                log(`Screenshot file not found: ${screenshotPath}`, 'PARTY');
                return [];
            }
            
            // Basic implementation - detect if we're in party screen
            // Real OCR would parse Pokemon names, levels, HP, etc.
            log(`Analyzing screenshot: ${screenshotPath}`, 'PARTY');
            
            // For now, return placeholder data indicating we captured a screenshot
            // Real implementation would use OCR libraries like Tesseract
            const partyData = [
                {
                    name: 'Screenshot Captured',
                    level: 'N/A',
                    hp: 'N/A',
                    status: 'Active',
                    position: 1,
                    screenshotPath: screenshotPath
                }
            ];
            
            log(`Party analysis complete: Found screenshot at ${screenshotPath}`, 'PARTY');
            return partyData;

        } catch (error) {
            log(`Failed to parse party from image: ${error.message}`, 'ERROR');
            return [];
        }
    }


    startAutoScan(intervalMs = 30000) {
        if (this.autoScanInterval) {
            this.stopAutoScan();
        }

        this.autoScanEnabled = true;
        log(`Starting auto party scan every ${intervalMs}ms`, 'PARTY');
        
        this.autoScanInterval = setInterval(async () => {
            if (this.autoScanEnabled && !this.isScanning) {
                try {
                    await this.scanParty();
                } catch (error) {
                    log(`Auto scan failed: ${error.message}`, 'ERROR');
                }
            }
        }, intervalMs);
    }

    stopAutoScan() {
        if (this.autoScanInterval) {
            clearInterval(this.autoScanInterval);
            this.autoScanInterval = null;
            this.autoScanEnabled = false;
            log('Stopped auto party scan', 'PARTY');
        }
    }

    getCurrentParty() {
        return {
            party: this.currentParty,
            lastUpdated: this.lastPartyCheck,
            scanning: this.isScanning
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PartyManager;