const edge = require('edge-tts');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { log } = require('../utils/logger');

class TTSManager {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.enabled = true;
        this.outputDir = path.join(__dirname, '../../tts_output');
        this.leaderboard = [];
        
        // Voice configuration based on rank
        this.voiceConfig = {
            champion: {
                voice: 'en-US-AriaNeural', // Epic female voice for champion
                rate: '+0%',
                pitch: '+5Hz',
                volume: '+10%'
            },
            elite: {
                voice: 'en-US-ChristopherNeural', // Cool male voice for elite four
                rate: '+5%',
                pitch: '+2Hz',
                volume: '+5%'
            },
            gym: {
                voice: 'en-US-JennyNeural', // Standard voice for gym leaders
                rate: '+0%',
                pitch: '+0Hz',
                volume: '+0%'
            },
            default: {
                voice: 'en-US-GuyNeural', // Basic voice (shouldn't be used if only leaderboard can TTS)
                rate: '+0%',
                pitch: '+0Hz',
                volume: '+0%'
            }
        };
        
        this.init();
    }
    
    async init() {
        // Create output directory if it doesn't exist
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            log('TTS Manager initialized', 'TTS');
        } catch (error) {
            log(`Failed to create TTS output directory: ${error.message}`, 'ERROR');
        }
    }
    
    updateLeaderboard(leaderboardData) {
        // Update the leaderboard data for checking user ranks
        this.leaderboard = leaderboardData;
        log(`Updated leaderboard with ${leaderboardData.length} users`, 'TTS');
    }
    
    getUserRank(username) {
        const upperUsername = username.toUpperCase();
        const index = this.leaderboard.findIndex(user => 
            user.username.toUpperCase() === upperUsername
        );
        
        if (index === -1) return null; // Not on leaderboard
        
        // Return rank category and position
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
            const voiceConfig = this.voiceConfig[item.rank.category] || this.voiceConfig.default;
            
            // Generate speech with rank-based voice
            const outputFile = path.join(this.outputDir, `tts_${Date.now()}.mp3`);
            
            // Add rank announcement for special users
            let fullText = item.text;
            if (item.rank.category === 'champion') {
                fullText = `Champion ${item.username} says: ${item.text}`;
            } else if (item.rank.category === 'elite') {
                fullText = `Elite Four ${item.username} says: ${item.text}`;
            }
            
            // Generate TTS using edge-tts
            await this.generateSpeech(fullText, outputFile, voiceConfig);
            
            // Play the audio
            await this.playAudio(outputFile);
            
            // Clean up
            await fs.unlink(outputFile).catch(() => {});
            
        } catch (error) {
            log(`TTS error: ${error.message}`, 'ERROR');
        }
        
        // Process next item in queue
        setTimeout(() => this.processQueue(), 500);
    }
    
    async generateSpeech(text, outputFile, voiceConfig) {
        return new Promise((resolve, reject) => {
            const tts = new edge.Communicate(text, voiceConfig.voice);
            
            // Set voice parameters
            tts.rate = voiceConfig.rate;
            tts.pitch = voiceConfig.pitch;
            tts.volume = voiceConfig.volume;
            
            // Save to file
            tts.save(outputFile).then(() => {
                resolve();
            }).catch(reject);
        });
    }
    
    async playAudio(filePath) {
        return new Promise((resolve, reject) => {
            // Use Windows Media Player for playback
            const command = `powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`;
            
            exec(command, (error) => {
                if (error) {
                    // Try alternative method
                    exec(`start "" "${filePath}"`, (error2) => {
                        if (error2) {
                            reject(error2);
                        } else {
                            // Give it time to play
                            setTimeout(resolve, 3000);
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

module.exports = TTSManager;