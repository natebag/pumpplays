const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { log } = require('../utils/logger');

const execAsync = util.promisify(exec);

/**
 * Surgical HTML updater that ONLY changes data values while preserving exact layout
 * Uses precise string replacements to avoid breaking the structure
 */
class SurgicalHTMLUpdater {
    constructor() {
        this.htmlFile = path.join(__dirname, '../../Leaderboard/index.html');
    }

    /**
     * Update ONLY the data values while keeping exact same layout
     */
    async updateHTML(leaderboardManager) {
        try {
            log('🔧 Surgically updating HTML data while preserving layout...', 'HTML');
            
            // Get fresh data
            const topUsers = leaderboardManager.getTopUsers(20);
            const stats = this.calculateStats(leaderboardManager);
            
            // Read current HTML
            let html = fs.readFileSync(this.htmlFile, 'utf8');
            
            // ONLY update data values with surgical precision
            html = this.updateOnlyNumbers(html, stats, topUsers);
            html = this.updateOnlyTimestamp(html);
            
            // Write back
            fs.writeFileSync(this.htmlFile, html);
            
            log('✅ HTML data updated surgically - layout preserved!', 'HTML');
            
            // Push to GitHub
            await this.pushToGitHub();
            
        } catch (error) {
            log(`❌ Surgical HTML update failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Calculate fresh stats
     */
    calculateStats(leaderboardManager) {
        const allUsers = Object.entries(leaderboardManager.userStats);
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
     * Update ONLY the numbers/names - no structural changes
     */
    updateOnlyNumbers(html, stats, topUsers) {
        // 1. Update basic stats (exact replacements)
        html = html.replace('id="totalUsers">42</span>', `id="totalUsers">${stats.totalUsers}</span>`);
        html = html.replace('id="totalVotes">4,094</span>', `id="totalVotes">${stats.totalVotes.toLocaleString()}</span>`);
        
        // 2. Update commands (replace exact count values only)
        if (stats.topCommands.length >= 5) {
            const maxCount = stats.topCommands[0].count;
            
            stats.topCommands.forEach((cmd, index) => {
                const percentage = Math.round((cmd.count / maxCount) * 100);
                
                // Find the current command sections and replace counts/percentages only
                const oldCommands = ['A', 'DOWN', 'RIGHT', 'LEFT', 'UP'];
                const oldCounts = ['119', '107', '91', '71', '67'];
                const oldPercentages = ['100%', '90%', '76%', '60%', '56%'];
                
                if (index < oldCommands.length) {
                    // Replace command name
                    html = html.replace(
                        `<span class="command-name">${oldCommands[index]}</span>`,
                        `<span class="command-name">${cmd.command}</span>`
                    );
                    
                    // Replace count
                    html = html.replace(
                        `<span class="command-count">${oldCounts[index]}</span>`,
                        `<span class="command-count">${cmd.count}</span>`
                    );
                    
                    // Replace percentage
                    html = html.replace(
                        `style="width: ${oldPercentages[index]}"`,
                        `style="width: ${percentage}%"`
                    );
                }
            });
        }
        
        // 3. Update Champion (exact replacements)
        if (topUsers.length > 0) {
            const champion = topUsers[0];
            const championPercent = ((champion.totalVotes / stats.totalVotes) * 100).toFixed(1);
            
            // Only if champion changed
            if (champion.username.toUpperCase() !== 'CUNO') {
                html = html.replace(
                    '<div class="trainer-name">CUNO</div>',
                    `<div class="trainer-name">${champion.username.toUpperCase()}</div>`
                );
            }
            
            // Update champion vote count
            html = html.replace(
                '<div class="vote-count">1,893 VOTES</div>',
                `<div class="vote-count">${champion.totalVotes.toLocaleString()} VOTES</div>`
            );
            
            // Update champion percentage
            html = html.replace(
                '<span class="breakdown-item">46.2% of total votes</span>',
                `<span class="breakdown-item">${championPercent}% of total votes</span>`
            );
        }
        
        // 4. Update Elite Four (only the data, keep structure)
        const eliteFour = topUsers.slice(1, 5);
        const originalElite = [
            { name: 'DRAGON', votes: '904', percent: '22.1%' },
            { name: 'PUMPPLAYSGUY', votes: '403', percent: '9.8%' },
            { name: 'OBNOXI', votes: '219', percent: '5.3%' },
            { name: 'BEGOTTEN', votes: '110', percent: '2.7%' }
        ];
        
        eliteFour.forEach((user, index) => {
            if (index < originalElite.length) {
                const original = originalElite[index];
                const newPercent = ((user.totalVotes / stats.totalVotes) * 100).toFixed(1);
                
                // Replace name if different
                if (user.username.toUpperCase() !== original.name) {
                    html = html.replace(
                        `<div class="trainer-name">${original.name}</div>`,
                        `<div class="trainer-name">${user.username.toUpperCase()}</div>`
                    );
                }
                
                // Replace vote count
                html = html.replace(
                    `<div class="vote-count">${original.votes} VOTES</div>`,
                    `<div class="vote-count">${user.totalVotes.toLocaleString()} VOTES</div>`
                );
                
                // Replace percentage
                html = html.replace(
                    `<div class="command-summary">${original.percent} of total votes</div>`,
                    `<div class="command-summary">${newPercent}% of total votes</div>`
                );
            }
        });
        
        // 5. Update Gym Leaders (top 3 only to be safe)
        const gymLeaders = topUsers.slice(5, 8);
        const originalGym = [
            { name: 'LUKEBAG', votes: '104' },
            { name: 'HO-OH', votes: '104' },
            { name: 'NATEBAG', votes: '97' }
        ];
        
        gymLeaders.forEach((user, index) => {
            if (index < originalGym.length) {
                const original = originalGym[index];
                
                // Replace name if different
                if (user.username.toUpperCase() !== original.name) {
                    html = html.replace(
                        `<span class="gym-name">${original.name}</span>`,
                        `<span class="gym-name">${user.username.toUpperCase()}</span>`
                    );
                }
                
                // Replace vote count
                html = html.replace(
                    `<span class="gym-votes">${original.votes} votes</span>`,
                    `<span class="gym-votes">${user.totalVotes.toLocaleString()} votes</span>`
                );
            }
        });
        
        return html;
    }
    
    /**
     * Update only the timestamp
     */
    updateOnlyTimestamp(html) {
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        // Update last updated time (exact replacement)
        html = html.replace(
            'id="lastUpdated">9/7/2025 3:36 AM</span>',
            `id="lastUpdated">${timestamp}</span>`
        );
        
        // Update comment
        const commentTimestamp = now.toISOString().slice(0, 16).replace('T', ' ');
        html = html.replace(
            '<!-- Updated 2025-09-07 02:55 - Fixed JSON data loading -->',
            `<!-- Updated ${commentTimestamp} - Auto-updated CEO report data -->`
        );
        
        return html;
    }
    
    /**
     * Push to GitHub
     */
    async pushToGitHub() {
        try {
            log('📤 Pushing surgically updated HTML to GitHub...', 'HTML');
            
            await execAsync('git add Leaderboard/index.html');
            
            const timestamp = new Date().toISOString();
            await execAsync(`git commit -m "📊 Update leaderboard data (surgical) - ${timestamp}"`);
            
            await execAsync('git push origin main');
            
            log('✅ Surgical HTML update pushed to GitHub!', 'HTML');
            
        } catch (error) {
            log(`⚠️ GitHub push failed: ${error.message}`, 'WARN');
            throw error;
        }
    }
}

module.exports = SurgicalHTMLUpdater;