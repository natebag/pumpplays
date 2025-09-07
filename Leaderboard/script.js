// Pokemon Leaderboard JavaScript
class PokemonLeaderboard {
    constructor() {
        this.refreshInterval = 300; // 5 minutes in seconds
        this.countdownTimer = null;
        this.apiEndpoint = 'data/leaderboard.json'; // JSON data file
        
        this.init();
    }

    init() {
        // Load data immediately on page load
        this.loadLeaderboardData();
        
        this.startCountdown();
        this.addAnimations();
        this.setupEventListeners();
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.loadLeaderboardData();
        }, this.refreshInterval * 1000);

        console.log('🎮 Pokemon Leaderboard initialized!');
    }

    startCountdown() {
        let timeLeft = this.refreshInterval;
        const countdownElement = document.getElementById('countdown');
        
        this.countdownTimer = setInterval(() => {
            timeLeft--;
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                timeLeft = this.refreshInterval;
                this.refreshData();
            }
        }, 1000);
    }

    async loadLeaderboardData() {
        console.log('🔄 Loading leaderboard data...');
        
        try {
            // Show loading state
            this.showLoadingState();
            
            // Fetch the actual JSON data
            const response = await fetch(this.apiEndpoint + '?t=' + Date.now()); // Add timestamp to prevent caching
            const data = await response.json();
            
            // Update the UI with real data
            this.updateLeaderboard(data);
            
            this.hideLoadingState();
            this.playRefreshSound();
            
            console.log('✅ Leaderboard data updated successfully', data);
            
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            this.showErrorState();
            
            // Fallback to parsing local report if JSON fetch fails
            try {
                await this.parseLatestReport();
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
            }
        }
    }
    
    async refreshData() {
        // This is now just an alias for loadLeaderboardData
        await this.loadLeaderboardData();
    }

    updateLeaderboard(data) {
        try {
            console.log('📊 Updating leaderboard with data:', data);
            
            // Update stats
            const totalUsersElement = document.getElementById('totalUsers');
            const totalVotesElement = document.getElementById('totalVotes');
            const lastUpdatedElement = document.getElementById('lastUpdated');
            
            if (totalUsersElement) totalUsersElement.textContent = data.totalUsers || 0;
            if (totalVotesElement) totalVotesElement.textContent = (data.totalVotes || 0).toLocaleString();
            if (lastUpdatedElement) {
                const date = new Date(data.lastUpdated);
                lastUpdatedElement.textContent = date.toLocaleDateString() + ' ' + 
                                                date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
            
            // Update champion
            this.updateChampion(data.champion);
            
            // Update Elite Four
            this.updateEliteFour(data.eliteFour);
            
            // Update Gym Leaders
            this.updateGymLeaders(data.gymLeaders);
            
            // Update top commands
            this.updateTopCommands(data);
            
        } catch (error) {
            console.error('Failed to update leaderboard:', error);
        }
    }

    showLoadingState() {
        const container = document.querySelector('.game-container');
        container.classList.add('loading');
        
        const refreshIndicator = document.getElementById('refreshIndicator');
        if (refreshIndicator) {
            refreshIndicator.innerHTML = '<span>🔄 Updating leaderboard...</span>';
        }
    }

    hideLoadingState() {
        const container = document.querySelector('.game-container');
        container.classList.remove('loading');
        
        const refreshIndicator = document.getElementById('refreshIndicator');
        if (refreshIndicator) {
            const timeLeft = this.refreshInterval;
            refreshIndicator.innerHTML = `<span>🔄 Auto-refresh in <span id="countdown">${timeLeft}</span>s</span>`;
        }
    }

    showErrorState() {
        const refreshIndicator = document.getElementById('refreshIndicator');
        if (refreshIndicator) {
            refreshIndicator.innerHTML = '<span>❌ Update failed - retrying...</span>';
        }
        
        setTimeout(() => {
            this.hideLoadingState();
        }, 3000);
    }

    simulateLoading() {
        return new Promise(resolve => {
            setTimeout(resolve, 1000 + Math.random() * 2000); // 1-3 seconds
        });
    }
    
    updateChampion(champion) {
        if (!champion) return;
        
        const championElement = document.querySelector('.champion-card');
        if (championElement) {
            championElement.querySelector('.trainer-name').textContent = champion.username;
            championElement.querySelector('.trainer-score').textContent = `${champion.totalVotes} VOTES`;
            
            // Update champion commands
            const commandsText = Object.entries(champion.commands || {})
                .slice(0, 5)
                .map(([cmd, count]) => `${cmd.toUpperCase()}: ${count}`)
                .join(', ') || `Total: ${champion.totalVotes}`;
            championElement.querySelector('.trainer-commands').textContent = commandsText;
        }
    }
    
    updateEliteFour(eliteFour) {
        if (!eliteFour) return;
        
        const eliteFourElements = document.querySelectorAll('.elite-four-member');
        eliteFour.slice(0, 4).forEach((member, index) => {
            if (eliteFourElements[index]) {
                const element = eliteFourElements[index];
                element.querySelector('.trainer-name').textContent = member.username;
                element.querySelector('.trainer-score').textContent = `${member.totalVotes} VOTES`;
                
                const commandsText = Object.entries(member.commands || {})
                    .slice(0, 3)
                    .map(([cmd, count]) => `${cmd.toUpperCase()}: ${count}`)
                    .join(', ') || `Total: ${member.totalVotes}`;
                element.querySelector('.trainer-commands').textContent = commandsText;
            }
        });
    }
    
    updateGymLeaders(gymLeaders) {
        if (!gymLeaders) return;
        
        const gymLeadersList = document.querySelector('.gym-leaders-list');
        if (!gymLeadersList) return;
        
        gymLeadersList.innerHTML = '';
        gymLeaders.forEach((leader, index) => {
            const leaderElement = document.createElement('div');
            leaderElement.className = 'gym-leader';
            leaderElement.innerHTML = `
                <span class="rank">${leader.rank || (index + 6)}</span>
                <span class="trainer-name">${leader.username}</span>
                <span class="trainer-score">${leader.totalVotes} votes</span>
            `;
            gymLeadersList.appendChild(leaderElement);
        });
    }
    
    updateTopCommands(data) {
        // Calculate top commands from all users
        const allCommands = {};
        
        if (data.champion && data.champion.commands) {
            Object.entries(data.champion.commands).forEach(([cmd, count]) => {
                allCommands[cmd] = (allCommands[cmd] || 0) + count;
            });
        }
        
        [...(data.eliteFour || []), ...(data.gymLeaders || [])]
            .forEach(user => {
                if (user.commands) {
                    Object.entries(user.commands).forEach(([cmd, count]) => {
                        allCommands[cmd] = (allCommands[cmd] || 0) + count;
                    });
                }
            });
        
        const sortedCommands = Object.entries(allCommands)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        const commandsList = document.querySelector('.popular-commands');
        if (commandsList) {
            commandsList.innerHTML = '';
            sortedCommands.forEach(([cmd, count]) => {
                const cmdElement = document.createElement('div');
                cmdElement.className = 'command-item';
                cmdElement.innerHTML = `
                    <span class="command-name">${cmd.toUpperCase()}</span>
                    <span class="command-count">${count}</span>
                `;
                commandsList.appendChild(cmdElement);
            });
        }
    }

    addAnimations() {
        // Add entrance animations to cards
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        });

        // Animate leaderboard cards on scroll
        const cards = document.querySelectorAll('.elite-card, .gym-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
            observer.observe(card);
        });

        // Animate command bars
        setTimeout(() => {
            const commandFills = document.querySelectorAll('.command-fill');
            commandFills.forEach((fill, index) => {
                setTimeout(() => {
                    const width = fill.style.width;
                    fill.style.width = '0%';
                    setTimeout(() => {
                        fill.style.width = width;
                    }, 100);
                }, index * 200);
            });
        }, 500);
    }

    setupEventListeners() {
        // Add click effects to cards
        const cards = document.querySelectorAll('.elite-card, .gym-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                this.playClickSound();
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
            });
        });

        // Konami code easter egg
        this.setupKonamiCode();
    }

    setupKonamiCode() {
        const konamiCode = [
            'ArrowUp', 'ArrowUp', 
            'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 
            'ArrowLeft', 'ArrowRight',
            'KeyB', 'KeyA'
        ];
        let konamiIndex = 0;

        document.addEventListener('keydown', (e) => {
            if (e.code === konamiCode[konamiIndex]) {
                konamiIndex++;
                if (konamiIndex === konamiCode.length) {
                    this.activateEasterEgg();
                    konamiIndex = 0;
                }
            } else {
                konamiIndex = 0;
            }
        });
    }

    activateEasterEgg() {
        console.log('🎉 KONAMI CODE ACTIVATED!');
        
        // Add special effects
        document.body.style.animation = 'pulse 0.5s ease 3';
        
        // Show special message
        const specialMessage = document.createElement('div');
        specialMessage.innerHTML = `
            <div style="
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%);
                background: linear-gradient(45deg, #ffd700, #ffed4a);
                color: #000000;
                padding: 20px;
                border: 4px solid #ffffff;
                border-radius: 12px;
                font-family: 'Press Start 2P';
                font-size: 12px;
                text-align: center;
                z-index: 10000;
                box-shadow: 0 0 20px rgba(255,215,0,0.5);
            ">
                🎉 SECRET POKEMON MASTER! 🎉<br>
                <span style="font-size: 8px;">You've unlocked the Konami Code!</span>
            </div>
        `;
        
        document.body.appendChild(specialMessage);
        
        setTimeout(() => {
            document.body.removeChild(specialMessage);
        }, 3000);
        
        // Add sparkle effects
        this.createSparkles();
    }

    createSparkles() {
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.innerHTML = '⭐';
                sparkle.style.position = 'fixed';
                sparkle.style.left = Math.random() * window.innerWidth + 'px';
                sparkle.style.top = Math.random() * window.innerHeight + 'px';
                sparkle.style.fontSize = '20px';
                sparkle.style.pointerEvents = 'none';
                sparkle.style.animation = 'sparkle 2s ease-out forwards';
                sparkle.style.zIndex = '9999';
                
                document.body.appendChild(sparkle);
                
                setTimeout(() => {
                    if (document.body.contains(sparkle)) {
                        document.body.removeChild(sparkle);
                    }
                }, 2000);
            }, i * 100);
        }
    }

    playClickSound() {
        // Pokemon-style click sound (would need audio files)
        console.log('🔊 *click sound*');
    }

    playRefreshSound() {
        // Pokemon-style refresh sound
        console.log('🔊 *refresh sound*');
    }

    // Method to update leaderboard display with new data from GitHub
    updateLeaderboardDisplay(data) {
        console.log('📊 Updating leaderboard display with GitHub data:', data);
        
        // Update stats
        if (data.totalUsers) {
            const element = document.getElementById('totalUsers');
            if (element) element.textContent = data.totalUsers.toLocaleString();
        }
        
        if (data.totalVotes) {
            const element = document.getElementById('totalVotes');
            if (element) element.textContent = data.totalVotes.toLocaleString();
        }
        
        // Update champion
        if (data.champion) {
            this.updateChampionDisplay(data.champion);
        }
        
        // Update Elite Four
        if (data.eliteFour && data.eliteFour.length > 0) {
            this.updateEliteFourDisplay(data.eliteFour);
        }
        
        // Update Gym Leaders
        if (data.gymLeaders && data.gymLeaders.length > 0) {
            this.updateGymLeadersDisplay(data.gymLeaders);
        }
        
        // Update last updated timestamp
        if (data.lastUpdated) {
            const lastUpdatedElement = document.getElementById('lastUpdated');
            if (lastUpdatedElement) {
                const date = new Date(data.lastUpdated);
                lastUpdatedElement.textContent = date.toLocaleDateString() + ' ' + 
                                               date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
        }
        
        // Store data for later use
        this.currentData = data;
    }
    
    updateChampionDisplay(champion) {
        const championCard = document.querySelector('.champion-card');
        if (!championCard || !champion) return;
        
        const nameElement = championCard.querySelector('.champion-name');
        const votesElement = championCard.querySelector('.champion-votes');
        const commandsElement = championCard.querySelector('.champion-commands');
        
        if (nameElement) nameElement.textContent = champion.username;
        if (votesElement) votesElement.textContent = `${champion.totalVotes.toLocaleString()} votes`;
        
        if (commandsElement && champion.topCommands) {
            commandsElement.innerHTML = champion.topCommands
                .slice(0, 3)
                .map(cmd => `<span class="command-badge">${cmd.command}: ${cmd.count}</span>`)
                .join(' ');
        }
    }
    
    updateEliteFourDisplay(eliteFour) {
        eliteFour.forEach((user, index) => {
            const card = document.querySelector(`[data-rank="${index + 2}"]`);
            if (!card) return;
            
            const nameElement = card.querySelector('.elite-name');
            const votesElement = card.querySelector('.elite-votes');
            const percentElement = card.querySelector('.elite-percent');
            
            if (nameElement) nameElement.textContent = user.username;
            if (votesElement) votesElement.textContent = `${user.totalVotes.toLocaleString()} votes`;
            if (percentElement) percentElement.textContent = `${user.percentage}%`;
        });
    }
    
    updateGymLeadersDisplay(gymLeaders) {
        const gymContainer = document.querySelector('.gym-leaders');
        if (!gymContainer) return;
        
        // Clear existing gym leaders
        const existingCards = gymContainer.querySelectorAll('.gym-card:not(.template)');
        existingCards.forEach(card => card.remove());
        
        // Add new gym leaders
        gymLeaders.forEach((user, index) => {
            const card = this.createGymLeaderCard(user, index + 6); // Rank starts at 6
            gymContainer.appendChild(card);
        });
    }
    
    createGymLeaderCard(user, rank) {
        const card = document.createElement('div');
        card.className = 'gym-card';
        card.innerHTML = `
            <div class="rank-badge">#${rank}</div>
            <div class="gym-info">
                <div class="gym-name">${user.username}</div>
                <div class="gym-votes">${user.totalVotes.toLocaleString()} votes</div>
                <div class="gym-percent">${user.percentage}%</div>
            </div>
            <div class="gym-commands">
                ${user.topCommands ? user.topCommands.slice(0, 3)
                    .map(cmd => `<span class="command-mini">${cmd.command}: ${cmd.count}</span>`)
                    .join(' ') : ''}
            </div>
        `;
        return card;
    }

    // Method to update leaderboard with new data (legacy method)
    updateLeaderboard(newData) {
        // Redirect to new method for compatibility
        this.updateLeaderboardDisplay(newData);
    }

    // Method to manually refresh (could be called from a button)
    manualRefresh() {
        clearInterval(this.countdownTimer);
        this.refreshData();
        this.startCountdown();
    }
}

// CSS for additional animations
const additionalCSS = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    .animate-slide-in {
        animation: slideIn 0.6s ease-out forwards;
    }
    
    @keyframes bounceIn {
        0% {
            opacity: 0;
            transform: scale(0.3);
        }
        50% {
            opacity: 1;
            transform: scale(1.05);
        }
        70% {
            transform: scale(0.9);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }
    
    .animate-bounce-in {
        animation: bounceIn 0.8s ease-out forwards;
    }
`;

// Inject additional CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);

// Initialize the leaderboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pokemonLeaderboard = new PokemonLeaderboard();
});

// Global functions for manual control
window.refreshLeaderboard = () => {
    if (window.pokemonLeaderboard) {
        window.pokemonLeaderboard.manualRefresh();
    }
};

// Console commands for debugging/fun
console.log(`
🎮 POKEMON LEADERBOARD LOADED! 🎮

Commands:
- refreshLeaderboard() - Manual refresh
- Try the Konami Code: ↑↑↓↓←→←→BA

Built with ❤️ for Pump Plays Pokemon
`);

export { PokemonLeaderboard };