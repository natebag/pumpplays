const { exec } = require('child_process');
const { log } = require('../utils/logger');

class SimpleTTS {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.enabled = true;
        this.leaderboard = [];
        
        // Voice configuration based on rank (using Windows built-in voices)
        this.voiceConfig = {
            champion: {
                voice: 'Microsoft Zira Desktop', // Female voice for champion
                rate: '0',
                volume: '100'
            },
            elite: {
                voice: 'Microsoft David Desktop', // Male voice for elite four  
                rate: '2',
                volume: '90'
            },
            gym: {
                voice: 'Microsoft Zira Desktop', // Standard voice for gym leaders
                rate: '0',
                volume: '80'
            }
        };
        
        log('Simple TTS Manager initialized', 'TTS');
    }
    
    updateLeaderboard(leaderboardData) {
        this.leaderboard = leaderboardData;
        log(`Updated leaderboard with ${leaderboardData.length} users`, 'TTS');
    }
    
    getUserRank(username) {
        const upperUsername = username.toUpperCase();
        const index = this.leaderboard.findIndex(user => 
            user.username.toUpperCase() === upperUsername
        );
        
        if (index === -1) return null; // Not on leaderboard
        
        if (index === 0) return { category: 'champion', rank: 1 };
        if (index >= 1 && index <= 4) return { category: 'elite', rank: index + 1 };
        return { category: 'gym', rank: index + 1 };
    }
    
    async processMessage(username, message) {
        // Check if user is on leaderboard
        const userRank = this.getUserRank(username);
        
        if (!userRank) {
            log(`TTS ignored - ${username} not on leaderboard`, 'TTS');
            return false;
        }
        
        // Check if message starts with TTS command
        const ttsMatch = message.match(/^[!\/]tts\s+(.+)/i);
        if (!ttsMatch) return false;
        
        const ttsText = ttsMatch[1].substring(0, 200); // Limit to 200 chars
        
        // Filter profanity (basic filter)
        const filtered = this.filterProfanity(ttsText);
        
        // Add to queue with user rank info
        this.queue.push({
            username,
            text: filtered,
            rank: userRank,
            timestamp: Date.now()
        });
        
        log(`TTS queued from ${username} (Rank #${userRank.rank} - ${userRank.category}): ${filtered}`, 'TTS');
        
        // Process queue if not already playing
        if (!this.isPlaying) {
            this.processQueue();
        }
        
        return true;
    }
    
    filterProfanity(text) {
        // Basic profanity filter - expand as needed
        const badWords = ['fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock', 'cunt'];
        let filtered = text;
        
        badWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        });
        
        return filtered;
    }
    
    async processQueue() {
        if (this.queue.length === 0 || !this.enabled) {
            this.isPlaying = false;
            return;
        }
        
        this.isPlaying = true;
        const item = this.queue.shift();
        
        try {
            // Get voice config based on rank
            const voiceConfig = this.voiceConfig[item.rank.category] || this.voiceConfig.gym;
            
            // Add rank announcement for special users
            let fullText = item.text;
            if (item.rank.category === 'champion') {
                fullText = `Champion ${item.username} says: ${item.text}`;
            } else if (item.rank.category === 'elite') {
                fullText = `Elite Four ${item.username} says: ${item.text}`;
            }
            
            // Generate speech using Windows PowerShell
            await this.speak(fullText, voiceConfig);
            
            log(`TTS played: ${fullText}`, 'TTS');
            
        } catch (error) {
            log(`TTS error: ${error.message}`, 'ERROR');
        }
        
        // Process next item in queue
        setTimeout(() => this.processQueue(), 1000);
    }
    
    async speak(text, voiceConfig) {
        return new Promise((resolve, reject) => {
            // Escape quotes in text
            const escapedText = text.replace(/"/g, '""');
            
            // Use Windows Speech API via PowerShell
            const command = `powershell -Command "Add-Type -AssemblyName System.Speech; $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synthesizer.SelectVoice('${voiceConfig.voice}'); $synthesizer.Rate = ${voiceConfig.rate}; $synthesizer.Volume = ${voiceConfig.volume}; $synthesizer.Speak('${escapedText}')"`;
            
            exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    // Try simpler method if voices not available
                    const simpleCommand = `powershell -Command "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escapedText}')"`;
                    exec(simpleCommand, { timeout: 10000 }, (error2) => {
                        if (error2) {
                            reject(error2);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        log(`TTS ${enabled ? 'enabled' : 'disabled'}`, 'TTS');
    }
    
    clearQueue() {
        this.queue = [];
        log('TTS queue cleared', 'TTS');
    }
    
    getQueueLength() {
        return this.queue.length;
    }
    
    getStats() {
        return {
            enabled: this.enabled,
            queueLength: this.queue.length,
            isPlaying: this.isPlaying,
            leaderboardUsers: this.leaderboard.length
        };
    }
}

module.exports = SimpleTTS;