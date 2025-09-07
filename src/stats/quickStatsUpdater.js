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
        this.reportsDir = path.join(__dirname, '../../Leaderboard/30sec updates');
        this.lastUpdateTime = Date.now();
        this.updateCount = 0;
        
        // Import surgical updater
        const SurgicalHTMLUpdater = require('./surgicalHTMLUpdater');
        this.surgicalUpdater = new SurgicalHTMLUpdater();
        
        // Ensure directories exist
        this.ensureDataDirectory();
        this.ensureReportsDirectory();
        
        log('📊 Quick Stats Updater initialized (30-second updates)', 'STATS');
    }
    
    ensureDataDirectory() {
        const dataDir = path.dirname(this.jsonFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    
    ensureReportsDirectory() {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
            log('📁 Created 30-second reports directory', 'STATS');
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
            this.updateCount++;
            
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
            
            // Generate 30-second CEO-style report
            this.generate30SecReport(topUsers, stats);
            
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
    
    /**
     * Generate 30-second report (CEO format but for quick updates)
     */
    generate30SecReport(topUsers, stats) {
        try {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const reportFile = path.join(this.reportsDir, `30SEC_Report_${timestamp}.txt`);
            
            let report = `⚡ PUMP PLAYS POKEMON - 30-SECOND UPDATE REPORT\n`;
            report += `Generated: ${now.toLocaleString()}\n`;
            report += `Update #${this.updateCount} (Every 30 seconds)\n`;
            report += `Total Users: ${stats.totalUsers}\n`;
            report += `Total Votes: ${stats.totalVotes}\n`;
            report += `${'='.repeat(60)}\n\n`;
            
            if (topUsers.length === 0) {
                report += `No user activity recorded yet.\n`;
            } else {
                report += `TOP ${topUsers.length} MOST ACTIVE USERS:\n\n`;
                
                topUsers.forEach((user, index) => {
                    const rank = index + 1;
                    const totalVotes = user.totalVotes;
                    
                    // Build command breakdown string
                    let commandList = '';
                    if (user.topCommands && user.topCommands.length > 0) {
                        commandList = user.topCommands
                            .map(cmd => `${cmd.count} ${cmd.command}`)
                            .join(', ');
                    }
                    
                    report += `${rank}. ${user.username.toUpperCase()} - ${totalVotes} votes`;
                    if (commandList) {
                        report += ` - ${commandList}`;
                    }
                    report += `\n`;
                });
                
                // Add quick analytics
                report += `\n${'='.repeat(60)}\n`;
                report += `📊 QUICK ANALYTICS:\n\n`;
                
                const totalVotes = topUsers.reduce((sum, user) => sum + user.totalVotes, 0);
                const avgVotesPerUser = Math.round(totalVotes / topUsers.length);
                
                report += `Total Votes: ${totalVotes}\n`;
                report += `Average Votes per User: ${avgVotesPerUser}\n`;
                report += `Most Popular Commands: ${stats.topCommands.map(cmd => `${cmd.command} (${cmd.count})`).join(', ')}\n`;
                
                // Activity insights
                const changeFromLast = this.updateCount > 1 ? 
                    `(+${stats.totalVotes - (this.lastTotalVotes || stats.totalVotes)} since last update)` : '';
                
                report += `Vote Change: ${changeFromLast || 'First update'}\n`;
                
                // Store for next comparison
                this.lastTotalVotes = stats.totalVotes;
            }
            
            report += `\n${'='.repeat(60)}\n`;
            report += `⚡ Next update in 30 seconds\n`;
            report += `📊 Full CEO Report generates every 4 hours\n`;
            
            // Write report to file
            fs.writeFileSync(reportFile, report);
            
            // Also save as latest report
            const latestFile = path.join(this.reportsDir, 'LATEST_30SEC_Report.txt');
            fs.writeFileSync(latestFile, report);
            
            // Only log every 10th report to avoid spam (every 5 minutes)
            if (this.updateCount % 10 === 1) {
                log(`⚡ 30-sec report #${this.updateCount} saved: ${reportFile}`, 'STATS');
            }
            
        } catch (error) {
            log(`❌ Failed to generate 30-sec report: ${error.message}`, 'ERROR');
        }
    }
}

module.exports = QuickStatsUpdater;