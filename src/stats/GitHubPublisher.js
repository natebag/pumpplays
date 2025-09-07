const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { log } = require('../utils/logger');

/**
 * Publishes leaderboard data to GitHub for the live website
 */
class GitHubPublisher {
    constructor() {
        this.repoPath = process.env.GITHUB_REPO_PATH || 'F:\\coding\\pumpplays-website';
        this.repoUrl = process.env.GITHUB_REPO_URL || 'https://github.com/natebag/pumpplays.git';
        this.branch = process.env.GITHUB_BRANCH || 'main';
        this.leaderboardDataPath = path.join(this.repoPath, 'Leaderboard', 'data');
        
        // Ensure local repo exists
        this.setupRepository();
        
        log('GitHub Publisher initialized', 'GITHUB');
    }
    
    /**
     * Setup the local GitHub repository
     */
    setupRepository() {
        try {
            // Create repo directory if it doesn't exist
            if (!fs.existsSync(this.repoPath)) {
                log('Cloning repository...', 'GITHUB');
                execSync(`git clone ${this.repoUrl} "${this.repoPath}"`, { stdio: 'inherit' });
            }
            
            // Ensure we're on the right branch
            process.chdir(this.repoPath);
            execSync(`git checkout ${this.branch}`, { stdio: 'pipe' });
            execSync('git pull origin ' + this.branch, { stdio: 'pipe' });
            
            // Create data directory if it doesn't exist
            if (!fs.existsSync(this.leaderboardDataPath)) {
                fs.mkdirSync(this.leaderboardDataPath, { recursive: true });
            }
            
            log('GitHub repository ready', 'GITHUB');
            
        } catch (error) {
            log(`GitHub setup error: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Convert LeaderboardManager data to website format
     * @param {Array} users - Array of user objects from LeaderboardManager
     * @returns {Object} Formatted data for website
     */
    formatLeaderboardData(users) {
        if (!users || users.length === 0) {
            return {
                champion: null,
                eliteFour: [],
                gymLeaders: [],
                totalUsers: 0,
                totalVotes: 0,
                lastUpdated: new Date().toISOString(),
                nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // 4 hours from now
            };
        }
        
        // Sort users by total votes (descending)
        const sortedUsers = users
            .map(user => ({
                username: user.username?.toUpperCase() || 'UNKNOWN',
                totalVotes: user.totalVotes || 0,
                totalWeight: user.totalWeight || user.totalVotes || 0,
                rank: 0,
                commands: user.commands || {},
                topCommands: this.getTopCommands(user.commands || {}),
                percentage: 0 // Will be calculated below
            }))
            .sort((a, b) => b.totalVotes - a.totalVotes)
            .map((user, index) => ({ ...user, rank: index + 1 }));
        
        const totalVotes = sortedUsers.reduce((sum, user) => sum + user.totalVotes, 0);
        
        // Calculate percentages
        sortedUsers.forEach(user => {
            user.percentage = totalVotes > 0 ? ((user.totalVotes / totalVotes) * 100).toFixed(1) : '0.0';
        });
        
        // Split into categories (Pokemon League style)
        const champion = sortedUsers[0] || null;
        const eliteFour = sortedUsers.slice(1, 5);
        const gymLeaders = sortedUsers.slice(5, 20); // Top 20 total
        
        return {
            champion,
            eliteFour,
            gymLeaders,
            totalUsers: sortedUsers.length,
            totalVotes,
            lastUpdated: new Date().toISOString(),
            nextUpdate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            analytics: {
                averageVotesPerUser: sortedUsers.length > 0 ? Math.round(totalVotes / sortedUsers.length) : 0,
                topCommands: this.getGlobalTopCommands(sortedUsers),
                championDominance: champion ? `${champion.percentage}%` : '0%'
            }
        };
    }
    
    /**
     * Get top commands for a user
     */
    getTopCommands(commands, limit = 5) {
        return Object.entries(commands)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([command, count]) => ({ command: command.toLowerCase(), count }));
    }
    
    /**
     * Get global top commands across all users
     */
    getGlobalTopCommands(users) {
        const globalCommands = {};
        
        users.forEach(user => {
            Object.entries(user.commands).forEach(([command, count]) => {
                globalCommands[command] = (globalCommands[command] || 0) + count;
            });
        });
        
        return Object.entries(globalCommands)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([command, count]) => ({ command: command.toLowerCase(), count }));
    }
    
    /**
     * Publish leaderboard data to GitHub
     * @param {Object} leaderboardManager - LeaderboardManager instance
     */
    async publishLeaderboard(leaderboardManager) {
        try {
            log('📤 Publishing leaderboard to GitHub...', 'GITHUB');
            
            // Get current user data
            const users = leaderboardManager.getTopUsers(50); // Get top 50 users
            const formattedData = this.formatLeaderboardData(users);
            
            // Create API-style JSON files
            await this.createDataFiles(formattedData);
            
            // Commit and push changes
            await this.commitAndPush(formattedData);
            
            log('✅ Successfully published leaderboard to GitHub', 'GITHUB');
            log(`📊 Published data for ${formattedData.totalUsers} users with ${formattedData.totalVotes} votes`, 'GITHUB');
            
        } catch (error) {
            log(`❌ GitHub publish failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Create the data files that the website will serve
     */
    async createDataFiles(data) {
        // Main leaderboard API file
        const leaderboardFile = path.join(this.leaderboardDataPath, 'leaderboard.json');
        fs.writeFileSync(leaderboardFile, JSON.stringify(data, null, 2));
        
        // Individual API endpoints (for future use)
        const apiDir = path.join(this.leaderboardDataPath, 'api');
        if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
        }
        
        // Champion data
        const championFile = path.join(apiDir, 'champion.json');
        fs.writeFileSync(championFile, JSON.stringify({ champion: data.champion }, null, 2));
        
        // Stats summary
        const statsFile = path.join(apiDir, 'stats.json');
        fs.writeFileSync(statsFile, JSON.stringify({
            totalUsers: data.totalUsers,
            totalVotes: data.totalVotes,
            lastUpdated: data.lastUpdated,
            analytics: data.analytics
        }, null, 2));
        
        // Individual user files (for user lookup)
        const usersDir = path.join(apiDir, 'users');
        if (!fs.existsSync(usersDir)) {
            fs.mkdirSync(usersDir, { recursive: true });
        }
        
        // Create individual user files for top users
        [...(data.champion ? [data.champion] : []), ...data.eliteFour, ...data.gymLeaders]
            .forEach(user => {
                const userFile = path.join(usersDir, `${user.username.toLowerCase()}.json`);
                fs.writeFileSync(userFile, JSON.stringify(user, null, 2));
            });
        
        log('📄 Created data files for website', 'GITHUB');
    }
    
    /**
     * Commit and push changes to GitHub
     */
    async commitAndPush(data) {
        try {
            process.chdir(this.repoPath);
            
            // Add all changes in the Leaderboard/data directory
            execSync('git add Leaderboard/data/', { stdio: 'pipe' });
            
            // Check if there are any changes to commit
            try {
                execSync('git diff --staged --exit-code', { stdio: 'pipe' });
                log('📝 No changes to commit', 'GITHUB');
                return;
            } catch (error) {
                // There are changes to commit (git diff returns non-zero when there are differences)
            }
            
            // Create commit message
            const timestamp = new Date().toISOString();
            const commitMessage = `🎮 Update leaderboard data - ${data.totalUsers} users, ${data.totalVotes} votes\n\n` +
                                `Champion: ${data.champion?.username || 'None'} (${data.champion?.totalVotes || 0} votes)\n` +
                                `Updated: ${timestamp}\n\n` +
                                `🤖 Auto-generated by Pump Plays Pokemon`;
            
            // Commit changes
            execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
            
            // Push to GitHub
            execSync(`git push origin ${this.branch}`, { stdio: 'pipe' });
            
            log('✅ Successfully pushed to GitHub', 'GITHUB');
            
        } catch (error) {
            log(`❌ Git operations failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Test the GitHub connection and permissions
     */
    async testConnection() {
        try {
            process.chdir(this.repoPath);
            
            // Test git status
            execSync('git status', { stdio: 'pipe' });
            
            // Test fetch (to check connectivity)
            execSync('git fetch origin', { stdio: 'pipe' });
            
            log('✅ GitHub connection test successful', 'GITHUB');
            return true;
            
        } catch (error) {
            log(`❌ GitHub connection test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    /**
     * Manual publish trigger (for testing)
     */
    async manualPublish(leaderboardManager) {
        log('🔄 Manual publish triggered', 'GITHUB');
        await this.publishLeaderboard(leaderboardManager);
    }
}

module.exports = GitHubPublisher;