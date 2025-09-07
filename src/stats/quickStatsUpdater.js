const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

/**
 * Quick Stats Updater - Updates website every 30 seconds with fresh data
 * Separate from CEO reports which run every 4 hours
 */
class QuickStatsUpdater {
    constructor(leaderboardManager) {
        this.leaderboardManager = leaderboardManager;
        this.surgicalUpdater = null;
        this.updateInterval = 30 * 1000; // 30 seconds
        this.jsonFile = path.join(__dirname, '../../Leaderboard/data/leaderboard.json');
        this.lastUpdateTime = Date.now();
        
        // Import surgical updater
        const SurgicalHTMLUpdater = require('./surgicalHTMLUpdater');
        this.surgicalUpdater = new SurgicalHTMLUpdater();
        
        // Ensure data directory exists
        this.ensureDataDirectory();
        
        log('📊 Quick Stats Updater initialized (30-second updates)', 'STATS');
    }
    
    ensureDataDirectory() {
        const dataDir = path.dirname(this.jsonFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    
    /**
     * Start the 30-second update cycle
     */
    start() {
        // Initial update
        this.updateStats();
        
        // Set up 30-second interval
        this.intervalId = setInterval(() => {
            this.updateStats();
        }, this.updateInterval);
        
        log('⚡ Quick stats updater started (30-second intervals)', 'STATS');
    }
    
    /**
     * Stop the update cycle
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            log('⚡ Quick stats updater stopped', 'STATS');
        }
    }
    
    /**
     * Update stats (runs every 30 seconds)
     */
    async updateStats() {
        try {
            const startTime = Date.now();
            
            // Get fresh data from leaderboard manager
            const topUsers = this.leaderboardManager.getTopUsers(20);
            const stats = this.calculateStats();
            
            // Create JSON data for website
            const jsonData = {
                lastUpdated: new Date().toISOString(),
                totalUsers: stats.totalUsers,
                totalVotes: stats.totalVotes,
                topCommands: stats.topCommands,
                champion: topUsers[0] || null,
                eliteFour: topUsers.slice(1, 5),
                gymLeaders: topUsers.slice(5, 12),
                allUsers: topUsers
            };
            
            // Write JSON file for JavaScript to fetch
            fs.writeFileSync(this.jsonFile, JSON.stringify(jsonData, null, 2));
            
            // Update HTML with surgical precision (preserves layout)
            try {
                await this.surgicalUpdater.updateHTML(this.leaderboardManager);
                
                // Try to push to GitHub (but don't fail if it doesn't work)
                try {
                    await this.pushToGitHub();
                } catch (pushError) {
                    // Silently continue - we don't want to spam logs every 30 seconds
                }
                
            } catch (htmlError) {
                // Log error but continue - don't break the update cycle
                if (Math.random() < 0.01) { // Only log 1% of the time to avoid spam
                    log(`⚠️ HTML update error (continuing): ${htmlError.message}`, 'WARN');
                }
            }
            
            const updateTime = Date.now() - startTime;
            
            // Only log periodically to avoid spam (every 10 updates = 5 minutes)
            if (this.getUpdateCount() % 10 === 0) {
                log(`⚡ Quick stats updated in ${updateTime}ms (${stats.totalUsers} users, ${stats.totalVotes} votes)`, 'STATS');
            }
            
            this.lastUpdateTime = Date.now();
            
        } catch (error) {
            log(`❌ Quick stats update failed: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Calculate fresh stats
     */
    calculateStats() {
        const allUsers = Object.entries(this.leaderboardManager.userStats);
        const totalUsers = allUsers.length;
        const totalVotes = allUsers.reduce((sum, [, stats]) => sum + stats.totalVotes, 0);
        
        // Calculate top commands
        const allCommands = {};
        allUsers.forEach(([, stats]) => {
            Object.entries(stats.commands).forEach(([cmd, count]) => {
                allCommands[cmd] = (allCommands[cmd] || 0) + count;
            });
        });
        
        const topCommands = Object.entries(allCommands)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([cmd, count]) => ({ command: cmd.toUpperCase(), count }));
        
        return { totalUsers, totalVotes, topCommands };
    }
    
    /**
     * Push to GitHub (silent version for frequent updates)
     */
    async pushToGitHub() {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        try {
            // Only push HTML changes, not JSON (to reduce git noise)
            await execAsync('git add Leaderboard/index.html Leaderboard/data/leaderboard.json');
            await execAsync('git commit -m "⚡ Quick stats update (30s interval)"');
            await execAsync('git push origin main');
        } catch (error) {
            // Silently fail - this runs every 30 seconds
            throw error;
        }
    }
    
    /**
     * Get number of updates since start
     */
    getUpdateCount() {
        return Math.floor((Date.now() - this.lastUpdateTime) / this.updateInterval);
    }
}

module.exports = QuickStatsUpdater;