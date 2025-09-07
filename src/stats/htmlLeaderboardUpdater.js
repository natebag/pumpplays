const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { log } = require('../utils/logger');

const execAsync = util.promisify(exec);

/**
 * Updates the local Leaderboard HTML file and pushes to GitHub
 * Simple string replacement approach to avoid regex complexity
 */
class HTMLLeaderboardUpdater {
    constructor() {
        this.htmlFile = path.join(__dirname, '../../Leaderboard/index.html');
    }

    /**
     * Update the HTML file with fresh leaderboard data
     */
    async updateHTML(leaderboardManager) {
        try {
            log('🎨 Updating Leaderboard HTML with fresh data...', 'HTML');
            
            // Get current leaderboard data
            const topUsers = leaderboardManager.getTopUsers(20);
            const stats = this.calculateStats(leaderboardManager);
            
            // Read the current HTML
            let html = fs.readFileSync(this.htmlFile, 'utf8');
            
            // Update the HTML with fresh data using simple string replacements
            html = this.updateBasicStats(html, stats);
            html = this.updateTimestamp(html);
            html = this.updatePopularCommands(html, stats.topCommands);
            html = this.updateChampion(html, topUsers[0], stats);
            html = this.updateEliteFour(html, topUsers.slice(1, 5), stats);
            html = this.updateGymLeaders(html, topUsers.slice(5, 12));
            
            // Write the updated HTML
            fs.writeFileSync(this.htmlFile, html);
            
            log('✅ HTML file updated successfully', 'HTML');
            
            // Push to GitHub
            await this.pushToGitHub();
            
        } catch (error) {
            log(`❌ Error updating HTML: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Calculate statistics from leaderboard data
     */
    calculateStats(leaderboardManager) {
        const allUsers = Object.entries(leaderboardManager.userStats);
        const totalUsers = allUsers.length;
        const totalVotes = allUsers.reduce((sum, [, stats]) => sum + stats.totalVotes, 0);
        
        // Calculate top commands across all users
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
        
        return {
            totalUsers,
            totalVotes,
            topCommands
        };
    }
    
    /**
     * Update basic stats (simple find/replace)
     */
    updateBasicStats(html, stats) {
        // Update total users
        html = html.replace(
            '<span class="stat-value" id="totalUsers">42</span>',
            `<span class="stat-value" id="totalUsers">${stats.totalUsers}</span>`
        );
        
        // Update total votes (handle formatting)
        html = html.replace(
            /<span class="stat-value" id="totalVotes">[\d,]+<\/span>/,
            `<span class="stat-value" id="totalVotes">${stats.totalVotes.toLocaleString()}</span>`
        );
        
        return html;
    }
    
    /**
     * Update timestamp
     */
    updateTimestamp(html) {
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        // Update last updated time
        html = html.replace(
            /<span class="stat-value" id="lastUpdated">[^<]*<\/span>/,
            `<span class="stat-value" id="lastUpdated">${timestamp}</span>`
        );
        
        // Update comment at top
        const commentTimestamp = now.toISOString().slice(0, 16).replace('T', ' ');
        html = html.replace(
            /<!-- Updated \d{4}-\d{2}-\d{2} \d{2}:\d{2}[^>]*-->/,
            `<!-- Updated ${commentTimestamp} - Auto-generated CEO report -->`
        );
        
        return html;
    }
    
    /**
     * Update popular commands (replace specific commands)
     */
    updatePopularCommands(html, topCommands) {
        if (topCommands.length === 0) return html;
        
        const maxCount = topCommands[0].count;
        
        // Replace each command individually
        topCommands.forEach((cmd, index) => {
            const percentage = Math.round((cmd.count / maxCount) * 100);
            
            // Find and replace the specific command entry
            const commandPattern = new RegExp(
                `(<div class="command-item">\\s*<span class="command-name">)[^<]*(</span>\\s*<div class="command-bar">\\s*<div class="command-fill" style="width: )[^%]*(%;*"></div>\\s*<span class="command-count">)[^<]*(</span>)`,
                'g'
            );
            
            let replacements = 0;
            html = html.replace(commandPattern, (match, p1, p2, p3, p4) => {
                if (replacements < index) {
                    replacements++;
                    return match; // Skip this match
                } else if (replacements === index) {
                    replacements++;
                    return `${p1}${cmd.command}${p2}${percentage}${p3}${cmd.count}${p4}`;
                }
                return match;
            });
        });
        
        return html;
    }
    
    /**
     * Update champion info
     */
    updateChampion(html, champion, stats) {
        if (!champion) return html;
        
        const percentage = ((champion.totalVotes / stats.totalVotes) * 100).toFixed(1);
        
        // Update champion name
        html = html.replace(
            '<div class="trainer-name">CUNO</div>',
            `<div class="trainer-name">${champion.username.toUpperCase()}</div>`
        );
        
        // Update champion votes
        html = html.replace(
            /<div class="vote-count">[\d,]+ VOTES<\/div>/,
            `<div class="vote-count">${champion.totalVotes.toLocaleString()} VOTES</div>`
        );
        
        // Update champion percentage
        html = html.replace(
            /<span class="breakdown-item">[\d.]+% of total votes<\/span>/,
            `<span class="breakdown-item">${percentage}% of total votes</span>`
        );
        
        return html;
    }
    
    /**
     * Update Elite Four members
     */
    updateEliteFour(html, eliteFour, stats) {
        const names = ['DRAGON', 'PUMPPLAYSGUY', 'OBNOXI', 'BEGOTTEN'];
        
        eliteFour.forEach((user, index) => {
            if (index >= names.length) return;
            
            const percentage = ((user.totalVotes / stats.totalVotes) * 100).toFixed(1);
            
            // Replace name
            html = html.replace(
                `<div class="trainer-name">${names[index]}</div>`,
                `<div class="trainer-name">${user.username.toUpperCase()}</div>`
            );
            
            // Replace vote count (find the next occurrence after the name)
            const nameIndex = html.indexOf(`<div class="trainer-name">${user.username.toUpperCase()}</div>`);
            const votePattern = /<div class="vote-count">[\d,]+ VOTES<\/div>/;
            const beforeName = html.substring(0, nameIndex);
            const afterName = html.substring(nameIndex);
            const afterNameUpdated = afterName.replace(votePattern, `<div class="vote-count">${user.totalVotes.toLocaleString()} VOTES</div>`);
            html = beforeName + afterNameUpdated;
            
            // Replace percentage
            const summaryPattern = /<div class="command-summary">[\d.]+% of total votes<\/div>/;
            const nameIndex2 = html.indexOf(`<div class="trainer-name">${user.username.toUpperCase()}</div>`);
            const beforeName2 = html.substring(0, nameIndex2);
            const afterName2 = html.substring(nameIndex2);
            const afterNameUpdated2 = afterName2.replace(summaryPattern, `<div class="command-summary">${percentage}% of total votes</div>`);
            html = beforeName2 + afterNameUpdated2;
        });
        
        return html;
    }
    
    /**
     * Update Gym Leaders
     */
    updateGymLeaders(html, gymLeaders) {
        const names = ['LUKEBAG', 'HO-OH', 'NATEBAG'];
        
        gymLeaders.forEach((user, index) => {
            if (index >= names.length) return;
            
            // Replace name
            html = html.replace(
                `<span class="gym-name">${names[index]}</span>`,
                `<span class="gym-name">${user.username.toUpperCase()}</span>`
            );
            
            // Replace votes (find the next votes after this name)
            const nameIndex = html.indexOf(`<span class="gym-name">${user.username.toUpperCase()}</span>`);
            const beforeName = html.substring(0, nameIndex);
            const afterName = html.substring(nameIndex);
            const votePattern = /<span class="gym-votes">[\d,]+ votes<\/span>/;
            const afterNameUpdated = afterName.replace(votePattern, `<span class="gym-votes">${user.totalVotes.toLocaleString()} votes</span>`);
            html = beforeName + afterNameUpdated;
        });
        
        return html;
    }
    
    /**
     * Push the updated HTML to GitHub
     */
    async pushToGitHub() {
        try {
            log('📤 Pushing updated leaderboard to GitHub...', 'HTML');
            
            // Add only the HTML file
            await execAsync('git add Leaderboard/index.html');
            
            // Commit with timestamp
            const timestamp = new Date().toISOString();
            await execAsync(`git commit -m "🏆 Update leaderboard HTML - ${timestamp}"`);
            
            // Push to main branch
            await execAsync('git push origin main');
            
            log('✅ Leaderboard HTML successfully pushed to GitHub!', 'HTML');
            
        } catch (error) {
            log(`⚠️ GitHub push failed: ${error.message}`, 'WARN');
            throw error;
        }
    }
}

module.exports = HTMLLeaderboardUpdater;