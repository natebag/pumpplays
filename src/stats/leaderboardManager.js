const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');
const GitHubPublisher = require('./GitHubPublisher');
const WebsiteUpdater = require('./websiteUpdater');
const HTMLLeaderboardUpdater = require('./htmlLeaderboardUpdater');
const SurgicalHTMLUpdater = require('./surgicalHTMLUpdater');

/**
 * Manages user statistics and generates leaderboard reports
 */
class LeaderboardManager {
    constructor() {
        this.statsFile = path.join(__dirname, '../../stats/user_stats.json');
        this.reportsDir = path.join(__dirname, '../../reports');
        this.userStats = {};
        this.lastReportTime = Date.now();
        this.reportInterval = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
        this.githubPublisher = new GitHubPublisher();
        this.websiteUpdater = new WebsiteUpdater();
        this.htmlUpdater = new HTMLLeaderboardUpdater();
        this.surgicalUpdater = new SurgicalHTMLUpdater();
        
        // Ensure directories exist
        this.ensureDirectories();
        
        // Load existing stats
        this.loadStats();
        
        // Start report timer
        this.startReportTimer();
        
        log('Leaderboard Manager initialized', 'STATS');
    }
    
    ensureDirectories() {
        const statsDir = path.dirname(this.statsFile);
        if (!fs.existsSync(statsDir)) {
            fs.mkdirSync(statsDir, { recursive: true });
        }
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }
    
    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = fs.readFileSync(this.statsFile, 'utf8');
                this.userStats = JSON.parse(data);
                log(`Loaded stats for ${Object.keys(this.userStats).length} users`, 'STATS');
            }
        } catch (error) {
            log(`Error loading stats: ${error.message}`, 'ERROR');
            this.userStats = {};
        }
    }
    
    saveStats() {
        try {
            fs.writeFileSync(this.statsFile, JSON.stringify(this.userStats, null, 2));
        } catch (error) {
            log(`Error saving stats: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Record a command from a user
     * @param {string} user - Username
     * @param {string} command - Command issued (up, down, a, b, etc.)
     * @param {number} weight - Vote weight
     */
    recordCommand(user, command, weight = 1) {
        if (!user || !command) return;
        
        // Initialize user stats if not exists
        if (!this.userStats[user]) {
            this.userStats[user] = {
                totalVotes: 0,
                totalWeight: 0,
                commands: {},
                firstSeen: Date.now(),
                lastSeen: Date.now()
            };
        }
        
        const userStat = this.userStats[user];
        
        // Update totals
        userStat.totalVotes++;
        userStat.totalWeight += weight;
        userStat.lastSeen = Date.now();
        
        // Update command counts
        if (!userStat.commands[command]) {
            userStat.commands[command] = 0;
        }
        userStat.commands[command]++;
        
        // Save stats periodically (every 10 commands to avoid too much I/O)
        if (Math.random() < 0.1) {
            this.saveStats();
        }
        
        log(`📊 ${user}: ${command} (${userStat.totalVotes} total votes)`, 'STATS');
    }
    
    /**
     * Generate CEO report with top users and their command breakdown
     */
    async generateCEOReport() {
        try {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const reportFile = path.join(this.reportsDir, `CEO_Report_${timestamp}.txt`);
            
            // Sort users by total votes
            const sortedUsers = Object.entries(this.userStats)
                .sort(([,a], [,b]) => b.totalVotes - a.totalVotes)
                .slice(0, 20); // Top 20 users
            
            let report = `🚀 PUMP PLAYS POKEMON - CEO LEADERBOARD REPORT\n`;
            report += `Generated: ${now.toLocaleString()}\n`;
            report += `Total Users: ${Object.keys(this.userStats).length}\n`;
            report += `Report Period: Last 4 hours\n`;
            report += `${'='.repeat(60)}\n\n`;
            
            if (sortedUsers.length === 0) {
                report += `No user activity recorded yet.\n`;
            } else {
                report += `TOP ${sortedUsers.length} MOST ACTIVE USERS:\n\n`;
                
                sortedUsers.forEach(([username, stats], index) => {
                    const rank = index + 1;
                    const totalVotes = stats.totalVotes;
                    const totalWeight = stats.totalWeight;
                    
                    // Build command breakdown string
                    const commandList = Object.entries(stats.commands)
                        .sort(([,a], [,b]) => b - a)
                        .map(([cmd, count]) => `${count} ${cmd}`)
                        .join(', ');
                    
                    const daysSinceFirst = Math.floor((Date.now() - stats.firstSeen) / (1000 * 60 * 60 * 24));
                    const hoursSinceLast = Math.floor((Date.now() - stats.lastSeen) / (1000 * 60 * 60));
                    
                    report += `${rank}. ${username.toUpperCase()} - ${totalVotes} votes`;
                    if (totalWeight !== totalVotes) {
                        report += ` (${totalWeight} weighted)`;
                    }
                    report += ` - ${commandList}`;
                    if (daysSinceFirst > 0) {
                        report += ` [Active for ${daysSinceFirst}d, last seen ${hoursSinceLast}h ago]`;
                    }
                    report += `\n`;
                });
                
                // Add some analytics
                report += `\n${'='.repeat(60)}\n`;
                report += `📊 ANALYTICS:\n\n`;
                
                const totalVotes = sortedUsers.reduce((sum, [,stats]) => sum + stats.totalVotes, 0);
                const avgVotesPerUser = Math.round(totalVotes / sortedUsers.length);
                
                // Find most popular commands
                const allCommands = {};
                Object.values(this.userStats).forEach(stats => {
                    Object.entries(stats.commands).forEach(([cmd, count]) => {
                        allCommands[cmd] = (allCommands[cmd] || 0) + count;
                    });
                });
                
                const topCommands = Object.entries(allCommands)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5);
                
                report += `Total Votes: ${totalVotes}\n`;
                report += `Average Votes per User: ${avgVotesPerUser}\n`;
                report += `Most Popular Commands: ${topCommands.map(([cmd, count]) => `${cmd} (${count})`).join(', ')}\n`;
                
                // Activity insights
                const activeUsers = sortedUsers.filter(([,stats]) => 
                    Date.now() - stats.lastSeen < 24 * 60 * 60 * 1000
                ).length;
                
                report += `Active Users (last 24h): ${activeUsers}/${sortedUsers.length}\n`;
                
                if (sortedUsers.length >= 3) {
                    const top3Total = sortedUsers.slice(0, 3).reduce((sum, [,stats]) => sum + stats.totalVotes, 0);
                    const top3Percentage = Math.round((top3Total / totalVotes) * 100);
                    report += `Top 3 Users Control: ${top3Percentage}% of all votes\n`;
                }
            }
            
            report += `\n${'='.repeat(60)}\n`;
            report += `🎮 Ready for rewards and recognition!\n`;
            report += `💡 Next report in 4 hours\n`;
            
            // Write report to file
            fs.writeFileSync(reportFile, report);
            
            // Also save as latest report
            const latestFile = path.join(this.reportsDir, 'LATEST_CEO_Report.txt');
            fs.writeFileSync(latestFile, report);
            
            log(`📄 CEO Report generated: ${reportFile}`, 'STATS');
            log(`📊 Report covers ${sortedUsers.length} users with ${Object.values(this.userStats).reduce((sum, s) => sum + s.totalVotes, 0)} total votes`, 'STATS');
            
            // Publish to GitHub for live website
            try {
                await this.githubPublisher.publishLeaderboard(this);
            } catch (error) {
                log(`⚠️ GitHub publish failed (continuing): ${error.message}`, 'WARN');
            }
            
            // Update local Leaderboard HTML file with surgical precision (preserves layout)
            try {
                await this.surgicalUpdater.updateHTML(this);
                log('✅ Surgical HTML update completed - layout preserved with fresh data!', 'STATS');
            } catch (error) {
                log(`⚠️ Surgical HTML update failed (continuing): ${error.message}`, 'WARN');
            }
            
            // Also update website HTML with current stats (legacy)
            try {
                const leaderboardData = this.getLeaderboardData();
                await this.websiteUpdater.updateWebsiteHTML(leaderboardData);
                log('✅ Website HTML auto-updated with current stats', 'STATS');
            } catch (error) {
                log(`⚠️ Website HTML update failed (continuing): ${error.message}`, 'WARN');
            }
            
            return reportFile;
            
        } catch (error) {
            log(`Error generating CEO report: ${error.message}`, 'ERROR');
            return null;
        }
    }
    
    startReportTimer() {
        // Generate initial report
        this.generateCEOReport().catch(err => log(`Initial report error: ${err.message}`, 'ERROR'));
        
        // Set up 4-hour interval
        setInterval(async () => {
            this.saveStats(); // Save current stats
            try {
                await this.generateCEOReport();
            } catch (err) {
                log(`Report generation error: ${err.message}`, 'ERROR');
            }
            this.lastReportTime = Date.now();
        }, this.reportInterval);
        
        log('📅 CEO report timer started (4-hour intervals)', 'STATS');
    }
    
    /**
     * Get current leaderboard for real-time display
     * @param {number} limit - Number of top users to return
     */
    getTopUsers(limit = 10) {
        return Object.entries(this.userStats)
            .sort(([,a], [,b]) => b.totalVotes - a.totalVotes)
            .slice(0, limit)
            .map(([username, stats]) => ({
                username,
                totalVotes: stats.totalVotes,
                totalWeight: stats.totalWeight,
                topCommands: Object.entries(stats.commands)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3)
                    .map(([cmd, count]) => ({ command: cmd, count }))
            }));
    }
    
    /**
     * Get stats for a specific user
     * @param {string} username 
     */
    getUserStats(username) {
        return this.userStats[username] || null;
    }
    
    /**
     * Generate a quick manual report (for testing or immediate needs)
     */
    async generateManualReport() {
        this.saveStats();
        return await this.generateCEOReport();
    }
    
    /**
     * Cleanup - save stats before shutdown
     */
    cleanup() {
        this.saveStats();
        log('Leaderboard stats saved on cleanup', 'STATS');
    }
}

module.exports = LeaderboardManager;