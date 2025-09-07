// Pokemon Leaderboard JavaScript - Updated to work with existing HTML structure
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
                this.loadLeaderboardData();
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
        }
    }

    updateLeaderboard(data) {
        try {
            console.log('📊 Updating leaderboard with data:', data);
            
            // Update main stats
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
            
            // Update champion (works with existing HTML structure)
            this.updateChampion(data.champion);
            
            // Update Elite Four (works with existing HTML structure)
            this.updateEliteFour(data.eliteFour);
            
            // Update Gym Leaders (works with existing HTML structure) 
            this.updateGymLeaders(data.gymLeaders);
            
            // Update top commands (works with existing HTML structure)
            this.updateTopCommands(data);
            
        } catch (error) {
            console.error('Failed to update leaderboard:', error);
        }
    }
    
    updateChampion(champion) {
        if (!champion) return;
        
        // Find champion card in existing HTML structure
        const championCard = document.querySelector('.champion-card');
        if (championCard) {
            const nameElement = championCard.querySelector('.trainer-name');
            const voteElement = championCard.querySelector('.vote-count');
            const commandsElement = championCard.querySelector('.command-breakdown');
            
            if (nameElement) nameElement.textContent = champion.username;
            if (voteElement) voteElement.textContent = `${champion.totalVotes.toLocaleString()} VOTES`;
            
            if (commandsElement && champion.commands) {
                // Update command breakdown with real data
                const topCommands = Object.entries(champion.commands)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5);
                    
                commandsElement.innerHTML = topCommands
                    .map(([cmd, count]) => `<span class="breakdown-item">${cmd.toUpperCase()}: ${count}</span>`)
                    .join('');
            }
        }
    }
    
    updateEliteFour(eliteFour) {
        if (!eliteFour || eliteFour.length === 0) return;
        
        // Find elite four cards in existing HTML structure
        const eliteCards = document.querySelectorAll('.elite-card');
        
        eliteFour.slice(0, 4).forEach((member, index) => {
            if (eliteCards[index]) {
                const card = eliteCards[index];
                const nameElement = card.querySelector('.trainer-name');
                const voteElement = card.querySelector('.vote-count');
                const commandsElement = card.querySelector('.command-summary');
                
                if (nameElement) nameElement.textContent = member.username;
                if (voteElement) voteElement.textContent = `${member.totalVotes.toLocaleString()} VOTES`;
                
                if (commandsElement && member.commands) {
                    const topCommands = Object.entries(member.commands)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 3);
                        
                    commandsElement.textContent = topCommands
                        .map(([cmd, count]) => `${cmd.toUpperCase()}: ${count}`)
                        .join(', ');
                }
            }
        });
    }
    
    updateGymLeaders(gymLeaders) {
        if (!gymLeaders || gymLeaders.length === 0) return;
        
        // Find gym cards in existing HTML structure
        const gymCards = document.querySelectorAll('.gym-card');
        
        gymLeaders.slice(0, gymCards.length).forEach((leader, index) => {
            if (gymCards[index]) {
                const card = gymCards[index];
                const nameElement = card.querySelector('.gym-name');
                const voteElement = card.querySelector('.gym-votes');
                
                if (nameElement) nameElement.textContent = leader.username;
                if (voteElement) voteElement.textContent = `${leader.totalVotes.toLocaleString()} votes`;
            }
        });
    }
    
    updateTopCommands(data) {
        // Calculate top commands from all users
        const allCommands = {};
        
        // Aggregate commands from all users
        const allUsers = [data.champion, ...(data.eliteFour || []), ...(data.gymLeaders || [])];
        allUsers.forEach(user => {
            if (user && user.commands) {
                Object.entries(user.commands).forEach(([cmd, count]) => {
                    allCommands[cmd] = (allCommands[cmd] || 0) + count;
                });
            }
        });
        
        const sortedCommands = Object.entries(allCommands)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        // Update existing command items
        const commandItems = document.querySelectorAll('.command-item');
        sortedCommands.forEach((commandData, index) => {
            if (commandItems[index]) {
                const [cmd, count] = commandData;
                const item = commandItems[index];
                const nameElement = item.querySelector('.command-name');
                const countElement = item.querySelector('.command-count');
                
                if (nameElement) nameElement.textContent = cmd.toUpperCase();
                if (countElement) countElement.textContent = count.toLocaleString();
                
                // Update progress bar width based on relative percentage
                const maxCount = sortedCommands[0][1];
                const percentage = (count / maxCount) * 100;
                const fillElement = item.querySelector('.command-fill');
                if (fillElement) {
                    fillElement.style.width = `${percentage}%`;
                }
            }
        });
    }

    showLoadingState() {
        const container = document.querySelector('.game-container');
        if (container) container.classList.add('loading');
    }

    hideLoadingState() {
        const container = document.querySelector('.game-container');
        if (container) container.classList.remove('loading');
    }

    showErrorState() {
        console.log('❌ Failed to load leaderboard data');
        setTimeout(() => {
            this.hideLoadingState();
        }, 3000);
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
        console.log('🔊 *click sound*');
    }

    playRefreshSound() {
        console.log('🔊 *refresh sound*');
    }

    // Method to manually refresh
    manualRefresh() {
        clearInterval(this.countdownTimer);
        this.loadLeaderboardData();
        this.startCountdown();
    }
}

// CSS for additional animations
const additionalCSS = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    @keyframes sparkle {
        0% {
            opacity: 1;
            transform: scale(0) rotate(0deg);
        }
        100% {
            opacity: 0;
            transform: scale(1) rotate(180deg);
        }
    }
    
    .loading {
        opacity: 0.7;
        transition: opacity 0.3s ease;
    }
    
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