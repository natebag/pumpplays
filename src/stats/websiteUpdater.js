const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');
const { execSync } = require('child_process');

/**
 * Updates the pumpplays-website HTML with current leaderboard stats
 * This runs after each CEO report to keep the website current
 */
class WebsiteUpdater {
    constructor() {
        this.websitePath = 'F:\\coding\\pumpplays-website';
        this.htmlPath = path.join(this.websitePath, 'Leaderboard', 'index.html');
    }

    /**
     * Update the website HTML with current stats
     * @param {Object} leaderboardData - Current leaderboard data
     */
    async updateWebsiteHTML(leaderboardData) {
        try {
            log('📝 Updating website HTML with current stats...', 'WEBSITE');
            
            // Check if website directory exists
            if (!fs.existsSync(this.websitePath)) {
                log('Website directory not found, skipping HTML update', 'WEBSITE');
                return false;
            }

            // Read current HTML
            let html = fs.readFileSync(this.htmlPath, 'utf8');
            
            // Update main stats
            html = html.replace(
                /<span class="stat-value" id="totalUsers">.*?<\/span>/,
                `<span class="stat-value" id="totalUsers">${leaderboardData.totalUsers}</span>`
            );
            
            html = html.replace(
                /<span class="stat-value" id="totalVotes">.*?<\/span>/,
                `<span class="stat-value" id="totalVotes">${leaderboardData.totalVotes.toLocaleString()}</span>`
            );
            
            // Update last updated time
            const now = new Date();
            const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
            html = html.replace(
                /<span class="stat-value" id="lastUpdated">.*?<\/span>/,
                `<span class="stat-value" id="lastUpdated">${formattedDate}</span>`
            );
            
            // Update champion section
            if (leaderboardData.champion) {
                const champion = leaderboardData.champion;
                
                // Update champion name
                html = html.replace(
                    /<div class="trainer-name">(.*?)<\/div>\s*<div class="trainer-title">CHAMPION<\/div>/,
                    `<div class="trainer-name">${champion.username}</div>\n                    <div class="trainer-title">CHAMPION</div>`
                );
                
                // Update champion votes
                html = html.replace(
                    /<div class="vote-count">.*?VOTES<\/div>/,
                    `<div class="vote-count">${champion.totalVotes.toLocaleString()} VOTES</div>`
                );
                
                // Update champion commands/percentage
                const commandBreakdown = champion.percentage ? 
                    `<span class="breakdown-item">${champion.percentage}% of total votes</span>` :
                    `<span class="breakdown-item">Total: ${champion.totalVotes}</span>`;
                    
                html = html.replace(
                    /<div class="command-breakdown">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<!-- Elite Four/,
                    `<div class="command-breakdown">\n                    ${commandBreakdown}\n                </div>\n            </div>\n\n            <!-- Elite Four`
                );
            }
            
            // Update Elite Four
            if (leaderboardData.eliteFour && leaderboardData.eliteFour.length > 0) {
                const elitePatterns = [
                    /<div class="rank-badge elite">2<\/div>[\s\S]*?<div class="command-summary">.*?<\/div>/,
                    /<div class="rank-badge elite">3<\/div>[\s\S]*?<div class="command-summary">.*?<\/div>/,
                    /<div class="rank-badge elite">4<\/div>[\s\S]*?<div class="command-summary">.*?<\/div>/,
                    /<div class="rank-badge elite">5<\/div>[\s\S]*?<div class="command-summary">.*?<\/div>/
                ];
                
                leaderboardData.eliteFour.slice(0, 4).forEach((member, index) => {
                    if (elitePatterns[index]) {
                        const replacement = `<div class="rank-badge elite">${index + 2}</div>
                    <div class="trainer-info">
                        <div class="trainer-name">${member.username}</div>
                        <div class="trainer-title">ELITE FOUR</div>
                        <div class="vote-count">${member.totalVotes.toLocaleString()} VOTES</div>
                    </div>
                    <div class="command-summary">${member.percentage || '0'}% of total votes</div>`;
                        
                        html = html.replace(elitePatterns[index], replacement);
                    }
                });
            }
            
            // Update Gym Leaders (top 7)
            if (leaderboardData.gymLeaders && leaderboardData.gymLeaders.length > 0) {
                const gymPatterns = [
                    /<div class="rank-badge gym">6<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">7<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">8<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">9<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">10<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">11<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/,
                    /<div class="rank-badge gym">12<\/div>[\s\S]*?<span class="gym-votes">.*?<\/span>/
                ];
                
                leaderboardData.gymLeaders.slice(0, 7).forEach((leader, index) => {
                    if (gymPatterns[index]) {
                        const replacement = `<div class="rank-badge gym">${index + 6}</div>
                        <div class="gym-info">
                            <span class="gym-name">${leader.username}</span>
                            <span class="gym-votes">${leader.totalVotes.toLocaleString()} votes</span>`;
                        
                        html = html.replace(gymPatterns[index], replacement);
                    }
                });
            }
            
            // Write updated HTML
            fs.writeFileSync(this.htmlPath, html);
            log(`✅ Website HTML updated with ${leaderboardData.totalUsers} users, ${leaderboardData.totalVotes} votes`, 'WEBSITE');
            
            // Commit and push changes
            await this.pushToGitHub();
            
            return true;
            
        } catch (error) {
            log(`Failed to update website HTML: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    /**
     * Commit and push HTML changes to GitHub
     */
    async pushToGitHub() {
        try {
            // Change to website directory
            process.chdir(this.websitePath);
            
            // Check if there are changes
            const status = execSync('git status --porcelain').toString();
            if (!status.includes('Leaderboard/index.html')) {
                log('No HTML changes to commit', 'WEBSITE');
                return;
            }
            
            // Add and commit
            execSync('git add Leaderboard/index.html');
            
            const commitMessage = `Auto-update leaderboard HTML with current stats

📊 Automated update from CEO report generation
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;
            
            execSync(`git commit -m "${commitMessage}"`);
            
            // Push to GitHub
            execSync('git push origin main');
            
            log('✅ Website HTML changes pushed to GitHub', 'WEBSITE');
            
            // Change back to main directory
            process.chdir('F:\\coding\\PUMPPLAYSPOKEMON');
            
        } catch (error) {
            log(`Failed to push HTML to GitHub: ${error.message}`, 'ERROR');
            // Change back to main directory even on error
            process.chdir('F:\\coding\\PUMPPLAYSPOKEMON');
        }
    }
}

module.exports = WebsiteUpdater;