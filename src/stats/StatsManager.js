const fs = require('fs').promises;
const path = require('path');
const { log } = require('../utils/logger');

class StatsManager {
    constructor() {
        this.reportsDir = path.join(__dirname, '../../reports');
        this.leaderboard = [];
        this.lastUpdate = null;
        
        // Load initial data
        this.loadLatestReport();
    }
    
    async loadLatestReport() {
        try {
            // Look for CEO reports in reports directory
            const files = await fs.readdir(this.reportsDir);
            const ceoReports = files
                .filter(file => file.includes('CEO_Report') && file.endsWith('.json'))
                .sort()
                .reverse(); // Latest first
            
            if (ceoReports.length === 0) {
                log('No CEO reports found, using sample data', 'STATS');
                this.createSampleLeaderboard();
                return;
            }
            
            const latestReport = ceoReports[0];
            const reportPath = path.join(this.reportsDir, latestReport);
            const data = await fs.readFile(reportPath, 'utf8');
            const report = JSON.parse(data);
            
            // Extract user stats and create leaderboard
            this.processReport(report);
            log(`Loaded leaderboard from ${latestReport}`, 'STATS');
            
        } catch (error) {
            log(`Failed to load CEO reports: ${error.message}`, 'ERROR');
            this.createSampleLeaderboard();
        }
    }
    
    processReport(report) {
        // Extract user data from CEO report
        if (report.user_stats) {
            this.leaderboard = Object.entries(report.user_stats)
                .map(([username, stats]) => ({
                    username,
                    totalVotes: stats.total_votes || 0,
                    commands: stats.commands || {},
                    rank: 0 // Will be set after sorting
                }))
                .sort((a, b) => b.totalVotes - a.totalVotes)
                .map((user, index) => ({
                    ...user,
                    rank: index + 1
                }));
        } else {
            this.createSampleLeaderboard();
        }
        
        this.lastUpdate = new Date();
    }
    
    createSampleLeaderboard() {
        // Sample data based on the leaderboard website
        this.leaderboard = [
            { username: 'PUMPPLAYSGUY', totalVotes: 220, rank: 1, commands: { DOWN: 50, A: 45, UP: 40, RIGHT: 30, B: 28 } },
            { username: 'OBNOXI', totalVotes: 219, rank: 2, commands: { A: 57, RIGHT: 53, DOWN: 43 } },
            { username: 'LUKEBAG', totalVotes: 20, rank: 3, commands: { RIGHT: 6, DOWN: 5, B: 3 } },
            { username: '1984BOT', totalVotes: 15, rank: 4, commands: { A: 12, DOWN: 3 } },
            { username: 'AHHW3J', totalVotes: 10, rank: 5, commands: { UP: 8, LEFT: 1, RIGHT: 1 } },
            { username: 'J8MJ3X', totalVotes: 9, rank: 6, commands: { A: 9 } },
            { username: 'NUFFINMAN', totalVotes: 7, rank: 7, commands: { DOWN: 7 } },
            { username: 'J7J4O1', totalVotes: 6, rank: 8, commands: { UP: 6 } },
            { username: '9SCITH', totalVotes: 2, rank: 9, commands: { RIGHT: 2 } },
            { username: 'NATEBAG', totalVotes: 2, rank: 10, commands: { LEFT: 2 } },
            { username: 'A3JTJCXX', totalVotes: 1, rank: 11, commands: { A: 1 } },
            { username: 'WB1', totalVotes: 1, rank: 12, commands: { B: 1 } }
        ];
        
        this.lastUpdate = new Date();
        log('Using sample leaderboard data', 'STATS');
    }
    
    getLeaderboard() {
        return {
            users: this.leaderboard,
            lastUpdate: this.lastUpdate,
            totalUsers: this.leaderboard.length,
            totalVotes: this.leaderboard.reduce((sum, user) => sum + user.totalVotes, 0)
        };
    }
    
    getUserRank(username) {
        const user = this.leaderboard.find(u => 
            u.username.toUpperCase() === username.toUpperCase()
        );
        return user ? user.rank : null;
    }
    
    isUserOnLeaderboard(username) {
        return this.getUserRank(username) !== null;
    }
    
    getTopCommands() {
        const commandTotals = {};
        
        this.leaderboard.forEach(user => {
            Object.entries(user.commands).forEach(([command, count]) => {
                commandTotals[command] = (commandTotals[command] || 0) + count;
            });
        });
        
        return Object.entries(commandTotals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([command, count]) => ({ command, count }));
    }
    
    async refresh() {
        await this.loadLatestReport();
        return this.getLeaderboard();
    }
}

module.exports = StatsManager;