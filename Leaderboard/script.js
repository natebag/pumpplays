// Pokemon Leaderboard JavaScript
class PokemonLeaderboard {
    constructor() {
        this.refreshInterval = 300; // 5 minutes in seconds
        this.countdownTimer = null;
        this.apiEndpoint = '/api/leaderboard'; // Will need to create this endpoint
        
        this.init();
    }

    init() {
        this.startCountdown();
        this.addAnimations();
        this.setupEventListeners();
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            this.refreshData();
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

    async refreshData() {
        console.log('🔄 Refreshing leaderboard data...');
        
        try {
            // Show loading state
            this.showLoadingState();
            
            // In the future, we'll fetch from the actual API
            // const response = await fetch(this.apiEndpoint);
            // const data = await response.json();
            
            // For now, simulate loading
            await this.simulateLoading();
            
            // Parse latest CEO report
            await this.parseLatestReport();
            
            this.hideLoadingState();
            this.playRefreshSound();
            
        } catch (error) {
            console.error('❌ Failed to refresh data:', error);
            this.showErrorState();
        }
    }

    async parseLatestReport() {
        try {
            // This would normally fetch from the server
            // For now, we'll use the static data we already have
            console.log('📊 Using cached leaderboard data');
            
            // Update last updated timestamp
            const lastUpdatedElement = document.getElementById('lastUpdated');
            if (lastUpdatedElement) {
                const now = new Date();
                lastUpdatedElement.textContent = now.toLocaleDateString() + ' ' + 
                                               now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
        } catch (error) {
            console.error('Failed to parse report:', error);
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

    // Method to update leaderboard with new data
    updateLeaderboard(newData) {
        console.log('📊 Updating leaderboard with new data:', newData);
        
        // Update stats
        if (newData.totalUsers) {
            const element = document.getElementById('totalUsers');
            if (element) element.textContent = newData.totalUsers;
        }
        
        if (newData.totalVotes) {
            const element = document.getElementById('totalVotes');
            if (element) element.textContent = newData.totalVotes;
        }
        
        // Could update the entire leaderboard here with new rankings
        // This would require rebuilding the DOM elements
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